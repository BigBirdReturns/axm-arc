import sourceDocument from "./chapter-1.source.json";
import { parseBurnProtocol } from "./schema.js";

export const BURN_PROTOCOL_CHAPTER_1_SOURCE = parseBurnProtocol(sourceDocument);
