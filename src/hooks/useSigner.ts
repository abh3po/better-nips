import { useCallback, useEffect, useState } from "react";
import { signer } from "../nostr/bootstrap";
import { dataLayer } from "../nostr/bootstrap";

interface SignerState {
  pubkey: string | null;
  /** True once an account is selected, even if still locked. */
  loggedIn: boolean;
}

function snapshot(): SignerState {
  const account = signer.getActiveAccount();
  return { pubkey: account?.pubkey ?? null, loggedIn: !!account };
}

/**
 * React binding for the shared signer. Tracks the active account, drives the
 * data layer's scope on account changes, and exposes a NIP-07 login.
 */
export function useSigner() {
  const [state, setState] = useState<SignerState>(snapshot);

  useEffect(() => {
    const sync = () => {
      const next = snapshot();
      setState(next);
      dataLayer.setActiveAccount(next.pubkey);
    };
    sync();
    return signer.onChange(sync);
  }, []);

  const loginExtension = useCallback(async () => {
    await signer.loginWithExtension();
  }, []);

  const logout = useCallback(async () => {
    await signer.logout();
  }, []);

  return { ...state, loginExtension, logout };
}
