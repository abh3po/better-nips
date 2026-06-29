import { useCallback, useMemo, useState } from "react";
import type { Event, EventTemplate, Filter } from "nostr-tools";
import { useObserve } from "./useObserve";
import { dataLayer, signer } from "../nostr/bootstrap";
import { CLIENT_NAME, KIND_COMMENT, KIND_NIP } from "../nostr/constants";
import { toast } from "../lib/toast";

export interface CommentNode {
  event: Event;
  content: string;
  pubkey: string;
  createdAt: number;
  replies: CommentNode[];
}

interface NipRef {
  pubkey: string;
  address: string;
}

/** The id of the immediate parent comment, or null for a top-level comment. */
function parentCommentId(e: Event): string | null {
  // NIP-22: a lowercase `e` tag points at the immediate parent (another
  // comment). Top-level comments reference only the root via `A`/`a`.
  return e.tags.find((t) => t[0] === "e")?.[1] ?? null;
}

/**
 * NIP-22 threaded comments on a NIP. The NIP (an addressable kind-30817 event)
 * is the thread root, referenced by its `A`/`a` coordinate. Replies point at
 * their parent comment with a lowercase `e` tag. Observes both upper/lowercase
 * address filters and builds a reply tree; `post` publishes a new comment or
 * reply.
 */
export function useComments(nip: NipRef | null, onNeedsAuth?: () => void) {
  const filters: Filter[] | null = nip
    ? [
        { kinds: [KIND_COMMENT], "#A": [nip.address] },
        { kinds: [KIND_COMMENT], "#a": [nip.address] },
      ]
    : null;
  const { events } = useObserve(filters);
  const [pending, setPending] = useState(false);

  const comments = useMemo(() => {
    const seen = new Map<string, Event>();
    for (const e of events) if (!seen.has(e.id)) seen.set(e.id, e);
    return [...seen.values()].sort((a, b) => a.created_at - b.created_at);
  }, [events]);

  // Build the reply tree from parent pointers; orphaned replies (parent not
  // loaded) surface at the top level so nothing is silently dropped.
  const tree = useMemo<CommentNode[]>(() => {
    const nodes = new Map<string, CommentNode>();
    for (const e of comments) {
      nodes.set(e.id, {
        event: e,
        content: e.content,
        pubkey: e.pubkey,
        createdAt: e.created_at,
        replies: [],
      });
    }
    const roots: CommentNode[] = [];
    for (const node of nodes.values()) {
      const parent = parentCommentId(node.event);
      const parentNode = parent ? nodes.get(parent) : null;
      if (parentNode) parentNode.replies.push(node);
      else roots.push(node);
    }
    return roots;
  }, [comments]);

  const post = useCallback(
    async (content: string, parent?: { id: string; pubkey: string }) => {
      const body = content.trim();
      if (!nip || !body) return;
      if (!signer.getActiveSigner()) {
        toast.error("Re-authenticate to comment.");
        onNeedsAuth?.();
        return;
      }
      setPending(true);
      try {
        // Uppercase tags carry the thread root (the NIP); lowercase tags carry
        // the immediate parent (the NIP itself for a top-level comment, or the
        // comment being replied to).
        const tags: string[][] = [
          ["A", nip.address],
          ["K", String(KIND_NIP)],
          ["P", nip.pubkey],
        ];
        if (parent) {
          tags.push(
            ["e", parent.id],
            ["k", String(KIND_COMMENT)],
            ["p", parent.pubkey],
          );
        } else {
          tags.push(
            ["a", nip.address],
            ["k", String(KIND_NIP)],
            ["p", nip.pubkey],
          );
        }
        tags.push(["client", CLIENT_NAME]);
        const template: EventTemplate = {
          kind: KIND_COMMENT,
          created_at: Math.floor(Date.now() / 1000),
          content: body,
          tags,
        };
        const { result } = await dataLayer.publish(template);
        if (result.accepted > 0) {
          toast.success("Comment posted.");
        } else {
          toast.error("Comment signed but no relay accepted it.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Comment failed.");
      } finally {
        setPending(false);
      }
    },
    [nip, onNeedsAuth],
  );

  return { tree, count: comments.length, post, pending };
}
