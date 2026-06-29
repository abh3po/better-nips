import { useEffect, useRef, useState } from "react";
import type { Event, Filter } from "nostr-tools";
import { dedupeKey } from "@formstr/local-relay";
import { dataLayer } from "../nostr/bootstrap";

interface ObserveState {
  events: Event[];
  eose: boolean;
}

/**
 * Declare a standing interest in `filters` and collect matching events,
 * deduplicated (addressable/replaceable collapse to their latest version).
 * Pass `null` to stay idle. The worker owns the network; we only observe.
 */
export function useObserve(
  filters: Filter[] | null,
  options?: { localOnly?: boolean },
): ObserveState {
  const [state, setState] = useState<ObserveState>({ events: [], eose: false });
  // Re-subscribe only when the filter content actually changes.
  const key = filters ? JSON.stringify(filters) : null;
  const localOnly = options?.localOnly ?? false;
  const store = useRef(new Map<string, Event>());

  useEffect(() => {
    store.current = new Map();
    if (!key) {
      setState({ events: [], eose: false });
      return;
    }
    setState({ events: [], eose: false });
    const parsed: Filter[] = JSON.parse(key);

    const flush = (eose: boolean) =>
      setState({ events: [...store.current.values()], eose });

    const handle = dataLayer.observe(
      parsed,
      {
        onEvent: (e: Event) => {
          const k = dedupeKey(e);
          const prev = store.current.get(k);
          if (!prev || e.created_at > prev.created_at) {
            store.current.set(k, e);
            flush(false);
          }
        },
        onEose: () => flush(true),
      },
      { localOnly },
    );
    return () => handle.unobserve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, localOnly]);

  return state;
}
