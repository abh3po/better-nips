import { useEffect, useRef, useState } from "react";
import type { Filter } from "nostr-tools";
import { useObserve } from "./useObserve";
import { KIND_CONTACTS } from "../nostr/constants";
import type { WotStats } from "../nostr/wot";
import type { WotRequest, WotResponse } from "../nostr/wot.worker";
import { cacheWot, getCachedWot } from "../nostr/wotCache";

const EMPTY_STATS: WotStats = {
  directFollows: 0,
  discovered: 0,
  total: 0,
  seedsResolved: 0,
  top: [],
};

// Coalesce the burst of kind-3 events that stream in after login into one
// recompute, instead of posting to the worker on every single arrival.
const RECOMPUTE_DEBOUNCE_MS = 400;

export interface WebOfTrust {
  /** The trust set: follows + top-ranked follows-of-follows (capped). */
  set: Set<string>;
  stats: WotStats;
  /** True while the worker is crunching the latest seed batch. */
  computing: boolean;
}

function cachedState(pubkey: string | null): {
  set: Set<string>;
  stats: WotStats;
} {
  const cached = pubkey ? getCachedWot(pubkey) : null;
  return cached
    ? { set: new Set(cached.wot), stats: cached.stats }
    : { set: new Set(), stats: EMPTY_STATS };
}

/**
 * Follows + the most-vouched-for 2nd-degree accounts. The (potentially heavy)
 * aggregation over hundreds of contact lists runs in a dedicated Web Worker so
 * it never blocks rendering. We observe the kind-3 seeds on the main thread
 * (the local-relay worker owns that) and hand the raw events to the WoT worker.
 *
 * The last computed set is **cached per account**, so on reload the trust set
 * is available instantly and only *refreshed* in the background — not rebuilt
 * from scratch before anything renders.
 */
export function useWebOfTrust(
  pubkey: string | null,
  follows: string[],
): WebOfTrust {
  // Fan out to every follow's contact list — no seed cap. local-relay
  // outbox-partitions this author set across relays.
  const filters: Filter[] | null =
    follows.length > 0 ? [{ kinds: [KIND_CONTACTS], authors: follows }] : null;
  const { events } = useObserve(filters);

  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const pubkeyRef = useRef(pubkey);
  pubkeyRef.current = pubkey;

  const [result, setResult] = useState(() => cachedState(pubkey));
  const [computing, setComputing] = useState(false);

  // Spin up the worker once and route responses back into state + cache.
  useEffect(() => {
    const worker = new Worker(
      new URL("../nostr/wot.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<WotResponse>) => {
      // Ignore stale responses — only the most recent request matters.
      if (e.data.id !== reqId.current) return;
      setResult({ set: new Set(e.data.wot), stats: e.data.stats });
      setComputing(false);
      if (pubkeyRef.current) {
        cacheWot(pubkeyRef.current, e.data.wot, e.data.stats);
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Re-seed from cache the instant the active account changes.
  useEffect(() => {
    setResult(cachedState(pubkey));
  }, [pubkey]);

  // Recompute (debounced) whenever the follows or their contact lists change.
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    if (follows.length === 0) {
      reqId.current += 1;
      setResult({ set: new Set(), stats: EMPTY_STATS });
      setComputing(false);
      return;
    }
    setComputing(true);
    const handle = setTimeout(() => {
      const id = ++reqId.current;
      const message: WotRequest = { id, follows, secondDegree: events };
      worker.postMessage(message);
    }, RECOMPUTE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [follows, events]);

  return { set: result.set, stats: result.stats, computing };
}
