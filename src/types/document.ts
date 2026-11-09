export type DocumentMimeType = "application/pdf" | "text/plain";

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_DOCUMENTS_PER_PROJECT = 10;
export const SUPPORTED_MIME_TYPES: readonly DocumentMimeType[] = [
  "application/pdf",
  "text/plain",
] as const;

export interface ProjectDocument {
  /** ID dokumen stabil (bukan nama berkas mentah). */
  id: string;
  /** Nama berkas asli pengguna, mis. "Laporan-Air.pdf". */
  name: string;
  /** URL berkas di Pod: {workspace}data/documents/{id}/file.pdf */
  fileUrl: string;
  /** URL metadata RDF di Pod: {workspace}data/documents/{id}/metadata.ttl */
  metadataUrl: string;
  /** MIME type berkas ("application/pdf" | "text/plain"). */
  mimeType: DocumentMimeType;
  /** Ukuran berkas dalam byte. */
  sizeBytes: number;
  /** Waktu unggah dalam format ISO 8601. */
  uploadedAt: string;
  /** WebID pengguna yang mengunggah berkas. */
  uploaderWebId: string;
  /** Hash SHA-256 dari konten berkas. */
  sha256: string;
  /** Pemilik sudah menyetujui dokumen ini dipakai sebagai konteks AI. */
  aiApproved: boolean;
  /** Status kelengkapan berkas dan metadata. */
  isComplete: true;
}

export interface IncompleteProjectDocument {
  id: string;
  documentContainerUrl: string;
  reason: string;
  fileUrl?: string;
  metadataUrl?: string;
}

export interface DocumentListResult {
  documents: ProjectDocument[];
  incompleteDocuments: IncompleteProjectDocument[];
}

export interface DocumentValidationResult {
  valid: boolean;
  error?: string;
}

