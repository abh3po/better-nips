/// <reference lib="webworker" />
import type { Event } from "nostr-tools";
import { computeWebOfTrust, type WotResult } from "./wot";

export interface WotRequest {
  /** Correlates a response with its request (the latest one wins). */
  id: number;
  follows: string[];
  /** Raw kind-3 contact lists of the user's follows (2nd-degree seeds). */
  secondDegree: Event[];
}

export interface WotResponse extends WotResult {
  id: number;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WotRequest>) => {
  const { id, follows, secondDegree } = e.data;
  const result = computeWebOfTrust(follows, secondDegree);
  const response: WotResponse = { id, ...result };
  ctx.postMessage(response);
};
