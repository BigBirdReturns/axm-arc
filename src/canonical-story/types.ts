import type { Arc, JsonValue } from "../engine/types.js";

export const CANONICAL_STORY_FORMAT = "axm-canonical-story/1" as const;
export const CANONICAL_STORY_EXTENSION_KEY = "axm.canonical-story@1" as const;
export const CANONICAL_STORY_TRANSITION_FORMAT = "axm-canonical-story-transition/1" as const;

export type CanonicalStoryPathPolicy = "canonical-fixed";
export type CanonicalStoryChoicePolicy = "none";
export type CanonicalStoryTextAuthority = "exact-source-required";
export type CanonicalStoryAssetAuthority = "external-manifest";
export type CanonicalStoryAssetAvailability = "manifested-external" | "embedded";
export type CanonicalStoryVisualStanding =
  | "accepted"
  | "q02-review-required"
  | "missing";
export type CanonicalStoryAuditAuthority = "derived-q01-q02";

export interface CanonicalStoryIdentity {
  id: string;
  title: string;
  version: string;
}

export interface CanonicalStorySourcePlaneIdentity {
  format: string;
  extensionKey: string;
}

export interface CanonicalStoryAuthority {
  pathPolicy: CanonicalStoryPathPolicy;
  choicePolicy: CanonicalStoryChoicePolicy;
  textAuthority: CanonicalStoryTextAuthority;
  assetAuthority: CanonicalStoryAssetAuthority;
}

export interface CanonicalStorySourceReceipt {
  id: string;
  path: string;
  bytes: number;
  sha256: string;
  role: string;
  available: boolean;
}

export interface CanonicalStoryManifestedAssetReference {
  /** Existing v1 assets omit this field; when present it is explicit. */
  status?: "manifested";
  id: string;
  path: string;
  bytes: number;
  sha256: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  availability: CanonicalStoryAssetAvailability;
  visualStanding: CanonicalStoryVisualStanding;
}

export interface CanonicalStorySourceRequiredAssetReference {
  status: "source-required";
  id: string;
  path: string;
  expectedBytes?: number;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  availability: "manifested-external";
  visualStanding: "missing";
  expectedSourceReceiptIds: string[];
  reason: string;
}

export type CanonicalStoryAssetReference =
  | CanonicalStoryManifestedAssetReference
  | CanonicalStorySourceRequiredAssetReference;

export interface CanonicalStoryCaption {
  id: string;
  order: number;
  text: string;
}

export interface CanonicalStoryUtterance {
  id: string;
  order: number;
  speakerId: string;
  label: string;
  text: string;
}

export interface CanonicalStorySoundEffect {
  id: string;
  order: number;
  text: string;
}

export type CanonicalStoryTextLayer =
  | {
      status: "resolved";
      sourceReceiptIds: string[];
      captions: CanonicalStoryCaption[];
      dialogue: CanonicalStoryUtterance[];
      soundEffects: CanonicalStorySoundEffect[];
      altText: string;
    }
  | {
      status: "source-required";
      expectedSourceReceiptIds: string[];
      reason: string;
    };

export interface CanonicalStoryAuditProjection {
  authority: CanonicalStoryAuditAuthority;
  location: string;
  actorIds: string[];
  summary: string;
  sourceReceiptIds: string[];
}

export interface CanonicalStoryPanel {
  id: string;
  ordinal: number;
  chapterId: string;
  previousPanelId: string | null;
  nextPanelId: string | null;
  asset: CanonicalStoryAssetReference;
  text: CanonicalStoryTextLayer;
  auditProjection?: CanonicalStoryAuditProjection;
}

export type CanonicalStoryPlatePanelMapping =
  | {
      status: "resolved";
      sourceReceiptIds: string[];
      panelIds: string[];
    }
  | {
      status: "source-required";
      expectedSourceReceiptIds: string[];
      reason: string;
    };

export interface CanonicalStoryPlate {
  id: string;
  ordinal: number;
  chapterId: string;
  asset: CanonicalStoryAssetReference;
  panelMapping: CanonicalStoryPlatePanelMapping;
}

export interface CanonicalStoryChapter {
  id: string;
  number: number;
  title: string;
  /** True when every canonical panel position in this chapter is represented. */
  complete: boolean;
  openingPanelId: string;
  terminalPanelId: string;
  /** Canonical predecessor outside this published extent, if one exists. */
  previousPanelId: string | null;
  /** Canonical successor outside this published extent, if one exists. */
  nextPanelId: string | null;
  panels: CanonicalStoryPanel[];
  plates: CanonicalStoryPlate[];
}

export interface CanonicalStoryEpisode {
  id: string;
  number: number;
  title: string;
  /** True only when every canonical chapter in the episode is represented. */
  complete: boolean;
  nextChapterId: string | null;
  chapters: CanonicalStoryChapter[];
}

export interface CanonicalStorySource {
  format: typeof CANONICAL_STORY_FORMAT;
  identity: CanonicalStoryIdentity;
  sourcePlane: CanonicalStorySourcePlaneIdentity;
  authority: CanonicalStoryAuthority;
  sourceReceipts: CanonicalStorySourceReceipt[];
  episodes: CanonicalStoryEpisode[];
}

export interface CanonicalStoryCoverage {
  episodes: number;
  chapters: number;
  panels: number;
  plates: number;
  resolvedTextPanels: number;
  unresolvedTextPanels: number;
  resolvedPlateMappings: number;
  unresolvedPlateMappings: number;
  choiceNodes: 0;
  productionReady: boolean;
  incompleteEpisodeIds: string[];
  continuationPanelIds: string[];
}

export interface CanonicalStoryCursor {
  storyId: string;
  episodeId: string;
  chapterId: string;
  panelId: string;
}

export interface CanonicalStoryTransitionReceipt {
  format: typeof CANONICAL_STORY_TRANSITION_FORMAT;
  storyId: string;
  episodeId: string;
  action: "open" | "next" | "previous";
  fromPanelId: string | null;
  toPanelId: string;
  chapterId: string;
  canonical: true;
  digest: string;
}

export type CanonicalStoryAdvanceResult =
  | {
      kind: "panel";
      cursor: CanonicalStoryCursor;
      receipt: CanonicalStoryTransitionReceipt;
    }
  | {
      kind: "extent-complete";
      cursor: CanonicalStoryCursor;
      continuationPanelId: string | null;
    };

export type CanonicalStoryExtension = CanonicalStorySource;

export interface CanonicalStoryCarrier {
  arc: Arc;
  story: CanonicalStorySource;
  extensions?: Record<string, JsonValue>;
}
