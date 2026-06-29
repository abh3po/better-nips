import { useEffect, useMemo } from "react";
import type { Filter } from "nostr-tools";
import { useObserve } from "./useObserve";
import { dataLayer } from "../nostr/bootstrap";
import { KIND_RELAY_LIST } from "../nostr/constants";
import { parseRelayList, relayUrls, type RelayEntry } from "../nostr/nip65";
import { loadRelays } from "../nostr/relays";

export type RelaySource = "nip65" | "default";

export interface UserRelays {
  /** Effective relay URLs the worker is routed to. */
  relays: string[];
  /** Where they came from: the user's NIP-65 list, or the fallback list. */
  source: RelaySource;
  /** Parsed NIP-65 entries (with read/write markers) when source is nip65. */
  entries: RelayEntry[];
}

/**
 * Resolve the user's relays from their **NIP-65 list (kind 10002)** and route
 * the worker to them. Only when no NIP-65 list is found do we fall back to the
 * custom/default list — the user's own published relays are authoritative.
 */
export function useUserRelays(pubkey: string | null): UserRelays {
  const filters: Filter[] | null = pubkey
    ? [{ kinds: [KIND_RELAY_LIST], authors: [pubkey] }]
    : null;
  const { events } = useObserve(filters);

  const resolved = useMemo<UserRelays>(() => {
    const entries = parseRelayList(events[0]);
    if (entries.length > 0) {
      return { relays: relayUrls(entries), source: "nip65", entries };
    }
    return { relays: loadRelays(), source: "default", entries: [] };
  }, [events]);

  // Apply to the data layer whenever the effective set changes.
  const key = resolved.relays.join(",");
  useEffect(() => {
    if (resolved.relays.length > 0) {
      dataLayer.setUserRelays([...resolved.relays, "relay.ditto.pub"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return resolved;
}
