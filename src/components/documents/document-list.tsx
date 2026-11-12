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
  ShieldCheck,
  Search,
  X,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectDocument, IncompleteProjectDocument } from "@/types/document";
import {
  SolidDocumentRepository,
  formatBytes,
  formatUploadedAt,
  triggerFileDownload,
  describeSolidDocumentError,
  isSolidDocumentAccessDenied,
} from "@/lib/solid-document-repository";
import { DocumentPreviewDialog } from "@/components/documents/document-preview-dialog";
import type { ProjectMember } from "@/types/project";
import { cn } from "@/lib/utils";

interface DocumentListProps {
  repository: SolidDocumentRepository;
  demo?: boolean;
  members?: ProjectMember[];
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

type FilterTab = "all" | "approved" | "unapproved";

export function DocumentList({
  repository,
  demo = false,
  members = [],
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
  const uploaderLabel = (doc: ProjectDocument) =>
    members.find((member) => member.webId === doc.uploaderWebId)?.name ??
    doc.uploaderWebId.split("/")[2] ??
    "Anggota";
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [previewDocument, setPreviewDocument] =
    React.useState<ProjectDocument | null>(null);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Filter & Search local state
  const [filterTab, setFilterTab] = React.useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

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
    if (!canApprove) return;
    setApprovingId(doc.id);
    setActionError(null);

    try {
      await repository.setAiApproved(doc, !doc.aiApproved);
      onRefresh();
    } catch (err) {
      setActionError(
        describeActionError(
          err,
          `menyimpan persetujuan AI untuk "${doc.name}"`,
        ),
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

  // Filtered documents
  const filteredDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      if (filterTab === "approved" && !doc.aiApproved) return false;
      if (filterTab === "unapproved" && doc.aiApproved) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return doc.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [documents, filterTab, searchQuery]);

  // State: Loading
  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl border border-border bg-[#fffefa] text-sm text-muted-foreground"
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
        className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm"
        role="alert"
      >
        <div className="flex items-start gap-2.5">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">{desc.stepLabel}</p>
            <p className="text-xs text-rose-700 leading-relaxed">
              {desc.message}
            </p>
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
      <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-[#cad5ba] bg-[#f8faf4] text-center">
        <div className="h-10 w-10 rounded-full bg-[#eef3e6] text-[#53643e] flex items-center justify-center mb-3">
          <FileText className="h-5 w-5" />
        </div>
        <p className="font-medium text-foreground text-sm">
          Belum ada dokumen di proyek ini
        </p>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Berkas disimpan langsung di Pod Solid pemilik workspace. Format yang
          didukung adalah PDF dan TXT (maks. 5 MB per berkas, maks. 10 dokumen
          per proyek).
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
    <div className="space-y-5">
      {/* Banner Info Sumber seperti referensi */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-[#edf2e4] border border-[#dce6ce] text-[#53643e]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-6 h-6 rounded-md bg-[#e3ecda] flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-[#53643e]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#374426]">
              Satu sumber, untuk seluruh tim.
            </p>
            <p className="text-[11px] text-[#5d6f46] mt-0.5 leading-relaxed">
              {demo
                ? "Dokumen demo tersimpan di browser ini."
                : "Dokumen proyek berada di Pod pemilik."}{" "}
              Persetujuan AI berlaku untuk versi dokumen yang dipilih.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Row: Segmented Buttons + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Segmented */}
        <div className="inline-flex items-center rounded-lg bg-card border border-border p-1 text-[13px] font-medium gap-0.5 select-none">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all text-xs",
              filterTab === "all"
                ? "bg-[#e3e8d8] text-[#4d6037] font-[550]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Semua ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("approved")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all text-xs",
              filterTab === "approved"
                ? "bg-[#e3e8d8] text-[#4d6037] font-[550]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Disetujui AI ({documents.filter((d) => d.aiApproved).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("unapproved")}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all text-xs",
              filterTab === "unapproved"
                ? "bg-[#e3e8d8] text-[#4d6037] font-[550]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Belum disetujui ({documents.filter((d) => !d.aiApproved).length})
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full sm:w-auto">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            aria-label="Cari dokumen"
            placeholder="Cari dokumen…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-border bg-card pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Hapus pencarian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Notifikasi error aksi dokumen */}
      {actionError && (
        <div
          className="flex items-center justify-between p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-900"
          role="alert"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="truncate">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-700 hover:text-rose-900 text-xs underline shrink-0 ml-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Table Dokumen */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        {/* Table Head */}
        <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_140px_140px_auto] items-center gap-4 px-4 py-3 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-[#faf9f4]">
          <span>Nama dokumen</span>
          <span className="hidden sm:block">Ditambahkan oleh</span>
          <span>Penggunaan AI</span>
          <span className="text-right">Aksi</span>
        </div>

        {/* Table Body */}
        {filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Tidak ada dokumen yang cocok dengan filter.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredDocuments.map((doc) => {
              const isPdf = doc.mimeType === "application/pdf";
              const isDownloading = downloadingId === doc.id;
              const isApproving = approvingId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_140px_140px_auto] items-center gap-4 px-4 py-3.5 hover:bg-[#fafbf7] transition-colors"
                >
                  {/* Kolom 1: Ikon + Nama + Metadata */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Ikon berkas dengan label PDF/TXT */}
                    <div className="flex flex-col items-center justify-center w-8 h-9 rounded-md border border-[#dce6ce] bg-[#f8faf4] shrink-0 text-[#53643e]">
                      {isPdf ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <FileCode className="w-4 h-4" />
                      )}
                      <span className="text-[7px] font-bold font-mono tracking-tighter uppercase mt-[-1px]">
                        {isPdf ? "PDF" : "TXT"}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setPreviewDocument(doc)}
                        className="font-medium text-[13px] text-foreground hover:text-[#53643e] truncate block text-left transition-colors max-w-[200px] sm:max-w-xs md:max-w-sm"
                        title={doc.name}
                      >
                        {doc.name}
                      </button>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {formatBytes(doc.sizeBytes)} · diunggah{" "}
                        {formatUploadedAt(doc.uploadedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Kolom 2: Ditambahkan oleh */}
                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                    <div className="w-5 h-5 rounded-full bg-[#e3ecda] text-[#53643e] font-semibold text-[9px] flex items-center justify-center shrink-0">
                      {uploaderLabel(doc).slice(0, 1).toUpperCase()}
                    </div>
                    <span
                      className="truncate text-[11px]"
                      title={doc.uploaderWebId}
                    >
                      {uploaderLabel(doc)}
                    </span>
                  </div>

                  {/* Kolom 3: Penggunaan AI Button / Pill */}
                  <div>
                    {canApprove ? (
                      <button
                        type="button"
                        disabled={isApproving}
                        onClick={() => handleToggleApproval(doc)}
                        title={
                          doc.aiApproved
                            ? "Dokumen disetujui untuk AI. Klik untuk batalkan."
                            : "Klik untuk menyetujui dokumen ini untuk AI."
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border select-none",
                          doc.aiApproved
                            ? "bg-[#edf4e6] text-[#4d6037] border-[#cadab7] hover:bg-[#e2edd7]"
                            : "bg-[#f5f6f1] text-[#7c8471] border-[#e3e6da] hover:bg-[#eaece4]",
                        )}
                      >
                        {isApproving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : doc.aiApproved ? (
                          <>
                            <ShieldCheck className="w-3 h-3 text-[#4d6037]" />
                            <span>Disetujui</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full border border-[#7c8471]" />
                            <span>Belum disetujui</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border select-none",
                          doc.aiApproved
                            ? "bg-[#edf4e6] text-[#4d6037] border-[#cadab7]"
                            : "bg-[#f5f6f1] text-[#7c8471] border-[#e3e6da]",
                        )}
                      >
                        {doc.aiApproved ? "✓ Disetujui" : "○ Belum disetujui"}
                      </span>
                    )}
                  </div>

                  {/* Kolom 4: Aksi */}
                  <div className="flex items-center justify-end gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewDocument(doc)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Pratinjau isi dokumen"
                      aria-label={`Pratinjau isi ${doc.name}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isDownloading}
                      onClick={() => handleDownload(doc)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Unduh berkas"
                      aria-label={`Unduh ${doc.name}`}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </Button>

                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDeleteTarget({ kind: "document", document: doc })
                        }
                        className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                        title="Hapus dokumen"
                        aria-label={`Hapus ${doc.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daftar Unggahan Belum Lengkap */}
      {incompleteDocuments.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              {incompleteDocuments.length} entri unggahan di Pod belum lengkap
            </span>
          </div>
          <p className="text-amber-800 leading-relaxed">
            Entri berikut terdeteksi di direktori dokumen Pod namun berkas biner
            atau metadatanya belum selesai tersimpan.
          </p>
          <div className="space-y-1 pt-1">
            {incompleteDocuments.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center justify-between gap-3 text-muted-foreground font-mono text-[11px] bg-white px-2.5 py-1.5 rounded border border-amber-200"
              >
                <span className="truncate max-w-[200px]">{inc.id}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-amber-700">{inc.reason}</span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ kind: "incomplete", entry: inc })
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-sans text-rose-600 hover:bg-rose-100"
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
        <DialogContent className="max-w-md bg-[#fffefa] border border-[#dce6ce] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Hapus dokumen?</DialogTitle>
            <DialogDescription>
              Berkas{" "}
              <span className="font-semibold text-foreground">
                {deleteName}
              </span>{" "}
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
