import { useCallback, useState } from "react";
import type { EventTemplate } from "nostr-tools";
import { dataLayer, signer } from "../nostr/bootstrap";
import {
  CLIENT_NAME,
  KIND_APPROVAL,
  LABEL_APPROVE,
  LABEL_NAMESPACE,
} from "../nostr/constants";
import { toast } from "../lib/toast";
import type { Nip } from "../nostr/nips";

/**
 * Publish a NIP-32 "approve" label (kind 1985) for a NIP — the same event
 * NostrHub signs when you click Approve. Tracks locally-approved addresses so
 * the UI reflects the click immediately (your own approval won't necessarily
 * match the trust-scoped approval filter).
 *
 * `onNeedsAuth` fires when there's no usable signer (logged out, or a locked
 * ncryptsec account) so the caller can open the login modal.
 */
export function useApprove(onNeedsAuth?: () => void) {
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  const approve = useCallback(
    async (nip: Nip) => {
      if (!signer.getActiveSigner()) {
        toast.error("Re-authenticate to approve.");
        onNeedsAuth?.();
        return;
      }
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
        const { result } = await dataLayer.publish(template);
        setApproved((s) => new Set(s).add(nip.address));
        if (result.accepted > 0) {
          toast.success(
            `Approved — published to ${result.accepted}/${result.total} relays.`,
          );
        } else {
          toast.error("Approval signed but no relay accepted it. Will retry.");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to publish approval.",
        );
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(nip.address);
          return next;
        });
      }
    },
    [onNeedsAuth],
  );

  return { approve, approved, pending };
}
