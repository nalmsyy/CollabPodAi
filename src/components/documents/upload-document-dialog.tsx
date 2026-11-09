"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  FileCode,
  Loader2,
  CheckCircle2,
  TriangleAlert,
  X,
  RefreshCw,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
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
    // Reset document ID for a newly selected file
    setStableDocId(createDocumentId());
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

      // Otomatis tutup dialog setelah feedback singkat
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
      // stableDocId TIDAK diubah, sehingga jika pengguna menekan Coba Lagi,
      // upload akan menggunakan ID yang sama dan menimpa/memperbaiki entri tanpa membuat duplikat.
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Unggah Dokumen ke Solid Pod</DialogTitle>
          <DialogDescription>
            Simpan berkas PDF atau TXT langsung ke kontainer privat workspace
            proyek di Solid Pod Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Sukses */}
          {uploadSuccess ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-center animate-in fade-in duration-200">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="font-semibold text-emerald-100 text-sm">
                Dokumen Berhasil Disimpan
              </p>
              <p className="text-xs text-emerald-200/80">
                Berkas asli dan metadata RDF telah tersimpan dan diverifikasi pada Pod Anda.
              </p>
            </div>
          ) : (
            <>
              {/* Batasan Dokumen */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground p-3 rounded-lg border border-border bg-card/40">
                <span className="font-medium text-foreground">Batas Tahap 3A:</span>
                <span>PDF dan TXT</span>
                <span>•</span>
                <span>Maks. 5 MB/berkas</span>
                <span>•</span>
                <span>
                  {currentDocumentCount} dari 10 dokumen digunakan
                </span>
              </div>

              {/* Area Pilih Berkas */}
              <div className="space-y-1.5">
                <label
                  htmlFor="document-file-input"
                  className="text-xs font-semibold text-foreground block"
                >
                  Pilih Berkas (.pdf atau .txt)
                </label>
                <input
                  id="document-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  disabled={isUploading}
                  onChange={handleFileChange}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/15 file:text-primary hover:file:bg-primary/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {validationError && (
                  <p
                    id="file-validation-error"
                    className="text-xs text-rose-300 flex items-center gap-1.5 mt-1 font-medium"
                  >
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                    {validationError}
                  </p>
                )}
              </div>

              {/* Pratinjau Berkas Terpilih */}
              {selectedFile && !validationError && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/40 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
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
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-muted-foreground hover:text-foreground p-1"
                      aria-label="Batalkan pilihan berkas"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Notifikasi Kegagalan Unggah & Retry */}
              {uploadError && (
                <div
                  className="space-y-2 p-3.5 rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs text-rose-100"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="h-4 w-4 text-rose-300 shrink-0 mt-0.5" />
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-rose-200">
                        Unggah Dokumen Gagal
                      </p>
                      <p className="text-rose-200/80 leading-relaxed break-words">
                        {uploadError}
                      </p>
                      <p className="text-[11px] text-rose-300/80">
                        ID dokumen dipertahankan ({stableDocId}). Anda dapat mencoba
                        kembali tanpa membuat duplikat.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Catatan: Berkas yang diunggah mewarisi izin privat workspace
                dan belum mendapat persetujuan pemrosesan AI.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={() => handleOpenChange(false)}
          >
            {uploadSuccess ? "Tutup" : "Batal"}
          </Button>

          {!uploadSuccess && (
            <Button
              type="button"
              variant="primary"
              disabled={!selectedFile || !!validationError || isUploading}
              onClick={handleUpload}
              className="inline-flex items-center gap-1.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mengunggah ke Pod…</span>
                </>
              ) : uploadError ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Coba Lagi Unggah</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Unggah ke Pod</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

