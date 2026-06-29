import { useMemo, useState } from "react";
import type { Nip } from "../nostr/nips";
import { useProfiles, type Profile } from "../hooks/useNips";
import { useReactions } from "../hooks/useReactions";
import { useComments } from "../hooks/useComments";
import { useZaps } from "../hooks/useZaps";
import { CommentThread } from "./CommentThread";
import { ZapDialog } from "./ZapDialog";

function formatSats(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/**
 * The social feedback menu for a NIP — NIP-25 like, NIP-22 comments, NIP-57
 * zaps. (Approve / disapprove are NIP-32 verdicts handled separately, beside
 * the body.) Self-contained: owns the reaction/comment/zap hooks and renders
 * the collapsible thread + zap dialog.
 */
export function FeedbackBar({
  nip,
  recipient,
  recipientName,
  loggedIn,
  onNeedsAuth,
}: {
  nip: Nip;
  recipient: Profile | undefined;
  recipientName: string;
  loggedIn: boolean;
  onNeedsAuth: () => void;
}) {
  const ref = useMemo(
    () => ({ id: nip.id, pubkey: nip.pubkey, address: nip.address }),
    [nip.id, nip.pubkey, nip.address],
  );
  const reactions = useReactions(ref, onNeedsAuth);
  const { tree, count, post, pending } = useComments(ref, onNeedsAuth);
  const zaps = useZaps(ref, recipient, onNeedsAuth);

  const [showComments, setShowComments] = useState(false);
  const [zapOpen, setZapOpen] = useState(false);

  // Profiles for everyone in the thread.
  const commentAuthors = useMemo(() => {
    const set = new Set<string>();
    const walk = (nodes: typeof tree) => {
      for (const n of nodes) {
        set.add(n.pubkey);
        walk(n.replies);
      }
    };
    walk(tree);
    return [...set];
  }, [tree]);
  const profiles = useProfiles(commentAuthors);

  return (
    <div className="feedback">
      <div className="feedback-bar">
        <button
          className={`feedback-btn${reactions.liked ? " active like" : ""}`}
          onClick={() => reactions.toggleLike()}
          title={reactions.liked ? "Unlike" : "Like"}
        >
          <span className="fb-icon">{reactions.liked ? "♥" : "♡"}</span>
          {reactions.count > 0 && (
            <span className="fb-count">{reactions.count}</span>
          )}
        </button>

        <button
          className={`feedback-btn${showComments ? " active" : ""}`}
          onClick={() => setShowComments((s) => !s)}
          title="Comments"
        >
          <span className="fb-icon">💬</span>
          {count > 0 && <span className="fb-count">{count}</span>}
        </button>

        <button
          className="feedback-btn zap"
          onClick={() => {
            if (!loggedIn) {
              onNeedsAuth();
              return;
            }
            setZapOpen(true);
          }}
          disabled={!zaps.zappable}
          title={
            zaps.zappable
              ? "Zap the author"
              : "Author has no lightning address"
          }
        >
          <span className="fb-icon">⚡</span>
          {zaps.totalSats > 0 && (
            <span className="fb-count">{formatSats(zaps.totalSats)}</span>
          )}
        </button>
      </div>

      {showComments && (
        <CommentThread
          tree={tree}
          count={count}
          profiles={profiles}
          pending={pending}
          loggedIn={loggedIn}
          onPost={post}
        />
      )}

      <ZapDialog
        open={zapOpen}
        onClose={() => setZapOpen(false)}
        recipientName={recipientName}
        requestInvoice={zaps.requestInvoice}
      />
    </div>
  );
}
