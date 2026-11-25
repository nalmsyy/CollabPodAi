"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { demoInvites } from "@/lib/project-team";
import { DEMO_WEB_ID } from "@/lib/demo-workspace";
import { demoProjectRepository } from "@/lib/project-storage";
import type { Project } from "@/types/project";
import Link from "next/link";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import { SolidProjectDetailScreen } from "./solid-project-detail-screen";

/**
 * Rute detail proyek. ID proyek dibaca dari URL di sisi klien sehingga halaman
 * yang dibuka langsung atau di-refresh tetap memakai ID yang sama.
 */
export default function SolidProjectDetailPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense
        fallback={
          <p className="py-20 text-center text-sm text-muted-foreground">
            Memuat detail proyek dari Pod…
          </p>
        }
      >
        <ProjectDetailRoute />
      </Suspense>
    </div>
  );
}

function ProjectDetailRoute() {
  const params = useParams<{ projectId?: string }>();
  const searchParams = useSearchParams();
  const projectId =
    typeof params?.projectId === "string" ? params.projectId : "";
  // Tautan undangan dari Owner menyertakan Pod pemilik proyek.
  const podHint = searchParams.get("pod") ?? undefined;

  if (!projectId) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">
        Memuat detail proyek dari Pod…
      </p>
    );
  }

  if (searchParams.get("demo") === "1") {
    return (
      <DemoProjectRoute
        key={projectId + searchParams.get("as")}
        projectId={projectId}
        actor={searchParams.get("as") || DEMO_WEB_ID}
      />
    );
  }

  return (
    <SolidProjectDetailScreen
      key={`${projectId}#${podHint ?? ""}`}
      projectId={projectId}
      podHint={podHint}
    />
  );
}

function DemoProjectRoute({
  projectId,
  actor,
}: {
  projectId: string;
  actor: string;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    demoProjectRepository
      .listProjects()
      .then((projects) => {
        if (!active) return;
        const found = projects.find((p) => p.id === projectId);
        if (found) {
          const role =
            actor === DEMO_WEB_ID
              ? found.currentUserRole
              : demoInvites().find(
                  (i) =>
                    i.project === projectId &&
                    i.recipient === actor &&
                    i.state === "accepted",
                )?.role;
          if (role) setProject({ ...found, currentUserRole: role });
          else setError("Undangan belum diterima atau akses telah dicabut.");
        } else setError("Proyek demo tidak ditemukan di browser ini.");
      })
      .catch(() => {
        if (active)
          setError(
            "Penyimpanan demo tidak dapat dibuka. Pastikan penyimpanan browser tersedia.",
          );
      });
    return () => {
      active = false;
    };
  }, [projectId, actor]);
  if (error)
    return (
      <div className="p-12 text-center">
        <p>{error}</p>
        <Link href="/dashboard">Kembali ke proyek</Link>
      </div>
    );
  if (!project)
    return (
      <p className="p-12 text-center" role="status">
        Membuka demo…
      </p>
    );
  return (
    <ProjectWorkspace project={project} webId={actor} fetchImpl={fetch} demo />
  );
}
