import type { Project, ProjectMember } from "../types/project.ts";
import type { Invitation } from "./collaboration-store.ts";
import { installInvitationGroups, memberDisplayName } from "./solid-acl.ts";
export type { Invitation };
export type GrantRole = "Editor" | "Viewer";
const localKey = "collabpod:demo:invitations:v1";
export function demoInvites(): Invitation[] {
  return JSON.parse(localStorage.getItem(localKey) || "[]");
}
function saveLocal(rows: Invitation[]) {
  localStorage.setItem(localKey, JSON.stringify(rows));
}
export function forgetDemoTeam(project: string) {
  saveLocal(demoInvites().filter((i) => i.project !== project));
}
export async function teamRequest<T>(
  fetchImpl: typeof fetch,
  input: Record<string, unknown>,
): Promise<T> {
  const response = await fetchImpl(
    new URL("/api/collaboration", location.origin).href,
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Permintaan undangan gagal.");
  return data as T;
}
function scope(p: Project) {
  return { pod: p.podUrl, project: p.id, owner: p.ownerWebId };
}
export async function sendInvite(
  p: Project,
  recipient: string,
  role: GrantRole,
  fetchImpl: typeof fetch,
) {
  if (p.currentUserRole !== "Owner" || recipient === p.ownerWebId)
    throw new Error("Hanya Owner dapat mengundang teman dengan WebID lain.");
  if (p.isDemo) {
    const rows = demoInvites();
    if (
      rows.some(
        (i) =>
          i.project === p.id &&
          i.recipient === recipient &&
          ["pending", "accepted"].includes(i.state),
      )
    )
      throw new Error("Undangan untuk WebID ini sudah ada.");
    saveLocal([
      ...rows,
      {
        id: crypto.randomUUID(),
        team: p.id,
        owner: p.ownerWebId,
        project: p.id,
        pod: "",
        title: p.name,
        recipient,
        role,
        state: "pending",
      },
    ]);
    return;
  }
  const team = await teamRequest<{ id: string; verified: number }>(fetchImpl, {
    action: "register",
    ...scope(p),
    title: p.name,
  });
  if (!team.verified)
    await installInvitationGroups({
      workspaceUrl: p.workspaceUrl!,
      ownerWebId: p.ownerWebId,
      team: team.id,
      origin: location.origin,
      fetch: fetchImpl,
    });
  await teamRequest(fetchImpl, {
    action: "invite",
    ...scope(p),
    recipient,
    role,
  });
}
export async function updateTeamTitle(p: Project, fetchImpl: typeof fetch) {
  if (p.isDemo) {
    saveLocal(
      demoInvites().map((row) =>
        row.project === p.id ? { ...row, title: p.name } : row,
      ),
    );
  } else {
    await teamRequest(fetchImpl, {
      action: "register",
      ...scope(p),
      title: p.name,
    });
  }
}
export async function roster(
  p: Project,
  fetchImpl: typeof fetch,
): Promise<Invitation[]> {
  if (p.isDemo)
    return demoInvites().filter(
      (i) =>
        i.project === p.id && (i.state === "pending" || i.state === "accepted"),
    );
  const binding = await fetchImpl(
    p.workspaceUrl + "collaboration-binding.txt",
    { method: "HEAD", cache: "no-store" },
  );
  if ([401, 403, 404, 410].includes(binding.status)) return [];
  if (!binding.ok)
    throw new Error("Pengaturan kolaborasi gagal dimuat dari Pod.");
  return teamRequest(fetchImpl, { action: "roster", ...scope(p) });
}
export async function transition(
  fetchImpl: typeof fetch,
  demo: boolean,
  actor: string,
  invite: Invitation,
  action: "accept" | "decline" | "role" | "revoke",
  role?: GrantRole,
) {
  if (!demo) {
    await teamRequest(fetchImpl, {
      action,
      id: invite.id,
      role,
      expectedRole: invite.role,
    });
    return;
  }
  const rows = demoInvites();
  const row = rows.find((i) => i.id === invite.id);
  if (!row) throw new Error("Undangan sudah dihapus.");
  if (action === "accept" || action === "decline") {
    if (
      row.recipient !== actor ||
      row.state !== "pending" ||
      (action === "accept" && row.role !== invite.role)
    )
      throw new Error("Undangan tidak tersedia untuk profil ini.");
    row.state = action === "accept" ? "accepted" : "declined";
  } else {
    if (row.owner !== actor || !["pending", "accepted"].includes(row.state))
      throw new Error("Akses pemilik diperlukan.");
    if (action === "revoke") row.state = "revoked";
    else if (role) row.role = role;
  }
  saveLocal(rows);
}
export function activeMembers(legacy: ProjectMember[], invites: Invitation[]) {
  const members = new Map(legacy.map((m) => [m.webId ?? m.id, m]));
  for (const i of invites.filter((i) => i.state === "accepted"))
    members.set(i.recipient, {
      id: i.id,
      webId: i.recipient,
      name: memberDisplayName(i.recipient),
      role: i.role,
    });
  return Array.from(members.values());
}
export function sharedHref(i: Invitation, demo: boolean) {
  const params = new URLSearchParams(
    demo ? { demo: "1", as: i.recipient } : { pod: i.pod },
  );
  return (
    "/dashboard/detail/" +
    encodeURIComponent(i.project) +
    "?" +
    params.toString()
  );
}
