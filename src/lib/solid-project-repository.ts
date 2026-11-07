"use client";

import type { IProjectRepository } from "@/lib/project-storage";
import type { CreateProjectInput, Project } from "@/types/project";

/**
 * Repositori proyek Solid: menulis workspace proyek privat ke Pod terpilih.
 *
 * Struktur di Pod pemilik:
 *   {pod}/collabpod/                                  kontainer aplikasi (privat, WAC default)
 *   {pod}/collabpod/project-index.ttl                 indeks proyek milik pengguna
 *   {pod}/collabpod/projects/{id}/                    workspace proyek
 *   {pod}/collabpod/projects/{id}/config/project.ttl  metadata proyek
 */

const CPD = "https://collabpod.ai/ns#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const COLLABPOD_SEGMENT = "collabpod";
const PROJECTS_SEGMENT = "projects";
const CONFIG_SEGMENT = "config";
const METADATA_FILE = "project.ttl";
const INDEX_FILE = "project-index.ttl";

type SolidClient = typeof import("@inrupt/solid-client");

let solidClientPromise: Promise<SolidClient> | null = null;

function loadSolidClient(): Promise<SolidClient> {
  if (!solidClientPromise) {
    solidClientPromise = import("@inrupt/solid-client");
  }
  return solidClientPromise;
}

/** Pastikan Pod selalu berbentuk kontainer dengan garis miring akhir. */
export function normalizePodUrl(podUrl: string): string {
  return `${podUrl.trim().replace(/\/+$/, "")}/`;
}

function splitSegments(segments: string[]): string[] {
  return segments
    .flatMap((segment) => segment.split("/"))
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/**
 * Gabungkan URL kontainer relatif terhadap Pod terpilih. Path dasar Pod
 * (mis. https://host/andi/) dan garis miring akhir tetap dipertahankan.
 */
export function podContainerUrl(podUrl: string, ...segments: string[]): string {
  const base = normalizePodUrl(podUrl);
  const parts = splitSegments(segments);
  return parts.length === 0 ? base : `${base}${parts.join("/")}/`;
}

/** URL resource (berkas) di dalam Pod terpilih. */
export function podResourceUrl(podUrl: string, ...segments: string[]): string {
  const base = normalizePodUrl(podUrl);
  const parts = splitSegments(segments);
  return `${base}${parts.join("/")}`;
}

/** ID proyek stabil: dipakai ulang saat percobaan ulang agar tidak ada duplikat. */
export function createProjectId(): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `prj-${Date.now().toString(36)}-${suffix}`;
}

export type SolidProjectStep =
  | "prepare-workspace"
  | "prepare-permissions"
  | "write-metadata"
  | "read-metadata"
  | "write-index"
  | "read-index";

export const SOLID_PROJECT_STEP_LABEL: Record<SolidProjectStep, string> = {
  "prepare-workspace": "membuat kontainer workspace di Pod",
  "prepare-permissions": "menyiapkan izin WAC privat untuk pemilik",
  "write-metadata": "menulis metadata proyek",
  "read-metadata": "membaca kembali metadata proyek",
  "write-index": "memperbarui indeks proyek",
  "read-index": "membaca kembali indeks proyek",
};

export class SolidProjectError extends Error {
  readonly step: SolidProjectStep;

  constructor(step: SolidProjectStep, cause?: unknown) {
    super(`Gagal ${SOLID_PROJECT_STEP_LABEL[step]}.`);
    this.name = "SolidProjectError";
    this.step = step;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/** Ringkasan kegagalan untuk ditampilkan di dialog. */
export function describeSolidProjectError(error: unknown): {
  stepLabel: string;
  message: string;
} {
  if (error instanceof SolidProjectError) {
    const detail =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === "string"
          ? error.cause
          : null;
    return {
      stepLabel: `Gagal ${SOLID_PROJECT_STEP_LABEL[error.step]}.`,
      message: detail?.trim() || error.message,
    };
  }

  return {
    stepLabel: "Penyimpanan proyek ke Pod gagal.",
    message: error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.",
  };
}

export interface SolidProjectContext {
  /** URL Pod terpilih, apa adanya dari profil Solid pengguna. */
  podUrl: string;
  /** WebID pemilik workspace, dari sesi Solid aktif. */
  webId: string;
  /** `session.fetch` dari sesi Solid aktif. */
  fetch: typeof fetch;
  /** Sumber ID proyek; dapat diganti agar percobaan ulang stabil. */
  idFactory?: () => string;
}

interface ProjectMetadata {
  projectId: string;
  metadataUrl: string;
  name: string;
  description: string;
  ownerWebId: string;
  createdAt: string;
}

export class SolidPodProjectRepository implements IProjectRepository {
  private readonly podUrl: string;
  private readonly webId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly idFactory: () => string;

  constructor(context: SolidProjectContext) {
    this.podUrl = normalizePodUrl(context.podUrl);
    this.webId = context.webId;
    this.fetchImpl = context.fetch;
    this.idFactory = context.idFactory ?? createProjectId;
  }

  /**
   * Baca sebuah proyek Solid yang sudah ada dari Pod terpilih.
   *
   * Langkah ini hanya membaca: indeks Pod dicari untuk menemukan metadata URL
   * proyek yang diminta, lalu project.ttl dibaca dengan `session.fetch` sesi
   * aktif. ID proyek adalah konteks Pod terpilih dan sesi aktif pengguna.
   *
   * Kegagalan dibedakan secara operasional:
   * - `SolidProjectNotFoundError`: ID tidak tercantum di indeks Pod.
   * - `SolidProjectAccessDeniedError`: server menolak pembacaan metadata.
   * - `SolidProjectError`: kegagalan baca lain (loopback, parsing, dll.).
   */
  async openProject(
    projectId: string
  ): Promise<{
    project: Project;
    metadataUrl: string;
    podUrl: string;
  }> {
    const { getSolidDataset, getThing, getUrlAll } = await loadSolidClient();

    // 1) Cari referensi proyek di indeks Pod terpilih. Hanya membaca.
    let indexDataset;
    try {
      indexDataset = await getSolidDataset(this.indexUrl, {
        fetch: this.fetchImpl,
      });
    } catch (error) {
      const status = httpStatusOf(error);
      if (status === 404 || status === 410) {
        // Indeks belum ada berarti belum ada proyek yang tercatat.
        throw new SolidProjectNotFoundError(projectId);
      }
      if (status === 401 || status === 403) {
        throw new SolidProjectAccessDeniedError(projectId, this.indexUrl, status);
      }
      throw new SolidProjectError("read-index", error);
    }

    const indexThing = getThing(indexDataset, `${this.indexUrl}#index`);
    const metadataUrls = indexThing
      ? getUrlAll(indexThing, `${CPD}project`)
      : [];

    // Referensi dicocokkan lewat ID pada URL metadata, bukan ditebak.
    const metadataUrl = metadataUrls.find(
      (url) => projectIdFromMetadataUrl(url) === projectId
    );

    if (!metadataUrl) {
      throw new SolidProjectNotFoundError(projectId);
    }

    // 2) Baca config/project.ttl memakai sesi aktif. Tidak ada penulisan.
    let metadata: ProjectMetadata;
    try {
      metadata = await this.readProjectMetadata(metadataUrl);
    } catch (error) {
      const status = httpStatusOf(error);
      if (status === 401 || status === 403) {
        throw new SolidProjectAccessDeniedError(projectId, metadataUrl, status);
      }
      if (status === 404 || status === 410) {
        throw new SolidProjectNotFoundError(projectId);
      }
      throw error;
    }

    return {
      project: this.toProject(metadata),
      metadataUrl: metadata.metadataUrl,
      podUrl: this.podUrl,
    };
  }

  get indexUrl(): string {
    return podResourceUrl(this.podUrl, COLLABPOD_SEGMENT, INDEX_FILE);
  }

  /** Metadata URL untuk ID tertentu (dipakai dialog sebagai pratinjau tujuan). */
  metadataUrlFor(projectId: string): string {
    return podResourceUrl(
      this.podUrl,
      COLLABPOD_SEGMENT,
      PROJECTS_SEGMENT,
      projectId,
      CONFIG_SEGMENT,
      METADATA_FILE
    );
  }

  private projectContainerUrl(projectId: string): string {
    return podContainerUrl(
      this.podUrl,
      COLLABPOD_SEGMENT,
      PROJECTS_SEGMENT,
      projectId
    );
  }

  async listProjects(): Promise<Project[]> {
    const { getSolidDataset, getThing, getUrlAll } = await loadSolidClient();

    if (!(await this.resourceExists(this.indexUrl))) {
      // Indeks belum ada berarti belum ada proyek — bukan kegagalan baca.
      return [];
    }

    let indexDataset;
    try {
      indexDataset = await getSolidDataset(this.indexUrl, { fetch: this.fetchImpl });
    } catch (error) {
      throw new SolidProjectError("read-index", error);
    }

    const indexThing = getThing(indexDataset, `${this.indexUrl}#index`);
    const metadataUrls = indexThing ? getUrlAll(indexThing, `${CPD}project`) : [];

    const projects: Project[] = [];
    for (const metadataUrl of metadataUrls) {
      const metadata = await this.readProjectMetadata(metadataUrl);
      projects.push(this.toProject(metadata));
    }

    return projects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const { createSolidDataset, createThing, setThing, setUrl, setStringNoLocale, setDatetime, addUrl, saveSolidDatasetAt, getSolidDataset, getThing, getStringNoLocale, getUrlAll } =
      await loadSolidClient();

    const projectId = input.projectId?.trim() || this.idFactory();
    const metadataUrl = this.metadataUrlFor(projectId);
    const projectContainerUrl = this.projectContainerUrl(projectId);
    const configContainerUrl = podContainerUrl(
      this.podUrl,
      COLLABPOD_SEGMENT,
      PROJECTS_SEGMENT,
      projectId,
      CONFIG_SEGMENT
    );

    await this.runStep("prepare-workspace", async () => {
      await this.ensureContainer(podContainerUrl(this.podUrl, COLLABPOD_SEGMENT));
      await this.ensureContainer(
        podContainerUrl(this.podUrl, COLLABPOD_SEGMENT, PROJECTS_SEGMENT)
      );
      await this.ensureContainer(projectContainerUrl);
      await this.ensureContainer(configContainerUrl);
    });

    // Izin ditulis sebelum metadata: kontainer aplikasi memakai acl:default
    // sehingga project.ttl dan resource turunannya privat untuk pemilik.
    await this.runStep("prepare-permissions", async () => {
      await this.makePrivateToOwner(podContainerUrl(this.podUrl, COLLABPOD_SEGMENT));
      await this.makePrivateToOwner(projectContainerUrl);
    });

    const createdAt = new Date().toISOString();

    await this.runStep("write-metadata", async () => {
      let dataset = createSolidDataset();
      let thing = createThing({ name: projectId });
      thing = setUrl(thing, RDF_TYPE, `${CPD}Project`);
      thing = setStringNoLocale(thing, `${CPD}id`, projectId);
      thing = setStringNoLocale(thing, `${CPD}name`, input.name.trim());
      thing = setStringNoLocale(
        thing,
        `${CPD}description`,
        input.description.trim()
      );
      thing = setUrl(thing, `${CPD}owner`, this.webId);
      thing = setDatetime(thing, `${CPD}createdAt`, new Date(createdAt));
      thing = addUrl(thing, `${CPD}projectContainer`, projectContainerUrl);
      dataset = setThing(dataset, thing);

      await saveSolidDatasetAt(metadataUrl, dataset, { fetch: this.fetchImpl });
    });

    const metadata = await this.runStep("read-metadata", async () => {
      const savedDataset = await getSolidDataset(metadataUrl, {
        fetch: this.fetchImpl,
      });
      const savedThing = getThing(savedDataset, `${metadataUrl}#${projectId}`);

      if (!savedThing) {
        throw new Error("Metadata proyek tidak ditemukan setelah disimpan.");
      }
      if (getStringNoLocale(savedThing, `${CPD}name`) !== input.name.trim()) {
        throw new Error("Nama proyek pada metadata tidak sesuai setelah dibaca.");
      }

      return this.readProjectMetadata(metadataUrl);
    });

    // Referensi ke indeks privat hanya ditambahkan setelah metadata terbaca.
    await this.runStep("write-index", async () => {
      const indexExists = await this.resourceExists(this.indexUrl);
      let indexDataset = createSolidDataset();
      if (indexExists) {
        indexDataset = await getSolidDataset(this.indexUrl, {
          fetch: this.fetchImpl,
        });
      }

      const indexSubject = `${this.indexUrl}#index`;
      let indexThing = getThing(indexDataset, indexSubject);
      if (!indexThing) {
        indexThing = createThing({ url: indexSubject });
      }

      const existingMetadataUrls = getUrlAll(indexThing, `${CPD}project`);
      if (!existingMetadataUrls.includes(metadataUrl)) {
        indexThing = addUrl(indexThing, `${CPD}project`, metadataUrl);
      }
      indexThing = setUrl(indexThing, `${CPD}owner`, this.webId);

      indexDataset = setThing(indexDataset, indexThing);
      await saveSolidDatasetAt(this.indexUrl, indexDataset, {
        fetch: this.fetchImpl,
      });
    });

    await this.runStep("read-index", async () => {
      const savedIndex = await getSolidDataset(this.indexUrl, {
        fetch: this.fetchImpl,
      });
      const savedIndexThing = getThing(savedIndex, `${this.indexUrl}#index`);
      const references = savedIndexThing
        ? getUrlAll(savedIndexThing, `${CPD}project`)
        : [];
      if (!references.includes(metadataUrl)) {
        throw new Error("Referensi proyek tidak ditemukan pada indeks setelah disimpan.");
      }
    });

    return this.toProject(metadata);
  }

  private async readProjectMetadata(metadataUrl: string): Promise<ProjectMetadata> {
    const { getSolidDataset, getThingAll, getStringNoLocale, getUrl, getDatetime, getUrlAll } =
      await loadSolidClient();

    let dataset;
    try {
      dataset = await getSolidDataset(metadataUrl, { fetch: this.fetchImpl });
    } catch (error) {
      throw new SolidProjectError("read-metadata", error);
    }

    const thing = getThingAll(dataset).find(
      (candidate) => getStringNoLocale(candidate, `${CPD}name`) !== null
    );

    if (!thing) {
      throw new SolidProjectError(
        "read-metadata",
        new Error("Metadata proyek tidak memuat nama proyek.")
      );
    }

    const projectId =
      getStringNoLocale(thing, `${CPD}id`) ??
      metadataUrl.split("/projects/")[1]?.split("/")[0] ??
      metadataUrl;
    const createdAtIso =
      getDatetime(thing, `${CPD}createdAt`)?.toISOString() ??
      new Date(0).toISOString();
    const ownerWebId =
      getUrl(thing, `${CPD}owner`) ??
      getUrlAll(thing, `${CPD}owner`)[0] ??
      this.webId;

    return {
      projectId,
      metadataUrl,
      name: getStringNoLocale(thing, `${CPD}name`) ?? projectId,
      description: getStringNoLocale(thing, `${CPD}description`) ?? "",
      ownerWebId,
      createdAt: createdAtIso,
    };
  }

  private toProject(metadata: ProjectMetadata): Project {
    const ownerName = ownerNameFromWebId(metadata.ownerWebId);
    const isOwner = metadata.ownerWebId === this.webId;

    return {
      id: metadata.projectId,
      name: metadata.name,
      description: metadata.description || "Tidak ada deskripsi proyek.",
      currentUserRole: isOwner ? "Owner" : "Viewer",
      ownerName,
      ownerWebId: metadata.ownerWebId,
      members: [
        {
          id: `${metadata.projectId}-owner`,
          name: ownerName,
          role: "Owner",
          webId: metadata.ownerWebId,
        },
      ],
      updatedAt: formatCreatedAt(metadata.createdAt),
      documentCount: 0,
      isDemo: false,
      metadataUrl: metadata.metadataUrl,
      podUrl: this.podUrl,
    };
  }

  private async runStep<T>(
    step: SolidProjectStep,
    action: () => Promise<T>
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof SolidProjectError) {
        throw error;
      }
      throw new SolidProjectError(step, error);
    }
  }

  private async resourceExists(url: string): Promise<boolean> {
    const { getResourceInfo } = await loadSolidClient();
    try {
      await getResourceInfo(url, { fetch: this.fetchImpl });
      return true;
    } catch {
      return false;
    }
  }

  private async ensureContainer(url: string): Promise<void> {
    const { createContainerAt } = await loadSolidClient();
    if (await this.resourceExists(url)) {
      return;
    }
    await createContainerAt(url, { fetch: this.fetchImpl });
  }

  /**
   * Tulis ACL khusus resource aplikasi: hanya WebID pemilik yang boleh
   * membaca/menulis, dan izin yang sama menjadi default untuk turunannya.
   * ACL root Pod tidak disentuh.
   */
  private async makePrivateToOwner(url: string): Promise<void> {
    const {
      getResourceInfoWithAcl,
      hasAccessibleAcl,
      createAcl,
      setAgentResourceAccess,
      setAgentDefaultAccess,
      setPublicResourceAccess,
      setPublicDefaultAccess,
      saveAclFor,
    } = await loadSolidClient();

    const resourceInfo = await getResourceInfoWithAcl(url, {
      fetch: this.fetchImpl,
    });

    if (!hasAccessibleAcl(resourceInfo)) {
      throw new Error(
        "Server Pod tidak mengizinkan pengaturan ACL pada resource ini."
      );
    }

    const ownerAccess = { read: true, append: true, write: true, control: true };
    const noAccess = { read: false, append: false, write: false, control: false };

    let acl = createAcl(resourceInfo);
    acl = setAgentResourceAccess(acl, this.webId, ownerAccess);
    acl = setAgentDefaultAccess(acl, this.webId, ownerAccess);
    acl = setPublicResourceAccess(acl, noAccess);
    acl = setPublicDefaultAccess(acl, noAccess);

    await saveAclFor(resourceInfo, acl, { fetch: this.fetchImpl });
  }
}

/** Ambil ID proyek dari URL metadata .../projects/{id}/config/project.ttl. */
function projectIdFromMetadataUrl(metadataUrl: string): string | null {
  try {
    const segments = new URL(metadataUrl).pathname.split("/").filter(Boolean);
    const last = segments.length - 1;
    if (
      last < 2 ||
      segments[last] !== METADATA_FILE ||
      segments[last - 1] !== CONFIG_SEGMENT
    ) {
      return null;
    }
    return decodeURIComponent(segments[last - 2]);
  } catch {
    return null;
  }
}

/** Status HTTP dari error fetch (termasuk yang dibungkus SolidProjectError). */
function httpStatusOf(error: unknown): number | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current !== "object") return undefined;
    const candidate = current as {
      statusCode?: unknown;
      status?: unknown;
      response?: { status?: unknown };
      cause?: unknown;
    };
    if (typeof candidate.statusCode === "number") return candidate.statusCode;
    if (typeof candidate.status === "number") return candidate.status;
    if (typeof candidate.response?.status === "number") {
      return candidate.response.status;
    }
    current = candidate.cause;
  }
  return undefined;
}

function ownerNameFromWebId(webId: string): string {
  try {
    const url = new URL(webId);
    const pathSegment = url.pathname.split("/").filter(Boolean)[0];
    return pathSegment ?? url.hostname;
  } catch {
    return "Pemilik Pod";
  }
}

export function formatCreatedAt(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Baru saja";
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Error spesifik: proyek dengan ID tersebut tidak ditemukan di indeks Pod
 * terpilih. Berbeda dari kegagalan baca yang disebabkan server (mis. akses
 * ditolak).
 */
export class SolidProjectNotFoundError extends Error {
  readonly projectId: string;

  constructor(projectId: string) {
    super(`Proyek "${projectId}" tidak ditemukan di Pod ini.`);
    this.name = "SolidProjectNotFoundError";
    this.projectId = projectId;
  }
}

/**
 * Error spesifik: server menolak pembacaan metadata (mis. 401/403).
 * Berbeda dari ID yang tidak tercantum di indeks.
 */
export class SolidProjectAccessDeniedError extends Error {
  readonly projectId: string;
  readonly metadataUrl: string;
  readonly serverStatus?: number;

  constructor(
    projectId: string,
    metadataUrl: string,
    serverStatus?: number
  ) {
    super(
      `Akses metadata proyek ditolak oleh server (${serverStatus ?? "tak diketahui"}).`
    );
    this.name = "SolidProjectAccessDeniedError";
    this.projectId = projectId;
    this.metadataUrl = metadataUrl;
    this.serverStatus = serverStatus;
  }
}
