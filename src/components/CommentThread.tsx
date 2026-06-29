import { useState } from "react";
import { npubEncode } from "nostr-tools/nip19";
import type { CommentNode } from "../hooks/useComments";
import type { Profile } from "../hooks/useNips";
import { Markdown } from "../lib/markdown";
import { ProfileLink } from "./ProfileLink";

function authorLabel(pubkey: string, profile?: Profile): string {
  if (profile?.name) return profile.name;
  try {
    return `${npubEncode(pubkey).slice(0, 12)}…`;
  } catch {
    return pubkey.slice(0, 12);
  }
}

function relativeTime(unixSeconds: number): string {
  const mins = (Date.now() - unixSeconds * 1000) / 60000;
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

const MAX_DEPTH = 4;

function Comment({
  node,
  profiles,
  depth,
  onReply,
  loggedIn,
}: {
  node: CommentNode;
  profiles: Map<string, Profile>;
  depth: number;
  onReply: (content: string, parent: { id: string; pubkey: string }) => void;
  loggedIn: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const profile = profiles.get(node.pubkey);

  const submit = () => {
    if (!draft.trim()) return;
    onReply(draft, { id: node.event.id, pubkey: node.pubkey });
    setDraft("");
    setReplying(false);
  };

  return (
    <div className="comment">
      <div className="comment-head">
        <ProfileLink
          pubkey={node.pubkey}
          className="comment-author-link"
          title={authorLabel(node.pubkey, profile)}
        >
          {profile?.picture ? (
            <img className="avatar xs" src={profile.picture} alt="" />
          ) : (
            <span className="avatar xs placeholder" />
          )}
          <span className="comment-author">{authorLabel(node.pubkey, profile)}</span>
        </ProfileLink>
        <span className="comment-time">{relativeTime(node.createdAt)}</span>
      </div>
      <div className="comment-body markdown">
        <Markdown source={node.content} />
      </div>
      <div className="comment-actions">
        {loggedIn && depth < MAX_DEPTH && (
          <button className="link-btn" onClick={() => setReplying((r) => !r)}>
            {replying ? "Cancel" : "Reply"}
          </button>
        )}
      </div>

      {replying && (
        <div className="comment-reply-box">
          <textarea
            className="comment-input"
            rows={2}
            placeholder="Write a reply…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn sm" onClick={submit} disabled={!draft.trim()}>
            Reply
          </button>
        </div>
      )}

      {node.replies.length > 0 && (
        <div className="comment-replies">
          {node.replies.map((child) => (
            <Comment
              key={child.event.id}
              node={child}
              profiles={profiles}
              depth={depth + 1}
              onReply={onReply}
              loggedIn={loggedIn}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * NIP-22 comment thread for a NIP. Presentational — the parent owns the
 * `useComments` hook and passes the tree + a `post` callback down.
 */
export function CommentThread({
  tree,
  count,
  profiles,
  pending,
  loggedIn,
  onPost,
}: {
  tree: CommentNode[];
  count: number;
  profiles: Map<string, Profile>;
  pending: boolean;
  loggedIn: boolean;
  onPost: (content: string, parent?: { id: string; pubkey: string }) => void;
}) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    onPost(draft);
    setDraft("");
  };

  return (
    <section className="comments-section">
      <h2 className="subsection-title">
        {count === 0 ? "No comments yet" : `${count} comment${count === 1 ? "" : "s"}`}
      </h2>

      {loggedIn ? (
        <div className="comment-compose">
          <textarea
            className="comment-input"
            rows={3}
            placeholder="Add a comment… (Markdown supported)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="btn sm"
            onClick={submit}
            disabled={!draft.trim() || pending}
          >
            {pending ? "Posting…" : "Comment"}
          </button>
        </div>
      ) : (
        <p className="muted-block">Connect a signer to join the discussion.</p>
      )}

      <div className="comment-list">
        {tree.map((node) => (
          <Comment
            key={node.event.id}
            node={node}
            profiles={profiles}
            depth={0}
            onReply={onPost}
            loggedIn={loggedIn}
          />
        ))}
      </div>
    </section>
  );
}
