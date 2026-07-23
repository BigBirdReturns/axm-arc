from pathlib import Path
import base64
import hashlib
import subprocess
import tempfile
import zlib

root = Path(__file__).resolve().parents[1]
payload_root = root / "tools/gate5-source-payload"
part_names = [
    "00-0.txt", "00-1.txt", "00-2.txt", "00-3.txt",
    "01.txt", "02.txt", "03.txt", "04.txt",
]
target = payload_root / "00-2.txt"
text = target.read_text().strip()
offset = 1204
if len(text) <= offset:
    raise SystemExit(f"00-2.txt is too short: {len(text)} <= {offset}")
current = text[offset]
if current not in {"p", "P"}:
    raise SystemExit(f"Unexpected character at offset {offset}: {current!r}")
if current == "p":
    text = text[:offset] + "P" + text[offset + 1:]
    target.write_text(text + "\n")

parts = [payload_root / name for name in part_names]
missing = [part.name for part in parts if not part.is_file()]
if missing:
    raise SystemExit(f"Incomplete Gate 5 source payload: {missing}")

encoded = "".join(part.read_text().strip() for part in parts)
encoded_sha = hashlib.sha256(encoded.encode()).hexdigest()
expected_encoded_sha = "f0358973eb09fd4b9f94baf8e10a3f9a5c155c23b0ab804ccc094da05c035848"
if encoded_sha != expected_encoded_sha:
    raise SystemExit(f"Payload digest mismatch: expected {expected_encoded_sha}, got {encoded_sha}")

patch_bytes = zlib.decompress(base64.b64decode(encoded))
patch_sha = hashlib.sha256(patch_bytes).hexdigest()
expected_patch_sha = "2636896141492d7ecc58bc8eca8ecdc98dd2cffd9f30466007c4811423d1f7a9"
if patch_sha != expected_patch_sha:
    raise SystemExit(f"Patch digest mismatch: expected {expected_patch_sha}, got {patch_sha}")

with tempfile.TemporaryDirectory(prefix="gate5-target-") as tmp:
    subprocess.run(["git", "fetch", "origin", "codex/gate5-relief-circuit-prep"], cwd=root, check=True)
    subprocess.run(["git", "worktree", "add", "--detach", tmp, "origin/codex/gate5-relief-circuit-prep"], cwd=root, check=True)
    patch_path = Path(tmp) / ".gate5-source.patch"
    patch_path.write_bytes(patch_bytes)
    subprocess.run(["git", "apply", "--check", "--verbose", str(patch_path)], cwd=tmp, check=True)
    subprocess.run(["git", "worktree", "remove", "--force", tmp], cwd=root, check=True)

segment_sha = hashlib.sha256(target.read_text().strip().encode()).hexdigest()
print(f"Repaired Gate 5 payload at zero-based offset {offset}: {current!r} -> 'P'")
print(f"00-2.txt sha256={segment_sha}")
print(f"encoded sha256={encoded_sha}")
print(f"patch sha256={patch_sha}")
print("git apply --check passed against the exact Gate 5 target branch.")