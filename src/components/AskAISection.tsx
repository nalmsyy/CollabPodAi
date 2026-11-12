"use client";

import * as React from "react";
import {
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectDocument } from "@/types/document";
import type { SolidDocumentRepository } from "@/lib/solid-document-repository";
import {
  isSolidDocumentAccessDenied,
  describeSolidDocumentError,
} from "@/lib/solid-document-repository";
import {
  searchApprovedContexts,
  type ContextSearchResult,
  type ScoredChunk,
} from "@/lib/retrieval";
import { askAi, AskAiError } from "@/lib/ai-service";

interface AskAISectionProps {
  repository: SolidDocumentRepository;
  projectId: string;
  /** Daftar dokumen terkini; dipakai untuk menghitung dokumen disetujui. */
  documents: ProjectDocument[];
}

interface AnswerState {
  pending: boolean;
  text: string | null;
  model: string | null;
  error: { code: string; message: string } | null;
}

interface AskEntry {
  id: string;
  question: string;
  pending: boolean;
  error: string | null;
  result: ContextSearchResult | null;
  answer: AnswerState;
}

interface ExtractionProgress {
  documentName: string;
  index: number;
  total: number;
}

const ACCESS_DENIED_PREFIX = "Akses Ditolak: Anda tidak memiliki izin";

const EMPTY_ANSWER: AnswerState = {
  pending: false,
  text: null,
  model: null,
  error: null,
};

let entryCounter = 0;
function nextEntryId(): string {
  entryCounter += 1;
  return `ask-${Date.now().toString(36)}-${entryCounter}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSnippet(text: string, terms: string[], maxChars = 320): string {
  const lower = text.toLowerCase();
  let index = -1;
  for (const term of terms) {
    const found = lower.indexOf(term.toLowerCase());
    if (found >= 0 && (index < 0 || found < index)) {
      index = found;
    }
  }

  let start = index <= 80 ? 0 : index - 80;
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space >= 0 && space - start < 40) start = space + 1;
  }

  let end = Math.min(text.length, start + maxChars);
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > start) end = space;
  }

  const snippet = text.slice(start, end).trim();
  const prefix = start > 0 ? "… " : "";
  const suffix = end < text.length ? " …" : "";
  return `${prefix}${snippet}${suffix}`;
}

function HighlightedText({
  text,
  terms,
}: {
  readonly text: string;
  readonly terms: string[];
}) {
  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(
    `(${terms.map(escapeRegExp).filter(Boolean).join("|")})`,
    "gi"
  );
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = terms.some(
          (term) => term.toLowerCase() === part.toLowerCase()
        );
        if (isMatch) {
          return (
            <mark
              key={i}
              className="rounded bg-[#cadab7]/60 px-0.5 font-medium text-[#2b3027]"
            >
              {part}
            </mark>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

function ChunkCard({
  chunk,
  rank,
}: {
  readonly chunk: ScoredChunk;
  readonly rank: number;
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-3 text-left">
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <FileText className="h-3.5 w-3.5 text-[#53643e]" />
          <span>
            #{rank} {chunk.documentName}
          </span>
          {chunk.pageNumbers.length > 0 && (
            <span className="text-muted-foreground">
              · Hal {chunk.pageNumbers.join(", ")}
            </span>
          )}
        </div>
        <Badge variant="olive" className="font-mono text-[10px]">
          BM25 {chunk.score.toFixed(2)}
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        <HighlightedText
          text={buildSnippet(chunk.text, chunk.matchedTerms)}
          terms={chunk.matchedTerms}
        />
      </p>
      {chunk.matchedTerms.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
          Kata kunci cocok:
          {chunk.matchedTerms.map((term) => (
            <span
              key={term}
              className="rounded-sm border border-border px-1 font-mono text-foreground"
            >
              {term}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

function AnswerPanel({
  answer,
  chunkCount,
}: {
  readonly answer: AnswerState;
  readonly chunkCount: number;
}) {
  if (answer.pending) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <span>
          Menyusun jawaban dari {chunkCount} potongan dokumen lewat AI Gateway…
        </span>
      </div>
    );
  }

  if (answer.error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
        <p className="flex items-start gap-2 font-semibold text-rose-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
          Jawaban AI gagal dibuat
        </p>
        <p className="mt-1 pl-5 text-rose-700">{answer.error.message}</p>
        {answer.error.code === "missing_api_key" && (
          <p className="mt-1 pl-5 text-[10px] text-rose-600">
            Tambahkan <code className="font-mono">GEMINI_API_KEY</code> ke
            berkas <code className="font-mono">.env.local</code>, lalu restart
            dev server.
          </p>
        )}
      </div>
    );
  }

  if (!answer.text) return null;

  return (
    <div className="rounded-xl border border-[#dce6ce] bg-[#fffefa] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#e3e6da]">
        <div className="w-5 h-5 rounded-md bg-[#eef3e6] flex items-center justify-center text-[#53643e]">
          <Sparkles className="h-3 w-3" />
        </div>
        <span className="text-xs font-semibold text-foreground">
          CollabPod AI
        </span>
        {answer.model && (
          <Badge variant="outline" className="font-mono text-[9px]">
            {answer.model}
          </Badge>
        )}
        <Badge variant="olive" className="text-[9px]">
          {chunkCount} sumber
        </Badge>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
        {answer.text}
      </p>
    </div>
  );
}

function EntryResult({
  result,
  answer,
}: {
  readonly result: ContextSearchResult;
  readonly answer: AnswerState;
}) {
  return (
    <div className="space-y-2">
      {result.chunks.length > 0 ? (
        <AnswerPanel answer={answer} chunkCount={result.chunks.length} />
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold text-amber-800">Tidak ada potongan teks yang cocok.</p>
          <p className="mt-1 text-amber-700">
            Jawaban AI tidak dibuat karena tidak ada konteks yang relevan. Coba
            kata kunci lain yang lebih spesifik, atau pastikan dokumen yang relevan sudah disetujui untuk AI.
          </p>
        </div>
      )}

      {result.chunks.length > 0 && (
        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>
              Lihat sumber konteks ({result.chunks.length} potongan ·{" "}
              {result.approvedDocuments.length} dokumen disetujui)
            </span>
            {result.fromCache && (
              <Badge variant="outline" className="text-[10px]">
                cache
              </Badge>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground group-open:hidden">
              Buka
            </span>
            <span className="ml-auto hidden text-[10px] text-muted-foreground group-open:inline">
              Tutup
            </span>
          </summary>
          <div className="space-y-2 border-t border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              Teks asli yang dikirim ke Gemini sebagai konteks — hanya dari
              dokumen yang disetujui Owner.
            </p>
            <ol className="space-y-2">
              {result.chunks.map((chunk, index) => (
                <ChunkCard key={chunk.id} chunk={chunk} rank={index + 1} />
              ))}
            </ol>
            {result.skipped.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
                <p className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
                  {result.skipped.length} dokumen disetujui tidak dapat diproses
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-700">
                  {result.skipped.map((item) => (
                    <li key={item.documentId}>
                      <span className="font-medium">{item.documentName}</span>:{" "}
                      {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export function AskAISection({
  repository,
  projectId,
  documents,
}: AskAISectionProps) {
  const approvedCount = docsWithApproval(documents);
  const [entries, setEntries] = React.useState<AskEntry[]>([]);
  const [question, setQuestion] = React.useState("");
  const [progress, setProgress] = React.useState<ExtractionProgress | null>(
    null
  );
  const isBusy = entries.some(
    (entry) => entry.pending || entry.answer.pending
  );
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (entries.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [entries]);

  const ask = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isBusy) return;

    const id = nextEntryId();
    setQuestion("");
    setEntries((current) => [
      ...current,
      {
        id,
        question: trimmed,
        pending: true,
        error: null,
        result: null,
        answer: EMPTY_ANSWER,
      },
    ]);

    let result: ContextSearchResult;
    try {
      result = await searchApprovedContexts(projectId, trimmed, {
        repository,
        topK: 4,
        onProgress: (info) => setProgress(info),
      });
    } catch (error) {
      const message = isSolidDocumentAccessDenied(error)
        ? `${ACCESS_DENIED_PREFIX} untuk membaca dokumen proyek ini.`
        : `Pencarian konteks gagal: ${describeSolidDocumentError(error).message}`;

      setEntries((current) =>
        current.map((entry) =>
          entry.id === id
            ? { ...entry, pending: false, result: null, error: message }
            : entry
        )
      );
      setProgress(null);
      return;
    }

    setProgress(null);
    const hasContexts = result.chunks.length > 0;
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              pending: false,
              result,
              error: null,
              answer: hasContexts
                ? { ...EMPTY_ANSWER, pending: true }
                : EMPTY_ANSWER,
            }
          : entry
      )
    );

    if (!hasContexts) return;

    try {
      const response = await askAi({ question: trimmed, chunks: result.chunks });
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                answer: {
                  pending: false,
                  text: response.answer,
                  model: response.model,
                  error: null,
                },
              }
            : entry
        )
      );
    } catch (error) {
      const answerError =
        error instanceof AskAiError
          ? { code: error.code, message: error.message }
          : {
              code: "ask_failed",
              message:
                "Terjadi kesalahan tak terduga saat meminta jawaban AI. Coba lagi.",
            };
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                answer: {
                  pending: false,
                  text: null,
                  model: null,
                  error: answerError,
                },
              }
            : entry
        )
      );
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void ask(question);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(question);
    }
  };

  return (
    <section className="space-y-4 border-t border-border pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-[#53643e]" />
              Tanya AI
            </h2>
            <Badge variant="olive" className="text-[10px]">
              RAG + Gemini
            </Badge>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Pertanyaan dicocokkan dengan potongan teks dari dokumen yang{" "}
            <span className="font-medium text-foreground">
              disetujui Owner
            </span>{" "}
            saja.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 self-start font-mono text-[10px]">
          {approvedCount} dokumen disetujui
        </Badge>
      </div>

      {approvedCount === 0 ? (
        <div className="rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">
            Belum ada dokumen yang disetujui untuk AI.
          </p>
          <p className="mt-1">
            Owner perlu menyetujui dokumen di tabel atas agar dapat dipakai sebagai konteks tanya jawab AI.
          </p>
        </div>
      ) : (
        <>
          {entries.length > 0 && (
            <div
              className="space-y-3"
              aria-live="polite"
              aria-label="Riwayat tanya jawab"
            >
              {entries.map((entry) => (
                <div key={entry.id} className="space-y-2">
                  <div className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#e8ebd9] border border-[#dce6ce] px-3.5 py-2.5 text-xs leading-relaxed text-foreground">
                      {entry.question}
                    </p>
                  </div>

                  {entry.pending ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>
                        {progress
                          ? `Mengekstrak ${progress.documentName} (${progress.index}/${progress.total})…`
                          : "Mencari dokumen yang disetujui…"}
                      </span>
                    </div>
                  ) : entry.error ? (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                      <span>{entry.error}</span>
                    </div>
                  ) : entry.result ? (
                    <EntryResult result={entry.result} answer={entry.answer} />
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2">
            <label htmlFor="ask-ai-input" className="sr-only">
              Pertanyaan tentang dokumen
            </label>
            <Textarea
              id="ask-ai-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanyakan sesuatu tentang dokumen yang disetujui…"
              rows={2}
              maxLength={500}
              disabled={isBusy}
              className="resize-none bg-card"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">
                Enter untuk kirim · Shift+Enter untuk baris baru
              </p>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isBusy || question.trim().length === 0}
                className="inline-flex items-center gap-1.5"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isBusy ? "Memproses…" : "Kirim"}
              </Button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

function docsWithApproval(documents: ProjectDocument[]): number {
  return documents.filter((doc) => doc.isComplete && doc.aiApproved).length;
}
