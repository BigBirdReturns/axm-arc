import { sha256Hex } from "../engine/cartridge-digest.js";
import { orderRecordKeysDeep } from "../engine/determinism.js";
import { parseCanonicalStory } from "./schema.js";

/**
 * Derive the lowercase SHA-256 bound by axm-canonical-story-timed-media/1.
 *
 * The digest covers the validated canonical-story object only. It excludes the
 * surrounding Arc and every sibling extension, so adding a timed-media record
 * cannot change the value that record is required to name. Deep key order is
 * normalized while authored array order remains content.
 */
export function canonicalStoryDigest(input: unknown): string {
  const story = parseCanonicalStory(input);
  return sha256Hex(JSON.stringify(orderRecordKeysDeep(story)));
}
