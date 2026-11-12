"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import {
  SolidSessionProvider,
  useSolidSession,
} from "@/components/auth/solid-session-provider";
import { SolidLoginDialog } from "@/components/auth/solid-login-dialog";
import { PodSection } from "@/components/pods/pod-section";
import { PodSelectionProvider } from "@/components/pods/pod-selection-provider";
import { SolidProjectsSection } from "@/components/projects/solid-projects-section";
import { demoProjectRepository } from "@/lib/project-storage";
import {
  CreateProjectInput,
  Project,
  ProjectFilterType,
} from "@/types/project";

export default function DashboardPage() {
  return (
    <SolidSessionProvider>
      <DashboardView />
    </SolidSessionProvider>
  );
}

function DashboardView() {
  const router = useRouter();
  const { status, webId } = useSolidSession();
  const [loginDialogOpen, setLoginDialogOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFilter, setActiveFilter] =
    React.useState<ProjectFilterType>("all");
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [feedbackMessage, setFeedbackMessage] = React.useState<{
    text: string;
    scope: "demo" | "solid";
  } | null>(null);

  const isRestoring = status === "restoring";
  const isSolidSession = status === "signed-in";
  const isDemoSession = status === "signed-out";

  const visibleFeedback = React.useMemo(() => {
    if (!feedbackMessage) return null;
    return feedbackMessage.scope === (isSolidSession ? "solid" : "demo")
      ? feedbackMessage.text
      : null;
  }, [feedbackMessage, isSolidSession]);

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

  const counts = React.useMemo(() => {
    const all = projects.length;
    const mine = projects.filter((p) => p.currentUserRole === "Owner").length;
    const shared = projects.filter((p) => p.currentUserRole !== "Owner").length;
    return { all, mine, shared };
  }, [projects]);

  const filteredProjects = React.useMemo(() => {
    return projects.filter((project) => {
      if (activeFilter === "mine" && project.currentUserRole !== "Owner")
        return false;
      if (activeFilter === "shared" && project.currentUserRole === "Owner")
        return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return (
          project.name.toLowerCase().includes(query) ||
          project.description.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [projects, activeFilter, searchQuery]);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar Desktop */}
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
      <div className="flex flex-col flex-1 min-w-0">
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />

        <PodSelectionProvider key={webId ?? "signed-out"}>
          <main className="flex-1 px-6 sm:px-9 py-8 max-w-6xl w-full mx-auto space-y-7">
            {/* Page heading */}
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                {isSolidSession ? "Workspace Solid" : "Workspace Demo"}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <h1 className="text-[36px] font-serif font-normal text-foreground leading-tight tracking-tight">
                    Ruang untuk berkarya.
                  </h1>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    Temukan kembali pekerjaanmu, lanjutkan bersama tim.
                  </p>
                </div>
                {isDemoSession && (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setCreateDialogOpen(true)}
                    className="self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Proyek baru
                  </Button>
                )}
              </div>
            </div>

            {/* Banner Mode Demo */}
            {isDemoSession && (
              <Alert variant="info" className="border-primary/20 bg-primary/5">
                <ShieldAlert className="h-4 w-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <AlertTitle className="text-foreground font-semibold text-sm">
                    Mode demo aktif • Data belum terhubung ke Solid Pod
                  </AlertTitle>
                  <AlertDescription className="text-muted-foreground text-xs mt-0.5">
                    Data demo tersimpan di browser ini. Hubungkan Solid Pod
                    untuk berkolaborasi dengan anggota lain.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {/* Banner Sesi Solid Aktif */}
            {isSolidSession && (
              <Alert variant="info" className="border-primary/20 bg-primary/5">
                <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <AlertTitle className="text-foreground font-semibold text-sm">
                    Sesi Solid aktif • WebID terverifikasi
                  </AlertTitle>
                  <AlertDescription className="text-muted-foreground text-xs mt-0.5">
                    <code className="font-mono text-[11px] break-all text-primary">
                      {webId ?? "WebID tidak tersedia"}
                    </code>
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {/* Bagian Pod saya */}
            {isSolidSession && <PodSection />}

            {/* Feedback Notifikasi */}
            {visibleFeedback && (
              <div
                role="status"
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs sm:text-sm shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{visibleFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackMessage(null)}
                  className="text-emerald-600 hover:text-emerald-800 p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Tutup notifikasi"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Filter & Pencarian (hanya mode demo) */}
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
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
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
                  onSelectProject={(proj) =>
                    router.push(
                      `/dashboard/detail/${encodeURIComponent(proj.id)}?demo=1`,
                    )
                  }
                  onCreateProject={() => setCreateDialogOpen(true)}
                />
              )}
            </section>
          </main>

          {/* Footer */}
          <footer className="border-t border-border py-4 px-6 sm:px-9 flex items-center justify-between text-[9px] text-muted-foreground">
            <span className="uppercase tracking-widest font-semibold">
              COLLABPOD
            </span>
            <span>Tempat ide menjadi kerja bersama.</span>
          </footer>
        </PodSelectionProvider>
      </div>

      {/* Dialog Masuk */}
      <SolidLoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
      />

      {/* Dialog Pembuatan Proyek Demo */}
      {isDemoSession && (
        <CreateProjectDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={handleCreateProject}
        />
      )}
    </div>
  );
}
