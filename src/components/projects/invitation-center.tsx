"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Inbox, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/badge";
import { getSolidSessionAuth } from "@/lib/solid-session";
import {
  demoInvites,
  sharedHref,
  teamRequest,
  transition,
  type Invitation,
} from "@/lib/project-team";

export function useInvitations(webId: string | undefined, demo: boolean) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++version.current;
    if (!webId && !demo) return;
    try {
      const rows = demo
        ? demoInvites().filter(
            (i) => i.state === "pending" || i.state === "accepted",
          )
        : await teamRequest<Invitation[]>((await getSolidSessionAuth()).fetch, {
            action: "inbox",
          });
      if (ticket === version.current) {
        setItems(rows);
        setError("");
      }
    } catch (e) {
      if (ticket === version.current)
        setError(e instanceof Error ? e.message : "Undangan gagal dimuat.");
    } finally {
      if (ticket === version.current) setLoading(false);
    }
  }, [webId, demo]);
  useEffect(() => {
    const counter = version;
    const tick = () => {
      if (!document.hidden) void refresh();
    };
    tick();
    const timer = setInterval(tick, 15000);
    window.addEventListener("focus", tick);
    window.addEventListener("storage", tick);
    return () => {
      ++counter.current;
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      window.removeEventListener("storage", tick);
    };
  }, [refresh]);
  return { items, error, loading, refresh };
}
export function InvitationCenter({
  feed,
  demo,
  webId,
  shared,
  compact = false,
}: {
  feed: ReturnType<typeof useInvitations>;
  demo: boolean;
  webId?: string;
  shared: boolean;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [issue, setIssue] = useState("");
  const rows = feed.items.filter(
    (i) => i.state === (shared ? "accepted" : "pending"),
  );
  async function decide(item: Invitation, yes: boolean) {
    setBusy(item.id);
    setIssue("");
    setNotice("");
    try {
      const auth = demo
        ? { fetch, webId: item.recipient }
        : await getSolidSessionAuth();
      if (!demo && auth.webId !== webId)
        throw new Error("Akun Solid berubah. Muat ulang dashboard.");
      await transition(
        auth.fetch,
        demo,
        auth.webId,
        item,
        yes ? "accept" : "decline",
      );
      await feed.refresh();
      setNotice(
        yes
          ? "Undangan diterima. Proyek tersedia di Dibagikan ke saya."
          : "Undangan ditolak.",
      );
    } catch (e) {
      setIssue(e instanceof Error ? e.message : "Perubahan gagal disimpan.");
    } finally {
      setBusy("");
    }
  }
  if (compact && !rows.length && !feed.error) return null;
  return (
    <section
      className="invite-panel"
      aria-label={shared ? "Proyek bersama" : "Undangan proyek"}
    >
      <header>
        <div>
          <h2>{shared ? "Dibagikan ke saya" : "Kotak undangan"}</h2>
          <p>
            {demo
              ? "Simulasi di browser ini. WebID penerima ditampilkan pada setiap undangan."
              : shared
                ? "Proyek yang undangannya sudah kamu terima."
                : "Periksa pemilik proyek dan peranmu sebelum bergabung."}
          </p>
        </div>
        <button
          aria-label="Muat ulang undangan"
          onClick={() => void feed.refresh()}
        >
          <RefreshCw size={17} />
        </button>
      </header>
      {(issue || feed.error) && <p role="alert">{issue || feed.error}</p>}
      {notice && (
        <p role="status">
          {notice}{" "}
          {!shared && (
            <Link href="/dashboard?tab=shared">Lihat proyek bersama ↗</Link>
          )}
        </p>
      )}
      {feed.loading ? (
        <p role="status">Memuat undangan…</p>
      ) : !rows.length && !feed.error ? (
        <div className="invite-empty">
          <Inbox size={24} />
          <strong>
            {shared
              ? "Belum ada proyek bersama"
              : "Tidak ada undangan menunggu"}
          </strong>
          <span>
            {shared
              ? "Proyek akan muncul di sini setelah kamu menerima undangan."
              : "Undangan yang ditujukan ke WebID-mu akan muncul di sini."}
          </span>
        </div>
      ) : (
        rows.map((i) => (
          <article key={i.id}>
            <div>
              <h3>{i.title}</h3>
              <p>Pemilik · {i.owner}</p>
              {demo && <p>Penerima · {i.recipient}</p>}
              <RoleBadge role={i.role} />
            </div>
            <div className="invite-actions">
              {shared ? (
                <Link className="team-link" href={sharedHref(i, demo)}>
                  Buka proyek <ArrowUpRight size={15} />
                </Link>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => void decide(i, false)}
                  >
                    Tolak
                  </Button>
                  <Button
                    disabled={!!busy}
                    onClick={() => void decide(i, true)}
                  >
                    Terima
                  </Button>
                </>
              )}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
