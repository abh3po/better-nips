import { useCallback, useEffect, useState } from "react";
import type { LoginMethod, StoredAccount } from "@formstr/signer";
import { signer, dataLayer, silentUnlock } from "../nostr/bootstrap";

interface SignerState {
  pubkey: string | null;
  /** True once an account is selected, even if still locked. */
  loggedIn: boolean;
  /** True once the active account has a usable in-memory signer. */
  unlocked: boolean;
  /** Login method of the active account, if any. */
  method: LoginMethod | null;
  /** Every persisted account (for the account switcher). */
  accounts: StoredAccount[];
}

function snapshot(): SignerState {
  const account = signer.getActiveAccount();
  return {
    pubkey: account?.pubkey ?? null,
    loggedIn: !!account,
    unlocked: !!signer.getActiveSigner(),
    method: account?.method ?? null,
    accounts: signer.listAccounts(),
  };
}

/**
 * React binding for the shared signer. Tracks the active account + lock state,
 * drives the data layer's scope on account changes, and re-attaches the
 * previously-active account silently on cold start (extension / NIP-46 /
 * Android). An `ncryptsec` account can't be unlocked silently — it surfaces as
 * `loggedIn && !unlocked`, and the UI prompts for the passphrase.
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
    const off = signer.onChange(sync);
    // Re-attach the persisted account without prompting; onChange re-syncs.
    void silentUnlock().finally(sync);
    return off;
  }, []);

  const logout = useCallback(async (pubkey?: string) => {
    await signer.logout(pubkey);
  }, []);

  const switchAccount = useCallback(async (pubkey: string) => {
    await signer.switchAccount(pubkey);
    // A freshly-switched account starts locked — try to re-attach silently.
    await silentUnlock();
  }, []);

  return {
    ...state,
    /** Account present but no usable signer (e.g. ncryptsec needs a passphrase). */
    locked: state.loggedIn && !state.unlocked,
    logout,
    switchAccount,
  };
}
