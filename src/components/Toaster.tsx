import { dismiss, useToasts } from "../lib/toast";

const ICON: Record<string, string> = {
  info: "ⓘ",
  success: "✓",
  error: "!",
};

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          onClick={() => dismiss(t.id)}
        >
          <span className="toast-icon">{ICON[t.kind]}</span>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
