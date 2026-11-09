"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SolidProjectDetailScreen } from "./solid-project-detail-screen";

/**
 * Rute detail proyek. ID proyek dibaca dari URL di sisi klien sehingga halaman
 * yang dibuka langsung atau di-refresh tetap memakai ID yang sama.
 */
export default function SolidProjectDetailPage() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6 lg:p-8">
      <Suspense
        fallback={
          <p className="py-20 text-center text-sm text-muted-foreground">
            Memuat detail proyek dari Pod…
          </p>
        }
      >
        <ProjectDetailRoute />
      </Suspense>
    </main>
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

  return (
    <SolidProjectDetailScreen
      key={`${projectId}#${podHint ?? ""}`}
      projectId={projectId}
      podHint={podHint}
    />
  );
}
