import { useCallback, useMemo, useState } from "react";
import type { Event, EventTemplate, Filter } from "nostr-tools";
import { useObserve } from "./useObserve";
import { dataLayer, signer } from "../nostr/bootstrap";
import { KIND_DELETE, KIND_NIP, KIND_REACTION } from "../nostr/constants";
import { toast } from "../lib/toast";

/** A "like" is a NIP-25 reaction with content "+" (or empty, per the spec). */
const LIKE = "+";

export interface ReactionsState {
  /** Total reactions on the NIP (all emoji), optimistically adjusted. */
  count: number;
  /** Whether the logged-in user currently likes this NIP. */
  liked: boolean;
  pending: boolean;
  toggleLike: () => void;
}

interface NipRef {
  id: string;
  pubkey: string;
  address: string;
}

/**
 * NIP-25 reactions for a single NIP. Observes reactions tagged by the NIP's
 * event id (`#e`) or its addressable coordinate (`#a`), and toggles the user's
 * own "+" like — publishing a reaction to add it, a NIP-09 deletion to retract
 * it. Local optimistic state flips immediately so the heart responds before the
 * (eventually-consistent) relay round-trip lands.
 */
export function useReactions(
  nip: NipRef | null,
  onNeedsAuth?: () => void,
): ReactionsState {
  const me = signer.getActiveAccount()?.pubkey ?? null;
  const filters: Filter[] | null = nip
    ? [
        { kinds: [KIND_REACTION], "#e": [nip.id] },
        { kinds: [KIND_REACTION], "#a": [nip.address] },
      ]
    : null;
  const { events } = useObserve(filters);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  // De-dupe across the two filters (one reaction can match both #e and #a).
  const reactions = useMemo(() => {
    const seen = new Map<string, Event>();
    for (const e of events) if (!seen.has(e.id)) seen.set(e.id, e);
    return [...seen.values()];
  }, [events]);

  // The user's latest like, if any (a later one supersedes an earlier).
  const myLike = useMemo(() => {
    if (!me) return null;
    return (
      reactions
        .filter(
          (e) => e.pubkey === me && (e.content === LIKE || e.content === ""),
        )
        .sort((a, b) => b.created_at - a.created_at)[0] ?? null
    );
  }, [reactions, me]);

  const observedLiked = !!myLike;
  const liked = optimistic ?? observedLiked;
  // Reconcile the optimistic count delta against what relays actually report.
  const count =
    reactions.length +
    (liked && !observedLiked ? 1 : 0) -
    (!liked && observedLiked ? 1 : 0);

  const toggleLike = useCallback(async () => {
    if (!nip) return;
    if (!signer.getActiveSigner()) {
      toast.error("Re-authenticate to react.");
      onNeedsAuth?.();
      return;
    }
    const next = !(optimistic ?? observedLiked);
    setOptimistic(next);
    try {
      if (!next && myLike) {
        const del: EventTemplate = {
          kind: KIND_DELETE,
          created_at: Math.floor(Date.now() / 1000),
          content: "",
          tags: [
            ["e", myLike.id],
            ["k", String(KIND_REACTION)],
          ],
        };
        await dataLayer.publish(del);
      } else if (next) {
        const tmpl: EventTemplate = {
          kind: KIND_REACTION,
          created_at: Math.floor(Date.now() / 1000),
          content: LIKE,
          tags: [
            ["e", nip.id],
            ["a", nip.address],
            ["p", nip.pubkey],
            ["k", String(KIND_NIP)],
          ],
        };
        await dataLayer.publish(tmpl);
      }
    } catch (err) {
      setOptimistic(!next); // roll back on failure
      toast.error(err instanceof Error ? err.message : "Reaction failed.");
    }
  }, [nip, myLike, optimistic, observedLiked, onNeedsAuth]);

  return { count, liked, pending: false, toggleLike };
}
