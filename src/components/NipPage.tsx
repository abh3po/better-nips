import { useEffect, useMemo } from "react";
import { npubEncode } from "nostr-tools/nip19";
import { useNipByAddress } from "../hooks/useNipByAddress";
import { useProfile, useProfiles } from "../hooks/useNips";
import { useApprove } from "../hooks/useApprove";
import { signer } from "../nostr/bootstrap";
import { Markdown } from "../lib/markdown";
import { toast } from "../lib/toast";
import { ApproverList } from "./ApproverList";

function authorLabel(pubkey: string, name?: string): string {
  if (name) return name;
  try {
    return npubEncode(pubkey).slice(0, 16) + "…";
  } catch {
    return pubkey.slice(0, 16);
  }
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${what}.`);
  } catch {
    toast.error("Couldn't access the clipboard.");
  }
}

/**
 * Standalone, shareable NIP screen (route `#/nip/<naddr>`). Resolves the NIP
 * from its address — works cold from a shared link and warm from the local
 * cache — and renders the full Markdown body, approvals, and share/approve.
 */
export function NipPage({
  id,
  follows,
  webOfTrust,
  onNeedsAuth,
  onBack,
}: {
  id: string;
  follows: string[];
  webOfTrust: Set<string>;
  onNeedsAuth: () => void;
  onBack: () => void;
}) {
  const networkAuthors = useMemo(
    () => [...new Set([...follows, ...webOfTrust])],
    [follows, webOfTrust],
  );
  const { nip, approvers, ready, coord } = useNipByAddress(id, networkAuthors);
  const profile = useProfile(nip?.pubkey ?? null);
  const { approve, approved, pending } = useApprove(onNeedsAuth);
  const approverProfiles = useProfiles(useMemo(() => [...approvers], [approvers]));

  useEffect(() => {
    document.title = nip ? `${nip.title} — NIP Commons` : "NIP Commons";
    return () => {
      document.title = "NIP Commons — community NIPs, surfaced by trust";
    };
  }, [nip]);

  const me = signer.getActiveAccount()?.pubkey ?? "";
  const locallyApproved = nip ? approved.has(nip.address) : false;
  const isApproved = locallyApproved || (!!nip && approvers.has(me));
  const count =
    approvers.size +
    (locallyApproved && nip && !approvers.has(me) ? 1 : 0);
  // Approver pubkeys for the list, folding in an optimistic self-approval.
  const approverPubkeys = useMemo(() => {
    const list = [...approvers];
    if (locallyApproved && me && !approvers.has(me)) list.unshift(me);
    return list;
  }, [approvers, locallyApproved, me]);

  if (!coord) {
    return (
      <div className="nip-page">
        <button className="back-link" onClick={onBack}>
          ← Back to NIPs
        </button>
        <p className="empty">That NIP link doesn’t look valid.</p>
      </div>
    );
  }

  if (!nip) {
    return (
      <div className="nip-page">
        <button className="back-link" onClick={onBack}>
          ← Back to NIPs
        </button>
        {ready ? (
          <p className="empty">
            Couldn’t find this NIP on your relays. It may live on relays you’re
            not connected to.
          </p>
        ) : (
          <div className="card skeleton">
            <div className="sk-row" />
            <div className="sk-title" />
            <div className="sk-line" />
            <div className="sk-line short" />
          </div>
        )}
      </div>
    );
  }

  const created = new Date(nip.createdAt * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="nip-page">
      <div className="nip-page-nav">
        <button className="back-link" onClick={onBack}>
          ← Back to NIPs
        </button>
        <button
          className="btn ghost sm"
          onClick={() =>
            void copy(window.location.href, "shareable link")
          }
        >
          Copy link
        </button>
      </div>

      <div className="author detail-author">
        {profile?.picture ? (
          <img className="avatar" src={profile.picture} alt="" />
        ) : (
          <div className="avatar placeholder" />
        )}
        <div className="author-meta">
          <span className="author-name">
            {authorLabel(nip.pubkey, profile?.name)}
          </span>
          {profile?.nip05 && <span className="nip05">{profile.nip05}</span>}
        </div>
      </div>

      <h1 className="sheet-title">{nip.title}</h1>
      <div className="sheet-meta">
        <span>Published {created}</span>
        <span className="dot-sep">·</span>
        <span>
          {count} approval{count === 1 ? "" : "s"}
        </span>
      </div>

      {nip.kinds.length > 0 && (
        <div className="kinds detail-kinds">
          {nip.kinds.map((k) => (
            <span className="kind-chip" key={k.kind}>
              kind {k.kind}
              {k.name ? ` · ${k.name}` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="markdown nip-page-body">
        {nip.content.trim() ? (
          <Markdown source={nip.content} />
        ) : (
          <p className="empty-inline">
            This NIP has no body content — only metadata.
          </p>
        )}
      </div>

      <div className="nip-page-actions">
        <button
          className={`btn approve big${isApproved ? " done" : ""}`}
          disabled={isApproved || pending.has(nip.address)}
          onClick={() => void approve(nip)}
        >
          {isApproved
            ? "✓ Approved"
            : pending.has(nip.address)
              ? "Publishing…"
              : "Approve"}
          <span className="count">{count}</span>
        </button>
        <button
          className="btn ghost"
          onClick={() => void copy(nip.address, "address")}
        >
          Copy address
        </button>
      </div>

      <ApproverList
        approvers={approverPubkeys}
        profiles={approverProfiles}
        follows={follows}
        webOfTrust={webOfTrust}
        me={me}
      />
    </article>
  );
}
