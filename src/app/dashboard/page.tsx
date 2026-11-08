"use client";

import * as React from "react";
import {
  Plus,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProjectFilter } from "@/components/projects/project-filter";
import { ProjectList } from "@/components/projects/project-list";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectSummarySheet } from "@/components/projects/project-summary-sheet";
import {
  SolidSessionProvider,
  useSolidSession,
} from "@/components/auth/solid-session-provider";
import { SolidLoginDialog } from "@/components/auth/solid-login-dialog";
import { PodSection } from "@/components/pods/pod-section";
import { PodSelectionProvider } from "@/components/pods/pod-selection-provider";
import { SolidProjectsSection } from "@/components/projects/solid-projects-section";
import { demoProjectRepository } from "@/lib/project-storage";
import { CreateProjectInput, Project, ProjectFilterType } from "@/types/project";

export default function DashboardPage() {
  return (
    <SolidSessionProvider>
      <DashboardView />
    </SolidSessionProvider>
  );
}

function DashboardView() {
  const { status, webId } = useSolidSession();
  const [loginDialogOpen, setLoginDialogOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<ProjectFilterType>("all");
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
  const [feedbackMessage, setFeedbackMessage] = React.useState<{
    text: string;
    scope: "demo" | "solid";
  } | null>(null);

  const isRestoring = status === "restoring";
  const isSolidSession = status === "signed-in";
  const isDemoSession = status === "signed-out";

  // Notifikasi hanya berlaku pada mode tempat aksi dilakukan, sehingga tidak
  // terbawa ke mode lain setelah logout atau login.
  const visibleFeedback = React.useMemo(() => {
    if (!feedbackMessage) return null;
    return feedbackMessage.scope === (isSolidSession ? "solid" : "demo")
      ? feedbackMessage.text
      : null;
  }, [feedbackMessage, isSolidSession]);

  // Data demo hanya dimuat selama mode demo (tanpa sesi Solid).
  React.useEffect(() => {
    if (!isDemoSession) return;
    let isMounted = true;
    demoProjectRepository.listProjects().then((data) => {
      if (isMounted) {
        setProjects(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isDemoSession]);

  // Handler submit pembuatan proyek demo baru
  const handleCreateProject = async (input: CreateProjectInput) => {
    const newProj = await demoProjectRepository.createProject(input);
    setProjects((prev) => [newProj, ...prev]);
    setFeedbackMessage({
      text: `Proyek "${newProj.name}" berhasil dibuat secara lokal dalam mode demo.`,
      scope: "demo",
    });
  };

  const handleSolidProjectCreated = (project: Project) => {
    setFeedbackMessage({
      text: `Proyek "${project.name}" tersimpan privat di Pod dan tercatat di indeks proyek.`,
      scope: "solid",
    });
  };

  // Hitung jumlah untuk tab filter
  const counts = React.useMemo(() => {
    const all = projects.length;
    const mine = projects.filter((p) => p.currentUserRole === "Owner").length;
    const shared = projects.filter((p) => p.currentUserRole !== "Owner").length;
    return { all, mine, shared };
  }, [projects]);

  // Filter daftar proyek berdasarkan pencarian dan tab
  const filteredProjects = React.useMemo(() => {
    return projects.filter((project) => {
      // Filter tab
      if (activeFilter === "mine" && project.currentUserRole !== "Owner") {
        return false;
      }
      if (activeFilter === "shared" && project.currentUserRole === "Owner") {
        return false;
      }

      // Filter nama proyek
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = project.name.toLowerCase().includes(query);
        const matchesDesc = project.description.toLowerCase().includes(query);
        return matchesName || matchesDesc;
      }

      return true;
    });
  }, [projects, activeFilter, searchQuery]);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar Desktop (~240px) */}
      <Sidebar
        className="hidden md:flex shrink-0"
        onRequestLogin={() => setLoginDialogOpen(true)}
      />

      {/* Drawer Mobile */}
      <MobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        onRequestLogin={() => setLoginDialogOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />

        <PodSelectionProvider key={webId ?? "signed-out"}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Banner Mode Demo (hanya tanpa sesi Solid) */}
          {isDemoSession && (
            <Alert variant="info" className="border-primary/25 bg-primary/10 shadow-xs">
              <ShieldAlert className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <AlertTitle className="text-foreground font-semibold text-sm">
                  Mode demo aktif • Data belum terhubung ke Solid Pod
                </AlertTitle>
                <AlertDescription className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                  Semua interaksi dan perubahan data pada tahap ini bersifat lokal di memori
                  peramban dan akan hilang saat halaman dimuat ulang. Tidak ada database terpusat
                  atau autentikasi mock yang menggantikan Solid Protocol.
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Banner Sesi Solid Aktif */}
          {isSolidSession && (
            <Alert variant="info" className="border-primary/25 bg-primary/10 shadow-xs">
              <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <AlertTitle className="text-foreground font-semibold text-sm">
                  Sesi Solid aktif • WebID terverifikasi
                </AlertTitle>
                <AlertDescription className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                  <span className="block">Masuk melalui penyedia identitas Solid sebagai:</span>
                  <code className="mt-1 block font-mono text-[11px] sm:text-xs break-all text-primary">
                    {webId ?? "WebID tidak tersedia pada sesi ini"}
                  </code>
                  <span className="mt-1 block">
                    Proyek privat disimpan di Pod terpilih. Mode demo disembunyikan
                    selama sesi Solid aktif.
                  </span>
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Bagian Pod saya (hanya dengan sesi Solid) */}
          {isSolidSession && <PodSection />}

          {/* Feedback Notifikasi Aksi */}
          {visibleFeedback && (
            <div
              role="status"
              className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-100 text-xs sm:text-sm shadow-xs animate-in fade-in duration-200"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="font-medium">{visibleFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackMessage(null)}
                className="text-emerald-300 hover:text-emerald-100 p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Tutup notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header Konten: Judul & Tombol Aksi */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Proyek saya
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ruang kolaborasi tugas dan riset kelompok berbasis izin Solid Pod dan AI tepercaya.
              </p>
            </div>

            {isDemoSession && (
              <Button
                variant="primary"
                onClick={() => setCreateDialogOpen(true)}
                className="self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Buat proyek demo</span>
              </Button>
            )}
          </div>

          {/* Area Filter & Pencarian (khusus mode demo) */}
          {isDemoSession && (
            <ProjectFilter
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              counts={counts}
            />
          )}

          {/* Daftar Proyek */}
          <section aria-label="Daftar Proyek">
            {isRestoring && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Memeriksa sesi Solid…
              </div>
            )}

            {isSolidSession && (
              <SolidProjectsSection
                onProjectCreated={handleSolidProjectCreated}
              />
            )}

            {isDemoSession && (
              <ProjectList
                projects={filteredProjects}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery("")}
                onSelectProject={(proj) => setSelectedProject(proj)}
                onCreateProject={() => setCreateDialogOpen(true)}
              />
            )}
          </section>
        </main>
        </PodSelectionProvider>
      </div>

      {/* Dialog Masuk dengan Solid */}
      <SolidLoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />

      {/* Dialog Pembuatan Proyek Baru (mode demo) */}
      {isDemoSession && (
        <CreateProjectDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={handleCreateProject}
        />
      )}

      {/* Sheet Pratinjau Ringkasan Proyek */}
      <ProjectSummarySheet
        project={selectedProject}
        open={!!selectedProject}
        onOpenChange={(open) => {
          if (!open) setSelectedProject(null);
        }}
      />
    </div>
  );
}
