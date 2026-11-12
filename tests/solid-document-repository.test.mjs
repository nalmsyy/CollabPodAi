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

function headerValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get(name) ?? undefined;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

function createFakeDocPod({
  containerStatus = 200,
  networkDown = false,
  failAtBinary = false,
  failAtMetadata = false,
  corruptBinaryReadback = false,
} = {}) {
  const resources = new Map();
  const requests = [];
  const flags = { failAtBinary, failAtMetadata, corruptBinaryReadback };

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

    if (flags.failAtBinary && method === "PUT" && url.includes("/file.")) {
      return respond(url, "Simulated binary upload error", { status: 500 });
    }

    if (
      flags.failAtMetadata &&
      (method === "PUT" || method === "PATCH") &&
      url.endsWith("metadata.ttl")
    ) {
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
      if (
        flags.corruptBinaryReadback &&
        url.includes("/file.") &&
        res.body instanceof ArrayBuffer
      ) {
        const truncated = res.body.slice(0, Math.max(1, res.body.byteLength - 2));
        return respond(url, truncated, {
          status: 200,
          headers: { "Content-Type": res.type },
        });
      }
      return respond(url, res.body, {
        status: 200,
        headers: { "Content-Type": res.type },
      });
    }

    if (method === "DELETE") {
      if (!resources.has(url)) {
        return respond(url, null, { status: 404 });
      }
      resources.delete(url);

      // Hapus juga referensi ldp:contains saat sub-kontainer dokumen dihapus.
      if (url !== DOCUMENTS_CONTAINER && url.startsWith(DOCUMENTS_CONTAINER)) {
        const containerRes = resources.get(DOCUMENTS_CONTAINER);
        if (containerRes) {
          containerRes.body = containerRes.body
            .split("\n")
            .filter((line) => !line.includes(`<${url}>`))
            .join("\n");
        }
      }

      return respond(url, null, { status: 205 });
    }

    if (method === "PUT") {
      // Community Solid Server menolak penulisan metadata yang sudah ada bila
      // klien mengirim If-None-Match: *. Tiru perilaku tersebut.
      if (
        url.endsWith("metadata.ttl") &&
        headerValue(init.headers, "If-None-Match") === "*" &&
        resources.has(url)
      ) {
        return respond(url, null, { status: 412 });
      }

      const contentType =
        headerValue(init.headers, "Content-Type") ?? "application/octet-stream";
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
    flags,
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
});// 6. Penyimpanan berkas PDF
 test("berkas PDF tersimpan dengan ekstensi file.pdf dan MIME application/pdf", async () => {
  const fake = createFakeDocPod();
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  const file = {
    name: "Laporan Akhir.pdf",
    size: pdfBytes.byteLength,
    type: "application/pdf",
    arrayBuffer: async () => pdfBytes.buffer,
  };

  const doc = await repo.uploadDocument(file);
  assert.equal(doc.mimeType, "application/pdf");
  assert.ok(doc.fileUrl.endsWith("/file.pdf"));

  const list = await repo.listDocuments();
  assert.equal(list.documents.length, 1);
  assert.equal(list.documents[0].name, "Laporan Akhir.pdf");
  assert.equal(list.documents[0].mimeType, "application/pdf");
  assert.equal(list.incompleteDocuments.length, 0);
});

// 7. Kegagalan unggah sebagian dan retry tanpa duplikat
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

  // Retry pada Pod yang sama setelah gangguan metadata hilang
  fake.flags.failAtMetadata = false;
  const retryDoc = await repo.uploadDocument(file, { documentId: fixedId });
  assert.equal(retryDoc.id, fixedId);

  const list = await repo.listDocuments();
  assert.equal(list.documents.length, 1);
  assert.equal(list.documents[0].id, fixedId);

  // Kontainer hanya mencantumkan satu sub-kontainer untuk ID tersebut
  const containerBody = fake.resources.get(DOCUMENTS_CONTAINER).body;
  const occurrences = containerBody.split(`${DOCUMENTS_CONTAINER}${fixedId}/`).length - 1;
  assert.equal(occurrences, 1);
});

// 7b. Retry setelah berkas & metadata terlanjur tertulis (kasus nyata di Pod)
test("retry setelah verifikasi baca ulang gagal berhasil tanpa duplikat", async () => {
  const fake = createFakeDocPod({ corruptBinaryReadback: true });
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const fixedId = "doc-retry-verify";
  const fileData = new TextEncoder().encode("Dokumen percobaan verifikasi").buffer;
  const file = {
    name: "uji-verifikasi.pdf",
    size: fileData.byteLength,
    type: "application/pdf",
    arrayBuffer: async () => fileData,
  };

  await assert.rejects(
    () => repo.uploadDocument(file, { documentId: fixedId }),
    (err) => err instanceof SolidDocumentError && err.step === "verify-readback"
  );

  // Metadata sudah ada di Pod; retry dengan ID sama harus menimpanya, bukan 412.
  fake.flags.corruptBinaryReadback = false;
  const retryDoc = await repo.uploadDocument(file, { documentId: fixedId });
  assert.equal(retryDoc.id, fixedId);

  const list = await repo.listDocuments();
  assert.equal(list.documents.length, 1);
  assert.equal(list.documents[0].id, fixedId);
  assert.equal(list.incompleteDocuments.length, 0);
});

// 7c. Baca ulang dengan isi berbeda menggagalkan verifikasi
test("berkas yang rusak saat dibaca ulang menggagalkan verifikasi", async () => {
  const fake = createFakeDocPod({ corruptBinaryReadback: true });
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const fileData = new TextEncoder().encode("konten utuh percobaan").buffer;
  const file = {
    name: "rusak.txt",
    size: fileData.byteLength,
    type: "text/plain",
    arrayBuffer: async () => fileData,
  };

  await assert.rejects(
    () => repo.uploadDocument(file),
    (err) =>
      err instanceof SolidDocumentError &&
      err.step === "verify-readback" &&
      /Ukuran berkas hasil baca ulang/.test(err.cause.message)
  );
});

// 8. Error handling: 404 pada kontainer berarti daftar kosong
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

// 9. Error handling: 401/403 bukan daftar kosong
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

// 10. Error handling: Gangguan jaringan bukan daftar kosong
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

// 11. Non-owner upload ditolak
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

// 12. Status persetujuan AI disimpan ke metadata dokumen
test("persetujuan AI tersimpan di config Owner dan terbaca saat daftar dimuat", async () => {
  const fake = createFakeDocPod();
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const fileData = new TextEncoder().encode("Isi dokumen untuk konteks AI").buffer;
  const file = {
    name: "konteks-ai.txt",
    size: fileData.byteLength,
    type: "text/plain",
    arrayBuffer: async () => fileData,
  };

  const doc = await repo.uploadDocument(file);
  assert.equal(doc.aiApproved, false);

  await repo.setAiApproved(doc, true);
  let list = await repo.listDocuments();
  assert.equal(list.documents.length, 1);
  assert.equal(list.documents[0].aiApproved, true);

  await repo.setAiApproved(list.documents[0], false);
  list = await repo.listDocuments();
  assert.equal(list.documents[0].aiApproved, false);
});

// 13. Hapus dokumen membersihkan berkas, metadata, dan kontainer
test("hapus dokumen menghapus berkas, metadata, dan kontainernya", async () => {
  const fake = createFakeDocPod();
  const repo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const fileData = new TextEncoder().encode("Dokumen yang akan dihapus").buffer;
  const file = {
    name: "hapus-saya.pdf",
    size: fileData.byteLength,
    type: "application/pdf",
    arrayBuffer: async () => fileData,
  };

  const doc = await repo.uploadDocument(file);
  await repo.deleteDocument(doc);

  const list = await repo.listDocuments();
  assert.equal(list.documents.length, 0);
  assert.equal(list.incompleteDocuments.length, 0);

  const deletedUrls = fake.requests
    .filter((request) => request.method === "DELETE")
    .map((request) => request.url);
  assert.ok(deletedUrls.includes(doc.fileUrl));
  assert.ok(deletedUrls.includes(doc.metadataUrl));
  assert.ok(
    deletedUrls.includes(`${DOCUMENTS_CONTAINER}${doc.id}/`),
    "kontainer dokumen harus ikut dihapus"
  );
});

// 14. Non-owner tidak boleh menghapus atau menyetujui dokumen
test("editor boleh mengunggah dan menghapus, tetapi tidak mengubah persetujuan AI", async () => {
  const fake = createFakeDocPod();
  const editorRepo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: OTHER_WEB_ID,
    ownerWebId: WEB_ID,
    currentUserRole: "Editor",
    fetch: fake.fetch,
  });

  const fileData = new TextEncoder().encode("Dokumen editor").buffer;
  const doc = await editorRepo.uploadDocument({
    name: "editor.txt",
    size: fileData.byteLength,
    type: "text/plain",
    arrayBuffer: async () => fileData,
  });

  await assert.rejects(
    () => editorRepo.setAiApproved(doc, true),
    (err) => err instanceof SolidDocumentAccessDeniedError && err.status === 403
  );

  await editorRepo.deleteDocument(doc);
  const list = await editorRepo.listDocuments();
  assert.equal(list.documents.length, 0);
});

// 14. Non-owner tidak boleh menghapus atau menyetujui dokumen
test("non-owner tidak dapat mengubah persetujuan AI atau menghapus dokumen", async () => {
  const fake = createFakeDocPod();
  const ownerRepo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  const fileData = new TextEncoder().encode("konten").buffer;
  const doc = await ownerRepo.uploadDocument({
    name: "bersama.txt",
    size: fileData.byteLength,
    type: "text/plain",
    arrayBuffer: async () => fileData,
  });

  const viewerRepo = new SolidDocumentRepository({
    workspaceUrl: WORKSPACE_URL,
    webId: OTHER_WEB_ID,
    ownerWebId: WEB_ID,
    fetch: fake.fetch,
  });

  await assert.rejects(
    () => viewerRepo.setAiApproved(doc, true),
    (err) => err instanceof SolidDocumentAccessDeniedError && err.status === 403
  );
  await assert.rejects(
    () => viewerRepo.deleteDocument(doc),
    (err) => err instanceof SolidDocumentAccessDeniedError && err.status === 403
  );
});


test('flag metadata tidak memberi izin AI; policy dan hash aktual wajib cocok', async () => {
  const fake=createFakeDocPod();
  const repo=new SolidDocumentRepository({workspaceUrl:WORKSPACE_URL,webId:WEB_ID,ownerWebId:WEB_ID,fetch:fake.fetch});
  const bytes=new TextEncoder().encode('Isi yang ditinjau Owner').buffer;
  const doc=await repo.uploadDocument({name:'uji.txt',size:bytes.byteLength,type:'text/plain',arrayBuffer:async()=>bytes});
  const metadata=fake.resources.get(doc.metadataUrl);
  metadata.body=String(metadata.body).replace(/aiApproved> false/,'aiApproved> true').replace(/aiApproved false/,'aiApproved true');
  assert.equal((await repo.listDocuments()).documents[0].aiApproved,false);
  await assert.rejects(()=>repo.fetchApprovedDocumentBytes(doc),/Persetujuan/);
  await repo.setAiApproved(doc,true);
  assert.ok(fake.resources.has(`${WORKSPACE_URL}config/ai-policy/${doc.id}.ttl`));
  assert.deepEqual(await repo.fetchApprovedDocumentBytes(doc),bytes);
  fake.resources.get(doc.fileUrl).body=new TextEncoder().encode('Isi telah diganti Editor').buffer;
  await assert.rejects(()=>repo.fetchApprovedDocumentBytes(doc),/Isi dokumen berubah/);
  await assert.rejects(()=>repo.setAiApproved(doc,true),/Dokumen berubah/);
  await repo.setAiApproved(doc,false);
  assert.equal((await repo.listDocuments()).documents[0].aiApproved,false);
});
