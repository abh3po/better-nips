import { useMemo } from "react";
import { npubEncode } from "nostr-tools/nip19";
import type { Profile } from "../hooks/useNips";

function label(pubkey: string, profile?: Profile): string {
  if (profile?.name) return profile.name;
  try {
    return `${npubEncode(pubkey).slice(0, 12)}…`;
  } catch {
    return pubkey.slice(0, 12);
  }
}

type Tier = "you" | "follow" | "network" | "other";

const TIER_ORDER: Record<Tier, number> = {
  you: 0,
  follow: 1,
  network: 2,
  other: 3,
};

const TIER_LABEL: Record<Tier, string> = {
  you: "you",
  follow: "you follow",
  network: "web of trust",
  other: "",
};

/**
 * Who approved a NIP. Sorted by trust proximity (you → follows → web of trust →
 * everyone else) so the most meaningful endorsements read first. Works
 * logged-out (everyone just lands in "other").
 */
export function ApproverList({
  approvers,
  profiles,
  follows,
  webOfTrust,
  me,
}: {
  approvers: string[];
  profiles: Map<string, Profile>;
  follows: string[];
  webOfTrust: Set<string>;
  me: string;
}) {
  const followSet = useMemo(() => new Set(follows), [follows]);

  const sorted = useMemo(() => {
    const tierOf = (pk: string): Tier =>
      pk === me
        ? "you"
        : followSet.has(pk)
          ? "follow"
          : webOfTrust.has(pk)
            ? "network"
            : "other";
    return approvers
      .map((pk) => ({ pk, tier: tierOf(pk) }))
      .sort(
        (a, b) =>
          TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
          label(a.pk, profiles.get(a.pk)).localeCompare(
            label(b.pk, profiles.get(b.pk)),
          ),
      );
  }, [approvers, followSet, webOfTrust, me, profiles]);

  if (approvers.length === 0) return null;

  return (
    <section className="approvers">
      <h2 className="subsection-title">
        Approved by {approvers.length}
        {approvers.length === 1 ? " person" : " people"}
      </h2>
      <ul className="approver-grid">
        {sorted.map(({ pk, tier }) => {
          const p = profiles.get(pk);
          return (
            <li key={pk} className="approver-item">
              {p?.picture ? (
                <img className="avatar sm" src={p.picture} alt="" />
              ) : (
                <span className="avatar sm placeholder" />
              )}
              <span className="approver-name">{label(pk, p)}</span>
              {TIER_LABEL[tier] && (
                <span className={`tier-tag ${tier}`}>{TIER_LABEL[tier]}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
