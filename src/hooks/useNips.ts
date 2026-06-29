import { useEffect, useMemo, useState } from "react";
import type { Event, Filter } from "nostr-tools";
import { useObserve } from "./useObserve";
import { useGossip } from "./useGossip";
import { cacheFollows, getCachedFollows } from "../nostr/wotCache";
import {
  KIND_APPROVAL,
  KIND_CONTACTS,
  KIND_NIP,
  KIND_PROFILE,
  LABEL_APPROVE,
  LABEL_NAMESPACE,
} from "../nostr/constants";
import { parseFollows } from "../nostr/wot";
import { approvalTarget, parseNip, type Nip } from "../nostr/nips";

export type Surface = "following" | "web-of-trust" | "global";

/**
 * The logged-in user's direct follow list (latest kind-3). Hydrates instantly
 * from the per-account cache on login, then replaces it once the live kind-3
 * lands (and re-caches it). Avoids an empty Following surface on every reload.
 */
export function useFollows(pubkey: string | null): string[] {
  const filters: Filter[] | null = pubkey
    ? [{ kinds: [KIND_CONTACTS], authors: [pubkey] }]
    : null;
  const { events } = useObserve(filters);

  const [follows, setFollows] = useState<string[]>(() =>
    pubkey ? getCachedFollows(pubkey) : [],
  );

  // Swap to the cached list immediately when the active account changes.
  useEffect(() => {
    setFollows(pubkey ? getCachedFollows(pubkey) : []);
  }, [pubkey]);

  // When the live contact list arrives, adopt it and refresh the cache.
  useEffect(() => {
    if (!pubkey || !events[0]) return;
    const parsed = parseFollows(events[0]);
    setFollows(parsed);
    cacheFollows(pubkey, parsed);
  }, [events, pubkey]);

  return follows;
}

/** Profile metadata (display name / picture) for a set of authors. */
export interface Profile {
  name: string;
  picture?: string;
  about?: string;
  nip05?: string;
}

function parseProfile(content: string): Profile | null {
  try {
    const meta = JSON.parse(content);
    return {
      name: meta.display_name || meta.name || "",
      picture: meta.picture,
      about: meta.about,
      nip05: meta.nip05,
    };
  } catch {
    return null;
  }
}

export function useProfiles(pubkeys: string[]): Map<string, Profile> {
  const authors = useMemo(() => [...new Set(pubkeys)].sort(), [pubkeys]);
  const filters: Filter[] | null =
    authors.length > 0 ? [{ kinds: [KIND_PROFILE], authors }] : null;
  const { events } = useObserve(filters);
  return useMemo(() => {
    const map = new Map<string, Profile>();
    for (const e of events) {
      const p = parseProfile(e.content);
      if (p) map.set(e.pubkey, p);
    }
    return map;
  }, [events]);
}

/** Single profile for the logged-in user (display in the header / settings). */
export function useProfile(pubkey: string | null): Profile | null {
  const filters: Filter[] | null = pubkey
    ? [{ kinds: [KIND_PROFILE], authors: [pubkey] }]
    : null;
  const { events } = useObserve(filters);
  return useMemo(
    () => (events[0] ? parseProfile(events[0].content) : null),
    [events],
  );
}

export interface ScoredNip extends Nip {
  /** Every distinct approver pubkey, globally (matches NostrHub's count). */
  approvers: Set<string>;
  /** Approvers who are in your follows or web of trust (the trusted subset). */
  networkApprovers: Set<string>;
  /** Trust-weighted score: follow = 3, web-of-trust = 2, anyone else = 1. */
  score: number;
}

interface NipFeed {
  nips: ScoredNip[];
  ready: boolean;
  /** Authors needed for profile lookup. */
  authors: string[];
}

/** Pull the addressable `a`-coordinates an approval points at (approve labels). */
function approvedAddresses(events: Event[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    if (!e.tags.some((t) => t[0] === "l" && t[1] === LABEL_APPROVE)) continue;
    const a = approvalTarget(e);
    if (a && a.startsWith(`${KIND_NIP}:`)) set.add(a);
  }
  return [...set];
}

/**
 * The core surfacing logic. A NIP is "surfaced" by your **social graph's
 * approvals**, not by who authored it — NIP-01 is authored by a mirror account
 * nobody follows, yet it's the most-approved NIP, so an author-scoped surface
 * would wrongly hide it.
 *
 * We therefore:
 *  - fetch the (small) global NIP catalog **plus** every NIP your network has
 *    approved (resolved from their approvals by `a`-coordinate, so heavily-
 *    approved-but-old NIPs still appear);
 *  - fetch approvals two ways and merge: **author-scoped** over your follows ∪
 *    web-of-trust (local-relay outbox-routes these to the approvers' own relays,
 *    so network approvals aren't missed) and **address-scoped** for the visible
 *    NIPs (the global total count, à la NostrHub);
 *  - keep a NIP on `following` / `web-of-trust` when your network authored OR
 *    approved it; `global` shows the whole catalog.
 */
export function useNipFeed(
  surface: Surface,
  follows: string[],
  webOfTrust: Set<string>,
): NipFeed {
  const followSet = useMemo(() => new Set(follows), [follows]);

  // Approvals from your network — author-scoped so local-relay outbox-routes
  // them to the approvers' relays (the only way to see approvals that live off
  // your own relays). Doubles as the discovery source for approved NIPs.
  const networkAuthors = useMemo(
    () => [...new Set([...follows, ...webOfTrust])],
    [follows, webOfTrust],
  );
  const networkApprovalFilters: Filter[] | null =
    // networkAuthors.length > 0
    //   ? 
    [
      {
        kinds: [KIND_APPROVAL],
        "#L": [LABEL_NAMESPACE],
        // authors: networkAuthors,
        limit: 3000,
      },
    ]
  // : null;
  const { events: networkApprovals } = useObserve(networkApprovalFilters);

  // The global NIP catalog (small) + NIPs your network approved, fetched by the
  // authors/d-ids their approvals reference so old-but-approved NIPs still load.
  const approvedCoords = useMemo(() => {
    const authors = new Set<string>();
    const ds = new Set<string>();
    for (const a of approvedAddresses(networkApprovals)) {
      const [, pk, ...rest] = a.split(":");
      if (pk) authors.add(pk);
      const d = rest.join(":");
      if (d) ds.add(d);
    }
    return { authors: [...authors], ds: [...ds] };
  }, [networkApprovals]);

  const catalogFilters: Filter[] = [{ kinds: [KIND_NIP], limit: 500 }];
  if (approvedCoords.authors.length > 0) {
    catalogFilters.push({
      kinds: [KIND_NIP],
      authors: approvedCoords.authors,
      "#d": approvedCoords.ds,
    });
  }
  const { events: nipEvents, eose } = useObserve(catalogFilters);

  // De-dupe addressable NIPs to the latest version per coordinate.
  const parsed = useMemo(() => {
    const byAddress = new Map<string, Nip>();
    for (const e of nipEvents) {
      const nip = parseNip(e);
      if (!nip) continue;
      const prev = byAddress.get(nip.address);
      if (!prev || nip.createdAt > prev.createdAt) byAddress.set(nip.address, nip);
    }
    return [...byAddress.values()];
  }, [nipEvents]);
  const addresses = useMemo(() => parsed.map((n) => n.address), [parsed]);

  // Teach the worker where the NIP authors publish (their NIP-65 → gossip pool),
  // so author-less catalog/approval reads reach relays beyond your own — this is
  // what surfaces NIPs like NIP-01 that live on the author's relays.
  const nipAuthors = useMemo(
    () => [...new Set(parsed.map((n) => n.pubkey))],
    [parsed],
  );
  useGossip(nipAuthors);

  // Address-scoped global approvals for the visible NIPs — the total count
  // (everyone, not just your network), merged with the network approvals above.
  const addrApprovalFilters: Filter[] | null =
    addresses.length > 0
      ? [
        {
          kinds: [KIND_APPROVAL],
          "#L": [LABEL_NAMESPACE],
          "#a": addresses,
          limit: 3000,
        },
      ]
      : null;
  const { events: addrApprovals } = useObserve(addrApprovalFilters);

  const nips = useMemo(() => {
    // address -> all approver pubkeys (merged from both approval queries).
    const byAddress = new Map<string, Set<string>>();
    for (const e of [...networkApprovals, ...addrApprovals]) {
      if (!e.tags.some((t) => t[0] === "l" && t[1] === LABEL_APPROVE)) continue;
      const addr = approvalTarget(e);
      if (!addr) continue;
      if (!byAddress.has(addr)) byAddress.set(addr, new Set());
      byAddress.get(addr)!.add(e.pubkey);
    }

    const scored: ScoredNip[] = [];
    for (const nip of parsed) {
      const approvers = byAddress.get(nip.address) ?? new Set<string>();
      const networkApprovers = new Set<string>();
      let hasFollowApprover = false;
      let score = 0;
      for (const a of approvers) {
        const weight = followSet.has(a) ? 3 : webOfTrust.has(a) ? 2 : 1;
        score += weight;
        if (weight > 1) networkApprovers.add(a);
        if (followSet.has(a)) hasFollowApprover = true;
      }

      // Surface membership: authored OR approved by your network.
      if (surface === "following") {
        if (!followSet.has(nip.pubkey) && !hasFollowApprover) continue;
      } else if (surface === "web-of-trust") {
        if (!webOfTrust.has(nip.pubkey) && networkApprovers.size === 0) continue;
      }

      scored.push({ ...nip, approvers, networkApprovers, score });
    }

    scored.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
    return scored;
  }, [parsed, networkApprovals, addrApprovals, surface, followSet, webOfTrust]);

  const authors = useMemo(
    () => [...new Set(nips.map((n) => n.pubkey))],
    [nips],
  );

  return { nips, ready: eose, authors };
}
