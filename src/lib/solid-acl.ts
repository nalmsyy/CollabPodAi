"use client";

import type { ProjectMember, ProjectRole } from "@/types/project";

/**
 * Pengelolaan anggota proyek berbasis Web Access Control (WAC).
 *
 * Izin yang diberikan saat mengundang anggota:
 * - kontainer `data/` (beserta turunannya): Viewer mendapat `Read`,
 *   Editor mendapat `Read, Write, Append`. Editor tidak pernah mendapat
 *   `Control`, sehingga tidak dapat mengubah ACL proyek.
 * - kontainer `config/` (beserta turunannya, termasuk `members.ttl` dan
 *   `project.ttl`): hanya `Read`, agar aplikasi dapat membaca metadata dan
 *   menentukan peran anggota. Anggota tidak bisa menulis konfigurasi.
 *
 * Daftar anggota yang diundang juga ditulis ke `config/members.ttl` supaya
 * aplikasi dapat merender daftar anggota beserta perannya. Pemilik tidak
 * disimpan di berkas ini — kepemilikan berasal dari `project.ttl`.
 */

const CPD = "https://collabpod.ai/ns#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const CONFIG_SEGMENT = "config";
const DATA_SEGMENT = "data";
export const MEMBERS_FILE_NAME = "members.ttl";

type SolidClient = typeof import("@inrupt/solid-client");
type AclDataset = import("@inrupt/solid-client").AclDataset;
type AccessRule = import("@inrupt/solid-client").Access;
type WithAccessibleAcl = import("@inrupt/solid-client").WithAccessibleAcl;
type ResourceInfoWithAcl = Awaited<
  ReturnType<SolidClient["getResourceInfoWithAcl"]>
>;

let solidClientPromise: Promise<SolidClient> | null = null;

function loadSolidClient(): Promise<SolidClient> {
  if (!solidClientPromise) {
    solidClientPromise = import("@inrupt/solid-client");
  }
  return solidClientPromise;
}

/** Peran yang dapat diberikan lewat undangan; Owner tidak dapat diundang. */
export type MemberRole = "Editor" | "Viewer";

export const MEMBER_ROLES: readonly MemberRole[] = ["Editor", "Viewer"] as const;

export interface StoredProjectMember {
  /** ID lokal untuk React; diturunkan dari WebID. */
  id: string;
  webId: string;
  role: MemberRole;
  addedAt: string | null;
}

export interface SolidAclContext {
  /** URL kontainer workspace proyek: {podUrl}/collabpod/projects/{projectId}/ */
  workspaceUrl: string;
  /** `session.fetch` dari sesi Solid aktif. */
  fetch: typeof fetch;
  /** WebID pemilik proyek (tidak wajib untuk membaca anggota). */
  ownerWebId?: string;
  /** Solid client untuk pengujian regresi. */
  client?: SolidClient;
}

export interface AddMemberInput extends SolidAclContext {
  webId: string;
  role: MemberRole;
}

export interface RemoveMemberInput extends SolidAclContext {
  webId: string;
}

export type SolidAclStep =
  | "validate-member"
  | "prepare-container"
  | "read-acl"
  | "write-acl"
  | "verify-acl"
  | "read-members"
  | "write-members"
  | "remove-member";

export const SOLID_ACL_STEP_LABEL: Record<SolidAclStep, string> = {
  "validate-member": "memvalidasi WebID anggota",
  "prepare-container": "menyiapkan kontainer data proyek di Pod",
  "read-acl": "membaca ACL proyek dari Pod",
  "write-acl": "menyimpan ACL proyek ke Pod",
  "verify-acl": "memverifikasi ACL proyek setelah disimpan",
  "read-members": "membaca daftar anggota proyek",
  "write-members": "menyimpan daftar anggota proyek",
  "remove-member": "mencabut akses anggota proyek",
};

export class SolidAclError extends Error {
  readonly step: SolidAclStep;

  constructor(step: SolidAclStep, cause?: unknown) {
    super(`Gagal ${SOLID_ACL_STEP_LABEL[step]}.`);
    this.name = "SolidAclError";
    this.step = step;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export class SolidAclAccessDeniedError extends Error {
  readonly resourceUrl: string;
  readonly status?: number;

  constructor(resourceUrl: string, status?: number) {
    super(
      `Akses ke pengaturan proyek ditolak oleh server Pod${
        status ? ` (HTTP ${status})` : ""
      }.`
    );
    this.name = "SolidAclAccessDeniedError";
    this.resourceUrl = resourceUrl;
    this.status = status;
  }
}

export function isSolidAclAccessDenied(error: unknown): boolean {
  if (error instanceof SolidAclAccessDeniedError) {
    return true;
  }
  const status = httpStatusOf(error);
  return status === 401 || status === 403;
}

/** Ringkasan kegagalan operasi anggota untuk ditampilkan di UI. */
export function describeSolidAclError(error: unknown): {
  stepLabel: string;
  message: string;
} {
  if (isSolidAclAccessDenied(error)) {
    return {
      stepLabel: "Akses Ditolak",
      message: "Anda tidak memiliki izin untuk mengubah anggota proyek ini.",
    };
  }

  if (error instanceof SolidAclError) {
    const detail =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === "string"
          ? error.cause
          : null;
    return {
      stepLabel: `Gagal ${SOLID_ACL_STEP_LABEL[error.step]}.`,
      message: summarizeDetail(detail) || error.message,
    };
  }

  return {
    stepLabel: "Operasi anggota proyek gagal.",
    message:
      summarizeDetail(error instanceof Error ? error.message : null) ||
      "Terjadi kesalahan tak terduga.",
  };
}

/** Pesan galat SDK bisa memuat dump dataset; ambil baris pertama saja. */
function summarizeDetail(detail: string | null): string {
  if (!detail) return "";
  const firstLine = detail.split(/\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  return firstLine.length > 240 ? `${firstLine.slice(0, 237)}...` : firstLine;
}

export function normalizeWorkspaceUrl(url: string): string {
  return `${url.trim().replace(/\/+$/, "")}/`;
}

export function projectDataUrl(workspaceUrl: string): string {
  return `${normalizeWorkspaceUrl(workspaceUrl)}${DATA_SEGMENT}/`;
}

export function projectConfigUrl(workspaceUrl: string): string {
  return `${normalizeWorkspaceUrl(workspaceUrl)}${CONFIG_SEGMENT}/`;
}

export function projectMembersUrl(workspaceUrl: string): string {
  return `${projectConfigUrl(workspaceUrl)}${MEMBERS_FILE_NAME}`;
}

/**
 * Validasi WebID yang dimasukkan pengguna. WebID harus berupa URL http(s)
 * absolut tanpa spasi — bukan sekadar nama atau alamat email.
 */
export function validateMemberWebId(rawWebId: string): {
  ok: boolean;
  webId: string;
  error?: string;
} {
  const trimmed = rawWebId.trim();
  if (!trimmed) {
    return {
      ok: false,
      webId: "",
      error: "WebID anggota wajib diisi.",
    };
  }
  if (/\s/.test(trimmed)) {
    return {
      ok: false,
      webId: trimmed,
      error: "WebID tidak boleh mengandung spasi.",
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      ok: false,
      webId: trimmed,
      error: "WebID harus berupa URL lengkap, mis. https://pod.example/profil/card#me.",
    };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      ok: false,
      webId: trimmed,
      error: "Gunakan WebID dengan skema http:// atau https://.",
    };
  }

  if (url.search) {
    return {
      ok: false,
      webId: trimmed,
      error: "WebID tidak boleh memuat query string.",
    };
  }

  return { ok: true, webId: trimmed };
}

/** Nama tampilan ringkas dari WebID, mis. https://pod/x/profile/card#me → x. */
export function memberDisplayName(webId: string): string {
  try {
    const url = new URL(webId);
    const segments = url.pathname.split("/").filter(Boolean);
    // WebID standar berakhiran /<nama>/profile/card#me: pakai segmen nama,
    // bukan kata generik "profile" atau "card".
    const generic = new Set(["profile", "card", "me"]);
    const candidate = segments
      .slice()
      .reverse()
      .find((segment) => !generic.has(segment.toLowerCase()));
    return candidate ?? url.hostname;
  } catch {
    return "Anggota";
  }
}

/** ID stabil untuk entri anggota di members.ttl berdasarkan WebID. */
function memberEntryName(webId: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < webId.length; index += 1) {
    hash ^= webId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `member-${hash.toString(36)}`;
}

/** Izin resource/default untuk peran tertentu. */
function accessForRole(role: MemberRole): AccessRule {
  if (role === "Editor") {
    return { read: true, append: true, write: true, control: false };
  }
  return { read: true, append: false, write: false, control: false };
}

function noAccess(): AccessRule {
  return { read: false, append: false, write: false, control: false };
}

function fullOwnerAccess(): AccessRule {
  return { read: true, append: true, write: true, control: true };
}

function hasAccess(access: AccessRule | null | undefined, keys: string[]): boolean {
  if (!access) return false;
  return keys.every(
    (key) => access[key as keyof AccessRule] === true
  );
}

/**
 * Baca daftar anggota dari `config/members.ttl`.
 * Berkas yang belum ada berarti belum ada anggota yang diundang.
 */
export async function readProjectMembers(
  context: SolidAclContext
): Promise<StoredProjectMember[]> {
  const solid = context.client ?? (await loadSolidClient());
  const url = projectMembersUrl(context.workspaceUrl);

  let dataset;
  try {
    dataset = await solid.getSolidDataset(url, { fetch: context.fetch });
  } catch (error) {
    if (isMissingResource(error)) {
      return [];
    }
    const status = httpStatusOf(error);
    if (status === 401 || status === 403) {
      throw new SolidAclAccessDeniedError(url, status);
    }
    throw new SolidAclError("read-members", error);
  }

  const members: StoredProjectMember[] = [];
  for (const thing of solid.getThingAll(dataset)) {
    const webId =
      solid.getUrl(thing, `${CPD}webId`) ??
      solid.getUrlAll(thing, `${CPD}webId`)[0] ??
      null;
    if (!webId) continue;

    const roleValue = solid.getStringNoLocale(thing, `${CPD}role`);
    if (roleValue !== "Editor" && roleValue !== "Viewer") continue;

    const addedAt = solid.getDatetime(thing, `${CPD}addedAt`);
    members.push({
      id: memberEntryName(webId),
      webId,
      role: roleValue,
      addedAt: addedAt ? addedAt.toISOString() : null,
    });
  }

  return members.sort((a, b) => a.webId.localeCompare(b.webId));
}

/**
 * Undang anggota baru: tulis ACL pada `data/` (sesuai peran) dan pada
 * `config/` (baca saja), verifikasi hasilnya, lalu catat WebID di
 * `config/members.ttl`. Idempoten: mengundang ulang WebID yang sama hanya
 * memperbarui perannya.
 */
export async function addMemberToProject(
  input: AddMemberInput
): Promise<StoredProjectMember[]> {
  const solid = input.client ?? (await loadSolidClient());
  const workspaceUrl = normalizeWorkspaceUrl(input.workspaceUrl);

  const validation = validateMemberWebId(input.webId);
  if (!validation.ok) {
    throw new SolidAclError("validate-member", new Error(validation.error));
  }
  if (!MEMBER_ROLES.includes(input.role)) {
    throw new SolidAclError(
      "validate-member",
      new Error("Peran anggota harus Editor atau Viewer.")
    );
  }
  if (input.ownerWebId && validation.webId === input.ownerWebId) {
    throw new SolidAclError(
      "validate-member",
      new Error("Pemilik proyek sudah memiliki akses penuh dan tidak perlu diundang.")
    );
  }

  const dataUrl = projectDataUrl(workspaceUrl);
  const configUrl = projectConfigUrl(workspaceUrl);

  await ensureContainer(solid, dataUrl, input.fetch);

  // Kontainer data mengikuti peran; kontainer config hanya baca agar
  // metadata dan daftar anggota tetap dapat dibaca tanpa bisa diubah.
  await writeMemberAcl(solid, {
    resourceUrl: dataUrl,
    ownerWebId: input.ownerWebId,
    memberWebId: validation.webId,
    memberAccess: accessForRole(input.role),
    fetch: input.fetch,
  });
  await writeMemberAcl(solid, {
    resourceUrl: configUrl,
    ownerWebId: input.ownerWebId,
    memberWebId: validation.webId,
    memberAccess: accessForRole("Viewer"),
    fetch: input.fetch,
  });

  await verifyMemberAcl(solid, {
    resourceUrl: dataUrl,
    ownerWebId: input.ownerWebId,
    memberWebId: validation.webId,
    expected: accessForRole(input.role),
    fetch: input.fetch,
  });

  await writeMembersDataset(solid, {
    workspaceUrl,
    fetch: input.fetch,
    upsert: { webId: validation.webId, role: input.role },
  });

  return readProjectMembers({ ...input, workspaceUrl });
}

/**
 * Cabut akses anggota: hapus aturan agen pada `data/` dan `config/`, lalu
 * hapus entrinya dari `members.ttl`. Aman dipanggil untuk WebID yang sudah
 * tidak punya akses (idempoten).
 */
export async function removeMemberFromProject(
  input: RemoveMemberInput
): Promise<StoredProjectMember[]> {
  const solid = input.client ?? (await loadSolidClient());
  const workspaceUrl = normalizeWorkspaceUrl(input.workspaceUrl);

  const validation = validateMemberWebId(input.webId);
  if (!validation.ok) {
    throw new SolidAclError("validate-member", new Error(validation.error));
  }

  const targets = [projectDataUrl(workspaceUrl), projectConfigUrl(workspaceUrl)];

  for (const resourceUrl of targets) {
    await revokeMemberAcl(solid, {
      resourceUrl,
      memberWebId: validation.webId,
      fetch: input.fetch,
    });
  }

  await writeMembersDataset(solid, {
    workspaceUrl,
    fetch: input.fetch,
    removeWebId: validation.webId,
  });

  return readProjectMembers({ ...input, workspaceUrl });
}

/** ACL untuk kontainer proyek yang bisa diubah (resource ACL atau fallback). */
async function loadAclFor(
  solid: SolidClient,
  resourceUrl: string,
  fetchImpl: typeof fetch
): Promise<{ info: ResourceInfoWithAcl & WithAccessibleAcl; acl: AclDataset }> {
  let info;
  try {
    info = await solid.getResourceInfoWithAcl(resourceUrl, { fetch: fetchImpl });
  } catch (error) {
    const status = httpStatusOf(error);
    if (status === 401 || status === 403) {
      throw new SolidAclAccessDeniedError(resourceUrl, status);
    }
    throw new SolidAclError("read-acl", error);
  }

  if (!solid.hasAccessibleAcl(info)) {
    throw new SolidAclError(
      "read-acl",
      new Error(
        `Server Pod tidak mengizinkan pengaturan ACL pada ${resourceUrl}.`
      )
    );
  }

  if (solid.hasResourceAcl(info)) {
    return { info, acl: solid.getResourceAcl(info) };
  }
  if (solid.hasFallbackAcl(info)) {
    return { info, acl: solid.createAclFromFallbackAcl(info) };
  }
  return { info, acl: solid.createAcl(info) };
}

interface WriteAclInput {
  resourceUrl: string;
  ownerWebId?: string;
  memberWebId: string;
  memberAccess: AccessRule;
  fetch: typeof fetch;
}

async function writeMemberAcl(
  solid: SolidClient,
  input: WriteAclInput
): Promise<void> {
  const { info, acl: loadedAcl } = await loadAclFor(
    solid,
    input.resourceUrl,
    input.fetch
  );

  let acl = loadedAcl;
  if (input.ownerWebId) {
    acl = solid.setAgentResourceAccess(
      acl,
      input.ownerWebId,
      fullOwnerAccess()
    );
    acl = solid.setAgentDefaultAccess(acl, input.ownerWebId, fullOwnerAccess());
  }
  acl = solid.setAgentResourceAccess(acl, input.memberWebId, input.memberAccess);
  acl = solid.setAgentDefaultAccess(acl, input.memberWebId, input.memberAccess);
  // Publik selalu ditutup, termasuk bila fallback ACL membuka sesuatu.
  acl = solid.setPublicResourceAccess(acl, noAccess());
  acl = solid.setPublicDefaultAccess(acl, noAccess());

  await putAcl(solid, {
    info,
    acl,
    resourceUrl: input.resourceUrl,
    step: "write-acl",
    fetch: input.fetch,
  });
}

interface VerifyAclInput {
  resourceUrl: string;
  ownerWebId?: string;
  memberWebId: string;
  expected: AccessRule;
  fetch: typeof fetch;
}

/** Pastikan hak anggota dan pemilik benar-benar tersimpan di server. */
async function verifyMemberAcl(
  solid: SolidClient,
  input: VerifyAclInput
): Promise<void> {
  let info;
  try {
    info = await solid.getResourceInfoWithAcl(input.resourceUrl, {
      fetch: input.fetch,
    });
  } catch (error) {
    throw new SolidAclError("verify-acl", error);
  }

  if (!solid.hasAccessibleAcl(info) || !solid.hasResourceAcl(info)) {
    throw new SolidAclError(
      "verify-acl",
      new Error(
        `ACL pada ${input.resourceUrl} tidak dapat dibaca kembali setelah disimpan.`
      )
    );
  }

  const acl = solid.getResourceAcl(info);
  const memberResource = solid.getAgentResourceAccess(acl, input.memberWebId);
  const memberDefault = solid.getAgentDefaultAccess(acl, input.memberWebId);

  const requiredKeys = [
    "read",
    ...(input.expected.write ? ["write"] : []),
    ...(input.expected.append ? ["append"] : []),
  ];
  if (
    !hasAccess(memberResource, requiredKeys) ||
    !hasAccess(memberDefault, requiredKeys)
  ) {
    throw new SolidAclError(
      "verify-acl",
      new Error(
        `Hak akses anggota pada ${input.resourceUrl} tidak sesuai setelah disimpan.`
      )
    );
  }

  if (input.ownerWebId) {
    const ownerResource = solid.getAgentResourceAccess(acl, input.ownerWebId);
    const ownerDefault = solid.getAgentDefaultAccess(acl, input.ownerWebId);
    if (
      !hasAccess(ownerResource, ["read", "write", "append", "control"]) ||
      !hasAccess(ownerDefault, ["read", "write", "append", "control"])
    ) {
      throw new SolidAclError(
        "verify-acl",
        new Error(
          `ACL pada ${input.resourceUrl} tidak lagi memberi kendali penuh kepada pemilik.`
        )
      );
    }
  }

  if (
    hasAnyAccess(solid.getPublicResourceAccess(acl)) ||
    hasAnyAccess(solid.getPublicDefaultAccess(acl))
  ) {
    throw new SolidAclError(
      "verify-acl",
      new Error(`ACL pada ${input.resourceUrl} masih terbuka untuk publik.`)
    );
  }
}

interface RevokeAclInput {
  resourceUrl: string;
  memberWebId: string;
  fetch: typeof fetch;
}

/** Hapus semua hak agen pada satu resource bila ACL-nya dapat diakses. */
async function revokeMemberAcl(
  solid: SolidClient,
  input: RevokeAclInput
): Promise<void> {
  let info;
  try {
    info = await solid.getResourceInfoWithAcl(input.resourceUrl, {
      fetch: input.fetch,
    });
  } catch (error) {
    if (isMissingResource(error)) {
      return;
    }
    const status = httpStatusOf(error);
    if (status === 401 || status === 403) {
      throw new SolidAclAccessDeniedError(input.resourceUrl, status);
    }
    throw new SolidAclError("remove-member", error);
  }

  // Kontainer yang belum punya ACL sendiri tidak perlu dicabut: aksesnya
  // belum pernah diberikan, atau diwarisi dari kontainer induk.
  if (!solid.hasAccessibleAcl(info) || !solid.hasResourceAcl(info)) {
    return;
  }

  const acl = solid.getResourceAcl(info);
  const access = solid.getAgentResourceAccess(acl, input.memberWebId);
  const defaultAccess = solid.getAgentDefaultAccess(acl, input.memberWebId);
  if (!hasAnyAccess(access) && !hasAnyAccess(defaultAccess)) {
    return;
  }

  let updated = solid.setAgentResourceAccess(acl, input.memberWebId, noAccess());
  updated = solid.setAgentDefaultAccess(updated, input.memberWebId, noAccess());

  await putAcl(solid, {
    info,
    acl: updated,
    resourceUrl: input.resourceUrl,
    step: "remove-member",
    fetch: input.fetch,
  });
}

interface PutAclInput {
  info: ResourceInfoWithAcl;
  acl: AclDataset;
  resourceUrl: string;
  step: SolidAclStep;
  fetch: typeof fetch;
}

/**
 * Tulis ACL utuh dengan PUT, bukan PATCH. Server Solid menolak PATCH untuk
 * berkas ACL yang belum ada, sedangkan PUT selalu idempoten dan bekerja untuk
 * ACL baru maupun yang sudah ada.
 */
async function putAcl(solid: SolidClient, input: PutAclInput): Promise<void> {
  const aclUrl =
    input.info.internal_resourceInfo.aclUrl ?? `${input.resourceUrl}.acl`;
  const body = await solid.solidDatasetAsTurtle(input.acl);

  let response: Response;
  try {
    response = await input.fetch(aclUrl, {
      method: "PUT",
      headers: { "content-type": "text/turtle" },
      body,
    });
  } catch (error) {
    throw new SolidAclError(input.step, error);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SolidAclAccessDeniedError(aclUrl, response.status);
    }
    throw new SolidAclError(
      input.step,
      new Error(`Server menolak penyimpanan ACL (HTTP ${response.status}).`)
    );
  }
}

interface WriteMembersInput {
  workspaceUrl: string;
  fetch: typeof fetch;
  upsert?: { webId: string; role: MemberRole };
  removeWebId?: string;
}

/**
 * Tulis ulang `config/members.ttl` secara idempoten. Thing `#memberList`
 * dipertahankan sebagai penanda agar berkas tetap valid walau kosong.
 */
async function writeMembersDataset(
  solid: SolidClient,
  input: WriteMembersInput
): Promise<void> {
  const url = projectMembersUrl(input.workspaceUrl);

  let dataset;
  try {
    dataset = await solid.getSolidDataset(url, { fetch: input.fetch });
  } catch (error) {
    if (!isMissingResource(error)) {
      throw new SolidAclError("read-members", error);
    }
    dataset = solid.createSolidDataset();
  }

  const markerUrl = `${url}#memberList`;
  let marker = solid.getThing(dataset, markerUrl);
  if (!marker) {
    marker = solid.createThing({ url: markerUrl });
  }
  marker = solid.setUrl(marker, RDF_TYPE, `${CPD}MemberList`);
  dataset = solid.setThing(dataset, marker);

  const existingThings = solid.getThingAll(dataset);

  if (input.upsert) {
    const existing = existingThings.find(
      (thing) => solid.getUrl(thing, `${CPD}webId`) === input.upsert?.webId
    );
    let thing =
      existing ??
      solid.createThing({
        url: `${url}#${memberEntryName(input.upsert.webId)}`,
      });
    thing = solid.setUrl(thing, `${CPD}webId`, input.upsert.webId);
    thing = solid.setStringNoLocale(thing, `${CPD}role`, input.upsert.role);
    thing = solid.setDatetime(thing, `${CPD}addedAt`, new Date());
    dataset = solid.setThing(dataset, thing);
  }

  if (input.removeWebId) {
    for (const thing of existingThings) {
      const webId = solid.getUrl(thing, `${CPD}webId`);
      if (webId === input.removeWebId) {
        dataset = solid.removeThing(dataset, thing);
      }
    }
  }

  const turtle = await solid.solidDatasetAsTurtle(dataset);
  let response: Response;
  try {
    response = await input.fetch(url, {
      method: "PUT",
      headers: { "content-type": "text/turtle" },
      body: turtle,
    });
  } catch (error) {
    throw new SolidAclError("write-members", error);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SolidAclAccessDeniedError(url, response.status);
    }
    throw new SolidAclError(
      "write-members",
      new Error(
        `Server menolak penyimpanan daftar anggota (HTTP ${response.status}).`
      )
    );
  }
}

async function ensureContainer(
  solid: SolidClient,
  containerUrl: string,
  fetchImpl: typeof fetch
): Promise<void> {
  try {
    await solid.getResourceInfo(containerUrl, { fetch: fetchImpl });
    return;
  } catch (error) {
    if (!isMissingResource(error)) {
      const status = httpStatusOf(error);
      if (status === 401 || status === 403) {
        throw new SolidAclAccessDeniedError(containerUrl, status);
      }
      throw new SolidAclError("prepare-container", error);
    }
  }

  try {
    await solid.createContainerAt(containerUrl, { fetch: fetchImpl });
  } catch (error) {
    if (isConflict(error)) {
      return;
    }
    const status = httpStatusOf(error);
    if (status === 401 || status === 403) {
      throw new SolidAclAccessDeniedError(containerUrl, status);
    }
    throw new SolidAclError("prepare-container", error);
  }
}

function hasAnyAccess(access: AccessRule | null | undefined): boolean {
  if (!access) return false;
  return Boolean(access.read || access.write || access.append || access.control);
}

/** Peran Project untuk seorang pengguna berdasarkan daftar anggota. */
export function resolveMemberRole(
  webId: string,
  ownerWebId: string,
  members: readonly StoredProjectMember[]
): ProjectRole {
  if (webId === ownerWebId) {
    return "Owner";
  }
  return members.find((member) => member.webId === webId)?.role ?? "Viewer";
}

/** Ubah anggota tersimpan menjadi bentuk yang dipakai kartu/daftar anggota. */
export function toProjectMember(member: StoredProjectMember): ProjectMember {
  return {
    id: member.id,
    webId: member.webId,
    name: memberDisplayName(member.webId),
    role: member.role,
  };
}

function isMissingResource(error: unknown): boolean {
  const status = httpStatusOf(error);
  return status === 404 || status === 410;
}

function isConflict(error: unknown): boolean {
  return httpStatusOf(error) === 409;
}

/** Status HTTP dari error fetch (termasuk yang dibungkus error lain). */
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
