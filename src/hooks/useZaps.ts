import { useCallback, useMemo } from "react";
import type { Event, EventTemplate, Filter } from "nostr-tools";
import * as nip57 from "nostr-tools/nip57";
import { useObserve } from "./useObserve";
import { signer } from "../nostr/bootstrap";
import { loadRelays } from "../nostr/relays";
import { KIND_ZAP_RECEIPT, KIND_ZAP_REQUEST } from "../nostr/constants";
import type { Profile } from "./useNips";

interface NipRef {
  id: string;
  pubkey: string;
  address: string;
}

export interface ZapsState {
  /** Total sats zapped to this NIP, across all receipts. */
  totalSats: number;
  /** Number of distinct zappers. */
  zapperCount: number;
  /** Whether the recipient can receive zaps (has a lightning address). */
  zappable: boolean;
  /**
   * Sign a NIP-57 zap request and fetch a bolt11 invoice from the recipient's
   * LNURL callback. Returns the invoice string (for a QR / wallet handoff), or
   * throws with a human-readable message.
   */
  requestInvoice: (amountSats: number, comment: string) => Promise<string>;
}

/** Pull a zap receipt's amount (sats) from its bolt11 invoice tag. */
function receiptSats(receipt: Event): number {
  const bolt11 = receipt.tags.find((t) => t[0] === "bolt11")?.[1];
  if (!bolt11) return 0;
  try {
    return nip57.getSatoshisAmountFromBolt11(bolt11);
  } catch {
    return 0;
  }
}

/** The pubkey that sent a zap — read from the embedded zap request, then `P`. */
function zapper(receipt: Event): string | null {
  const desc = receipt.tags.find((t) => t[0] === "description")?.[1];
  if (desc) {
    try {
      const req = JSON.parse(desc) as { pubkey?: string };
      if (req.pubkey) return req.pubkey;
    } catch {
      /* fall through to the P tag */
    }
  }
  return receipt.tags.find((t) => t[0] === "P")?.[1] ?? null;
}

/**
 * NIP-57 zaps for a single NIP. Observes zap receipts (kind 9735) tagged by the
 * NIP's event id or addressable coordinate to total the sats received, and
 * exposes `requestInvoice` to mint a payable bolt11 from the author's lightning
 * address. Payment itself happens in the user's wallet (we only hand off the
 * invoice) — the receipt the wallet's LNURL server publishes is what bumps the
 * total here.
 */
export function useZaps(
  nip: NipRef | null,
  recipient: Profile | undefined,
  onNeedsAuth?: () => void,
): ZapsState {
  const filters: Filter[] | null = nip
    ? [
        { kinds: [KIND_ZAP_RECEIPT], "#e": [nip.id] },
        { kinds: [KIND_ZAP_RECEIPT], "#a": [nip.address] },
      ]
    : null;
  const { events } = useObserve(filters);

  const { totalSats, zapperCount } = useMemo(() => {
    const seen = new Set<string>();
    const zappers = new Set<string>();
    let total = 0;
    for (const e of events) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      total += receiptSats(e);
      const z = zapper(e);
      if (z) zappers.add(z);
    }
    return { totalSats: total, zapperCount: zappers.size };
  }, [events]);

  const zappable = !!(recipient?.lud16 || recipient?.lud06);

  const requestInvoice = useCallback(
    async (amountSats: number, comment: string): Promise<string> => {
      if (!nip) throw new Error("No NIP to zap.");
      const active = signer.getActiveSigner();
      if (!active) {
        onNeedsAuth?.();
        throw new Error("Re-authenticate to zap.");
      }
      if (!zappable) {
        throw new Error("This author hasn't set a lightning address.");
      }
      // getZapEndpoint only reads lud06/lud16 out of the metadata's JSON
      // content, so a minimal stand-in is enough to resolve the callback.
      const metadata = {
        content: JSON.stringify({
          lud16: recipient?.lud16,
          lud06: recipient?.lud06,
        }),
      } as Event;
      const endpoint = await nip57.getZapEndpoint(metadata);
      if (!endpoint) {
        throw new Error("Couldn't resolve the author's lightning endpoint.");
      }

      const msats = Math.round(amountSats) * 1000;
      const relays = loadRelays();
      const zapRequest: EventTemplate = {
        kind: KIND_ZAP_REQUEST,
        created_at: Math.floor(Date.now() / 1000),
        content: comment,
        tags: [
          ["relays", ...relays],
          ["amount", String(msats)],
          ["p", nip.pubkey],
          ["e", nip.id],
          ["a", nip.address],
        ],
      };
      const signed = await active.signEvent(zapRequest);
      const url =
        endpoint +
        `?amount=${msats}&nostr=${encodeURIComponent(JSON.stringify(signed))}`;
      const res = await fetch(url);
      const body = (await res.json()) as { pr?: string; reason?: string };
      if (!body.pr) {
        throw new Error(body.reason || "The LNURL server didn't return an invoice.");
      }
      return body.pr;
    },
    [nip, recipient, zappable, onNeedsAuth],
  );

  return { totalSats, zapperCount, zappable, requestInvoice };
}
