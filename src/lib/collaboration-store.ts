import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

export class CollaborationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
type Row = {
  id: string;
  owner: string;
  pod: string;
  project: string;
  title: string;
  verified: number;
};
type State = "pending" | "accepted" | "declined" | "revoked";
export type Invitation = {
  id: string;
  team: string;
  owner: string;
  recipient: string;
  role: "Editor" | "Viewer";
  state: State;
  pod: string;
  project: string;
  title: string;
};
const selectInvites =
  "SELECT i.id,i.team,t.owner,i.recipient,i.role,i.state,t.pod,t.project,t.title FROM invites i JOIN teams t ON i.team=t.id ";
let database: DatabaseSync | undefined;
function db() {
  if (database) return database;
  const path = resolve(
    process.env.COLLABPOD_DB || ".data/collaboration.sqlite",
  );
  mkdirSync(dirname(path), { recursive: true });
  const connection = new DatabaseSync(path);
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY,owner TEXT NOT NULL,pod TEXT NOT NULL,project TEXT NOT NULL,title TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,UNIQUE(owner,pod,project));
    CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,team TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,recipient TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('Editor','Viewer')),state TEXT NOT NULL CHECK(state IN ('pending','accepted','declined','revoked')),UNIQUE(team,recipient));
    CREATE INDEX IF NOT EXISTS recipient_inbox ON invites(recipient,state);`);
  database = connection;
  return connection;
}
export function teamFor(owner: string, pod: string, project: string) {
  return db()
    .prepare("SELECT * FROM teams WHERE owner=? AND pod=? AND project=?")
    .get(owner, pod, project) as Row | undefined;
}
export function register(
  owner: string,
  pod: string,
  project: string,
  title: string,
) {
  db()
    .prepare(
      "INSERT INTO teams(id,owner,pod,project,title) VALUES(?,?,?,?,?) ON CONFLICT(owner,pod,project) DO UPDATE SET title=excluded.title",
    )
    .run(randomUUID(), owner, pod, project, title);
  return teamFor(owner, pod, project)!;
}
export function inbox(actor: string) {
  return db()
    .prepare(
      selectInvites +
        "WHERE i.recipient=? AND i.state IN ('accepted','pending') ORDER BY i.rowid DESC",
    )
    .all(actor) as Invitation[];
}
export function teamRoster(
  actor: string,
  owner: string,
  pod: string,
  project: string,
) {
  const team = teamFor(owner, pod, project);
  if (!team) return [];
  const entries = db()
    .prepare(
      selectInvites + "WHERE i.team=? AND i.state IN ('accepted','pending')",
    )
    .all(team.id) as Invitation[];
  if (actor === owner) return entries;
  if (!entries.some((i) => i.recipient === actor && i.state === "accepted"))
    return [];
  return entries.filter((i) => i.state === "accepted");
}
export function groupMembers(team: string, role: string) {
  return db()
    .prepare(
      "SELECT recipient FROM invites WHERE team=? AND role=? AND state='accepted'",
    )
    .all(team, role)
    .map((row: any) => String(row.recipient));
}
export function offer(team: Row, recipient: string, role: Invitation["role"]) {
  if (recipient === team.owner)
    throw new CollaborationError(409, "Pemilik sudah memiliki akses.");
  const changed = db()
    .prepare(
      `INSERT INTO invites(id,team,recipient,role,state) VALUES (?,?,?,?,'pending')
    ON CONFLICT(team,recipient) DO UPDATE SET id=excluded.id,role=excluded.role,state='pending' WHERE invites.state IN ('declined','revoked')`,
    )
    .run(randomUUID(), team.id, recipient, role);
  if (!changed.changes)
    throw new CollaborationError(
      409,
      "Teman ini sudah menjadi anggota atau memiliki undangan aktif.",
    );
  db().prepare("UPDATE teams SET verified=1 WHERE id=?").run(team.id);
}
export function respond(
  actor: string,
  id: string,
  state: "accepted" | "declined",
  expectedRole?: Invitation["role"],
) {
  const result = db()
    .prepare(
      "UPDATE invites SET state=? WHERE id=? AND recipient=? AND state='pending' AND (? IS NULL OR role=?)",
    )
    .run(state, id, actor, expectedRole ?? null, expectedRole ?? null);
  if (
    !result.changes &&
    !db()
      .prepare("SELECT 1 FROM invites WHERE id=? AND recipient=? AND state=?")
      .get(id, actor, state)
  )
    throw new CollaborationError(
      409,
      "Undangan sudah berubah atau tidak tersedia untuk akun ini.",
    );
}
export function manage(actor: string, id: string, role?: Invitation["role"]) {
  const where =
    " WHERE id=? AND team IN (SELECT id FROM teams WHERE owner=?) AND state IN ('pending','accepted')";
  const changed = role
    ? db()
        .prepare("UPDATE invites SET role=?" + where)
        .run(role, id, actor)
    : db()
        .prepare("UPDATE invites SET state='revoked'" + where)
        .run(id, actor);
  if (!changed.changes)
    throw new CollaborationError(409, "Anggota atau undangan sudah berubah.");
}
export function closeTeam(owner: string, pod: string, project: string) {
  db()
    .prepare("DELETE FROM teams WHERE owner=? AND pod=? AND project=?")
    .run(owner, pod, project);
}
