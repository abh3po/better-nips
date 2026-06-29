import type { WotStats } from "./wot";

// Bumped if the cached shape changes, so stale entries are ignored.
const VERSION = 1;
const FOLLOWS_KEY = "better-nips:follows";
const WOT_KEY = "better-nips:wot";
// Keep only the few most-recently-used accounts to bound localStorage.
const MAX_ENTRIES = 5;

interface FollowsEntry {
  v: number;
  at: number;
  follows: string[];
}
interface WotEntry {
  v: number;
  at: number;
  wot: string[];
  stats: WotStats;
}

type Store<T> = Record<string, T>;

function read<T>(key: string): Store<T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Store<T>) : {};
  } catch {
    return {};
  }
}

function write<T extends { at: number }>(key: string, store: Store<T>) {
  // LRU-prune to the most recent MAX_ENTRIES before persisting.
  const entries = Object.entries(store).sort((a, b) => b[1].at - a[1].at);
  const pruned = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
  try {
    localStorage.setItem(key, JSON.stringify(pruned));
  } catch {
    /* quota / private mode — caching is best-effort */
  }
}

/** Last known follow list for `pubkey`, for instant first paint. */
export function getCachedFollows(pubkey: string): string[] {
  const e = read<FollowsEntry>(FOLLOWS_KEY)[pubkey];
  return e && e.v === VERSION ? e.follows : [];
}

export function cacheFollows(pubkey: string, follows: string[]) {
  const store = read<FollowsEntry>(FOLLOWS_KEY);
  store[pubkey] = { v: VERSION, at: Date.now(), follows };
  write(FOLLOWS_KEY, store);
}

/** Last computed web-of-trust for `pubkey` (set + stats), or null. */
export function getCachedWot(
  pubkey: string,
): { wot: string[]; stats: WotStats } | null {
  const e = read<WotEntry>(WOT_KEY)[pubkey];
  return e && e.v === VERSION ? { wot: e.wot, stats: e.stats } : null;
}

export function cacheWot(pubkey: string, wot: string[], stats: WotStats) {
  const store = read<WotEntry>(WOT_KEY);
  store[pubkey] = { v: VERSION, at: Date.now(), wot, stats };
  write(WOT_KEY, store);
}
