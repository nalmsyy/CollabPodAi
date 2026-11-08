import test from "node:test";
import assert from "node:assert/strict";
import { getSolidDataset, getThing, getUrlAll } from "@inrupt/solid-client";
import {
  SolidPodProjectRepository,
  SolidProjectError,
  isSolidProjectAccessDenied,
} from "../src/lib/solid-project-repository.ts";

const WEB_ID = "https://pod.example/alice/profile/card#me";
const POD_URL = "https://pod.example/alice/";
const INDEX_URL = `${POD_URL}collabpod/project-index.ttl`;
const METADATA_URL = `${POD_URL}collabpod/projects/prj-test-1/config/project.ttl`;
const CPD = "https://collabpod.ai/ns#";
const ACL = "http://www.w3.org/ns/auth/acl#";
const FOAF_AGENT = "http://xmlns.com/foaf/0.1/Agent";

/**
 * Pod Solid tiruan di memori. Menyimpan resource apa adanya, menambahkan
 * header Link rel="acl" pada setiap resource, dan mencatat semua permintaan
 * agar tes dapat memastikan tidak ada penulisan yang tidak diinginkan.
 */
/** Response dengan `url` terisi: SDK memakai response.url sebagai base URL. */
function respond(url, body = null, init = {}) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function createFakePod({
  indexStatus,
  networkDown = false,
  aclPolicy = "owner",
} = {}) {
  const resources = new Map();
  const requests = [];

  // Pod root nyata selalu ada dan memiliki ACL induk sebagai fallback.
  resources.set(POD_URL, { body: "", type: "text/turtle" });
  resources.set(`${POD_URL}.acl`, {
    body: `@prefix acl: <${ACL}>.
<#owner> a acl:Authorization;
  acl:agent <${WEB_ID}>;
  acl:accessTo <${POD_URL}>;
  acl:default <${POD_URL}>;
  acl:mode acl:Read, acl:Append, acl:Write, acl:Control.`,
    type: "text/turtle",
  });

  async function fakeFetch(input, init = {}) {
    const url = typeof input === "string" ? input : input.url;
    const method = (init.method ?? "GET").toUpperCase();
    const body = typeof init.body === "string" ? init.body : null;
    requests.push({ method, url, body });

    if (networkDown) {
      throw new TypeError("fetch failed");
    }

    if (url.endsWith(".acl")) {
      if (method === "PUT" || method === "PATCH") {
        if (aclPolicy === "drop") {
          return respond(url, null, { status: 201 });
        }

        const existing = resources.get(url)?.body ?? "";
        let aclBody = body ?? "";

        if (method === "PATCH") {
          // saveAclFor memakai N3 Patch (SPARQL INSERT DATA). Terapkan sisipan
          // sebagai Turtle tambahan; cukup untuk alur ACL di tes ini.
          const inserts = [];
          const pattern = /INSERT\s+DATA\s*\{([\s\S]*?)\}/gi;
          let match;
          while ((match = pattern.exec(aclBody)) !== null) {
            inserts.push(match[1]);
          }
          aclBody = `${existing}\n${inserts.join("\n")}`;
        }

        if (aclPolicy === "public") {
          const resourceUrl = url.slice(0, -4);
          aclBody +=
            `\n<#public-rule> a <${ACL}Authorization>; ` +
            `<${ACL}accessTo> <${resourceUrl}>; ` +
            `<${ACL}mode> <${ACL}Read>; ` +
            `<${ACL}agentClass> <${FOAF_AGENT}>.`;
        }
        resources.set(url, { body: aclBody, type: "text/turtle" });
        return respond(url, null, { status: 201 });
      }

      const stored = resources.get(url);
      if (!stored) return respond(url, "", { status: 404 });
      return respond(url, stored.body, {
        status: 200,
        headers: { "content-type": "text/turtle" },
      });
    }

    if (url === INDEX_URL && indexStatus) {
      return respond(url, "", { status: indexStatus });
    }

    if (method === "PATCH") {
      // SDK mengirim SPARQL UPDATE (application/sparql-update) untuk dataset
      // yang sudah ada. Terapkan bagian INSERT DATA sebagai Turtle tambahan.
      const existing = resources.get(url)?.body ?? "";
      const inserts = [];
      const pattern = /INSERT\s+DATA\s*\{([\s\S]*?)\}/gi;
      let match;
      while ((match = pattern.exec(body ?? "")) !== null) {
        inserts.push(match[1]);
      }
      resources.set(url, {
        body:
          inserts.length > 0 ? `${existing}\n${inserts.join("\n")}` : existing,
        type: "text/turtle",
      });
      return respond(url, null, {
        status: 201,
        headers: { location: url },
      });
    }

    if (method === "PUT") {
      const headers = new Headers(init.headers ?? {});
      resources.set(url, {
        body: body ?? "",
        type: headers.get("content-type") ?? "text/turtle",
      });
      return respond(url, null, {
        status: 201,
        headers: { location: url },
      });
    }

    const stored = resources.get(url);
    if (!stored) return respond(url, "", { status: 404 });

    const headers = {
      "content-type": stored.type,
      link: `<${url}.acl>; rel="acl"`,
    };
    if (method === "HEAD") {
      return respond(url, null, { status: 200, headers });
    }
    return respond(url, stored.body, { status: 200, headers });
  }

  return { fetch: fakeFetch, requests, resources };
}

function repositoryFor(pod, overrides = {}) {
  return new SolidPodProjectRepository({
    podUrl: POD_URL,
    webId: WEB_ID,
    fetch: pod.fetch,
    idFactory: () => "prj-test-1",
    ...overrides,
  });
}

const PROJECT_INPUT = {
  projectId: "prj-test-1",
  name: "Uji Penyimpanan Pod",
  description: "Proyek uji regresi.",
};

test("indeks 404 berarti belum ada proyek (daftar kosong)", async () => {
  const pod = createFakePod();
  assert.deepEqual(await repositoryFor(pod).listProjects(), []);
});

for (const status of [401, 403, 500, 503]) {
  test(`indeks ${status} bukan daftar kosong`, async () => {
    const pod = createFakePod({ indexStatus: status });
    let caught;
    try {
      await repositoryFor(pod).listProjects();
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof SolidProjectError, "harus SolidProjectError");
    assert.equal(caught.step, "read-index");
    assert.equal(
      isSolidProjectAccessDenied(caught),
      status === 401 || status === 403
    );
  });
}

test("kegagalan jaringan bukan daftar kosong", async () => {
  const pod = createFakePod({ networkDown: true });
  let caught;
  try {
    await repositoryFor(pod).listProjects();
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof SolidProjectError);
  assert.equal(caught.step, "read-index");
  assert.equal(isSolidProjectAccessDenied(caught), false);
});

test("kegagalan membaca indeks tidak menimpa indeks", async () => {
  const pod = createFakePod({ indexStatus: 403 });
  let caught;
  try {
    await repositoryFor(pod).createProject(PROJECT_INPUT);
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof SolidProjectError);
  assert.equal(caught.step, "write-index");
  assert.equal(isSolidProjectAccessDenied(caught), true);
  assert.equal(
    pod.requests.some(
      (request) => request.method === "PUT" && request.url === INDEX_URL
    ),
    false,
    "project-index.ttl tidak boleh ditulis saat pemeriksaan gagal"
  );
});

for (const aclPolicy of ["public", "drop"]) {
  test(`verifikasi ACL (${aclPolicy}) menghentikan metadata dan indeks`, async () => {
    const pod = createFakePod({ aclPolicy });
    let caught;
    try {
      await repositoryFor(pod).createProject(PROJECT_INPUT);
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof SolidProjectError);
    assert.equal(caught.step, "prepare-permissions");
    assert.match(
      String(caught.cause?.message ?? ""),
      aclPolicy === "public"
        ? /akses kepada publik/
        : /tidak dapat dibaca kembali/
    );
    assert.equal(
      pod.requests.some(
        (request) => request.method === "PUT" && request.url === METADATA_URL
      ),
      false,
      "metadata tidak boleh ditulis sebelum ACL terverifikasi"
    );
    assert.equal(
      pod.requests.some(
        (request) => request.method === "PUT" && request.url === INDEX_URL
      ),
      false,
      "indeks tidak boleh ditulis sebelum ACL terverifikasi"
    );
  });
}

test("retry dengan ID sama tidak menggandakan entri indeks", async () => {
  const pod = createFakePod();
  const repository = repositoryFor(pod);

  await repository.createProject(PROJECT_INPUT);
  await repository.createProject(PROJECT_INPUT);

  const dataset = await getSolidDataset(INDEX_URL, { fetch: pod.fetch });
  const indexThing = getThing(dataset, `${INDEX_URL}#index`);
  const references = getUrlAll(indexThing, `${CPD}project`);

  assert.deepEqual(references, [METADATA_URL]);
});
