from __future__ import annotations

import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Iterator

from harvest_common import HarvestError, canonical_json_bytes, sha256_file


def local_candidates(paths: Iterable[Path], directories: Iterable[Path]) -> Iterator[Path]:
    seen: set[Path] = set()
    for path in paths:
        resolved = path.resolve()
        if resolved not in seen:
            seen.add(resolved)
            yield resolved
    for directory in directories:
        root = directory.resolve()
        if not root.is_dir():
            raise HarvestError(f"Candidate directory does not exist: {root}")
        for path in sorted(root.rglob("*.zip")):
            resolved = path.resolve()
            if resolved not in seen:
                seen.add(resolved)
                yield resolved


def normalize_zip_member(name: str) -> str:
    if not name or "\x00" in name or "\\" in name:
        raise HarvestError(f"Unsafe nested ZIP entry name: {name!r}")
    if name.startswith("/") or re.match(r"^[A-Za-z]:", name):
        raise HarvestError(f"Unsafe absolute nested ZIP entry: {name}")
    path = PurePosixPath(name.rstrip("/"))
    if any(part in {"", ".", ".."} for part in path.parts):
        raise HarvestError(f"Unsafe nested ZIP entry: {name}")
    return path.as_posix()


def nested_zip_candidates(
    archive_path: Path,
    temporary_root: Path,
    *,
    identity: str,
    max_depth: int,
    max_entry_bytes: int,
    max_total_bytes: int,
) -> Iterator[tuple[Path, str]]:
    """Extract bounded nested ZIP candidates to generated temporary paths."""

    extracted = 0
    serial = 0

    def walk(path: Path, parent_identity: str, depth: int) -> Iterator[tuple[Path, str]]:
        nonlocal extracted, serial
        if depth >= max_depth:
            return
        try:
            archive = zipfile.ZipFile(path)
        except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile):
            return
        with archive:
            seen: set[str] = set()
            infos: list[tuple[str, zipfile.ZipInfo]] = []
            for info in archive.infolist():
                normalized = normalize_zip_member(info.filename)
                if normalized in seen:
                    raise HarvestError(f"Nested ZIP duplicates entry {normalized}.")
                seen.add(normalized)
                unix_mode = (info.external_attr >> 16) & 0o170000
                if unix_mode == 0o120000:
                    raise HarvestError(f"Nested ZIP contains a symbolic link: {normalized}")
                if info.flag_bits & 0x1:
                    raise HarvestError(f"Nested ZIP contains an encrypted entry: {normalized}")
                if not info.is_dir() and normalized.lower().endswith(".zip"):
                    infos.append((normalized, info))
            for normalized, info in sorted(infos):
                if info.file_size > max_entry_bytes:
                    continue
                if extracted + info.file_size > max_total_bytes:
                    raise HarvestError(f"Nested ZIP extraction exceeded {max_total_bytes} declared bytes.")
                serial += 1
                destination = temporary_root / f"nested-{serial:05d}.zip"
                written = 0
                with archive.open(info, "r") as source, destination.open("wb") as output:
                    while chunk := source.read(1024 * 1024):
                        written += len(chunk)
                        if written > info.file_size or written > max_entry_bytes:
                            destination.unlink(missing_ok=True)
                            raise HarvestError(f"Nested ZIP entry exceeded its declared bound: {normalized}")
                        output.write(chunk)
                if written != info.file_size:
                    destination.unlink(missing_ok=True)
                    raise HarvestError(
                        f"Nested ZIP entry size mismatch for {normalized}: expected {info.file_size}, got {written}."
                    )
                extracted += written
                nested_identity = f"{parent_identity}!{normalized}"
                yield destination, nested_identity
                yield from walk(destination, nested_identity, depth + 1)

    yield from walk(archive_path, identity, 0)


def copy_tree(source: Path, destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(source, destination)


def run_recovery(
    candidate: Path,
    contract: Path,
    recovery_tool: Path,
    temporary_root: Path,
    packet_limit: int,
) -> tuple[int, str, Path]:
    output = temporary_root / "recovery"
    if output.exists():
        shutil.rmtree(output)
    result = subprocess.run(
        [
            sys.executable,
            str(recovery_tool),
            "--input",
            str(candidate),
            "--contract",
            str(contract),
            "--output",
            str(output),
            "--max-packet-bytes",
            str(packet_limit),
        ],
        text=True,
        capture_output=True,
        check=False,
    )
    detail = (result.stderr or result.stdout).strip()
    if len(detail) > 2000:
        detail = detail[-2000:]
    return result.returncode, detail, output


def write_receipt(output: Path, receipt: dict[str, Any]) -> None:
    output.mkdir(parents=True, exist_ok=True)
    (output / "HARVEST_RECEIPT.json").write_bytes(canonical_json_bytes(receipt))
    lines = []
    for path in sorted(output.rglob("*")):
        if path.is_file() and path.name != "SHA256SUMS":
            lines.append(f"{sha256_file(path)}  {path.relative_to(output).as_posix()}")
    (output / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
