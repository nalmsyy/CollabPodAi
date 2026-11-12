import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectContexts } from "../src/lib/project-context.ts";
import { demoWorkspaceSeed } from "../src/lib/demo-workspace.ts";

const doc = { id: "d1", aiApproved: true, sha256: "v1" };
const source = {
  id: "c1",
  kind: "document",
  documentId: "d1",
  documentHash: "v1",
  title: "Proposal",
  text: "Kualitas air",
  pageNumbers: [1],
};
const build = (
  data,
  documents = [doc],
  question = "metodologi kualitas air latar belakang",
) =>
  buildProjectContexts({
    question,
    threadId: "methods",
    data,
    documents,
    chunks: [],
  });
test("chat metodologi memperoleh keputusan dan pesan latar belakang dalam proyek yang sama", () => {
  const contexts = build(demoWorkspaceSeed());
  assert.ok(contexts.some((s) => s.kind === "decision" && s.id === "scope"));
  assert.ok(
    contexts.some(
      (s) => s.kind === "conversation" && s.threadId === "background",
    ),
  );
});
test("chat yang terputus dan diarsipkan tidak masuk pencarian antar-chat", () => {
  const data = demoWorkspaceSeed();
  data.threads[0].includeInContext = false;
  data.threads[2].archived = true;
  assert.ok(
    build(data)
      .filter((s) => s.kind === "conversation")
      .every((s) => s.threadId === "methods"),
  );
});
test("proyek baru tidak mewarisi chat atau keputusan proyek contoh", () => {
  assert.deepEqual(build(demoWorkspaceSeed("different-project")), []);
});
test("jawaban demo dan jawaban AI tanpa sumber tidak menjadi konteks berikutnya", () => {
  const data = demoWorkspaceSeed();
  const base = data.messages[0];
  data.messages = [
    {
      ...base,
      id: "demo",
      role: "assistant",
      demoReply: true,
      sources: [source],
    },
    { ...base, id: "unsupported", role: "assistant", sources: [] },
  ];
  assert.ok(!build(data).some((s) => s.kind === "conversation"));
});
test("pencabutan atau perubahan versi dokumen menolak keputusan dan jawaban turunannya", () => {
  const data = demoWorkspaceSeed();
  data.decisions = [{ ...data.decisions[0], sources: [source] }];
  data.messages = [
    { ...data.messages[0], role: "assistant", sources: [source] },
  ];
  assert.equal(build(data, [{ ...doc, aiApproved: false }]).length, 0);
  assert.equal(build(data, [{ ...doc, sha256: "v2" }]).length, 0);
});
test("perubahan keputusan membatalkan jawaban AI yang masih memakai keputusan lama", () => {
  const data = demoWorkspaceSeed();
  const old = build(data).find((s) => s.id === "scope");
  data.messages = [
    {
      ...data.messages[0],
      id: "prior-answer",
      role: "assistant",
      sources: [old],
    },
  ];
  assert.ok(build(data).some((s) => s.id === "prior-answer"));
  data.decisions[0].updatedAt = "2026-11-12T12:00:00Z";
  data.decisions[0].content = "Ruang lingkup diperbarui.";
  assert.ok(!build(data).some((s) => s.id === "prior-answer"));
  assert.ok(build(data).some((s) => s.text === "Ruang lingkup diperbarui."));
});
test("dependensi dokumen dan keputusan diwariskan melewati dua jawaban antar-chat", () => {
  const data = demoWorkspaceSeed();
  data.decisions[0].sources = [source];
  const firstSources = build(data);
  data.messages.push({
    ...data.messages[0],
    id: "a1",
    role: "assistant",
    content: "laporan ilmiah",
    sources: firstSources,
  });
  const fromFirst = build(data, [doc], "laporan ilmiah").find(
    (s) => s.id === "a1",
  );
  assert.ok(fromFirst.evidence.some((e) => e.documentId === "d1"));
  assert.ok(fromFirst.dependencies.some((e) => e.id === "scope"));
  data.messages.push({
    ...data.messages[0],
    id: "a2",
    role: "assistant",
    threadId: "results",
    content: "laporan ilmiah",
    sources: [fromFirst],
  });
  assert.ok(build(data, [doc], "laporan ilmiah").some((s) => s.id === "a2"));
  data.decisions[0].active = false;
  assert.ok(
    !build(data, [doc], "laporan ilmiah").some(
      (s) => s.id === "a1" || s.id === "a2",
    ),
  );
});
test("sumber dibatasi dan chunk dokumen yang belum disetujui tidak diteruskan", () => {
  const data = demoWorkspaceSeed();
  data.decisions = Array.from({ length: 15 }, (_, i) => ({
    ...data.decisions[0],
    id: `d-${i}`,
    content: "x".repeat(9000),
  }));
  const result = buildProjectContexts({
    question: "kualitas air",
    threadId: "methods",
    data,
    documents: [],
    chunks: [
      {
        id: "bad",
        documentId: "bad",
        text: "Tidak disetujui",
        pageNumbers: [],
      },
    ],
  });
  assert.ok(result.length <= 12);
  assert.ok(result.reduce((n, s) => n + s.text.length, 0) <= 23000);
  assert.ok(result.every((s) => s.kind !== "document"));
});
