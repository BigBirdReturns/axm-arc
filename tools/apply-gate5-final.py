from pathlib import Path
import base64
import hashlib
import subprocess
import zlib

root = Path.cwd()
payload_root = Path('/tmp/gate5-source-payload')
expected = [f'{index:02d}.txt' for index in range(5)]
parts = sorted(payload_root.glob('*.txt'))
if [part.name for part in parts] != expected:
    raise SystemExit(f'Incomplete Gate 5 source payload: {[part.name for part in parts]}')

encoded = ''.join(part.read_text().strip() for part in parts)
encoded_sha = hashlib.sha256(encoded.encode()).hexdigest()
print(f'Gate 5 payload chars={len(encoded)} sha256={encoded_sha}')
expected_sha = 'f0358973eb09fd4b9f94baf8e10a3f9a5c155c23b0ab804ccc094da05c035848'
if encoded_sha != expected_sha:
    raise SystemExit(f'Gate 5 payload digest mismatch: expected {expected_sha}, got {encoded_sha}')

patch_bytes = zlib.decompress(base64.b64decode(encoded))
patch_sha = hashlib.sha256(patch_bytes).hexdigest()
print(f'Gate 5 patch bytes={len(patch_bytes)} sha256={patch_sha}')
expected_patch_sha = '2636896141492d7ecc58bc8eca8ecdc98dd2cffd9f30466007c4811423d1f7a9'
if patch_sha != expected_patch_sha:
    raise SystemExit(f'Gate 5 patch digest mismatch: expected {expected_patch_sha}, got {patch_sha}')

patch_path = root / '.gate5-source.patch'
patch_path.write_bytes(patch_bytes)
check = subprocess.run(
    ['git', 'apply', '--check', '--verbose', str(patch_path)],
    cwd=root,
    text=True,
    capture_output=True,
)
print(check.stdout)
print(check.stderr)
if check.returncode != 0:
    raise SystemExit(f'Gate 5 patch check failed with status {check.returncode}')
subprocess.run(
    ['git', 'apply', '--whitespace=nowarn', str(patch_path)],
    cwd=root,
    check=True,
)
patch_path.unlink()
print('Applied the Gate 5 Relief Circuit source implementation.')
