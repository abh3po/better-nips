// Event kinds and label conventions this client speaks.

/** Community-authored NIP (NostrHub "NIPs on Nostr" spec). Addressable. */
export const KIND_NIP = 30817;
/** NIP-32 label event — NostrHub's approval mechanism. */
export const KIND_APPROVAL = 1985;
/** NIP-02 contact list — the source of "following" and web-of-trust. */
export const KIND_CONTACTS = 3;
/** NIP-01 profile metadata. */
export const KIND_PROFILE = 0;

/** NIP-32 label namespace ("L") used by NostrHub approvals. */
export const LABEL_NAMESPACE = "nostrhub";
/** NIP-32 label value ("l") for an approval. */
export const LABEL_APPROVE = "approve";

/** Provenance tag we stamp on events we publish. */
export const CLIENT_NAME = "better-nips";

export const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
];

export const SEARCH_RELAYS = ["wss://relay.nostr.band"];

/** Cap the web-of-trust author set so upstream filters stay sane. */
export const WOT_MAX_AUTHORS = 500;
/** Cap how many of the user's follows we fan out for 2nd-degree discovery. */
export const WOT_SEED_LIMIT = 300;
