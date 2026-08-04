import type {
  AsoiafExternalAccessKind,
  AsoiafExternalAuthorityClass,
  AsoiafExternalContentClass,
  AsoiafExternalContinuity,
  AsoiafExternalHarvestMode,
  AsoiafExternalRightsMode,
  AsoiafExternalRole,
  AsoiafExternalSource,
  AsoiafExternalSourcePlane,
  AsoiafExternalVerificationStatus,
} from "./types.js";
import { ASOIAF_EXTERNAL_SOURCE_FORMAT } from "./types.js";

interface SourceSeed {
  id: string;
  label: string;
  canonicalUri: string;
  sourcePlane: AsoiafExternalSourcePlane;
  authorityClass: AsoiafExternalAuthorityClass;
  continuityIds: AsoiafExternalContinuity[];
  roles: AsoiafExternalRole[];
  contentClasses: AsoiafExternalContentClass[];
  accessKind: AsoiafExternalAccessKind;
  accessUri: string;
  machineReadable: boolean;
  credential?: "none" | "user-copy" | "session" | "api-key";
  accessNotes: string;
  harvestMode: AsoiafExternalHarvestMode;
  rightsMode: AsoiafExternalRightsMode;
  verificationStatus: AsoiafExternalVerificationStatus;
  sourceHintRoutes?: string[];
  strengths: string[];
  cautions: string[];
  coverageObservations?: string[];
  queryTemplates?: string[];
  refreshDays?: number | null;
  maxRequestsPerRun?: number;
  maxResponseBytes?: number;
  retainRawBody?: boolean;
  excerptMaxChars?: number;
}

function source(seed: SourceSeed): AsoiafExternalSource {
  const local = seed.accessKind === "local-file";
  return {
    format: ASOIAF_EXTERNAL_SOURCE_FORMAT,
    id: seed.id,
    label: seed.label,
    canonicalUri: seed.canonicalUri,
    sourcePlane: seed.sourcePlane,
    authorityClass: seed.authorityClass,
    continuityIds: seed.continuityIds,
    roles: seed.roles,
    contentClasses: seed.contentClasses,
    accessMethods: [
      {
        kind: seed.accessKind,
        uri: seed.accessUri,
        machineReadable: seed.machineReadable,
        credential: seed.credential ?? (local ? "user-copy" : "none"),
        notes: seed.accessNotes,
      },
    ],
    harvestPolicy: {
      mode: seed.harvestMode,
      robotsRespect: true,
      hostDelayMs: local ? 0 : 1_500,
      maxRequestsPerRun: seed.maxRequestsPerRun ?? (local ? 1 : 20),
      maxResponseBytes: seed.maxResponseBytes ?? 8_000_000,
      retryCount: local ? 0 : 4,
      refreshDays: seed.refreshDays ?? (local ? null : 30),
      retainRawBody: seed.retainRawBody ?? false,
      excerptMaxChars: seed.excerptMaxChars ?? 0,
      requiresHumanReview: true,
    },
    rightsMode: seed.rightsMode,
    verificationStatus: seed.verificationStatus,
    strengths: seed.strengths,
    cautions: seed.cautions,
    coverageObservations: seed.coverageObservations ?? [],
    sourceHintRoutes: seed.sourceHintRoutes ?? [],
    queryTemplates: seed.queryTemplates ?? ["{question}"],
  };
}

const LOCAL_SOURCES: AsoiafExternalSource[] = [
  ["agot", "A Game of Thrones", "primary-text", "book-main", "AGOT"],
  ["acok", "A Clash of Kings", "primary-text", "book-main", "ACOK"],
  ["asos", "A Storm of Swords", "primary-text", "book-main", "ASOS"],
  ["affc", "A Feast for Crows", "primary-text", "book-main", "AFFC"],
  ["adwd", "A Dance with Dragons", "primary-text", "book-main", "ADWD"],
  ["dunk-egg", "Dunk and Egg collection", "companion-text", "book-companion", "D&E"],
  ["fire-blood", "Fire & Blood", "companion-text", "book-companion", "F&B"],
  ["twoiaf", "The World of Ice & Fire", "companion-text", "book-companion", "TWOIAF"],
  ["rise-dragon", "The Rise of the Dragon", "companion-text", "book-companion", "F&B"],
  ["lands-ice-fire", "The Lands of Ice and Fire", "licensed-reference", "book-companion", "TWOIAF"],
].map(([id, label, authorityClass, continuityId, hint]) =>
  source({
    id: `local-${id}`,
    label: `User-held exact edition: ${label}`,
    canonicalUri: `local://asoiaf/${id}`,
    sourcePlane: "local-primary",
    authorityClass: authorityClass as AsoiafExternalAuthorityClass,
    continuityIds: [continuityId as AsoiafExternalContinuity],
    roles: [
      "exact-quotation",
      "entity-resolution",
      "chapter-analysis",
      "edition-resolution",
    ],
    contentClasses: ["book-text"],
    accessKind: "local-file",
    accessUri: `local://asoiaf/${id}`,
    machineReadable: true,
    accessNotes: "Holder-controlled bytes; stream-hash before locator generation.",
    harvestMode: "local-private-only",
    rightsMode: "user-controlled-private",
    verificationStatus: "manual-only",
    sourceHintRoutes: [hint],
    strengths: ["Exact edition custody", "Exact quotation and locator authority"],
    cautions: ["Payload and local path must never enter public Git"],
    queryTemplates: ["{entity}", "{quotation}", "{chapter}"],
  }),
);

LOCAL_SOURCES.push(
  source({
    id: "local-twow-samples",
    label: "User-held released The Winds of Winter sample packet",
    canonicalUri: "local://asoiaf/twow-samples",
    sourcePlane: "local-primary",
    authorityClass: "released-author-text",
    continuityIds: ["released-future-book"],
    roles: ["exact-quotation", "author-intent", "publication-history", "endgame-closure"],
    contentClasses: ["sample-text"],
    accessKind: "local-file",
    accessUri: "local://asoiaf/twow-samples",
    machineReadable: true,
    accessNotes: "Exact released sample bytes held outside public Git.",
    harvestMode: "local-private-only",
    rightsMode: "user-controlled-private",
    verificationStatus: "manual-only",
    sourceHintRoutes: ["TWOW-SAMPLE"],
    strengths: ["Released future-book wording", "Exact sample custody"],
    cautions: ["Release venue and revision must remain explicit"],
  }),
  source({
    id: "local-got-subtitles",
    label: "User-held Game of Thrones subtitle and script locator pack",
    canonicalUri: "local://asoiaf/hbo-got-subtitles",
    sourcePlane: "local-primary",
    authorityClass: "adaptation-canon",
    continuityIds: ["hbo-got"],
    roles: ["exact-quotation", "episode-dialogue", "adaptation-deltas", "actor-knowledge"],
    contentClasses: ["subtitle", "script"],
    accessKind: "local-file",
    accessUri: "local://asoiaf/hbo-got-subtitles",
    machineReadable: true,
    accessNotes: "Holder-controlled subtitle or script files; retain digests and locators only.",
    harvestMode: "local-private-only",
    rightsMode: "user-controlled-private",
    verificationStatus: "manual-only",
    sourceHintRoutes: ["HBO-GOT"],
    strengths: ["Exact episode dialogue locator"],
    cautions: ["Do not mirror transcript text"],
  }),
  source({
    id: "local-hotd-subtitles",
    label: "User-held House of the Dragon subtitle and script locator pack",
    canonicalUri: "local://asoiaf/hbo-hotd-subtitles",
    sourcePlane: "local-primary",
    authorityClass: "adaptation-canon",
    continuityIds: ["hbo-hotd"],
    roles: ["exact-quotation", "episode-dialogue", "adaptation-deltas", "hotd-endpoints"],
    contentClasses: ["subtitle", "script"],
    accessKind: "local-file",
    accessUri: "local://asoiaf/hbo-hotd-subtitles",
    machineReadable: true,
    accessNotes: "Holder-controlled subtitle or script files; retain digests and locators only.",
    harvestMode: "local-private-only",
    rightsMode: "user-controlled-private",
    verificationStatus: "manual-only",
    sourceHintRoutes: ["HBO-HOTD"],
    strengths: ["Exact episode dialogue locator"],
    cautions: ["Do not mirror transcript text"],
  }),
);

const GRRM_SEEDS: Array<[
  string,
  string,
  string,
  AsoiafExternalAccessKind,
  AsoiafExternalRole[],
  AsoiafExternalContentClass[],
  string[],
]> = [
  ["home", "George R. R. Martin official site", "https://georgerrmartin.com/", "html", ["author-intent", "publication-history", "literary-influences"], ["statement"], ["GRRM-STATEMENT"]],
  ["not-a-blog", "Not a Blog", "https://georgerrmartin.com/notablog/", "html", ["author-intent", "publication-history", "endgame-closure"], ["statement"], ["GRRM-STATEMENT"]],
  ["not-a-blog-rss", "Not a Blog RSS feed", "https://georgerrmartin.com/notablog/feed/", "rss", ["author-intent", "publication-history", "archive-recovery"], ["statement", "search-index"], ["GRRM-STATEMENT"]],
  ["bibliography", "GRRM official bibliography", "https://georgerrmartin.com/bibliography/", "html", ["publication-history", "edition-resolution", "international-reference"], ["bibliographic-record"], ["GRRM-STATEMENT"]],
  ["books", "GRRM official books index", "https://georgerrmartin.com/grrm/book/", "html", ["publication-history", "edition-resolution", "literary-influences"], ["bibliographic-record"], ["GRRM-STATEMENT"]],
  ["samples", "GRRM official samples index", "https://georgerrmartin.com/excerpt/", "html", ["exact-quotation", "publication-history", "endgame-closure"], ["sample-text"], ["TWOW-SAMPLE", "GRRM-STATEMENT"]],
  ["twow-samples", "GRRM released Winds of Winter samples", "https://georgerrmartin.com/excerpt/from-the-winds-of-winter/", "html", ["exact-quotation", "author-intent", "endgame-closure"], ["sample-text"], ["TWOW-SAMPLE"]],
  ["asoiaf-category", "GRRM A Song of Ice and Fire category", "https://georgerrmartin.com/grrm/book-category/a-song-of-ice-and-fire/", "html", ["publication-history", "author-intent", "edition-resolution"], ["bibliographic-record"], ["GRRM-STATEMENT"]],
  ["fire-and-blood", "GRRM Fire & Blood official page", "https://georgerrmartin.com/grrm/book/fire-and-blood/", "html", ["dance-of-dragons", "publication-history", "author-intent"], ["bibliographic-record"], ["F&B", "GRRM-STATEMENT"]],
  ["dunk-and-egg", "GRRM Dunk and Egg official route", "https://georgerrmartin.com/grrm/book/a-knight-of-the-seven-kingdoms/", "html", ["blackfyres", "publication-history", "author-intent"], ["bibliographic-record"], ["D&E", "GRRM-STATEMENT"]],
  ["world-of-ice-and-fire", "GRRM World of Ice & Fire official route", "https://georgerrmartin.com/grrm/book/the-world-of-ice-and-fire/", "html", ["entity-resolution", "heraldry", "publication-history"], ["bibliographic-record"], ["TWOIAF", "GRRM-STATEMENT"]],
  ["rise-of-dragon", "GRRM Rise of the Dragon official route", "https://georgerrmartin.com/grrm/book/the-rise-of-the-dragon/", "html", ["dance-of-dragons", "publication-history", "hotd-endpoints"], ["bibliographic-record"], ["F&B", "GRRM-STATEMENT"]],
  ["interviews", "GRRM official interview route", "https://georgerrmartin.com/about-george/", "html", ["author-intent", "literary-influences", "endgame-closure"], ["interview"], ["GRRM-STATEMENT"]],
  ["events", "GRRM official events route", "https://georgerrmartin.com/appearances/", "html", ["author-intent", "publication-history", "fandom-history"], ["statement"], ["GRRM-STATEMENT"]],
  ["statements", "GRRM public statement locator family", "https://georgerrmartin.com/?s=a+song+of+ice+and+fire", "search-ui", ["author-intent", "publication-history", "endgame-closure"], ["search-index"], ["GRRM-STATEMENT"]],
  ["livejournal-archive", "GRRM LiveJournal archive route", "https://grrm.livejournal.com/", "html", ["author-intent", "fandom-history", "archive-recovery"], ["statement"], ["GRRM-STATEMENT"]],
  ["cushing-collection", "Texas A&M Cushing GRRM collection", "https://cushing.library.tamu.edu/collections/george-r-r-martin.html", "html", ["archive-recovery", "publication-history", "author-intent"], ["finding-aid"], ["GRRM-STATEMENT"]],
  ["cushing-finding-aid", "Texas A&M Cushing GRRM finding-aid route", "https://archon.library.tamu.edu/?p=collections/controlcard&id=86", "html", ["archive-recovery", "publication-history", "literary-influences"], ["finding-aid"], ["GRRM-STATEMENT"]],
];

const GRRM_SOURCES = GRRM_SEEDS.map(
  ([id, label, uri, accessKind, roles, contentClasses, hints]) =>
    source({
      id: `grrm-${id}`,
      label,
      canonicalUri: uri,
      sourcePlane: id.startsWith("cushing") ? "archive" : "official-author",
      authorityClass: id.startsWith("cushing")
        ? "archival-custody"
        : id === "bibliography" || id === "books"
          ? "official-bibliography"
          : id.includes("samples")
            ? "released-author-text"
            : "author-statement",
      continuityIds: id.includes("samples")
        ? ["released-future-book"]
        : id.startsWith("cushing")
          ? ["cross-continuity"]
          : ["author-statement"],
      roles,
      contentClasses,
      accessKind,
      accessUri: uri,
      machineReadable: accessKind === "rss",
      accessNotes: "Official or archival route; capture exact venue, date, and locator.",
      harvestMode: accessKind === "rss" ? "metadata-and-bounded-excerpt" : "metadata-only",
      rightsMode: "publisher-copyright",
      verificationStatus: id === "home" || id === "not-a-blog" || id === "not-a-blog-rss"
        ? "verified-route"
        : "unverified",
      sourceHintRoutes: hints,
      strengths: ["Author, official-site, or manuscript-custody provenance"],
      cautions: ["A statement does not automatically establish book mechanism"],
      excerptMaxChars: accessKind === "rss" ? 500 : 0,
      queryTemplates: ["{question}", "{entity}", "{date}"],
    }),
);

const GOT_EPISODES: string[][] = [
  ["Winter Is Coming", "The Kingsroad", "Lord Snow", "Cripples, Bastards, and Broken Things", "The Wolf and the Lion", "A Golden Crown", "You Win or You Die", "The Pointy End", "Baelor", "Fire and Blood"],
  ["The North Remembers", "The Night Lands", "What Is Dead May Never Die", "Garden of Bones", "The Ghost of Harrenhal", "The Old Gods and the New", "A Man Without Honor", "The Prince of Winterfell", "Blackwater", "Valar Morghulis"],
  ["Valar Dohaeris", "Dark Wings, Dark Words", "Walk of Punishment", "And Now His Watch Is Ended", "Kissed by Fire", "The Climb", "The Bear and the Maiden Fair", "Second Sons", "The Rains of Castamere", "Mhysa"],
  ["Two Swords", "The Lion and the Rose", "Breaker of Chains", "Oathkeeper", "First of His Name", "The Laws of Gods and Men", "Mockingbird", "The Mountain and the Viper", "The Watchers on the Wall", "The Children"],
  ["The Wars to Come", "The House of Black and White", "High Sparrow", "Sons of the Harpy", "Kill the Boy", "Unbowed, Unbent, Unbroken", "The Gift", "Hardhome", "The Dance of Dragons", "Mother's Mercy"],
  ["The Red Woman", "Home", "Oathbreaker", "Book of the Stranger", "The Door", "Blood of My Blood", "The Broken Man", "No One", "Battle of the Bastards", "The Winds of Winter"],
  ["Dragonstone", "Stormborn", "The Queen's Justice", "The Spoils of War", "Eastwatch", "Beyond the Wall", "The Dragon and the Wolf"],
  ["Winterfell", "A Knight of the Seven Kingdoms", "The Long Night", "The Last of the Starks", "The Bells", "The Iron Throne"],
];

const HOTD_EPISODES: string[][] = [
  ["The Heirs of the Dragon", "The Rogue Prince", "Second of His Name", "King of the Narrow Sea", "We Light the Way", "The Princess and the Queen", "Driftmark", "The Lord of the Tides", "The Green Council", "The Black Queen"],
  ["A Son for a Son", "Rhaenyra the Cruel", "The Burning Mill", "The Red Dragon and the Gold", "Regent", "Smallfolk", "The Red Sowing", "The Queen Who Ever Was"],
];

function episodeSources(
  prefix: "got" | "hotd",
  seriesLabel: string,
  rootUri: string,
  seasons: string[][],
): AsoiafExternalSource[] {
  const hotd = prefix === "hotd";
  return seasons.flatMap((episodes, seasonIndex) =>
    episodes.map((title, episodeIndex) => {
      const season = String(seasonIndex + 1).padStart(2, "0");
      const episode = String(episodeIndex + 1).padStart(2, "0");
      const code = `s${season}e${episode}`;
      return source({
        id: `hbo-${prefix}-${code}`,
        label: `${seriesLabel} ${code.toUpperCase()}: ${title}`,
        canonicalUri: `urn:hbo:${prefix}:${code}`,
        sourcePlane: "official-adaptation",
        authorityClass: "adaptation-canon",
        continuityIds: [hotd ? "hbo-hotd" : "hbo-got"],
        roles: hotd
          ? ["episode-dialogue", "hotd-endpoints"]
          : ["episode-dialogue", "adaptation-deltas"],
        contentClasses: ["episode"],
        accessKind: "html",
        accessUri: rootUri,
        machineReadable: false,
        accessNotes: `Official series route for ${code.toUpperCase()}; resolve the current episode locator before collection.`,
        harvestMode: "metadata-only",
        rightsMode: "publisher-copyright",
        verificationStatus: "verified-route",
        sourceHintRoutes: [hotd ? "HBO-HOTD" : "HBO-GOT"],
        strengths: ["Adaptation-continuity event and performance evidence"],
        cautions: ["Episode continuity cannot overrule book continuity", "Do not mirror dialogue"],
        queryTemplates: [`${code} {entity}`, `${title} {question}`],
        refreshDays: 180,
      });
    }),
  );
}

const EPISODE_SOURCES = [
  ...episodeSources("got", "Game of Thrones", "https://www.hbo.com/game-of-thrones", GOT_EPISODES),
  ...episodeSources("hotd", "House of the Dragon", "https://www.hbo.com/house-of-the-dragon", HOTD_EPISODES),
];

const HBO_SEEDS: Array<[
  string,
  string,
  string,
  AsoiafExternalRole[],
  AsoiafExternalContentClass[],
  AsoiafExternalContinuity,
  string,
]> = [
  ["got-series", "HBO Game of Thrones official series page", "https://www.hbo.com/game-of-thrones", ["adaptation-deltas", "episode-dialogue", "production-intent"], ["production-feature"], "hbo-got", "HBO-GOT"],
  ["got-episode-guide", "HBO Game of Thrones episode guide", "https://www.hbo.com/game-of-thrones/episodes", ["chronology", "episode-dialogue", "adaptation-deltas"], ["reference-article"], "hbo-got", "HBO-GOT"],
  ["got-viewers-guide", "HBO Game of Thrones viewer's guide", "https://viewers-guide.hbo.com/game-of-thrones", ["entity-resolution", "maps", "genealogy-parentage"], ["reference-article", "map", "family-tree"], "hbo-got", "HBO-GOT"],
  ["got-inside", "HBO Game of Thrones Inside the Episode route", "https://www.hbo.com/game-of-thrones", ["production-intent", "adaptation-deltas", "actor-knowledge"], ["production-feature", "video"], "production-testimony", "PRODUCTION-TESTIMONY"],
  ["got-production", "HBO Game of Thrones production testimony route", "https://press.wbd.com/us/property/game-thrones", ["production-intent", "publication-history", "adaptation-deltas"], ["production-feature"], "production-testimony", "PRODUCTION-TESTIMONY"],
  ["hotd-series", "HBO House of the Dragon official series page", "https://www.hbo.com/house-of-the-dragon", ["hotd-endpoints", "episode-dialogue", "adaptation-deltas"], ["production-feature"], "hbo-hotd", "HBO-HOTD"],
  ["hotd-episode-guide", "HBO House of the Dragon episode guide", "https://www.hbo.com/house-of-the-dragon/episodes", ["chronology", "episode-dialogue", "hotd-endpoints"], ["reference-article"], "hbo-hotd", "HBO-HOTD"],
  ["hotd-podcast", "Official Game of Thrones Podcast: House of the Dragon", "https://www.hbo.com/house-of-the-dragon/podcast", ["production-intent", "adaptation-deltas", "hotd-endpoints"], ["podcast"], "production-testimony", "PRODUCTION-TESTIMONY"],
  ["hotd-inside", "HBO House of the Dragon Inside the Episode route", "https://www.hbo.com/house-of-the-dragon", ["production-intent", "adaptation-deltas", "actor-knowledge"], ["production-feature", "video"], "production-testimony", "PRODUCTION-TESTIMONY"],
  ["pressroom", "Warner Bros. Discovery ASOIAF pressroom", "https://press.wbd.com/", ["production-intent", "publication-history", "international-reference"], ["production-feature"], "production-testimony", "PRODUCTION-TESTIMONY"],
];

const HBO_SOURCES = HBO_SEEDS.map(
  ([id, label, uri, roles, contentClasses, continuity, hint]) =>
    source({
      id: `hbo-${id}`,
      label,
      canonicalUri: uri,
      sourcePlane: "official-adaptation",
      authorityClass: continuity === "production-testimony"
        ? "production-testimony"
        : "adaptation-canon",
      continuityIds: [continuity],
      roles,
      contentClasses,
      accessKind: id === "hotd-podcast" ? "podcast-feed" : "html",
      accessUri: uri,
      machineReadable: false,
      accessNotes: "Official adaptation or production route; retain exact episode, speaker, and timestamp.",
      harvestMode: "metadata-only",
      rightsMode: "publisher-copyright",
      verificationStatus: "verified-route",
      sourceHintRoutes: [hint],
      strengths: ["Official adaptation or production provenance"],
      cautions: ["Production testimony is separate from adaptation events and book canon"],
    }),
);

const PUBLISHER_SEEDS: Array<[string, string, string, string[]]> = [
  ["agot", "Penguin Random House edition route: A Game of Thrones", "urn:publisher:prh:agot", ["AGOT"]],
  ["acok", "Penguin Random House edition route: A Clash of Kings", "urn:publisher:prh:acok", ["ACOK"]],
  ["asos", "Penguin Random House edition route: A Storm of Swords", "urn:publisher:prh:asos", ["ASOS"]],
  ["affc", "Penguin Random House edition route: A Feast for Crows", "urn:publisher:prh:affc", ["AFFC"]],
  ["adwd", "Penguin Random House edition route: A Dance with Dragons", "urn:publisher:prh:adwd", ["ADWD"]],
  ["knight-seven", "Publisher edition route: A Knight of the Seven Kingdoms", "urn:publisher:prh:knight-seven-kingdoms", ["D&E"]],
  ["fire-blood", "Publisher edition route: Fire & Blood", "urn:publisher:prh:fire-and-blood", ["F&B"]],
  ["twoiaf", "Publisher edition route: The World of Ice & Fire", "urn:publisher:prh:twoiaf", ["TWOIAF"]],
  ["rise-dragon", "Publisher edition route: The Rise of the Dragon", "urn:publisher:prh:rise-of-the-dragon", ["F&B"]],
  ["lands", "Publisher edition route: The Lands of Ice and Fire", "urn:publisher:prh:lands-of-ice-and-fire", ["TWOIAF"]],
  ["bantam-series", "Bantam ASOIAF series catalog", "urn:publisher:bantam:asoiaf-series", []],
  ["harper-series", "HarperCollins international ASOIAF catalog", "urn:publisher:harpercollins:asoiaf-series", []],
  ["audiobooks", "Official audiobook edition catalog", "urn:publisher:asoiaf:audiobooks", []],
  ["isbn-editions", "Publisher ISBN and edition resolution route", "urn:publisher:asoiaf:isbn-editions", []],
  ["licensed-maps", "Licensed calendar, map, and illustrated-edition catalog", "urn:publisher:asoiaf:licensed-maps", ["TWOIAF"]],
];

const PUBLISHER_SOURCES = PUBLISHER_SEEDS.map(([id, label, canonicalUri, hints]) =>
  source({
    id: `publisher-${id}`,
    label,
    canonicalUri,
    sourcePlane: "publisher-reference",
    authorityClass: "licensed-reference",
    continuityIds: ["cross-continuity"],
    roles: ["edition-resolution", "publication-history"],
    contentClasses: ["bibliographic-record"],
    accessKind: "search-ui",
    accessUri: "https://www.penguinrandomhouse.com/search/a-song-of-ice-and-fire/",
    machineReadable: false,
    accessNotes: "Resolve the exact publisher, territory, ISBN, format, and edition route.",
    harvestMode: "metadata-only",
    rightsMode: "publisher-copyright",
    verificationStatus: "unverified",
    sourceHintRoutes: hints,
    strengths: ["Edition, publication, and licensed-reference metadata"],
    cautions: ["Publisher summary text is not a substitute for the exact edition"],
  }),
);

const STRUCTURED_SEEDS: Array<[
  string,
  string,
  string,
  AsoiafExternalAccessKind,
  AsoiafExternalRole[],
  AsoiafExternalRightsMode,
]> = [
  ["awoiaf-api", "A Wiki of Ice and Fire MediaWiki API", "https://awoiaf.westeros.org/api.php", "mediawiki-api", ["entity-resolution", "genealogy-parentage", "dataset-validation"], "cc-by-sa"],
  ["awoiaf-category-api", "A Wiki of Ice and Fire category traversal", "urn:awoiaf:api:categories", "mediawiki-api", ["entity-resolution", "networks", "dataset-validation"], "cc-by-sa"],
  ["awoiaf-search-api", "A Wiki of Ice and Fire search API", "urn:awoiaf:api:search", "mediawiki-api", ["exact-quotation", "entity-resolution", "chapter-analysis"], "cc-by-sa"],
  ["awoiaf-dumps", "A Wiki of Ice and Fire database dump route", "urn:awoiaf:database-dumps", "dataset-download", ["dataset-validation", "networks", "archive-recovery"], "cc-by-sa"],
  ["search-ice-fire", "A Search of Ice and Fire", "https://asearchoficeandfire.com/", "search-ui", ["exact-quotation", "chapter-analysis", "actor-knowledge"], "link-only"],
  ["timeline-ice-fire", "A Timeline of Ice and Fire", "https://atimelineoficeandfire.github.io/", "html", ["chronology", "actor-knowledge", "dataset-validation"], "unknown-review-required"],
  ["quartermaester", "Quartermaester map", "https://quartermaester.info/", "html", ["maps", "geography-travel", "chronology"], "unknown-review-required"],
  ["tower-chapters", "Tower of the Hand chapter index", "https://towerofthehand.com/books/", "html", ["chapter-analysis", "chronology", "entity-resolution"], "publisher-copyright"],
  ["tower-characters", "Tower of the Hand character index", "https://towerofthehand.com/reference/k/", "html", ["entity-resolution", "actor-knowledge", "networks"], "publisher-copyright"],
  ["atlas-ice-fire", "Atlas of Ice and Fire map index", "https://atlasoficeandfireblog.wordpress.com/", "html", ["maps", "geography-travel", "military-logistics"], "publisher-copyright"],
  ["westeros-map", "Westeros.org map and heraldry routes", "https://www.westeros.org/Citadel/", "html", ["maps", "heraldry", "genealogy-parentage"], "publisher-copyright"],
  ["wikidata", "Wikidata SPARQL endpoint", "https://query.wikidata.org/sparql", "rest-api", ["entity-resolution", "publication-history", "dataset-validation"], "cc0"],
  ["openlibrary-api", "Open Library API", "https://openlibrary.org/developers/api", "rest-api", ["edition-resolution", "publication-history", "dataset-validation"], "cc0"],
  ["google-books-api", "Google Books API", "https://www.googleapis.com/books/v1/volumes", "rest-api", ["edition-resolution", "publication-history", "international-reference"], "unknown-review-required"],
  ["internet-archive-search", "Internet Archive advanced search API", "https://archive.org/advancedsearch.php", "archive-api", ["archive-recovery", "publication-history", "fandom-history"], "unknown-review-required"],
  ["loc-api", "Library of Congress API", "https://www.loc.gov/apis/", "rest-api", ["edition-resolution", "publication-history", "archive-recovery"], "public-domain"],
  ["crossref-api", "Crossref works API", "https://api.crossref.org/works", "rest-api", ["publication-history", "scholarly-analogue", "dataset-validation"], "cc0"],
  ["tmdb-api", "The Movie Database API", "https://developer.themoviedb.org/reference/intro/getting-started", "rest-api", ["episode-dialogue", "publication-history", "dataset-validation"], "unknown-review-required"],
  ["tvmaze-api", "TVmaze API", "https://www.tvmaze.com/api", "rest-api", ["chronology", "publication-history", "dataset-validation"], "unknown-review-required"],
  ["github-datasets", "GitHub ASOIAF structured-dataset discovery", "https://github.com/search?q=asoiaf+dataset&type=repositories", "search-ui", ["dataset-validation", "networks", "genealogy-parentage"], "unknown-review-required"],
];

const STRUCTURED_SOURCES = STRUCTURED_SEEDS.map(
  ([id, label, canonicalUri, accessKind, roles, rightsMode]) =>
    source({
      id: `structured-${id}`,
      label,
      canonicalUri,
      sourcePlane: "structured-tool",
      authorityClass: "structured-dataset",
      continuityIds: ["cross-continuity"],
      roles,
      contentClasses: accessKind === "dataset-download" ? ["dataset"] : ["search-index"],
      accessKind,
      accessUri: canonicalUri.startsWith("urn:")
        ? id.startsWith("awoiaf")
          ? "https://awoiaf.westeros.org/api.php"
          : canonicalUri
        : canonicalUri,
      machineReadable: accessKind !== "html" && accessKind !== "search-ui",
      accessNotes: "Structured or discovery surface; retain upstream identifiers and schema receipts.",
      harvestMode: rightsMode === "cc0" || rightsMode === "cc-by" || rightsMode === "cc-by-sa"
        ? "structured-cache-with-attribution"
        : accessKind === "search-ui"
          ? "route-only-no-mirror"
          : "metadata-only",
      rightsMode,
      verificationStatus: canonicalUri.startsWith("https://") ? "verified-route" : "unverified",
      strengths: ["Machine-assisted discovery, normalization, or validation"],
      cautions: ["Structured retrieval does not grant primary-source standing"],
      retainRawBody: rightsMode === "cc0" || rightsMode === "cc-by" || rightsMode === "cc-by-sa",
      excerptMaxChars: 0,
    }),
);

const COMMUNITY_SEEDS: Array<[string, string, string, AsoiafExternalRole[]]> = [
  ["awoiaf", "A Wiki of Ice and Fire", "https://awoiaf.westeros.org/", ["entity-resolution", "community-consensus"]],
  ["tower", "Tower of the Hand", "https://towerofthehand.com/", ["chapter-analysis", "community-consensus"]],
  ["westeros", "Westeros.org Citadel", "https://www.westeros.org/Citadel/", ["entity-resolution", "fandom-history"]],
  ["history-westeros", "History of Westeros", "https://historyofwesteros.com/", ["historical-analogue", "community-consensus"]],
  ["radio-westeros", "Radio Westeros", "https://radiowesteros.com/", ["chapter-analysis", "theory-provenance"]],
  ["notacast", "Not A Cast", "https://notacastasoiaf.podbean.com/", ["chapter-analysis", "theory-provenance"]],
  ["girls-gone-canon", "Girls Gone Canon", "https://girlsgonecanon.podbean.com/", ["chapter-analysis", "gender-kinship"]],
  ["learned-hands", "Learned Hands", "https://learnedhands.podbean.com/", ["law-governance", "community-consensus"]],
  ["race-iron-throne", "A Race for the Iron Throne", "https://racefortheironthrone.wordpress.com/", ["economics-smallfolk", "chapter-analysis"]],
  ["poorquentyn", "PoorQuentyn archive", "https://poorquentyn.com/", ["chapter-analysis", "theory-provenance"]],
  ["bryndenbfish", "BryndenBFish analysis archive", "https://warsandpoliticsoficeandfire.wordpress.com/", ["military-logistics", "theory-provenance"]],
  ["wars-politics", "Wars and Politics of Ice and Fire", "https://warsandpoliticsoficeandfire.wordpress.com/", ["military-logistics", "law-governance"]],
  ["alt-shift-x", "Alt Shift X", "https://www.youtube.com/@AltShiftX", ["community-consensus", "adaptation-deltas"]],
  ["glidus", "Glidus", "https://www.youtube.com/@Glidus", ["adaptation-deltas", "community-consensus"]],
  ["in-deep-geek", "In Deep Geek", "https://www.youtube.com/@InDeepGeek", ["theory-provenance", "community-consensus"]],
  ["joe-magician", "Joe Magician", "https://www.youtube.com/@JoeMagician", ["theory-provenance", "literary-influences"]],
  ["quinns-ideas", "Quinn's Ideas", "https://www.youtube.com/@QuinnsIdeas", ["others-long-night", "theory-provenance"]],
  ["lucifer-lightbringer", "Lucifer Means Lightbringer archive", "https://lucifermeanslightbringer.com/", ["religious-analogue", "theory-provenance"]],
  ["david-lightbringer", "David Lightbringer", "https://www.youtube.com/@DavidLightbringer", ["religious-analogue", "theory-provenance"]],
  ["storm-spoilers", "A Storm of Spoilers", "https://stormofspoilers.com/", ["adaptation-deltas", "fandom-history"]],
];

const COMMUNITY_SOURCES = COMMUNITY_SEEDS.map(([id, label, canonicalUri, roles]) =>
  source({
    id: `community-${id}`,
    label,
    canonicalUri,
    sourcePlane: "community-analysis",
    authorityClass: roles.includes("entity-resolution") ? "community-reference" : "community-analysis",
    continuityIds: ["analysis"],
    roles,
    contentClasses: canonicalUri.includes("youtube.com") ? ["video"] : canonicalUri.includes("podbean") ? ["podcast"] : ["reference-article"],
    accessKind: canonicalUri.includes("youtube.com") ? "video-channel" : canonicalUri.includes("podbean") ? "podcast-feed" : "html",
    accessUri: canonicalUri,
    machineReadable: false,
    accessNotes: "Community surface used for reference, analysis, consensus, or theory provenance.",
    harvestMode: "route-only-no-mirror",
    rightsMode: "link-only",
    verificationStatus: "unverified",
    strengths: ["Community synthesis or theory provenance"],
    cautions: ["Cannot establish a primary-text event or author intent"],
  }),
);

const DISCUSSION_SEEDS: Array<[string, string, string, AsoiafExternalRole[]]> = [
  ["westeros-forums", "Westeros.org forums", "https://asoiaf.westeros.org/", ["theory-provenance", "fandom-history"]],
  ["reddit-asoiaf", "Reddit r/asoiaf", "https://www.reddit.com/r/asoiaf/", ["community-consensus", "theory-provenance"]],
  ["reddit-pureasoiaf", "Reddit r/pureasoiaf", "https://www.reddit.com/r/pureasoiaf/", ["community-consensus", "theory-provenance"]],
  ["reddit-hotd", "Reddit r/HouseOfTheDragon", "https://www.reddit.com/r/HouseOfTheDragon/", ["community-consensus", "adaptation-deltas"]],
  ["reddit-search", "Reddit public search route", "https://www.reddit.com/search/", ["theory-provenance", "fandom-history"]],
  ["stackexchange", "Science Fiction & Fantasy Stack Exchange ASOIAF route", "https://scifi.stackexchange.com/questions/tagged/a-song-of-ice-and-fire", ["community-consensus", "entity-resolution"]],
  ["goodreads", "Goodreads ASOIAF discussions", "https://www.goodreads.com/series/43790-a-song-of-ice-and-fire", ["fandom-history", "community-consensus"]],
  ["tumblr", "Tumblr ASOIAF tag route", "https://www.tumblr.com/tagged/asoiaf", ["fandom-history", "theory-provenance"]],
  ["bluesky", "Bluesky ASOIAF search route", "https://bsky.app/search?q=asoiaf", ["fandom-history", "community-consensus"]],
  ["youtube-search", "YouTube ASOIAF search route", "https://www.youtube.com/results?search_query=asoiaf", ["theory-provenance", "fandom-history"]],
  ["podcast-index", "Podcast Index ASOIAF discovery", "https://podcastindex.org/search?q=asoiaf", ["theory-provenance", "fandom-history"]],
  ["tvtropes", "TV Tropes ASOIAF route", "https://tvtropes.org/pmwiki/pmwiki.php/Literature/ASongOfIceAndFire", ["literary-influences", "community-consensus"]],
];

const DISCUSSION_SOURCES = DISCUSSION_SEEDS.map(([id, label, canonicalUri, roles]) =>
  source({
    id: `discussion-${id}`,
    label,
    canonicalUri,
    sourcePlane: "discussion",
    authorityClass: "discussion-provenance",
    continuityIds: ["analysis"],
    roles,
    contentClasses: ["forum-thread"],
    accessKind: canonicalUri.includes("search") ? "social-search" : "html",
    accessUri: canonicalUri,
    machineReadable: false,
    accessNotes: "Discussion surface may establish date, authorship, spread, or consensus of a theory.",
    harvestMode: "route-only-no-mirror",
    rightsMode: "link-only",
    verificationStatus: "unverified",
    strengths: ["Theory and fandom-history provenance"],
    cautions: ["Discussion cannot establish fictional events"],
  }),
);

const SCHOLARLY_SEEDS: Array<[string, string, string, AsoiafExternalRole[]]> = [
  ["perseus", "Perseus Digital Library", "https://www.perseus.tufts.edu/", ["historical-analogue", "religious-analogue"]],
  ["fordham", "Internet Medieval Sourcebook", "https://sourcebooks.fordham.edu/sbook.asp", ["historical-analogue", "law-governance"]],
  ["british-history", "British History Online", "https://www.british-history.ac.uk/", ["historical-analogue", "law-governance"]],
  ["jstor", "JSTOR search", "https://www.jstor.org/action/doBasicSearch", ["historical-analogue", "literary-influences"]],
  ["google-scholar", "Google Scholar", "https://scholar.google.com/", ["historical-analogue", "scientific-analogue"]],
  ["iranica", "Encyclopaedia Iranica", "https://iranicaonline.org/", ["historical-analogue", "religious-analogue"]],
  ["sacred-texts", "Internet Sacred Text Archive", "https://sacred-texts.com/", ["religious-analogue", "literary-influences"]],
  ["stanford", "Stanford Encyclopedia of Philosophy", "https://plato.stanford.edu/", ["religious-analogue", "law-governance"]],
  ["fao", "FAO agriculture and food systems data", "https://www.fao.org/faostat/", ["food-agriculture", "scientific-analogue"]],
  ["noaa", "NOAA paleoclimate data", "https://www.ncei.noaa.gov/products/paleoclimatology", ["scientific-analogue", "others-long-night"]],
];

const SCHOLARLY_SOURCES = SCHOLARLY_SEEDS.map(([id, label, canonicalUri, roles]) =>
  source({
    id: `scholarly-${id}`,
    label,
    canonicalUri,
    sourcePlane: "scholarly",
    authorityClass: "scholarly-analogue",
    continuityIds: roles.includes("scientific-analogue") ? ["scientific-analogue"] : ["historical-analogue"],
    roles,
    contentClasses: ["scholarly-source"],
    accessKind: "search-ui",
    accessUri: canonicalUri,
    machineReadable: false,
    accessNotes: "Use only to constrain an analogue or physical hypothesis.",
    harvestMode: "metadata-only",
    rightsMode: "unknown-review-required",
    verificationStatus: "verified-route",
    strengths: ["Bounded historical, religious, institutional, or scientific comparison"],
    cautions: ["Cannot establish fictional canon or author intent"],
  }),
);

const ARCHIVE_SEEDS: Array<[string, string, string, AsoiafExternalRole[]]> = [
  ["wayback", "Internet Archive Wayback Machine CDX", "https://web.archive.org/cdx/", ["archive-recovery", "fandom-history"]],
  ["archive-items", "Internet Archive item catalog", "https://archive.org/advancedsearch.php", ["archive-recovery", "publication-history"]],
  ["worldcat", "WorldCat catalog", "https://search.worldcat.org/", ["edition-resolution", "international-reference"]],
  ["loc", "Library of Congress catalog", "https://www.loc.gov/books/", ["edition-resolution", "archive-recovery"]],
  ["british-library", "British Library catalog", "https://explore.bl.uk/", ["edition-resolution", "international-reference"]],
  ["hathitrust", "HathiTrust catalog", "https://catalog.hathitrust.org/", ["edition-resolution", "archive-recovery"]],
  ["openlibrary", "Open Library catalog", "https://openlibrary.org/", ["edition-resolution", "publication-history"]],
  ["isfdb", "Internet Speculative Fiction Database", "https://www.isfdb.org/", ["publication-history", "literary-influences"]],
  ["cushing-digital", "Cushing Library digital collections", "https://cushing.library.tamu.edu/", ["archive-recovery"]],
  ["fanlore", "Fanlore ASOIAF fandom-history route", "https://fanlore.org/wiki/A_Song_of_Ice_and_Fire", ["fandom-history"]],
];

const ARCHIVE_SOURCES = ARCHIVE_SEEDS.map(([id, label, canonicalUri, roles]) =>
  source({
    id: `archive-${id}`,
    label,
    canonicalUri,
    sourcePlane: "archive",
    authorityClass: "archival-custody",
    continuityIds: ["cross-continuity"],
    roles,
    contentClasses: ["bibliographic-record", "finding-aid"],
    accessKind: id === "wayback" || id === "archive-items" ? "archive-api" : "search-ui",
    accessUri: canonicalUri,
    machineReadable: id === "wayback" || id === "archive-items",
    accessNotes: "Archive or catalog route; preserve archival timestamp and original source identity.",
    harvestMode: "metadata-only",
    rightsMode: "unknown-review-required",
    verificationStatus: "verified-route",
    strengths: ["Publication, custody, and recovery evidence"],
    cautions: ["Archived availability does not change underlying rights or authority"],
  }),
);

export const ASOIAF_EXTERNAL_SOURCES: AsoiafExternalSource[] = [
  ...LOCAL_SOURCES,
  ...GRRM_SOURCES,
  ...EPISODE_SOURCES,
  ...HBO_SOURCES,
  ...PUBLISHER_SOURCES,
  ...STRUCTURED_SOURCES,
  ...COMMUNITY_SOURCES,
  ...DISCUSSION_SOURCES,
  ...SCHOLARLY_SOURCES,
  ...ARCHIVE_SOURCES,
];
