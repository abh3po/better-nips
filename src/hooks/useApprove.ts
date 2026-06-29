import { useCallback, useMemo, useState } from "react";
import type { Event, EventTemplate, Filter } from "nostr-tools";
import { useObserve } from "./useObserve";
import { dataLayer, signer } from "../nostr/bootstrap";
import {
  CLIENT_NAME,
  KIND_APPROVAL,
  KIND_DELETE,
  LABEL_APPROVE,
  LABEL_DISAPPROVE,
  LABEL_NAMESPACE,
} from "../nostr/constants";
import { toast } from "../lib/toast";
import { approvalTarget, type Nip } from "../nostr/nips";

type Verdict = typeof LABEL_APPROVE | typeof LABEL_DISAPPROVE;
type Effective = Verdict | "none";

const DONE: Record<Verdict, string> = {
  [LABEL_APPROVE]: "Approved",
  [LABEL_DISAPPROVE]: "Disapproved",
};

function verdictOf(e: Event): Verdict | null {
  if (e.tags.some((t) => t[0] === "l" && t[1] === LABEL_APPROVE)) return LABEL_APPROVE;
  if (e.tags.some((t) => t[0] === "l" && t[1] === LABEL_DISAPPROVE))
    return LABEL_DISAPPROVE;
  return null;
}

/**
 * Publish (and retract) NIP-32 verdicts on a NIP. A verdict is a kind-1985
 * label in the `nostrhub` namespace — `approve` (the same event NostrHub signs)
 * or `disapprove`. Because NIP-32 has no native "unlabel", changing or
 * retracting your verdict publishes a NIP-09 deletion (kind 5) for the label it
 * supersedes — so switching approve↔disapprove or clicking your active verdict
 * leaves exactly one (or zero) of your labels live.
 *
 * To delete a label we need its event id, so the hook observes the logged-in
 * user's own labels; it also remembers the ids it published this session, so a
 * switch immediately after a vote can still find the event to delete before the
 * label has been observed back from a relay.
 *
 * `approved` / `disapproved` are the *effective* self-verdict sets (observed
 * labels overlaid with this session's optimistic actions), keyed by NIP address.
 */
export function useApprove(onNeedsAuth?: () => void) {
  const me = signer.getActiveAccount()?.pubkey ?? null;
  const filters: Filter[] | null = me
    ? [{ kinds: [KIND_APPROVAL], authors: [me], "#L": [LABEL_NAMESPACE], limit: 1000 }]
    : null;
  const { events: myLabels } = useObserve(filters);

  const [pending, setPending] = useState<Set<string>>(new Set());
  // Optimistic verdict overrides, applied on top of what relays report.
  const [override, setOverride] = useState<Map<string, Effective>>(new Map());
  // Ids of labels published this session — so a verdict switch can delete a
  // just-published label that hasn't yet been observed back.
  const [sessionLabels, setSessionLabels] = useState<
    Map<string, { approve?: string; disapprove?: string }>
  >(new Map());

  // Latest observed approve & disapprove label event per NIP address.
  const observed = useMemo(() => {
    const map = new Map<string, { approve?: Event; disapprove?: Event }>();
    for (const e of myLabels) {
      const v = verdictOf(e);
      const addr = approvalTarget(e);
      if (!v || !addr) continue;
      const entry = map.get(addr) ?? {};
      const prev = entry[v];
      if (!prev || e.created_at > prev.created_at) entry[v] = e;
      map.set(addr, entry);
    }
    return map;
  }, [myLabels]);

  const observedVerdict = useCallback(
    (addr: string): Effective => {
      const e = observed.get(addr);
      const a = e?.approve?.created_at ?? -1;
      const d = e?.disapprove?.created_at ?? -1;
      if (a < 0 && d < 0) return "none";
      return a >= d ? LABEL_APPROVE : LABEL_DISAPPROVE;
    },
    [observed],
  );

  const effectiveVerdict = useCallback(
    (addr: string): Effective => override.get(addr) ?? observedVerdict(addr),
    [override, observedVerdict],
  );

  const { approved, disapproved } = useMemo(() => {
    const approved = new Set<string>();
    const disapproved = new Set<string>();
    const addrs = new Set<string>([...observed.keys(), ...override.keys()]);
    for (const a of addrs) {
      const v = effectiveVerdict(a);
      if (v === LABEL_APPROVE) approved.add(a);
      else if (v === LABEL_DISAPPROVE) disapproved.add(a);
    }
    return { approved, disapproved };
  }, [observed, override, effectiveVerdict]);

  // The live label ids for an address — session-published ids win over observed.
  const labelIdsFor = useCallback(
    (addr: string) => {
      const o = observed.get(addr) ?? {};
      const s = sessionLabels.get(addr) ?? {};
      return {
        approve: s.approve ?? o.approve?.id,
        disapprove: s.disapprove ?? o.disapprove?.id,
      };
    },
    [observed, sessionLabels],
  );

  const act = useCallback(
    async (nip: Nip, target: Effective) => {
      if (!signer.getActiveSigner()) {
        toast.error("Re-authenticate to weigh in on a NIP.");
        onNeedsAuth?.();
        return;
      }
      const addr = nip.address;
      setPending((p) => new Set(p).add(addr));
      try {
        // Delete any prior label that the new verdict supersedes (the opposite
        // verdict, or — when retracting — both).
        const ids = labelIdsFor(addr);
        const toDelete: string[] = [];
        if (target !== LABEL_APPROVE && ids.approve) toDelete.push(ids.approve);
        if (target !== LABEL_DISAPPROVE && ids.disapprove)
          toDelete.push(ids.disapprove);

        if (toDelete.length > 0) {
          const del: EventTemplate = {
            kind: KIND_DELETE,
            created_at: Math.floor(Date.now() / 1000),
            content: "",
            tags: [
              ...toDelete.map((id) => ["e", id]),
              ["k", String(KIND_APPROVAL)],
            ],
          };
          await dataLayer.publish(del);
        }

        let publishedId: string | undefined;
        if (target !== "none") {
          const template: EventTemplate = {
            kind: KIND_APPROVAL,
            created_at: Math.floor(Date.now() / 1000),
            content: "",
            tags: [
              ["L", LABEL_NAMESPACE],
              ["l", target, LABEL_NAMESPACE],
              ["a", addr],
              ["p", nip.pubkey],
              ["client", CLIENT_NAME],
            ],
          };
          const { event, result } = await dataLayer.publish(template);
          publishedId = event.id;
          if (result.accepted > 0) {
            toast.success(
              `${DONE[target]} — published to ${result.accepted}/${result.total} relays.`,
            );
          } else {
            toast.error("Signed but no relay accepted it. Will retry.");
          }
        } else {
          toast.success("Verdict retracted.");
        }

        // Track session label ids: record the new one, forget superseded ones.
        setSessionLabels((prev) => {
          const next = new Map(prev);
          const entry = { ...(next.get(addr) ?? {}) };
          if (target !== LABEL_APPROVE) delete entry.approve;
          if (target !== LABEL_DISAPPROVE) delete entry.disapprove;
          if (publishedId && target !== "none") entry[target] = publishedId;
          next.set(addr, entry);
          return next;
        });
        setOverride((prev) => new Map(prev).set(addr, target));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to publish label.",
        );
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(addr);
          return next;
        });
      }
    },
    [labelIdsFor, onNeedsAuth],
  );

  const approve = useCallback((nip: Nip) => act(nip, LABEL_APPROVE), [act]);
  const disapprove = useCallback((nip: Nip) => act(nip, LABEL_DISAPPROVE), [act]);
  const retract = useCallback((nip: Nip) => act(nip, "none"), [act]);

  return { approve, disapprove, retract, approved, disapproved, pending };
}
