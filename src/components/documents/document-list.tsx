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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/lib/solid-document-repository";

interface DocumentListProps {
  repository: SolidDocumentRepository;
  documents: ProjectDocument[];
  incompleteDocuments: IncompleteProjectDocument[];
  isLoading: boolean;
  error: unknown | null;
  onRefresh: () => void;
  isOwner: boolean;
  onOpenUpload: () => void;
}

export function DocumentList({
  repository,
  documents,
  incompleteDocuments,
  isLoading,
  error,
  onRefresh,
  isOwner,
  onOpenUpload,
}: DocumentListProps) {
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const handleDownload = async (doc: ProjectDocument) => {
    setDownloadingId(doc.id);
    setDownloadError(null);

    try {
      const { blob, filename } = await repository.downloadDocument(doc);
      triggerFileDownload(blob, filename);
    } catch (err) {
      const desc = describeSolidDocumentError(err);
      setDownloadError(`Gagal mengunduh "${doc.name}": ${desc.message}`);
    } finally {
      setDownloadingId(null);
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
        {isOwner && (
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

  return (
    <div className="space-y-4">
      {/* Notifikasi error unduh jika terjadi */}
      {downloadError && (
        <div
          className="flex items-center justify-between p-3 rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs text-rose-100"
          role="alert"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-rose-300 shrink-0" />
            <span className="truncate">{downloadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDownloadError(null)}
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

            return (
              <div
                key={doc.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors hover:bg-card/80"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isPdf
                        ? "bg-rose-500/15 text-rose-300"
                        : "bg-indigo-500/15 text-indigo-300"
                    }`}
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
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
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
                className="flex items-center justify-between text-muted-foreground font-mono text-[11px] bg-background/50 px-2.5 py-1.5 rounded"
              >
                <span className="truncate max-w-[200px]">{inc.id}</span>
                <span className="text-amber-300/80">{inc.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

