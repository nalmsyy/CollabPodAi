"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileCode,
  FileText,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectDocument } from "@/types/document";
import type { SolidDocumentRepository } from "@/lib/solid-document-repository";
import {
  DocumentExtractionError,
  extractDocumentText,
  type ExtractedDocumentText,
} from "@/lib/pdf-extractor";

interface DocumentPreviewDialogProps {
  /** Dokumen yang sedang dipratinjau; `null` berarti dialog tertutup. */
  document: ProjectDocument | null;
  repository: SolidDocumentRepository;
  onOpenChange: (open: boolean) => void;
}

export function DocumentPreviewDialog({
  document,
  repository,
  onOpenChange,
}: DocumentPreviewDialogProps) {
  const isPdf = document?.mimeType === "application/pdf";

  return (
    <Dialog open={document !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle className="break-words text-base leading-snug">
              {document?.name}
            </DialogTitle>
            <Badge
              variant={isPdf ? "default" : "indigo"}
              className="text-[10px] py-0 px-1.5 uppercase font-mono"
            >
              {isPdf ? "PDF" : "TXT"}
            </Badge>
          </div>
          <DialogDescription>
            Teks diekstrak di peramban Anda menggunakan pdf.js. Isi dokumen tidak
            dikirim ke server mana pun selain Pod Anda.
          </DialogDescription>
        </DialogHeader>

        {document && (
          <PreviewContent
            key={`${document.id}:${document.mimeType}`}
            document={document}
            repository={repository}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type PreviewState =
  | { kind: "loading" }
  | { kind: "ready"; result: ExtractedDocumentText }
  | { kind: "error"; message: string };

function PreviewContent({
  document,
  repository,
}: {
  document: ProjectDocument;
  repository: SolidDocumentRepository;
}) {
  const [state, setState] = React.useState<PreviewState>({ kind: "loading" });
  const [pageIndex, setPageIndex] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await extractDocumentText(document, () =>
          repository.fetchDocumentBytes(document)
        );
        if (!cancelled) setState({ kind: "ready", result });
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof DocumentExtractionError
            ? error.message
            : "Teks dokumen tidak dapat diekstrak.";
        setState({ kind: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document, repository]);

  if (state.kind === "loading") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/40 py-16 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>Mengekstrak teks dokumen di peramban…</span>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        className="flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm"
        role="alert"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
        <div className="space-y-1">
          <p className="font-semibold text-rose-100">Ekstraksi teks gagal</p>
          <p className="text-xs leading-relaxed text-rose-200/80">
            {state.message}
          </p>
        </div>
      </div>
    );
  }

  const { result } = state;
  const pages = result.pages;
  const activePage = pages[pageIndex];
  const isPdf = document.mimeType === "application/pdf";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary" className="text-[10px] font-mono">
          {result.pageCount} hal · {result.characterCount} karakter
        </Badge>

        {pages.length > 1 && (
          <div className="flex items-center gap-1.5">
            {isPdf ? (
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              Halaman {pageIndex + 1} dari {pages.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="sr-only">Halaman sebelumnya</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={pageIndex >= pages.length - 1}
              onClick={() =>
                setPageIndex((index) => Math.min(pages.length - 1, index + 1))
              }
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="sr-only">Halaman berikutnya</span>
            </Button>
          </div>
        )}
      </div>

      {!result.hasText && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <p className="leading-relaxed">
            Tidak ada teks yang dapat diekstrak. Berkas kemungkinan merupakan PDF
            hasil pindaian (gambar) tanpa lapisan teks.
          </p>
        </div>
      )}

      <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border bg-background/60 p-4">
        {activePage && activePage.text ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-foreground/90">
            {activePage.text}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground">
            Halaman ini tidak memuat teks.
          </p>
        )}
      </div>
    </div>
  );
}
