import type { ProjectRole } from "../types/project.ts";
import type {
  CollectionName,
  WorkspaceCollection,
  WorkspaceData,
  WorkspaceRepository,
} from "../types/workspace.ts";
import { EMPTY_WORKSPACE } from "../types/workspace.ts";

const CP = "https://collabpod.ai/ns#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const LDP = "http://www.w3.org/ns/ldp#contains";
const collections: CollectionName[] = [
  "threads",
  "messages",
  "decisions",
  "tasks",
];
const fields = [
  "id",
  "title",
  "description",
  "createdAt",
  "updatedAt",
  "createdBy",
  "threadId",
  "messageId",
  "role",
  "content",
  "assignee",
  "status",
  "includeInContext",
  "archived",
  "sources",
  "active",
  "demoReply",
] as const;
const bools = new Set(["includeInContext", "archived", "active", "demoReply"]);

export class WorkspaceError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "WorkspaceError";
    this.status = status;
  }
}
export function assertWorkspaceWrite(role: ProjectRole): void {
  if (role === "Viewer")
    throw new WorkspaceError(
      "Akun Viewer hanya dapat membaca ruang kerja bersama.",
      403,
    );
}
export function isAccessError(error: unknown): boolean {
  const e = error as { status?: number; statusCode?: number; cause?: unknown };
  return (
    e?.status === 401 ||
    e?.status === 403 ||
    e?.statusCode === 401 ||
    e?.statusCode === 403 ||
    (!!e?.cause && isAccessError(e.cause))
  );
}
function safeId(id: string): string {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id))
    throw new WorkspaceError("ID resource tidak valid.");
  return id;
}
function checkResponse(response: Response): void {
  if (response.ok) return;
  if (response.status === 412)
    throw new WorkspaceError(
      "Data telah diubah anggota lain. Muat ulang sebelum menyimpan kembali.",
      412,
    );
  if ([401, 403].includes(response.status))
    throw new WorkspaceError(
      "Akses Pod ditolak. Sesi atau izin proyek telah berubah.",
      response.status,
    );
  throw new WorkspaceError(
    `Pod gagal merespons (HTTP ${response.status}).`,
    response.status,
  );
}

/** One RDF resource per thread, message, decision and task. No shared append-only array. */
export class SolidWorkspaceRepository implements WorkspaceRepository {
  readonly mode = "solid" as const;
  readonly role: ProjectRole;
  readonly workspaceUrl: string;
  private readonly fetchImpl: typeof fetch;
  constructor(options: {
    workspaceUrl: string;
    role: ProjectRole;
    fetch: typeof fetch;
  }) {
    this.workspaceUrl = options.workspaceUrl.replace(/\/?$/, "/");
    this.role = options.role;
    this.fetchImpl = options.fetch;
  }
  private url(collection: CollectionName, id?: string): string {
    return `${this.workspaceUrl}data/${collection}/${id ? `${safeId(id)}.ttl` : ""}`;
  }
  private async list<K extends CollectionName>(
    collection: K,
  ): Promise<WorkspaceCollection[K][]> {
    const solid = await import("@inrupt/solid-client");
    const url = this.url(collection);
    const fetchFresh: typeof fetch = (input, init) =>
      this.fetchImpl(input, { ...init, cache: "no-store" });
    let dataset;
    try {
      dataset = await solid.getSolidDataset(url, { fetch: fetchFresh });
    } catch (error) {
      const e = error as { statusCode?: number };
      if (e.statusCode === 404 || e.statusCode === 410) return [];
      throw error;
    }
    const container = solid.getThing(dataset, url);
    const urls = container ? solid.getUrlAll(container, LDP) : [];
    const items: WorkspaceCollection[K][] = [];
    // Bounded parallelism keeps small public Pods responsive. Errors are never converted into empty data.
    for (let start = 0; start < urls.length; start += 6) {
      const group = urls
        .slice(start, start + 6)
        .filter(
          (itemUrl) =>
            itemUrl.startsWith(url) &&
            /^[a-zA-Z0-9_-]+\.ttl$/.test(itemUrl.slice(url.length)),
        );
      const read = await Promise.all(
        group.map(async (itemUrl) => {
          let etag: string | undefined;
          const data = await solid.getSolidDataset(itemUrl, {
            fetch: async (input, init) => {
              const response = await fetchFresh(input, init);
              etag = response.headers.get("etag") ?? undefined;
              return response;
            },
          });
          const thing = solid.getThing(data, `${itemUrl}#item`);
          if (!thing)
            throw new WorkspaceError("Resource ruang kerja tidak valid.");
          const record: Record<string, unknown> = {};
          for (const field of fields) {
            const text = solid.getStringNoLocale(thing, `${CP}${field}`);
            if (text === null) continue;
            record[field] = bools.has(field)
              ? text === "true"
              : field === "sources"
                ? JSON.parse(text)
                : text;
          }
          if (
            typeof record.id !== "string" ||
            itemUrl !== this.url(collection, record.id)
          )
            throw new WorkspaceError("ID resource ruang kerja tidak sesuai.");
          if (
            typeof record.createdAt !== "string" ||
            typeof record.createdBy !== "string"
          )
            throw new WorkspaceError("Metadata ruang kerja tidak lengkap.");
          return { ...record, etag } as unknown as WorkspaceCollection[K];
        }),
      );
      items.push(...read);
    }
    return items.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  }
  async read(): Promise<WorkspaceData> {
    const [threads, messages, decisions, tasks] = await Promise.all(
      collections.map((name) => this.list(name)),
    );
    return { threads, messages, decisions, tasks } as WorkspaceData;
  }
  async put<K extends CollectionName>(
    collection: K,
    item: WorkspaceCollection[K],
    create = false,
  ): Promise<void> {
    assertWorkspaceWrite(this.role);
    const solid = await import("@inrupt/solid-client");
    const url = this.url(collection, item.id);
    // Strong preconditions avoid silently overwriting a teammate's edit.
    if (!create && (!item.etag || item.etag.startsWith("W/"))) {
      throw new WorkspaceError(
        "Pod belum menyediakan strong ETag untuk pembaruan aman. Periksa konfigurasi server dan CORS ETag.",
      );
    }
    if (create) {
      for (const containerUrl of [
        `${this.workspaceUrl}data/`,
        this.url(collection),
      ]) {
        const check = await this.fetchImpl(containerUrl, {
          method: "HEAD",
          cache: "no-store",
        });
        if (check.status === 404 || check.status === 410) {
          try {
            await solid.createContainerAt(containerUrl, {
              fetch: this.fetchImpl,
            });
          } catch (error) {
            if (
              ![409, 412].includes(
                (error as { statusCode?: number }).statusCode ?? 0,
              )
            )
              throw error;
          }
        } else {
          checkResponse(check);
        }
      }
    }
    let thing = solid.createThing({ url: `${url}#item` });
    thing = solid.setUrl(thing, RDF, `${CP}${collection}`);
    thing = solid.setUrl(thing, `${CP}workspace`, this.workspaceUrl);
    for (const field of fields) {
      const value = (item as unknown as Record<string, unknown>)[field];
      if (value !== undefined)
        thing = solid.setStringNoLocale(
          thing,
          `${CP}${field}`,
          field === "sources" ? JSON.stringify(value) : String(value),
        );
    }
    const body = await solid.solidDatasetAsTurtle(
      solid.setThing(solid.createSolidDataset(), thing),
    );
    const response = await this.fetchImpl(url, {
      method: "PUT",
      headers: {
        "Content-Type": "text/turtle",
        ...(create ? { "If-None-Match": "*" } : { "If-Match": item.etag! }),
      },
      body,
    });
    checkResponse(response);
  }
}

/** Demo is explicitly browser-local; never substitutes for a failed Solid request. */
export class DemoWorkspaceRepository implements WorkspaceRepository {
  readonly mode = "demo" as const;
  readonly role = "Owner" as const;
  private readonly key: string;
  private readonly seed: WorkspaceData;
  constructor(key: string, seed: WorkspaceData) {
    this.key = key;
    this.seed = seed;
  }
  async read(): Promise<WorkspaceData> {
    const data = localStorage.getItem(this.key);
    if (data) return JSON.parse(data) as WorkspaceData;
    localStorage.setItem(this.key, JSON.stringify(this.seed));
    return structuredClone(this.seed);
  }
  async put<K extends CollectionName>(
    collection: K,
    item: WorkspaceCollection[K],
    create = false,
  ): Promise<void> {
    const data = await this.read();
    const list = data[collection] as WorkspaceCollection[K][];
    const index = list.findIndex((existing) => existing.id === item.id);
    if (create && index !== -1)
      throw new WorkspaceError("Resource sudah ada.", 412);
    if (!create && (index === -1 || list[index].updatedAt !== item.etag))
      throw new WorkspaceError(
        "Data demo berubah di tab lain. Muat ulang.",
        412,
      );
    const next = { ...item, etag: item.updatedAt };
    if (index < 0) list.push(next);
    else list[index] = next;
    localStorage.setItem(this.key, JSON.stringify(data));
  }
}
export function emptyWorkspace(): WorkspaceData {
  return structuredClone(EMPTY_WORKSPACE);
}
