import type { Event } from "nostr-tools";

/** Pubkeys a contact list (kind-3) follows, from its `p` tags. */
export function parseFollows(contacts: Event | null | undefined): string[] {
  if (!contacts) return [];
  const set = new Set<string>();
  for (const t of contacts.tags) {
    if (t[0] === "p" && t[1] && /^[0-9a-f]{64}$/.test(t[1])) set.add(t[1]);
  }
  return [...set];
}

/** A 2nd-degree account and how many of your follows vouch for it. */
export interface VouchedAccount {
  pubkey: string;
  vouches: number;
}

/** Summary of a web-of-trust computation, for display in Settings. */
export interface WotStats {
  /** Direct follows (1st degree). */
  directFollows: number;
  /** Distinct accounts discovered via follows-of-follows (2nd degree). */
  discovered: number;
  /** Final trust-set size (every follow + every discovered 2nd-degree account). */
  total: number;
  /** How many follow lists (kind-3) we actually merged. */
  seedsResolved: number;
  /** Most-vouched-for 2nd-degree accounts (already in the trust set). */
  top: VouchedAccount[];
}

export interface WotResult {
  /** The trust-set pubkeys (follows always included). */
  wot: string[];
  stats: WotStats;
}

/**
 * Build a web-of-trust set from the user's follows plus the follow lists of
 * those follows (2nd degree). Pubkeys are ranked by how many of the user's
 * follows vouch for them, then capped — the most-vouched-for accounts in your
 * network are the strongest trust signal. Direct follows are always included.
 *
 * Returns the set plus stats. This is the (potentially heavy) aggregation that
 * runs inside the WoT worker — keep it pure so it's trivially testable and
 * portable between the worker and the main thread.
 */
export function computeWebOfTrust(
  follows: string[],
  secondDegree: Event[],
): WotResult {
  const followSet = new Set(follows);
  const score = new Map<string, number>();
  for (const e of secondDegree) {
    for (const f of parseFollows(e)) {
      // Don't let a follow vouching for another follow inflate discovery —
      // direct follows are already in the set at full trust.
      if (followSet.has(f)) continue;
      score.set(f, (score.get(f) ?? 0) + 1);
    }
  }

  const ranked = [...score.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  // No cap: every direct follow and every discovered 2nd-degree account is in
  // the trust set. `top` is just the leaderboard shown in Settings.
  const wot = new Set<string>(follows);
  const top: VouchedAccount[] = [];
  for (const [pubkey, vouches] of ranked) {
    wot.add(pubkey);
    if (top.length < 20) top.push({ pubkey, vouches });
  }

  return {
    wot: [...wot],
    stats: {
      directFollows: follows.length,
      discovered: score.size,
      total: wot.size,
      seedsResolved: secondDegree.length,
      top,
    },
  };
}

/** Set-only convenience wrapper around {@link computeWebOfTrust}. */
export function buildWebOfTrust(
  follows: string[],
  secondDegree: Event[],
): Set<string> {
  return new Set(computeWebOfTrust(follows, secondDegree).wot);
}
