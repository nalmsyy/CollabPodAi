"use client";

import { getSolidSession } from "@/lib/solid-session";

/**
 * Membaca daftar Pod dari profil Solid (`pim:storage`) memakai sesi aktif.
 * Alamat Pod tidak pernah ditebak dari potongan URL WebID.
 */
export async function fetchPodUrls(webId: string): Promise<string[]> {
  const session = await getSolidSession();

  if (!session.info.isLoggedIn) {
    throw new Error("Sesi Solid tidak aktif.");
  }

  const { getPodUrlAll } = await import("@inrupt/solid-client");
  const podUrls = await getPodUrlAll(webId, { fetch: session.fetch });

  // Deduplikasi + rapikan garis miring di akhir agar satu Pod tidak tampil dua kali.
  const normalized = podUrls
    .map((podUrl) => podUrl.trim())
    .filter((podUrl) => podUrl.length > 0)
    .map((podUrl) => podUrl.replace(/\/+$/, ""));

  return Array.from(new Set(normalized));
}
