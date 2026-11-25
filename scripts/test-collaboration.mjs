// Runs the two-account regression only against temporary Pods and a temporary invitation database.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
const require = createRequire(import.meta.url);
async function port() {
  const listener = createServer().listen(0, "127.0.0.1");
  await once(listener, "listening");
  const value = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return value;
}
const folder = await mkdtemp(join(tmpdir(), "collabpod-integration-"));
const appPort = await port();
let podPort = await port();
while (podPort === appPort) podPort = await port();
const css = "http://localhost:" + podPort + "/",
  app = "http://localhost:" + appPort;
const env = {
  ...process.env,
  COLLABPOD_TEST_CSS: css,
  COLLABPOD_TEST_APP: app,
  COLLABPOD_ORIGIN: app,
  COLLABPOD_SOLID_ORIGINS: css,
  COLLABPOD_DB: join(folder, "invites.sqlite"),
  COLLABPOD_TEST_PASSWORD: randomUUID(),
};
const services = [];
function start(args) {
  const child = spawn(process.execPath, args, {
    env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  services.push(child);
  return child;
}
async function ready(url) {
  for (let tries = 0; tries < 180; tries++) {
    if (services.some((child) => child.exitCode !== null))
      throw Error(
        "Server pengujian berhenti sebelum siap. Jalankan npm run build terlebih dahulu.",
      );
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error("Server pengujian belum siap.");
}
try {
  const seed = join(folder, "seed.json");
  await writeFile(
    seed,
    JSON.stringify(
      ["owner", "guest"].map((name) => ({
        email: name + "@example.test",
        password: env.COLLABPOD_TEST_PASSWORD,
        pods: [{ name, settings: { linkStorage: true } }],
      })),
    ),
  );
  start([
    require.resolve("@solid/community-server/bin/server.js"),
    "-c",
    "@css:config/file.json",
    "-f",
    join(folder, "pods"),
    "-p",
    String(podPort),
    "-b",
    css,
    "--seedConfig",
    seed,
  ]);
  start([
    require.resolve("next/dist/bin/next"),
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    String(appPort),
  ]);
  await Promise.all([ready(css + ".account/"), ready(app)]);
  const test = spawn(process.execPath, ["tests/invitations.integration.mjs"], {
    env,
    stdio: "inherit",
  });
  const [code] = await once(test, "exit");
  process.exitCode = code ?? 1;
} finally {
  await Promise.all(
    services.map(async (child) => {
      if (child.exitCode === null && child.signalCode === null) {
        const done = once(child, "exit");
        child.kill();
        await done;
      }
    }),
  );
  await rm(folder, { recursive: true, force: true });
}
