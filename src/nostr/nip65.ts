import type { Event } from "nostr-tools";

export interface RelayEntry {
  url: string;
  read: boolean;
  write: boolean;
}

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Parse a NIP-65 relay list (kind 10002) into entries. Each `r` tag is
 * `["r", url]` (both read+write) or `["r", url, "read"|"write"]`.
 */
export function parseRelayList(event: Event | null | undefined): RelayEntry[] {
  if (!event) return [];
  const out: RelayEntry[] = [];
  const seen = new Set<string>();
  for (const t of event.tags) {
    if (t[0] !== "r" || !t[1]) continue;
    const url = normalize(t[1]);
    if (!/^wss?:\/\/.+/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const marker = t[2];
    out.push({
      url,
      read: marker !== "write",
      write: marker !== "read",
    });
  }
  return out;
}

/** Flat list of relay URLs from a NIP-65 list (read ∪ write). */
export function relayUrls(entries: RelayEntry[]): string[] {
  return entries.map((e) => e.url);
}
