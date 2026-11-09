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

interface AskAISectionProps {
  repository: SolidDocumentRepository;
  projectId: string;
  /** Daftar dokumen terkini; dipakai untuk menghitung dokumen disetujui. */
  documents: ProjectDocument[];
}

interface AskEntry {
  id: string;
  question: string;
  pending: boolean;
  error: string | null;
  result: ContextSearchResult | null;
}

interface ExtractionProgress {
  documentName: string;
  index: number;
  total: number;
}

const ACCESS_DENIED_PREFIX = "Akses Ditolak: Anda tidak memiliki izin";

let entryCounter = 0;
function nextEntryId(): string {
  entryCounter += 1;
  return `ask-${Date.now().toString(36)}-${entryCounter}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ambil kutipan singkat di sekitar kemunculan kata kunci pertama. */
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
    // Mulai di awal kata agar kutipan tidak terpotong di tengah kata.
    const space = text.indexOf(" ", start);
    if (space >= 0 && space - start < 40) start = space + 1;
  }

  let end = Math.min(text.length, start + maxChars);
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > start) end = space;
  }

  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < text.length) snippet = `${snippet}…`;
  return snippet;
}

function HighlightedText({
  text,
  terms,
}: {
  readonly text: string;
  readonly terms: string[];
}) {
  if (terms.length === 0) return <>{text}</>;

  const escaped = terms
    .map(escapeRegExp)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const pattern = new RegExp(`(${escaped})`, "gi");
  const lowered = new Set(terms.map((term) => term.toLowerCase()));

  return (
    <>
      {text.split(pattern).map((part, index) =>
        lowered.has(part.toLowerCase()) ? (
          <mark
            key={index}
            className="rounded-sm bg-primary/25 px-0.5 text-primary-foreground"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function pageLabel(pages: number[]): string {
  if (pages.length === 0) return "Halaman tidak diketahui";
  if (pages.length === 1) return `Hal. ${pages[0]}`;
  return `Hal. ${pages[0]}–${pages[pages.length - 1]}`;
}

function ChunkCard({
  chunk,
  rank,
}: {
  readonly chunk: ScoredChunk;
  readonly rank: number;
}) {
  return (
    <li className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/15 px-1 font-mono text-[10px] font-semibold text-primary">
          #{rank}
        </span>
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {chunk.documentName}
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {pageLabel(chunk.pageNumbers)}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {chunk.wordCount} kata
        </Badge>
        <Badge variant="teal" className="font-mono text-[10px]">
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
        <p className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground/80">
          Kata kunci cocok:
          {chunk.matchedTerms.map((term) => (
            <span
              key={term}
              className="rounded-sm border border-border px-1 font-mono"
            >
              {term}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

function EntryResult({ result }: { readonly result: ContextSearchResult }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>
          {result.chunks.length} potongan terpilih dari {result.totalChunks}{" "}
          potongan
        </span>
        <span aria-hidden>·</span>
        <span>{result.approvedDocuments.length} dokumen disetujui</span>
        {result.fromCache && (
          <Badge variant="outline" className="text-[10px]">
            cache
          </Badge>
        )}
      </div>

      {result.chunks.length > 0 ? (
        <ol className="space-y-2">
          {result.chunks.map((chunk, index) => (
            <ChunkCard key={chunk.id} chunk={chunk} rank={index + 1} />
          ))}
        </ol>
      ) : (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          <p className="font-semibold">Tidak ada potongan teks yang cocok.</p>
          <p className="mt-1 text-amber-200/80">
            Coba kata kunci lain yang lebih spesifik (istilah yang muncul di
            dokumen), atau pastikan dokumen yang relevan sudah disetujui untuk
            AI.
          </p>
          {result.approvedDocuments.length > 0 && (
            <p className="mt-1 text-amber-200/70">
              Dokumen yang bisa dicari:{" "}
              {result.approvedDocuments.map((doc) => doc.name).join(", ")}.
            </p>
          )}
        </div>
      )}

      {result.skipped.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-100">
          <p className="flex items-center gap-1.5 font-semibold">
            <TriangleAlert className="h-3.5 w-3.5" />
            {result.skipped.length} dokumen disetujui tidak dapat diproses
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-200/80">
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
  );
}

/**
 * Bagian tanya jawab berbasis dokumen (tahap RAG 1).
 *
 * Saat ini belum ada panggilan LLM: pertanyaan dijalankan melalui pencarian
 * BM25 atas potongan teks dokumen yang disetujui Owner, lalu potongan paling
 * relevan ditampilkan sebagai konteks agar dapat diperiksa manual.
 */
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
  const isBusy = entries.some((entry) => entry.pending);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (entries.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [entries.length]);

  const ask = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isBusy) return;

    const id = nextEntryId();
    setQuestion("");
    setEntries((current) => [
      ...current,
      { id, question: trimmed, pending: true, error: null, result: null },
    ]);

    try {
      const result = await searchApprovedContexts(projectId, trimmed, {
        repository,
        topK: 4,
        onProgress: (info) => setProgress(info),
      });

      setEntries((current) =>
        current.map((entry) =>
          entry.id === id
            ? { ...entry, pending: false, result, error: null }
            : entry
        )
      );
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
    } finally {
      setProgress(null);
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
              <Sparkles className="h-4 w-4 text-primary" />
              Tanya AI
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              RAG tahap 1
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Tanpa LLM
            </Badge>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Pertanyaan dicocokkan dengan potongan teks ±400 kata dari dokumen
            yang{" "}
            <span className="font-medium text-foreground">
              disetujui Owner
            </span>{" "}
            saja. Hasil pencarian ditampilkan sebagai konteks; belum dikirim ke
            model bahasa.
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 self-start font-mono text-[10px]">
          {approvedCount} dokumen disetujui
        </Badge>
      </div>

      {approvedCount === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">
            Belum ada dokumen yang disetujui untuk AI.
          </p>
          <p className="mt-1">
            Owner perlu membuka dokumen lalu mengaktifkan{" "}
            <span className="font-medium text-foreground">
              &ldquo;Setujui untuk AI&rdquo;
            </span>{" "}
            pada dokumen yang boleh dipakai sebagai konteks. Viewer dan Editor
            tidak dapat mengubah kebijakan ini.
          </p>
        </div>
      ) : (
        <>
          {entries.length > 0 && (
            <div
              className="space-y-4"
              aria-live="polite"
              aria-label="Riwayat tanya jawab"
            >
              {entries.map((entry) => (
                <div key={entry.id} className="space-y-2">
                  <div className="flex justify-end">
                    <p className="max-w-[85%] rounded-xl rounded-br-sm bg-primary/15 px-3 py-2 text-xs leading-relaxed text-foreground">
                      {entry.question}
                    </p>
                  </div>

                  {entry.pending ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>
                        {progress
                          ? `Mengekstrak ${progress.documentName} (${progress.index}/${progress.total})…`
                          : "Mencari dokumen yang disetujui…"}
                      </span>
                    </div>
                  ) : entry.error ? (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{entry.error}</span>
                    </div>
                  ) : entry.result ? (
                    <EntryResult result={entry.result} />
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
              placeholder="Contoh: Berapa anggaran irigasi dan apa saja rinciannya?"
              rows={2}
              maxLength={500}
              disabled={isBusy}
              className="resize-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">
                Enter untuk kirim · Shift+Enter baris baru · 4 potongan teratas
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
                {isBusy ? "Mencari…" : "Kirim"}
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
