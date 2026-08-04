import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  intakeAsoiafLocalEdition,
  listAsoiafLocalEditions,
  localEditionPaths,
  locateAsoiafLocalEditionText,
  verifyAsoiafLocalEdition,
  writeAsoiafLocalEditionReceipt,
  type AsoiafLocalEditionManifest,
} from "../../../tools/lib/asoiaf-local-edition-intake.js";
import {
  collectorEstatePaths,
  readNdjson,
  type CollectorObservationRecord,
} from "../../../tools/lib/asoiaf-external-estate.js";

const roots: string[] = [];

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asoiaf-local-edition-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

function writeSource(root: string, name: string, content: string | Buffer): string {
  const directory = path.join(root, "holder-input");
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, name);
  fs.writeFileSync(target, content);
  return target;
}

function storedZip(entries: Array<{ name: string; content: string | Buffer }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    centrals.push(central, name);
    localOffset += local.length + name.length + content.length;
  }
  const centralOffset = localOffset;
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBytes, end]);
}

function syntheticEpub(): Buffer {
  return storedZip([
    { name: "mimetype", content: "application/epub+zip" },
    {
      name: "META-INF/container.xml",
      content: `<?xml version="1.0"?>
<container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    },
    {
      name: "OEBPS/content.opf",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns:dc="http://purl.org/dc/elements/1.1/">
  <metadata>
    <dc:title>A Game of Thrones Test Edition</dc:title>
    <dc:language>en</dc:language>
    <dc:publisher>Holder Test Press</dc:publisher>
    <dc:identifier>urn:isbn:9780000000001</dc:identifier>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="prologue" href="text/prologue.xhtml" media-type="application/xhtml+xml"/>
    <item id="bran" href="text/bran.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="prologue"/>
    <itemref idref="bran"/>
  </spine>
</package>`,
    },
    {
      name: "OEBPS/nav.xhtml",
      content: `<html><body><nav><ol>
<li><a href="text/prologue.xhtml">Prologue</a></li>
<li><a href="text/bran.xhtml">Bran</a></li>
</ol></nav></body></html>`,
    },
    {
      name: "OEBPS/text/prologue.xhtml",
      content: `<html><body><h1>PROLOGUE</h1><p>The cold opened the test.</p><p>A second bounded paragraph followed.</p></body></html>`,
    },
    {
      name: "OEBPS/text/bran.xhtml",
      content: `<html><body><h1>BRAN</h1><p>The boy watched from the exact holder edition.</p></body></html>`,
    },
  ]);
}

function plainBook(version = 1): string {
  return `PROLOGUE
The cold opened the private holder copy version ${version}.

A second paragraph establishes a stable locator.

BRAN
The boy watched from a bounded chapter.

The direwolf waited.

CATELYN
The household state changed without publishing the source file.`;
}

async function ingestPlain(root: string, content = plainBook()) {
  const filePath = writeSource(root, "Jonathan-private-AGOT-source.txt", content);
  const result = await intakeAsoiafLocalEdition({
    root,
    sourceId: "local-agot",
    editionId: "AGOT holder paperback test",
    filePath,
    ingestedAt: "2026-08-04T12:00:00.000Z",
  });
  return { filePath, ...result };
}

describe("ASOIAF local-edition intake", () => {
  it("segments a holder-controlled text edition without retaining its source path or filename", async () => {
    const root = temporaryRoot();
    const result = await ingestPlain(root);

    expect(result.manifest).toEqual(
      expect.objectContaining({
        sourceId: "local-agot",
        continuityId: "book-main",
        inputFormat: "plain-text",
        sourcePathRetained: false,
        sourceFilenameRetained: false,
        privateTextRetained: true,
        unitCount: 3,
        graphEffect: "none",
        canonEffect: "none",
      }),
    );
    expect(result.units.map((unit) => unit.label)).toEqual([
      "PROLOGUE",
      "BRAN",
      "CATELYN",
    ]);
    expect(result.segments.length).toBeGreaterThanOrEqual(5);
    expect(verifyAsoiafLocalEdition(
      root,
      result.manifest.sourceId,
      result.manifest.editionId,
    )).toEqual([]);

    const paths = localEditionPaths(
      root,
      result.manifest.sourceId,
      result.manifest.editionId,
    );
    const publicProjection = [
      fs.readFileSync(paths.manifest, "utf8"),
      fs.readFileSync(paths.units, "utf8"),
      fs.readFileSync(paths.segments, "utf8"),
      fs.readFileSync(paths.privateIndex, "utf8"),
    ].join("\n");
    expect(publicProjection).not.toContain(result.filePath);
    expect(publicProjection).not.toContain(path.basename(result.filePath));
    expect(publicProjection).not.toContain("The cold opened the private holder copy");

    const observations = readNdjson<CollectorObservationRecord>(
      collectorEstatePaths(root).observations,
    );
    expect(observations).toHaveLength(1);
    expect(observations[0]).toEqual(
      expect.objectContaining({
        sourceId: "local-agot",
        sourceRecordId: result.manifest.sourceRecordId,
        contentDigest: result.manifest.sourceDigest,
        graphEffect: "none",
        canonEffect: "none",
      }),
    );
  });

  it("parses EPUB package metadata, spine order, navigation labels, and paragraph locators", async () => {
    const root = temporaryRoot();
    const filePath = writeSource(root, "private-holder-copy.epub", syntheticEpub());
    const result = await intakeAsoiafLocalEdition({
      root,
      sourceId: "local-agot",
      editionId: "AGOT synthetic EPUB test",
      filePath,
      ingestedAt: "2026-08-04T12:05:00.000Z",
    });

    expect(result.manifest.inputFormat).toBe("epub");
    expect(result.manifest.mediaType).toBe("application/epub+zip");
    expect(result.manifest.metadata).toEqual({
      title: "A Game of Thrones Test Edition",
      language: "en",
      publisher: "Holder Test Press",
      identifiers: ["urn:isbn:9780000000001"],
    });
    expect(result.units.map((unit) => unit.label)).toEqual([
      "Prologue",
      "Bran",
    ]);
    expect(result.units.map((unit) => unit.sourcePart)).toEqual([
      "OEBPS/text/prologue.xhtml",
      "OEBPS/text/bran.xhtml",
    ]);
    expect(result.segments).toHaveLength(3);
    expect(verifyAsoiafLocalEdition(
      root,
      result.manifest.sourceId,
      result.manifest.editionId,
    )).toEqual([]);
  });

  it("can retain only custody digests and locators while omitting private extracted text", async () => {
    const root = temporaryRoot();
    const filePath = writeSource(root, "private-no-text.txt", plainBook());
    const result = await intakeAsoiafLocalEdition({
      root,
      sourceId: "local-agot",
      editionId: "AGOT digest-only edition",
      filePath,
      ingestedAt: "2026-08-04T12:10:00.000Z",
      retainPrivateText: false,
    });
    expect(result.manifest.privateTextRetained).toBe(false);
    expect(result.manifest.files.privateIndex).toBeNull();
    expect(fs.existsSync(result.paths.privateRoot)).toBe(false);
    expect(fs.existsSync(result.paths.privateIndex)).toBe(false);
    expect(verifyAsoiafLocalEdition(
      root,
      result.manifest.sourceId,
      result.manifest.editionId,
    )).toEqual([]);
  });

  it("appends source revisions to one durable edition candidate", async () => {
    const root = temporaryRoot();
    const first = await ingestPlain(root, plainBook(1));
    const secondPath = writeSource(
      root,
      "another-private-name.txt",
      plainBook(2),
    );
    const second = await intakeAsoiafLocalEdition({
      root,
      sourceId: "local-agot",
      editionId: first.manifest.editionId,
      filePath: secondPath,
      ingestedAt: "2026-08-04T13:00:00.000Z",
      refresh: true,
    });

    expect(second.manifest.sourceRecordId).toBe(first.manifest.sourceRecordId);
    expect(second.manifest.collectorCandidateId).toBe(
      first.manifest.collectorCandidateId,
    );
    expect(second.manifest.collectorObservationId).not.toBe(
      first.manifest.collectorObservationId,
    );
    expect(listAsoiafLocalEditions(root)).toHaveLength(1);
    const observations = readNdjson<CollectorObservationRecord>(
      collectorEstatePaths(root).observations,
    );
    expect(observations).toHaveLength(2);
  });

  it("detects private-text tampering against unit and paragraph digests", async () => {
    const root = temporaryRoot();
    const result = await ingestPlain(root);
    const privateIndex = JSON.parse(
      fs.readFileSync(result.paths.privateIndex, "utf8"),
    ) as { entries: Array<{ relativeUri: string }> };
    const first = privateIndex.entries[0]!;
    fs.appendFileSync(
      path.join(result.paths.editionRoot, first.relativeUri),
      "\nInjected drift.",
      "utf8",
    );
    expect(
      verifyAsoiafLocalEdition(
        root,
        result.manifest.sourceId,
        result.manifest.editionId,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("failed digest or size custody"),
      ]),
    );
  });

  it("reveals local text only through an explicit include-text transaction", async () => {
    const root = temporaryRoot();
    const result = await ingestPlain(root);
    const unit = result.units[0]!;
    const segment = result.segments.find((entry) => entry.unitId === unit.unitId)!;
    const hidden = locateAsoiafLocalEditionText({
      root,
      sourceId: result.manifest.sourceId,
      editionId: result.manifest.editionId,
      unitId: unit.unitId,
      segmentId: segment.segmentId,
    });
    expect(hidden.text).toBeNull();

    const visible = locateAsoiafLocalEditionText({
      root,
      sourceId: result.manifest.sourceId,
      editionId: result.manifest.editionId,
      unitId: unit.unitId,
      segmentId: segment.segmentId,
      includeText: true,
    });
    expect(visible.text).toContain("The cold opened");
  });

  it("emits a deterministic verification receipt without source-path disclosure", async () => {
    const root = temporaryRoot();
    const result = await ingestPlain(root);
    const first = writeAsoiafLocalEditionReceipt(
      root,
      result.manifest.sourceId,
      result.manifest.editionId,
      "2026-08-04T14:00:00.000Z",
    );
    const second = writeAsoiafLocalEditionReceipt(
      root,
      result.manifest.sourceId,
      result.manifest.editionId,
      "2026-08-04T14:00:00.000Z",
    );
    expect(first).toEqual(second);
    expect(first.passed).toBe(true);
    expect(JSON.stringify(first)).not.toContain(path.basename(result.filePath));
  });

  it("refuses nonlocal atlas sources and bounded-size violations", async () => {
    const root = temporaryRoot();
    const filePath = writeSource(root, "small.txt", plainBook());
    await expect(
      intakeAsoiafLocalEdition({
        root,
        sourceId: "grrm-home",
        editionId: "invalid public source",
        filePath,
      }),
    ).rejects.toThrow("not a holder-controlled local source");
    await expect(
      intakeAsoiafLocalEdition({
        root,
        sourceId: "local-agot",
        editionId: "oversize policy fixture",
        filePath,
        maxSourceBytes: 8,
      }),
    ).rejects.toThrow("exceeds bounded intake policy");
  });

  it("refuses EPUB package traversal before extracting any member", async () => {
    const root = temporaryRoot();
    const malicious = storedZip([
      { name: "META-INF/container.xml", content: `<container><rootfile full-path="../book.opf"/></container>` },
      { name: "../book.opf", content: "<package/>" },
    ]);
    const filePath = writeSource(root, "unsafe.epub", malicious);
    await expect(
      intakeAsoiafLocalEdition({
        root,
        sourceId: "local-agot",
        editionId: "unsafe EPUB fixture",
        filePath,
      }),
    ).rejects.toThrow("unsafe ZIP member");
  });
});
