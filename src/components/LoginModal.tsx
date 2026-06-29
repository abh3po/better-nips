import { useEffect, useRef } from "react";
import {
  attachLoginListeners,
  renderLoginHtml,
  type LoginTab,
} from "@formstr/signer/ui";
import { signer, pool } from "../nostr/bootstrap";
import { toast } from "../lib/toast";

/**
 * The login modal. It mounts the signer package's built-in login UI — which
 * already implements every method (create / ncryptsec / NIP-07 extension /
 * NIP-46 bunker / nostrconnect / NIP-55 Android) as tabs — instead of jumping
 * straight into a single method. The modal owns its own overlay; we just render
 * its markup and wire the callbacks.
 */
export function LoginModal({
  open,
  initialTab,
  onClose,
}: {
  open: boolean;
  initialTab?: LoginTab;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = renderLoginHtml();
    const binding = attachLoginListeners(host, signer, {
      pool,
      defaultTab: initialTab ?? defaultTab(),
      onLogin: (account) => {
        toast.success(`Signed in as ${shortNpub(account.npub)}.`);
        onClose();
      },
      onCancel: onClose,
      onError: (err) => toast.error(err.message || "Login failed."),
    });

    // Close on Escape for keyboard users.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      binding.detach();
      host.innerHTML = "";
    };
  }, [open, initialTab, onClose]);

  if (!open) return null;
  return <div ref={hostRef} className="login-host" />;
}

function defaultTab(): LoginTab {
  return typeof window !== "undefined" && "nostr" in window
    ? "extension"
    : "nostrconnect";
}

function shortNpub(npub: string): string {
  return npub.length > 16 ? `${npub.slice(0, 10)}…${npub.slice(-4)}` : npub;
}
