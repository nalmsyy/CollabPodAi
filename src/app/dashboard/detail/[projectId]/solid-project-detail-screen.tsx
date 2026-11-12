"use client";

import * as React from "react";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import Link from "next/link";
import { ArrowLeft, Loader2, TriangleAlert } from "lucide-react";
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
import { Project } from "@/types/project";

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; project: Project; fetchImpl: typeof fetch }
  | { kind: "not-found" }
  | { kind: "access-denied" }
  | { kind: "error"; message: string };

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
  return (
    <ProjectWorkspace project={project} webId={webId} fetchImpl={fetchImpl} />
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
  projectId: string,
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

        if (podUrls.length === 0 && !podHint) {
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
                (podUrl) => normalizePodUrl(podUrl) !== hintedPod,
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
