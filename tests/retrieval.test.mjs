import test from "node:test";
import assert from "node:assert/strict";
import {
  chunkDocumentText,
  clearRetrievalCache,
  countWords,
  getApprovedContexts,
  searchApprovedContexts,
  searchChunks,
  tokenize,
} from "../src/lib/retrieval.ts";

const WORKSPACE_WORDS = Array.from(
  { length: 20 },
  (_, index) => `kata${index + 1}`
).join(" ");

/** Satu kalimat panjang yang tidak terpotong oleh chunker. */
function sentence(label = "isi") {
  return `${label} ${WORKSPACE_WORDS}.`;
}

function page(pageNumber, sentenceCount, label = "isi") {
  return {
    pageNumber,
    text: Array.from({ length: sentenceCount }, () => sentence(label)).join(
      " "
    ),
  };
}

function makeDoc({
  id,
  name = `${id}.txt`,
  aiApproved = true,
  mimeType = "text/plain",
}) {
  return {
    id,
    name,
    fileUrl: `https://pod.example/workspace/data/documents/${id}/file.txt`,
    metadataUrl: `https://pod.example/workspace/data/documents/${id}/metadata.ttl`,
    mimeType,
    sizeBytes: 100,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    uploaderWebId: "https://pod.example/alice/profile/card#me",
    sha256: `sha-${id}`,
    aiApproved,
    isComplete: true,
  };
}

function makeChunk(id, text) {
  return {
    id,
    documentId: id,
    documentName: `${id}.txt`,
    fileUrl: `https://pod.example/${id}.txt`,
    pageNumbers: [1],
    text,
    wordCount: countWords(text),
  };
}

function createFakeRepository(entries) {
  const calls = { list: 0, fetchBytes: [] };
  return {
    calls,
    async listDocuments() {
      calls.list += 1;
      return {
        documents: entries.map((entry) => entry.document),
        incompleteDocuments: [],
      };
    },
    async fetchDocumentBytes(document) {
      calls.fetchBytes.push(document.id);
      const entry = entries.find((item) => item.document.id === document.id);
      if (entry?.failure) {
        throw entry.failure;
      }
      return new TextEncoder().encode(entry.text).buffer;
    },
  };
}

// 1. Chunking menghasilkan potongan 300–500 kata
test("chunkDocumentText memecah teks panjang menjadi potongan 300–500 kata", () => {
  const pages = [page(1, 50)]; // 50 kalimat × 21 kata ≈ 1.050 kata
  const chunks = chunkDocumentText(pages);

  assert.ok(chunks.length >= 2, "teks panjang harus menghasilkan >1 potongan");
  for (const chunk of chunks) {
    assert.ok(
      chunk.wordCount <= 500,
      `potongan ${chunk.wordCount} kata melebihi batas 500`
    );
  }
  const fullChunks = chunks.slice(0, -1);
  for (const chunk of fullChunks) {
    assert.ok(
      chunk.wordCount >= 300,
      `potongan penuh ${chunk.wordCount} kata di bawah 300`
    );
  }
  assert.equal(
    chunks.reduce((total, chunk) => total + chunk.wordCount, 0),
    50 * 21
  );
});

// 2. Potongan melintasi halaman dan mencatat nomor halamannya
test("chunkDocumentText mencatat nomor halaman asal potongan", () => {
  const chunks = chunkDocumentText([page(1, 20), page(2, 20), page(3, 4)]);

  assert.equal(chunks.length, 3);
  assert.deepEqual(chunks[0].pageNumbers, [1]);
  assert.deepEqual(chunks[1].pageNumbers, [2]);
  assert.deepEqual(chunks[chunks.length - 1].pageNumbers, [3]);
});

// 3. Kalimat yang lebih panjang dari batas kata dipotong paksa
test("chunkDocumentText memotong kalimat raksasa agar tidak melebihi 500 kata", () => {
  const giant = Array.from({ length: 640 }, (_, index) => `kata${index}`).join(
    " "
  );
  const chunks = chunkDocumentText([{ pageNumber: 1, text: giant }]);

  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.wordCount <= 500);
  }
});

// 4. Tokenisasi membuang kata umum dan tanda baca
test("tokenize membuang stopword, tanda baca, dan token pendek", () => {
  assert.deepEqual(tokenize("Bagaimana anggaran IRIGASI di proyek ini?"), [
    "anggaran",
    "irigasi",
    "proyek",
  ]);
});

// 5. BM25 mengurutkan potongan paling relevan lebih dulu
test("searchChunks mengembalikan potongan paling relevan di urutan pertama", () => {
  const chunks = [
    makeChunk(
      "panen",
      "Laporan panen padi membahas cuaca, hama, dan jadwal tanam musim ini."
    ),
    makeChunk(
      "irigasi",
      "Anggaran irigasi dialokasikan untuk pompa air dan perbaikan saluran irigasi tersier."
    ),
    makeChunk(
      "anggaran",
      "Anggaran umum proyek mencakup honor tim dan perjalanan dinas."
    ),
  ];

  const results = searchChunks("berapa anggaran irigasi?", chunks);

  assert.ok(results.length > 0);
  assert.equal(results[0].id, "irigasi");
  assert.ok(results[0].score > 0);
  assert.deepEqual(results[0].matchedTerms.sort(), ["anggaran", "irigasi"]);
});

// 6. Query tanpa kata kunci bermakna mengembalikan hasil kosong
test("searchChunks mengembalikan array kosong untuk query stopword saja", () => {
  const chunks = [makeChunk("a", "Dokumen ini membahas irigasi sawah.")];
  assert.deepEqual(searchChunks("apa itu yang bagaimana", chunks), []);
  assert.deepEqual(searchChunks("", chunks), []);
  assert.deepEqual(searchChunks("irigasi", []), []);
});

// 7. Jumlah hasil dibatasi 3–5 potongan
test("searchChunks menjepit topK ke rentang 3–5", () => {
  const chunks = Array.from({ length: 10 }, (_, index) =>
    makeChunk(`c${index}`, `Potongan irigasi nomor ${index}.`)
  );

  assert.equal(searchChunks("irigasi", chunks, { topK: 99 }).length, 5);
  assert.equal(searchChunks("irigasi", chunks, { topK: 1 }).length, 3);
  assert.equal(searchChunks("irigasi", chunks).length, 4);
});

// 8. Hanya dokumen yang disetujui yang dipakai sebagai konteks
test("getApprovedContexts hanya mengekstrak dokumen yang disetujui", async () => {
  clearRetrievalCache();
  const approvedText = `${sentence("irigasi")} ${sentence("anggaran")}`;
  const repository = createFakeRepository([
    {
      document: makeDoc({ id: "disetujui", aiApproved: true }),
      text: approvedText,
    },
    {
      document: makeDoc({ id: "belum", aiApproved: false }),
      text: sentence("rahasia"),
    },
  ]);

  const context = await getApprovedContexts("prj-1", { repository });

  assert.deepEqual(
    context.approvedDocuments.map((doc) => doc.id),
    ["disetujui"]
  );
  assert.deepEqual(repository.calls.fetchBytes, ["disetujui"]);
  assert.equal(context.chunks.length, 1);
  assert.equal(context.chunks[0].documentId, "disetujui");
  assert.deepEqual(context.chunks[0].pageNumbers, [1]);
  assert.equal(context.fromCache, false);
});

// 9. Konteks di-cache selama daftar dokumen tidak berubah
test("getApprovedContexts memakai cache saat dokumen tidak berubah", async () => {
  clearRetrievalCache();
  const repository = createFakeRepository([
    {
      document: makeDoc({ id: "a" }),
      text: `${sentence("irigasi")} ${sentence("panen")}`,
    },
  ]);

  const first = await getApprovedContexts("prj-2", { repository });
  const second = await getApprovedContexts("prj-2", { repository });
  const forced = await getApprovedContexts("prj-2", {
    repository,
    force: true,
  });

  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(forced.fromCache, false);
  assert.equal(repository.calls.list, 3, "force harus membaca ulang daftar dokumen");
  assert.equal(
    repository.calls.fetchBytes.length,
    1,
    "teks yang sudah diekstrak boleh dipakai ulang"
  );
});

// 10. Persetujuan yang dicabut membuat konteks lama tidak dipakai
test("getApprovedContexts mengabaikan dokumen yang persetujuannya dicabut", async () => {
  clearRetrievalCache();
  const entry = {
    document: makeDoc({ id: "a", aiApproved: true }),
    text: sentence("irigasi"),
  };
  const repository = createFakeRepository([entry]);

  const first = await getApprovedContexts("prj-3", { repository });
  assert.equal(first.chunks.length, 1);

  entry.document = makeDoc({ id: "a", aiApproved: false });
  const second = await getApprovedContexts("prj-3", { repository });

  assert.equal(second.chunks.length, 0);
  assert.equal(second.fromCache, false);
  assert.equal(second.approvedDocuments.length, 0);
});

// 11. Dokumen yang gagal diekstrak dicatat tanpa menggagalkan proses
test("getApprovedContexts mencatat dokumen gagal ekstraksi pada skipped", async () => {
  clearRetrievalCache();
  const repository = createFakeRepository([
    {
      document: makeDoc({ id: "rusak" }),
      text: "",
      failure: new Error("Berkas tidak dapat diunduh dari Pod."),
    },
    {
      document: makeDoc({ id: "baik" }),
      text: sentence("irigasi"),
    },
  ]);

  const context = await getApprovedContexts("prj-4", {
    repository,
    force: true,
  });

  assert.equal(context.chunks.length, 1);
  assert.equal(context.skipped.length, 1);
  assert.equal(context.skipped[0].documentId, "rusak");
  assert.match(context.skipped[0].reason, /tidak dapat diunduh/i);
});

// 12. Pencarian end-to-end hanya menyentuh teks dokumen disetujui
test("searchApprovedContexts mengembalikan potongan dari dokumen disetujui saja", async () => {
  clearRetrievalCache();
  const repository = createFakeRepository([
    {
      document: makeDoc({ id: "laporan-irigasi" }),
      text: `${sentence("irigasi")} ${sentence("saluran")}`,
    },
    {
      document: makeDoc({ id: "catatan-pribadi", aiApproved: false }),
      text: `${sentence("irigasi")} ${sentence("rahasia")}`,
    },
  ]);

  const result = await searchApprovedContexts(
    "prj-5",
    "bagaimana kondisi irigasi?",
    { repository, topK: 5 }
  );

  assert.equal(result.totalChunks, 1);
  assert.equal(result.chunks.length, 1);
  assert.equal(result.chunks[0].documentId, "laporan-irigasi");
  assert.ok(result.chunks[0].matchedTerms.includes("irigasi"));
  assert.deepEqual(
    result.approvedDocuments.map((doc) => doc.id),
    ["laporan-irigasi"]
  );
});

// 13. Query yang tidak cocok menghasilkan daftar kosong, bukan error
test("searchApprovedContexts mengembalikan chunks kosong bila tidak ada kecocokan", async () => {
  clearRetrievalCache();
  const repository = createFakeRepository([
    {
      document: makeDoc({ id: "a" }),
      text: sentence("irigasi"),
    },
  ]);

  const result = await searchApprovedContexts("prj-6", "harga saham", {
    repository,
  });

  assert.deepEqual(result.chunks, []);
  assert.equal(result.totalChunks, 1);
});
