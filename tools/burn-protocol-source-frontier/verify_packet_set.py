#!/usr/bin/env python3
"""Verify a recovered Burn frontier packet set without reopening the parent estate.

The verifier checks the recovery receipt, selected manifest, authoritative parent
manifest bytes, every packet envelope, and every packet payload. A packet set is
byte-verifiable on its own, but it acquires transport approval only when its
computed identity matches an externally supplied SHA-256 pin. Source amendment
remains a separate reviewed authority.
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
from typing import Any, Iterable, Iterator, Sequence

TOOL_VERSION = "1.0.0"
RECOVERY_FORMAT = "burn-protocol-source-frontier-recovery/1"
PACKET_FORMAT = "burn-protocol-source-frontier-packet/1"
SELECTED_FORMAT = "burn-protocol-selected-manifest/1"
IDENTITY_FORMAT = "burn-protocol-source-frontier-packet-set-identity/1"
RECEIPT_FORMAT = "burn-protocol-source-frontier-packet-set-verification/1"
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
PATH_KEYS = ("path", "name", "file", "relativePath")
HASH_KEYS = ("sha256", "sha256Hex", "hash", "digest")
BYTE_KEYS = ("bytes", "size", "byteLength", "uncompressedBytes")
TEXT_SUFFIXES = {".json", ".csv", ".md", ".txt", ".jsonl"}
MAX_JSON_BYTES = 64 * 1024 * 1024
MAX_CONTAINER_FILES = 20_000
MAX_CONTAINER_BYTES = 4 * 1024 * 1024 * 1024


class PacketSetError(RuntimeError):
    pass


@dataclass(frozen=True, order=True)
class ManifestRecord:
    path: str
    bytes: int
    sha256: str


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_member_name(name: str) -> str:
    if not isinstance(name, str) or not name or "\x00" in name or "\\" in name:
        raise PacketSetError(f"Unsafe or empty path: {name!r}")
    if name.startswith("/") or re.match(r"^[A-Za-z]:", name):
        raise PacketSetError(f"Absolute path is forbidden: {name}")
    path = PurePosixPath(name)
    if any(part in {"", ".", ".."} for part in path.parts):
        raise PacketSetError(f"Unsafe path is forbidden: {name}")
    return path.as_posix()


def safe_root_basename(name: str) -> str:
    normalized = normalize_member_name(name)
    if "/" in normalized:
        raise PacketSetError(f"Recovery root records must use basenames: {name}")
    return normalized


def json_bytes(path: Path) -> tuple[bytes, Any]:
    if not path.is_file() or path.is_symlink():
        raise PacketSetError(f"Required JSON file is unavailable: {path.name}")
    if path.stat().st_size > MAX_JSON_BYTES:
        raise PacketSetError(f"JSON file exceeds {MAX_JSON_BYTES} bytes: {path.name}")
    data = path.read_bytes()
    try:
        return data, json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PacketSetError(f"Invalid UTF-8 JSON in {path.name}: {exc}") from exc


def normalize_digest(value: Any, label: str) -> str:
    if not isinstance(value, str):
        raise PacketSetError(f"{label} SHA-256 is missing.")
    digest = value.lower().removeprefix("sha256:").strip()
    if not SHA256_RE.fullmatch(digest):
        raise PacketSetError(f"{label} SHA-256 is invalid.")
    return digest


def first_value(record: dict[str, Any], keys: Sequence[str]) -> Any:
    for key in keys:
        if key in record:
            return record[key]
    return None


def parse_record(value: Any, fallback_path: str | None = None) -> ManifestRecord | None:
    if not isinstance(value, dict):
        return None
    path_value = first_value(value, PATH_KEYS) or fallback_path
    hash_value = first_value(value, HASH_KEYS)
    bytes_value = first_value(value, BYTE_KEYS)
    if not isinstance(path_value, str) or not isinstance(hash_value, str):
        return None
    try:
        path = normalize_member_name(path_value)
        byte_count = int(bytes_value)
        digest = normalize_digest(hash_value, path)
    except (PacketSetError, TypeError, ValueError):
        return None
    if byte_count < 0:
        return None
    return ManifestRecord(path, byte_count, digest)


def manifest_candidates(value: Any, label: str = "root", depth: int = 0) -> Iterator[tuple[str, list[ManifestRecord]]]:
    if depth > 8:
        return
    if isinstance(value, list):
        records = [parse_record(item) for item in value]
        if records and all(record is not None for record in records):
            yield label, [record for record in records if record is not None]
        for index, item in enumerate(value):
            if isinstance(item, (dict, list)):
                yield from manifest_candidates(item, f"{label}[{index}]", depth + 1)
    elif isinstance(value, dict):
        mapped = [parse_record(metadata, path) for path, metadata in value.items()]
        if mapped and all(record is not None for record in mapped):
            yield label, [record for record in mapped if record is not None]
        for key, child in value.items():
            if isinstance(child, (dict, list)):
                yield from manifest_candidates(child, f"{label}.{key}", depth + 1)


def parse_authoritative_manifest(data: bytes, expected_records: int | None) -> tuple[str, list[ManifestRecord]]:
    try:
        document = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PacketSetError(f"Authoritative manifest is invalid UTF-8 JSON: {exc}") from exc
    candidates = list(manifest_candidates(document))
    if not candidates:
        raise PacketSetError("No authoritative manifest record collection was found.")
    if expected_records is None:
        target = max(len(records) for _, records in candidates)
    else:
        target = expected_records
    selected = [(label, records) for label, records in candidates if len(records) == target]
    if not selected:
        raise PacketSetError(f"No manifest record collection has {target} records.")
    unique: dict[tuple[tuple[str, int, str], ...], tuple[str, list[ManifestRecord]]] = {}
    for label, records in selected:
        fingerprint = tuple(sorted((record.path, record.bytes, record.sha256) for record in records))
        unique[fingerprint] = (label, records)
    if len(unique) != 1:
        raise PacketSetError("Authoritative manifest record collection is ambiguous.")
    label, records = next(iter(unique.values()))
    if len({record.path for record in records}) != len(records):
        raise PacketSetError("Authoritative manifest duplicates a path.")
    return label, sorted(records)


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


def load_contract(path: Path) -> tuple[bytes, dict[str, Any]]:
    raw, contract = json_bytes(path)
    if not isinstance(contract, dict) or contract.get("format") != "burn-protocol-source-frontier-recovery-contract/1":
        raise PacketSetError("Unsupported packet-set contract format.")
    parent = contract.get("parent")
    selection = contract.get("selection")
    if not isinstance(parent, dict) or not isinstance(selection, dict):
        raise PacketSetError("Contract parent or selection is missing.")
    for key in ("basename", "bytes", "sha256", "manifestBasename"):
        if key not in parent:
            raise PacketSetError(f"Contract parent.{key} is missing.")
    parent["basename"] = safe_root_basename(str(parent["basename"]))
    parent["manifestBasename"] = safe_root_basename(str(parent["manifestBasename"]))
    parent["bytes"] = int(parent["bytes"])
    parent["sha256"] = normalize_digest(parent["sha256"], "contract parent")
    tokens = selection.get("tokens")
    if not isinstance(tokens, list) or not tokens or not all(isinstance(token, str) and token for token in tokens):
        raise PacketSetError("Contract selection tokens are invalid.")
    expected_paths = selection.get("expectedPaths", [])
    if not isinstance(expected_paths, list):
        raise PacketSetError("Contract expectedPaths must be an array.")
    selection["expectedPaths"] = [normalize_member_name(str(path)) for path in expected_paths]
    required = selection.get("requiredClassifications", {})
    if not isinstance(required, dict):
        raise PacketSetError("Contract requiredClassifications must be an object.")
    selection["requiredClassifications"] = {str(key): int(value) for key, value in required.items()}
    if any(value <= 0 for value in selection["requiredClassifications"].values()):
        raise PacketSetError("Required classification minima must be positive.")
    return raw, contract


def validate_zip(zf: zipfile.ZipFile, label: str, *, maximum_bytes: int = MAX_CONTAINER_BYTES) -> dict[str, zipfile.ZipInfo]:
    if len(zf.infolist()) > MAX_CONTAINER_FILES:
        raise PacketSetError(f"{label} contains too many entries.")
    entries: dict[str, zipfile.ZipInfo] = {}
    declared = 0
    for info in zf.infolist():
        name = info.filename.rstrip("/") if info.filename.endswith("/") else info.filename
        normalized = normalize_member_name(name)
        if normalized in entries:
            raise PacketSetError(f"{label} duplicates {normalized}.")
        mode = (info.external_attr >> 16) & 0o170000
        if mode == 0o120000:
            raise PacketSetError(f"{label} contains a symbolic link: {normalized}")
        if info.flag_bits & 0x1:
            raise PacketSetError(f"{label} contains an encrypted entry: {normalized}")
        declared += info.file_size
        if declared > maximum_bytes:
            raise PacketSetError(f"{label} exceeds the bounded declared-byte ceiling.")
        entries[normalized] = info
    bad = zf.testzip()
    if bad is not None:
        raise PacketSetError(f"{label} failed CRC verification at {bad}.")
    return entries


def materialize_input(input_path: Path, temp_root: Path) -> Path:
    input_path = input_path.resolve()
    if input_path.is_dir():
        search_root = input_path
    elif input_path.is_file():
        try:
            with zipfile.ZipFile(input_path) as wrapper:
                entries = validate_zip(wrapper, "packet-set wrapper")
                for name, info in entries.items():
                    target = temp_root / name
                    if info.is_dir():
                        target.mkdir(parents=True, exist_ok=True)
                        continue
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with wrapper.open(info) as source, target.open("wb") as destination:
                        shutil.copyfileobj(source, destination, 1024 * 1024)
        except zipfile.BadZipFile as exc:
            raise PacketSetError(f"Packet-set input is neither a directory nor a valid ZIP: {exc}") from exc
        search_root = temp_root
    else:
        raise PacketSetError(f"Packet-set input does not exist: {input_path}")

    candidates = []
    for receipt in search_root.rglob("RECOVERY_RECEIPT.json"):
        root = receipt.parent
        if (root / "SELECTED_MANIFEST.json").is_file() and (root / "SHA256SUMS").is_file():
            candidates.append(root)
    unique = sorted({candidate.resolve() for candidate in candidates})
    if len(unique) != 1:
        raise PacketSetError(f"Expected exactly one recovery root, found {len(unique)}.")
    root = unique[0]
    for path in root.rglob("*"):
        if path.is_symlink():
            raise PacketSetError(f"Recovery root contains a symbolic link: {path.relative_to(root)}")
    return root


def parse_root_sums(root: Path) -> dict[str, str]:
    sums_path = root / "SHA256SUMS"
    lines = sums_path.read_text(encoding="utf-8").splitlines()
    values: dict[str, str] = {}
    for line in lines:
        parts = line.split("  ", 1)
        if len(parts) != 2:
            raise PacketSetError("SHA256SUMS contains a malformed row.")
        digest = normalize_digest(parts[0], "SHA256SUMS")
        name = safe_root_basename(parts[1])
        if name in values:
            raise PacketSetError(f"SHA256SUMS duplicates {name}.")
        values[name] = digest
    actual = {path.name for path in root.iterdir() if path.is_file() and path.name != "SHA256SUMS"}
    if set(values) != actual:
        raise PacketSetError("SHA256SUMS does not cover the exact recovery-root file set.")
    for name, digest in values.items():
        if sha256_file(root / name) != digest:
            raise PacketSetError(f"Recovery-root SHA-256 mismatch: {name}")
    return values


def require_dict(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise PacketSetError(f"{label} must be an object.")
    return value


def require_list(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        raise PacketSetError(f"{label} must be an array.")
    return value


def verify_stream(handle: Any, record: ManifestRecord, label: str) -> None:
    digest = hashlib.sha256()
    total = 0
    while chunk := handle.read(1024 * 1024):
        total += len(chunk)
        if total > record.bytes:
            raise PacketSetError(f"{label} exceeded its declared byte count.")
        digest.update(chunk)
    if total != record.bytes:
        raise PacketSetError(f"{label} bytes: expected {record.bytes}, got {total}.")
    actual = digest.hexdigest()
    if actual != record.sha256:
        raise PacketSetError(f"{label} SHA-256: expected {record.sha256}, got {actual}.")


def verify_packet_set(root: Path, contract_path: Path, approved_digest: str | None) -> tuple[dict[str, Any], dict[str, Any], int]:
    contract_raw, contract = load_contract(contract_path)
    contract_sha256 = sha256_bytes(contract_raw)
    root_sums = parse_root_sums(root)

    _, receipt = json_bytes(root / "RECOVERY_RECEIPT.json")
    receipt = require_dict(receipt, "RECOVERY_RECEIPT")
    if receipt.get("format") != RECOVERY_FORMAT or receipt.get("status") not in {"verified-frontier-evidence", "source-required"}:
        raise PacketSetError("Recovery receipt format or status is unsupported.")

    parent = contract["parent"]
    receipt_source = require_dict(receipt.get("source"), "recovery source")
    receipt_parent = require_dict(receipt_source.get("parent"), "recovery parent")
    if int(receipt_parent.get("bytes", -1)) != parent["bytes"] or normalize_digest(receipt_parent.get("sha256"), "recovery parent") != parent["sha256"]:
        raise PacketSetError("Recovery receipt identifies a different parent estate.")

    selection = contract["selection"]
    receipt_selection = require_dict(receipt.get("selection"), "recovery selection")
    if int(receipt_selection.get("episode", -1)) != int(selection.get("episode", -1)) or int(receipt_selection.get("chapter", -1)) != int(selection.get("chapter", -1)):
        raise PacketSetError("Recovery receipt identifies a different episode or chapter.")
    receipt_tokens = require_list(receipt_selection.get("tokens"), "recovery selection tokens")
    for token in selection["tokens"]:
        if token not in receipt_tokens:
            raise PacketSetError(f"Recovery selection omits contracted token {token}.")

    manifest_path = root / parent["manifestBasename"]
    manifest_bytes = manifest_path.read_bytes()
    manifest_receipt = require_dict(receipt.get("manifest"), "recovery manifest")
    if len(manifest_bytes) != int(manifest_receipt.get("bytes", -1)) or sha256_bytes(manifest_bytes) != normalize_digest(manifest_receipt.get("sha256"), "recovery manifest"):
        raise PacketSetError("Authoritative manifest bytes do not match the recovery receipt.")
    expected_records = parent.get("manifestRecords")
    expected_records_int = int(expected_records) if expected_records is not None else None
    collection, manifest_records = parse_authoritative_manifest(manifest_bytes, expected_records_int)
    manifest_map = {record.path: record for record in manifest_records}
    total_manifest_bytes = sum(record.bytes for record in manifest_records)
    if int(manifest_receipt.get("records", -1)) != len(manifest_records) or int(manifest_receipt.get("totalUncompressedBytes", -1)) != total_manifest_bytes or manifest_receipt.get("recordCollection") != collection:
        raise PacketSetError("Authoritative manifest structure differs from the recovery receipt.")
    if parent.get("manifestUncompressedBytes") is not None and total_manifest_bytes != int(parent["manifestUncompressedBytes"]):
        raise PacketSetError("Authoritative manifest uncompressed-byte total differs from the contract.")

    selected_bytes, selected_document = json_bytes(root / "SELECTED_MANIFEST.json")
    selected_document = require_dict(selected_document, "SELECTED_MANIFEST")
    if selected_document.get("format") != SELECTED_FORMAT:
        raise PacketSetError("Selected manifest format is unsupported.")
    selected_rows = require_list(selected_document.get("files"), "selected manifest files")
    selected_records = [parse_record(row) for row in selected_rows]
    if any(record is None for record in selected_records):
        raise PacketSetError("Selected manifest contains an invalid record.")
    selected = sorted(record for record in selected_records if record is not None)
    if len({record.path for record in selected}) != len(selected):
        raise PacketSetError("Selected manifest duplicates a path.")
    for record in selected:
        if manifest_map.get(record.path) != record:
            raise PacketSetError(f"Selected record is not exact in the authoritative manifest: {record.path}")
        if not any(str(token).lower() in record.path.lower() for token in receipt_tokens):
            raise PacketSetError(f"Selected path is outside the declared recovery tokens: {record.path}")

    counts: dict[str, int] = {}
    for record in selected:
        classification = classify_path(record.path)
        counts[classification] = counts.get(classification, 0) + 1
    selected_summary = require_dict(receipt.get("selected"), "recovery selected summary")
    if int(selected_summary.get("files", -1)) != len(selected) or int(selected_summary.get("bytes", -1)) != sum(record.bytes for record in selected) or selected_summary.get("counts") != dict(sorted(counts.items())):
        raise PacketSetError("Recovery selected summary differs from verified selected records.")

    expected_paths = selection["expectedPaths"]
    present_paths = {record.path for record in selected}
    present = [path for path in expected_paths if path in present_paths]
    missing = [path for path in expected_paths if path not in present_paths]
    if receipt_selection.get("expectedPathsPresent", []) != present or receipt_selection.get("expectedPathsMissing", []) != missing:
        raise PacketSetError("Recovery expected-path status differs from the contract and selected records.")
    required = selection["requiredClassifications"]
    missing_classifications = {
        classification: {"required": minimum, "found": counts.get(classification, 0)}
        for classification, minimum in sorted(required.items())
        if counts.get(classification, 0) < minimum
    }
    if receipt_selection.get("requiredClassifications") != dict(sorted(required.items())) or receipt_selection.get("missingClassifications") != missing_classifications:
        raise PacketSetError("Recovery classification status differs from the contract and selected records.")
    expected_status = "verified-frontier-evidence" if not missing and not missing_classifications else "source-required"
    if receipt.get("status") != expected_status:
        raise PacketSetError("Recovery status differs from verified contract coverage.")

    packet_rows = require_list(receipt.get("packets"), "recovery packets")
    if not packet_rows:
        raise PacketSetError("Recovery receipt contains no packets.")
    packet_names: set[str] = set()
    seen_payloads: set[str] = set()
    normalized_packet_rows: list[dict[str, Any]] = []
    expected_packet_count = len(packet_rows)

    for receipt_row in packet_rows:
        receipt_row = require_dict(receipt_row, "recovery packet row")
        packet_name = safe_root_basename(str(receipt_row.get("path", "")))
        if packet_name in packet_names:
            raise PacketSetError(f"Recovery receipt duplicates packet {packet_name}.")
        packet_names.add(packet_name)
        packet_path = root / packet_name
        if packet_path.stat().st_size != int(receipt_row.get("bytes", -1)) or root_sums.get(packet_name) != normalize_digest(receipt_row.get("sha256"), packet_name):
            raise PacketSetError(f"Packet root receipt mismatch: {packet_name}")
        try:
            with zipfile.ZipFile(packet_path) as packet:
                entries = validate_zip(packet, packet_name)
                if "PACKET.json" not in entries or entries["PACKET.json"].is_dir():
                    raise PacketSetError(f"{packet_name} has no PACKET.json.")
                packet_document = json.loads(packet.read(entries["PACKET.json"]).decode("utf-8"))
                packet_document = require_dict(packet_document, f"{packet_name} PACKET.json")
                if packet_document.get("format") != PACKET_FORMAT:
                    raise PacketSetError(f"{packet_name} packet format is unsupported.")
                if packet_document.get("release") != receipt.get("release") or int(packet_document.get("episode", -1)) != int(selection.get("episode", -1)) or int(packet_document.get("chapter", -1)) != int(selection.get("chapter", -1)):
                    raise PacketSetError(f"{packet_name} identifies a different frontier.")
                if int(packet_document.get("packets", -1)) != expected_packet_count:
                    raise PacketSetError(f"{packet_name} declares a different packet count.")
                packet_index = int(packet_document.get("packet", -1))
                if not 1 <= packet_index <= expected_packet_count:
                    raise PacketSetError(f"{packet_name} has an invalid packet index.")
                packet_parent = require_dict(packet_document.get("parent"), f"{packet_name} parent")
                if int(packet_parent.get("bytes", -1)) != parent["bytes"] or normalize_digest(packet_parent.get("sha256"), f"{packet_name} parent") != parent["sha256"]:
                    raise PacketSetError(f"{packet_name} identifies a different parent estate.")
                if packet_document.get("manifest") != manifest_receipt:
                    raise PacketSetError(f"{packet_name} identifies a different authoritative manifest.")
                file_rows = require_list(packet_document.get("files"), f"{packet_name} files")
                declared_names = {"PACKET.json"}
                payload_bytes = 0
                for file_row in file_rows:
                    file_row = require_dict(file_row, f"{packet_name} file")
                    record = parse_record(file_row)
                    if record is None or record not in selected or manifest_map.get(record.path) != record:
                        raise PacketSetError(f"{packet_name} contains an undeclared or inexact record.")
                    if file_row.get("classification") != classify_path(record.path):
                        raise PacketSetError(f"{packet_name} classification mismatch for {record.path}.")
                    if record.path in seen_payloads:
                        raise PacketSetError(f"Packet set duplicates payload {record.path}.")
                    seen_payloads.add(record.path)
                    declared_names.add(record.path)
                    info = entries.get(record.path)
                    if info is None or info.is_dir():
                        raise PacketSetError(f"{packet_name} is missing payload {record.path}.")
                    if info.file_size != record.bytes:
                        raise PacketSetError(f"{packet_name} central-directory bytes mismatch for {record.path}.")
                    with packet.open(info) as handle:
                        verify_stream(handle, record, f"{packet_name}:{record.path}")
                    payload_bytes += record.bytes
                if set(entries) != declared_names:
                    raise PacketSetError(f"{packet_name} contains undeclared packet members.")
                if int(receipt_row.get("files", -1)) != len(file_rows) or int(receipt_row.get("payloadBytes", -1)) != payload_bytes:
                    raise PacketSetError(f"{packet_name} receipt counts differ from verified packet contents.")
                normalized_packet_rows.append({
                    "path": packet_name,
                    "bytes": packet_path.stat().st_size,
                    "sha256": sha256_file(packet_path),
                    "files": len(file_rows),
                    "payloadBytes": payload_bytes,
                    "packet": packet_index,
                })
        except (zipfile.BadZipFile, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise PacketSetError(f"Cannot verify packet {packet_name}: {exc}") from exc

    if seen_payloads != {record.path for record in selected}:
        missing_payloads = sorted({record.path for record in selected} - seen_payloads)
        raise PacketSetError(f"Packet set does not cover the selected manifest: {missing_payloads[:5]}")
    indices = sorted(row["packet"] for row in normalized_packet_rows)
    if indices != list(range(1, expected_packet_count + 1)):
        raise PacketSetError("Packet set does not contain each packet index exactly once.")
    normalized_packet_rows.sort(key=lambda row: row["packet"])

    expected_root_files = {
        "RECOVERY_RECEIPT.json",
        "SELECTED_MANIFEST.json",
        "SHA256SUMS",
        parent["manifestBasename"],
        *packet_names,
    }
    actual_root_files = {path.name for path in root.iterdir() if path.is_file()}
    if actual_root_files != expected_root_files:
        raise PacketSetError("Recovery root contains missing or undeclared files.")

    identity = {
        "format": IDENTITY_FORMAT,
        "contract": {"sha256": contract_sha256},
        "parent": {"basename": parent["basename"], "bytes": parent["bytes"], "sha256": parent["sha256"]},
        "manifest": manifest_receipt,
        "selection": {
            "release": receipt.get("release"),
            "episode": selection.get("episode"),
            "chapter": selection.get("chapter"),
            "tokens": receipt_tokens,
            "expectedPaths": expected_paths,
            "requiredClassifications": dict(sorted(required.items())),
        },
        "selectedManifest": {
            "sha256": sha256_bytes(selected_bytes),
            "files": len(selected),
            "bytes": sum(record.bytes for record in selected),
            "counts": dict(sorted(counts.items())),
        },
        "packets": [
            {key: row[key] for key in ("path", "bytes", "sha256", "files", "payloadBytes")}
            for row in normalized_packet_rows
        ],
    }
    packet_set_sha256 = sha256_bytes(canonical_json_bytes(identity))
    normalized_approval = None
    if approved_digest is not None:
        normalized_approval = normalize_digest(approved_digest, "approved packet set")
        if normalized_approval != packet_set_sha256:
            raise PacketSetError(
                f"Approved packet-set SHA-256 is {normalized_approval}, verified set is {packet_set_sha256}."
            )
    standing = "transport-approved" if normalized_approval else "byte-verified-approval-required"
    status = "pass" if normalized_approval else "approval-required"
    exit_code = 0 if normalized_approval else 3
    verification = {
        "format": RECEIPT_FORMAT,
        "toolVersion": TOOL_VERSION,
        "status": status,
        "standing": standing,
        "packetSetSha256": packet_set_sha256,
        "approvedPacketSetSha256": normalized_approval,
        "contractSha256": contract_sha256,
        "recoveryStatus": receipt.get("status"),
        "parent": identity["parent"],
        "manifest": manifest_receipt,
        "selected": identity["selectedManifest"],
        "packets": identity["packets"],
        "authority": {
            "byteVerification": "complete",
            "transportApproval": "external-sha256-pin-required",
            "sourceAmendment": "separate-reviewed-authority-required",
            "canonicalInference": "none",
        },
    }
    return identity, verification, exit_code


def write_outputs(output: Path, identity: dict[str, Any], receipt: dict[str, Any]) -> None:
    output.mkdir(parents=True, exist_ok=True)
    identity_path = output / "PACKET_SET_IDENTITY.json"
    receipt_path = output / "PACKET_SET_VERIFICATION_RECEIPT.json"
    identity_path.write_bytes(canonical_json_bytes(identity))
    receipt_path.write_bytes(canonical_json_bytes(receipt))
    lines = [
        f"{sha256_file(identity_path)}  {identity_path.name}",
        f"{sha256_file(receipt_path)}  {receipt_path.name}",
    ]
    (output / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Recovery directory or ZIP containing one recovery root.")
    parser.add_argument("--output", required=True, type=Path, help="Empty verification output directory to create.")
    parser.add_argument(
        "--contract",
        type=Path,
        default=here / "contracts" / "e05c1-source-intake.contract.json",
        help="Pinned recovery contract.",
    )
    parser.add_argument(
        "--approved-packet-set-sha256",
        help="Externally admitted packet-set identity. Omit to obtain a byte-verified approval-required receipt.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    output = args.output.resolve()
    if output.exists():
        if not output.is_dir():
            raise PacketSetError(f"Output path is not a directory: {output}")
        if any(output.iterdir()):
            raise PacketSetError(f"Output directory is not empty: {output}")
    try:
        with tempfile.TemporaryDirectory(prefix="burn-packet-set-") as temp:
            root = materialize_input(args.input, Path(temp))
            identity, receipt, exit_code = verify_packet_set(root, args.contract.resolve(), args.approved_packet_set_sha256)
            write_outputs(output, identity, receipt)
            print(json.dumps(receipt, indent=2, sort_keys=True))
            return exit_code
    except (PacketSetError, OSError, ValueError) as exc:
        if output.exists():
            shutil.rmtree(output, ignore_errors=True)
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
