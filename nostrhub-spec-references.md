# NostrHub — Spec & Reference Notes

Research notes on what [nostrhub.io](https://nostrhub.io/) is and which Nostr
specs it uses for "NIPs, approvals and stuff."

## What NostrHub is

NostrHub is a **Nostr-native developer hub** built by [Soapbox](https://soapbox.pub).
It's where the community can **discover, draft, discuss, and approve NIPs**, browse
apps, and host/collaborate on git repositories — all stored as Nostr events on
relays rather than on a central server. Think "GitHub for Nostr, running on Nostr."

Mostly it layers on **existing** NIPs, but it also defines **one custom kind of its
own** for NIPs published directly on Nostr. Three mechanisms are easy to conflate:

0. **NIPs published on NostrHub itself** → **kind 30817** (NostrHub's own "NIPs on Nostr" spec).
1. **Code / NIP-proposal collaboration** → governed by **NIP-34** (git stuff).
2. **The developer community feed / moderation** → governed by **NIP-72** (moderated communities).

---

## 0. Kind 30817 — "NIPs on Nostr" (NostrHub's custom-NIP spec)

This is NostrHub's **own** spec for **community-authored NIPs** — letting users publish
a NIP as a Nostr event instead of (or before) a GitHub PR. It is self-describing: the
canonical definition is itself a kind-30817 event.

- **Canonical event:** `naddr1qvzqqqrcvypzqprpljlvcnpnw3pejvkkhrc3y6wvmd7vjuad0fg2ud3dky66gaxaqqxku6tswvkk7m3ddehhxarjqk4nmy`
  - kind `30817`, author `0461fcbecc4c3374439932d6b8f11269ccdb7cc973ad7a50ae362db135a474dd`, `d` = `nips-on-nostr`, `client` = `NostrHub`
- **Addressable event** (30000–39999 range): only the latest per `pubkey + kind + d` is kept.

### Structure

```json
{
  "kind": 30817,
  "content": "<full NIP spec in Markdown>",
  "tags": [
    ["d", "<unique-identifier>"],
    ["title", "<human-readable title>"],
    ["k", "<kind-number>", "<kind-name>"]
  ]
}
```

| Tag     | Req? | Meaning |
|---------|------|---------|
| `d`     | yes  | Unique id; MAY be auto-slugified from the title. |
| `title` | yes  | Human-readable title. |
| `k`     | no   | Repeatable. `["k", "<kind-number>", "<kind-name>"]` — declares event kinds this NIP defines/concerns, e.g. `["k", "37516", "Geocache Listing"]`. |

- **content** holds the full NIP in Markdown.
- **Client guidance:** display custom NIPs distinctly from official ones, show authorship
  prominently, support search/filter and Markdown rendering.
- **Relay guidance:** MAY index `k` tags so NIPs can be discovered by the kinds they define.
- **Lineage:** explicitly references the **NUD ("Nostr Unofficial Documents")** idea —
  PRs [#1214](https://github.com/nostr-protocol/nips/pull/1214) and
  [#1519](https://github.com/nostr-protocol/nips/pull/1519).

> This is the answer to "what spec does NostrHub use for NIPs": official NIPs are mirrored
> from the git repo, but NIPs *authored on NostrHub* are kind-30817 events.

### Approving a custom NIP — NIP-32 label (kind 1985)

The 30817 spec text itself defines **no** approval field, but NostrHub approves custom
NIPs at the **application layer** using a **[NIP-32](https://github.com/nostr-protocol/nips/blob/master/32.md)
label event**. Clicking "Approve" on nostrhub.io signs and publishes:

```json
{
  "kind": 1985,
  "content": "",
  "tags": [
    ["L", "nostrhub"],
    ["l", "approve", "nostrhub"],
    ["a", "30817:<author-pubkey>:<d-identifier>"],
    ["p", "<author-pubkey>"],
    ["client", "NostrHub"]
  ]
}
```

| Tag | Meaning |
|-----|---------|
| `["L","nostrhub"]` | label **namespace** (scopes the label to NostrHub). |
| `["l","approve","nostrhub"]` | the label value `approve` within that namespace — the approval itself. |
| `["a", ...]` | addressable coordinate of the **custom NIP being approved** (points at latest version). |
| `["p", ...]` | pubkey of the NIP's author. |
| `["client","NostrHub"]` | client tag. |

**Semantics:** an approval is a **signed endorsement / curation signal**, not a gated
merge. Anyone may publish one — authors self-approve their own NIPs, and approvals
from **NostrHub's own pubkey** (`0461…74dd`) act as the de-facto "official" signal,
while others are community/web-of-trust endorsements. Because the target is an `a`
(addressable) reference, an approval always tracks the latest version of that NIP.
Confirmed live on relays (e.g. event `9c9fd74d838c…` = NostrHub approving `nips-on-nostr`).

---

## 1. NIP-34 — Git collaboration ("approving" patches & NIP proposals)

Source: <https://github.com/nostr-protocol/nips/blob/master/34.md> (mirror: <https://nips.nostr.com/34>)

NIP-34 defines how git repositories, issues, patches, and their **status/approval**
live on Nostr. This is the machinery behind NostrHub's repo pages, issue/patch
submission, and the open/merged/closed state you see on a proposal.

### Event kinds

| Kind  | Meaning |
|-------|---------|
| 30617 | **Repository announcement** — declares a repo exists (id, name, description, web/clone URLs, relays, maintainers, hashtags). The `r` tag with the `euc` marker is the earliest-unique-commit id used to group forks. |
| 30618 | **Repository state** — current branch/tag refs (HEAD, etc.). |
| 1617  | **Patch** — a git patch (used when each event is under ~60kb). |
| 1621  | **Issue** — markdown human-readable threads: bug reports, feature requests, questions. |
| 1630  | **Status: Open** (default for a new root patch/issue). |
| 1631  | **Status: Applied / Merged** (for patches) or **Resolved** (for issues). Carries `merge-commit` / `applied-as-commits` tags identifying what was merged. |
| 1632  | **Status: Closed.** |
| 1633  | **Status: Draft.** |

> Note: some clients/forks also use kinds 1618/1619 for pull-request-style events.
> These come from DanConwayDev's "code collaboration rebooted" work and are not in
> the canonical master `34.md` — treat them as in-flux.

### How "approval" actually works

- A root **patch (1617)** or **issue (1621)** starts in the implicit **Open** state.
- State is changed by publishing a **Status event (1630–1633)**.
- **Validity rule:** the most recent Status event (by `created_at`) **from either the
  patch/issue author or a repo maintainer** is the authoritative one. Maintainers are
  listed in the repo announcement (kind 30617), so "who can approve/merge" is defined
  by the repo, not by NostrHub.
- A patch is "approved/merged" when a maintainer issues a **kind 1631** (applied/merged)
  referencing it.

So on NostrHub, submitting a NIP edit or a code change = publishing a patch/issue
event; "approval" = a maintainer's status event marking it merged.

---

## 2. NIP-72 — Moderated communities (the dev community space)

Source: <https://github.com/nostr-protocol/nips/blob/master/72.md>

NostrHub has a **built-in NIP-72 community space for Nostr developers**. This is the
"approvals" mechanism for *posts/discussion*, distinct from git patch merging.

### Event kinds

| Kind  | Meaning |
|-------|---------|
| 34550 | **Community definition** — replaceable event defining the community and its current list of moderators/administrators. |
| 4550  | **Post approval** — a moderator approves a post into the community by re-publishing/referencing it. |

### How it works

- A community is defined once (kind 34550), naming its moderators.
- Users post normally; a post becomes "part of" the community when a **moderator
  issues a kind 4550 approval** referencing that post.
- Clients display the community feed as the set of moderator-approved posts.

---

## 3. The underlying NIP process itself (off-NostrHub context)

How NIPs become "official" upstream is a **social/GitHub-PR process**, not an on-Nostr
kind. Per the NIPs repo README (<https://github.com/nostr-protocol/nips>):

- Someone opens a PR proposing a standard; others give feedback; once "most people
  reasonably agree," it's codified as a NIP.
- Acceptance criteria: implemented in **≥2 clients and 1 relay** (when applicable),
  makes sense, optional & backwards-compatible, and not a duplicate way of doing an
  existing thing.

NostrHub mirrors/surfaces these NIPs (e.g. `nostrhub.io/34/`, `nostrhub.io/72/`) and
lets the community draft/discuss them via the NIP-34 + NIP-72 machinery above.

---

## References

- NostrHub site — <https://nostrhub.io/>
- NostrHub announcement (Soapbox) — <https://soapbox.pub/blog/announcing-nostrhub/>
- NIP-34 "git stuff" — <https://github.com/nostr-protocol/nips/blob/master/34.md> · <https://nips.nostr.com/34> · <https://nostrhub.io/34/>
- NIP-72 "moderated communities" — <https://github.com/nostr-protocol/nips/blob/master/72.md> · <https://nostrhub.io/72/>
- NIP-01 "basic protocol flow" — <https://github.com/nostr-protocol/nips/blob/master/01.md> · <https://nostrhub.io/01/>
- NIPs repository (process & index) — <https://github.com/nostr-protocol/nips>
- Searchable NIPs index — <https://nips.nostr.com/>
