import type { Event } from "nostr-tools";
import { WOT_MAX_AUTHORS } from "./constants";

/** Pubkeys a contact list (kind-3) follows, from its `p` tags. */
export function parseFollows(contacts: Event | null | undefined): string[] {
  if (!contacts) return [];
  const set = new Set<string>();
  for (const t of contacts.tags) {
    if (t[0] === "p" && t[1] && /^[0-9a-f]{64}$/.test(t[1])) set.add(t[1]);
  }
  return [...set];
}

/**
 * Build a web-of-trust set from the user's follows plus the follow lists of
 * those follows (2nd degree). Pubkeys are ranked by how many of the user's
 * follows vouch for them, then capped — the most-vouched-for accounts in your
 * network are the strongest trust signal. Direct follows are always included.
 */
export function buildWebOfTrust(
  follows: string[],
  secondDegree: Event[],
): Set<string> {
  const score = new Map<string, number>();
  for (const e of secondDegree) {
    for (const f of parseFollows(e)) {
      score.set(f, (score.get(f) ?? 0) + 1);
    }
  }
  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pubkey]) => pubkey);

  const wot = new Set<string>(follows);
  for (const pubkey of ranked) {
    if (wot.size >= WOT_MAX_AUTHORS) break;
    wot.add(pubkey);
  }
  return wot;
}
