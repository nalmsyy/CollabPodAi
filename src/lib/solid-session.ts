"use client";

import type { Session } from "@inrupt/solid-client-authn-browser";

/**
 * Helper sesi Solid sisi browser.
 * SDK dimuat secara dinamis agar tidak dievaluasi saat prerender server,
 * dan seluruh proses callback dijaga agar hanya berjalan sekali per pemuatan halaman.
 */

export const SOLID_REDIRECT_PATH = "/auth/callback";
const AUTH_ERROR_STORAGE_KEY = "collabpod:solid-auth-error";

type SolidSdk = typeof import("@inrupt/solid-client-authn-browser");

let sdkPromise: Promise<SolidSdk> | null = null;

function loadSolidSdk(): Promise<SolidSdk> {
  if (!sdkPromise) {
    sdkPromise = import("@inrupt/solid-client-authn-browser");
  }
  return sdkPromise;
}

export async function getSolidSession(): Promise<Session> {
  const sdk = await loadSolidSdk();
  return sdk.getDefaultSession();
}

/**
 * WebID dan `fetch` terautentikasi dari sesi Solid aktif — dipakai untuk
 * menulis ke Pod yang dipilih pengguna.
 */
export async function getSolidSessionAuth(): Promise<{
  webId: string;
  fetch: typeof fetch;
}> {
  const session = await getSolidSession();

  if (!session.info.isLoggedIn || !session.info.webId) {
    throw new Error("Sesi Solid tidak aktif.");
  }

  return { webId: session.info.webId, fetch: session.fetch };
}

/**
 * Callback selalu berada di origin yang sedang dibuka, sehingga port preview
 * (mis. 3000, 63340) tidak pernah dikunci di kode.
 */
export function getSolidRedirectUrl(): string {
  return `${window.location.origin}${SOLID_REDIRECT_PATH}`;
}

export interface SolidSessionSnapshot {
  isLoggedIn: boolean;
  webId?: string;
}

export async function subscribeToSolidSession(
  onChange: (snapshot: SolidSessionSnapshot) => void,
  onError: (message: string) => void
): Promise<() => void> {
  const sdk = await loadSolidSdk();
  const session = sdk.getDefaultSession();

  const emitChange = () => {
    onChange({
      isLoggedIn: session.info.isLoggedIn,
      webId: session.info.webId,
    });
  };

  const emitError = (
    error: string | null,
    errorDescription?: string | Error | null
  ) => {
    onError(
      describeAuthError(
        error,
        typeof errorDescription === "string" ? errorDescription : null
      )
    );
  };

  session.events.on(sdk.EVENTS.LOGIN, emitChange);
  session.events.on(sdk.EVENTS.LOGOUT, emitChange);
  session.events.on(sdk.EVENTS.SESSION_RESTORED, emitChange);
  session.events.on(sdk.EVENTS.SESSION_EXPIRED, emitChange);
  session.events.on(sdk.EVENTS.ERROR, emitError);

  const unsubscribers: Array<() => void> = [
    () => session.events.off(sdk.EVENTS.LOGIN, emitChange),
    () => session.events.off(sdk.EVENTS.LOGOUT, emitChange),
    () => session.events.off(sdk.EVENTS.SESSION_RESTORED, emitChange),
    () => session.events.off(sdk.EVENTS.SESSION_EXPIRED, emitChange),
    () => session.events.off(sdk.EVENTS.ERROR, emitError),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

// Satu promise untuk seluruh halaman: callback OIDC diproses tepat sekali,
// termasuk saat React memanggil effect dua kali di mode pengembangan.
let redirectPromise: Promise<void> | null = null;

const RESTORE_ATTEMPT_KEY = "collabpod:solid-restore-attempts";
const MAX_RESTORE_ATTEMPTS = 2;
let restoreSkipped = false;

/**
 * Restorasi sesi memakai refresh token; bila gagal SDK akan mengalihkan ke
 * penyedia identitas secara diam-diam. Batas percobaan mencegah perulangan
 * tanpa akhir bila sesi tersimpan tidak bisa dipulihkan.
 */
function shouldAttemptRestore(): boolean {
  try {
    const attempts = Number(
      window.sessionStorage.getItem(RESTORE_ATTEMPT_KEY) ?? "0"
    );
    if (!Number.isFinite(attempts) || attempts >= MAX_RESTORE_ATTEMPTS) {
      restoreSkipped = true;
      return false;
    }
    window.sessionStorage.setItem(RESTORE_ATTEMPT_KEY, String(attempts + 1));
    return true;
  } catch {
    return true;
  }
}

export function resetRestoreAttempts(): void {
  try {
    window.sessionStorage.removeItem(RESTORE_ATTEMPT_KEY);
    restoreSkipped = false;
  } catch {
    // sessionStorage bisa diblokir; batas percobaan hanya berlaku sementara.
  }
}

/** True bila restorasi dilewati karena batas percobaan tercapai. */
export function wasRestoreSkipped(): boolean {
  return restoreSkipped;
}

function hasIncomingAuthParams(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return ["code", "state", "error", "iss"].some((key) => params.has(key));
  } catch {
    return false;
  }
}

export function completeSolidRedirectOnce(): Promise<void> {
  if (!redirectPromise) {
    redirectPromise = (async () => {
      const sdk = await loadSolidSdk();
      // Di rute callback, parameter OAuth yang harus diproses; restorasi sesi
      // tidak relevan dan tidak boleh memakai jatah percobaan.
      const incoming = hasIncomingAuthParams();
      await sdk.handleIncomingRedirect({
        restorePreviousSession: incoming ? false : shouldAttemptRestore(),
      });
    })();
  }
  return redirectPromise;
}

export async function loginWithSolid(issuer: string): Promise<void> {
  const sdk = await loadSolidSdk();
  resetRestoreAttempts();
  const session = sdk.getDefaultSession();
  await session.login({
    oidcIssuer: issuer,
    redirectUrl: getSolidRedirectUrl(),
    clientName: "CollabPod AI",
  });
}

export async function logoutSolid(): Promise<void> {
  const sdk = await loadSolidSdk();
  await sdk.getDefaultSession().logout({ logoutType: "app" });
}

export type IssuerValidation =
  | { ok: true; issuer: string }
  | { ok: false; error: string };

export function normalizeIssuer(rawIssuer: string): IssuerValidation {
  const trimmed = rawIssuer.trim();
  if (!trimmed) {
    return { ok: false, error: "URL penyedia identitas wajib diisi." };
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "URL penyedia identitas tidak valid." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Gunakan URL dengan skema http:// atau https://." };
  }

  if (url.search || url.hash) {
    return { ok: false, error: "Masukkan URL penyedia tanpa query atau fragmen." };
  }

  return { ok: true, issuer: url.href.replace(/\/$/, "") };
}

export function describeAuthError(
  code: string | null,
  description: string | null
): string {
  const shortDescription = description?.trim().slice(0, 120);

  if (!code) {
    return shortDescription || "Masuk gagal. Silakan coba lagi.";
  }

  if (
    code === "access_denied" ||
    code === "login_required" ||
    code === "consent_required"
  ) {
    return "Masuk dibatalkan di penyedia identitas. Silakan coba lagi.";
  }

  return shortDescription
    ? `Masuk gagal (${code}): ${shortDescription}`
    : `Masuk gagal (${code}). Silakan coba lagi.`;
}

/**
 * Pesan kegagalan dititipkan sebentar lewat sessionStorage karena callback
 * diakhiri dengan navigasi penuh ke /dashboard (provider sesi baru dipasang).
 */
export function rememberAuthError(message: string): void {

  try {
    window.sessionStorage.setItem(AUTH_ERROR_STORAGE_KEY, message);
  } catch {
    // sessionStorage bisa diblokir; pesan hanya informatif.
  }
}

export function consumeAuthError(): string | null {
  try {
    const message = window.sessionStorage.getItem(AUTH_ERROR_STORAGE_KEY);
    if (message) {
      window.sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
    }
    return message;
  } catch {
    return null;
  }
}
