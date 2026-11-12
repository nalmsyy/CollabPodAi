"use client";

import * as React from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Link2,
  Loader2,
  MailPlus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Project, ProjectMember } from "@/types/project";
import {
  MEMBER_ROLES,
  MemberRole,
  addMemberToProject,
  describeSolidAclError,
  isSolidAclAccessDenied,
  memberDisplayName,
  readProjectMembers,
  removeMemberFromProject,
  toProjectMember,
  validateMemberWebId,
} from "@/lib/solid-acl";
import { cn } from "@/lib/utils";

interface MembersSectionProps {
  project: Project;
  workspaceUrl: string;
  fetchImpl: typeof fetch;
  /** Dipanggil setelah daftar anggota di Pod berubah. */
  onMembersChanged?: (members: ProjectMember[]) => void;
}

interface Feedback {
  kind: "success" | "error";
  text: string;
}

/**
 * Pengaturan anggota proyek (khusus Owner). Mengundang Editor/Viewer dengan
 * menulis ACL pada kontainer data proyek di Pod, dan mencabutnya kembali.
 */
export function MembersSection({
  project,
  workspaceUrl,
  fetchImpl,
  onMembersChanged,
}: MembersSectionProps) {
  const ownerWebId = project.ownerWebId;
  const [members, setMembers] = React.useState<ProjectMember[]>(project.members);
  const [webIdInput, setWebIdInput] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>("Viewer");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [removingWebId, setRemovingWebId] = React.useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<ProjectMember | null>(
    null
  );
  const [isCopying, setIsCopying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const invitedMembers = React.useMemo(
    () => members.filter((member) => member.role !== "Owner"),
    [members]
  );

  const ownerMember = React.useMemo<ProjectMember>(
    () =>
      members.find((member) => member.role === "Owner") ?? {
        id: `${project.id}-owner`,
        name: project.ownerName,
        role: "Owner",
        webId: ownerWebId,
      },
    [members, ownerWebId, project.id, project.ownerName]
  );

  const shareLink = React.useMemo(() => {
    if (typeof window === "undefined" || !project.podUrl) return "";
    const query = new URLSearchParams({ pod: project.podUrl });
    return `${window.location.origin}/dashboard/detail/${encodeURIComponent(
      project.id
    )}?${query.toString()}`;
  }, [project.id, project.podUrl]);

  const applyMembers = React.useCallback(
    (next: ProjectMember[]) => {
      setMembers(next);
      onMembersChanged?.(next);
    },
    [onMembersChanged]
  );

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await readProjectMembers({
          workspaceUrl,
          fetch: fetchImpl,
        });
        if (cancelled) return;
        applyMembers([ownerMember, ...stored.map(toProjectMember)]);
      } catch {
        // Abaikan
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyMembers, fetchImpl, ownerMember, workspaceUrl]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const validation = validateMemberWebId(webIdInput);
    if (!validation.ok) {
      setFieldError(validation.error ?? "WebID tidak valid.");
      return;
    }
    if (validation.webId === ownerWebId) {
      setFieldError("Pemilik proyek sudah memiliki akses penuh.");
      return;
    }
    if (invitedMembers.some((member) => member.webId === validation.webId)) {
      setFieldError("WebID ini sudah menjadi anggota proyek.");
      return;
    }

    setFieldError(null);
    setIsAdding(true);

    try {
      const stored = await addMemberToProject({
        workspaceUrl,
        ownerWebId,
        webId: validation.webId,
        role,
        fetch: fetchImpl,
      });
      applyMembers([ownerMember, ...stored.map(toProjectMember)]);
      setWebIdInput("");
      setRole("Viewer");
      setFeedback({
        kind: "success",
        text: `${memberDisplayName(
          validation.webId
        )} ditambahkan sebagai ${role}. Izin sudah disimpan di Pod.`,
      });
    } catch (error) {
      const desc = describeSolidAclError(error);
      setFeedback({
        kind: "error",
        text: isSolidAclAccessDenied(error)
          ? "Akses Ditolak: Anda tidak memiliki izin untuk mengubah anggota proyek ini."
          : `${desc.stepLabel} ${desc.message}`,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget || !revokeTarget.webId) return;

    setRemovingWebId(revokeTarget.webId);
    setFeedback(null);

    try {
      const stored = await removeMemberFromProject({
        workspaceUrl,
        webId: revokeTarget.webId,
        fetch: fetchImpl,
      });
      applyMembers([ownerMember, ...stored.map(toProjectMember)]);
      setFeedback({
        kind: "success",
        text: `Akses ${memberDisplayName(
          revokeTarget.webId
        )} dicabut dan entrinya dihapus dari members.ttl.`,
      });
    } catch (error) {
      const desc = describeSolidAclError(error);
      setFeedback({
        kind: "error",
        text: isSolidAclAccessDenied(error)
          ? "Akses Ditolak: Anda tidak memiliki izin untuk mengubah anggota proyek ini."
          : `${desc.stepLabel} ${desc.message}`,
      });
    } finally {
      setRemovingWebId(null);
      setRevokeTarget(null);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({
        kind: "error",
        text: "Tautan proyek tidak dapat disalin otomatis.",
      });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <section className="space-y-4 pt-3 border-t border-border" aria-labelledby="members-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#53643e]" />
          <h2 id="members-heading" className="text-base font-semibold text-foreground">
            Anggota &amp; Akses
          </h2>
          <Badge variant="olive" className="text-xs font-mono">
            {invitedMembers.length + 1} anggota
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          WAC menegakkan izin langsung di Solid Pod.
        </p>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Editor</span> dapat membaca
        dan mengunggah dokumen di <code className="font-mono text-[11px]">data/</code>.{" "}
        <span className="font-semibold text-foreground">Viewer</span> hanya dapat
        membaca dokumen.
      </p>

      {/* Form undang anggota */}
      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <label
              htmlFor="member-webid"
              className="block text-xs font-semibold text-foreground"
            >
              WebID anggota
            </label>
            <Input
              id="member-webid"
              type="url"
              inputMode="url"
              placeholder="https://pod.example/profil/card#me"
              value={webIdInput}
              disabled={isAdding}
              onChange={(event) => {
                setWebIdInput(event.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "member-webid-error" : undefined}
              className="font-mono text-xs"
            />
            {fieldError && (
              <p
                id="member-webid-error"
                className="flex items-center gap-1.5 text-xs font-medium text-rose-700"
              >
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                {fieldError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-foreground">Role</span>
            <div
              role="radiogroup"
              aria-label="Role anggota"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-card p-1 text-xs select-none"
            >
              {MEMBER_ROLES.map((option) => {
                const active = role === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={isAdding}
                    onClick={() => setRole(option)}
                    className={cn(
                      "rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-[#e3e8d8] text-[#4d6037] font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Akses diberikan ke kontainer <code className="font-mono">data/</code> proyek.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isAdding}
            className="inline-flex items-center gap-1.5"
          >
            {isAdding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menyimpan ke Pod…
              </>
            ) : (
              <>
                <MailPlus className="h-3.5 w-3.5" />
                Undang anggota
              </>
            )}
          </Button>
        </div>
      </form>

      {feedback && (
        <div
          role="alert"
          className={cn(
            "flex items-start justify-between gap-2 rounded-xl border p-3 text-xs",
            feedback.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          )}
        >
          <div className="flex items-start gap-2 min-w-0">
            {feedback.kind === "success" ? (
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span className="leading-relaxed break-words">{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="shrink-0 text-[11px] underline opacity-80 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Daftar anggota */}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        <MemberRow member={ownerMember} isOwner />
        {invitedMembers.map((member) => (
          <MemberRow
            key={member.webId ?? member.id}
            member={member}
            onRevoke={() => setRevokeTarget(member)}
            isRemoving={removingWebId === member.webId}
          />
        ))}
        {invitedMembers.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">
            Belum ada anggota lain. Undang WebID di atas untuk berbagi akses proyek.
          </p>
        )}
      </div>

      {/* Tautan akses untuk anggota */}
      {shareLink && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Link2 className="h-4 w-4 text-[#53643e]" />
            Tautan proyek untuk anggota
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Anggota membuka tautan ini setelah masuk dengan WebID yang diundang.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={shareLink}
              aria-label="Tautan proyek untuk anggota"
              onFocus={(event) => event.currentTarget.select()}
              className="font-mono text-[11px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={isCopying}
              className="inline-flex shrink-0 items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Tersalin
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Salin
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Konfirmasi cabut akses */}
      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removingWebId) setRevokeTarget(null);
        }}
      >
        <DialogContent className="max-w-md bg-[#fffefa] border border-[#dce6ce] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Cabut akses anggota?</DialogTitle>
            <DialogDescription>
              <span className="font-mono break-all text-foreground font-semibold">
                {revokeTarget?.webId}
              </span>{" "}
              akan kehilangan izin WAC pada kontainer data proyek dan entrinya
              dihapus dari <code className="font-mono text-[11px]">members.ttl</code>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={removingWebId !== null}
              onClick={() => setRevokeTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={removingWebId !== null}
              onClick={handleRevoke}
              className="inline-flex items-center gap-1.5"
            >
              {removingWebId ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Mencabut…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Cabut akses
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MemberRow({
  member,
  isOwner = false,
  onRevoke,
  isRemoving = false,
}: {
  member: ProjectMember;
  isOwner?: boolean;
  onRevoke?: () => void;
  isRemoving?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {member.name}
          </span>
          <RoleBadge role={member.role} />
          {isOwner && (
            <Badge variant="olive" className="text-[10px]">
              Pemilik Pod
            </Badge>
          )}
        </div>
        <p className="font-mono text-[11px] break-all text-muted-foreground">
          {member.webId ?? "—"}
        </p>
      </div>

      {!isOwner && onRevoke && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          disabled={isRemoving}
          aria-label={`Cabut akses ${member.name}`}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 self-end text-xs font-medium text-rose-700 hover:bg-rose-50 sm:self-center"
        >
          {isRemoving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          <span>Cabut Akses</span>
        </Button>
      )}
    </div>
  );
}
