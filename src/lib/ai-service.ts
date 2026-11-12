import type { AiContext } from "@/lib/ai-gateway";
import type { ScoredChunk } from "@/lib/retrieval";

/**
 * Klien tipis untuk AI Gateway internal (`POST /api/ask`).
 *
 * Browser tidak pernah melihat GEMINI_API_KEY: modul ini hanya mengirim
 * pertanyaan + potongan konteks ke Route Handler milik aplikasi sendiri.
 */

export interface AskAiUsage {
  promptTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface AskAiResult {
  answer: string;
  model: string;
  usage: AskAiUsage | null;
}

export class AskAiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AskAiError";
    this.code = code;
    this.status = status;
  }
}

/** Ubah hasil retrieval menjadi payload konteks untuk Gateway. */
export function chunksToContexts(chunks: ScoredChunk[]): AiContext[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    pageNumbers: [...chunk.pageNumbers],
    text: chunk.text,
  }));
}

function readError(body: unknown, status: number): AskAiError {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      const code = typeof record.code === "string" ? record.code : "ask_failed";
      const message =
        typeof record.message === "string"
          ? record.message
          : "Gagal meminta jawaban AI.";
      return new AskAiError(code, message, status);
    }
  }
  return new AskAiError(
    "ask_failed",
    `Gagal meminta jawaban AI (HTTP ${status}).`,
    status,
  );
}

export async function askAi(options: {
  question: string;
  chunks?: ScoredChunk[];
  contexts?: AiContext[];
  signal?: AbortSignal;
}): Promise<AskAiResult> {
  let response: Response;
  try {
    response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: options.question,
        contexts: options.contexts ?? chunksToContexts(options.chunks ?? []),
      }),
      signal: options.signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AskAiError("aborted", "Permintaan dibatalkan.", 0);
    }
    throw new AskAiError(
      "network_error",
      "Tidak dapat menghubungi AI Gateway. Periksa koneksi Anda.",
      0,
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw readError(body, response.status);
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { answer?: unknown }).answer !== "string"
  ) {
    throw new AskAiError(
      "invalid_response",
      "AI Gateway mengembalikan respons yang tidak dikenali.",
      response.status,
    );
  }

  const record = body as {
    answer: string;
    model?: unknown;
    usage?: unknown;
  };

  return {
    answer: record.answer,
    model: typeof record.model === "string" ? record.model : "Gemini",
    usage: parseUsage(record.usage),
  };
}

function parseUsage(value: unknown): AskAiUsage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const toNumber = (input: unknown): number | null =>
    typeof input === "number" && Number.isFinite(input) ? input : null;
  return {
    promptTokens: toNumber(record.promptTokens),
    outputTokens: toNumber(record.outputTokens),
    totalTokens: toNumber(record.totalTokens),
  };
}
