# NIPs by Pollerama

> Repo: `better-nips`. The app brands itself **NIPs by Pollerama** — the NIPs
> surface of the pollerama family of Nostr apps.

A Nostr client for **community-authored NIPs** (NostrHub's `kind:30817` spec),
surfaced by **following** and **web-of-trust**, with one-click **NIP-32 approvals**.

Built on [`@formstr/signer`](https://www.npmjs.com/package/@formstr/signer) and
[`@formstr/local-relay`](https://www.npmjs.com/package/@formstr/local-relay).

## What it does

- Lists `kind:30817` community NIPs (title, summary, the kinds they define).
  All NIPs are equal — there is no "official" vs "custom" canon. Ranking comes
  purely from your social graph's approvals, not a moderator's blessing.
- **Each NIP has its own shareable screen** (`#/nip/<naddr>`) with full Markdown
  rendering, the kinds it defines, approval count, and copy-link — paste the URL
  to anyone and it loads the NIP cold from relays.
- Three surfaces: **Following**, **Web of Trust** (follows-of-follows), **Global**.
- Sort each surface by **Top** (trust-weighted approvals) or **Newest**.
- Ranks NIPs by **trust-weighted approvals** — `kind:1985` NIP-32 labels
  (`L=nostrhub`, `l=approve`). A direct follow's approval counts more than a
  2nd-degree one.
- **Approve** publishes the exact event NostrHub signs:
  ```json
  { "kind": 1985, "content": "",
    "tags": [["L","nostrhub"],["l","approve","nostrhub"],
             ["a","30817:<pubkey>:<d>"],["p","<pubkey>"],["client","better-nips"]] }
  ```
- **Full login modal** (`@formstr/signer/ui`): NIP-07 extension, NIP-46 bunker /
  nostrconnect, NIP-49 ncryptsec, NIP-55 Android — plus account creation and
  multi-account switching. Sessions **silently re-attach** on reload; a locked
  encrypted key prompts to re-authenticate before signing.
- **Relays follow NIP-65**: your published `kind:10002` read/write list is
  authoritative; only when you have none do we fall back to a default list
  (editable in Settings).
- **No web-of-trust cap** — every follow and every follows-of-follows account is
  included. `local-relay` outbox-partitions the author set across relays, so a
  large trust graph is split per relay rather than blasted at one.
- **Settings**: your web-of-trust breakdown, relay source/health, and account
  management.
- Production niceties: search/filter, loading skeletons, toast notifications for
  publish results/errors, and an online/relay status indicator.

See [`nostrhub-spec-references.md`](./nostrhub-spec-references.md) for the spec
research this is built on.

## Architecture

The app **only declares interests and publishes**. The `local-relay` Web Worker
owns every connection decision (outbox routing, dedup, caching).

| Concern | Where |
|---------|-------|
| Login / signing (NIP-07/46/49/55) + login modal | `@formstr/signer` (+ `/ui`) → `src/nostr/bootstrap.ts`, `src/hooks/useSigner.ts`, `src/components/LoginModal.tsx` |
| Silent session re-attach on reload | `silentUnlock()` → `src/nostr/bootstrap.ts` |
| Network + cache | `@formstr/local-relay` worker → `src/nostr/bootstrap.ts` |
| User relays (NIP-65, default fallback) | `src/nostr/nip65.ts`, `src/hooks/useUserRelays.ts` |
| Routing / shareable NIP screens | `src/hooks/useHashRoute.ts`, `src/components/NipPage.tsx`, `src/hooks/useNipByAddress.ts` |
| Per-account follows + WoT caching | `src/nostr/wotCache.ts` |
| Surfacing (following / WoT / global) | `buildFilters` + `Scope`/`ScopeUser` → `src/hooks/useNips.ts` |
| Web-of-trust **calculation** | `src/nostr/wot.ts` (pure) run inside `src/nostr/wot.worker.ts`, driven by `src/hooks/useWebOfTrust.ts` |
| NIP / approval parsing + Markdown reader | `src/nostr/nips.ts`, `src/lib/markdown.tsx`, `src/components/NipDetail.tsx` |
| Approve action (+ toasts, re-auth) | `src/hooks/useApprove.ts` |
| Relay status / editing | `src/hooks/useRelayStatus.ts`, `src/nostr/relays.ts`, `src/components/Settings.tsx` |

The `following` and `web-of-trust` surfaces map straight onto `local-relay`'s
`Scope` types `following` / `network`, fed a `ScopeUser` carrying `follows` and
`webOfTrust` — so the data layer builds the filters and routes relays; the UI
never touches a raw filter or a socket.

The web-of-trust **aggregation** (fanning out hundreds of follows-of-follows
contact lists, scoring and ranking them) runs in a **dedicated Web Worker**
(`wot.worker.ts`) so it never blocks rendering. The main thread only observes
the raw kind-3 seeds (via the local-relay worker) and hands them off; the WoT
worker returns the trust set plus stats shown in **Settings**.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

Click **Connect** and pick any signer method from the modal (extension, bunker /
nostrconnect, encrypted key, Android, or create a fresh key). Logging in loads
your follows and enables the Following / Web of Trust surfaces. Global works
logged-out.

```bash
npm run build    # typecheck + production build
```
