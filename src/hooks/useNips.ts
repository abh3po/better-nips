import { useMemo } from "react";
import type { Filter } from "nostr-tools";
import { buildFilters, scopeHasInput, type Scope, type ScopeUser } from "@formstr/local-relay";
import { useObserve } from "./useObserve";
import {
  KIND_APPROVAL,
  KIND_CONTACTS,
  KIND_NIP,
  KIND_PROFILE,
  LABEL_APPROVE,
  LABEL_NAMESPACE,
  WOT_SEED_LIMIT,
} from "../nostr/constants";
import { parseFollows, buildWebOfTrust } from "../nostr/wot";
import { approvalTarget, parseNip, type Nip } from "../nostr/nips";

export type Surface = "following" | "web-of-trust" | "global";

/** The logged-in user's direct follow list (latest kind-3). */
export function useFollows(pubkey: string | null): string[] {
  const filters: Filter[] | null = pubkey
    ? [{ kinds: [KIND_CONTACTS], authors: [pubkey] }]
    : null;
  const { events } = useObserve(filters);
  return useMemo(() => parseFollows(events[0]), [events]);
}

/** Follows + the most-vouched-for 2nd-degree accounts (kind-3 of follows). */
export function useWebOfTrust(follows: string[]): Set<string> {
  const seeds = follows.slice(0, WOT_SEED_LIMIT);
  const filters: Filter[] | null =
    seeds.length > 0 ? [{ kinds: [KIND_CONTACTS], authors: seeds }] : null;
  const { events } = useObserve(filters);
  return useMemo(() => buildWebOfTrust(follows, events), [follows, events]);
}

/** Profile metadata (display name / picture) for a set of authors. */
export interface Profile {
  name: string;
  picture?: string;
}
export function useProfiles(pubkeys: string[]): Map<string, Profile> {
  const authors = useMemo(() => [...new Set(pubkeys)].sort(), [pubkeys]);
  const filters: Filter[] | null =
    authors.length > 0 ? [{ kinds: [KIND_PROFILE], authors }] : null;
  const { events } = useObserve(filters);
  return useMemo(() => {
    const map = new Map<string, Profile>();
    for (const e of events) {
      try {
        const meta = JSON.parse(e.content);
        map.set(e.pubkey, {
          name: meta.display_name || meta.name || "",
          picture: meta.picture,
        });
      } catch {
        /* skip malformed metadata */
      }
    }
    return map;
  }, [events]);
}

export interface ScoredNip extends Nip {
  /** Distinct approver pubkeys (within the active trust set). */
  approvers: Set<string>;
  /** Weighted approval score (direct follows weigh more than 2nd degree). */
  score: number;
}

interface NipFeed {
  nips: ScoredNip[];
  ready: boolean;
  /** Authors needed for profile lookup. */
  authors: string[];
}

/**
 * The core surfacing logic: kind-30817 NIPs for the chosen surface, ranked by
 * trust-weighted NIP-32 approvals. `following` and `web-of-trust` route through
 * local-relay's Scope/ScopeUser; `global` is author-less discovery.
 */
export function useNipFeed(
  surface: Surface,
  pubkey: string | null,
  follows: string[],
  webOfTrust: Set<string>,
): NipFeed {
  const scope: Scope =
    surface === "following"
      ? { type: "following" }
      : surface === "web-of-trust"
        ? { type: "network" }
        : { type: "global" };

  const user: ScopeUser = useMemo(
    () => ({ pubkey: pubkey ?? undefined, follows, webOfTrust }),
    [pubkey, follows, webOfTrust],
  );

  // NIP events for the scope (data layer builds filters + routes relays).
  const nipFilters: Filter[] | null =
    surface === "global"
      ? [{ kinds: [KIND_NIP], limit: 200 }]
      : scopeHasInput(scope, user)
        ? buildFilters([KIND_NIP], scope, user, { limit: 200 })
        : null;
  const { events: nipEvents, eose } = useObserve(nipFilters);

  // Approvals (kind-1985, L=nostrhub, l=approve) from the trust set.
  const trustAuthors: string[] =
    surface === "following"
      ? follows
      : surface === "web-of-trust"
        ? [...webOfTrust]
        : [];
  const approvalFilters: Filter[] | null =
    surface === "global"
      ? [{ kinds: [KIND_APPROVAL], "#L": [LABEL_NAMESPACE], limit: 500 }]
      : trustAuthors.length > 0
        ? [
            {
              kinds: [KIND_APPROVAL],
              "#L": [LABEL_NAMESPACE],
              authors: trustAuthors,
              limit: 500,
            },
          ]
        : null;
  const { events: approvalEvents } = useObserve(approvalFilters);

  const nips = useMemo(() => {
    // address -> approver pubkeys (only counting "approve" labels).
    const byAddress = new Map<string, Set<string>>();
    for (const e of approvalEvents) {
      const isApprove = e.tags.some(
        (t) => t[0] === "l" && t[1] === LABEL_APPROVE,
      );
      if (!isApprove) continue;
      const addr = approvalTarget(e);
      if (!addr) continue;
      if (!byAddress.has(addr)) byAddress.set(addr, new Set());
      byAddress.get(addr)!.add(e.pubkey);
    }

    const followSet = new Set(follows);
    const scored: ScoredNip[] = [];
    for (const e of nipEvents) {
      const nip = parseNip(e);
      if (!nip) continue;
      const approvers = byAddress.get(nip.address) ?? new Set<string>();
      let score = 0;
      for (const a of approvers) score += followSet.has(a) ? 3 : 1;
      scored.push({ ...nip, approvers, score });
    }

    scored.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
    return scored;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nipEvents, approvalEvents, follows]);

  const authors = useMemo(
    () => [...new Set(nips.map((n) => n.pubkey))],
    [nips],
  );

  return { nips, ready: eose, authors };
}
