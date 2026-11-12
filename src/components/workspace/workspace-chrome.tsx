"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Database,
  Folder,
  LayoutGrid,
  ListTodo,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  Users,
  RefreshCw,
} from "lucide-react";
import { BrandMark } from "@/components/layout/sidebar";
import { SessionAccountPanel } from "@/components/auth/session-account-panel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project";
import type { ChatThread, WorkspaceView } from "@/types/workspace";
export const WORKSPACE_NAV = [
  { id: "overview", label: "Ringkasan", icon: LayoutGrid },
  { id: "chats", label: "Ruang chat", icon: MessageSquare },
  { id: "documents", label: "Dokumen", icon: BookOpen },
  { id: "tasks", label: "Papan tugas", icon: ListTodo },
  { id: "members", label: "Anggota & akses", icon: Users },
] as const;
interface ChromeProps {
  project: Project;
  view: WorkspaceView;
  chatId: string | null;
  threads: ChatThread[];
  documentCount: number;
  demo: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  href: (view: WorkspaceView, chat?: string) => string;
  onNewChat: () => void;
  onSearch: () => void;
  onRefresh: () => void;
  syncing: boolean;
}
export function WorkspaceChrome(props: ChromeProps) {
  const router = useRouter();
  const { project, view, chatId, threads, documentCount, demo, href } = props;
  const nav = (
    <>
      <Link href="/dashboard" className="workspace-brand">
        <BrandMark />
        <span>
          collabpod<span className="text-primary">.</span>
        </span>
        <small>BETA</small>
      </Link>
      <Link href={href("overview")} className="workspace-switch">
        <BookOpen size={18} />
        <span>
          <strong>Ruang riset {demo ? "Yuhu" : project.ownerName}</strong>
          <small>{demo ? "Workspace demo" : "Workspace bersama"}</small>
        </span>
        <ChevronDown size={14} />
      </Link>
      <button className="workspace-search" onClick={props.onSearch}>
        <Search size={15} />
        <span>Cari di workspace</span>
        <kbd>⌘ K</kbd>
      </button>
      <Link href="/dashboard" className="workspace-nav-link">
        <Folder size={17} />
        <span>Semua proyek</span>
      </Link>
      <div className="workspace-label">
        PROYEK AKTIF{" "}
        <Link href={href("settings")} aria-label="Pengaturan proyek">
          ···
        </Link>
      </div>
      <Link href={href("overview")} className="workspace-project-name">
        <i />
        {project.name}
        <ChevronDown size={13} />
      </Link>
      <nav aria-label="Navigasi proyek">
        {WORKSPACE_NAV.map((item) => (
          <Link
            key={item.id}
            href={href(item.id)}
            onClick={() => props.setMobileOpen(false)}
            aria-current={view === item.id ? "page" : undefined}
            className={cn("workspace-nav-link", view === item.id && "active")}
          >
            <item.icon size={17} />
            <span>{item.label}</span>
            {item.id === "chats" && <small>{threads.length}</small>}
            {item.id === "documents" && <small>{documentCount}</small>}
          </Link>
        ))}
      </nav>
      <div className="workspace-label mt-7">
        CHAT TERBARU{" "}
        {project.currentUserRole !== "Viewer" && (
          <button aria-label="Buat chat baru" onClick={props.onNewChat}>
            <Plus size={16} />
          </button>
        )}
      </div>
      <div>
        {threads
          .slice(-5)
          .reverse()
          .map((thread, i) => (
            <Link
              key={thread.id}
              href={href("chats", thread.id)}
              onClick={() => props.setMobileOpen(false)}
              className={cn(
                "workspace-recent",
                thread.id === chatId && "selected",
              )}
            >
              <i className={`tone-${i % 3}`} />
              <span>{thread.title}</span>
            </Link>
          ))}
      </div>
      <div className="workspace-sidebar-bottom">
        <Link className="workspace-pod-card" href={href("settings")}>
          <Database size={21} />
          <span>
            <strong>Data tetap milikmu</strong>
            <small>Lihat koneksi Pod ↗</small>
          </span>
        </Link>
        <Link
          className={cn("workspace-nav-link", view === "settings" && "active")}
          href={href("settings")}
        >
          <Settings2 size={17} />
          <span>Pengaturan</span>
        </Link>
        {demo ? (
          <div className="workspace-account">
            <span className="workspace-avatar">Y</span>
            <div>
              Yuhu<small>Akun demo · {project.currentUserRole}</small>
            </div>
          </div>
        ) : (
          <SessionAccountPanel
            onRequestLogin={() => {
              router.push("/dashboard");
            }}
          />
        )}
      </div>
    </>
  );
  return (
    <>
      <aside className="workspace-sidebar">{nav}</aside>
      <Sheet open={props.mobileOpen} onOpenChange={props.setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[270px] p-0 bg-sidebar overflow-y-auto"
        >
          <SheetTitle className="sr-only">Navigasi workspace</SheetTitle>
          <div className="workspace-mobile-nav">{nav}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
export function WorkspaceHeader(
  props: Pick<
    ChromeProps,
    "project" | "setMobileOpen" | "demo" | "onRefresh" | "syncing"
  > & { label: string },
) {
  return (
    <header className="workspace-topbar">
      <button
        className="workspace-mobile-toggle"
        aria-label="Buka navigasi proyek"
        onClick={() => props.setMobileOpen(true)}
      >
        <Menu size={20} />
      </button>
      <Link href="/dashboard">
        <Folder size={17} />
        <span>Proyek</span>
      </Link>
      <ChevronRight size={12} />
      <span className="truncate">{props.project.name}</span>
      {props.label && (
        <>
          <ChevronRight size={12} />
          <span className="workspace-breadcrumb-view">{props.label}</span>
        </>
      )}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <span className="workspace-connection">
          <i />
          {props.demo ? "Demo interaktif" : "Solid Pod"}
        </span>
        <button
          title="Muat ulang data proyek"
          aria-label="Muat ulang data proyek"
          onClick={props.onRefresh}
          disabled={props.syncing}
        >
          <RefreshCw
            size={15}
            className={props.syncing ? "animate-spin" : ""}
          />
        </button>
      </div>
    </header>
  );
}
