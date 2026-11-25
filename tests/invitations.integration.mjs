// Run against disposable, seeded Community Solid Server and a local production build.
import assert from "node:assert/strict";
import {
  generateDpopKeyPair,
  createDpopHeader,
  buildAuthenticatedFetch,
} from "@inrupt/solid-client-authn-core";
import { SolidPodProjectRepository } from "../src/lib/solid-project-repository.ts";
import { installInvitationGroups } from "../src/lib/solid-acl.ts";
import { SolidWorkspaceRepository } from "../src/lib/workspace-repository.ts";
import { entityMeta } from "../src/types/workspace.ts";
const css = process.env.COLLABPOD_TEST_CSS,
  app = process.env.COLLABPOD_TEST_APP;
if (!css || !app || !process.env.COLLABPOD_TEST_PASSWORD)
  throw new Error("Jalankan npm run test:collaboration.");
const index = css + ".account/";
async function json(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: { accept: "application/json", ...options.headers },
  });
  if (!r.ok)
    throw new Error(
      url + " HTTP " + r.status + " " + (await r.text()).slice(0, 240),
    );
  return r.json();
}
async function account(name) {
  const webId = css + name + "/profile/card#me";
  const { controls } = await json(index);
  const login = await fetch(controls.password.login, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      email: name + "@example.test",
      password: process.env.COLLABPOD_TEST_PASSWORD,
    }),
  });
  assert.equal(login.ok, true, "Account login " + login.status);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const owned = await json(index, { headers: { cookie } });
  const token = await json(owned.controls.account.clientCredentials, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ webId, name: "integration" }),
  });
  const key = await generateDpopKeyPair();
  const { token_endpoint: endpoint } = await json(
    css + ".well-known/openid-configuration",
  );
  const credentials = Buffer.from(
    encodeURIComponent(token.id) + ":" + encodeURIComponent(token.secret),
  ).toString("base64");
  const { access_token: accessToken } = await json(endpoint, {
    method: "POST",
    headers: {
      authorization: "Basic " + credentials,
      dpop: await createDpopHeader(endpoint, "POST", key),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "webid",
    }),
  });
  return {
    webId,
    fetch: buildAuthenticatedFetch(accessToken, { dpopKey: key }),
  };
}
async function request(auth, body, status = 200) {
  const r = await auth.fetch(app + "/api/collaboration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = await r.json();
  assert.equal(r.status, status, body.action + " " + JSON.stringify(value));
  return value;
}
const owner = await account("owner"),
  guest = await account("guest");
const pod = css + "owner/",
  repo = new SolidPodProjectRepository({ podUrl: pod, ...owner });
const p = await repo.createProject({
  name: "Riset dua akun",
  description: "Uji akses",
});
const scope = { pod, project: p.id, title: p.name };
const root = pod + "collabpod/projects/" + p.id + "/";
const team = await request(owner, { action: "register", ...scope });
await installInvitationGroups({
  workspaceUrl: root,
  ownerWebId: owner.webId,
  team: team.id,
  origin: app,
  fetch: owner.fetch,
});
await request(owner, {
  action: "invite",
  recipient: guest.webId,
  role: "Editor",
  ...scope,
});
const [inv] = await request(guest, { action: "inbox" });
assert.equal(inv.state, "pending");
await request(
  owner,
  { action: "accept", expectedRole: "Editor", id: inv.id },
  409,
);
assert.ok(
  [401, 403].includes((await guest.fetch(p.metadataUrl)).status),
  "No early read",
);
await request(guest, { action: "decline", id: inv.id });
assert.equal((await request(guest, { action: "inbox" })).length, 0);
await request(owner, {
  action: "invite",
  recipient: guest.webId,
  role: "Editor",
  ...scope,
});
const [again] = await request(guest, { action: "inbox" });
await request(
  guest,
  { action: "accept", expectedRole: "Viewer", id: again.id },
  409,
);
await request(
  owner,
  { action: "invite", recipient: guest.webId, role: "Editor", ...scope },
  409,
);
await request(guest, {
  action: "accept",
  expectedRole: "Editor",
  id: again.id,
});
assert.equal(
  (await guest.fetch(p.metadataUrl)).status,
  200,
  "Acceptance without owner action",
);
assert.equal((await request(guest, { action: "inbox" }))[0].state, "accepted");
assert.equal(
  (await request(owner, { action: "roster", owner: owner.webId, ...scope })).length,
  1,
);
assert.equal(
  (await request(guest, { action: "roster", owner: owner.webId, ...scope })).length,
  1,
);
assert.equal(
  (
    await guest.fetch(root + "config/guest-write.txt", {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "test",
    })
  ).status,
  403,
);
const shared = new SolidWorkspaceRepository({
  workspaceUrl: root,
  role: "Editor",
  fetch: guest.fetch,
});
const thread = {
  ...entityMeta("chat", guest.webId),
  title: "Metode",
  description: "",
  includeInContext: true,
  archived: false,
};
await shared.put("threads", thread, true);
await shared.appendMessage({
  ...entityMeta("message", guest.webId),
  threadId: thread.id,
  role: "user",
  content: "Catatan",
  sources: [],
});
await shared.deleteThread((await shared.read()).threads[0]);
assert.deepEqual((await shared.read()).messages, []);
await request(guest, { action: "role", id: again.id, role: "Editor" }, 409);
await request(owner, { action: "role", id: again.id, role: "Viewer" });
assert.equal((await guest.fetch(p.metadataUrl)).status, 200);
assert.equal(
  (
    await guest.fetch(root + "data/check.txt", {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "test",
    })
  ).status,
  403,
);
await request(owner, { action: "revoke", id: again.id });
assert.ok([401, 403].includes((await guest.fetch(p.metadataUrl)).status));
assert.equal((await request(guest, { action: "inbox" })).length, 0);
await request(owner, { action: "close", ...scope });
await repo.deleteProject(p.id);
assert.equal((await repo.listProjects()).length, 0);
assert.equal((await owner.fetch(root)).status, 404);
console.log(
  "PASS · two Solid accounts, pending/declined/accepted, offline owner, chat removal, downgrade, revocation and project removal",
);
