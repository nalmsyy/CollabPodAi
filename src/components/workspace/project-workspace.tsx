"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Database,
  FileText,
  Info,
  Link2,
  ListTodo,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { Project, ProjectMember } from "@/types/project";
import type {
  ProjectDocument,
  IncompleteProjectDocument,
} from "@/types/document";
import type {
  ChatMessage,
  ChatThread,
  ProjectTask,
  SharedDecision,
  SourceReference,
  WorkspaceData,
  WorkspaceView,
  WorkspaceRepository,
  TaskStatus,
} from "@/types/workspace";
import { entityMeta, EMPTY_WORKSPACE } from "@/types/workspace";
import {
  DemoDocumentRepository,
  demoWorkspaceSeed,
} from "@/lib/demo-workspace";
import {
  SolidWorkspaceRepository,
  DemoWorkspaceRepository,
  isAccessError,
} from "@/lib/workspace-repository";
import { SolidDocumentRepository } from "@/lib/solid-document-repository";
import { clearRetrievalCache, searchApprovedContexts } from "@/lib/retrieval";
import { buildProjectContexts } from "@/lib/project-context";
import { askAi } from "@/lib/ai-service";
import {
  addMemberToProject,
  removeMemberFromProject,
  readProjectMembers,
  resolveMemberRole,
  toProjectMember,
  validateMemberWebId,
} from "@/lib/solid-acl";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentPreviewDialog } from "@/components/documents/document-preview-dialog";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  WorkspaceChrome,
  WorkspaceHeader,
  WORKSPACE_NAV,
} from "./workspace-chrome";
import { cn } from "@/lib/utils";

const STATUS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "Belum mulai" },
  { id: "doing", label: "Dikerjakan" },
  { id: "review", label: "Ditinjau" },
  { id: "done", label: "Selesai" },
];
type Modal = {
  kind: "chat" | "decision" | "task" | "member" | "project";
  thread?: ChatThread;
  decision?: SharedDecision;
  task?: ProjectTask;
  status?: TaskStatus;
  message?: ChatMessage;
} | null;
const fmtTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
function shortName(webId: string, members: ProjectMember[]): string {
  return members.find((m) => m.webId === webId)?.name ?? "Anggota";
}
function Avatar({ name }: { name: string }) {
  return (
    <span className="workspace-avatar" aria-hidden>
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}
function Title({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="workspace-page-heading">
      <div>
        <p className="workspace-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="workspace-description">{description}</p>
      </div>
      <div className="workspace-heading-actions">{children}</div>
    </div>
  );
}

export function ProjectWorkspace({
  project: initialProject,
  webId,
  fetchImpl,
  demo = false,
}: {
  project: Project;
  webId: string;
  fetchImpl: typeof fetch;
  demo?: boolean;
}) {
  const router = useRouter();
  const query = useSearchParams();
  const [project, setProject] = React.useState<Project>(() => {
    if (demo && typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(
          `collabpod:demo:project:${initialProject.id}`,
        );
        if (saved) return JSON.parse(saved);
      } catch {
        // Abaikan kesalahan pembacaan cache demo
      }
    }
    return initialProject;
  });
  const [privateMessages, setPrivateMessages] = React.useState<ChatMessage[]>(
    [],
  );
  const [data, setData] = React.useState<WorkspaceData>(EMPTY_WORKSPACE);
  const [documents, setDocuments] = React.useState<ProjectDocument[]>([]);
  const [incomplete, setIncomplete] = React.useState<
    IncompleteProjectDocument[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [denied, setDenied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [previewDoc, setPreviewDoc] = React.useState<ProjectDocument | null>(
    null,
  );
  const [previewSource, setPreviewSource] =
    React.useState<SourceReference | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [chatFilter, setChatFilter] = React.useState<"all" | "mine">("all");
  const [chatSearch, setChatSearch] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sendStep, setSendStep] = React.useState("");
  const [modal, setModal] = React.useState<Modal>(null);
  const [draft, setDraft] = React.useState({
    title: "",
    body: "",
    assignee: webId,
    role: "Viewer",
    include: true,
  });
  const [revoke, setRevoke] = React.useState<ProjectMember | null>(null);
  const [lastSync, setLastSync] = React.useState("");
  const [showContext, setShowContext] = React.useState(false);
  const loadGeneration = React.useRef(0);
  const alive = React.useRef(true);
  const sendingRef = React.useRef(false);
  const submitAbort = React.useRef<AbortController | null>(null);
  const messageEnd = React.useRef<HTMLDivElement | null>(null);
  const workspaceUrl =
    project.workspaceUrl ??
    `${project.podUrl ?? "https://demo.example/"}collabpod/projects/${project.id}/`;
  const canWrite = project.currentUserRole !== "Viewer";
  const isOwner = project.currentUserRole === "Owner";
  const documentRepo = React.useMemo(
    () =>
      demo
        ? new DemoDocumentRepository(initialProject.id)
        : new SolidDocumentRepository({
            workspaceUrl,
            webId,
            ownerWebId: initialProject.ownerWebId,
            currentUserRole: project.currentUserRole,
            fetch: fetchImpl,
          }),
    [
      demo,
      initialProject.id,
      initialProject.ownerWebId,
      project.currentUserRole,
      workspaceUrl,
      webId,
      fetchImpl,
    ],
  );
  const repository = React.useMemo<WorkspaceRepository>(
    () =>
      demo
        ? new DemoWorkspaceRepository(
            `collabpod:demo:workspace:v2:${initialProject.id}`,
            demoWorkspaceSeed(initialProject.id),
          )
        : new SolidWorkspaceRepository({
            workspaceUrl,
            role: project.currentUserRole,
            fetch: fetchImpl,
          }),
    [demo, initialProject.id, project.currentUserRole, workspaceUrl, fetchImpl],
  );
  const viewValue = query.get("view") ?? "overview";
  const view: WorkspaceView = [
    "overview",
    "chats",
    "documents",
    "tasks",
    "members",
    "settings",
  ].includes(viewValue)
    ? (viewValue as WorkspaceView)
    : "overview";
  const chatId = view === "chats" ? query.get("chat") : null;
  const threads = data.threads.filter((t) => !t.archived);
  const activeThread = threads.find((t) => t.id === chatId);
  const messages = [...data.messages, ...privateMessages]
    .filter((m) => m.threadId === chatId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const decisions = data.decisions.filter((d) => d.active);
  const approved = documents.filter((d) => d.aiApproved);
  const href = React.useCallback(
    (next: WorkspaceView, chat?: string) => {
      const params = new URLSearchParams(query.toString());
      params.set("view", next);
      if (chat) params.set("chat", chat);
      else params.delete("chat");
      return `/dashboard/detail/${encodeURIComponent(initialProject.id)}?${params}`;
    },
    [query, initialProject.id],
  );
  const navigate = (next: WorkspaceView, chat?: string) =>
    router.push(href(next, chat), { scroll: false });
  const fail = React.useCallback((problem: unknown) => {
    if (!alive.current) return;
    setError(
      problem instanceof Error
        ? problem.message
        : "Operasi belum berhasil. Coba muat ulang.",
    );
    if (isAccessError(problem)) {
      setDenied(true);
      setData(EMPTY_WORKSPACE);
      setPrivateMessages([]);
      setModal(null);
      setSearchOpen(false);
      setUploadOpen(false);
      setDocuments([]);
      setPreviewSource(null);
      setPreviewDoc(null);
      clearRetrievalCache();
      submitAbort.current?.abort();
    }
  }, []);
  const reload = React.useCallback(
    async (quiet = false) => {
      const generation = ++loadGeneration.current;
      if (!quiet) setSyncing(true);
      try {
        const [next, docs, members] = await Promise.all([
          repository.read(),
          documentRepo.listDocuments(),
          demo
            ? Promise.resolve(null)
            : readProjectMembers({
                workspaceUrl,
                ownerWebId: initialProject.ownerWebId,
                fetch: (input, init) =>
                  fetchImpl(input, { ...init, cache: "no-store" }),
              }),
        ]);
        if (!alive.current || generation !== loadGeneration.current) return;
        if (members)
          setProject((p) => ({
            ...p,
            currentUserRole: resolveMemberRole(webId, p.ownerWebId, members),
            members: [
              p.members.find((m) => m.role === "Owner")!,
              ...members.map(toProjectMember),
            ],
          }));
        setData(next);
        setDocuments(docs.documents);
        setIncomplete(docs.incompleteDocuments);
        setDenied(false);
        setLastSync(new Date().toISOString());
      } catch (problem) {
        if (generation === loadGeneration.current) fail(problem);
      } finally {
        if (alive.current && generation === loadGeneration.current) {
          setLoading(false);
          setSyncing(false);
        }
      }
    },
    [
      repository,
      documentRepo,
      fail,
      demo,
      workspaceUrl,
      initialProject.ownerWebId,
      webId,
      fetchImpl,
    ],
  );
  React.useEffect(() => {
    alive.current = true;
    const initialTimer = window.setTimeout(() => {
      void reload();
    }, 0);
    const sync = () => {
      if (document.visibilityState === "visible" && !sendingRef.current)
        void reload(true);
    };
    const timer = window.setInterval(sync, 15000);
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      alive.current = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
      submitAbort.current?.abort();
      clearRetrievalCache();
    };
  }, [reload]);
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  React.useEffect(() => {
    messageEnd.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages.length, sending]);

  function openModal(next: NonNullable<Modal>) {
    setError("");
    setDraft({
      title:
        next.thread?.title ??
        next.decision?.title ??
        next.task?.title ??
        (next.kind === "project" ? project.name : ""),
      body:
        next.thread?.description ??
        next.decision?.content ??
        next.task?.description ??
        next.message?.content ??
        (next.kind === "project" ? project.description : ""),
      assignee: next.task?.assignee ?? webId,
      role: "Viewer",
      include: next.thread?.includeInContext ?? true,
    });
    setModal(next);
    setMobileOpen(false);
  }
  async function action(work: () => Promise<void>, success?: string) {
    setBusy(true);
    setError("");
    ++loadGeneration.current;
    try {
      await work();
      await reload();
      if (success) setNotice(success);
    } catch (problem) {
      fail(problem);
    } finally {
      setBusy(false);
    }
  }
  async function saveModal(event: React.FormEvent) {
    event.preventDefault();
    if (!modal || !draft.title.trim()) return;
    await action(async () => {
      const now = new Date().toISOString();
      if (modal.kind === "chat") {
        const thread: ChatThread = {
          ...(modal.thread ?? entityMeta("chat", webId)),
          title: draft.title.trim(),
          description: draft.body.trim(),
          includeInContext: draft.include,
          archived: false,
          updatedAt: now,
        };
        await repository.put("threads", thread, !modal.thread);
        setModal(null);
        navigate("chats", thread.id);
      } else if (modal.kind === "decision") {
        const decision: SharedDecision = {
          ...(modal.decision ?? entityMeta("decision", webId)),
          title: draft.title.trim(),
          content: draft.body.trim(),
          active: true,
          threadId: modal.message?.threadId ?? modal.decision?.threadId,
          messageId: modal.message?.id ?? modal.decision?.messageId,
          sources: modal.message?.sources ?? modal.decision?.sources ?? [],
          updatedAt: now,
        };
        await repository.put("decisions", decision, !modal.decision);
        setModal(null);
      } else if (modal.kind === "task") {
        const task: ProjectTask = {
          ...(modal.task ?? entityMeta("task", webId)),
          title: draft.title.trim(),
          description: draft.body.trim(),
          status: modal.task?.status ?? modal.status ?? "todo",
          assignee: draft.assignee,
          threadId: modal.message?.threadId ?? modal.task?.threadId,
          messageId: modal.message?.id ?? modal.task?.messageId,
          updatedAt: now,
        };
        await repository.put("tasks", task, !modal.task);
        setModal(null);
      } else if (modal.kind === "member") {
        if (project.members.length >= 5)
          throw new Error("Maksimal 5 anggota untuk workspace ini.");
        const validation = validateMemberWebId(draft.title);
        if (!validation.ok) throw new Error(validation.error);
        if (project.members.some((m) => m.webId === validation.webId))
          throw new Error("WebID ini sudah menjadi anggota.");
        if (demo) {
          const next = {
            ...project,
            members: [
              ...project.members,
              {
                id: crypto.randomUUID(),
                name: draft.title.includes("/")
                  ? new URL(draft.title).hostname
                  : draft.title,
                webId: validation.webId,
                role: draft.role as "Editor" | "Viewer",
              },
            ],
          };
          setProject(next);
          localStorage.setItem(
            `collabpod:demo:project:${project.id}`,
            JSON.stringify(next),
          );
        } else {
          const members = await addMemberToProject({
            workspaceUrl,
            ownerWebId: project.ownerWebId,
            webId: validation.webId,
            role: draft.role as "Editor" | "Viewer",
            fetch: fetchImpl,
          });
          setProject((p) => ({
            ...p,
            members: [
              p.members.find((m) => m.role === "Owner")!,
              ...members.map(toProjectMember),
            ],
          }));
        }
        setModal(null);
      } else if (modal.kind === "project") {
        if (!isOwner) throw new Error("Hanya Owner dapat mengubah proyek.");
        if (!demo)
          await updateProjectIdentity(
            project,
            draft.title.trim(),
            draft.body.trim(),
            fetchImpl,
          );
        const next = {
          ...project,
          name: draft.title.trim(),
          description: draft.body.trim(),
        };
        setProject(next);
        if (demo)
          localStorage.setItem(
            `collabpod:demo:project:${project.id}`,
            JSON.stringify(next),
          );
        setModal(null);
      }
    }, "Perubahan tersimpan.");
  }
  async function changeRole(member: ProjectMember, role: "Editor" | "Viewer") {
    await action(async () => {
      if (demo) {
        const next = {
          ...project,
          members: project.members.map((m) =>
            m.id === member.id ? { ...m, role } : m,
          ),
        };
        setProject(next);
        localStorage.setItem(
          `collabpod:demo:project:${project.id}`,
          JSON.stringify(next),
        );
      } else {
        const members = await addMemberToProject({
          workspaceUrl,
          ownerWebId: project.ownerWebId,
          webId: member.webId!,
          role,
          fetch: fetchImpl,
        });
        setProject((p) => ({
          ...p,
          members: [
            p.members.find((m) => m.role === "Owner")!,
            ...members.map(toProjectMember),
          ],
        }));
      }
    }, "Peran anggota diperbarui.");
  }
  async function removeMember() {
    if (!revoke) return;
    await action(async () => {
      if (!demo)
        await removeMemberFromProject({
          workspaceUrl,
          ownerWebId: project.ownerWebId,
          webId: revoke.webId!,
          fetch: fetchImpl,
        });
      const next = {
        ...project,
        members: project.members.filter((m) => m.id !== revoke.id),
      };
      setProject(next);
      if (demo)
        localStorage.setItem(
          `collabpod:demo:project:${project.id}`,
          JSON.stringify(next),
        );
      setRevoke(null);
    }, "Akses anggota dicabut.");
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Tersalin ke clipboard.");
    } catch {
      setError(
        "Clipboard tidak tersedia. Pilih teks lalu salin secara manual.",
      );
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || !activeThread || sendingRef.current || denied)
      return;
    const text = question.trim();
    const threadId = activeThread.id;
    sendingRef.current = true;
    setSending(true);
    setError("");
    setSendStep("Menyelaraskan konteks proyek…");
    const controller = new AbortController();
    submitAbort.current = controller;
    try {
      // Re-read shared state before each turn, including changes made by other members.
      const fresh = await repository.read();
      const currentThread = fresh.threads.find(
        (t) => t.id === threadId && !t.archived,
      );
      if (!currentThread)
        throw new Error("Chat sudah tidak tersedia. Muat ulang proyek.");
      const result = await searchApprovedContexts(project.id, text, {
        repository: documentRepo,
        topK: 4,
        force: true,
      });
      const validDocs = result.approvedDocuments.filter(
        (d) => !result.skipped.some((s) => s.documentId === d.id),
      );
      const sources = buildProjectContexts({
        question: text,
        threadId,
        data: {
          ...fresh,
          messages: [...fresh.messages, ...privateMessages].sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt),
          ),
        },
        documents: validDocs,
        chunks: result.chunks,
      });
      if (controller.signal.aborted) return;
      const userMessage: ChatMessage = {
        ...entityMeta("message", webId),
        threadId,
        role: "user",
        content: text,
        sources: [],
      };
      if (canWrite) await repository.put("messages", userMessage, true);
      setQuestion("");
      if (canWrite) {
        setData({ ...fresh, messages: [...fresh.messages, userMessage] });
      } else {
        setData(fresh);
        setPrivateMessages((p) => [...p, userMessage]);
      }
      setSendStep("Menyusun jawaban dengan sumber…");
      let answer: string;
      if (!sources.length)
        answer =
          "Belum ada konteks yang relevan. Unggah dan setujui dokumen, atau tambahkan keputusan tim sebelum melanjutkan.";
      else if (demo)
        answer = `Pratinjau konteks lintas-chat. Demo ini tidak memanggil Gemini.\n\nUntuk pertanyaan “${text}”, aplikasi memilih ${sources.filter((s) => s.kind === "document").length} potongan dokumen, ${sources.filter((s) => s.kind === "decision").length} keputusan tim, dan ${sources.filter((s) => s.kind === "conversation").length} pesan percakapan.\n\n${sources
          .slice(0, 3)
          .map((s, i) => `${s.text.slice(0, 360)} [S${i + 1}]`)
          .join(
            "\n\n",
          )}\n\nBuka sumber di bawah untuk melihat asal konteks. Pada mode Solid, potongan ini dikirim ke Gemini melalui gateway.`;
      else {
        const response = await askAi({
          question: text,
          contexts: sources.map((s) => ({
            id: s.id,
            kind: s.kind,
            documentId: s.documentId ?? s.id,
            documentName: s.title,
            pageNumbers: s.pageNumbers,
            text: s.text,
            updatedAt: s.updatedAt,
          })),
          signal: controller.signal,
        });
        answer = response.answer;
      }
      if (controller.signal.aborted) return;
      const assistant: ChatMessage = {
        ...entityMeta("message", webId),
        threadId,
        role: "assistant",
        content: answer,
        sources,
        demoReply: demo,
      };
      // Demo replies never become factual cross-chat evidence. Human messages still connect rooms.
      if (canWrite) {
        await repository.put("messages", assistant, true);
        await reload();
      } else setPrivateMessages((p) => [...p, assistant]);
      if (result.skipped.length)
        setNotice(
          `${result.skipped.length} dokumen tidak dipakai karena gagal dibaca, berubah, atau tidak memuat teks.`,
        );
    } catch (problem) {
      if (!controller.signal.aborted) fail(problem);
    } finally {
      sendingRef.current = false;
      if (alive.current) {
        setSending(false);
        setSendStep("");
      }
    }
  }

  const newChat = () => openModal({ kind: "chat" });
  const chromeProps = {
    project,
    view,
    chatId,
    threads,
    documentCount: documents.length,
    demo,
    mobileOpen,
    setMobileOpen,
    href,
    onNewChat: newChat,
    onSearch: () => setSearchOpen(true),
    onRefresh: () => {
      setError("");
      void reload();
    },
    syncing,
  };
  const sourcePanel = (
    <aside className="workspace-context-panel">
      <div className="workspace-panel-title">
        <strong>{activeThread ? "Konteks percakapan" : "Sumber proyek"}</strong>
        <Link href={href("documents")} aria-label="Kelola sumber">
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <p>Landasan yang sama untuk setiap percakapan.</p>
      <div className="workspace-source-count">
        <span>
          <FileText size={13} /> {documents.length} dokumen
        </span>
        <span>
          <i />
          {approved.length} untuk AI
        </span>
      </div>
      <div className="workspace-source-list">
        {approved.slice(0, 5).map((doc) => (
          <button key={doc.id} onClick={() => setPreviewDoc(doc)}>
            <span className="workspace-file-icon">
              <FileText size={18} />
            </span>
            <span>
              <strong>{doc.name}</strong>
              <small>
                {doc.mimeType === "application/pdf" ? "PDF" : "TXT"} · Disetujui
                AI
              </small>
            </span>
            <CheckCircle2 size={13} />
          </button>
        ))}
      </div>
      {canWrite && (
        <button
          className="workspace-add-source"
          onClick={() => setUploadOpen(true)}
        >
          <Plus size={15} /> Tambahkan dokumen
        </button>
      )}
      {activeThread && (
        <div className="workspace-context-decisions">
          <p className="workspace-eyebrow">KEPUTUSAN PROYEK</p>
          {decisions.slice(0, 4).map((d) => (
            <button
              key={d.id}
              onClick={() =>
                setPreviewSource({
                  id: d.id,
                  kind: "decision",
                  title: d.title,
                  text: d.content,
                  pageNumbers: [],
                  threadId: d.threadId,
                })
              }
            >
              {d.content}
            </button>
          ))}
          <p className="workspace-eyebrow mt-6">ANTAR-CHAT</p>
          {threads
            .filter((t) => t.id !== chatId && t.includeInContext)
            .map((t) => (
              <Link key={t.id} href={href("chats", t.id)}>
                <MessageSquare size={14} />
                {t.title}
                <ArrowUpRight size={12} />
              </Link>
            ))}
          <p className="mt-3">
            Pembahasan relevan ikut dicari saat kamu mengirim pertanyaan.
            Keputusan tim menjaga arah penelitian.
          </p>
        </div>
      )}
      <div className="workspace-pod-note">
        <ShieldCheck size={16} />
        <strong>
          {demo ? "Pratinjau ruang bersama" : "Tersimpan di Pod pemilik"}
        </strong>
        <p>
          {demo
            ? "Data contoh tersimpan di browser ini. Masuk dengan Solid untuk bekerja bersama anggota lain."
            : "Anggota membaca sumber yang sama sesuai izin. Hanya konteks terpilih yang dikirim ke AI."}
        </p>
        <Link href={href("settings")}>Lihat koneksi data ↗</Link>
      </div>
      {!activeThread && (
        <div className="workspace-next">
          <strong>
            Langkah berikutnya{" "}
            <span>
              {data.tasks.filter((t) => t.status === "done").length}/
              {data.tasks.length}
            </span>
          </strong>
          {data.tasks
            .filter((t) => t.status !== "done")
            .slice(0, 2)
            .map((t) => (
              <button key={t.id} onClick={() => navigate("tasks")}>
                <span className="workspace-task-dot" />
                {t.title}
              </button>
            ))}
          <Link href={href("tasks")}>Buka papan tugas ↗</Link>
        </div>
      )}
    </aside>
  );
  const threadCards = (items: ChatThread[]) => (
    <div className="workspace-chat-grid">
      {items.map((thread, index) => (
        <Link
          key={thread.id}
          href={href("chats", thread.id)}
          className={`workspace-chat-card tone-${index % 3}`}
        >
          <div className="flex items-center justify-between">
            <small>{String(index + 1).padStart(2, "0")}</small>
            <ArrowUpRight size={17} />
          </div>
          <MessageSquare className="workspace-chat-symbol" size={24} />
          <h3>{thread.title}</h3>
          <p>
            {thread.description ||
              "Ruang untuk mengembangkan bagian penelitian ini."}
          </p>
          <footer>
            <Avatar name={shortName(thread.createdBy, project.members)} />
            <span>
              {thread.createdBy === webId
                ? "Kamu"
                : shortName(thread.createdBy, project.members)}
            </span>
            <small>
              {data.messages.filter((m) => m.threadId === thread.id).length}{" "}
              pesan
            </small>
          </footer>
        </Link>
      ))}
    </div>
  );
  const decisionList = (
    <section className="workspace-decisions">
      <div className="workspace-section-title">
        <h2>
          <Link2 size={17} />
          Konteks bersama
        </h2>
        {canWrite && (
          <button onClick={() => openModal({ kind: "decision" })}>
            <Plus size={14} />
            Tambah
          </button>
        )}
      </div>
      <p>Keputusan yang menjadi pegangan di seluruh chat.</p>
      {decisions.length === 0 && (
        <div className="workspace-empty compact">
          Belum ada keputusan. Simpan kesepakatan dari chat agar seluruh tim
          memakai konteks yang sama.
        </div>
      )}
      {decisions.map((d) => (
        <article key={d.id}>
          <div>
            <strong>{d.title}</strong>
            <p>{d.content}</p>
            <small>
              {d.threadId ? (
                <Link href={href("chats", d.threadId)}>
                  Dari{" "}
                  {threads.find((t) => t.id === d.threadId)?.title ??
                    "chat proyek"}{" "}
                  ↗
                </Link>
              ) : (
                "Keputusan tim"
              )}{" "}
              · {shortName(d.createdBy, project.members)}
            </small>
          </div>
          {canWrite && (
            <button
              aria-label={`Edit keputusan ${d.title}`}
              onClick={() => openModal({ kind: "decision", decision: d })}
            >
              <Settings2 size={15} />
            </button>
          )}
        </article>
      ))}
    </section>
  );

  return (
    <div className="workspace-shell">
      <WorkspaceChrome {...chromeProps} />
      <div className="workspace-body">
        <WorkspaceHeader
          {...chromeProps}
          label={
            activeThread?.title ??
            WORKSPACE_NAV.find((n) => n.id === view)?.label ??
            "Pengaturan"
          }
        />
        <main
          className={cn("workspace-main", activeThread && "is-chat")}
          id="workspace-main"
        >
          {error && (
            <div className="workspace-alert error" role="alert">
              <Info size={17} />
              <span>{error}</span>
              <button
                aria-label="Tutup pesan kesalahan"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="workspace-alert" role="status">
              <Check size={16} />
              <span>{notice}</span>
              <button
                aria-label="Tutup pemberitahuan"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="workspace-loading" role="status">
              <Loader2 className="animate-spin" />
              Membuka ruang kerja…
            </div>
          ) : denied ? (
            <div className="workspace-empty">
              <ShieldCheck size={34} />
              <h1>Akses proyek tidak tersedia.</h1>
              <p>
                Data proyek telah dibersihkan dari tampilan. Masuk kembali atau
                minta Owner memeriksa izin.
              </p>
              <Link href="/dashboard">Kembali ke semua proyek</Link>
            </div>
          ) : (
            <>
              {(view === "overview" || (view === "chats" && !chatId)) && (
                <>
                  <Title
                    eyebrow="WORKSPACE PENELITIAN"
                    title={
                      view === "overview"
                        ? `${project.name}.`
                        : "Ruang untuk setiap ide."
                    }
                    description={
                      view === "overview"
                        ? project.description
                        : "Kerjakan bagianmu. Tetap terhubung dengan seluruh tim."
                    }
                  >
                    <div className="workspace-avatar-stack">
                      {project.members.slice(0, 4).map((m) => (
                        <Avatar key={m.id} name={m.name} />
                      ))}
                    </div>
                    {isOwner && (
                      <Button
                        variant="outline"
                        onClick={() => openModal({ kind: "member" })}
                      >
                        <Users size={15} />
                        Undang anggota
                      </Button>
                    )}
                  </Title>
                  <nav className="workspace-tabs" aria-label="Bagian proyek">
                    <Link
                      aria-current={view === "overview" ? "page" : undefined}
                      href={href("overview")}
                    >
                      Ringkasan proyek
                    </Link>
                    <Link
                      aria-current={view === "chats" ? "page" : undefined}
                      href={href("chats")}
                    >
                      Semua chat <small>{threads.length}</small>
                    </Link>
                    <Link href={href("documents")}>
                      Dokumen <small>{documents.length}</small>
                    </Link>
                    <span className="ml-auto">
                      <Database size={13} />
                      {demo ? "Pod demo" : `Pod ${project.ownerName}`}
                    </span>
                  </nav>
                  <div className="workspace-columns">
                    <div className="min-w-0">
                      {view === "overview" && (
                        <section className="workspace-hero">
                          <div>
                            <p className="workspace-eyebrow">
                              PENGETAHUAN BERSAMA
                            </p>
                            <h2>
                              Ide bertemu.
                              <br />
                              Pengetahuan bertumbuh.
                            </h2>
                            <p>
                              {approved.length} sumber disetujui dan{" "}
                              {decisions.length} keputusan tim
                              <br className="hidden sm:block" /> menghubungkan
                              semua chat dalam proyek ini.
                            </p>
                            <Link href={href("documents")}>
                              Jelajahi dokumen <ArrowUpRight size={16} />
                            </Link>
                          </div>
                          <div className="workspace-hero-art" aria-hidden>
                            <div className="orbit" />
                            <div className="paper-back" />
                            <div className="paper-front">
                              <span>✳</span>
                              <i />
                              <i />
                              <i />
                              <b />
                            </div>
                          </div>
                        </section>
                      )}
                      <section className="workspace-chat-section">
                        <div className="workspace-section-title">
                          <div>
                            <h2>
                              Ruang chat <small>{threads.length}</small>
                            </h2>
                            <p>
                              Setiap percakapan punya fokus. Semua terhubung ke
                              sumber yang sama.
                            </p>
                          </div>
                          {canWrite && (
                            <Button onClick={newChat}>
                              <Plus size={15} />
                              Chat baru
                            </Button>
                          )}
                        </div>
                        {view === "chats" && (
                          <div className="workspace-filter-row">
                            <div className="workspace-filter-tabs">
                              <button
                                className={chatFilter === "all" ? "active" : ""}
                                onClick={() => setChatFilter("all")}
                              >
                                Semua
                              </button>
                              <button
                                className={
                                  chatFilter === "mine" ? "active" : ""
                                }
                                onClick={() => setChatFilter("mine")}
                              >
                                Milik saya
                              </button>
                            </div>
                            <label className="workspace-search-input">
                              <Search size={15} />
                              <input
                                aria-label="Cari chat"
                                placeholder="Cari chat…"
                                value={chatSearch}
                                onChange={(e) => setChatSearch(e.target.value)}
                              />
                            </label>
                          </div>
                        )}
                        {threadCards(
                          threads.filter(
                            (t) =>
                              (chatFilter === "all" ||
                                view === "overview" ||
                                t.createdBy === webId) &&
                              t.title
                                .toLowerCase()
                                .includes(
                                  view === "overview"
                                    ? ""
                                    : chatSearch.toLowerCase(),
                                ),
                          ),
                        )}
                        {threads.length === 0 && (
                          <div className="workspace-empty">
                            <MessageSquare size={30} />
                            <h3>Mulai dari satu bagian.</h3>
                            <p>
                              Buat chat Latar belakang atau Metodologi untuk
                              memulai penelitian.
                            </p>
                            {canWrite && (
                              <Button onClick={newChat}>
                                Buat chat pertama
                              </Button>
                            )}
                          </div>
                        )}
                      </section>
                      {decisionList}
                    </div>
                    {sourcePanel}
                  </div>
                </>
              )}
              {view === "chats" &&
                chatId &&
                (activeThread ? (
                  <>
                    <div className="workspace-chat-heading">
                      <div>
                        <Link href={href("chats")} className="workspace-back">
                          ← Semua chat
                        </Link>
                        <h1>{activeThread.title}</h1>
                        <p>
                          Chat proyek ·{" "}
                          {shortName(activeThread.createdBy, project.members)} ·{" "}
                          {approved.length} sumber tersedia
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="workspace-context-toggle"
                          aria-label="Tampilkan konteks percakapan"
                          onClick={() => setShowContext(!showContext)}
                        >
                          <BookOpen size={18} />
                        </button>
                        {canWrite && (
                          <button
                            aria-label="Informasi chat"
                            onClick={() =>
                              openModal({ kind: "chat", thread: activeThread })
                            }
                          >
                            <Info size={19} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="workspace-columns chat-columns">
                      <div className="workspace-conversation">
                        <div
                          className="workspace-message-list"
                          aria-live="polite"
                        >
                          {messages.length === 0 && (
                            <div className="workspace-chat-welcome">
                              <Sparkles size={35} />
                              <h2>Mulai dengan konteks yang sama.</h2>
                              <p>
                                Tanyakan bagian{" "}
                                {activeThread.title.toLowerCase()}. Dokumen yang
                                disetujui, keputusan tim, dan chat terkait akan
                                membantu jawaban tetap konsisten.
                              </p>
                              <div>
                                {[
                                  "Apa yang sudah disepakati tim?",
                                  "Bagaimana bagian ini terhubung dengan latar belakang?",
                                ].map((q) => (
                                  <button
                                    key={q}
                                    onClick={() => setQuestion(q)}
                                  >
                                    {q}
                                    <ArrowUpRight size={14} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {messages.map((m) => (
                            <article
                              key={m.id}
                              className={cn(
                                "workspace-message",
                                m.role === "assistant" && "assistant",
                              )}
                            >
                              <div className="workspace-message-author">
                                {m.role === "assistant" ? (
                                  <span className="workspace-ai-icon">✳</span>
                                ) : (
                                  <Avatar
                                    name={shortName(
                                      m.createdBy,
                                      project.members,
                                    )}
                                  />
                                )}
                                <strong>
                                  {m.role === "assistant"
                                    ? "CollabPod"
                                    : m.createdBy === webId
                                      ? "Kamu"
                                      : shortName(m.createdBy, project.members)}
                                </strong>
                                {m.role === "assistant" && (
                                  <small>{demo ? "AI demo" : "AI"}</small>
                                )}
                                <time>{fmtTime(m.createdAt)}</time>
                              </div>
                              <div className="workspace-message-text">
                                {m.content}
                              </div>
                              {m.sources.length > 0 && (
                                <div className="workspace-citation-list">
                                  {m.sources.map((s, i) => (
                                    <button
                                      key={`${s.id}-${i}`}
                                      onClick={() => setPreviewSource(s)}
                                    >
                                      <span>S{i + 1}</span>
                                      {s.kind === "document" ? (
                                        <FileText size={12} />
                                      ) : s.kind === "decision" ? (
                                        <Link2 size={12} />
                                      ) : (
                                        <MessageSquare size={12} />
                                      )}
                                      <span>{s.title}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="workspace-message-actions">
                                <button onClick={() => void copy(m.content)}>
                                  <Copy size={13} />
                                  Salin
                                </button>
                                {canWrite && (
                                  <>
                                    <button
                                      onClick={() =>
                                        openModal({
                                          kind: "decision",
                                          message: m,
                                        })
                                      }
                                    >
                                      <Link2 size={13} />
                                      Jadikan konteks bersama
                                    </button>
                                    <button
                                      onClick={() =>
                                        openModal({ kind: "task", message: m })
                                      }
                                    >
                                      <ListTodo size={13} />
                                      Jadikan tugas
                                    </button>
                                  </>
                                )}
                              </div>
                            </article>
                          ))}
                          {sending && (
                            <div
                              className="workspace-send-progress"
                              role="status"
                            >
                              <Loader2 className="animate-spin" size={16} />
                              {sendStep}
                            </div>
                          )}
                          <div ref={messageEnd} />
                        </div>
                        <form className="workspace-composer" onSubmit={send}>
                          <div className="workspace-composer-context">
                            <span>
                              <ShieldCheck size={13} />
                              {approved.length} sumber disetujui ·{" "}
                              {decisions.length} keputusan ·{" "}
                              {threads.filter((t) => t.includeInContext).length}{" "}
                              chat terhubung
                            </span>
                            <Link href={href("documents")}>Kelola sumber</Link>
                          </div>
                          <textarea
                            aria-label="Pesan untuk AI"
                            placeholder="Tulis pesan. Kita lanjutkan dari konteks proyek…"
                            value={question}
                            maxLength={2000}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                !e.shiftKey &&
                                !e.nativeEvent.isComposing
                              ) {
                                e.preventDefault();
                                e.currentTarget.form?.requestSubmit();
                              }
                            }}
                            rows={3}
                            disabled={sending}
                          />
                          <div className="workspace-composer-bottom">
                            <button
                              type="button"
                              aria-label="Tambah sumber"
                              onClick={() =>
                                canWrite
                                  ? setUploadOpen(true)
                                  : navigate("documents")
                              }
                            >
                              <Plus size={18} />
                            </button>
                            <span>
                              <Sparkles size={13} /> Asisten proyek
                            </span>
                            <Button
                              type="submit"
                              size="icon"
                              aria-label="Kirim pesan"
                              disabled={!question.trim() || sending}
                            >
                              <Send size={16} />
                            </Button>
                          </div>
                          <p>
                            {demo
                              ? "Mode demo. Tidak ada pesan yang dikirim ke layanan AI."
                              : canWrite
                                ? "Pesan chat ini dibagikan ke tim. Konteks terpilih dikirim ke Gemini."
                                : "Sesi AI pribadi Viewer. Pesan ini tidak disimpan ke chat bersama."}
                          </p>
                        </form>
                      </div>
                      <div
                        className={cn(
                          "workspace-chat-context",
                          showContext && "mobile-open",
                        )}
                      >
                        {sourcePanel}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="workspace-empty">
                    <h1>Chat tidak ditemukan.</h1>
                    <Link href={href("chats")}>Kembali ke ruang chat</Link>
                  </div>
                ))}
              {view === "documents" && (
                <>
                  <Title
                    eyebrow="PUSAT PENGETAHUAN"
                    title="Dokumen proyek"
                    description="Sumber yang bisa ditelusuri. Pengetahuan yang bisa dibagikan."
                  >
                    {canWrite && (
                      <Button
                        onClick={() => setUploadOpen(true)}
                        disabled={documents.length >= 10}
                      >
                        <Plus size={16} />
                        Tambah dokumen
                      </Button>
                    )}
                  </Title>
                  <DocumentList
                    demo={demo}
                    members={project.members}
                    repository={documentRepo}
                    documents={documents}
                    incompleteDocuments={incomplete}
                    isLoading={syncing}
                    error={null}
                    onRefresh={() => void reload()}
                    canUpload={canWrite}
                    canDelete={canWrite}
                    canApprove={isOwner}
                    onOpenUpload={() => setUploadOpen(true)}
                  />
                  <p className="workspace-caption">
                    PDF teks dan TXT · Maksimal 10 dokumen, 5 MB per berkas.
                    Persetujuan berlaku untuk versi dokumen yang diperiksa
                    Owner.
                  </p>
                </>
              )}
              {view === "tasks" && (
                <>
                  <Title
                    eyebrow="DARI DISKUSI KE TINDAKAN"
                    title="Papan tugas"
                    description="Langkah kecil yang membawa penelitianmu lebih jauh."
                  >
                    {canWrite && (
                      <Button onClick={() => openModal({ kind: "task" })}>
                        <Plus size={15} />
                        Tambah tugas
                      </Button>
                    )}
                  </Title>
                  <div className="workspace-progress">
                    <span>
                      {data.tasks.filter((t) => t.status === "done").length}{" "}
                      dari {data.tasks.length} tugas selesai
                    </span>
                    <span>
                      {data.tasks.length
                        ? Math.round(
                            (data.tasks.filter((t) => t.status === "done")
                              .length /
                              data.tasks.length) *
                              100,
                          )
                        : 0}
                      %
                    </span>
                    <div>
                      <i
                        style={{
                          width: `${data.tasks.length ? (data.tasks.filter((t) => t.status === "done").length / data.tasks.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="workspace-board">
                    {STATUS.map((status) => (
                      <section
                        key={status.id}
                        className={`workspace-board-column status-${status.id}`}
                      >
                        <h2>
                          <i />
                          {status.label}
                          <small>
                            {
                              data.tasks.filter((t) => t.status === status.id)
                                .length
                            }
                          </small>
                        </h2>
                        {data.tasks
                          .filter((t) => t.status === status.id)
                          .map((task) => (
                            <article key={task.id}>
                              <small>
                                CP-{task.id.slice(-6).toUpperCase()}
                              </small>
                              <button
                                className="workspace-task-title"
                                onClick={() =>
                                  canWrite && openModal({ kind: "task", task })
                                }
                              >
                                {task.title}
                              </button>
                              {task.description && (
                                <p>{task.description.slice(0, 140)}</p>
                              )}
                              {task.threadId && (
                                <Link
                                  className="workspace-task-origin"
                                  href={href("chats", task.threadId)}
                                >
                                  <MessageSquare size={12} />
                                  Dari percakapan ↗
                                </Link>
                              )}
                              <div className="workspace-task-assignee">
                                <Avatar
                                  name={shortName(
                                    task.assignee,
                                    project.members,
                                  )}
                                />
                                {shortName(task.assignee, project.members)}
                              </div>
                              <select
                                aria-label={`Status ${task.title}`}
                                value={task.status}
                                disabled={!canWrite || busy}
                                onChange={(e) =>
                                  void action(
                                    () =>
                                      repository.put("tasks", {
                                        ...task,
                                        status: e.target.value as TaskStatus,
                                        updatedAt: new Date().toISOString(),
                                      }),
                                    "Status tugas diperbarui.",
                                  )
                                }
                              >
                                {STATUS.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </article>
                          ))}
                        {canWrite && (
                          <button
                            className="workspace-board-add"
                            onClick={() =>
                              openModal({ kind: "task", status: status.id })
                            }
                          >
                            <Plus size={15} />
                            Tambah tugas
                          </button>
                        )}
                      </section>
                    ))}
                  </div>
                </>
              )}
              {view === "members" && (
                <>
                  <Title
                    eyebrow="KOLABORASI DENGAN KENDALI"
                    title="Anggota & akses"
                    description="Identitas sendiri. Ruang kerja bersama. Izin yang jelas."
                  >
                    {isOwner && (
                      <Button onClick={() => openModal({ kind: "member" })}>
                        <Plus size={15} />
                        Undang anggota
                      </Button>
                    )}
                  </Title>
                  <div className="workspace-members">
                    {project.members.map((member) => (
                      <article key={member.id}>
                        <Avatar name={member.name} />
                        <div className="min-w-0 flex-1">
                          <strong>
                            {member.name}{" "}
                            {member.webId === webId && <small>Kamu</small>}
                          </strong>
                          <p>{member.webId}</p>
                        </div>
                        {member.role === "Owner" || !isOwner ? (
                          <span className="workspace-role">{member.role}</span>
                        ) : (
                          <>
                            <select
                              aria-label={`Peran ${member.name}`}
                              value={member.role}
                              disabled={busy}
                              onChange={(e) =>
                                void changeRole(
                                  member,
                                  e.target.value as "Editor" | "Viewer",
                                )
                              }
                            >
                              <option>Editor</option>
                              <option>Viewer</option>
                            </select>
                            <button
                              className="workspace-remove"
                              aria-label={`Cabut akses ${member.name}`}
                              onClick={() => setRevoke(member)}
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                  <div className="workspace-role-grid">
                    {[
                      [
                        "Owner",
                        "Mengatur anggota, menyetujui sumber AI, dan mengelola seluruh proyek.",
                      ],
                      [
                        "Editor",
                        "Menambahkan dokumen, membuat chat, menyimpan keputusan, dan mengerjakan tugas bersama.",
                      ],
                      [
                        "Viewer",
                        "Membaca sumber, chat, dan tugas. Sesi AI pribadi tidak mengubah percakapan tim.",
                      ],
                    ].map(([role, text]) => (
                      <div key={role}>
                        <ShieldCheck size={19} />
                        <h3>{role}</h3>
                        <p>{text}</p>
                      </div>
                    ))}
                  </div>
                  {!demo && (
                    <div className="workspace-settings-card">
                      <h2>Tautan proyek untuk anggota</h2>
                      <p>
                        Tautan menunjuk proyek. Akses tetap memerlukan WebID
                        yang diberi izin Owner.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void copy(
                            `${window.location.origin}/dashboard/detail/${encodeURIComponent(project.id)}?${new URLSearchParams({ pod: project.podUrl ?? "" })}`,
                          )
                        }
                      >
                        <Copy size={14} />
                        Salin tautan proyek
                      </Button>
                    </div>
                  )}
                  <p className="workspace-caption">
                    {demo
                      ? "Perubahan anggota dalam mode demo hanya simulasi di browser."
                      : "Server Pod menegakkan hak akses. Salinan yang sudah diunduh tidak dapat ditarik kembali dengan pencabutan izin."}
                  </p>
                </>
              )}
              {view === "settings" && (
                <>
                  <Title
                    eyebrow="PREFERENSI PROYEK"
                    title="Pengaturan"
                    description="Atur ruang kerja sesuai cara timmu berpikir."
                  />
                  <section className="workspace-settings-card">
                    <h2>Identitas proyek</h2>
                    <div className="workspace-setting-row">
                      <div>
                        <strong>{project.name}</strong>
                        <p>{project.description}</p>
                      </div>
                      {isOwner && (
                        <Button
                          variant="outline"
                          onClick={() => openModal({ kind: "project" })}
                        >
                          Ubah identitas
                        </Button>
                      )}
                    </div>
                    <div className="workspace-setting-row">
                      <div>
                        <strong>
                          <Database size={16} />{" "}
                          {demo ? "Pod demo" : `Pod ${project.ownerName}`}
                        </strong>
                        <p>
                          {demo
                            ? "Data pratinjau berada di browser ini."
                            : project.podUrl}
                        </p>
                        <p className="break-all">
                          {!demo && project.ownerWebId}
                        </p>
                      </div>
                      <span className="workspace-role">
                        {project.currentUserRole}
                      </span>
                    </div>
                  </section>
                  <section className="workspace-settings-card">
                    <h2>Penggunaan AI</h2>
                    <div className="workspace-setting-row">
                      <div>
                        <strong>Persetujuan per versi dokumen</strong>
                        <p>
                          Owner menyetujui sumber. Perubahan isi membuat versi
                          lama tidak berlaku.
                        </p>
                      </div>
                      <span className="workspace-status">Aktif</span>
                    </div>
                    <div className="workspace-setting-row">
                      <div>
                        <strong>Konteks antar-chat</strong>
                        <p>
                          Keputusan tim dan pesan relevan dari chat yang
                          terhubung ikut digunakan. Ubah partisipasi chat
                          melalui Informasi chat.
                        </p>
                      </div>
                      <span className="workspace-status">Aktif</span>
                    </div>
                    <div className="workspace-setting-row">
                      <div>
                        <strong>Keputusan yang ditinjau</strong>
                        <p>
                          Hasil diskusi menjadi pegangan tim setelah anggota
                          memilih “Jadikan konteks bersama”.
                        </p>
                      </div>
                      <span className="workspace-status">Aktif</span>
                    </div>
                  </section>
                  <section className="workspace-settings-card">
                    <h2>Sinkronisasi</h2>
                    <p>
                      {demo
                        ? "Demo disimpan di browser ini dan tidak tersinkron ke pengguna lain."
                        : "Chat dan tugas diperbarui setiap 15 detik saat tab aktif, ketika kembali ke tab, dan sebelum pertanyaan AI. Penyimpanan memakai sesi Solid pengguna."}
                    </p>
                    <p>{lastSync && `Terakhir dimuat ${fmtTime(lastSync)}.`}</p>
                    <Button
                      variant="outline"
                      onClick={() => void reload()}
                      disabled={syncing}
                    >
                      Muat ulang sekarang
                    </Button>
                  </section>
                  {decisions.length > 0 && (
                    <section className="workspace-settings-card">
                      <h2>Keputusan aktif</h2>
                      {decisions.map((d) => (
                        <div className="workspace-setting-row" key={d.id}>
                          <div>
                            <strong>{d.title}</strong>
                            <p>{d.content}</p>
                          </div>
                          {canWrite && (
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void action(
                                  () =>
                                    repository.put("decisions", {
                                      ...d,
                                      active: false,
                                      updatedAt: new Date().toISOString(),
                                    }),
                                  "Keputusan diarsipkan. Tidak lagi digunakan untuk AI.",
                                )
                              }
                            >
                              Arsipkan
                            </Button>
                          )}
                        </div>
                      ))}
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>
            COLLABPOD <span>Tempat ide menjadi kerja bersama.</span>
          </span>
          <span>
            {demo
              ? "Demo lokal · Belum terhubung ke Pod"
              : "Workspace Solid · Konteks bersama"}
          </span>
        </footer>
      </div>
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        repository={documentRepo}
        currentDocumentCount={documents.length}
        onSuccess={() => {
          void reload();
          clearRetrievalCache();
        }}
      />
      <DocumentPreviewDialog
        document={previewDoc}
        repository={documentRepo}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null);
        }}
      />
      <Dialog
        open={!!previewSource}
        onOpenChange={(open) => {
          if (!open) setPreviewSource(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewSource?.title}</DialogTitle>
            <DialogDescription>
              {previewSource?.kind === "document"
                ? "Potongan dokumen yang dipakai saat jawaban dibuat."
                : previewSource?.kind === "decision"
                  ? "Keputusan tim yang menjadi konteks jawaban."
                  : "Pembahasan chat terkait. Perlakukan sebagai diskusi, bukan bukti ilmiah."}
            </DialogDescription>
          </DialogHeader>
          <div className="workspace-source-preview">{previewSource?.text}</div>
          {previewSource?.pageNumbers.length ? (
            <p>Halaman {previewSource.pageNumbers.join(", ")}</p>
          ) : null}
          {previewSource?.documentId && (
            <Button
              variant="outline"
              onClick={() => {
                const doc = documents.find(
                  (d) => d.id === previewSource.documentId,
                );
                setPreviewSource(null);
                if (doc) setPreviewDoc(doc);
                else setError("Dokumen sumber sudah tidak tersedia.");
              }}
            >
              Buka dokumen
            </Button>
          )}
          {previewSource?.threadId && (
            <Link
              href={href("chats", previewSource.threadId)}
              onClick={() => setPreviewSource(null)}
              className="text-primary"
            >
              Buka chat asal ↗
            </Link>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modal?.kind === "chat"
                ? "Buka ruang percakapan."
                : modal?.kind === "decision"
                  ? "Simpan konteks bersama."
                  : modal?.kind === "task"
                    ? "Dari ide menjadi tugas."
                    : modal?.kind === "member"
                      ? "Berkarya bersama."
                      : "Identitas proyek."}
            </DialogTitle>
            <DialogDescription>
              {modal?.kind === "chat"
                ? "Berikan satu fokus. Dokumen dan keputusan proyek sudah tersedia."
                : modal?.kind === "decision"
                  ? "Tinjau isi sebelum menyimpan. Keputusan ini akan digunakan oleh semua chat."
                  : modal?.kind === "task"
                    ? "Tinjau tugas dan tentukan siapa yang mengerjakannya."
                    : modal?.kind === "member"
                      ? "Masukkan WebID lengkap anggota. Izin mengikuti peran yang kamu pilih."
                      : "Perbarui nama dan tujuan ruang kerja."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveModal} className="workspace-form">
            <label htmlFor="workspace-draft-title">
              {modal?.kind === "member" ? "WebID anggota" : "Nama"}
              <Input
                id="workspace-draft-title"
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                required
                maxLength={modal?.kind === "member" ? 500 : 120}
                placeholder={
                  modal?.kind === "member"
                    ? "https://nama.solidcommunity.net/profile/card#me"
                    : "Misalnya: Metodologi penelitian"
                }
                autoFocus
              />
            </label>
            {modal?.kind !== "member" && (
              <label htmlFor="workspace-draft-body">
                {modal?.kind === "decision" ? "Isi keputusan" : "Deskripsi"}
                <Textarea
                  id="workspace-draft-body"
                  value={draft.body}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, body: e.target.value }))
                  }
                  rows={modal?.kind === "decision" || modal?.message ? 7 : 3}
                  required={modal?.kind === "decision"}
                  maxLength={12000}
                />
              </label>
            )}
            {modal?.kind === "chat" && (
              <label className="workspace-checkbox">
                <input
                  type="checkbox"
                  checked={draft.include}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, include: e.target.checked }))
                  }
                />
                <span>
                  Hubungkan chat ini ke konteks AI proyek
                  <small>
                    Pesan yang relevan dapat membantu jawaban di chat lain.
                    Seluruh anggota tetap dapat membaca chat.
                  </small>
                </span>
              </label>
            )}
            {modal?.kind === "task" && (
              <label htmlFor="task-assignee">
                Penanggung jawab
                <select
                  id="task-assignee"
                  value={draft.assignee}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, assignee: e.target.value }))
                  }
                >
                  {project.members.map((m) => (
                    <option key={m.id} value={m.webId ?? m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {modal?.kind === "member" && (
              <label htmlFor="member-role">
                Peran
                <select
                  id="member-role"
                  value={draft.role}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, role: e.target.value }))
                  }
                >
                  <option>Viewer</option>
                  <option>Editor</option>
                </select>
              </label>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="workspace-form-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Batal
              </Button>
              <Button type="submit" disabled={busy || !draft.title.trim()}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                {modal?.kind === "chat" && !modal.thread
                  ? "Buat chat"
                  : modal?.kind === "member"
                    ? "Undang anggota"
                    : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!revoke}
        onOpenChange={(open) => {
          if (!open) setRevoke(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cabut akses {revoke?.name}?</DialogTitle>
            <DialogDescription>
              Anggota tidak dapat mengambil data proyek pada permintaan
              berikutnya. Salinan yang sudah diunduh tetap berada pada anggota.
            </DialogDescription>
          </DialogHeader>
          <div className="workspace-form-actions">
            <Button variant="outline" onClick={() => setRevoke(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => void removeMember()}
              disabled={busy}
            >
              Cabut akses
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cari di workspace</DialogTitle>
            <DialogDescription>
              Temukan chat, dokumen, tugas, dan keputusan proyek.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Cari seluruh workspace"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik kata kunci…"
            autoFocus
          />
          <div className="workspace-search-results">
            {threads
              .filter((t) =>
                t.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((t) => (
                <Link
                  key={t.id}
                  href={href("chats", t.id)}
                  onClick={() => setSearchOpen(false)}
                >
                  <MessageSquare size={16} />
                  <span>
                    {t.title}
                    <small>Ruang chat</small>
                  </span>
                </Link>
              ))}
            {documents
              .filter((d) =>
                d.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setSearchOpen(false);
                    setPreviewDoc(d);
                  }}
                >
                  <FileText size={16} />
                  <span>
                    {d.name}
                    <small>Dokumen</small>
                  </span>
                </button>
              ))}
            {data.tasks
              .filter((t) =>
                t.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((t) => (
                <Link
                  key={t.id}
                  href={href("tasks")}
                  onClick={() => setSearchOpen(false)}
                >
                  <ListTodo size={16} />
                  <span>
                    {t.title}
                    <small>Tugas</small>
                  </span>
                </Link>
              ))}
            {decisions
              .filter((d) =>
                (d.title + d.content)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setSearchOpen(false);
                    setPreviewSource({
                      id: d.id,
                      kind: "decision",
                      title: d.title,
                      text: d.content,
                      pageNumbers: [],
                      threadId: d.threadId,
                    });
                  }}
                >
                  <Link2 size={16} />
                  <span>
                    {d.title}
                    <small>Konteks bersama</small>
                  </span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function updateProjectIdentity(
  project: Project,
  name: string,
  description: string,
  fetchImpl: typeof fetch,
) {
  if (!project.metadataUrl) throw new Error("Metadata proyek tidak tersedia.");
  const solid = await import("@inrupt/solid-client");
  let etag: string | null = null;
  let dataset = await solid.getSolidDataset(project.metadataUrl, {
    fetch: async (input, init) => {
      const response = await fetchImpl(input, { ...init, cache: "no-store" });
      etag = response.headers.get("etag");
      return response;
    },
  });
  if (!etag || String(etag).startsWith("W/"))
    throw new Error(
      "Pod harus menyediakan strong ETag untuk mengubah metadata dengan aman.",
    );
  const CP = "https://collabpod.ai/ns#";
  let thing = solid
    .getThingAll(dataset)
    .find((t) => solid.getStringNoLocale(t, `${CP}name`) !== null);
  if (!thing) throw new Error("Identitas proyek tidak ditemukan.");
  thing = solid.setStringNoLocale(thing, `${CP}name`, name);
  thing = solid.setStringNoLocale(thing, `${CP}description`, description);
  dataset = solid.setThing(dataset, thing);
  const response = await fetchImpl(project.metadataUrl, {
    method: "PUT",
    headers: { "Content-Type": "text/turtle", "If-Match": etag },
    body: await solid.solidDatasetAsTurtle(dataset),
  });
  if (response.status === 412)
    throw new Error("Identitas proyek telah berubah. Muat ulang dahulu.");
  if (!response.ok)
    throw new Error(`Penyimpanan identitas gagal (HTTP ${response.status}).`);
}
