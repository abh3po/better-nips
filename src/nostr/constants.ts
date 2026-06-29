// Event kinds and label conventions this client speaks.

/** Community-authored NIP (NostrHub "NIPs on Nostr" spec). Addressable. */
export const KIND_NIP = 30817;
/** NIP-32 label event — NostrHub's approval mechanism. */
export const KIND_APPROVAL = 1985;
/** NIP-02 contact list — the source of "following" and web-of-trust. */
export const KIND_CONTACTS = 3;
/** NIP-01 profile metadata. */
export const KIND_PROFILE = 0;
/** NIP-65 relay list metadata — the user's own read/write relays. */
export const KIND_RELAY_LIST = 10002;

/** NIP-32 label namespace ("L") used by NostrHub approvals. */
export const LABEL_NAMESPACE = "nostrhub";
/** NIP-32 label value ("l") for an approval. */
export const LABEL_APPROVE = "approve";

/** Provenance tag we stamp on events we publish. */
export const CLIENT_NAME = "better-nips";

/** Display wordmark. A community effort — not a company. */
export const APP_NAME = "NIP Commons";
/** One-line description shown under the wordmark. */
export const APP_TAGLINE = "Community NIPs, surfaced by trust";
/** App URL — surfaced to remote signers on the NIP-46 consent screen. */
export const APP_URL = "https://github.com/formstr-hq/better-nips";

/** Relays we read from / publish to by default (user-overridable in Settings). */
export const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
];

export const SEARCH_RELAYS = ["wss://relay.nostr.band"];

/**
 * Aggregator relay that mirrors NostrHub NIPs **and** their approvals. Always
 * appended to the user's relay set (even a customized one) because author-less
 * approval reads only reach `user relays ∪ gossip pool` — without a relay that
 * holds everyone's approvals, global counts (e.g. arthurfranca's) never load.
 */
export const AGGREGATOR_RELAY = "wss://relay.ditto.pub";

// No cap on the web-of-trust set: every direct follow and every discovered
// 2nd-degree account is included. `local-relay`'s SyncEngine outbox-partitions
// the author set across relays (each author → only the relays they write to),
// so even a large trust graph is split per relay rather than sent wholesale.
// The whole point of this client is a social-graph surface, not a curated
// canon — so we don't trim it.
