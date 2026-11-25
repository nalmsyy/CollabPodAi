import { createSolidTokenVerifier } from "@solid/access-token-verifier";
import {
  CollaborationError,
  closeTeam,
  inbox,
  manage,
  offer,
  register,
  respond,
  teamFor,
  teamRoster,
} from "@/lib/collaboration-store";

const verify = createSolidTokenVerifier();
const defaults = [
  "https://solidcommunity.net",
  "https://inrupt.net",
  "https://login.inrupt.com",
  "https://storage.inrupt.com",
  "https://id.inrupt.com",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];
function permitted(raw: string) {
  const url = new URL(raw);
  if (url.username || url.password) return false;
  const origins = (process.env.COLLABPOD_SOLID_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...defaults, ...origins].some((origin) => {
    const trusted = new URL(origin);
    return (
      url.origin === trusted.origin ||
      (["solidcommunity.net", "inrupt.net"].includes(trusted.hostname) &&
        url.protocol === "https:" &&
        !url.port &&
        url.hostname.endsWith("." + trusted.hostname))
    );
  });
}
async function identity(request: Request) {
  const auth = request.headers.get("authorization") || "";
  try {
    if (!auth.startsWith("DPoP ")) throw Error();
    const claims = JSON.parse(
      Buffer.from(auth.split(".")[1], "base64url").toString(),
    );
    if (!permitted(claims.iss) || !permitted(claims.webid))
      throw new CollaborationError(
        403,
        "Origin penyedia Solid belum tercantum di COLLABPOD_SOLID_ORIGINS.",
      );
    const url = new URL(request.url);
    const result = await verify(auth, {
      header: request.headers.get("dpop") || "",
      method: "POST",
      url: new URL(url.pathname, process.env.COLLABPOD_ORIGIN || url.origin)
        .href,
    });
    return result.webid;
  } catch (err) {
    if (err instanceof CollaborationError) throw err;
    throw new CollaborationError(
      401,
      "Masuk kembali dengan akun Solid untuk membuka undangan.",
    );
  }
}
function textValue(value: unknown, max = 2000) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new CollaborationError(400, "Isian undangan tidak valid.");
  return value.trim();
}
function webId(value: unknown) {
  const raw = textValue(value);
  if (!/^https?:\/\//.test(raw) || /[\s<>"{}|^\\`]/.test(raw))
    throw new CollaborationError(400, "Masukkan WebID Solid yang lengkap.");
  new URL(raw);
  return raw;
}
function role(value: unknown) {
  if (value !== "Editor" && value !== "Viewer")
    throw new CollaborationError(400, "Pilih Editor atau Viewer.");
  return value;
}
export async function POST(request: Request) {
  try {
    const actor = await identity(request);
    const input = await request.json();
    let result: unknown = {};
    if (input.action === "inbox") result = inbox(actor);
    else if (input.action === "accept" || input.action === "decline")
      respond(
        actor,
        textValue(input.id, 64),
        input.action === "accept" ? "accepted" : "declined",
        input.action === "accept" ? role(input.expectedRole) : undefined,
      );
    else if (input.action === "role" || input.action === "revoke")
      manage(
        actor,
        textValue(input.id, 64),
        input.action === "role" ? role(input.role) : undefined,
      );
    else {
      const pod = new URL(textValue(input.pod));
      if (!permitted(pod.href) || pod.search || pod.hash)
        throw new CollaborationError(
          400,
          "Origin Pod belum dikonfigurasi untuk kolaborasi.",
        );
      const base = pod.href.replace(/\/*$/, "/");
      const project = textValue(input.project, 120);
      if (!/^[a-zA-Z0-9_-]+$/.test(project))
        throw new CollaborationError(400, "ID proyek tidak valid.");
      if (input.action === "roster")
        result = teamRoster(actor, webId(input.owner), base, project);
      else if (input.action === "register")
        result = register(actor, base, project, textValue(input.title, 200));
      else if (input.action === "close") closeTeam(actor, base, project);
      else if (input.action === "invite") {
        const team = teamFor(actor, base, project);
        if (!team)
          throw new CollaborationError(
            403,
            "Hanya pemilik dapat mengirim undangan.",
          );
        if (!team.verified) {
          // This public nonce lives outside the writable data tree. Only the Pod owner can install it.
          const proof = await fetch(
            base +
              "collabpod/projects/" +
              project +
              "/collaboration-binding.txt",
            {
              cache: "no-store",
              redirect: "error",
              signal: AbortSignal.timeout(8000),
            },
          );
          if (!proof.ok || (await proof.text()).trim() !== team.id)
            throw new CollaborationError(
              403,
              "Pod belum mengonfirmasi pengaturan undangan oleh pemilik.",
            );
        }
        offer(team, webId(input.recipient), role(input.role));
      } else throw new CollaborationError(400, "Permintaan tidak dikenali.");
    }
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    const known = err instanceof CollaborationError;
    return Response.json(
      {
        error: known
          ? err.message
          : "Layanan undangan belum tersedia. Periksa koneksi dan penyimpanan server.",
      },
      { status: known ? err.status : 503 },
    );
  }
}
