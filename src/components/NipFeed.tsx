import { useNipFeed, useProfiles, type Surface } from "../hooks/useNips";
import { useApprove } from "../hooks/useApprove";
import { NipCard } from "./NipCard";

export function NipFeed({
  surface,
  pubkey,
  follows,
  webOfTrust,
}: {
  surface: Surface;
  pubkey: string | null;
  follows: string[];
  webOfTrust: Set<string>;
}) {
  const { nips, ready, authors } = useNipFeed(
    surface,
    pubkey,
    follows,
    webOfTrust,
  );
  const profiles = useProfiles(authors);
  const { approve, approved, pending } = useApprove();

  if (surface !== "global" && !pubkey) {
    return (
      <p className="empty">
        Connect a Nostr signer to surface NIPs from your network.
      </p>
    );
  }

  if (nips.length === 0) {
    return (
      <p className="empty">
        {ready
          ? "No community NIPs found for this surface yet."
          : "Loading NIPs from your relays…"}
      </p>
    );
  }

  return (
    <div className="feed">
      {nips.map((nip) => {
        const isApproved = approved.has(nip.address);
        const count = nip.approvers.size + (isApproved && !nip.approvers.has(pubkey ?? "") ? 1 : 0);
        return (
          <NipCard
            key={nip.address}
            nip={nip}
            profile={profiles.get(nip.pubkey)}
            approvalCount={count}
            approved={isApproved || nip.approvers.has(pubkey ?? "")}
            pending={pending.has(nip.address)}
            onApprove={() => void approve(nip)}
          />
        );
      })}
    </div>
  );
}
