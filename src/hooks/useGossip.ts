import { useEffect, useMemo, useRef } from "react";
import type { Filter } from "nostr-tools";
import { useObserve } from "./useObserve";
import { dataLayer } from "../nostr/bootstrap";
import { KIND_RELAY_LIST } from "../nostr/constants";
import { parseRelayList } from "../nostr/nip65";

// Bound how many authors we resolve relay lists for at once — the gossip pool
// itself is LRU-capped inside local-relay, so a focused set is what matters.
const MAX_AUTHORS = 100;

/**
 * Teach local-relay where a set of authors publish. We observe their NIP-65
 * (kind 10002) lists and feed each WRITE relay into the worker's **gossip
 * pool** via `addGossipRelay`. The worker then reads NIPs/approvals from those
 * relays too — without this, author-less catalog/approval queries only ever hit
 * your own relays and miss anything (like NIP-01) that lives elsewhere.
 */
export function useGossip(pubkeys: string[]) {
  const authors = useMemo(
    () => [...new Set(pubkeys)].slice(0, MAX_AUTHORS).sort(),
    [pubkeys],
  );
  const filters: Filter[] | null =
    authors.length > 0 ? [{ kinds: [KIND_RELAY_LIST], authors }] : null;
  const { events } = useObserve(filters);

  const added = useRef(new Set<string>());

  useEffect(() => {
    for (const e of events) {
      for (const entry of parseRelayList(e)) {
        if (entry.write && !added.current.has(entry.url)) {
          added.current.add(entry.url);
          dataLayer.addGossipRelay(entry.url);
        }
      }
    }
  }, [events]);
}
