"use client";

import type { ProjectDocument } from "@/types/document";
import type { ExtractedDocumentPage } from "./pdf-extractor.ts";
import { extractDocumentText } from "./pdf-extractor.ts";
import type { SolidDocumentRepository } from "@/lib/solid-document-repository";

/**
 * Retrieval-augmented generation tahap 1: pemilihan konteks.
 *
 * Modul ini HANYA menyiapkan konteks dari dokumen yang sudah disetujui Owner
 * (`cpd:aiApproved true`), memecah teksnya menjadi potongan 300–500 kata, lalu
 * memberi peringkat potongan dengan BM25 di memori peramban. Tidak ada data
 * yang dikirim ke LLM pada tahap ini.
 */

export const DEFAULT_CHUNK_TARGET_WORDS = 400;
export const DEFAULT_CHUNK_MAX_WORDS = 500;
export const MIN_CHUNK_WORDS = 300;

export const DEFAULT_TOP_K = 4;
export const MIN_TOP_K = 3;
export const MAX_TOP_K = 5;

export interface DocumentChunk {
  /** ID stabil: `{documentId}#chunk-{n}`. */
  id: string;
  documentId: string;
  documentName: string;
  fileUrl: string;
  /** Halaman asal potongan (1-based); kosong bila tidak diketahui. */
  pageNumbers: number[];
  text: string;
  wordCount: number;
}

export interface ScoredChunk extends DocumentChunk {
  /** Skor BM25; makin besar makin relevan. */
  score: number;
  /** Kata kunci pertanyaan yang benar-benar muncul di potongan ini. */
  matchedTerms: string[];
}

export interface SkippedDocument {
  documentId: string;
  documentName: string;
  reason: string;
}

export interface ApprovedContextResult {
  projectId: string;
  /** Hanya dokumen dengan `aiApproved === true`. */
  approvedDocuments: ProjectDocument[];
  chunks: DocumentChunk[];
  skipped: SkippedDocument[];
  builtAt: string;
  /** `true` bila konteks diambil dari cache memori (tidak mengunduh ulang). */
  fromCache: boolean;
}

export interface ContextSearchResult {
  query: string;
  approvedDocuments: ProjectDocument[];
  chunks: ScoredChunk[];
  /** Jumlah seluruh potongan yang tersedia sebagai kandidat. */
  totalChunks: number;
  skipped: SkippedDocument[];
  builtAt: string;
  fromCache: boolean;
}

export interface ApprovedContextOptions {
  repository: SolidDocumentRepository;
  /** Kata target per potongan (default 400). */
  chunkTargetWords?: number;
  /** Batas maksimum kata per potongan (default 500). */
  chunkMaxWords?: number;
  /** Abaikan cache dan bangun ulang konteks dari Pod. */
  force?: boolean;
  onProgress?: (info: {
    documentName: string;
    index: number;
    total: number;
  }) => void;
}

export interface SearchApprovedContextsOptions extends ApprovedContextOptions {
  /** 3–5 potongan teratas; nilai lain dijepit ke rentang ini. */
  topK?: number;
}

/** Kata umum yang tidak membantu pencocokan (Indonesia + Inggris). */
const STOPWORDS = new Set([
  "ada",
  "adalah",
  "agar",
  "akan",
  "anda",
  "antara",
  "apa",
  "apakah",
  "atas",
  "atau",
  "bagaimana",
  "bagi",
  "bahwa",
  "berapa",
  "bila",
  "bisa",
  "dalam",
  "dan",
  "dapat",
  "dari",
  "dengan",
  "di",
  "dimana",
  "ini",
  "itu",
  "jika",
  "juga",
  "kapan",
  "ke",
  "karena",
  "kita",
  "kami",
  "mana",
  "mengapa",
  "mereka",
  "oleh",
  "pada",
  "para",
  "sebagai",
  "sebuah",
  "sedang",
  "siapa",
  "saya",
  "seperti",
  "sudah",
  "telah",
  "tentang",
  "terhadap",
  "the",
  "and",
  "are",
  "for",
  "from",
  "how",
  "into",
  "is",
  "of",
  "on",
  "that",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Tokenisasi sederhana: huruf kecil, buang tanda baca/diakritik, buang kata
 * umum, serta token yang terlalu pendek.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

/** Pecah teks menjadi kalimat/baris agar potongan tidak terputus di tengah. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n{2,}/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Potong unit yang lebih panjang dari batas kata menjadi beberapa bagian. */
function splitLongUnit(unit: string, maxWords: number): string[] {
  const words = unit.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    parts.push(words.slice(i, i + maxWords).join(" "));
  }
  return parts;
}

export interface TextChunkDraft {
  text: string;
  pageNumbers: number[];
  wordCount: number;
}

/**
 * Pecah halaman-halaman dokumen menjadi potongan ±400 kata (batas 500 kata).
 * Potongan boleh melintasi batas halaman; nomor halaman asal ikut dicatat.
 */
export function chunkDocumentText(
  pages: ExtractedDocumentPage[],
  options?: { targetWords?: number; maxWords?: number },
): TextChunkDraft[] {
  const maxWords = Math.max(50, options?.maxWords ?? DEFAULT_CHUNK_MAX_WORDS);
  const targetWords = Math.min(
    maxWords,
    Math.max(50, options?.targetWords ?? DEFAULT_CHUNK_TARGET_WORDS),
  );

  const chunks: TextChunkDraft[] = [];
  let sentences: string[] = [];
  let pageNumbers: number[] = [];
  let wordCount = 0;

  const flush = () => {
    if (sentences.length === 0) return;
    const text = sentences.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      chunks.push({
        text,
        pageNumbers: [...new Set(pageNumbers)],
        wordCount: countWords(text),
      });
    }
    sentences = [];
    pageNumbers = [];
    wordCount = 0;
  };

  for (const page of pages) {
    for (const sentence of splitSentences(page.text)) {
      const sentenceWords = countWords(sentence);

      if (sentenceWords > maxWords) {
        flush();
        for (const part of splitLongUnit(sentence, maxWords)) {
          sentences.push(part);
          pageNumbers.push(page.pageNumber);
          wordCount = countWords(part);
          flush();
        }
        continue;
      }

      if (wordCount > 0 && wordCount + sentenceWords > maxWords) {
        flush();
      }

      sentences.push(sentence);
      pageNumbers.push(page.pageNumber);
      wordCount += sentenceWords;

      if (wordCount >= targetWords) {
        flush();
      }
    }
  }

  flush();
  return chunks;
}

/** Indeks dokumen yang sudah diekstrak, dipakai ulang selama sesi. */
const chunkCache = new Map<string, TextChunkDraft[]>();
const projectCache = new Map<
  string,
  { signature: string; result: ApprovedContextResult }
>();

export function clearRetrievalCache(): void {
  chunkCache.clear();
  projectCache.clear();
}

function chunkCacheKey(
  document: ProjectDocument,
  targetWords: number,
  maxWords: number,
): string {
  // URL berkas memuat Pod + workspace, sehingga Proyek dengan ID sama di Pod
  // berbeda tidak pernah berbagi chunk.
  return `${document.fileUrl}:${document.sha256}:${targetWords}:${maxWords}`;
}

function projectCacheKey(
  projectId: string,
  repository: SolidDocumentRepository,
): string {
  return `${projectId}|${repository.documentsContainerUrl}|${repository.retrievalIdentity ?? ""}`;
}

function contextSignature(
  approved: ProjectDocument[],
  targetWords: number,
  maxWords: number,
): string {
  const documents = approved
    .map((doc) => `${doc.id}:${doc.sha256}`)
    .sort()
    .join("|");
  return `${targetWords}:${maxWords}:${documents}`;
}

/**
 * Ambil semua potongan teks dari dokumen proyek yang DISETUJUI untuk AI.
 *
 * Dokumen yang gagal dibaca/diekstrak tidak menggagalkan keseluruhan proses:
 * dicatat pada `skipped` agar bisa ditampilkan di UI. Penolakan akses WAC
 * (401/403) saat membaca daftar dokumen tetap dilempar ke pemanggil.
 */
export async function getApprovedContexts(
  projectId: string,
  options: ApprovedContextOptions,
): Promise<ApprovedContextResult> {
  const targetWords = Math.max(
    50,
    options.chunkTargetWords ?? DEFAULT_CHUNK_TARGET_WORDS,
  );
  const maxWords = Math.max(
    targetWords,
    options.chunkMaxWords ?? DEFAULT_CHUNK_MAX_WORDS,
  );

  const list = await options.repository.listDocuments();
  const approvedDocuments = list.documents.filter(
    (document) => document.isComplete && document.aiApproved,
  );

  const signature = contextSignature(approvedDocuments, targetWords, maxWords);
  const cacheKey = projectCacheKey(projectId, options.repository);
  const cached = projectCache.get(cacheKey);
  if (
    !options.repository.fetchApprovedDocumentBytes &&
    !options.force &&
    cached &&
    cached.signature === signature
  ) {
    return { ...cached.result, fromCache: true };
  }

  const skipped: SkippedDocument[] = [];
  const chunks: DocumentChunk[] = [];

  for (let index = 0; index < approvedDocuments.length; index += 1) {
    const document = approvedDocuments[index];
    options.onProgress?.({
      documentName: document.name,
      index: index + 1,
      total: approvedDocuments.length,
    });

    const cacheKey = chunkCacheKey(document, targetWords, maxWords);
    let drafts = chunkCache.get(cacheKey);

    try {
      // Even when text is cached, re-check access, consent and actual bytes.
      const approvedBytes = options.repository.fetchApprovedDocumentBytes
        ? await options.repository.fetchApprovedDocumentBytes(document)
        : null;
      if (!drafts) {
        const extracted = await extractDocumentText(document, () =>
          approvedBytes
            ? Promise.resolve(approvedBytes)
            : options.repository.fetchDocumentBytes(document),
        );

        if (!extracted.hasText) {
          skipped.push({
            documentId: document.id,
            documentName: document.name,
            reason:
              "Tidak ada teks yang dapat diekstrak (kemungkinan PDF hasil pindaian).",
          });
          continue;
        }

        drafts = chunkDocumentText(extracted.pages, {
          targetWords,
          maxWords,
        });
        chunkCache.set(cacheKey, drafts);
      }
    } catch (error) {
      const access = error as { status?: number; statusCode?: number };
      if ([401, 403].includes(access.status ?? access.statusCode ?? 0))
        throw error;
      skipped.push({
        documentId: document.id,
        documentName: document.name,
        reason:
          error instanceof Error
            ? error.message
            : "Teks dokumen tidak dapat diekstrak.",
      });
      continue;
    }

    drafts!.forEach((draft, chunkIndex) => {
      chunks.push({
        id: `${document.id}#chunk-${chunkIndex + 1}`,
        documentId: document.id,
        documentName: document.name,
        fileUrl: document.fileUrl,
        pageNumbers: draft.pageNumbers,
        text: draft.text,
        wordCount: draft.wordCount,
      });
    });
  }

  const result: ApprovedContextResult = {
    projectId,
    approvedDocuments,
    chunks,
    skipped,
    builtAt: new Date().toISOString(),
    fromCache: false,
  };

  projectCache.set(cacheKey, { signature, result });
  return result;
}

/**
 * Peringkat potongan dengan BM25 (k1 = 1.5, b = 0.75). Hanya potongan yang
 * memuat minimal satu kata kunci pertanyaan yang dikembalikan.
 */
export function searchChunks(
  query: string,
  chunks: DocumentChunk[],
  options?: { topK?: number },
): ScoredChunk[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0 || chunks.length === 0) {
    return [];
  }

  const topK = Math.min(
    MAX_TOP_K,
    Math.max(MIN_TOP_K, options?.topK ?? DEFAULT_TOP_K),
  );

  const k1 = 1.5;
  const lengthNormalization = 0.75;

  const tokenized = chunks.map((chunk) => {
    const terms = tokenize(chunk.text);
    const frequencies = new Map<string, number>();
    for (const term of terms) {
      frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    }
    return { terms, frequencies, length: terms.length };
  });

  const totalLength = tokenized.reduce((sum, item) => sum + item.length, 0);
  const averageLength = totalLength / tokenized.length || 1;

  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    let frequency = 0;
    for (const item of tokenized) {
      if (item.frequencies.has(term)) frequency += 1;
    }
    documentFrequency.set(term, frequency);
  }

  const scored: ScoredChunk[] = [];

  chunks.forEach((chunk, index) => {
    const item = tokenized[index];
    let score = 0;
    const matchedTerms: string[] = [];

    for (const term of queryTerms) {
      const termFrequency = item.frequencies.get(term) ?? 0;
      if (termFrequency === 0) continue;

      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
      const denominator =
        termFrequency +
        k1 *
          (1 -
            lengthNormalization +
            (lengthNormalization * item.length) / averageLength);

      score += idf * ((termFrequency * (k1 + 1)) / denominator);
      matchedTerms.push(term);
    }

    if (score > 0) {
      scored.push({ ...chunk, score, matchedTerms });
    }
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Ambil konteks dokumen yang disetujui lalu kembalikan 3–5 potongan paling
 * relevan untuk pertanyaan pengguna.
 */
export async function searchApprovedContexts(
  projectId: string,
  query: string,
  options: SearchApprovedContextsOptions,
): Promise<ContextSearchResult> {
  const context = await getApprovedContexts(projectId, options);
  const topK = Math.min(
    MAX_TOP_K,
    Math.max(MIN_TOP_K, options.topK ?? DEFAULT_TOP_K),
  );

  return {
    query,
    approvedDocuments: context.approvedDocuments,
    chunks: searchChunks(query, context.chunks, { topK }),
    totalChunks: context.chunks.length,
    skipped: context.skipped,
    builtAt: context.builtAt,
    fromCache: context.fromCache,
  };
}
