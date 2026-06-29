import { useEffect, useState } from "react";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

let counter = 0;
let toasts: Toast[] = [];
const listeners = new Set<(t: Toast[]) => void>();

function emit() {
  for (const l of listeners) l(toasts);
}

function push(kind: ToastKind, message: string, ttl = 4500) {
  const id = ++counter;
  toasts = [...toasts, { id, kind, message }];
  emit();
  if (ttl > 0) setTimeout(() => dismiss(id), ttl);
  return id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Fire a toast from anywhere — hooks, event handlers, async callbacks. */
export const toast = {
  info: (m: string) => push("info", m),
  success: (m: string) => push("success", m),
  error: (m: string) => push("error", m),
};

/** Subscribe a component to the live toast list. */
export function useToasts(): Toast[] {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setList);
    setList(toasts);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}
