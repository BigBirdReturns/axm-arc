import type { JsonValue } from "../engine/types.js";
import type { CanonicalStorySource } from "../canonical-story/types.js";

export const BURN_PROTOCOL_SOURCE_FORMAT = "burn-protocol/1" as const;
export const BURN_PROTOCOL_EXTENSION_KEY = "burn.protocol@1" as const;

export type BurnProtocolProductionStanding =
  | "source-ledger-only"
  | "canonical-source-complete";

export interface BurnProtocolIdentity {
  id: string;
  title: string;
  description: string;
  author: string;
  version: string;
}

export interface BurnProtocolEstate {
  release: string;
  archiveReceiptId: string;
  /** Compatibility pointer to the first canonical episode source receipt. */
  canonicalSourceReceiptId: string;
  /** Complete ordered canonical episode-source custody for a multi-episode cartridge. */
  canonicalSourceReceiptIds?: string[];
  /** Compatibility pointer to the first compiled episode source receipt. */
  compiledSourceReceiptId: string;
  /** Complete ordered compiled episode-source custody for a multi-episode cartridge. */
  compiledSourceReceiptIds?: string[];
  productionStanding: BurnProtocolProductionStanding;
  missingRequiredReceiptIds: string[];
  boundary: string;
}

export interface BurnProtocolSource {
  format: typeof BURN_PROTOCOL_SOURCE_FORMAT;
  identity: BurnProtocolIdentity;
  estate: BurnProtocolEstate;
  canonicalStory: CanonicalStorySource;
  notes?: JsonValue;
}

export type BurnProtocolExtension = BurnProtocolSource;
