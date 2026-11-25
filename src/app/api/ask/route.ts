import { ApiError, GoogleGenAI } from "@google/genai";
import {
  buildSystemInstruction,
  buildUserPrompt,
  parseAskRequest,
  validateAnswerCitations,
} from "@/lib/ai-gateway";

/**
 * AI Gateway: satu-satunya tempat yang memegang GEMINI_API_KEY.
 * Browser hanya memanggil endpoint internal ini; API key tidak pernah
 * dikirim ke klien.
 */

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];
const REQUEST_TIMEOUT_MS = 45_000;
const PER_ATTEMPT_TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 128 * 1024;

function getModelsToTry(): string[] {
  const envModel = process.env.GEMINI_MODEL?.trim();
  const list = [envModel || DEFAULT_MODEL, ...FALLBACK_MODELS];
  return Array.from(new Set(list.filter(Boolean)));
}

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return jsonResponse({ error: { code, message } }, status);
}

/** Tolak permintaan dari origin lain agar API key tidak bisa dipakai situs lain. */
function isForeignOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

interface GeminiFailure {
  status: number;
  code: string;
  message: string;
}

function describeGeminiFailure(
  error: unknown,
  modelName?: string,
): GeminiFailure {
  const model = modelName || process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  if (error instanceof ApiError) {
    console.error("[api/ask] Gemini API error", {
      status: error.status,
      message: error.message,
      model,
    });

    if (error.status === 400 || error.status === 401 || error.status === 403) {
      if (error.status === 403) {
        return {
          status: 502,
          code: "gemini_permission_denied",
          message:
            "Kunci API Gemini tidak memiliki izin untuk model ini. Periksa GEMINI_API_KEY dan GEMINI_MODEL di server.",
        };
      }
      return {
        status: 502,
        code: "gemini_invalid_key",
        message:
          "Kunci API Gemini ditolak. Periksa nilai GEMINI_API_KEY di .env.local lalu restart server.",
      };
    }
    if (error.status === 404) {
      return {
        status: 502,
        code: "gemini_model_not_found",
        message: `Model "${model}" tidak tersedia untuk kunci API ini. Set GEMINI_MODEL ke model yang tersedia (misal: ${DEFAULT_MODEL}), lalu restart server.`,
      };
    }
    if (error.status === 429) {
      return {
        status: 503,
        code: "gemini_rate_limited",
        message:
          "Kuota Gemini tercapai atau terlalu banyak permintaan. Coba lagi beberapa saat lagi.",
      };
    }
    if (error.status === 503) {
      return {
        status: 503,
        code: "gemini_overloaded",
        message:
          "Server Gemini sedang padat sementara (HTTP 503). Tunggu beberapa detik lalu coba kirim ulang.",
      };
    }
    return {
      status: 502,
      code: "gemini_upstream_error",
      message: `Gemini menolak permintaan (HTTP ${error.status}). Coba lagi atau periksa konfigurasi model.`,
    };
  }

  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    console.error("[api/ask] Gemini request timed out");
    return {
      status: 504,
      code: "gemini_timeout",
      message:
        "Gemini tidak merespons dalam 45 detik. Periksa koneksi lalu coba lagi.",
    };
  }

  console.error("[api/ask] Unexpected gateway error", error);
  return {
    status: 502,
    code: "gemini_unreachable",
    message: "Gagal menghubungi Gemini. Periksa koneksi server lalu coba lagi.",
  };
}

export async function POST(request: Request): Promise<Response> {
  if (isForeignOrigin(request)) {
    return errorResponse(
      403,
      "forbidden_origin",
      "Permintaan hanya diizinkan dari aplikasi ini.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return errorResponse(
      413,
      "payload_too_large",
      "Body permintaan terlalu besar.",
    );
  }

  let payload: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return errorResponse(
        413,
        "payload_too_large",
        "Body permintaan terlalu besar.",
      );
    }
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse(
      400,
      "invalid_json",
      "Body permintaan harus berupa JSON yang valid.",
    );
  }

  const validation = parseAskRequest(payload);
  if (!validation.ok) {
    return errorResponse(
      validation.status,
      validation.code,
      validation.message,
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return errorResponse(
      503,
      "missing_api_key",
      "GEMINI_API_KEY belum diset di server. Tambahkan nilainya ke .env.local lalu restart server.",
    );
  }

  const { question, contexts } = validation.data;
  const ai = new GoogleGenAI({ apiKey });

  const modelsToTry = getModelsToTry();
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;
  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
  let usedModel = modelsToTry[0];
  let lastError: unknown = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 1000) break;

    const currentModel = modelsToTry[i];
    usedModel = currentModel;
    // Gemini 2.5 Flash mendukung thinkingBudget 0. Model lain memakai pengaturan default.
    const disableThinking = /gemini-2\.5-flash$/i.test(currentModel);

    try {
      response = await ai.models.generateContent({
        model: currentModel,
        contents: buildUserPrompt(question, contexts),
        config: {
          systemInstruction: buildSystemInstruction(),
          temperature: 0.2,
          maxOutputTokens: 2048,
          ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          abortSignal: AbortSignal.timeout(
            Math.min(PER_ATTEMPT_TIMEOUT_MS, remainingMs),
          ),
        },
      });
      break;
    } catch (error) {
      lastError = error;
      const isRetriableWithFallback =
        error instanceof ApiError &&
        (error.status === 404 || error.status === 503 || error.status === 429);
      const hasMoreModels = i < modelsToTry.length - 1;

      if (isRetriableWithFallback && hasMoreModels) {
        console.warn(
          `[api/ask] Model "${currentModel}" gagal (HTTP ${error.status}). Mencoba model cadangan "${modelsToTry[i + 1]}"...`,
        );
        if (error.status === 503 || error.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        continue;
      }
      break;
    }
  }

  if (!response) {
    const failure = describeGeminiFailure(lastError, usedModel);
    return errorResponse(failure.status, failure.code, failure.message);
  }

  const answer = response.text?.trim();
  if (!answer) {
    const blocked = response.promptFeedback?.blockReason;
    console.error("[api/ask] Gemini returned no text", {
      blockReason: blocked,
      finishReason: response.candidates?.[0]?.finishReason,
    });
    return errorResponse(
      502,
      blocked ? "gemini_blocked" : "gemini_empty_response",
      blocked
        ? `Gemini memblokir permintaan (alasan: ${blocked}). Coba ubah pertanyaan Anda.`
        : "Gemini tidak mengembalikan teks jawaban. Coba lagi.",
    );
  }

  if (!validateAnswerCitations(answer, contexts.length)) {
    return errorResponse(
      502,
      "invalid_citations",
      "Jawaban AI belum memiliki rujukan yang valid. Coba lagi; jawaban tersebut tidak disimpan sebagai konteks tim.",
    );
  }
  const usage = response.usageMetadata;
  return jsonResponse(
    {
      answer,
      model: response.modelVersion || usedModel,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount ?? null,
            outputTokens: usage.candidatesTokenCount ?? null,
            totalTokens: usage.totalTokenCount ?? null,
          }
        : null,
    },
    200,
  );
}
