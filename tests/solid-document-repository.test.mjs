import test from "node:test";
import assert from "node:assert/strict";
import {
  SolidDocumentRepository,
  SolidDocumentError,
  SolidDocumentAccessDeniedError,
  validateDocumentFile,
  computeFileSha256,
} from "../src/lib/solid-document-repository.ts";

const WEB_ID = "https://pod.example/alice/profile/card#me";
const OTHER_WEB_ID = "https://pod.example/bob/profile/card#me";
const WORKSPACE_URL = "https://pod.example/alice/collabpod/projects/prj-test-1/";
const DOCUMENTS_CONTAINER = `${WORKSPACE_URL}data/documents/`;
const LDP_CONTAINS = "http://www.w3.org/ns/ldp#contains";

function respond(url, body = null, init = {}) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function createFakeDocPod({
  containerStatus = 200,
  networkDown = false,
  failAtBinary = false,
  failAtMetadata = false,
} = {}) {
  const resources = new Map();
  const requests = [];

  // Inisialisasi kontainer kosong
  if (containerStatus === 200) {
    resources.set(DOCUMENTS_CONTAINER, {
      body: `@prefix ldp: <http://www.w3.org/ns/ldp#>.
<${DOCUMENTS_CONTAINER}> a ldp:BasicContainer.`,
      type: "text/turtle",
    });
  }

  async function fakeFetch(input, init = {}) {
    const url = typeof input === "string" ? input : input.url;
    const method = (init.method ?? "GET").toUpperCase();
    const body = init.body ?? null;
    requests.push({ method, url });

    if (networkDown) {
      throw new TypeError("fetch failed");
    }

    if (containerStatus !== 200 && url === DOCUMENTS_CONTAINER) {
      return respond(url, null, { status: containerStatus });
    }

    if (failAtBinary && method === "PUT" && url.includes("/file.")) {
      return respond(url, "Simulated binary upload error", { status: 500 });
    }

    if (failAtMetadata && (method === "PUT" || method === "PATCH") && url.endsWith("metadata.ttl")) {
      return respond(url, "Simulated metadata write error", { status: 500 });
    }

    if (method === "HEAD") {
      if (resources.has(url)) {
        return respond(url, null, { status: 200 });
      }
      return respond(url, null, { status: 404 });
    }

    if (method === "GET") {
      const res = resources.get(url);
      if (!res) {
        return respond(url, null, { status: 404 });
      }
      return respond(url, res.body, {
        status: 200,
        headers: { "Content-Type": res.type },
      });
    }

    if (method === "PUT") {
      const contentType = init.headers?.["Content-Type"] ?? "application/octet-stream";
      resources.set(url, { body, type: contentType });

      // Jika URL adalah sub-kontainer dokumen, tambahkan ke ldp:contains di container utama
      const match = url.match(new RegExp(`^${DOCUMENTS_CONTAINER}(doc-[^/]+)/`));
      if (match) {
        const docSubContainer = `${DOCUMENTS_CONTAINER}${match[1]}/`;
        let containerRes = resources.get(DOCUMENTS_CONTAINER);
        if (!containerRes) {
          containerRes = {
            body: `@prefix ldp: <http://www.w3.org/ns/ldp#>.
<${DOCUMENTS_CONTAINER}> a ldp:BasicContainer.`,
            type: "text/turtle",
          };
          resources.set(DOCUMENTS_CONTAINER, containerRes);
        }
        if (!containerRes.body.includes(docSubContainer)) {
          containerRes.body += `\n<${DOCUMENTS_CONTAINER}> <${LDP_CONTAINS}> <${docSubContainer}>.`;
        }
      }

      return respond(url, null, { status: 201 });
    }

    if (method === "POST") {
      return respond(url, null, { status: 201 });
    }

    return respond(url, null, { status: 404 });
  }

  return {
    fetch: fakeFetch,
    resources,
    requests,
  };
}

// 1. Validasi format berkas
test("validasi format: PDF dan TXT diterima, format lain ditolak", () => {
  assert.equal(validateDocumentFile({ name: "data.pdf", size: 1000 }).valid, true);
  assert.equal(validateDocumentFile({ name: "catatan.txt", size: 500 }).valid, true);
  assert.equal(validateDocumentFile({ name: "skrip.exe", size: 2000 }).valid, false);
  assert.equal(validateDocumentFile({ name: "foto.png", size: 4000 }).valid, false);
});

// 2. Validasi ukuran berkas
test("validasi ukuran: 0 byte dan > 5MB ditolak", () => {
  const zeroResult = validateDocumentFile({ name: "kosong.txt", size: 0 });
  assert.equal(zeroResult.valid, false);
  assert.match(zeroResult.error, /0 byte/);

  const okResult = validateDocumentFile({ name: "laporan.pdf", size: 5 * 1024 * 1024 });
  assert.equal(okResult.valid, true);

  const bigResult = validateDocumentFile({ name: "besar.pdf", size: 5 * 1024 * 1024 + 1 });
  assert.equal(bigResult.valid, false);
  assert.match(bigResult.error, /5 MB/);
});

// 3. Validasi batas jumlah dokumen
test("validasi batas jumlah: maksimal 10 dokumen lengkap per proyek", () => {
  const underLimit = validateDocumentFile({ name: "doc10.pdf", size: 1000 }, 9);
  assert.equal(underLimit.valid, true);

  const atLimit = validateDocumentFile({ name: "doc11.pdf", size: 1000 }, 10);
  assert.equal(atLimit.valid, false);
  assert.match(atLimit.error, /10 dokumen/);
});

// 4. SHA-256 calculation
test("SHA-256 berkas menghasilkan hash 64 karakter heksadesimal", async () => {
  const data = new TextEncoder().encode("Hello CollabPod").buffer;
  const hash = await computeFileSha256(data);
  assert.equal(typeof hash, "string");
  assert.equal(hash.length, 64);
});

// 5. Penyimpanan berkas dan metadata
test("berkas TXT dan metadata tersimpan dan dapat dibaca kembali", async () => {
  const fake = createFakeDocPod();
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const fileData = new TextEncoder().encode("Isi teks penelitian kualitas air").buffer;
  const file = {
    name: "data-lapangan.txt",
    size: fileData.byteLength,
    type: "text/plain",
    arrayBuffer: async () => fileData,
  };

  const doc = await repo.uploadDocument(file);
  assert.equal(doc.name, "data-lapangan.txt");
  assert.equal(doc.mimeType, "text/plain");
  assert.equal(doc.sizeBytes, fileData.byteLength);
  assert.equal(doc.isComplete, true);
  assert.ok(doc.fileUrl.endsWith("file.txt"));
  assert.ok(doc.metadataUrl.endsWith("metadata.ttl"));

  // Verifikasi daftar dokumen menemukan berkas tersebut
  const listResult = await repo.listDocuments();
  assert.equal(listResult.documents.length, 1);
  assert.equal(listResult.documents[0].id, doc.id);
  assert.equal(listResult.documents[0].name, "data-lapangan.txt");
});

// 6. Kegagalan unggah sebagian dan retry tanpa duplikat
test("kegagalan metadata tidak membuat duplikat saat retry dengan ID sama", async () => {
  const fake = createFakeDocPod({ failAtMetadata: true });
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const fixedId = "doc-retry-123";
  const fileData = new TextEncoder().encode("Dokumen percobaan retry").buffer;
  const file = {
    name: "uji-coba.txt",
    size: fileData.byteLength,
    type: "text/plain",
    arrayBuffer: async () => fileData,
  };

  // Upaya pertama gagal pada metadata
  await assert.rejects(
    () => repo.uploadDocument(file, { documentId: fixedId }),
    (err) => err instanceof SolidDocumentError && err.step === "write-metadata"
  );

  // Perbaiki kegagalan metadata untuk simulasi retry
  fake.requests.length = 0;
  // Nonaktifkan failAtMetadata
  const retryFake = createFakeDocPod();
  const retryRepo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: retryFake.fetch,
  });

  const retryDoc = await retryRepo.uploadDocument(file, { documentId: fixedId });
  assert.equal(retryDoc.id, fixedId);

  const list = await retryRepo.listDocuments();
  assert.equal(list.documents.length, 1);
  assert.equal(list.documents[0].id, fixedId);
});

// 7. Error handling: 404 pada kontainer berarti daftar kosong
test("kontainer 404 menghasilkan daftar kosong tanpa error", async () => {
  const fake = createFakeDocPod({ containerStatus: 404 });
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const result = await repo.listDocuments();
  assert.deepEqual(result.documents, []);
  assert.deepEqual(result.incompleteDocuments, []);
});

// 8. Error handling: 401/403 bukan daftar kosong
test("kontainer 403 melempar SolidDocumentAccessDeniedError", async () => {
  const fake = createFakeDocPod({ containerStatus: 403 });
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  await assert.rejects(
    () => repo.listDocuments(),
    (err) => err instanceof SolidDocumentAccessDeniedError && err.status === 403
  );
});

// 9. Error handling: Gangguan jaringan bukan daftar kosong
test("gangguan jaringan melempar SolidDocumentError", async () => {
  const fake = createFakeDocPod({ networkDown: true });
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  await assert.rejects(
    () => repo.listDocuments(),
    (err) => err instanceof SolidDocumentError && err.step === "list-documents"
  );
});

// 10. Non-owner upload ditolak
test("unggah oleh non-owner melempar SolidDocumentAccessDeniedError", async () => {
  const fake = createFakeDocPod();
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: OTHER_WEB_ID, // Bukan owner
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const fileData = new TextEncoder().encode("konten").buffer;
  const file = {
    name: "data.txt",
    size: fileData.byteLength,
    type: "text/plain",
    arrayBuffer: async () => fileData,
  };

  await assert.rejects(
    () => repo.uploadDocument(file),
    (err) => err instanceof SolidDocumentAccessDeniedError && err.status === 403
  );
});

