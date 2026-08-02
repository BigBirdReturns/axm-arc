#!/usr/bin/env python3
"""Recover a verified Burn Protocol source frontier into sub-limit ZIP packets.

The tool accepts either the exact parent estate ZIP or a handoff ZIP containing
that parent. It validates the parent against a pinned contract, parses the
parent's deterministic file manifest, selects one episode/chapter frontier,
verifies every selected byte, and emits deterministic ZIP_STORED packets.

It deliberately does not infer canonical text or asset custody from filenames.
Every emitted file must be present in the parent manifest and pass its exact
byte-count and SHA-256 receipt.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO, Iterable, Iterator, Sequence

TOOL_VERSION = "1.2.0"
FORMAT = "burn-protocol-source-frontier-recovery/1"
PACKET_FORMAT = "burn-protocol-source-frontier-packet/1"
FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
PATH_KEYS = ("path", "name", "file", "relativePath")
HASH_KEYS = ("sha256", "sha256Hex", "hash", "digest")
BYTE_KEYS = ("bytes", "size", "byteLength", "uncompressedBytes")
TEXT_SUFFIXES = {".json", ".csv", ".md", ".txt", ".jsonl"}


class RecoveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class ManifestRecord:
    path: str
    bytes: int
    sha256: str


@dataclass(frozen=True)
class SelectedFile:
    record: ManifestRecord
    zip_entry: str
    classification: str


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_member_name(name: str) -> str:
    if not isinstance(name, str) or not name:
        raise RecoveryError("ZIP entry name is empty or non-text.")
    if "\x00" in name:
        raise RecoveryError(f"ZIP entry contains NUL: {name!r}")
    if "\\" in name:
        raise RecoveryError(f"ZIP entry uses a backslash path: {name}")
    if name.startswith("/") or re.match(r"^[A-Za-z]:", name):
        raise RecoveryError(f"ZIP entry is absolute: {name}")
    path = PurePosixPath(name)
    if any(part in {"", ".", ".."} for part in path.parts):
        raise RecoveryError(f"ZIP entry is unsafe: {name}")
    return path.as_posix()


def validate_zip(zf: zipfile.ZipFile, label: str, *, test_crc: bool = True) -> dict[str, zipfile.ZipInfo]:
    entries: dict[str, zipfile.ZipInfo] = {}
    for info in zf.infolist():
        normalized = normalize_member_name(info.filename.rstrip("/")) if info.filename.endswith("/") else normalize_member_name(info.filename)
        if normalized in entries:
            raise RecoveryError(f"{label} duplicates ZIP entry {normalized}.")
        unix_mode = (info.external_attr >> 16) & 0o170000
        if unix_mode == 0o120000:
            raise RecoveryError(f"{label} contains a symbolic link: {normalized}")
        if info.flag_bits & 0x1:
            raise RecoveryError(f"{label} contains an encrypted entry: {normalized}")
        entries[normalized] = info
    if test_crc:
        bad = zf.testzip()
        if bad is not None:
            raise RecoveryError(f"{label} failed CRC verification at {bad}.")
    return entries


def basename_matches(entries: Iterable[str], expected: str) -> list[str]:
    return sorted(path for path in entries if PurePosixPath(path).name == expected)


def load_contract(path: Path) -> dict[str, Any]:
    try:
        contract = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RecoveryError(f"Cannot read contract {path}: {exc}") from exc
    if contract.get("format") != "burn-protocol-source-frontier-recovery-contract/1":
        raise RecoveryError("Unsupported recovery contract format.")
    parent = contract.get("parent")
    if not isinstance(parent, dict):
        raise RecoveryError("Contract parent is missing.")
    for key in ("basename", "bytes", "sha256", "manifestBasename"):
        if key not in parent:
            raise RecoveryError(f"Contract parent.{key} is missing.")
    digest = str(parent["sha256"]).lower().removeprefix("sha256:")
    if not SHA256_RE.fullmatch(digest):
        raise RecoveryError("Contract parent SHA-256 is invalid.")
    parent["sha256"] = digest
    parent["bytes"] = int(parent["bytes"])
    if parent["bytes"] < 0:
        raise RecoveryError("Contract parent byte count is invalid.")
    if "manifestRecords" in parent:
        parent["manifestRecords"] = int(parent["manifestRecords"])
        if parent["manifestRecords"] <= 0:
            raise RecoveryError("Contract parent manifestRecords is invalid.")
    if "manifestUncompressedBytes" in parent:
        parent["manifestUncompressedBytes"] = int(parent["manifestUncompressedBytes"])
        if parent["manifestUncompressedBytes"] < 0:
            raise RecoveryError("Contract parent manifestUncompressedBytes is invalid.")

    selection = contract.get("selection")
    if not isinstance(selection, dict):
        raise RecoveryError("Contract selection is missing.")
    tokens = selection.get("tokens")
    if not isinstance(tokens, list) or not tokens or not all(isinstance(token, str) and token for token in tokens):
        raise RecoveryError("Contract selection.tokens must be a non-empty text array.")
    required = selection.get("requiredClassifications", {})
    if not isinstance(required, dict):
        raise RecoveryError("Contract selection.requiredClassifications must be an object.")
    normalized_required: dict[str, int] = {}
    for classification, minimum in required.items():
        if not isinstance(classification, str) or not classification:
            raise RecoveryError("Required classification names must be non-empty text.")
        try:
            count = int(minimum)
        except (TypeError, ValueError) as exc:
            raise RecoveryError(f"Required classification {classification} has an invalid minimum.") from exc
        if count <= 0:
            raise RecoveryError(f"Required classification {classification} must have a positive minimum.")
        normalized_required[classification] = count
    selection["requiredClassifications"] = normalized_required
    return contract


def materialize_parent(input_path: Path, contract: dict[str, Any], temp_root: Path) -> tuple[Path, dict[str, Any]]:
    expected = contract["parent"]
    input_path = input_path.resolve()
    if not input_path.is_file():
        raise RecoveryError(f"Input does not exist: {input_path}")

    input_receipt = {
        "basename": input_path.name,
        "bytes": input_path.stat().st_size,
        "sha256": sha256_file(input_path),
    }

    # A direct parent archive is accepted by exact bytes and SHA-256 even if
    # the holder renamed the file locally. A file carrying the canonical parent
    # basename is treated as a direct candidate so a changed parent produces a
    # precise receipt mismatch instead of being misread as an outer handoff.
    if (
        input_receipt["bytes"] == expected["bytes"]
        and input_receipt["sha256"] == expected["sha256"]
    ) or input_path.name == expected["basename"]:
        parent_path = input_path
        source_kind = "direct-parent"
    else:
        try:
            with zipfile.ZipFile(input_path) as handoff:
                entries = validate_zip(handoff, "handoff")
                matches = basename_matches(entries, expected["basename"])
                if len(matches) != 1:
                    raise RecoveryError(
                        f"Expected one nested {expected['basename']}, found {len(matches)}."
                    )
                nested_name = matches[0]
                parent_path = temp_root / expected["basename"]
                with handoff.open(entries[nested_name], "r") as source, parent_path.open("wb") as destination:
                    shutil.copyfileobj(source, destination, length=1024 * 1024)
                source_kind = "nested-parent"
        except zipfile.BadZipFile as exc:
            raise RecoveryError(f"Input is neither the direct parent nor a valid handoff ZIP: {exc}") from exc

    actual_bytes = parent_path.stat().st_size
    actual_hash = sha256_file(parent_path)
    if actual_bytes != expected["bytes"]:
        raise RecoveryError(f"Parent bytes: expected {expected['bytes']}, got {actual_bytes}.")
    if actual_hash != expected["sha256"]:
        raise RecoveryError(f"Parent SHA-256: expected {expected['sha256']}, got {actual_hash}.")

    return parent_path, {
        "sourceKind": source_kind,
        "input": input_receipt,
        "parent": {
            "basename": parent_path.name,
            "bytes": actual_bytes,
            "sha256": actual_hash,
        },
    }


def first_value(record: dict[str, Any], keys: Sequence[str]) -> Any:
    for key in keys:
        if key in record:
            return record[key]
    return None


def parse_manifest_record(value: Any, fallback_path: str | None = None) -> ManifestRecord | None:
    if not isinstance(value, dict):
        return None
    path_value = first_value(value, PATH_KEYS) or fallback_path
    hash_value = first_value(value, HASH_KEYS)
    bytes_value = first_value(value, BYTE_KEYS)
    if not isinstance(path_value, str) or not isinstance(hash_value, str):
        return None
    try:
        normalized = normalize_member_name(path_value)
        byte_count = int(bytes_value)
    except (RecoveryError, TypeError, ValueError):
        return None
    digest = hash_value.lower().removeprefix("sha256:").strip()
    if byte_count < 0 or not SHA256_RE.fullmatch(digest):
        return None
    return ManifestRecord(normalized, byte_count, digest)


def manifest_candidates(value: Any, label: str = "root", depth: int = 0) -> Iterator[tuple[str, list[ManifestRecord]]]:
    if depth > 8:
        return
    if isinstance(value, list):
        records = [parse_manifest_record(item) for item in value]
        if records and all(record is not None for record in records):
            yield label, [record for record in records if record is not None]
        for index, item in enumerate(value):
            if isinstance(item, (dict, list)):
                yield from manifest_candidates(item, f"{label}[{index}]", depth + 1)
    elif isinstance(value, dict):
        mapped = [parse_manifest_record(metadata, path) for path, metadata in value.items()]
        if mapped and all(record is not None for record in mapped):
            yield label, [record for record in mapped if record is not None]
        for key, child in value.items():
            if isinstance(child, (dict, list)):
                yield from manifest_candidates(child, f"{label}.{key}", depth + 1)


def parse_manifest(data: bytes, expected_records: int | None = None) -> tuple[str, list[ManifestRecord]]:
    try:
        document = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RecoveryError(f"Manifest is not valid UTF-8 JSON: {exc}") from exc
    candidates = list(manifest_candidates(document))
    if not candidates:
        raise RecoveryError("No manifest record collection was found.")
    # When the authority contract carries an exact record count, require it.
    # Otherwise prefer the largest structurally valid collection. Ambiguous
    # equal-sized candidates fail closed rather than silently selecting one.
    if expected_records is not None:
        largest = [(label, records) for label, records in candidates if len(records) == expected_records]
        if not largest:
            raise RecoveryError(
                f"Manifest has no structurally valid record collection with {expected_records} records."
            )
    else:
        max_records = max(len(records) for _, records in candidates)
        largest = [(label, records) for label, records in candidates if len(records) == max_records]
    unique_fingerprints: dict[tuple[tuple[str, int, str], ...], tuple[str, list[ManifestRecord]]] = {}
    for label, records in largest:
        fingerprint = tuple(sorted((record.path, record.bytes, record.sha256) for record in records))
        unique_fingerprints[fingerprint] = (label, records)
    if len(unique_fingerprints) != 1:
        labels = ", ".join(label for label, _ in largest)
        raise RecoveryError(f"Manifest has ambiguous largest record collections: {labels}")
    label, records = next(iter(unique_fingerprints.values()))
    seen: set[str] = set()
    for record in records:
        if record.path in seen:
            raise RecoveryError(f"Manifest duplicates {record.path}.")
        seen.add(record.path)
    return label, sorted(records, key=lambda record: record.path)


def classify_path(path: str) -> str:
    lower = path.lower()
    suffix = PurePosixPath(lower).suffix
    if "/panels/" in lower or re.search(r"e\d{2}-c\d+-p\d+", lower):
        return "panel-raster"
    if "/plates/" in lower or "plate-" in lower:
        return "plate-raster"
    if "/source/episodes/" in lower or lower.startswith("source/episodes/"):
        return "canonical-episode-source"
    if "/site/data/" in lower or lower.startswith("site/data/"):
        return "compiled-reader-source"
    if re.search(r"(^|/)scripts/episode-\d{2}[^/]*\.md$", lower):
        return "canonical-script-render"
    if re.search(r"(^|/)source/art/a\d{2}c\d+/chapter\.json$", lower):
        return "chapter-source"
    if re.search(r"(^|/)source/art/a\d{2}c\d+/lettering\.json$", lower) or "lettering" in lower:
        return "canonical-lettering"
    if re.search(r"(^|/)source/art/a\d{2}c\d+/panel-art\.json$", lower):
        return "chapter-panel-art-source"
    if re.search(r"(^|/)source/art/a\d{2}c\d+/provenance\.json$", lower):
        return "chapter-provenance"
    if re.search(r"(^|/)manifests/a\d{2}c\d+-recovery\.json$", lower):
        return "chapter-recovery-receipt"
    if "scroll-plates" in lower:
        return "plate-map"
    if "art-manifest" in lower:
        return "art-manifest"
    if "art-audit" in lower:
        return "art-audit"
    if re.search(r"(^|/)q\d{2}-", lower):
        return "episode-ledger"
    if suffix in TEXT_SUFFIXES:
        return "supporting-text"
    return "supporting-binary"


def select_records(records: Sequence[ManifestRecord], tokens: Sequence[str]) -> list[ManifestRecord]:
    lowered_tokens = tuple(token.lower() for token in tokens if token)
    if not lowered_tokens:
        raise RecoveryError("Selection token list is empty.")
    selected = [record for record in records if any(token in record.path.lower() for token in lowered_tokens)]
    return sorted(selected, key=lambda record: record.path)


def packet_groups(files: Sequence[SelectedFile], max_packet_bytes: int) -> list[list[SelectedFile]]:
    # ZIP_STORED size is source bytes plus central-directory overhead. Reserve
    # two MiB so every packet remains comfortably below the configured ceiling.
    reserve = 2 * 1024 * 1024
    payload_limit = max_packet_bytes - reserve
    if payload_limit <= 0:
        raise RecoveryError("Packet limit must exceed 2 MiB.")
    groups: list[list[SelectedFile]] = []
    current: list[SelectedFile] = []
    current_bytes = 0
    for selected in files:
        size = selected.record.bytes
        if size > payload_limit:
            raise RecoveryError(
                f"Selected file {selected.record.path} is {size} bytes, larger than the safe packet payload limit {payload_limit}."
            )
        if current and current_bytes + size > payload_limit:
            groups.append(current)
            current = []
            current_bytes = 0
        current.append(selected)
        current_bytes += size
    if current:
        groups.append(current)
    return groups


def zip_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=FIXED_ZIP_TIME)
    info.compress_type = zipfile.ZIP_STORED
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    return info


def copy_verified_entry(
    parent: zipfile.ZipFile,
    info: zipfile.ZipInfo,
    record: ManifestRecord,
    packet: zipfile.ZipFile,
) -> None:
    digest = hashlib.sha256()
    total = 0
    with parent.open(info, "r") as source, packet.open(zip_info(record.path), "w") as destination:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
            total += len(chunk)
            destination.write(chunk)
    if total != record.bytes:
        raise RecoveryError(f"Manifest bytes for {record.path}: expected {record.bytes}, got {total}.")
    actual_hash = digest.hexdigest()
    if actual_hash != record.sha256:
        raise RecoveryError(f"Manifest SHA-256 for {record.path}: expected {record.sha256}, got {actual_hash}.")


def build_packets(
    parent_path: Path,
    output_root: Path,
    selected_records: Sequence[ManifestRecord],
    contract: dict[str, Any],
    manifest_receipt: dict[str, Any],
    max_packet_bytes: int,
) -> list[dict[str, Any]]:
    with zipfile.ZipFile(parent_path) as parent:
        entries = validate_zip(parent, "parent", test_crc=False)
        selected_files: list[SelectedFile] = []
        for record in selected_records:
            info = entries.get(record.path)
            if info is None:
                raise RecoveryError(f"Selected manifest path is missing from the parent ZIP: {record.path}")
            if info.is_dir():
                raise RecoveryError(f"Selected manifest path is a directory: {record.path}")
            if info.file_size != record.bytes:
                raise RecoveryError(
                    f"Parent central-directory bytes for {record.path}: expected {record.bytes}, got {info.file_size}."
                )
            selected_files.append(SelectedFile(record, record.path, classify_path(record.path)))

        groups = packet_groups(selected_files, max_packet_bytes)
        packets: list[dict[str, Any]] = []
        total_packets = len(groups)
        release = str(contract.get("release", "unknown"))
        selection = contract.get("selection", {})
        episode = int(selection.get("episode", 4))
        chapter = int(selection.get("chapter", 1))
        for index, group in enumerate(groups, start=1):
            packet_name = (
                f"burn-protocol-v{release}-E{episode:02d}-C{chapter}-"
                f"intake-packet-{index:03d}-of-{total_packets:03d}.zip"
            )
            packet_path = output_root / packet_name
            packet_document = {
                "format": PACKET_FORMAT,
                "toolVersion": TOOL_VERSION,
                "release": release,
                "episode": episode,
                "chapter": chapter,
                "packet": index,
                "packets": total_packets,
                "manifest": manifest_receipt,
                "parent": {
                    "basename": contract["parent"]["basename"],
                    "bytes": contract["parent"]["bytes"],
                    "sha256": contract["parent"]["sha256"],
                },
                "files": [
                    {
                        "path": item.record.path,
                        "bytes": item.record.bytes,
                        "sha256": item.record.sha256,
                        "classification": item.classification,
                    }
                    for item in group
                ],
            }
            with zipfile.ZipFile(packet_path, "w", allowZip64=True) as packet:
                packet.writestr(zip_info("PACKET.json"), canonical_json_bytes(packet_document))
                for item in group:
                    copy_verified_entry(parent, entries[item.zip_entry], item.record, packet)
            actual_size = packet_path.stat().st_size
            if actual_size > max_packet_bytes:
                raise RecoveryError(
                    f"Packet {packet_name} is {actual_size} bytes, above the configured limit {max_packet_bytes}."
                )
            packets.append(
                {
                    "path": packet_name,
                    "bytes": actual_size,
                    "sha256": sha256_file(packet_path),
                    "files": len(group),
                    "payloadBytes": sum(item.record.bytes for item in group),
                }
            )
        return packets


def expected_path_status(selected: Sequence[ManifestRecord], expected: Sequence[str]) -> tuple[list[str], list[str]]:
    present_paths = {record.path for record in selected}
    present = [path for path in expected if path in present_paths]
    missing = [path for path in expected if path not in present_paths]
    return present, missing


def write_root_outputs(
    output_root: Path,
    receipt: dict[str, Any],
    selected_records: Sequence[ManifestRecord],
    manifest_basename: str,
    manifest_bytes: bytes,
) -> None:
    selected_document = {
        "format": "burn-protocol-selected-manifest/1",
        "files": [record.__dict__ for record in selected_records],
    }
    (output_root / "SELECTED_MANIFEST.json").write_bytes(canonical_json_bytes(selected_document))
    (output_root / manifest_basename).write_bytes(manifest_bytes)
    (output_root / "RECOVERY_RECEIPT.json").write_bytes(canonical_json_bytes(receipt))
    lines: list[str] = []
    for path in sorted(output_root.iterdir(), key=lambda candidate: candidate.name):
        if path.is_file() and path.name != "SHA256SUMS":
            lines.append(f"{sha256_file(path)}  {path.name}")
    (output_root / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Exact parent ZIP or handoff ZIP containing it.")
    parser.add_argument("--output", required=True, type=Path, help="Empty output directory to create.")
    parser.add_argument(
        "--contract",
        type=Path,
        default=here / "contracts" / "e04c2-source-intake.contract.json",
        help="Pinned recovery contract JSON.",
    )
    parser.add_argument(
        "--max-packet-bytes",
        type=int,
        default=209_715_200,
        help="Hard packet ceiling. Default: 200 MiB, below the observed 220 MB survival boundary.",
    )
    parser.add_argument(
        "--include-token",
        action="append",
        default=[],
        help="Additional case-insensitive path token. May be repeated.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    contract = load_contract(args.contract.resolve())
    selection = contract.get("selection")
    if not isinstance(selection, dict):
        raise RecoveryError("Contract selection is missing.")
    tokens = [str(token) for token in selection.get("tokens", [])] + list(args.include_token)
    expected_paths = [normalize_member_name(str(path)) for path in selection.get("expectedPaths", [])]
    required_classifications = {
        str(classification): int(minimum)
        for classification, minimum in selection.get("requiredClassifications", {}).items()
    }

    output_root = args.output.resolve()
    if output_root.exists():
        if not output_root.is_dir():
            raise RecoveryError(f"Output path is not a directory: {output_root}")
        if any(output_root.iterdir()):
            raise RecoveryError(f"Output directory is not empty: {output_root}")
    output_root.mkdir(parents=True, exist_ok=True)

    try:
        with tempfile.TemporaryDirectory(prefix="burn-frontier-") as temp_dir:
            parent_path, source_receipt = materialize_parent(args.input, contract, Path(temp_dir))
            with zipfile.ZipFile(parent_path) as parent:
                entries = validate_zip(parent, "parent")
                manifest_matches = basename_matches(entries, contract["parent"]["manifestBasename"])
                if len(manifest_matches) != 1:
                    raise RecoveryError(
                        f"Expected one {contract['parent']['manifestBasename']}, found {len(manifest_matches)}."
                    )
                manifest_entry = manifest_matches[0]
                manifest_info = entries[manifest_entry]
                manifest_bytes = parent.read(manifest_info)
            manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
            expected_records = contract["parent"].get("manifestRecords")
            manifest_label, records = parse_manifest(manifest_bytes, expected_records)
            manifest_uncompressed_bytes = sum(record.bytes for record in records)
            expected_uncompressed_bytes = contract["parent"].get("manifestUncompressedBytes")
            if (
                expected_uncompressed_bytes is not None
                and manifest_uncompressed_bytes != expected_uncompressed_bytes
            ):
                raise RecoveryError(
                    "Manifest total uncompressed bytes: "
                    f"expected {expected_uncompressed_bytes}, got {manifest_uncompressed_bytes}."
                )
            selected = select_records(records, tokens)
            if not selected:
                raise RecoveryError(f"No manifest records matched selection tokens: {tokens}")
            manifest_receipt = {
                "path": manifest_entry,
                "bytes": len(manifest_bytes),
                "sha256": manifest_hash,
                "records": len(records),
                "totalUncompressedBytes": manifest_uncompressed_bytes,
                "recordCollection": manifest_label,
            }
            packets = build_packets(
                parent_path,
                output_root,
                selected,
                contract,
                manifest_receipt,
                args.max_packet_bytes,
            )
            present, missing = expected_path_status(selected, expected_paths)
            counts: dict[str, int] = {}
            for record in selected:
                classification = classify_path(record.path)
                counts[classification] = counts.get(classification, 0) + 1
            missing_classifications = {
                classification: {
                    "required": minimum,
                    "found": counts.get(classification, 0),
                }
                for classification, minimum in sorted(required_classifications.items())
                if counts.get(classification, 0) < minimum
            }
            status = (
                "verified-frontier-evidence"
                if not missing and not missing_classifications
                else "source-required"
            )
            receipt = {
                "format": FORMAT,
                "toolVersion": TOOL_VERSION,
                "status": status,
                "release": contract.get("release"),
                "selection": {
                    "episode": selection.get("episode"),
                    "chapter": selection.get("chapter"),
                    "tokens": tokens,
                    "expectedPathsPresent": present,
                    "expectedPathsMissing": missing,
                    "requiredClassifications": dict(sorted(required_classifications.items())),
                    "missingClassifications": missing_classifications,
                },
                "source": source_receipt,
                "manifest": manifest_receipt,
                "selected": {
                    "files": len(selected),
                    "bytes": sum(record.bytes for record in selected),
                    "counts": dict(sorted(counts.items())),
                },
                "packetLimitBytes": args.max_packet_bytes,
                "packets": packets,
                "authority": {
                    "canonicalText": "exact-source-only",
                    "assetCustody": "manifest-and-byte-verified-only",
                    "inference": "none",
                },
            }
            write_root_outputs(
                output_root,
                receipt,
                selected,
                contract["parent"]["manifestBasename"],
                manifest_bytes,
            )
            print(json.dumps(receipt, indent=2, sort_keys=True))
            return 0 if status == "verified-frontier-evidence" else 3
    except Exception:
        # Never leave apparently complete output after a failed verification.
        if output_root.exists():
            shutil.rmtree(output_root, ignore_errors=True)
        raise


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RecoveryError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
