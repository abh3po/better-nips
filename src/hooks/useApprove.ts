import { useCallback, useState } from "react";
import type { EventTemplate } from "nostr-tools";
import { dataLayer } from "../nostr/bootstrap";
import {
  CLIENT_NAME,
  KIND_APPROVAL,
  LABEL_APPROVE,
  LABEL_NAMESPACE,
} from "../nostr/constants";
import type { Nip } from "../nostr/nips";

/**
 * Publish a NIP-32 "approve" label (kind 1985) for a NIP — the same event
 * NostrHub signs when you click Approve. Tracks locally-approved addresses so
 * the UI reflects the click immediately (your own approval won't necessarily
 * match the trust-scoped approval filter).
 */
export function useApprove() {
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  const approve = useCallback(async (nip: Nip) => {
    setPending((p) => new Set(p).add(nip.address));
    try {
      const template: EventTemplate = {
        kind: KIND_APPROVAL,
        created_at: Math.floor(Date.now() / 1000),
        content: "",
        tags: [
          ["L", LABEL_NAMESPACE],
          ["l", LABEL_APPROVE, LABEL_NAMESPACE],
          ["a", nip.address],
          ["p", nip.pubkey],
          ["client", CLIENT_NAME],
        ],
      };
      await dataLayer.publish(template);
      setApproved((s) => new Set(s).add(nip.address));
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(nip.address);
        return next;
      });
    }
  }, []);

  return { approve, approved, pending };
}
