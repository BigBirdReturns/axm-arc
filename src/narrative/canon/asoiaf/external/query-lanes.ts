import type {
  AsoiafExternalAuthorityClass,
  AsoiafExternalContinuityPolicy,
  AsoiafExternalQueryLane,
  AsoiafExternalResponsePolicy,
  AsoiafExternalRole,
} from "./types.js";
import { ASOIAF_EXTERNAL_QUERY_LANE_FORMAT } from "./types.js";

function lane(input: {
  id: AsoiafExternalRole;
  label: string;
  aliases: string[];
  preferred: AsoiafExternalAuthorityClass[];
  supporting: AsoiafExternalAuthorityClass[];
  preferredSourceIds?: string[];
  continuityPolicy?: AsoiafExternalContinuityPolicy;
  responsePolicy?: Partial<AsoiafExternalResponsePolicy>;
}): AsoiafExternalQueryLane {
  return {
    format: ASOIAF_EXTERNAL_QUERY_LANE_FORMAT,
    id: input.id,
    label: input.label,
    aliases: input.aliases,
    preferredAuthorityClasses: input.preferred,
    supportingAuthorityClasses: input.supporting,
    preferredSourceIds: input.preferredSourceIds ?? [],
    requiredRoles: [input.id],
    continuityPolicy: input.continuityPolicy ?? "separate-continuities",
    responsePolicy: {
      verbatimHandling: input.id === "exact-quotation"
        ? "exact-local-locator"
        : "locate-only-no-mirror",
      attributionRequired: true,
      communityStanding: input.preferred.includes("community-reference")
        || input.preferred.includes("community-analysis")
        ? "supporting-only"
        : input.preferred.includes("discussion-provenance")
          ? "provenance-only"
          : "not-applicable",
      analogueStanding: input.preferred.includes("scholarly-analogue")
        ? "constraint-only"
        : "not-applicable",
      ...input.responsePolicy,
    },
  };
}

const PRIMARY = ["primary-text", "companion-text", "released-author-text"] as AsoiafExternalAuthorityClass[];
const OFFICIAL = ["author-statement", "adaptation-canon", "production-testimony"] as AsoiafExternalAuthorityClass[];
const REFERENCE = ["licensed-reference", "official-bibliography", "structured-dataset", "community-reference"] as AsoiafExternalAuthorityClass[];
const COMMUNITY = ["community-reference", "community-analysis", "discussion-provenance"] as AsoiafExternalAuthorityClass[];
const ANALOGUE = ["scholarly-analogue", "archival-custody"] as AsoiafExternalAuthorityClass[];

export const ASOIAF_EXTERNAL_QUERY_LANES: AsoiafExternalQueryLane[] = [
  lane({
    id: "exact-quotation",
    label: "Exact quotation and locator",
    aliases: ["quote", "exact words", "passage", "what does the text say", "line"],
    preferred: PRIMARY,
    supporting: ["adaptation-canon", "structured-dataset"],
    preferredSourceIds: ["local-agot", "local-acok", "local-asos", "local-affc", "local-adwd", "local-twow-samples", "local-got-subtitles", "local-hotd-subtitles"],
    continuityPolicy: "same-continuity-required",
    responsePolicy: {
      verbatimHandling: "exact-local-locator",
      communityStanding: "not-applicable",
    },
  }),
  lane({ id: "entity-resolution", label: "Entity resolution", aliases: ["who is", "what is", "identity", "alias", "same person"], preferred: ["primary-text", "companion-text", "community-reference"], supporting: REFERENCE, preferredSourceIds: ["local-twoiaf", "structured-awoiaf-api", "community-awoiaf"] }),
  lane({ id: "genealogy-parentage", label: "Genealogy and parentage", aliases: ["parent", "mother", "father", "child", "family tree", "descended"], preferred: ["primary-text", "companion-text"], supporting: ["structured-dataset", "community-reference"], preferredSourceIds: ["local-fire-blood", "local-twoiaf", "hbo-got-viewers-guide", "structured-awoiaf-api"] }),
  lane({ id: "succession-legitimacy", label: "Succession and legitimacy", aliases: ["heir", "succession", "legitimate", "claim", "rightful ruler"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["local-fire-blood", "local-twoiaf", "scholarly-fordham"] }),
  lane({ id: "chronology", label: "Chronology", aliases: ["when", "timeline", "before", "after", "date", "sequence"], preferred: ["primary-text", "companion-text", "adaptation-canon"], supporting: ["structured-dataset", "community-reference"], preferredSourceIds: ["structured-timeline-ice-fire", "structured-quartermaester", "hbo-got-episode-guide", "hbo-hotd-episode-guide"] }),
  lane({ id: "geography-travel", label: "Geography and travel", aliases: ["where", "map", "distance", "travel time", "route", "location"], preferred: ["primary-text", "companion-text", "licensed-reference"], supporting: ["structured-dataset", "community-analysis"], preferredSourceIds: ["local-lands-ice-fire", "structured-quartermaester", "structured-atlas-ice-fire"] }),
  lane({ id: "dragons", label: "Dragons", aliases: ["dragon", "dragonrider", "hatching", "bond", "fire breathing"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["local-fire-blood", "local-rise-dragon", "community-awoiaf"] }),
  lane({ id: "magic-world-physics", label: "Magic and world physics", aliases: ["magic", "physics", "mechanism", "weirwood", "skinchanging", "resurrection"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["local-adwd", "local-twoiaf", "community-in-deep-geek"] }),
  lane({ id: "religion-sacrifice", label: "Religion and sacrifice", aliases: ["religion", "sacrifice", "ritual", "god", "faith", "blood magic"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["local-acok", "local-adwd", "scholarly-sacred-texts", "community-lucifer-lightbringer"] }),
  lane({ id: "varys-rhllor", label: "Varys and R'hllor", aliases: ["varys", "r'hllor", "rhllor", "castration", "flame", "voice in the fire"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["local-acok", "local-adwd", "scholarly-sacred-texts", "community-lucifer-lightbringer"] }),
  lane({ id: "prophecy", label: "Prophecy", aliases: ["prophecy", "dream", "vision", "prince that was promised", "valonqar"], preferred: ["primary-text", "companion-text"], supporting: ["community-analysis", "scholarly-analogue"], preferredSourceIds: ["local-acok", "local-affc", "local-adwd"] }),
  lane({ id: "actor-knowledge", label: "Actor knowledge and belief", aliases: ["knows", "believes", "learns", "told", "heard", "secret"], preferred: ["primary-text", "adaptation-canon"], supporting: ["structured-dataset", "community-analysis"], preferredSourceIds: ["structured-search-ice-fire", "local-got-subtitles", "local-hotd-subtitles"] }),
  lane({ id: "military-logistics", label: "Military logistics", aliases: ["army", "supply", "siege", "fleet", "march", "battle logistics"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["structured-atlas-ice-fire", "community-bryndenbfish", "community-wars-politics"] }),
  lane({ id: "economics-smallfolk", label: "Economics and smallfolk", aliases: ["smallfolk", "tax", "price", "trade", "labor", "economy"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["community-race-iron-throne", "scholarly-british-history"] }),
  lane({ id: "law-governance", label: "Law and governance", aliases: ["law", "court", "office", "governance", "trial", "feudal"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["community-learned-hands", "scholarly-fordham", "scholarly-stanford"] }),
  lane({ id: "dance-of-dragons", label: "Dance of the Dragons", aliases: ["dance", "greens", "blacks", "dragonseed", "tumbleton", "harrenhal"], preferred: ["companion-text", "primary-text"], supporting: ["adaptation-canon", "community-analysis"], preferredSourceIds: ["local-fire-blood", "local-rise-dragon", "hbo-hotd-series"] }),
  lane({ id: "blackfyres", label: "Blackfyres", aliases: ["blackfyre", "daemon blackfyre", "bittersteel", "golden company", "young griff"], preferred: ["primary-text", "companion-text"], supporting: ["community-analysis", "author-statement"], preferredSourceIds: ["local-dunk-egg", "local-adwd", "grrm-dunk-and-egg"] }),
  lane({ id: "others-long-night", label: "Others and the Long Night", aliases: ["others", "white walkers", "long night", "night king", "winter"], preferred: ["primary-text", "companion-text"], supporting: ["adaptation-canon", "scholarly-analogue", "community-analysis"], preferredSourceIds: ["local-agot", "local-adwd", "scholarly-noaa", "community-quinns-ideas"] }),
  lane({ id: "language", label: "Languages and naming", aliases: ["language", "dothraki", "valyrian", "translation", "name meaning"], preferred: ["primary-text", "companion-text", "production-testimony"], supporting: ["community-reference", "structured-dataset"], preferredSourceIds: ["local-twoiaf", "community-awoiaf"] }),
  lane({ id: "author-intent", label: "Author intent", aliases: ["martin said", "grrm said", "author intent", "planned", "intended"], preferred: ["author-statement"], supporting: ["archival-custody", "official-bibliography"], preferredSourceIds: ["grrm-not-a-blog", "grrm-not-a-blog-rss", "grrm-interviews", "grrm-cushing-collection"], continuityPolicy: "cross-continuity-explicit" }),
  lane({ id: "production-intent", label: "Production intent", aliases: ["showrunner", "director", "writer said", "production intent", "behind the scenes"], preferred: ["production-testimony"], supporting: ["adaptation-canon", "archival-custody"], preferredSourceIds: ["hbo-got-inside", "hbo-hotd-podcast", "hbo-hotd-inside", "hbo-pressroom"], continuityPolicy: "same-continuity-required" }),
  lane({ id: "adaptation-deltas", label: "Adaptation deltas", aliases: ["show vs book", "changed", "adaptation", "cut character", "merged storyline"], preferred: ["primary-text", "adaptation-canon"], supporting: ["production-testimony", "community-analysis"], preferredSourceIds: ["local-got-subtitles", "local-hotd-subtitles", "hbo-got-series", "hbo-hotd-series"] }),
  lane({ id: "episode-dialogue", label: "Episode dialogue", aliases: ["episode line", "dialogue", "subtitle", "script", "said in episode"], preferred: ["adaptation-canon"], supporting: ["production-testimony", "structured-dataset"], preferredSourceIds: ["local-got-subtitles", "local-hotd-subtitles"], continuityPolicy: "same-continuity-required", responsePolicy: { verbatimHandling: "exact-local-locator" } }),
  lane({ id: "historical-analogue", label: "Historical analogues", aliases: ["historical analogue", "war of the roses", "medieval", "roman", "byzantine"], preferred: ["scholarly-analogue"], supporting: ["community-analysis", "archival-custody"], preferredSourceIds: ["scholarly-perseus", "scholarly-fordham", "scholarly-british-history"], continuityPolicy: "analogue-only" }),
  lane({ id: "religious-analogue", label: "Religious analogues", aliases: ["religious analogue", "myth", "ritual analogue", "cybele", "zoroastrian"], preferred: ["scholarly-analogue"], supporting: ["community-analysis", "primary-text"], preferredSourceIds: ["scholarly-sacred-texts", "scholarly-iranica", "community-lucifer-lightbringer"], continuityPolicy: "analogue-only" }),
  lane({ id: "scientific-analogue", label: "Scientific analogues", aliases: ["scientific analogue", "climate", "biology", "physics", "ecology"], preferred: ["scholarly-analogue", "structured-dataset"], supporting: ["community-analysis"], preferredSourceIds: ["scholarly-fao", "scholarly-noaa", "scholarly-google-scholar"], continuityPolicy: "analogue-only" }),
  lane({ id: "community-consensus", label: "Community consensus", aliases: ["fandom thinks", "consensus", "common interpretation", "widely believed"], preferred: ["community-reference", "community-analysis", "discussion-provenance"], supporting: ["structured-dataset"], preferredSourceIds: ["community-awoiaf", "discussion-reddit-asoiaf", "discussion-westeros-forums"], continuityPolicy: "cross-continuity-explicit" }),
  lane({ id: "theory-provenance", label: "Theory provenance", aliases: ["who proposed", "origin of theory", "first posted", "theory history"], preferred: ["discussion-provenance", "community-analysis"], supporting: ["archival-custody"], preferredSourceIds: ["discussion-westeros-forums", "discussion-reddit-asoiaf", "archive-wayback"], continuityPolicy: "cross-continuity-explicit" }),
  lane({ id: "chapter-analysis", label: "Chapter analysis", aliases: ["chapter", "pov", "close reading", "chapter summary", "scene analysis"], preferred: ["primary-text"], supporting: ["community-analysis", "structured-dataset"], preferredSourceIds: ["structured-tower-chapters", "community-notacast", "community-race-iron-throne"] }),
  lane({ id: "publication-history", label: "Publication history", aliases: ["published", "release date", "edition history", "manuscript", "publication"], preferred: ["official-bibliography", "licensed-reference", "archival-custody"], supporting: ["structured-dataset", "author-statement"], preferredSourceIds: ["grrm-bibliography", "publisher-bantam-series", "archive-isfdb", "archive-worldcat"] }),
  lane({ id: "edition-resolution", label: "Edition resolution", aliases: ["isbn", "edition", "page number", "hardcover", "paperback", "translation"], preferred: ["licensed-reference", "official-bibliography", "archival-custody"], supporting: ["structured-dataset"], preferredSourceIds: ["publisher-isbn-editions", "structured-openlibrary-api", "archive-worldcat"] }),
  lane({ id: "maps", label: "Maps", aliases: ["map", "border", "location", "route map", "political map"], preferred: ["licensed-reference", "companion-text", "structured-dataset"], supporting: ["community-analysis"], preferredSourceIds: ["local-lands-ice-fire", "structured-quartermaester", "structured-atlas-ice-fire"] }),
  lane({ id: "networks", label: "Social and institutional networks", aliases: ["network", "allies", "relationships", "connections", "faction"], preferred: ["primary-text", "structured-dataset"], supporting: ["community-reference", "community-analysis"], preferredSourceIds: ["structured-awoiaf-category-api", "structured-westeros-map", "structured-github-datasets"] }),
  lane({ id: "fandom-history", label: "Fandom history", aliases: ["fandom history", "old forum", "archive", "community history", "reaction"], preferred: ["discussion-provenance", "archival-custody"], supporting: ["community-analysis"], preferredSourceIds: ["archive-wayback", "archive-fanlore", "discussion-westeros-forums"] }),
  lane({ id: "endgame-closure", label: "Endgame closure", aliases: ["ending", "endgame", "final ruler", "how it ends", "closure"], preferred: ["primary-text", "released-author-text", "author-statement"], supporting: ["adaptation-canon", "community-analysis"], preferredSourceIds: ["local-adwd", "local-twow-samples", "grrm-not-a-blog", "hbo-got-s08e06"] }),
  lane({ id: "hotd-endpoints", label: "House of the Dragon endpoints", aliases: ["hotd ending", "dance endpoint", "who survives", "hour of the wolf", "aegon iii"], preferred: ["companion-text", "adaptation-canon"], supporting: ["production-testimony", "community-analysis"], preferredSourceIds: ["local-fire-blood", "local-rise-dragon", "local-hotd-subtitles", "hbo-hotd-series"] }),
  lane({ id: "heraldry", label: "Heraldry", aliases: ["sigil", "banner", "coat of arms", "house words", "heraldry"], preferred: ["companion-text", "licensed-reference"], supporting: ["community-reference", "structured-dataset"], preferredSourceIds: ["local-twoiaf", "local-lands-ice-fire", "structured-westeros-map"] }),
  lane({ id: "food-agriculture", label: "Food and agriculture", aliases: ["food", "harvest", "crop", "agriculture", "winter stores"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["scholarly-fao", "community-race-iron-throne"] }),
  lane({ id: "medicine-disease", label: "Medicine and disease", aliases: ["disease", "medicine", "wound", "plague", "greyscale", "healing"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["local-adwd", "community-awoiaf"] }),
  lane({ id: "gender-kinship", label: "Gender and kinship", aliases: ["gender", "marriage", "kinship", "inheritance by women", "patriarchy"], preferred: ["primary-text", "companion-text"], supporting: ["scholarly-analogue", "community-analysis"], preferredSourceIds: ["local-fire-blood", "community-girls-gone-canon", "scholarly-fordham"] }),
  lane({ id: "death-status", label: "Death and survival status", aliases: ["dead", "alive", "survives", "fate", "death", "missing"], preferred: ["primary-text", "companion-text", "adaptation-canon"], supporting: ["community-reference", "structured-dataset"], preferredSourceIds: ["community-awoiaf", "structured-search-ice-fire"] }),
  lane({ id: "literary-influences", label: "Literary influences", aliases: ["influence", "inspired by", "tolkien", "literary source", "allusion"], preferred: ["author-statement", "scholarly-analogue"], supporting: ["community-analysis", "archival-custody"], preferredSourceIds: ["grrm-interviews", "scholarly-jstor", "archive-isfdb"] }),
  lane({ id: "dataset-validation", label: "Dataset validation", aliases: ["validate dataset", "schema", "duplicate", "data quality", "cross-check"], preferred: ["structured-dataset"], supporting: ["community-reference", "archival-custody"], preferredSourceIds: ["structured-awoiaf-api", "structured-wikidata", "structured-openlibrary-api"] }),
  lane({ id: "archive-recovery", label: "Archive recovery", aliases: ["archive", "deleted", "old page", "dead link", "recover", "wayback"], preferred: ["archival-custody"], supporting: ["structured-dataset", "discussion-provenance"], preferredSourceIds: ["archive-wayback", "structured-internet-archive-search", "grrm-cushing-finding-aid"] }),
  lane({ id: "international-reference", label: "International reference", aliases: ["translation", "international edition", "foreign title", "territory", "non-english"], preferred: ["licensed-reference", "official-bibliography", "archival-custody"], supporting: ["structured-dataset", "community-reference"], preferredSourceIds: ["publisher-harper-series", "archive-worldcat", "archive-british-library"] }),
];
