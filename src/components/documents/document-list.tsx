"use client";

import * as React from "react";
import {
  Download,
  FileText,
  FileCode,
  Loader2,
  TriangleAlert,
  RefreshCw,
  AlertCircle,
  Eye,
  Trash2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ProjectDocument,
  IncompleteProjectDocument,
} from "@/types/document";
import {
  SolidDocumentRepository,
  formatBytes,
  formatUploadedAt,
  triggerFileDownload,
  describeSolidDocumentError,
  isSolidDocumentAccessDenied,
} from "@/lib/solid-document-repository";
import { DocumentPreviewDialog } from "@/components/documents/document-preview-dialog";
import { cn } from "@/lib/utils";

interface DocumentListProps {
  repository: SolidDocumentRepository;
  documents: ProjectDocument[];
  incompleteDocuments: IncompleteProjectDocument[];
  isLoading: boolean;
  error: unknown | null;
  onRefresh: () => void;
  /** Owner/Editor boleh mengunggah dokumen. */
  canUpload: boolean;
  /** Owner/Editor boleh menghapus dokumen; Viewer tidak. */
  canDelete: boolean;
  /** Hanya Owner yang boleh mengubah kebijakan persetujuan AI. */
  canApprove: boolean;
  onOpenUpload: () => void;
}

const ACCESS_DENIED_PREFIX = "Akses Ditolak: Anda tidak memiliki izin";

/** Pesan aksi dokumen; penolakan WAC (401/403) diberi pesan khusus. */
function describeActionError(error: unknown, action: string): string {
  if (isSolidDocumentAccessDenied(error)) {
    return `${ACCESS_DENIED_PREFIX} untuk ${action}.`;
  }
  const desc = describeSolidDocumentError(error);
  return `${action}: ${desc.message}`;
}

type DeleteTarget =
  | { kind: "document"; document: ProjectDocument }
  | { kind: "incomplete"; entry: IncompleteProjectDocument };

export function DocumentList({
  repository,
  documents,
  incompleteDocuments,
  isLoading,
  error,
  onRefresh,
  canUpload,
  canDelete,
  canApprove,
  onOpenUpload,
}: DocumentListProps) {
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [previewDocument, setPreviewDocument] =
    React.useState<ProjectDocument | null>(null);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(
    null
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDownload = async (doc: ProjectDocument) => {
    setDownloadingId(doc.id);
    setActionError(null);

    try {
      const { blob, filename } = await repository.downloadDocument(doc);
      triggerFileDownload(blob, filename);
    } catch (err) {
      setActionError(describeActionError(err, `mengunduh "${doc.name}"`));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggleApproval = async (doc: ProjectDocument) => {
    setApprovingId(doc.id);
    setActionError(null);

    try {
      await repository.setAiApproved(doc, !doc.aiApproved);
      onRefresh();
    } catch (err) {
      setActionError(
        describeActionError(
          err,
          `menyimpan persetujuan AI untuk "${doc.name}"`
        )
      );
    } finally {
      setApprovingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setActionError(null);

    try {
      if (deleteTarget.kind === "document") {
        await repository.deleteDocument(deleteTarget.document);
      } else {
        await repository.deleteDocumentEntry({
          id: deleteTarget.entry.id,
          fileUrl: deleteTarget.entry.fileUrl,
          metadataUrl: deleteTarget.entry.metadataUrl,
        });
      }
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      setActionError(describeActionError(err, "menghapus dokumen"));
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // State: Loading
  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl border border-border bg-card/40 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>Memuat daftar dokumen dari Pod…</span>
      </div>
    );
  }

  // State: Error
  if (error) {
    const desc = describeSolidDocumentError(error);
    return (
      <div
        className="space-y-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-5 text-sm"
        role="alert"
      >
        <div className="flex items-start gap-2.5">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-100">{desc.stepLabel}</p>
            <p className="text-xs text-rose-200/80 leading-relaxed">{desc.message}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Coba Muat Ulang
        </Button>
      </div>
    );
  }

  // State: Empty
  if (documents.length === 0 && incompleteDocuments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-border bg-card/20 text-center">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
          <FileText className="h-5 w-5" />
        </div>
        <p className="font-medium text-foreground text-sm">
          Belum ada dokumen di proyek ini
        </p>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Berkas disimpan langsung di Pod Solid pemilik workspace. Format yang
          didukung adalah PDF dan TXT (maks. 5 MB per berkas, maks. 10 dokumen per proyek).
        </p>
        {canUpload && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onOpenUpload}
            className="mt-4"
          >
            Unggah Dokumen Pertama
          </Button>
        )}
      </div>
    );
  }

  const deleteName =
    deleteTarget?.kind === "document"
      ? deleteTarget.document.name
      : deleteTarget?.entry.id;

  return (
    <div className="space-y-4">
      {/* Notifikasi error aksi dokumen */}
      {actionError && (
        <div
          className="flex items-center justify-between p-3 rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs text-rose-100"
          role="alert"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-rose-300 shrink-0" />
            <span className="truncate">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-300 hover:text-rose-100 text-xs underline shrink-0 ml-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Daftar Dokumen Lengkap */}
      {documents.length > 0 && (
        <div className="divide-y divide-border rounded-xl border border-border bg-card/50 overflow-hidden">
          {documents.map((doc) => {
            const isPdf = doc.mimeType === "application/pdf";
            const isDownloading = downloadingId === doc.id;
            const isApproving = approvingId === doc.id;

            return (
              <div
                key={doc.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-card/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  onClick={() => setPreviewDocument(doc)}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  aria-label={`Pratinjau teks dokumen ${doc.name}`}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      isPdf
                        ? "bg-rose-500/15 text-rose-300"
                        : "bg-indigo-500/15 text-indigo-300"
                    )}
                  >
                    {isPdf ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <FileCode className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate max-w-[280px] sm:max-w-md">
                        {doc.name}
                      </span>
                      <Badge
                        variant={isPdf ? "default" : "indigo"}
                        className="text-[10px] py-0 px-1.5 uppercase font-mono"
                      >
                        {isPdf ? "PDF" : "TXT"}
                      </Badge>
                      {doc.aiApproved && (
                        <Badge
                          variant="teal"
                          className="text-[10px] py-0 px-1.5 gap-1"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          AI
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatBytes(doc.sizeBytes)}</span>
                      <span>•</span>
                      <span>Diunggah {formatUploadedAt(doc.uploadedAt)}</span>
                      {doc.sha256 && (
                        <>
                          <span>•</span>
                          <span
                            className="font-mono text-[10px] text-muted-foreground/80 truncate max-w-[120px]"
                            title={`SHA-256: ${doc.sha256}`}
                          >
                            SHA: {doc.sha256.slice(0, 8)}…
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-primary/90">
                        <Eye className="h-3 w-3" />
                        Lihat teks
                      </span>
                    </div>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-center sm:justify-end shrink-0">
                  {canApprove && (
                    <button
                      type="button"
                      aria-pressed={doc.aiApproved}
                      disabled={isApproving}
                      onClick={() => handleToggleApproval(doc)}
                      title={
                        doc.aiApproved
                          ? "Dokumen disetujui sebagai konteks AI. Klik untuk membatalkan."
                          : "Setujui dokumen ini sebagai konteks AI."
                      }
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-60",
                        doc.aiApproved
                          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                          : "border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      {isApproving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : doc.aiApproved ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {doc.aiApproved ? "Disetujui untuk AI" : "Setujui untuk AI"}
                      </span>
                    </button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewDocument(doc)}
                    className="inline-flex items-center gap-1.5 h-8 text-xs font-medium"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Pratinjau</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isDownloading}
                    onClick={() => handleDownload(doc)}
                    className="inline-flex items-center gap-1.5 h-8 text-xs font-medium"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Mengunduh…</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        <span>Unduh</span>
                      </>
                    )}
                  </Button>

                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDeleteTarget({ kind: "document", document: doc })
                      }
                      className="inline-flex items-center gap-1.5 h-8 text-xs font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                      aria-label={`Hapus dokumen ${doc.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Daftar Unggahan Belum Lengkap (jika ada kegagalan sebagian sebelumnya) */}
      {incompleteDocuments.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs">
          <div className="flex items-center gap-2 text-amber-200 font-semibold">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-300" />
            <span>
              {incompleteDocuments.length} entri unggahan di Pod belum lengkap
            </span>
          </div>
          <p className="text-amber-200/80 leading-relaxed">
            Entri berikut terdeteksi di direktori dokumen Pod namun berkas biner
            atau metadatanya belum selesai tersimpan. Entri ini dipisahkan dan
            tidak ditampilkan sebagai dokumen valid.
          </p>
          <div className="space-y-1 pt-1">
            {incompleteDocuments.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center justify-between gap-3 text-muted-foreground font-mono text-[11px] bg-background/50 px-2.5 py-1.5 rounded"
              >
                <span className="truncate max-w-[200px]">{inc.id}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-amber-300/80">{inc.reason}</span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ kind: "incomplete", entry: inc })
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-sans text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      <Trash2 className="h-3 w-3" />
                      Hapus
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog Pratinjau Teks Dokumen */}
      <DocumentPreviewDialog
        document={previewDocument}
        repository={repository}
        onOpenChange={(open) => {
          if (!open) setPreviewDocument(null);
        }}
      />

      {/* Dialog Konfirmasi Hapus */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus dokumen?</DialogTitle>
            <DialogDescription>
              Berkas <span className="font-semibold text-foreground">{deleteName}</span>{" "}
              beserta metadatanya akan dihapus permanen dari Pod. Tindakan ini
              tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menghapus…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus permanen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
