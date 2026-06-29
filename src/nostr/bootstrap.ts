import {
  DataLayer,
  LocalRelayClient,
  workerChannel,
  setDataLayer,
} from "@formstr/local-relay";
import { createSigner } from "@formstr/signer";
import type { EventTemplate, Event } from "nostr-tools";
import { RELAYS, SEARCH_RELAYS } from "./constants";

// One signer for the whole app. Handles NIP-07 / NIP-46 / NIP-49 / NIP-55 and
// persists the active account across reloads (re-hydrated as locked).
export const signer = createSigner();

// Spawn the ready-made local-relay worker. It owns every connection decision;
// the app only declares interests (observe) and publishes.
const worker = new Worker(
  new URL("@formstr/local-relay/worker", import.meta.url),
  { type: "module" },
);

const client = new LocalRelayClient(workerChannel(worker));
client.setUserRelays(RELAYS);

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

dataLayer.setUserRelays(RELAYS);
dataLayer.setSearchRelays(SEARCH_RELAYS);

// Install the process-wide singleton (lets `getDataLayer()` work anywhere).
setDataLayer(dataLayer);
