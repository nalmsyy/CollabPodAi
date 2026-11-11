"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  UploadCloud,
  FileText,
  FileCode,
  Files,
  Loader2,
  CheckCircle2,
  TriangleAlert,
  X,
  Lock,
} from "lucide-react";
import {
  SolidDocumentRepository,
  createDocumentId,
  detectDocumentMimeType,
  formatBytes,
  validateDocumentFile,
  describeSolidDocumentError,
  isSolidDocumentAccessDenied,
} from "@/lib/solid-document-repository";
import { ProjectDocument } from "@/types/document";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repository: SolidDocumentRepository;
  currentDocumentCount: number;
  onSuccess: (document: ProjectDocument) => void;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  repository,
  currentDocumentCount,
  onSuccess,
}: UploadDocumentDialogProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState<ProjectDocument | null>(
    null
  );
  const [isDragging, setIsDragging] = React.useState(false);

  // ID stabil untuk percobaan ulang (retry) agar tidak membuat duplikat di Pod
  const [stableDocId, setStableDocId] = React.useState<string>(() =>
    createDocumentId()
  );

  const resetState = React.useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    setIsUploading(false);
    setUploadError(null);
    setUploadSuccess(null);
    setStableDocId(createDocumentId());
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isUploading) {
      resetState();
    }
    if (!isUploading) {
      onOpenChange(nextOpen);
    }
  };

  const handleFile = (file: File | null) => {
    setUploadError(null);
    setUploadSuccess(null);

    if (!file) {
      setSelectedFile(null);
      setValidationError(null);
      return;
    }

    const validation = validateDocumentFile(file, currentDocumentCount);
    if (!validation.valid) {
      setSelectedFile(null);
      setValidationError(validation.error ?? "Berkas tidak valid.");
      return;
    }

    setSelectedFile(file);
    setValidationError(null);
    setStableDocId(createDocumentId());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const doc = await repository.uploadDocument(selectedFile, {
        documentId: stableDocId,
      });

      setUploadSuccess(doc);
      onSuccess(doc);

      setTimeout(() => {
        handleOpenChange(false);
      }, 1500);
    } catch (err) {
      if (isSolidDocumentAccessDenied(err)) {
        setUploadError(
          "Akses Ditolak: Anda tidak memiliki izin untuk mengunggah dokumen ke proyek ini."
        );
      } else {
        const desc = describeSolidDocumentError(err);
        setUploadError(`${desc.stepLabel} ${desc.message}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const mimeType = selectedFile
    ? detectDocumentMimeType(selectedFile.name, selectedFile.type)
    : null;
  const isPdf = mimeType === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[490px] p-7 bg-[#fffefa] border border-[#dce6ce] rounded-2xl shadow-xl">
        {/* Header Icon */}
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-[#eef3e6] border border-[#dce6ce] flex items-center justify-center text-[#53643e]">
            <Files className="w-5 h-5" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1">
          <DialogTitle className="text-[28px] font-serif font-normal text-foreground leading-snug">
            Tambahkan sumber pengetahuan.
          </DialogTitle>
          <p className="text-[13px] text-muted-foreground">
            Dokumen yang sama dapat mendukung semua pertanyaan AI dalam proyek.
          </p>
        </div>

        <div className="space-y-4 pt-1">
          {/* Status Sukses */}
          {uploadSuccess ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-emerald-300 bg-emerald-50 text-center animate-in fade-in duration-200">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <p className="font-semibold text-emerald-900 text-sm">
                Dokumen Berhasil Disimpan
              </p>
              <p className="text-xs text-emerald-700">
                Berkas asli dan metadata RDF telah tersimpan pada Solid Pod Anda.
              </p>
            </div>
          ) : (
            <>
              {/* Dropzone Area */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center py-9 px-6 rounded-xl border border-dashed transition-all cursor-pointer text-center select-none ${
                  isDragging
                    ? "border-[#53643e] bg-[#eef3e6]"
                    : "border-[#cad5ba] bg-[#f8faf4] hover:bg-[#f1f6eb]"
                }`}
              >
                <input
                  id="document-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  disabled={isUploading}
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#53643e] mb-2">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <p className="text-[13px] font-medium text-foreground">
                  Pilih atau letakkan dokumen di sini
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  PDF atau TXT · Maksimal 5 MB per berkas ({currentDocumentCount}/10 digunakan)
                </p>
              </div>

              {/* Error Validasi */}
              {validationError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-1.5 font-medium">
                  <TriangleAlert className="h-4 w-4 shrink-0 text-rose-600" />
                  {validationError}
                </p>
              )}

              {/* Berkas Terpilih */}
              {selectedFile && !validationError && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-[#dce6ce] bg-white text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isPdf
                          ? "bg-rose-100 text-rose-700"
                          : "bg-[#eef3e6] text-[#53643e]"
                      }`}
                    >
                      {isPdf ? (
                        <FileText className="h-4 w-4" />
                      ) : (
                        <FileCode className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[240px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatBytes(selectedFile.size)} • {isPdf ? "PDF" : "Plain Text"}
                      </p>
                    </div>
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-muted-foreground hover:text-foreground p-1 rounded"
                      aria-label="Batalkan pilihan berkas"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Notifikasi Kegagalan Unggah */}
              {uploadError && (
                <div
                  className="space-y-1.5 p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-900"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-rose-800">
                        Unggah Dokumen Gagal
                      </p>
                      <p className="text-rose-700 leading-relaxed break-words">
                        {uploadError}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Note callout bawah seperti referensi */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#edf2e4] text-[11px] text-[#53643e] leading-relaxed">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Dokumen baru belum disetujui untuk AI secara default. Berkas tersimpan langsung di Pod privat Anda dan persetujuan AI diatur oleh Owner.
                </p>
              </div>

              {/* Tombol Simpan */}
              {selectedFile && !validationError && (
                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => handleOpenChange(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isUploading}
                    onClick={handleUpload}
                    className="min-w-[120px]"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan…</span>
                      </>
                    ) : (
                      <span>Simpan ke Pod</span>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
