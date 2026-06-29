import { npubEncode } from "nostr-tools/nip19";
import { useSigner } from "../hooks/useSigner";

function shortNpub(pubkey: string): string {
  try {
    const npub = npubEncode(pubkey);
    return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
  } catch {
    return pubkey.slice(0, 10);
  }
}

export function LoginBar() {
  const { pubkey, loggedIn, loginExtension, logout } = useSigner();

  return (
    <header className="topbar">
      <div className="brand">
        better-nips
        <span className="brand-sub">community NIPs, surfaced by trust</span>
      </div>
      <div className="account">
        {loggedIn && pubkey ? (
          <>
            <span className="npub" title={pubkey}>
              {shortNpub(pubkey)}
            </span>
            <button className="btn ghost" onClick={() => void logout()}>
              Log out
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => void loginExtension()}>
            Connect (NIP-07)
          </button>
        )}
      </div>
    </header>
  );
}
