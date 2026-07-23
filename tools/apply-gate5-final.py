from pathlib import Path
import base64
import subprocess
import zlib

root = Path.cwd()
payload_root = Path('/tmp/gate5-source-payload')
expected = [f'{index:02d}.txt' for index in range(5)]
parts = sorted(payload_root.glob('*.txt'))
if [part.name for part in parts] != expected:
    raise SystemExit(f'Incomplete Gate 5 source payload: {[part.name for part in parts]}')

encoded = ''.join(part.read_text().strip() for part in parts)
patch_path = root / '.gate5-source.patch'
patch_path.write_bytes(zlib.decompress(base64.b64decode(encoded)))
subprocess.run(
    ['git', 'apply', '--whitespace=nowarn', str(patch_path)],
    cwd=root,
    check=True,
)
patch_path.unlink()
print('Applied the Gate 5 Relief Circuit source implementation.')
