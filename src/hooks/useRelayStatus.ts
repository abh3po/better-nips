import { useEffect, useState } from "react";
import type { RelayHealth } from "@formstr/local-relay";
import { dataLayer } from "../nostr/bootstrap";

export interface RelayStatus {
  online: boolean;
  relays: RelayHealth[];
  connected: number;
}

/**
 * Poll the local-relay worker for connection health. Read-only observation —
 * it never commands a connection; the worker owns that. `intervalMs` defaults to
 * a relaxed 4s since this only drives a status dot.
 */
export function useRelayStatus(intervalMs = 4000): RelayStatus {
  const [status, setStatus] = useState<RelayStatus>({
    online: false,
    relays: [],
    connected: 0,
  });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [online, relays] = await Promise.all([
          dataLayer.online(),
          dataLayer.relayHealth(),
        ]);
        if (!alive) return;
        setStatus({
          online,
          relays,
          connected: relays.filter((r) => r.connected).length,
        });
      } catch {
        /* worker not ready yet — keep last status */
      }
    };
    void tick();
    const h = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [intervalMs]);

  return status;
}
