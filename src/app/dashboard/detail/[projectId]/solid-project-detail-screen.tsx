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

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; project: Project }
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

function ProjectDetail({ project }: { readonly project: Project }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 rounded-2xl border border-border bg-card/60 p-5">
      <BackLink />

      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Lock className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="teal">Proyek Privat / Solid Pod</Badge>
            <Badge variant="outline">Baca-saja</Badge>
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

      <dl className="space-y-4 text-sm">
        <div className="flex items-start gap-2.5">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-muted-foreground">Pod asal proyek</dt>
            <dd className="mt-0.5 block font-mono text-[11px] break-all text-primary sm:text-xs">
              {project.podUrl}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-muted-foreground">WebID pemilik</dt>
            <dd className="mt-0.5 block font-mono text-[11px] break-all text-primary sm:text-xs">
              {project.ownerWebId}
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <dt className="text-muted-foreground">Waktu dibuat</dt>
          <dd className="text-foreground">{project.updatedAt}</dd>
        </div>
      </dl>

      <div className="rounded-lg border border-primary/25 bg-primary/10 p-4 text-xs leading-relaxed">
        <span className="block font-semibold text-primary">
          Detail proyek baca-saja
        </span>
        <p className="mt-1 text-muted-foreground">
          Halaman ini hanya membaca metadata dari Pod. Penambahan anggota,
          unggahan dokumen, papan tugas, dan AI belum tersedia. Akses dibatasi
          oleh izin WAC pada Pod.
        </p>
      </div>
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
            setState({ kind: "ready", project: result.project });
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
      return <ProjectDetail project={state.project} />;
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
