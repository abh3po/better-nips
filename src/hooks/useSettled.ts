import { useEffect, useRef, useState } from "react";

/**
 * Returns `value`, but only after its serialized content has stopped changing
 * for `ms`. Subscription inputs derived from a streaming query (author sets,
 * address lists) grow on every batch; feeding them straight into `useObserve`
 * re-subscribes — and momentarily clears — the dependent query on every frame.
 * Letting them settle first means we re-subscribe once the firehose quiets,
 * not continuously. Identity is stable between settles, so it won't itself
 * trigger spurious renders.
 */
export function useSettled<T>(value: T, ms: number): T {
  const key = JSON.stringify(value);
  const [settled, setSettled] = useState<{ key: string; value: T }>(() => ({
    key,
    value,
  }));
  // Capture the freshest value at fire time without keeping it in the deps.
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (key === settled.key) return;
    const h = setTimeout(() => setSettled({ key, value: latest.current }), ms);
    return () => clearTimeout(h);
  }, [key, settled.key, ms]);

  return settled.value;
}
