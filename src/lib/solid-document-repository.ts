"use client";

import type {
  DocumentListResult,
  DocumentMimeType,
  DocumentValidationResult,
  IncompleteProjectDocument,
  ProjectDocument,
} from "@/types/document";
import type { ProjectRole } from "@/types/project";
import type { SolidDataset } from "@inrupt/solid-client";

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
  | "download-binary"
  | "update-approval"
  | "delete-document";

export const SOLID_DOCUMENT_STEP_LABEL: Record<SolidDocumentStep, string> = {
  "validate-file": "memvalidasi berkas dokumen",
  "prepare-container": "menyiapkan kontainer dokumen di Pod",
  "upload-binary": "mengunggah berkas biner ke Pod",
  "write-metadata": "menulis metadata dokumen ke Pod",
  "verify-readback": "memverifikasi pembacaan ulang dokumen",
  "list-documents": "membaca daftar dokumen dari Pod",
  "download-binary": "mengunduh berkas dari Pod",
  "update-approval": "menyimpan status persetujuan AI",
  "delete-document": "menghapus dokumen dari Pod",
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
      message: summarizeErrorDetail(detail) || error.message,
    };
  }

  return {
    stepLabel: "Operasi dokumen di Pod gagal.",
    message: summarizeErrorDetail(
      error instanceof Error ? error.message : null
    ) || "Terjadi kesalahan tak terduga.",
  };
}

/**
 * Pesan galat dari Solid client bisa memuat dump dataset yang sangat panjang.
 * Ambil paragraf pertama dan batasi panjangnya agar bisa dibaca di dialog.
 */
function summarizeErrorDetail(detail: string | null): string {
  if (!detail) return "";
  const firstBlock = detail.split(/\n\s*\n/)[0] ?? "";
  const singleLine = firstBlock.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 240) return singleLine;
  return `${singleLine.slice(0, 237)}...`;
}

interface DocumentMetadataFields {
  documentId: string;
  name: string;
  fileUrl: string;
  mimeType: DocumentMimeType;
  sizeBytes: number;
  uploadedAt: string;
  uploaderWebId: string;
  sha256: string;
  aiApproved: boolean;
}

export interface SolidDocumentContext {
  /** URL kontainer workspace proyek: {podUrl}/collabpod/projects/{projectId}/ */
  workspaceUrl: string;
  /** WebID pengguna aktif */
  webId: string;
  /** WebID pemilik proyek */
  ownerWebId: string;
  /**
   * Peran pengguna aktif pada proyek (dari members.ttl). Bila tidak diisi,
   * pemilik dianggap Owner dan pengguna lain Viewer — server Pod tetap
   * menjadi penentu akhir lewat WAC.
   */
  currentUserRole?: ProjectRole;
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
  private readonly currentUserRole: ProjectRole;
  private readonly fetchImpl: typeof fetch;
  private readonly idFactory: () => string;
  private readonly solidClient: SolidClient | null;

  constructor(context: SolidDocumentContext) {
    this.workspaceUrl = normalizeContainerUrl(context.workspaceUrl);
    this.webId = context.webId;
    this.ownerWebId = context.ownerWebId;
    this.currentUserRole =
      context.currentUserRole ??
      (context.webId === context.ownerWebId ? "Owner" : "Viewer");
    this.fetchImpl = context.fetch;
    this.idFactory = context.idFactory ?? createDocumentId;
    this.solidClient = context.client ?? null;
  }

  private solid(): SolidClient | Promise<SolidClient> {
    return this.solidClient ?? loadSolidClient();
  }

  /** Owner dan Editor boleh mengunggah/menghapus; Viewer hanya membaca. */
  private canWriteDocuments(): boolean {
    return this.currentUserRole !== "Viewer";
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

        const { getStringNoLocale, getUrl, getDatetime, getBoolean } =
          await this.solid();

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
        const aiApproved = getBoolean(docThing, `${CPD}aiApproved`) ?? false;

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
          aiApproved,
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
    // 1. Viewer tidak boleh menulis; Editor dan Owner boleh.
    if (!this.canWriteDocuments()) {
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
      const dataset = await this.buildMetadataDataset(metadataUrl, {
        documentId,
        name: file.name,
        fileUrl,
        mimeType,
        sizeBytes: file.size,
        uploadedAt,
        uploaderWebId: this.webId,
        sha256,
        aiApproved: false,
      });
      await this.writeDatasetAt(metadataUrl, dataset);
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

      // Verifikasi memakai GET (bukan HEAD) karena sebagian server Solid
      // membatasi HEAD, dan baca ulang sekaligus memastikan isi berkas utuh.
      const readback = await this.readBackBinary(fileUrl);
      if (!readback.ok) {
        throw new Error(
          `Berkas biner tidak dapat dibaca kembali dari Pod (HTTP ${readback.status}).`
        );
      }

      const readbackBytes = await readback.arrayBuffer();
      if (readbackBytes.byteLength !== file.size) {
        throw new Error(
          `Ukuran berkas hasil baca ulang (${formatBytes(
            readbackBytes.byteLength
          )}) berbeda dengan berkas asli (${formatBytes(file.size)}).`
        );
      }

      const readbackSha256 = await computeFileSha256(readbackBytes);
      if (readbackSha256 !== sha256) {
        throw new Error(
          "Isi berkas hasil baca ulang tidak cocok dengan berkas yang diunggah."
        );
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
      aiApproved: false,
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

  /** Baca isi biner dokumen dari Pod (dipakai ekstraksi teks). */
  async fetchDocumentBytes(document: ProjectDocument): Promise<ArrayBuffer> {
    const response = await this.readBackBinary(document.fileUrl);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new SolidDocumentAccessDeniedError(
          document.fileUrl,
          response.status
        );
      }
      throw new SolidDocumentError(
        "download-binary",
        `Gagal membaca berkas (HTTP ${response.status}).`
      );
    }
    return response.arrayBuffer();
  }

  /**
   * Tandai dokumen disetujui (atau tidak) untuk dipakai sebagai konteks AI.
   * Status disimpan di metadata.ttl dokumen sehingga ikut terbaca saat daftar
   * dokumen dimuat ulang dari Pod.
   */
  async setAiApproved(
    document: ProjectDocument,
    approved: boolean
  ): Promise<void> {
    // Kebijakan AI adalah hak Owner saja; Editor tidak boleh mengubahnya.
    if (this.currentUserRole !== "Owner") {
      throw new SolidDocumentAccessDeniedError(this.workspaceUrl, 403);
    }

    await this.runStep("update-approval", async () => {
      const dataset = await this.buildMetadataDataset(document.metadataUrl, {
        documentId: document.id,
        name: document.name,
        fileUrl: document.fileUrl,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        uploadedAt: document.uploadedAt,
        uploaderWebId: document.uploaderWebId,
        sha256: document.sha256,
        aiApproved: approved,
      });
      await this.writeDatasetAt(document.metadataUrl, dataset);
    });
  }

  /**
   * Hapus dokumen dari Pod: berkas biner, metadata, lalu kontainer kosongnya.
   * Resource yang sudah tidak ada (404/410) dianggap berhasil dihapus.
   */
  async deleteDocument(document: ProjectDocument): Promise<void> {
    await this.deleteDocumentEntry({
      id: document.id,
      fileUrl: document.fileUrl,
      metadataUrl: document.metadataUrl,
    });
  }

  /**
   * Hapus satu entri dokumen, termasuk entri yang belum lengkap (mis. sisa
   * percobaan unggah yang gagal) sehingga kontainernya bisa dibersihkan.
   */
  async deleteDocumentEntry(entry: {
    id: string;
    fileUrl?: string;
    metadataUrl?: string;
  }): Promise<void> {
    if (!this.canWriteDocuments()) {
      throw new SolidDocumentAccessDeniedError(this.workspaceUrl, 403);
    }

    await this.runStep("delete-document", async () => {
      const containerUrl = this.documentContainerUrlFor(entry.id);

      if (entry.fileUrl) {
        await this.deleteResourceIfExists(entry.fileUrl);
      }
      if (entry.metadataUrl) {
        await this.deleteResourceIfExists(entry.metadataUrl);
      }

      const response = await this.fetchImpl(containerUrl, { method: "DELETE" });
      if (!response.ok && ![404, 410].includes(response.status)) {
        throw new Error(
          `Server Pod menolak menghapus kontainer dokumen (HTTP ${response.status}).`
        );
      }
    });
  }

  /** Baca berkas untuk verifikasi. Satu kegagalan sesaat (jaringan, 5xx, atau
   * 404 yang belum terlihat) dicoba ulang sekali sebelum menyerah.
   */
  private async readBackBinary(fileUrl: string): Promise<Response> {
    let lastResponse: Response | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      try {
        const response = await this.fetchImpl(fileUrl, { cache: "no-store" });
        if (response.ok) return response;
        lastResponse = response;
        if (response.status === 401 || response.status === 403) {
          return response;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastResponse) return lastResponse;
    throw lastError instanceof Error
      ? lastError
      : new Error("Berkas biner tidak dapat dibaca kembali dari Pod.");
  }

  private async verifyFileExists(fileUrl: string): Promise<boolean> {
    // HEAD dipakai lebih dulu karena murah. Bila server menolaknya (405/501),
    // memblokirnya lewat CORS, atau membalas non-2xx, jatuh ke GET.
    const head = await this.safeRequest(fileUrl, { method: "HEAD" });
    if (head?.ok) return true;

    const get = await this.safeRequest(fileUrl, {
      method: "GET",
      cache: "no-store",
    });
    if (get?.ok) {
      try {
        await get.body?.cancel();
      } catch {
        // Abaikan kegagalan pembatalan body; berkas sudah terbukti ada.
      }
      return true;
    }

    return false;
  }

  private async safeRequest(
    url: string,
    init?: RequestInit
  ): Promise<Response | null> {
    try {
      return await this.fetchImpl(url, init);
    } catch {
      return null;
    }
  }

  /** Susun dataset RDF metadata dokumen (selalu dibuat dari nol). */
  private async buildMetadataDataset(
    metadataUrl: string,
    fields: DocumentMetadataFields
  ): Promise<SolidDataset> {
    const {
      createSolidDataset,
      createThing,
      setThing,
      setUrl,
      setStringNoLocale,
      setDatetime,
      setBoolean,
    } = await this.solid();

    let thing = createThing({ url: `${metadataUrl}#document` });
    thing = setUrl(thing, RDF_TYPE, `${CPD}Document`);
    thing = setStringNoLocale(thing, `${CPD}id`, fields.documentId);
    thing = setStringNoLocale(thing, `${CPD}name`, fields.name);
    thing = setUrl(thing, `${CPD}fileUrl`, fields.fileUrl);
    thing = setStringNoLocale(thing, `${CPD}mimeType`, fields.mimeType);
    thing = setStringNoLocale(thing, `${CPD}sizeBytes`, String(fields.sizeBytes));
    thing = setDatetime(thing, `${CPD}uploadedAt`, new Date(fields.uploadedAt));
    thing = setUrl(thing, `${CPD}uploader`, fields.uploaderWebId);
    thing = setStringNoLocale(thing, `${CPD}sha256`, fields.sha256);
    thing = setBoolean(thing, `${CPD}aiApproved`, fields.aiApproved);

    return setThing(createSolidDataset(), thing);
  }

  /**
   * Tulis metadata sebagai PUT idempoten. `saveSolidDatasetAt` mengirim
   * If-None-Match: * sehingga penulisan ulang ke URL yang sudah ada ditolak
   * dengan 412; dalam kasus itu metadata lama dihapus lalu ditulis ulang.
   */
  private async writeDatasetAt(
    metadataUrl: string,
    dataset: SolidDataset
  ): Promise<void> {
    const { saveSolidDatasetAt, deleteFile } = await this.solid();

    try {
      await saveSolidDatasetAt(metadataUrl, dataset, {
        fetch: this.fetchImpl,
      });
    } catch (error) {
      if (httpStatusOf(error) !== 412) {
        throw error;
      }
      await deleteFile(metadataUrl, { fetch: this.fetchImpl });
      await saveSolidDatasetAt(metadataUrl, dataset, {
        fetch: this.fetchImpl,
      });
    }
  }

  private async deleteResourceIfExists(url: string): Promise<void> {
    const response = await this.fetchImpl(url, { method: "DELETE" });
    if (response.ok || response.status === 404 || response.status === 410) {
      return;
    }
    throw new Error(
      `Server Pod menolak menghapus resource dokumen (HTTP ${response.status}).`
    );
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
