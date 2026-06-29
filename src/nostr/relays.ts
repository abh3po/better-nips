import { RELAYS } from "./constants";

const STORAGE_KEY = "better-nips:relays";

function isValidRelay(url: string): boolean {
  return /^wss?:\/\/.+/i.test(url.trim());
}

/** The user's relay list — persisted override, or the built-in defaults. */
export function loadRelays(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...RELAYS];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((r) => typeof r === "string")) {
      const cleaned = parsed.map((r) => r.trim()).filter(isValidRelay);
      return cleaned.length > 0 ? cleaned : [...RELAYS];
    }
  } catch {
    /* fall through to defaults */
  }
  return [...RELAYS];
}

/** Persist a relay list. Normalizes + dedupes; ignores invalid URLs. */
export function saveRelays(relays: string[]): string[] {
  const cleaned = [
    ...new Set(relays.map((r) => r.trim()).filter(isValidRelay)),
  ];
  const next = cleaned.length > 0 ? cleaned : [...RELAYS];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export { isValidRelay };
