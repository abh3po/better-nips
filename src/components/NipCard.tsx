import { npubEncode } from "nostr-tools/nip19";
import type { ScoredNip } from "../hooks/useNips";
import type { Profile } from "../hooks/useNips";

function authorLabel(pubkey: string, profile?: Profile): string {
  if (profile?.name) return profile.name;
  try {
    return `${npubEncode(pubkey).slice(0, 12)}…`;
  } catch {
    return pubkey.slice(0, 12);
  }
}

export function NipCard({
  nip,
  profile,
  approvalCount,
  approved,
  pending,
  onApprove,
}: {
  nip: ScoredNip;
  profile?: Profile;
  approvalCount: number;
  approved: boolean;
  pending: boolean;
  onApprove: () => void;
}) {
  return (
    <article className="card">
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
          onClick={onApprove}
        >
          {approved ? "✓ Approved" : pending ? "…" : "Approve"}
          <span className="count">{approvalCount}</span>
        </button>
      </div>

      <h2 className="card-title">{nip.title}</h2>
      {nip.summary && <p className="card-summary">{nip.summary}</p>}

      {nip.kinds.length > 0 && (
        <div className="kinds">
          {nip.kinds.map((k) => (
            <span className="kind-chip" key={k.kind}>
              kind {k.kind}
              {k.name ? ` · ${k.name}` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="card-foot">
        <code className="addr" title={nip.address}>
          {nip.d}
        </code>
      </div>
    </article>
  );
}
