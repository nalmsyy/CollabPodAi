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
  normalizePodUrl,
} from "@/lib/solid-project-repository";
import { Project, ProjectRole } from "@/types/project";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SolidDocumentRepository } from "@/lib/solid-document-repository";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { IncompleteProjectDocument, ProjectDocument } from "@/types/document";
import { MembersSection } from "@/components/members/members-section";
import { AskAISection } from "@/components/AskAISection";

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
      className="inline-flex items-center gap-2 text-[11px] text-[#6c7b59] hover:text-[#4d6037] transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0" aria-hidden>
        <path d="M9.414 13.414a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656L14.414 18H4v-3.586l7.414 7.414z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Kembali ke proyek saya
    </Link>
  );
}

function LoadingState({ label }: { readonly label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-[#6c7b59]"
      role="status"
    >
      <Loader2 className="h-5 w-5 animate-spin text-[#57733b]" />
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
      className="mx-auto w-full max-w-3xl space-y-4 rounded-[12px] border border-[#d8dfcd] bg-[#dde6d3]/30 p-6 text-sm sm:p-8"
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#ae624c]" />
        <div>
          <p className="font-semibold text-[#7a4a3a]">{message}</p>
          <p className="mt-1 text-[#7a4a3a]/80">
            {hint ??
              "Kembali ke dashboard untuk melihat daftar proyek yang tersedia."}
          </p>
        </div>
      </div>
      <Link
        href="/dashboard"
        className="block w-full sm:w-auto rounded-[8px] border border-line bg-white px-4 py-2 text-[12px] font-medium text-[#4d6037] shadow-xs transition-colors hover:bg-[#f0f4e7]"
      >
        <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
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
  // Peran berasal dari metadata + members.ttl di Pod, bukan dari tebakan klien.
  const role: ProjectRole = project.currentUserRole;
  const isOwner = role === "Owner";
  const canWriteDocuments = role === "Owner" || role === "Editor";
  const workspaceUrl =
    project.workspaceUrl ??
    (project.podUrl ? `${project.podUrl}collabpod/projects/${project.id}/` : "");

  const repository = React.useMemo(() => {
    if (!workspaceUrl) return null;
    return new SolidDocumentRepository({
      workspaceUrl,
      webId,
      ownerWebId: project.ownerWebId,
      currentUserRole: role,
      fetch: fetchImpl,
    });
  }, [workspaceUrl, webId, project.ownerWebId, role, fetchImpl]);

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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <BackLink />

      {/* Header Proyek */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          Workspace Penelitian
        </p>
        <div className="flex flex-col gap-1">
          <h1 className="text-[36px] font-serif font-normal text-foreground leading-tight tracking-tight break-words">
            {project.name}<span style={{ color: "#6a7b54" }}>.</span>
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {project.description && project.description !== "Tidak ada deskripsi proyek."
              ? project.description
              : "Ruang penelitian bersama berbasis Solid Pod."}
          </p>
        </div>
        {/* Role & badges baris kedua */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Badge variant="teal" className="text-[10px]">Solid Pod</Badge>
          <Badge variant="olive" className="text-[10px]">Dokumen Aktif</Badge>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            Peran Anda: <RoleBadge role={role} className="text-[9px]" />
          </span>
        </div>
      </div>

      {/* Metadata Proyek */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-0 text-sm border border-border rounded-xl overflow-hidden">
        <div className="flex flex-col gap-2.5 p-4 border-b border-border sm:border-b sm:border-r">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-[#e9ede0] text-[#4d6037] border border-[#e3e6da] flex items-center justify-center">
              <HardDrive className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-[#6c7958] font-medium">Pod asal proyek</dt>
              <dd className="mt-0.5 block font-mono text-[11px] break-all text-[#4d6037]">
                {project.podUrl}
              </dd>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 p-4 border-b border-border sm:border-b-0">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-8 w-8 shrink-0 rounded-[8px] bg-[#e9ede0] text-[#4d6037] border border-[#e3e6da] flex items-center justify-center">
              <Lock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-[#6c7958] font-medium">WebID pemilik</dt>
              <dd className="mt-0.5 block font-mono text-[11px] break-all text-[#4d6037]">
                {project.ownerWebId}
              </dd>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 p-4 sm:col-span-2 border-t border-border">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-8 w-8 shrink-0 rounded-[8px] bg-[#e9ede0] text-[#4d6037] border border-[#e3e6da] flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] text-[#6c7958] font-medium">Waktu dibuat:</dt>
              <dd className="text-[11px] text-ink">{project.updatedAt}</dd>
            </div>
          </div>
        </div>
      </dl>


      {/* Bagian Dokumen Proyek */}
      <section className="space-y-4 pt-3 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[2px] text-[#6c7c58]">
                Dokumen Proyek
              </h2>
              <Badge variant="secondary" className="text-[9px] font-mono tracking-wide">
                {documents.length} / 10 berkas
              </Badge>
            </div>
            <p className="text-[11px] text-[#6c7d59] leading-relaxed">
              Berkas PDF dan TXT tersimpan di Pod pemilik workspace. Klik dokumen
              untuk melihat teksnya dan tandai &ldquo;Setujui untuk AI&rdquo; agar
              bisa dipakai sebagai konteks.
            </p>
          </div>

          {canWriteDocuments && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={documents.length >= 10}
              onClick={() => setUploadDialogOpen(true)}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 h-8 px-3 text-[11px]"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
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
            canUpload={canWriteDocuments}
            canDelete={canWriteDocuments}
            canApprove={isOwner}
            onOpenUpload={() => setUploadDialogOpen(true)}
          />
        )}
      </section>

      {/* Tanya jawab dokumen (retrieval BM25, belum memanggil LLM) */}
      {repository && (
        <AskAISection
          repository={repository}
          projectId={project.id}
          documents={documents}
        />
      )}

      {/* Anggota & pengaturan: hanya untuk Owner */}
      {isOwner && repository && (
        <MembersSection
          project={project}
          workspaceUrl={workspaceUrl}
          fetchImpl={fetchImpl}
        />
      )}

      {/* Keterangan Batasan Arsitektur */}
      <div className="rounded-[10px] border border-[#dfe5d3] bg-[#eef3e5]/60 p-4 text-[11px] leading-relaxed">
        <span className="block font-semibold text-[#4d6037]">
          Penyimpanan Dokumen Solid Pod Aktif
        </span>
        <p className="mt-1 text-[#667b56]">
          Owner mengelola anggota dan kebijakan AI, Editor dapat mengunggah serta
          menghapus dokumen, dan Viewer hanya membaca. Teks PDF/TXT diekstrak di
          peramban dengan pdf.js, sedangkan izin akses ditegakkan langsung oleh
          server Pod melalui WAC. Pencarian konteks (RAG) sudah aktif dan hanya
          memakai dokumen yang disetujui Owner; pengiriman konteks ke model
          bahasa belum diaktifkan.
        </p>
      </div>

      {/* Dialog Unggah Dokumen */}
      {repository && canWriteDocuments && (
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
  podHint,
}: {
  readonly projectId: string;
  /** Pod pemilik proyek dari tautan undangan (?pod=...), untuk anggota. */
  readonly podHint?: string;
}) {
  return (
    <SolidSessionProvider>
      <ProjectDetailView projectId={projectId} podHint={podHint} />
    </SolidSessionProvider>
  );
}

/**
 * Baca proyek lewat indeks Pod; bila tidak tercatat di sana (mis. anggota
 * membuka proyek milik orang lain), baca metadata langsung dari Pod tersebut.
 * Server Pod tetap menolak pembacaan bila WebID tidak punya izin.
 */
async function openProjectWithFallback(
  repository: SolidPodProjectRepository,
  projectId: string
) {
  try {
    return await repository.openProject(projectId);
  } catch (error) {
    // Indeks Pod pemilik bersifat privat bagi anggota, jadi penolakan indeks
    // juga perlu dicoba lewat metadata langsung (yang boleh dibaca anggota).
    if (
      error instanceof SolidProjectNotFoundError ||
      error instanceof SolidProjectAccessDeniedError
    ) {
      return repository.openProjectDirect(projectId);
    }
    throw error;
  }
}

function ProjectDetailView({
  projectId,
  podHint,
}: {
  readonly projectId: string;
  readonly podHint?: string;
}) {
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

        // Pod dari tautan undangan dicoba lebih dulu: anggota membuka proyek
        // yang berada di Pod pemilik, bukan di indeks Pod miliknya sendiri.
        const hintedPod = podHint ? normalizePodUrl(podHint) : null;
        const candidatePods = hintedPod
          ? [
              hintedPod,
              ...podUrls.filter(
                (podUrl) => normalizePodUrl(podUrl) !== hintedPod
              ),
            ]
          : podUrls;

        for (const podUrl of candidatePods) {
          const repository = new SolidPodProjectRepository({
            podUrl,
            webId: auth.webId,
            fetch: auth.fetch,
          });

          try {
            const result = await openProjectWithFallback(repository, projectId);
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
  }, [projectId, podHint, status, webId]);

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
