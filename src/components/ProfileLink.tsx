import type { ReactNode } from "react";
import { npubEncode } from "nostr-tools/nip19";
import { POLLERAMA_URL } from "../nostr/constants";

/** A profile's page on pollerama (the sister app) for a given pubkey. */
export function profileUrl(pubkey: string): string {
  try {
    return `${POLLERAMA_URL}/profile/${npubEncode(pubkey)}`;
  } catch {
    return `${POLLERAMA_URL}/profile/${pubkey}`;
  }
}

/**
 * Wraps an avatar / name in a link to the author's pollerama profile, opened in
 * a new tab. Stops click propagation so tapping a profile inside a clickable
 * NIP card doesn't also open the card.
 */
export function ProfileLink({
  pubkey,
  className,
  title,
  children,
}: {
  pubkey: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <a
      className={`profile-link${className ? ` ${className}` : ""}`}
      href={profileUrl(pubkey)}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? "Open profile on pollerama"}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
}
