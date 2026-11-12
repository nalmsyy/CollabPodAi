"use client";

import type { DocumentMimeType, ProjectDocument } from "@/types/document";

/**
 * Ekstraksi teks dokumen di sisi klien.
 *
 * PDF dibaca dengan pdf.js langsung di memori peramban: berkas diunduh dari
 * Pod memakai `session.fetch` pemanggil, kemudian teksnya diambil per halaman
 * agar mudah dipotong (chunking) pada tahap AI berikutnya.
 */

export interface ExtractedDocumentPage {
  /** Nomor halaman mulai dari 1. */
  pageNumber: number;
  text: string;
}

export interface ExtractedDocumentText {
  mimeType: DocumentMimeType;
  pages: ExtractedDocumentPage[];
  /** Gabungan teks semua halaman. */
  text: string;
  pageCount: number;
  characterCount: number;
  /** `false` bila PDF tidak memuat lapisan teks (mis. hasil pindaian). */
  hasText: boolean;
}

export type DocumentExtractionErrorCode =
  | "load"
  | "unsupported"
  | "pdf"
  | "encrypted";

export class DocumentExtractionError extends Error {
  readonly code: DocumentExtractionErrorCode;

  constructor(code: DocumentExtractionErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "DocumentExtractionError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/** Atur lokasi worker pdf.js sekali per sesi peramban. */
async function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  const pdfjs = await import("pdfjs-dist");

  // Worker disalin ke public/ oleh scripts/copy-pdf-worker.mjs (postinstall).
  // Memuatnya sebagai berkas statis menghindari perbedaan perilaku bundler
  // antara Turbopack dan webpack.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  return pdfjs;
}

/** Rapikan spasi hasil ekstraksi tanpa menghilangkan pemisah baris/paragraf. */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPasswordError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name?: unknown }).name === "PasswordException"
  );
}

/** Ekstrak teks PDF per halaman dari isi biner yang sudah dimuat. */
export async function extractPdfPagesFromBuffer(
  data: ArrayBuffer
): Promise<ExtractedDocumentPage[]> {
  if (data.byteLength === 0) {
    throw new DocumentExtractionError("pdf", "Berkas PDF kosong.");
  }

  let pdfjs: typeof import("pdfjs-dist");
  try {
    pdfjs = await loadPdfJs();
  } catch (error) {
    throw new DocumentExtractionError(
      "load",
      "Pustaka pdf.js gagal dimuat di peramban.",
      error
    );
  }

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  } catch (error) {
    console.error(
      "pdf.js gagal membuka dokumen",
      (error as { name?: string })?.name,
      (error as { message?: string })?.message,
      (error as { details?: unknown })?.details
    );
    if (isPasswordError(error)) {
      throw new DocumentExtractionError(
        "encrypted",
        "PDF ini dilindungi kata sandi sehingga teksnya tidak dapat dibaca.",
        error
      );
    }
    throw new DocumentExtractionError(
      "pdf",
      "PDF tidak dapat dibaca. Berkas mungkin rusak atau bukan PDF yang valid.",
      error
    );
  }

  try {
    const pages: ExtractedDocumentPage[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      let raw = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        raw += item.str;
        raw += item.hasEOL ? "\n" : " ";
      }

      pages.push({ pageNumber, text: normalizeExtractedText(raw) });
      page.cleanup();
    }

    return pages;
  } finally {
    await pdf.destroy();
  }
}

/** Bangun hasil ekstraksi dari daftar halaman. */
export function buildExtractedDocument(
  mimeType: DocumentMimeType,
  pages: ExtractedDocumentPage[]
): ExtractedDocumentText {
  const text = pages
    .map((page) => page.text)
    .filter(Boolean)
    .join("\n\n");

  return {
    mimeType,
    pages,
    text,
    pageCount: pages.length,
    characterCount: text.length,
    hasText: text.trim().length > 0,
  };
}

/** Baca teks berkas TXT (UTF-8) dari isi biner. */
export function extractPlainTextFromBuffer(
  data: ArrayBuffer
): ExtractedDocumentText {
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(data);
  const text = normalizeExtractedText(decoded);

  return buildExtractedDocument("text/plain", [
    { pageNumber: 1, text },
  ]);
}

/**
 * Unduh dokumen dari Pod lalu ekstrak teksnya.
 *
 * `loadBytes` disediakan pemanggil agar permintaan tetap memakai
 * `session.fetch` sesi Solid yang aktif (tidak ada permintaan tanpa auth).
 */
export async function extractDocumentText(
  document: Pick<ProjectDocument, "mimeType">,
  loadBytes: () => Promise<ArrayBuffer>
): Promise<ExtractedDocumentText> {
  let data: ArrayBuffer;
  try {
    data = await loadBytes();
  } catch (error) {
    throw new DocumentExtractionError(
      "load",
      "Berkas tidak dapat diunduh dari Pod untuk ekstraksi teks.",
      error
    );
  }

  if (document.mimeType === "application/pdf") {
    const pages = await extractPdfPagesFromBuffer(data);
    return buildExtractedDocument("application/pdf", pages);
  }

  if (document.mimeType === "text/plain") {
    return extractPlainTextFromBuffer(data);
  }

  throw new DocumentExtractionError(
    "unsupported",
    "Ekstraksi teks hanya mendukung berkas PDF dan TXT."
  );
}
