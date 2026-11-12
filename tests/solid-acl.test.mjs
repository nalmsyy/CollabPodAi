import test from "node:test";
import assert from "node:assert/strict";
import {
  getAgentDefaultAccess,
  getAgentResourceAccess,
  getResourceAcl,
  getResourceInfoWithAcl,
  hasResourceAcl,
} from "@inrupt/solid-client";
import {
  addMemberToProject,
  isSolidAclAccessDenied,
  memberDisplayName,
  projectMembersUrl,
  readProjectMembers,
  removeMemberFromProject,
  resolveMemberRole,
  validateMemberWebId,
} from "../src/lib/solid-acl.ts";
import { SolidPodProjectRepository } from "../src/lib/solid-project-repository.ts";

const OWNER_WEB_ID = "https://pod.example/alice/profile/card#me";
const MEMBER_WEB_ID = "https://pod.example/bob/profile/card#me";
const POD_URL = "https://pod.example/alice/";
const PROJECT_URL = `${POD_URL}collabpod/projects/prj-acl/`;
const DATA_URL = `${PROJECT_URL}data/`;
const CONFIG_URL = `${PROJECT_URL}config/`;
const METADATA_URL = `${CONFIG_URL}project.ttl`;
const MEMBERS_URL = projectMembersUrl(PROJECT_URL);
const ACL = "http://www.w3.org/ns/auth/acl#";
const CPD = "https://collabpod.ai/ns#";

function respond(url, body = null, init = {}) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function ownerAclTurtle(resourceUrl) {
  return `@prefix acl: <${ACL}>.
<#owner> a acl:Authorization;
  acl:agent <${OWNER_WEB_ID}>;
  acl:accessTo <${resourceUrl}>;
  acl:default <${resourceUrl}>;
  acl:mode acl:Read, acl:Append, acl:Write, acl:Control.`;
}

function metadataTurtle() {
  return `@prefix cpd: <${CPD}>.
<${METADATA_URL}#prj-acl> a cpd:Project;
  cpd:id "prj-acl";
  cpd:name "Proyek Uji ACL";
  cpd:description "Uji anggota.";
  cpd:owner <${OWNER_WEB_ID}>;
  cpd:createdAt "2026-11-01T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>;
  cpd:projectContainer <${PROJECT_URL}>.`;
}

/**
 * Pod Solid tiruan dengan dukungan WAC: kontainer dan ACL-nya, termasuk ACL
 * fallback dari kontainer induk seperti Community Solid Server.
 */
function createAclPod({ denyAclWrite = false } = {}) {
  const resources = new Map();
  const requests = [];

  resources.set(POD_URL, {
    body: `@prefix ldp: <http://www.w3.org/ns/ldp#>.\n<${POD_URL}> a ldp:BasicContainer.`,
    type: "text/turtle",
  });
  resources.set(`${POD_URL}.acl`, {
    body: ownerAclTurtle(POD_URL),
    type: "text/turtle",
  });
  resources.set(PROJECT_URL, {
    body: `@prefix ldp: <http://www.w3.org/ns/ldp#>.\n<${PROJECT_URL}> a ldp:BasicContainer.`,
    type: "text/turtle",
  });
  resources.set(`${PROJECT_URL}.acl`, {
    body: ownerAclTurtle(PROJECT_URL),
    type: "text/turtle",
  });
  resources.set(CONFIG_URL, {
    body: `@prefix ldp: <http://www.w3.org/ns/ldp#>.\n<${CONFIG_URL}> a ldp:BasicContainer.`,
    type: "text/turtle",
  });
  resources.set(METADATA_URL, { body: metadataTurtle(), type: "text/turtle" });

  // Data container dibuat oleh ensureContainer saat mengundang anggota.

  async function fakeFetch(input, init = {}) {
    const url = typeof input === "string" ? input : input.url;
    const method = (init.method ?? "GET").toUpperCase();
    const body = init.body ?? null;
    requests.push({ method, url });

    if (denyAclWrite && url.endsWith(".acl") && (method === "PUT" || method === "PATCH")) {
      return respond(url, "Forbidden", { status: 403 });
    }

    if (url.endsWith(".acl") && method !== "PUT") {
      const stored = resources.get(url);
      if (!stored) {
        return respond(url, "", { status: 404 });
      }
      return respond(url, stored.body, {
        status: 200,
        headers: { "content-type": "text/turtle" },
      });
    }

    if (method === "PUT") {
      const headers = new Headers(init.headers ?? {});
      const contentType = headers.get("content-type") ?? "text/turtle";
      const existing = resources.get(url);
      resources.set(url, { body, type: contentType });

      // Simpan ldp:contains untuk sub-kontainer baru.
      if (url.endsWith("/")) {
        const parentUrl = url.replace(/[^/]+\/$/, "");
        const parent = resources.get(parentUrl);
        if (parent && !parent.body.includes(`<${url}>`)) {
          parent.body = parent.body.replace(
            /\.\s*$/,
            `.\n<${parentUrl}> <http://www.w3.org/ns/ldp#contains> <${url}>.`
          );
        }
      }

      return respond(url, null, {
        status: existing ? 205 : 201,
        headers: { location: url },
      });
    }

    if (method === "DELETE") {
      if (!resources.has(url)) return respond(url, null, { status: 404 });
      resources.delete(url);
      return respond(url, null, { status: 205 });
    }

    const stored = resources.get(url);
    if (!stored) {
      return respond(url, "", { status: 404 });
    }

    const headers = {
      "content-type": stored.type,
      link: `<${url}.acl>; rel="acl"`,
    };
    if (method === "HEAD") {
      return respond(url, null, { status: 200, headers });
    }
    return respond(url, stored.body, { status: 200, headers });
  }

  return { fetch: fakeFetch, resources, requests };
}

function aclContext(pod, overrides = {}) {
  return {
    workspaceUrl: PROJECT_URL,
    ownerWebId: OWNER_WEB_ID,
    fetch: pod.fetch,
    ...overrides,
  };
}

test("validasi WebID menolak nilai yang bukan URL http(s)", () => {
  assert.equal(validateMemberWebId("").ok, false);
  assert.equal(validateMemberWebId("bob").ok, false);
  assert.equal(validateMemberWebId("mailto:bob@example.com").ok, false);
  assert.equal(
    validateMemberWebId("https://pod.example/bob/profile/card#me").ok,
    true
  );
  assert.equal(
    validateMemberWebId("https://pod.example/bob/profile/card#me").webId,
    MEMBER_WEB_ID
  );
});

test("memberDisplayName mengambil segmen profil pertama dari WebID", () => {
  assert.equal(memberDisplayName(MEMBER_WEB_ID), "bob");
  assert.equal(memberDisplayName("bukan-url"), "Anggota");
});

test("Viewer mendapat Read pada data/ dan Read saja pada config/", async () => {
  const pod = createAclPod();

  const members = await addMemberToProject({
    ...aclContext(pod),
    webId: MEMBER_WEB_ID,
    role: "Viewer",
  });

  assert.equal(members.length, 1);
  assert.equal(members[0].webId, MEMBER_WEB_ID);
  assert.equal(members[0].role, "Viewer");

  const dataInfo = await getResourceInfoWithAcl(DATA_URL, { fetch: pod.fetch });
  assert.equal(hasResourceAcl(dataInfo), true);
  const dataAcl = getResourceAcl(dataInfo);
  assert.deepEqual(getAgentResourceAccess(dataAcl, MEMBER_WEB_ID), {
    read: true,
    append: false,
    write: false,
    control: false,
  });
  assert.deepEqual(getAgentDefaultAccess(dataAcl, MEMBER_WEB_ID), {
    read: true,
    append: false,
    write: false,
    control: false,
  });

  const configInfo = await getResourceInfoWithAcl(CONFIG_URL, { fetch: pod.fetch });
  const configAcl = getResourceAcl(configInfo);
  assert.equal(getAgentResourceAccess(configAcl, MEMBER_WEB_ID).read, true);
  assert.equal(getAgentResourceAccess(configAcl, MEMBER_WEB_ID).write, false);

  // Pemilik tetap memegang kendali penuh.
  assert.deepEqual(getAgentResourceAccess(dataAcl, OWNER_WEB_ID), {
    read: true,
    append: true,
    write: true,
    control: true,
  });
});

test("Editor mendapat Read, Write, dan Append pada data/", async () => {
  const pod = createAclPod();

  await addMemberToProject({
    ...aclContext(pod),
    webId: MEMBER_WEB_ID,
    role: "Editor",
  });

  const dataInfo = await getResourceInfoWithAcl(DATA_URL, { fetch: pod.fetch });
  const dataAcl = getResourceAcl(dataInfo);
  const access = getAgentResourceAccess(dataAcl, MEMBER_WEB_ID);

  assert.equal(access.read, true);
  assert.equal(access.write, true);
  assert.equal(access.append, true);
  assert.equal(access.control, false, "Editor tidak boleh mengubah ACL");

  const dataset = await readProjectMembers(aclContext(pod));
  assert.equal(dataset[0].role, "Editor");
});

test("mengundang ulang WebID yang sama memperbarui peran tanpa duplikat", async () => {
  const pod = createAclPod();

  await addMemberToProject({
    ...aclContext(pod),
    webId: MEMBER_WEB_ID,
    role: "Viewer",
  });
  const members = await addMemberToProject({
    ...aclContext(pod),
    webId: MEMBER_WEB_ID,
    role: "Editor",
  });

  assert.equal(members.length, 1);
  assert.equal(members[0].role, "Editor");
  assert.match(pod.resources.get(MEMBERS_URL).body, /Editor/);
});

test("pemilik tidak dapat diundang sebagai anggota", async () => {
  const pod = createAclPod();

  let caught;
  try {
    await addMemberToProject({
      ...aclContext(pod),
      webId: OWNER_WEB_ID,
      role: "Editor",
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught);
  assert.equal(caught.step, "validate-member");
  assert.match(caught.cause.message, /pemilik/i);
  assert.equal(pod.resources.has(MEMBERS_URL), false);
});

test("mencabut anggota menghapus hak WAC dan entri members.ttl", async () => {
  const pod = createAclPod();

  await addMemberToProject({
    ...aclContext(pod),
    webId: MEMBER_WEB_ID,
    role: "Editor",
  });

  const remaining = await removeMemberFromProject({
    ...aclContext(pod),
    webId: MEMBER_WEB_ID,
  });
  assert.deepEqual(remaining, []);

  const dataInfo = await getResourceInfoWithAcl(DATA_URL, { fetch: pod.fetch });
  const dataAcl = getResourceAcl(dataInfo);
  assert.deepEqual(getAgentResourceAccess(dataAcl, MEMBER_WEB_ID), {
    read: false,
    append: false,
    write: false,
    control: false,
  });

  assert.deepEqual(await readProjectMembers(aclContext(pod)), []);
  assert.equal(pod.resources.has(`${DATA_URL}.acl`), true);
});

test("penolakan WAC saat menulis ACL dilaporkan sebagai akses ditolak", async () => {
  const pod = createAclPod({ denyAclWrite: true });

  let caught;
  try {
    await addMemberToProject({
      ...aclContext(pod),
      webId: MEMBER_WEB_ID,
      role: "Viewer",
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught);
  assert.equal(isSolidAclAccessDenied(caught), true);
  assert.equal(
    pod.resources.has(MEMBERS_URL),
    false,
    "members.ttl tidak boleh ditulis bila ACL gagal disimpan"
  );
});

test("peran pengguna dihitung dari members.ttl, pemilik selalu Owner", () => {
  const members = [
    { id: "m1", webId: MEMBER_WEB_ID, role: "Editor", addedAt: null },
  ];
  assert.equal(resolveMemberRole(OWNER_WEB_ID, OWNER_WEB_ID, members), "Owner");
  assert.equal(resolveMemberRole(MEMBER_WEB_ID, OWNER_WEB_ID, members), "Editor");
  assert.equal(
    resolveMemberRole("https://pod.example/carol/profile/card#me", OWNER_WEB_ID, members),
    "Viewer"
  );
});

test("membuka proyek langsung memberi peran Editor dari members.ttl", async () => {
  const pod = createAclPod();

  await addMemberToProject({
    ...aclContext(pod),
    webId: MEMBER_WEB_ID,
    role: "Editor",
  });

  const repository = new SolidPodProjectRepository({
    podUrl: POD_URL,
    webId: MEMBER_WEB_ID,
    fetch: pod.fetch,
  });

  const result = await repository.openProjectDirect("prj-acl");
  assert.equal(result.project.currentUserRole, "Editor");
  assert.equal(result.project.members.length, 2);
  assert.equal(
    result.project.members.find((member) => member.webId === MEMBER_WEB_ID)?.role,
    "Editor"
  );
  assert.equal(
    result.project.members.find((member) => member.webId === OWNER_WEB_ID)?.role,
    "Owner"
  );
});
