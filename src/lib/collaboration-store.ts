import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

function postgresUrl(): string {
  // Explicit COLLABPOD_DB (mis. saat test:collaboration) tetap memakai SQLite lokal.
  if (process.env.COLLABPOD_DB?.trim()) return "";
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

type NeonClient = NeonQueryFunction<false, false>;
let pgClient: NeonClient | undefined;
let pgSchemaPromise: Promise<void> | undefined;

async function pg(): Promise<NeonClient> {
  if (!pgClient) {
    pgClient = neon(postgresUrl());
  }
  if (!pgSchemaPromise) {
    pgSchemaPromise = (async () => {
      await pgClient!`CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        pod TEXT NOT NULL,
        project TEXT NOT NULL,
        title TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        UNIQUE(owner, pod, project)
      )`;
      await pgClient!`CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY,
        team TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        recipient TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Editor', 'Viewer')),
        state TEXT NOT NULL CHECK(state IN ('pending', 'accepted', 'declined', 'revoked')),
        seq BIGSERIAL,
        UNIQUE(team, recipient)
      )`;
      await pgClient!`CREATE INDEX IF NOT EXISTS recipient_inbox ON invites(recipient, state)`;
    })().catch((err) => {
      pgSchemaPromise = undefined;
      throw err;
    });
  }
  await pgSchemaPromise;
  return pgClient;
}

type SqliteDb = import("node:sqlite").DatabaseSync;
let sqliteDb: SqliteDb | undefined;

async function sqlite(): Promise<SqliteDb> {
  if (sqliteDb) return sqliteDb;
  const { DatabaseSync } = await import("node:sqlite");
  const path = resolve(
    process.env.COLLABPOD_DB || ".data/collaboration.sqlite",
  );
  mkdirSync(dirname(path), { recursive: true });
  const connection = new DatabaseSync(path);
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY,owner TEXT NOT NULL,pod TEXT NOT NULL,project TEXT NOT NULL,title TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,UNIQUE(owner,pod,project));
    CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,team TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,recipient TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('Editor','Viewer')),state TEXT NOT NULL CHECK(state IN ('pending','accepted','declined','revoked')),UNIQUE(team,recipient));
    CREATE INDEX IF NOT EXISTS recipient_inbox ON invites(recipient,state);`);
  sqliteDb = connection;
  return connection;
}

export async function teamFor(
  owner: string,
  pod: string,
  project: string,
): Promise<Row | undefined> {
  if (postgresUrl()) {
    const sql = await pg();
    const rows = (await sql`SELECT id, owner, pod, project, title, verified FROM teams WHERE owner=${owner} AND pod=${pod} AND project=${project}`) as Row[];
    return rows[0];
  }
  return (await sqlite())
    .prepare("SELECT * FROM teams WHERE owner=? AND pod=? AND project=?")
    .get(owner, pod, project) as Row | undefined;
}

export async function register(
  owner: string,
  pod: string,
  project: string,
  title: string,
): Promise<Row> {
  if (postgresUrl()) {
    const sql = await pg();
    await sql`INSERT INTO teams(id, owner, pod, project, title)
      VALUES(${randomUUID()}, ${owner}, ${pod}, ${project}, ${title})
      ON CONFLICT(owner, pod, project) DO UPDATE SET title=EXCLUDED.title`;
    return (await teamFor(owner, pod, project))!;
  }
  (await sqlite())
    .prepare(
      "INSERT INTO teams(id,owner,pod,project,title) VALUES(?,?,?,?,?) ON CONFLICT(owner,pod,project) DO UPDATE SET title=excluded.title",
    )
    .run(randomUUID(), owner, pod, project, title);
  return (await teamFor(owner, pod, project))!;
}

export async function inbox(actor: string): Promise<Invitation[]> {
  if (postgresUrl()) {
    const sql = await pg();
    return (await sql`SELECT i.id, i.team, t.owner, i.recipient, i.role, i.state, t.pod, t.project, t.title
      FROM invites i
      JOIN teams t ON i.team = t.id
      WHERE i.recipient=${actor} AND i.state IN ('accepted', 'pending')
      ORDER BY i.seq DESC`) as Invitation[];
  }
  return (await sqlite())
    .prepare(
      selectInvites +
        "WHERE i.recipient=? AND i.state IN ('accepted','pending') ORDER BY i.rowid DESC",
    )
    .all(actor) as Invitation[];
}

export async function teamRoster(
  actor: string,
  owner: string,
  pod: string,
  project: string,
): Promise<Invitation[]> {
  const team = await teamFor(owner, pod, project);
  if (!team) return [];
  let entries: Invitation[];
  if (postgresUrl()) {
    const sql = await pg();
    entries = (await sql`SELECT i.id, i.team, t.owner, i.recipient, i.role, i.state, t.pod, t.project, t.title
      FROM invites i
      JOIN teams t ON i.team = t.id
      WHERE i.team=${team.id} AND i.state IN ('accepted', 'pending')`) as Invitation[];
  } else {
    entries = (await sqlite())
      .prepare(
        selectInvites + "WHERE i.team=? AND i.state IN ('accepted','pending')",
      )
      .all(team.id) as Invitation[];
  }
  if (actor === owner) return entries;
  if (!entries.some((i) => i.recipient === actor && i.state === "accepted"))
    return [];
  return entries.filter((i) => i.state === "accepted");
}

export async function groupMembers(
  team: string,
  role: string,
): Promise<string[]> {
  if (postgresUrl()) {
    const sql = await pg();
    const rows = (await sql`SELECT recipient FROM invites WHERE team=${team} AND role=${role} AND state='accepted'`) as {
      recipient: string;
    }[];
    return rows.map((row) => String(row.recipient));
  }
  return (await sqlite())
    .prepare(
      "SELECT recipient FROM invites WHERE team=? AND role=? AND state='accepted'",
    )
    .all(team, role)
    .map((row: any) => String(row.recipient));
}

export async function offer(
  team: Row,
  recipient: string,
  role: Invitation["role"],
): Promise<void> {
  if (recipient === team.owner)
    throw new CollaborationError(409, "Pemilik sudah memiliki akses.");
  if (postgresUrl()) {
    const sql = await pg();
    const updated = await sql`INSERT INTO invites(id, team, recipient, role, state)
      VALUES (${randomUUID()}, ${team.id}, ${recipient}, ${role}, 'pending')
      ON CONFLICT(team, recipient) DO UPDATE
      SET id=EXCLUDED.id, role=EXCLUDED.role, state='pending'
      WHERE invites.state IN ('declined', 'revoked')
      RETURNING id`;
    if (updated.length === 0)
      throw new CollaborationError(
        409,
        "Teman ini sudah menjadi anggota atau memiliki undangan aktif.",
      );
    await sql`UPDATE teams SET verified=1 WHERE id=${team.id}`;
    return;
  }
  const conn = await sqlite();
  const changed = conn
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
  conn.prepare("UPDATE teams SET verified=1 WHERE id=?").run(team.id);
}

export async function respond(
  actor: string,
  id: string,
  state: "accepted" | "declined",
  expectedRole?: Invitation["role"],
): Promise<void> {
  if (postgresUrl()) {
    const sql = await pg();
    const updated = await sql`UPDATE invites
      SET state=${state}
      WHERE id=${id} AND recipient=${actor} AND state='pending'
        AND (${expectedRole ?? null}::text IS NULL OR role=${expectedRole ?? null})
      RETURNING id`;
    if (updated.length === 0) {
      const already = await sql`SELECT 1 FROM invites WHERE id=${id} AND recipient=${actor} AND state=${state}`;
      if (already.length === 0)
        throw new CollaborationError(
          409,
          "Undangan sudah berubah atau tidak tersedia untuk akun ini.",
        );
    }
    return;
  }
  const conn = await sqlite();
  const result = conn
    .prepare(
      "UPDATE invites SET state=? WHERE id=? AND recipient=? AND state='pending' AND (? IS NULL OR role=?)",
    )
    .run(state, id, actor, expectedRole ?? null, expectedRole ?? null);
  if (
    !result.changes &&
    !conn
      .prepare("SELECT 1 FROM invites WHERE id=? AND recipient=? AND state=?")
      .get(id, actor, state)
  )
    throw new CollaborationError(
      409,
      "Undangan sudah berubah atau tidak tersedia untuk akun ini.",
    );
}

export async function manage(
  actor: string,
  id: string,
  role?: Invitation["role"],
): Promise<void> {
  if (postgresUrl()) {
    const sql = await pg();
    const updated = role
      ? await sql`UPDATE invites SET role=${role}
          WHERE id=${id} AND team IN (SELECT id FROM teams WHERE owner=${actor}) AND state IN ('pending', 'accepted')
          RETURNING id`
      : await sql`UPDATE invites SET state='revoked'
          WHERE id=${id} AND team IN (SELECT id FROM teams WHERE owner=${actor}) AND state IN ('pending', 'accepted')
          RETURNING id`;
    if (updated.length === 0)
      throw new CollaborationError(409, "Anggota atau undangan sudah berubah.");
    return;
  }
  const conn = await sqlite();
  const where =
    " WHERE id=? AND team IN (SELECT id FROM teams WHERE owner=?) AND state IN ('pending','accepted')";
  const changed = role
    ? conn.prepare("UPDATE invites SET role=?" + where).run(role, id, actor)
    : conn
        .prepare("UPDATE invites SET state='revoked'" + where)
        .run(id, actor);
  if (!changed.changes)
    throw new CollaborationError(409, "Anggota atau undangan sudah berubah.");
}

export async function closeTeam(
  owner: string,
  pod: string,
  project: string,
): Promise<void> {
  if (postgresUrl()) {
    const sql = await pg();
    await sql`DELETE FROM teams WHERE owner=${owner} AND pod=${pod} AND project=${project}`;
    return;
  }
  (await sqlite())
    .prepare("DELETE FROM teams WHERE owner=? AND pod=? AND project=?")
    .run(owner, pod, project);
}
