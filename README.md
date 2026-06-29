# better-nips

A Nostr client for **community-authored NIPs** (NostrHub's `kind:30817` spec),
surfaced by **following** and **web-of-trust**, with one-click **NIP-32 approvals**.

Built on [`@formstr/signer`](https://www.npmjs.com/package/@formstr/signer) and
[`@formstr/local-relay`](https://www.npmjs.com/package/@formstr/local-relay).

## What it does

- Lists `kind:30817` community NIPs (title, summary, the kinds they define).
- Three surfaces: **Following**, **Web of Trust** (follows-of-follows), **Global**.
- Ranks NIPs by **trust-weighted approvals** — `kind:1985` NIP-32 labels
  (`L=nostrhub`, `l=approve`). A direct follow's approval counts more than a
  2nd-degree one.
- **Approve** publishes the exact event NostrHub signs:
  ```json
  { "kind": 1985, "content": "",
    "tags": [["L","nostrhub"],["l","approve","nostrhub"],
             ["a","30817:<pubkey>:<d>"],["p","<pubkey>"],["client","better-nips"]] }
  ```

See [`nostrhub-spec-references.md`](./nostrhub-spec-references.md) for the spec
research this is built on.

## Architecture

The app **only declares interests and publishes**. The `local-relay` Web Worker
owns every connection decision (outbox routing, dedup, caching).

| Concern | Where |
|---------|-------|
| Login / signing (NIP-07/46/49/55) | `@formstr/signer` → `src/nostr/bootstrap.ts`, `src/hooks/useSigner.ts` |
| Network + cache | `@formstr/local-relay` worker → `src/nostr/bootstrap.ts` |
| Surfacing (following / WoT / global) | `buildFilters` + `Scope`/`ScopeUser` → `src/hooks/useNips.ts` |
| Web-of-trust set | `src/nostr/wot.ts` (kind-3 fan-out, ranked + capped) |
| NIP / approval parsing | `src/nostr/nips.ts` |
| Approve action | `src/hooks/useApprove.ts` |

The `following` and `web-of-trust` surfaces map straight onto `local-relay`'s
`Scope` types `following` / `network`, fed a `ScopeUser` carrying `follows` and
`webOfTrust` — so the data layer builds the filters and routes relays; the UI
never touches a raw filter or a socket.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

Connect with a NIP-07 browser extension (Alby, nos2x, …) to load your follows
and enable the Following / Web of Trust surfaces. Global works logged-out.

```bash
npm run build    # typecheck + production build
```
