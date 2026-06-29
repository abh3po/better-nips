import { useMemo } from "react";
import type { Filter } from "nostr-tools";
import { decode } from "nostr-tools/nip19";
import { useObserve } from "./useObserve";
import { useGossip } from "./useGossip";
import {
  KIND_APPROVAL,
  KIND_NIP,
  LABEL_APPROVE,
  LABEL_DISAPPROVE,
  LABEL_NAMESPACE,
} from "../nostr/constants";
import { approvalTarget, parseNip, type Nip } from "../nostr/nips";

export interface LoadedNip {
  nip: Nip | null;
  /** Distinct approver pubkeys across the network (works logged-out). */
  approvers: Set<string>;
  /** Distinct disapprover pubkeys across the network (NIP-32 "disapprove"). */
  disapprovers: Set<string>;
  /** True once the NIP query has reached EOSE (so "not found" is meaningful). */
  ready: boolean;
}

interface Coord {
  kind: number;
  pubkey: string;
  identifier: string;
}

/** Decode an naddr (or a raw `kind:pubkey:d` coordinate) into its parts. */
function decodeCoord(id: string): Coord | null {
  if (id.startsWith("naddr1")) {
    try {
      const d = decode(id);
      if (d.type === "naddr") {
        return {
          kind: d.data.kind,
          pubkey: d.data.pubkey,
          identifier: d.data.identifier,
        };
      }
    } catch {
      return null;
    }
    return null;
  }
  // Fallback: a raw addressable coordinate "30817:<pubkey>:<d>".
  const m = id.match(/^(\d+):([0-9a-f]{64}):(.*)$/);
  if (m) return { kind: Number(m[1]), pubkey: m[2], identifier: m[3] };
  return null;
}

/**
 * Resolve a single NIP from a shareable address (naddr or raw coordinate),
 * for the standalone NIP screen. Observes the addressable event plus every
 * NIP-32 approval pointing at it — so a cold-loaded shared link still shows a
 * meaningful approval count, even when the visitor isn't logged in.
 */
export function useNipByAddress(
  id: string,
  networkAuthors: string[] = [],
): LoadedNip & { coord: Coord | null } {
  const coord = useMemo(() => decodeCoord(id), [id]);

  // Pull the NIP author's relays into the gossip pool so a cold shared link
  // resolves even when the NIP lives off your own relays.
  useGossip(useMemo(() => (coord ? [coord.pubkey] : []), [coord]));

  const nipFilters: Filter[] | null =
    coord && coord.kind === KIND_NIP
      ? [
          {
            kinds: [coord.kind],
            authors: [coord.pubkey],
            "#d": [coord.identifier],
          },
        ]
      : null;
  const { events: nipEvents, eose } = useObserve(nipFilters);

  const address = coord
    ? `${coord.kind}:${coord.pubkey}:${coord.identifier}`
    : "";

  // Two approval queries, merged: address-scoped (global total, off your own
  // relays) + author-scoped over your network (outbox-routed to the approvers'
  // relays, so a follow's approval that lives off your relays still shows up).
  const addrFilters: Filter[] | null = address
    ? [{ kinds: [KIND_APPROVAL], "#a": [address], "#L": [LABEL_NAMESPACE], limit: 500 }]
    : null;
  const { events: addrApprovals } = useObserve(addrFilters);

  const networkFilters: Filter[] | null =
    address && networkAuthors.length > 0
      ? [
          {
            kinds: [KIND_APPROVAL],
            "#a": [address],
            "#L": [LABEL_NAMESPACE],
            authors: networkAuthors,
            limit: 500,
          },
        ]
      : null;
  const { events: networkApprovals } = useObserve(networkFilters);

  const nip = useMemo(
    () => (nipEvents[0] ? parseNip(nipEvents[0]) : null),
    [nipEvents],
  );

  const { approvers, disapprovers } = useMemo(() => {
    const approvers = new Set<string>();
    const disapprovers = new Set<string>();
    for (const e of [...addrApprovals, ...networkApprovals]) {
      if (approvalTarget(e) !== address) continue;
      if (e.tags.some((t) => t[0] === "l" && t[1] === LABEL_APPROVE)) {
        approvers.add(e.pubkey);
      } else if (e.tags.some((t) => t[0] === "l" && t[1] === LABEL_DISAPPROVE)) {
        disapprovers.add(e.pubkey);
      }
    }
    return { approvers, disapprovers };
  }, [addrApprovals, networkApprovals, address]);

  return { nip, approvers, disapprovers, ready: eose, coord };
}
