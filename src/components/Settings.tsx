import { useMemo, useState } from "react";
import { npubEncode } from "nostr-tools/nip19";
import { useSigner } from "../hooks/useSigner";
import { useProfiles } from "../hooks/useNips";
import { useRelayStatus } from "../hooks/useRelayStatus";
import { dataLayer } from "../nostr/bootstrap";
import { isValidRelay, loadRelays, saveRelays } from "../nostr/relays";
import { toast } from "../lib/toast";
import type { WebOfTrust } from "../hooks/useWebOfTrust";
import type { UserRelays } from "../hooks/useUserRelays";

function short(pubkey: string): string {
  try {
    const n = npubEncode(pubkey);
    return `${n.slice(0, 12)}…${n.slice(-4)}`;
  } catch {
    return pubkey.slice(0, 12);
  }
}

export function Settings({
  pubkey,
  wot,
  userRelays,
  onOpenLogin,
  onBack,
}: {
  pubkey: string | null;
  wot: WebOfTrust;
  userRelays: UserRelays;
  onOpenLogin: () => void;
  onBack: () => void;
}) {
  const { accounts, switchAccount, logout } = useSigner();
  const status = useRelayStatus();
  const topPubkeys = useMemo(
    () => wot.stats.top.map((t) => t.pubkey),
    [wot.stats.top],
  );
  const profiles = useProfiles(topPubkeys);

  const [relays, setRelays] = useState<string[]>(() => loadRelays());
  const [newRelay, setNewRelay] = useState("");

  const addRelay = () => {
    const url = newRelay.trim();
    if (!isValidRelay(url)) {
      toast.error("Enter a valid wss:// relay URL.");
      return;
    }
    if (relays.includes(url)) {
      toast.info("That relay is already in your list.");
      return;
    }
    setRelays([...relays, url]);
    setNewRelay("");
  };

  const applyRelays = (next: string[]) => {
    const saved = saveRelays(next);
    setRelays(saved);
    dataLayer.setUserRelays(saved);
    toast.success("Relays updated.");
  };

  const healthOf = (url: string) =>
    status.relays.find((r) => r.relay === url);

  return (
    <div className="settings">
      <button className="back-link" onClick={onBack}>
        ← Back to NIPs
      </button>
      <h1 className="page-title">Settings</h1>

      <section className="panel-section">
        <h2 className="section-title">Your web of trust</h2>
        {!pubkey ? (
          <p className="muted-block">
            Connect a signer to compute your web of trust.{" "}
            <button className="link-btn" onClick={onOpenLogin}>
              Connect
            </button>
          </p>
        ) : (
          <>
            <div className="stat-grid">
              <Stat label="Direct follows" value={wot.stats.directFollows} />
              <Stat
                label="2nd-degree discovered"
                value={wot.stats.discovered}
              />
              <Stat label="Trust set" value={wot.stats.total} />
              <Stat
                label="Follow lists merged"
                value={wot.stats.seedsResolved}
              />
            </div>
            <p className="compute-note">
              {wot.computing
                ? "Recomputing in a background worker…"
                : "Computed off the main thread and cached per account — every follow and every follows-of-follows account, ranked by how many of your follows vouch for them. No cap."}
            </p>

            {wot.stats.top.length > 0 && (
              <>
                <h3 className="subsection-title">
                  Most-vouched-for in your network
                </h3>
                <ul className="vouch-list">
                  {wot.stats.top.map((v) => {
                    const p = profiles.get(v.pubkey);
                    return (
                      <li key={v.pubkey} className="vouch-row">
                        {p?.picture ? (
                          <img className="avatar sm" src={p.picture} alt="" />
                        ) : (
                          <div className="avatar sm placeholder" />
                        )}
                        <span className="vouch-name">
                          {p?.name || short(v.pubkey)}
                        </span>
                        <span className="vouch-count">
                          {v.vouches} vouch{v.vouches === 1 ? "" : "es"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      <section className="panel-section">
        <h2 className="section-title">
          Relays
          <span
            className={`source-badge ${userRelays.source}`}
            title={
              userRelays.source === "nip65"
                ? "From your NIP-65 relay list (kind 10002)"
                : "No NIP-65 list found — using a fallback list"
            }
          >
            {userRelays.source === "nip65" ? "NIP-65" : "fallback"}
          </span>
        </h2>

        {userRelays.source === "nip65" ? (
          <>
            <ul className="relay-list">
              {userRelays.entries.map((e) => {
                const h = healthOf(e.url);
                const state = h?.connected
                  ? "connected"
                  : h?.connecting || h?.reconnecting
                    ? "connecting"
                    : "idle";
                return (
                  <li key={e.url} className="relay-row">
                    <span className={`relay-dot ${state}`} />
                    <span className="relay-url mono">{e.url}</span>
                    <span className="relay-rw">
                      {e.read && e.write
                        ? "read/write"
                        : e.read
                          ? "read"
                          : "write"}
                    </span>
                    <span className="relay-state">{state}</span>
                  </li>
                );
              })}
            </ul>
            <p className="compute-note">
              These come from your published <strong>NIP-65</strong> relay list.
              Edit it in your main Nostr client and it’ll update here.
            </p>
          </>
        ) : (
          <>
            <p className="compute-note" style={{ marginTop: 0 }}>
              No NIP-65 relay list found for this account. Publish one and it
              takes over automatically — until then, this fallback is used.
            </p>
            <ul className="relay-list">
              {relays.map((url) => {
                const h = healthOf(url);
                const state = h?.connected
                  ? "connected"
                  : h?.connecting || h?.reconnecting
                    ? "connecting"
                    : "idle";
                return (
                  <li key={url} className="relay-row">
                    <span className={`relay-dot ${state}`} />
                    <span className="relay-url mono">{url}</span>
                    <span className="relay-state">{state}</span>
                    <button
                      className="icon-btn sm"
                      title="Remove"
                      onClick={() => applyRelays(relays.filter((r) => r !== url))}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="relay-add">
              <input
                className="search"
                placeholder="wss://relay.example.com"
                value={newRelay}
                onChange={(e) => setNewRelay(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRelay()}
              />
              <button className="btn ghost" onClick={addRelay}>
                Add
              </button>
              <button
                className="btn"
                onClick={() => applyRelays(relays)}
                disabled={
                  JSON.stringify(relays) === JSON.stringify(loadRelays())
                }
              >
                Save
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel-section">
        <h2 className="section-title">Accounts</h2>
        {accounts.length === 0 ? (
          <p className="muted-block">
            No accounts yet.{" "}
            <button className="link-btn" onClick={onOpenLogin}>
              Connect one
            </button>
          </p>
        ) : (
          <ul className="account-list">
            {accounts.map((a) => (
              <li key={a.pubkey} className="account-list-row">
                <span className="mono">{short(a.pubkey)}</span>
                <span className="method-tag">{a.method}</span>
                {a.pubkey === pubkey ? (
                  <span className="active-tag">active</span>
                ) : (
                  <button
                    className="link-btn"
                    onClick={() => void switchAccount(a.pubkey)}
                  >
                    Switch
                  </button>
                )}
                <button
                  className="link-btn danger"
                  onClick={() => void logout(a.pubkey)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="btn ghost" onClick={onOpenLogin}>
          Add another account
        </button>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-value">
        {value.toLocaleString()}
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
