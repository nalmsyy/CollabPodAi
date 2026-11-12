import test from "node:test";
import assert from "node:assert/strict";
import { SolidWorkspaceRepository } from "../src/lib/workspace-repository.ts";
const root = "https://pod.example/alice/collabpod/projects/p1/";
const base = {
  createdAt: "2026-11-11T10:00:00Z",
  updatedAt: "2026-11-11T10:00:00Z",
  createdBy: "https://pod.example/alice/#me",
};
function pod() {
  const resources = new Map();
  let counter = 0;
  let blocked = false;
  const respond = (url, body, status = 200, headers = {}) => {
    const r = new Response(body, { status, headers });
    Object.defineProperty(r, "url", { value: url });
    return r;
  };
  const fetch = async (input, init = {}) => {
    const url = String(input),
      method = init.method ?? "GET";
    const item = resources.get(url);
    const headers = new Headers(init.headers);
    if (blocked) return respond(url, null, 403);
    if (method === "HEAD") return respond(url, null, item ? 200 : 404);
    if (method === "GET") {
      if (!item) return respond(url, null, 404);
      let body = item.body;
      if (url.endsWith("/"))
        body =
          `<${url}> a <http://www.w3.org/ns/ldp#BasicContainer>.\n` +
          [...resources.keys()]
            .filter(
              (key) =>
                key.startsWith(url) &&
                key !== url &&
                !key.slice(url.length).replace(/\/$/, "").includes("/"),
            )
            .map(
              (key) => `<${url}> <http://www.w3.org/ns/ldp#contains> <${key}>.`,
            )
            .join("\n");
      return respond(url, body, 200, {
        "Content-Type": "text/turtle",
        ETag: item.etag,
      });
    }
    if (method === "PUT") {
      if (headers.get("if-none-match") === "*" && item)
        return respond(url, null, 412);
      if (headers.has("if-match") && headers.get("if-match") !== item?.etag)
        return respond(url, null, 412);
      resources.set(url, {
        body: String(init.body ?? ""),
        etag: `"v${++counter}"`,
      });
      return respond(url, null, 201);
    }
    return respond(url, null, 405);
  };
  return {
    fetch,
    resources,
    block: () => {
      blocked = true;
    },
  };
}
const thread = (id) => ({
  ...base,
  id,
  title: id,
  description: "Riset",
  includeInContext: true,
  archived: false,
});
test("dua anggota dapat membuat pesan terpisah tanpa kehilangan tulisan", async () => {
  const fake = pod();
  const a = new SolidWorkspaceRepository({
    workspaceUrl: root,
    role: "Owner",
    fetch: fake.fetch,
  });
  const b = new SolidWorkspaceRepository({
    workspaceUrl: root,
    role: "Editor",
    fetch: fake.fetch,
  });
  await a.put("threads", thread("methods"), true);
  await Promise.all([
    a.put(
      "messages",
      {
        ...base,
        id: "a",
        threadId: "methods",
        role: "user",
        content: "Latar belakang",
        sources: [],
      },
      true,
    ),
    b.put(
      "messages",
      {
        ...base,
        id: "b",
        threadId: "methods",
        role: "user",
        content: "Metodologi",
        sources: [],
      },
      true,
    ),
  ]);
  assert.deepEqual(
    (await a.read()).messages.map((m) => m.id),
    ["a", "b"],
  );
  assert.ok(fake.resources.has(`${root}data/messages/a.ttl`));
});
test("pembaruan memakai ETag dan menolak perubahan dari salinan lama", async () => {
  const fake = pod();
  const repo = new SolidWorkspaceRepository({
    workspaceUrl: root,
    role: "Editor",
    fetch: fake.fetch,
  });
  await repo.put("threads", thread("one"), true);
  const original = (await repo.read()).threads[0];
  assert.ok(original.etag);
  await repo.put("threads", { ...original, title: "Updated" });
  await assert.rejects(
    () => repo.put("threads", { ...original, title: "Stale" }),
    (e) => e.status === 412,
  );
  assert.equal((await repo.read()).threads[0].title, "Updated");
});
test("Viewer tidak menulis dan akses dicabut tidak dibaca sebagai proyek kosong", async () => {
  const fake = pod();
  const repo = new SolidWorkspaceRepository({
    workspaceUrl: root,
    role: "Viewer",
    fetch: fake.fetch,
  });
  await assert.rejects(
    () => repo.put("threads", thread("x"), true),
    (e) => e.status === 403,
  );
  fake.block();
  await assert.rejects(
    () => repo.read(),
    (e) => e.statusCode === 403,
  );
});
test("ID resource dan ETag lemah ditolak sebelum menulis", async () => {
  const fake = pod();
  const repo = new SolidWorkspaceRepository({
    workspaceUrl: root,
    role: "Owner",
    fetch: fake.fetch,
  });
  await assert.rejects(
    () => repo.put("threads", thread("../config"), true),
    /ID resource/,
  );
  await assert.rejects(
    () => repo.put("threads", { ...thread("x"), etag: 'W/"1"' }),
    /ETag/,
  );
});
test("repositori membaca hanya workspace yang diminta", async () => {
  const fake = pod();
  const a = new SolidWorkspaceRepository({
    workspaceUrl: root,
    role: "Owner",
    fetch: fake.fetch,
  });
  const b = new SolidWorkspaceRepository({
    workspaceUrl: root.replace("p1/", "p2/"),
    role: "Owner",
    fetch: fake.fetch,
  });
  await a.put("threads", thread("private"), true);
  assert.equal((await b.read()).threads.length, 0);
});
