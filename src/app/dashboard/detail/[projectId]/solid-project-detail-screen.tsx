"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  HardDrive,
  Loader2,
  Lock,
  TriangleAlert,
  Upload,
} from "lucide-react";
import {
  SolidSessionProvider,
  useSolidSession,
} from "@/components/auth/solid-session-provider";
import { getSolidSessionAuth } from "@/lib/solid-session";
import { fetchPodUrls } from "@/lib/solid-pods";
import {
  SolidPodProjectRepository,
  SolidProjectAccessDeniedError,
  SolidProjectNotFoundError,
} from "@/lib/solid-project-repository";
import { Project } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SolidDocumentRepository } from "@/lib/solid-document-repository";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { IncompleteProjectDocument, ProjectDocument } from "@/types/document";

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; project: Project; fetchImpl: typeof fetch }
  | { kind: "not-found" }
  | { kind: "access-denied" }
  | { kind: "error"; message: string };

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition-colors"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Kembali ke proyek saya
    </Link>
  );
}

function LoadingState({ label }: { readonly label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  );
}

function FallbackState({
  message,
  hint,
}: {
  readonly message: string;
  readonly hint?: string;
}) {
  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm sm:p-8"
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
        <div>
          <p className="font-semibold text-rose-100">{message}</p>
          <p className="mt-1 text-rose-200/80">
            {hint ??
              "Kembali ke dashboard untuk melihat daftar proyek yang tersedia."}
          </p>
        </div>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-secondary sm:w-auto"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Kembali ke proyek saya
      </Link>
    </div>
  );
}

function ProjectDetail({
  project,
  webId,
  fetchImpl,
}: {
  readonly project: Project;
  readonly webId: string;
  readonly fetchImpl: typeof fetch;
}) {
  const isOwner = project.ownerWebId === webId;
  const workspaceUrl =
    project.workspaceUrl ??
    (project.podUrl ? `${project.podUrl}collabpod/projects/${project.id}/` : "");

  const repository = React.useMemo(() => {
    if (!workspaceUrl) return null;
    return new SolidDocumentRepository({
      workspaceUrl,
      webId,
      ownerWebId: project.ownerWebId,
      fetch: fetchImpl,
    });
  }, [workspaceUrl, webId, project.ownerWebId, fetchImpl]);

  const [documents, setDocuments] = React.useState<ProjectDocument[]>([]);
  const [incompleteDocuments, setIncompleteDocuments] = React.useState<
    IncompleteProjectDocument[]
  >([]);
  const [isLoadingDocs, setIsLoadingDocs] = React.useState(true);
  const [docsError, setDocsError] = React.useState<unknown | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);

  const refreshDocuments = React.useCallback(async () => {
    if (!repository) return;
    setIsLoadingDocs(true);
    setDocsError(null);
    try {
      const res = await repository.listDocuments();
      setDocuments(res.documents);
      setIncompleteDocuments(res.incompleteDocuments);
    } catch (err) {
      setDocsError(err);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [repository]);

  React.useEffect(() => {
    if (!repository) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await repository.listDocuments();
        if (cancelled) return;
        setDocuments(res.documents);
        setIncompleteDocuments(res.incompleteDocuments);
        setDocsError(null);
      } catch (err) {
        if (cancelled) return;
        setDocsError(err);
      } finally {
        if (!cancelled) {
          setIsLoadingDocs(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repository]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 rounded-2xl border border-border bg-card/60 p-5 sm:p-6">
      <BackLink />

      {/* Header Proyek */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Lock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal">Proyek Privat / Solid Pod</Badge>
            <Badge variant="outline" className="text-primary border-primary/30">
              Penyimpanan Dokumen Aktif
            </Badge>
          </div>
          <h1 className="mt-2 text-xl font-bold leading-tight break-words text-foreground">
            {project.name}
          </h1>
          {project.description &&
          project.description !== "Tidak ada deskripsi proyek." ? (
            <p className="mt-2 text-sm leading-relaxed break-words text-muted-foreground">
              {project.description}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Tidak ada deskripsi proyek.
            </p>
          )}
        </div>
      </div>

      {/* Metadata Proyek */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm p-4 rounded-xl border border-border bg-card/40">
        <div className="flex items-start gap-2.5">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">Pod asal proyek</dt>
            <dd className="mt-0.5 block font-mono text-[11px] break-all text-primary">
              {project.podUrl}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-muted-foreground text-xs">WebID pemilik</dt>
            <dd className="mt-0.5 block font-mono text-[11px] break-all text-primary">
              {project.ownerWebId}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-2.5 sm:col-span-2">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <dt className="text-muted-foreground text-xs">Waktu dibuat:</dt>
          <dd className="text-foreground text-xs">{project.updatedAt}</dd>
        </div>
      </dl>

      {/* Bagian Dokumen Proyek */}
      <section className="space-y-4 pt-3 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Dokumen Proyek
              </h2>
              <Badge variant="secondary" className="text-xs font-mono">
                {documents.length} / 10 berkas
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Berkas PDF dan TXT tersimpan secara terdesentralisasi di Pod pemilik
              workspace.
            </p>
          </div>

          {isOwner && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={documents.length >= 10}
              onClick={() => setUploadDialogOpen(true)}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Unggah Dokumen</span>
            </Button>
          )}
        </div>

        {repository && (
          <DocumentList
            repository={repository}
            documents={documents}
            incompleteDocuments={incompleteDocuments}
            isLoading={isLoadingDocs}
            error={docsError}
            onRefresh={refreshDocuments}
            isOwner={isOwner}
            onOpenUpload={() => setUploadDialogOpen(true)}
          />
        )}
      </section>

      {/* Keterangan Batasan Arsitektur */}
      <div className="rounded-xl border border-primary/25 bg-primary/10 p-4 text-xs leading-relaxed">
        <span className="block font-semibold text-primary">
          Penyimpanan Dokumen Solid Pod Aktif
        </span>
        <p className="mt-1 text-muted-foreground">
          Pemilik proyek dapat mengunggah berkas PDF dan TXT ke Pod, melihat
          daftar dokumen, dan mengunduh berkas asli secara langsung. Izin akses
          ditegakkan langsung oleh server Pod melalui WAC. Modul kolaborasi
          anggota tim, papan tugas, dan integrasi AI akan diaktifkan pada tahap
          selanjutnya.
        </p>
      </div>

      {/* Dialog Unggah Dokumen */}
      {repository && isOwner && (
        <UploadDocumentDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          repository={repository}
          currentDocumentCount={documents.length}
          onSuccess={() => {
            refreshDocuments();
          }}
        />
      )}
    </div>
  );
}

/**
 * Layar detail proyek Solid. Dipasang di rute /dashboard/detail/[projectId]
 * sehingga URL yang dibuka langsung atau di-refresh memulihkan sesi Solid,
 * mencocokkan Pod milik pengguna dari profilnya, lalu membaca proyek di indeks.
 */
export function SolidProjectDetailScreen({
  projectId,
}: {
  readonly projectId: string;
}) {
  return (
    <SolidSessionProvider>
      <ProjectDetailView projectId={projectId} />
    </SolidSessionProvider>
  );
}

function ProjectDetailView({ projectId }: { readonly projectId: string }) {
  const { status, webId } = useSolidSession();
  const [state, setState] = React.useState<DetailState>({ kind: "loading" });

  React.useEffect(() => {
    if (status !== "signed-in" || !webId) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const auth = await getSolidSessionAuth();
        // Pod dicocokkan dari profil Solid pengguna, bukan dari URL.
        const podUrls = await fetchPodUrls(auth.webId);
        if (cancelled) return;

        if (podUrls.length === 0) {
          setState({
            kind: "error",
            message: "Profil Solid Anda belum mencantumkan Pod.",
          });
          return;
        }

        let accessDenied = false;
        let failure: unknown = null;

        for (const podUrl of podUrls) {
          const repository = new SolidPodProjectRepository({
            podUrl,
            webId: auth.webId,
            fetch: auth.fetch,
          });

          try {
            const result = await repository.openProject(projectId);
            if (cancelled) return;
            setState({
              kind: "ready",
              project: result.project,
              fetchImpl: auth.fetch,
            });
            return;
          } catch (error) {
            if (cancelled) return;
            if (error instanceof SolidProjectNotFoundError) {
              continue;
            }
            if (error instanceof SolidProjectAccessDeniedError) {
              accessDenied = true;
              continue;
            }
            failure = error;
          }
        }

        if (cancelled) return;
        if (accessDenied) {
          setState({ kind: "access-denied" });
        } else if (failure) {
          setState({
            kind: "error",
            message: "Gagal membaca detail proyek dari Pod.",
          });
        } else {
          setState({ kind: "not-found" });
        }
      } catch {
        if (cancelled) return;
        setState({
          kind: "error",
          message: "Gagal memuat sesi atau metadata proyek.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, status, webId]);

  if (status === "restoring") {
    return <LoadingState label="Memulihkan sesi Solid…" />;
  }

  if (status !== "signed-in" || !webId) {
    return (
      <FallbackState
        message="Sesi Solid Anda tidak lagi aktif."
        hint="Detail proyek hanya bisa dibaca setelah masuk kembali lewat penyedia identitas Solid."
      />
    );
  }

  switch (state.kind) {
    case "ready":
      return (
        <ProjectDetail
          project={state.project}
          webId={webId}
          fetchImpl={state.fetchImpl}
        />
      );
    case "not-found":
      return (
        <FallbackState
          message="Proyek dengan ID ini tidak tercantum di indeks proyek Pod Anda."
          hint="ID proyek tidak cocok dengan entri mana pun pada indeks Pod. Buka proyek dari daftar di dashboard."
        />
      );
    case "access-denied":
      return (
        <FallbackState
          message="Server menolak pembacaan metadata proyek ini."
          hint="Server Pod menolak permintaan indeks atau project.ttl. Pastikan Anda membuka proyek sebagai pemilik Pod dan izin WAC belum berubah."
        />
      );
    case "error":
      return <FallbackState message={state.message} />;
    case "loading":
    default:
      return <LoadingState label="Memuat detail proyek dari Pod…" />;
  }
}
