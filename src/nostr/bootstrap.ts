import {
  DataLayer,
  LocalRelayClient,
  workerChannel,
  setDataLayer,
} from "@formstr/local-relay";
import { createSigner } from "@formstr/signer";
import { SimplePool } from "nostr-tools/pool";
import type { EventTemplate, Event } from "nostr-tools";
import { AGGREGATOR_RELAY, APP_NAME, APP_URL, SEARCH_RELAYS } from "./constants";
import { loadRelays } from "./relays";

// One signer for the whole app. Handles NIP-07 / NIP-46 / NIP-49 / NIP-55 and
// persists the active account across reloads (re-hydrated as locked). The app
// metadata is shown to remote signers (Amber, etc.) on the consent screen.
export const signer = createSigner({
  appName: APP_NAME,
  appUrl: APP_URL,
});

// A shared relay pool, reused for NIP-46 silent unlock on cold start so the
// bunker session is re-attached without re-prompting the user.
export const pool = new SimplePool();

// The user's effective relay list (persisted override or defaults), always
// including the aggregator relay so global approval counts can resolve.
const userRelays = [...new Set([...loadRelays(), AGGREGATOR_RELAY])];

// Spawn the ready-made local-relay worker. It owns every connection decision;
// the app only declares interests (observe) and publishes.
const worker = new Worker(
  new URL("@formstr/local-relay/worker", import.meta.url),
  { type: "module" },
);

const client = new LocalRelayClient(workerChannel(worker));
client.setUserRelays(userRelays);

// The data layer signs through whichever account is currently unlocked. The
// callback resolves the active signer lazily, so publishing before login throws
// a clear error instead of capturing a stale signer at bootstrap time.
export const dataLayer = new DataLayer({
  client,
  sign: async (template: EventTemplate): Promise<Event> => {
    const active = signer.getActiveSigner();
    if (!active) throw new Error("Log in to sign this event.");
    return active.signEvent(template);
  },
});

dataLayer.setUserRelays(userRelays);
dataLayer.setSearchRelays(SEARCH_RELAYS);

// Install the process-wide singleton (lets `getDataLayer()` work anywhere).
setDataLayer(dataLayer);

/**
 * Re-attach the previously-active account from storage without prompting the
 * user — extension/NIP-46/Android all reconstruct silently. Returns the
 * unlocked signer, or `null` when there's nothing to unlock or the method needs
 * an explicit secret (ncryptsec → caller must prompt for the passphrase).
 */
export async function silentUnlock() {
  const account = signer.getActiveAccount();
  if (!account) return null;
  try {
    return await signer.unlock({ pool });
  } catch {
    return null;
  }
}
