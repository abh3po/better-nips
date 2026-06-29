import { npubEncode } from "nostr-tools/nip19";
import type { ScoredNip, Profile } from "../hooks/useNips";

function authorLabel(pubkey: string, profile?: Profile): string {
  if (profile?.name) return profile.name;
  try {
    return `${npubEncode(pubkey).slice(0, 12)}…`;
  } catch {
    return pubkey.slice(0, 12);
  }
}

export interface ApproverRef {
  pubkey: string;
  profile?: Profile;
}

export function NipCard({
  nip,
  profile,
  approvalCount,
  networkApprovers,
  approved,
  pending,
  onApprove,
  onOpen,
}: {
  nip: ScoredNip;
  profile?: Profile;
  approvalCount: number;
  networkApprovers: ApproverRef[];
  approved: boolean;
  pending: boolean;
  onApprove: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className="card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="card-head">
        <div className="author">
          {profile?.picture ? (
            <img className="avatar" src={profile.picture} alt="" />
          ) : (
            <div className="avatar placeholder" />
          )}
          <span>{authorLabel(nip.pubkey, profile)}</span>
        </div>
        <button
          className={`btn approve${approved ? " done" : ""}`}
          disabled={approved || pending}
          onClick={(e) => {
            e.stopPropagation();
            onApprove();
          }}
          title="Publish a NIP-32 approval"
        >
          {approved ? "✓ Approved" : pending ? "…" : "Approve"}
          <span className="count">{approvalCount}</span>
        </button>
      </div>

      <h2 className="card-title">{nip.title}</h2>
      {nip.summary && <p className="card-summary">{nip.summary}</p>}

      {networkApprovers.length > 0 && (
        <div className="approver-row" title="Approvers in your network">
          <span className="avatar-stack">
            {networkApprovers.slice(0, 4).map((a) =>
              a.profile?.picture ? (
                <img
                  key={a.pubkey}
                  className="avatar xs"
                  src={a.profile.picture}
                  alt=""
                />
              ) : (
                <span key={a.pubkey} className="avatar xs placeholder" />
              ),
            )}
          </span>
          <span className="approver-text">
            {approverSummary(networkApprovers)}
          </span>
        </div>
      )}

      <div className="card-foot">
        {nip.kinds.length > 0 ? (
          <div className="kinds">
            {nip.kinds.slice(0, 4).map((k) => (
              <span className="kind-chip" key={k.kind}>
                kind {k.kind}
                {k.name ? ` · ${k.name}` : ""}
              </span>
            ))}
            {nip.kinds.length > 4 && (
              <span className="kind-chip more">+{nip.kinds.length - 4}</span>
            )}
          </div>
        ) : (
          <span />
        )}
        <span className="card-date">
          <time dateTime={new Date(nip.createdAt * 1000).toISOString()}>
            {formatDate(nip.createdAt)}
          </time>
          <span className="read-link">Read →</span>
        </span>
      </div>
    </article>
  );
}

/** "Approved by Alice, Bob +3 in your network" — names where known. */
function approverSummary(approvers: ApproverRef[]): string {
  const names = approvers
    .slice(0, 2)
    .map((a) => a.profile?.name || shortName(a.pubkey));
  const rest = approvers.length - names.length;
  const lead = names.join(", ");
  return `Approved by ${lead}${rest > 0 ? ` +${rest}` : ""} in your network`;
}

function shortName(pubkey: string): string {
  try {
    return `${npubEncode(pubkey).slice(0, 9)}…`;
  } catch {
    return pubkey.slice(0, 8);
  }
}

/** Short, relative-ish published date for a card. */
function formatDate(unixSeconds: number): string {
  const then = unixSeconds * 1000;
  const days = (Date.now() - then) / 86_400_000;
  if (days < 1) return "today";
  if (days < 30) return `${Math.floor(days)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}
