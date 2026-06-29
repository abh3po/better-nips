import { useMemo, useState } from "react";
import { decode } from "nostr-tools/nip19";
import {
  useNipFeed,
  useProfiles,
  type ScoredNip,
  type Surface,
} from "../hooks/useNips";
import { useApprove } from "../hooks/useApprove";
import { naddrOf } from "../nostr/nips";
import { NipCard } from "./NipCard";

type Sort = "top" | "new";
type ApprovedBy = "anyone" | "me" | "follows" | "wot" | "pubkey";

function matchesQuery(nip: ScoredNip, q: string): boolean {
  if (!q) return true;
  const hay = [
    nip.title,
    nip.summary,
    nip.d,
    nip.content,
    ...nip.kinds.map((k) => `kind ${k.kind} ${k.name}`),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((term) => hay.includes(term));
}

/** Resolve an npub / hex pubkey input to a 64-char hex key, or null. */
function toHex(input: string): string | null {
  const v = input.trim();
  if (/^[0-9a-f]{64}$/i.test(v)) return v.toLowerCase();
  if (v.startsWith("npub1")) {
    try {
      const d = decode(v);
      if (d.type === "npub") return d.data;
    } catch {
      return null;
    }
  }
  return null;
}

export function NipFeed({
  surface,
  pubkey,
  follows,
  webOfTrust,
  onOpenNip,
  onNeedsAuth,
}: {
  surface: Surface;
  pubkey: string | null;
  follows: string[];
  webOfTrust: Set<string>;
  onOpenNip: (id: string) => void;
  onNeedsAuth: () => void;
}) {
  const { nips, ready } = useNipFeed(surface, follows, webOfTrust);
  const { approve, disapprove, retract, approved, disapproved, pending } =
    useApprove(onNeedsAuth);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("top");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [approvedBy, setApprovedBy] = useState<ApprovedBy>("anyone");
  const [byInput, setByInput] = useState("");

  const followSet = useMemo(() => new Set(follows), [follows]);
  const target = useMemo(() => toHex(byInput), [byInput]);

  const passesApproval = (nip: ScoredNip): boolean => {
    if (approvedOnly && nip.approvers.size === 0) return false;
    switch (approvedBy) {
      case "me":
        return !!pubkey && nip.approvers.has(pubkey);
      case "follows":
        return [...nip.approvers].some((a) => followSet.has(a));
      case "wot":
        return nip.networkApprovers.size > 0;
      case "pubkey":
        return !!target && nip.approvers.has(target);
      default:
        return true;
    }
  };

  const filtered = useMemo(() => {
    const list = nips.filter((n) => matchesQuery(n, query) && passesApproval(n));
    if (sort === "new") {
      return [...list].sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nips, query, sort, approvedOnly, approvedBy, target, followSet, pubkey]);

  // Profiles for NIP authors plus the trusted approvers/disapprovers on cards.
  const profileTargets = useMemo(() => {
    const set = new Set<string>();
    for (const n of filtered) {
      set.add(n.pubkey);
      for (const a of n.networkApprovers) set.add(a);
      for (const d of n.networkDisapprovers) set.add(d);
    }
    return [...set];
  }, [filtered]);
  const profiles = useProfiles(profileTargets);

  // Self-verdict is the source of truth (observed labels + optimistic actions);
  // counts reconcile it against the global tally the same way the NIP page does.
  const isApprovedFor = (nip: ScoredNip) => approved.has(nip.address);
  const isDisapprovedFor = (nip: ScoredNip) => disapproved.has(nip.address);
  const countFor = (nip: ScoredNip) => {
    const self = approved.has(nip.address);
    const observed = nip.approvers.has(pubkey ?? "");
    return nip.approvers.size + (self && !observed ? 1 : 0) - (!self && observed ? 1 : 0);
  };
  const disapprovalCountFor = (nip: ScoredNip) => {
    const self = disapproved.has(nip.address);
    const observed = nip.disapprovers.has(pubkey ?? "");
    return (
      nip.disapprovers.size + (self && !observed ? 1 : 0) - (!self && observed ? 1 : 0)
    );
  };

  if (surface !== "global" && !pubkey) {
    return (
      <p className="empty">
        Connect a Nostr signer to surface NIPs from your network — or browse{" "}
        <strong>Global</strong>.
      </p>
    );
  }

  if (nips.length === 0) {
    if (!ready) {
      return (
        <div className="feed">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="card skeleton" key={i}>
              <div className="sk-row" />
              <div className="sk-title" />
              <div className="sk-line" />
              <div className="sk-line short" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <p className="empty">No community NIPs found for this surface yet.</p>
    );
  }

  return (
    <>
      <div className="feed-toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search NIPs by title, kind, or text…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="sort-toggle" role="group" aria-label="Sort order">
          <button
            className={`sort-btn${sort === "top" ? " active" : ""}`}
            onClick={() => setSort("top")}
            title="Most-vouched-for first"
          >
            Top
          </button>
          <button
            className={`sort-btn${sort === "new" ? " active" : ""}`}
            onClick={() => setSort("new")}
            title="Newest first"
          >
            Newest
          </button>
        </div>
      </div>

      <div className="filter-row">
        <label className="check">
          <input
            type="checkbox"
            checked={approvedOnly}
            onChange={(e) => setApprovedOnly(e.target.checked)}
          />
          Approved only
        </label>
        <label className="approved-by">
          Approved by
          <select
            value={approvedBy}
            onChange={(e) => setApprovedBy(e.target.value as ApprovedBy)}
          >
            <option value="anyone">anyone</option>
            {pubkey && <option value="me">me</option>}
            {pubkey && <option value="follows">someone I follow</option>}
            {pubkey && <option value="wot">my web of trust</option>}
            <option value="pubkey">a specific npub…</option>
          </select>
        </label>
        {approvedBy === "pubkey" && (
          <input
            className={`search npub-input${byInput && !target ? " invalid" : ""}`}
            placeholder="npub1…"
            value={byInput}
            onChange={(e) => setByInput(e.target.value)}
          />
        )}
        <span className="result-count">
          {filtered.length} of {nips.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">No NIPs match these filters.</p>
      ) : (
        <div className="feed">
          {filtered.map((nip) => (
            <NipCard
              key={nip.address}
              nip={nip}
              profile={profiles.get(nip.pubkey)}
              approvalCount={countFor(nip)}
              disapprovalCount={disapprovalCountFor(nip)}
              networkApprovers={[...nip.networkApprovers].map((pk) => ({
                pubkey: pk,
                profile: profiles.get(pk),
              }))}
              networkDisapprovers={[...nip.networkDisapprovers].map((pk) => ({
                pubkey: pk,
                profile: profiles.get(pk),
              }))}
              approved={isApprovedFor(nip)}
              disapproved={isDisapprovedFor(nip)}
              pending={pending.has(nip.address)}
              onApprove={() => void approve(nip)}
              onDisapprove={() => void disapprove(nip)}
              onRetract={() => void retract(nip)}
              onOpen={() => onOpenNip(naddrOf(nip))}
            />
          ))}
        </div>
      )}
    </>
  );
}
