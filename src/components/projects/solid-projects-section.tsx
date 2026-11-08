"use client";

import * as React from "react";
import {
  FolderPlus,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateSolidProjectDialog } from "@/components/projects/create-solid-project-dialog";
import { usePodSelection } from "@/components/pods/pod-selection-provider";

import { useSolidSession } from "@/components/auth/solid-session-provider";
import { getSolidSessionAuth } from "@/lib/solid-session";
import {
  SolidPodProjectRepository,
  isSolidProjectAccessDenied,
} from "@/lib/solid-project-repository";
import { Project } from "@/types/project";

interface SolidProjectsSectionProps {
  onProjectCreated: (project: Project) => void;
}

type ReadErrorKind = "access" | "connection";

/**
 * Daftar proyek Solid untuk Pod terpilih, dibaca dari project-index.ttl privat.
 * Daftar kosong, kegagalan akses, dan kegagalan koneksi/server dibedakan;
 * daftar dibuang saat Pod berganti.
 */
export function SolidProjectsSection({
  onProjectCreated,
}: SolidProjectsSectionProps) {
  const { selectedPodUrl } = usePodSelection();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);

  if (!selectedPodUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl border border-dashed border-border bg-card/40">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary mb-3">
          <HardDrive className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">
          Pilih Pod untuk melihat proyek
        </h2>
        <p className="mt-1 text-xs text-muted-foreground max-w-md leading-relaxed">
          Daftar proyek dibaca dari indeks privat di Pod yang Anda pilih pada
          bagian &ldquo;Pod saya&rdquo;.
        </p>
      </div>
    );
  }

  const handleCreated = (project: Project) => {
    onProjectCreated(project);
    setReloadToken((token) => token + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground break-all">
          Pod: <code className="font-mono text-[11px] text-primary">{selectedPodUrl}</code>
        </p>
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Buat proyek
        </Button>
      </div>

      <ProjectsForPod
        key={`${selectedPodUrl}#${reloadToken}`}
        podUrl={selectedPodUrl}
        onCreateProject={() => setDialogOpen(true)}
      />

      <CreateSolidProjectDialog
        key={selectedPodUrl}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        podUrl={selectedPodUrl}
        onCreated={handleCreated}
      />
    </div>
  );
}

interface ProjectsForPodProps {
  podUrl: string;
  onCreateProject: () => void;
}

function ProjectsForPod({ podUrl, onCreateProject }: ProjectsForPodProps) {
  const { webId } = useSolidSession();
  const [phase, setPhase] = React.useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [errorKind, setErrorKind] = React.useState<ReadErrorKind>("connection");
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        const auth = await getSolidSessionAuth();
        const repository = new SolidPodProjectRepository({
          podUrl,
          webId: auth.webId,
          fetch: auth.fetch,
        });
        const loaded = await repository.listProjects();
        if (!active) return;
        setProjects(loaded);
        setPhase("ready");
      } catch (error) {
        if (!active) return;
        setProjects([]);
        setErrorKind(
          isSolidProjectAccessDenied(error) ? "access" : "connection"
        );
        setPhase("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [podUrl, reloadToken, webId]);

  if (phase === "loading") {
    return (
      <div
        className="flex items-center gap-2 rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Memuat proyek dari indeks Pod…
      </div>
    );
  }

  if (phase === "error") {
    const denied = errorKind === "access";
    return (
      <div
        className="flex flex-col items-center justify-center p-10 text-center rounded-xl border border-rose-400/30 bg-rose-500/10"
        role="alert"
      >
        <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-300 mb-3">
          {denied ? (
            <ShieldAlert className="w-6 h-6" />
          ) : (
            <TriangleAlert className="w-6 h-6" />
          )}
        </div>
        <h2 className="text-sm font-semibold text-rose-100">
          {denied
            ? "Akses ke indeks proyek ditolak"
            : "Gagal membaca daftar proyek"}
        </h2>
        <p className="mt-1 text-xs text-rose-200/80 max-w-md leading-relaxed">
          {denied
            ? "Server Pod menolak pembacaan indeks proyek. Pastikan Anda masih masuk sebagai pemilik Pod dan izin WAC pada collabpod/ belum berubah."
            : "Indeks proyek tidak dapat dibaca karena koneksi atau gangguan server. Tidak ada data Pod yang diubah pada percobaan ini."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setPhase("loading");
            setReloadToken((token) => token + 1);
          }}
        >
          <RefreshCw className="w-4 h-4" />
          Coba lagi
        </Button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-card/40">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-primary mb-3">
          <FolderPlus className="w-6 h-6" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">
          Indeks proyek belum ada atau masih kosong
        </h2>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm leading-relaxed">
          Indeks proyek belum dibuat atau belum berisi proyek. Proyek yang Anda
          buat akan tersimpan privat di Pod ini dan muncul kembali setelah masuk
          ulang.
        </p>
        <Button variant="primary" size="sm" className="mt-4" onClick={onCreateProject}>
          <Plus className="w-4 h-4" />
          Buat proyek
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p role="status" className="text-xs text-emerald-200/80">
        {projects.length} proyek terbaca dari indeks Pod.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project) => (
          <ProjectCard
            key={`${project.podUrl}-${project.id}`}
            project={project}
          />
        ))}
      </div>
    </div>
  );
}
