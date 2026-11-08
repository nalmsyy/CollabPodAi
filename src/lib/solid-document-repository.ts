"use client";

import type {
  DocumentListResult,
  DocumentMimeType,
  DocumentValidationResult,
  IncompleteProjectDocument,
  ProjectDocument,
} from "@/types/document";

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_DOCUMENTS_PER_PROJECT = 10;
export const SUPPORTED_MIME_TYPES: readonly DocumentMimeType[] = [
  "application/pdf",
  "text/plain",
] as const;

const CPD = "https://collabpod.ai/ns#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";

type SolidClient = typeof import("@inrupt/solid-client");

let solidClientPromise: Promise<SolidClient> | null = null;

function loadSolidClient(): Promise<SolidClient> {
  if (!solidClientPromise) {
    solidClientPromise = import("@inrupt/solid-client");
  }
  return solidClientPromise;
}

export type SolidDocumentStep =
  | "validate-file"
  | "prepare-container"
  | "upload-binary"
  | "write-metadata"
  | "verify-readback"
  | "list-documents"
  | "download-binary";

export const SOLID_DOCUMENT_STEP_LABEL: Record<SolidDocumentStep, string> = {
  "validate-file": "memvalidasi berkas dokumen",
  "prepare-container": "menyiapkan kontainer dokumen di Pod",
  "upload-binary": "mengunggah berkas biner ke Pod",
  "write-metadata": "menulis metadata dokumen ke Pod",
  "verify-readback": "memverifikasi pembacaan ulang dokumen",
  "list-documents": "membaca daftar dokumen dari Pod",
  "download-binary": "mengunduh berkas dari Pod",
};

export class SolidDocumentError extends Error {
  readonly step: SolidDocumentStep;

  constructor(step: SolidDocumentStep, cause?: unknown) {
    super(`Gagal ${SOLID_DOCUMENT_STEP_LABEL[step]}.`);
    this.name = "SolidDocumentError";
    this.step = step;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class SolidDocumentAccessDeniedError extends Error {
  readonly resourceUrl: string;
  readonly status: number;

  constructor(resourceUrl: string, status: number) {
    super(`Akses ke dokumen ditolak oleh server Pod (HTTP ${status}).`);
    this.name = "SolidDocumentAccessDeniedError";
    this.resourceUrl = resourceUrl;
    this.status = status;
  }
}

export function isSolidDocumentAccessDenied(error: unknown): boolean {
  if (error instanceof SolidDocumentAccessDeniedError) {
    return true;
  }
  const status = httpStatusOf(error);
  return status === 401 || status === 403;
}

export function describeSolidDocumentError(error: unknown): {
  stepLabel: string;
  message: string;
} {
  if (error instanceof SolidDocumentAccessDeniedError) {
    return {
      stepLabel: "Akses dokumen ditolak.",
      message:
        "Server Pod menolak permintaan dokumen. Pastikan Anda memiliki izin akses pada workspace ini.",
    };
  }

  if (error instanceof SolidDocumentError) {
    const detail =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === "string"
          ? error.cause
          : null;
    return {
      stepLabel: `Gagal ${SOLID_DOCUMENT_STEP_LABEL[error.step]}.`,
      message: detail?.trim() || error.message,
    };
  }

  return {
    stepLabel: "Operasi dokumen di Pod gagal.",
    message: error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.",
  };
}

export interface SolidDocumentContext {
  /** URL kontainer workspace proyek: {podUrl}/collabpod/projects/{projectId}/ */
  workspaceUrl: string;
  /** WebID pengguna aktif */
  webId: string;
  /** WebID pemilik proyek */
  ownerWebId: string;
  /** `session.fetch` dari sesi Solid aktif */
  fetch: typeof fetch;
  /** Factory ID dokumen stabil */
  idFactory?: () => string;
  /** Solid client untuk pengujian regresi */
  client?: SolidClient;
}

export function createDocumentId(): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `doc-${Date.now().toString(36)}-${suffix}`;
}

export function normalizeContainerUrl(url: string): string {
  return `${url.trim().replace(/\/+$/, "")}/`;
}

/** Tentukan MIME type dan ekstensi berkas yang valid. */
export function detectDocumentMimeType(
  filename: string,
  declaredType?: string
): DocumentMimeType | null {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".pdf") || declaredType === "application/pdf") {
    return "application/pdf";
  }
  if (
    lowerName.endsWith(".txt") ||
    declaredType === "text/plain" ||
    declaredType === "text/x-log"
  ) {
    return "text/plain";
  }
  return null;
}

/** Hitung hash SHA-256 dari konten biner menggunakan Web Crypto API standar. */
export async function computeFileSha256(data: ArrayBuffer): Promise<string> {
  const subtle =
    typeof crypto !== "undefined" && crypto.subtle
      ? crypto.subtle
      : typeof globalThis !== "undefined" && globalThis.crypto?.subtle
        ? globalThis.crypto.subtle
        : null;

  if (subtle && typeof subtle.digest === "function") {
    const hashBuffer = await subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  throw new Error("Kriptografi Web Crypto SHA-256 tidak tersedia.");
}

/** Format ukuran byte ke representasi manusia (KB, MB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Format tanggal ISO ke format Indonesia. */
export function formatUploadedAt(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return isoString;
  }
}

/** Validasi berkas sebelum diunggah ke Pod. */
export function validateDocumentFile(
  file: { name: string; size: number; type?: string },
  existingCompleteCount = 0
): DocumentValidationResult {
  if (!file || !file.name) {
    return { valid: false, error: "Berkas tidak valid." };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: "Berkas kosong (0 byte) tidak dapat diunggah.",
    };
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `Ukuran berkas (${formatBytes(
        file.size
      )}) melebihi batas maksimal 5 MB.`,
    };
  }

  const mimeType = detectDocumentMimeType(file.name, file.type);
  if (!mimeType || !SUPPORTED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error:
        "Hanya berkas format PDF (.pdf) dan teks (.txt) yang didukung pada tahap ini.",
    };
  }

  if (existingCompleteCount >= MAX_DOCUMENTS_PER_PROJECT) {
    return {
      valid: false,
      error: `Batas maksimal ${MAX_DOCUMENTS_PER_PROJECT} dokumen per proyek telah tercapai.`,
    };
  }

  return { valid: true };
}

export class SolidDocumentRepository {
  private readonly workspaceUrl: string;
  private readonly webId: string;
  private readonly ownerWebId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly idFactory: () => string;
  private readonly solidClient: SolidClient | null;

  constructor(context: SolidDocumentContext) {
    this.workspaceUrl = normalizeContainerUrl(context.workspaceUrl);
    this.webId = context.webId;
    this.ownerWebId = context.ownerWebId;
    this.fetchImpl = context.fetch;
    this.idFactory = context.idFactory ?? createDocumentId;
    this.solidClient = context.client ?? null;
  }

  private solid(): SolidClient | Promise<SolidClient> {
    return this.solidClient ?? loadSolidClient();
  }

  /** URL kontainer data dokumen: {workspace}data/documents/ */
  get documentsContainerUrl(): string {
    return `${this.workspaceUrl}data/documents/`;
  }

  /** URL kontainer dokumen individual: {workspace}data/documents/{documentId}/ */
  documentContainerUrlFor(documentId: string): string {
    return `${this.documentsContainerUrl}${documentId}/`;
  }

  /** URL berkas biner di Pod. */
  fileUrlFor(documentId: string, mimeType: DocumentMimeType): string {
    const extension = mimeType === "application/pdf" ? "pdf" : "txt";
    return `${this.documentContainerUrlFor(documentId)}file.${extension}`;
  }

  /** URL metadata RDF di Pod. */
  metadataUrlFor(documentId: string): string {
    return `${this.documentContainerUrlFor(documentId)}metadata.ttl`;
  }

  /**
   * Baca daftar dokumen yang tersimpan pada kontainer proyek di Pod.
   */
  async listDocuments(): Promise<DocumentListResult> {
    const { getSolidDataset, getThing, getUrlAll } = await this.solid();

    let containerDataset;
    try {
      containerDataset = await getSolidDataset(this.documentsContainerUrl, {
        fetch: this.fetchImpl,
      });
    } catch (error) {
      const status = httpStatusOf(error);
      if (status === 404 || status === 410) {
        // Kontainer dokumen belum ada berarti proyek belum memiliki dokumen.
        return { documents: [], incompleteDocuments: [] };
      }
      if (status === 401 || status === 403) {
        throw new SolidDocumentAccessDeniedError(
          this.documentsContainerUrl,
          status
        );
      }
      throw new SolidDocumentError("list-documents", error);
    }

    const containerThing = getThing(
      containerDataset,
      this.documentsContainerUrl
    );
    const childUrls = containerThing
      ? getUrlAll(containerThing, LDP_CONTAINS)
      : [];

    const documents: ProjectDocument[] = [];
    const incompleteDocuments: IncompleteProjectDocument[] = [];

    // Baca setiap sub-kontainer dokumen
    for (const childUrl of childUrls) {
      // Pastikan trailing slash untuk kontainer
      const docContainerUrl = childUrl.endsWith("/")
        ? childUrl
        : `${childUrl}/`;
      const segments = docContainerUrl.replace(/\/+$/, "").split("/");
      const docId = segments[segments.length - 1];

      try {
        const metadataUrl = `${docContainerUrl}metadata.ttl`;
        const docDataset = await getSolidDataset(metadataUrl, {
          fetch: this.fetchImpl,
        });
        const docThing = getThing(docDataset, `${metadataUrl}#document`);

        if (!docThing) {
          incompleteDocuments.push({
            id: docId,
            documentContainerUrl: docContainerUrl,
            metadataUrl,
            reason: "Thing metadata #document tidak ditemukan.",
          });
          continue;
        }

        const { getStringNoLocale, getUrl, getDatetime } = await this.solid();

        const id = getStringNoLocale(docThing, `${CPD}id`) ?? docId;
        const name = getStringNoLocale(docThing, `${CPD}name`) ?? docId;
        const fileUrl = getUrl(docThing, `${CPD}fileUrl`);
        const mimeType = (getStringNoLocale(docThing, `${CPD}mimeType`) ??
          "text/plain") as DocumentMimeType;
        const sizeBytes = parseInt(
          getStringNoLocale(docThing, `${CPD}sizeBytes`) ?? "0",
          10
        );
        const uploadedAt =
          getDatetime(docThing, `${CPD}uploadedAt`)?.toISOString() ??
          new Date(0).toISOString();
        const uploaderWebId =
          getUrl(docThing, `${CPD}uploader`) ?? this.ownerWebId;
        const sha256 = getStringNoLocale(docThing, `${CPD}sha256`) ?? "";

        if (!fileUrl) {
          incompleteDocuments.push({
            id: docId,
            documentContainerUrl: docContainerUrl,
            metadataUrl,
            reason: "URL berkas biner tidak tercantum dalam metadata.",
          });
          continue;
        }

        // Verifikasi bahwa berkas biner benar-benar ada di Pod
        const fileCheck = await this.verifyFileExists(fileUrl);
        if (!fileCheck) {
          incompleteDocuments.push({
            id: docId,
            documentContainerUrl: docContainerUrl,
            fileUrl,
            metadataUrl,
            reason: "Berkas biner belum tersimpan di Pod.",
          });
          continue;
        }

        documents.push({
          id,
          name,
          fileUrl,
          metadataUrl,
          mimeType,
          sizeBytes,
          uploadedAt,
          uploaderWebId,
          sha256,
          isComplete: true,
        });
      } catch (err) {
        const status = httpStatusOf(err);
        if (status === 401 || status === 403) {
          incompleteDocuments.push({
            id: docId,
            documentContainerUrl: docContainerUrl,
            reason: `Akses ditolak pada entri dokumen (HTTP ${status}).`,
          });
        } else {
          incompleteDocuments.push({
            id: docId,
            documentContainerUrl: docContainerUrl,
            reason:
              err instanceof Error
                ? err.message
                : "Metadata dokumen tidak dapat dibaca.",
          });
        }
      }
    }

    // Urutkan dokumen terbaru di awal
    documents.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));

    return { documents, incompleteDocuments };
  }

  /**
   * Unggah dokumen asli dan tulis metadata RDF ke Pod.
   * Jika options.documentId disediakan, ID tersebut dipakai ulang untuk retry
   * sehingga tidak membuat duplikat di Pod.
   */
  async uploadDocument(
    file: { name: string; size: number; type?: string; arrayBuffer: () => Promise<ArrayBuffer> },
    options?: { documentId?: string }
  ): Promise<ProjectDocument> {
    // 1. Verifikasi hak Owner
    if (this.webId !== this.ownerWebId) {
      throw new SolidDocumentAccessDeniedError(this.workspaceUrl, 403);
    }

    // 2. Validasi berkas
    const mimeType = detectDocumentMimeType(file.name, file.type);
    if (!mimeType) {
      throw new SolidDocumentError("validate-file", "Format berkas tidak didukung.");
    }

    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      throw new SolidDocumentError("validate-file", validation.error);
    }

    // Cek batas dokumen proyek
    const currentList = await this.listDocuments();
    if (
      !options?.documentId &&
      currentList.documents.length >= MAX_DOCUMENTS_PER_PROJECT
    ) {
      throw new SolidDocumentError(
        "validate-file",
        `Batas maksimal ${MAX_DOCUMENTS_PER_PROJECT} dokumen per proyek telah tercapai.`
      );
    }

    const documentId = options?.documentId?.trim() || this.idFactory();
    const docContainerUrl = this.documentContainerUrlFor(documentId);
    const fileUrl = this.fileUrlFor(documentId, mimeType);
    const metadataUrl = this.metadataUrlFor(documentId);

    // 3. Baca konten dan hitung hash SHA-256
    const data = await file.arrayBuffer();
    const sha256 = await computeFileSha256(data);
    const uploadedAt = new Date().toISOString();

    // 4. Siapkan hierarki kontainer
    await this.runStep("prepare-container", async () => {
      await this.ensureContainer(`${this.workspaceUrl}data/`);
      await this.ensureContainer(this.documentsContainerUrl);
      await this.ensureContainer(docContainerUrl);
    });

    // 5. Unggah berkas biner dengan PUT langsung
    await this.runStep("upload-binary", async () => {
      const response = await this.fetchImpl(fileUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mimeType,
        },
        body: data,
      });

      if (!response.ok) {
        throw new Error(
          `Server Pod mengembalikan HTTP ${response.status} saat menyimpan berkas.`
        );
      }
    });

    // 6. Tulis metadata RDF (metadata.ttl)
    await this.runStep("write-metadata", async () => {
      const {
        createSolidDataset,
        createThing,
        setThing,
        setUrl,
        setStringNoLocale,
        setDatetime,
        saveSolidDatasetAt,
      } = await this.solid();

      let thing = createThing({ name: "document" });
      thing = setUrl(thing, RDF_TYPE, `${CPD}Document`);
      thing = setStringNoLocale(thing, `${CPD}id`, documentId);
      thing = setStringNoLocale(thing, `${CPD}name`, file.name);
      thing = setUrl(thing, `${CPD}fileUrl`, fileUrl);
      thing = setStringNoLocale(thing, `${CPD}mimeType`, mimeType);
      thing = setStringNoLocale(thing, `${CPD}sizeBytes`, String(file.size));
      thing = setDatetime(thing, `${CPD}uploadedAt`, new Date(uploadedAt));
      thing = setUrl(thing, `${CPD}uploader`, this.webId);
      thing = setStringNoLocale(thing, `${CPD}sha256`, sha256);

      let dataset = createSolidDataset();
      dataset = setThing(dataset, thing);

      await saveSolidDatasetAt(metadataUrl, dataset, {
        fetch: this.fetchImpl,
      });
    });

    // 7. Verifikasi pembacaan ulang (read-back)
    await this.runStep("verify-readback", async () => {
      const { getSolidDataset, getThing, getStringNoLocale } = await this.solid();

      const dataset = await getSolidDataset(metadataUrl, {
        fetch: this.fetchImpl,
      });
      const thing = getThing(dataset, `${metadataUrl}#document`);
      if (!thing) {
        throw new Error("Metadata dokumen tidak dapat diverifikasi.");
      }

      const readName = getStringNoLocale(thing, `${CPD}name`);
      if (!readName || readName !== file.name) {
        throw new Error("Verifikasi nama berkas pada metadata tidak cocok.");
      }

      const fileExists = await this.verifyFileExists(fileUrl);
      if (!fileExists) {
        throw new Error("Berkas biner tidak dapat dibaca kembali dari Pod.");
      }
    });

    return {
      id: documentId,
      name: file.name,
      fileUrl,
      metadataUrl,
      mimeType,
      sizeBytes: file.size,
      uploadedAt,
      uploaderWebId: this.webId,
      sha256,
      isComplete: true,
    };
  }

  /**
   * Unduh berkas dokumen dari Pod menggunakan `session.fetch` aktif.
   */
  async downloadDocument(
    document: ProjectDocument
  ): Promise<{ blob: Blob; filename: string; mimeType: string }> {
    let response: Response;
    try {
      response = await this.fetchImpl(document.fileUrl);
    } catch (error) {
      throw new SolidDocumentError("download-binary", error);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new SolidDocumentAccessDeniedError(
          document.fileUrl,
          response.status
        );
      }
      throw new SolidDocumentError(
        "download-binary",
        `Gagal mengunduh berkas (HTTP ${response.status}).`
      );
    }

    const blob = await response.blob();
    return {
      blob,
      filename: document.name,
      mimeType: document.mimeType,
    };
  }

  private async verifyFileExists(fileUrl: string): Promise<boolean> {
    try {
      const response = await this.fetchImpl(fileUrl, { method: "HEAD" });
      if (response.ok) return true;
      if (response.status === 405) {
        // Jika HEAD tidak didukung oleh server tertentu, coba GET dengan range 0-0
        const getResp = await this.fetchImpl(fileUrl, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
        });
        return getResp.ok;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async ensureContainer(url: string): Promise<void> {
    const { createContainerAt } = await this.solid();
    const containerUrl = normalizeContainerUrl(url);
    if (await this.resourceExists(containerUrl)) {
      return;
    }
    await createContainerAt(containerUrl, { fetch: this.fetchImpl });
  }

  private async resourceExists(url: string): Promise<boolean> {
    const { getResourceInfo } = await this.solid();
    try {
      await getResourceInfo(url, { fetch: this.fetchImpl });
      return true;
    } catch (error) {
      const status = httpStatusOf(error);
      if (status === 404 || status === 410) {
        return false;
      }
      throw error;
    }
  }

  private async runStep<T>(
    step: SolidDocumentStep,
    action: () => Promise<T>
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof SolidDocumentAccessDeniedError) {
        throw error;
      }
      const status = httpStatusOf(error);
      if (status === 401 || status === 403) {
        throw new SolidDocumentAccessDeniedError(this.workspaceUrl, status);
      }
      throw new SolidDocumentError(step, error);
    }
  }
}

/** Picu unduhan peramban menggunakan Blob URL dan bersihkan setelahnya. */
export function triggerFileDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = window.URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  // Bersihkan Blob URL setelah digunakan agar tidak terjadi memory leak
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
}

function httpStatusOf(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }
  return null;
}
