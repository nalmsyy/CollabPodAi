import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const dir = mkdtempSync(join(tmpdir(), "collabpod-store-"));
process.env.COLLABPOD_DB = join(dir, "test.sqlite");

const store = await import("../src/lib/collaboration-store.ts");

test.after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows SQLite WAL handle mungkin masih terbuka sampai proses keluar.
  }
});

test("collaboration-store siklus lengkap register -> offer -> accept -> role -> revoke -> close", async () => {
  const owner = "https://owner.solidcommunity.net/profile/card#me";
  const pod = "https://owner.solidcommunity.net/";
  const guest = "https://guest.solidcommunity.net/profile/card#me";

  const team = await store.register(owner, pod, "prj-1", "Riset Air");
  assert.equal(team.owner, owner);
  assert.equal(team.verified, 0);

  await store.offer(team, guest, "Editor");
  assert.equal((await store.teamRoster(owner, owner, pod, "prj-1")).length, 1);
  assert.equal((await store.teamRoster(guest, owner, pod, "prj-1")).length, 0);
  const guestInbox = await store.inbox(guest);
  assert.equal(guestInbox.length, 1);
  assert.equal(guestInbox[0].state, "pending");
  assert.equal(guestInbox[0].role, "Editor");

  await store.respond(guest, guestInbox[0].id, "accepted", "Editor");
  assert.deepEqual(await store.groupMembers(team.id, "Editor"), [guest]);
  assert.equal((await store.teamRoster(guest, owner, pod, "prj-1")).length, 1);

  await store.manage(owner, guestInbox[0].id, "Viewer");
  assert.deepEqual(await store.groupMembers(team.id, "Editor"), []);
  assert.deepEqual(await store.groupMembers(team.id, "Viewer"), [guest]);

  await store.manage(owner, guestInbox[0].id);
  assert.deepEqual(await store.groupMembers(team.id, "Viewer"), []);
  assert.equal((await store.inbox(guest)).length, 0);

  await store.closeTeam(owner, pod, "prj-1");
  assert.equal(await store.teamFor(owner, pod, "prj-1"), undefined);
});
