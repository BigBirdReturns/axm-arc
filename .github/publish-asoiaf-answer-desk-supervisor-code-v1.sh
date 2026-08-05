#!/usr/bin/env bash
set -euo pipefail

carrier_prefix='.github/asoiaf-answer-desk-supervisor-v1.tar.gz.b64'
patch='.github/finalize-asoiaf-answer-desk-supervisor-v1.py'
workflow_source='.github/workflows/asoiaf-answer-desk-supervisor.yml'
workflow_payload='.github/asoiaf-answer-desk-supervisor.workflow.txt'

for suffix in 00 01 02; do
  test -f "${carrier_prefix}.${suffix}"
done
test -f "$patch"

cat "${carrier_prefix}.00" "${carrier_prefix}.01" "${carrier_prefix}.02" \
  > "$RUNNER_TEMP/supervisor.tar.gz.b64"
test "$(sha256sum "$RUNNER_TEMP/supervisor.tar.gz.b64" | cut -d' ' -f1)" = \
  '721cf63d4ca986efa7237af5980febf5ad28d73c8d9e75a1649a18ea59e80079'
base64 --decode "$RUNNER_TEMP/supervisor.tar.gz.b64" \
  > "$RUNNER_TEMP/supervisor.tar.gz"
test "$(sha256sum "$RUNNER_TEMP/supervisor.tar.gz" | cut -d' ' -f1)" = \
  '5a3d8302fa93b3b234bd038aadf7f924a49f84aba9782483ff8a672944920e1f'

tar -tzf "$RUNNER_TEMP/supervisor.tar.gz" \
  | sed 's#^\./##' \
  | sort \
  > "$RUNNER_TEMP/supervisor-bundle-files.txt"
cat > "$RUNNER_TEMP/supervisor-expected-files.txt" <<'FILES'
.github/workflows/asoiaf-answer-desk-supervisor.yml
docs/ASOIAF_ANSWER_DESK_SUPERVISOR.md
package.json
tests/fixtures/emit-asoiaf-answer-desk-supervisor-input.ts
tests/narrative/canon/asoiaf-answer-desk-supervisor.test.ts
tools/asoiaf-answer-desk-supervisor.ts
tools/lib/asoiaf-answer-desk-supervisor.ts
FILES
sort -o "$RUNNER_TEMP/supervisor-expected-files.txt" \
  "$RUNNER_TEMP/supervisor-expected-files.txt"
diff -u \
  "$RUNNER_TEMP/supervisor-expected-files.txt" \
  "$RUNNER_TEMP/supervisor-bundle-files.txt"

tar -xzf "$RUNNER_TEMP/supervisor.tar.gz"
python "$patch"
test -f "$workflow_source"
cp "$workflow_source" "$workflow_payload"
rm -f "$workflow_source"

for required in \
  docs/ASOIAF_ANSWER_DESK_SUPERVISOR.md \
  package.json \
  tests/fixtures/emit-asoiaf-answer-desk-supervisor-input.ts \
  tests/narrative/canon/asoiaf-answer-desk-supervisor.test.ts \
  tools/asoiaf-answer-desk-supervisor.ts \
  tools/lib/asoiaf-answer-desk-supervisor.ts \
  "$workflow_payload"; do
  test -f "$required"
done

grep -q 'asoiaf:answer-supervisor' package.json
grep -q 'dependencyBlockedItemIds' \
  tools/lib/asoiaf-answer-desk-supervisor.ts
grep -q 'fans out independent external work and waits without over-claiming' \
  tests/narrative/canon/asoiaf-answer-desk-supervisor.test.ts
grep -q 'exposes actor saturation while independent dependency-ready work remains' \
  tests/narrative/canon/asoiaf-answer-desk-supervisor.test.ts
git diff --check

npm ci --no-audit --no-fund
npm run --silent asoiaf:answer-supervisor -- help \
  | tee "$RUNNER_TEMP/supervisor-help.txt"
grep -q 'ASOIAF persistent answer desk supervisor' \
  "$RUNNER_TEMP/supervisor-help.txt"
grep -q 'policy' "$RUNNER_TEMP/supervisor-help.txt"
grep -q 'plan' "$RUNNER_TEMP/supervisor-help.txt"
grep -q 'prepare' "$RUNNER_TEMP/supervisor-help.txt"
grep -q 'tick' "$RUNNER_TEMP/supervisor-help.txt"
grep -q 'verify' "$RUNNER_TEMP/supervisor-help.txt"

npm run typecheck | tee "$RUNNER_TEMP/typecheck.log"
npm test -- \
  tests/narrative/canon/asoiaf-answer-desk-supervisor.test.ts \
  tests/narrative/canon/asoiaf-answer-desk-exchange.test.ts \
  tests/narrative/canon/asoiaf-answer-desk-worker.test.ts \
  tests/narrative/canon/asoiaf-answer-desk-estate.test.ts \
  tests/narrative/canon/asoiaf-answer-work-lease.test.ts \
  tests/narrative/canon/asoiaf-answer-work-order.test.ts \
  tests/narrative/canon/asoiaf-reviewed-answer-packet.test.ts \
  tests/narrative/canon/asoiaf-research-question-dossier.test.ts \
  tests/narrative/canon/asoiaf-external-reconciliation-packets.test.ts \
  | tee "$RUNNER_TEMP/focused-tests.log"
npm test | tee "$RUNNER_TEMP/full-tests.log"
npm run build | tee "$RUNNER_TEMP/build.log"

git ls-files --others --exclude-standard -z \
  | while IFS= read -r -d '' generated; do
      case "$generated" in
        *.js|*.js.map|*.d.ts) rm -f "$generated" ;;
      esac
    done

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add \
  docs/ASOIAF_ANSWER_DESK_SUPERVISOR.md \
  tests/fixtures/emit-asoiaf-answer-desk-supervisor-input.ts \
  tests/narrative/canon/asoiaf-answer-desk-supervisor.test.ts \
  tools/asoiaf-answer-desk-supervisor.ts \
  tools/lib/asoiaf-answer-desk-supervisor.ts \
  "$workflow_payload"

git diff --cached --check
test -n "$(git diff --cached --name-only)"
test -z "$(git diff --cached --name-only | grep '^\.github/workflows/' || true)"
for required in \
  docs/ASOIAF_ANSWER_DESK_SUPERVISOR.md \
  tests/fixtures/emit-asoiaf-answer-desk-supervisor-input.ts \
  tests/narrative/canon/asoiaf-answer-desk-supervisor.test.ts \
  tools/asoiaf-answer-desk-supervisor.ts \
  tools/lib/asoiaf-answer-desk-supervisor.ts \
  "$workflow_payload"; do
  git diff --cached --name-only | grep -Fxq "$required"
done

git commit -m 'Materialize persistent answer desk supervisor'
final_sha="$(git rev-parse HEAD)"
git reset --hard HEAD
git clean -fd
test -z "$(git status --porcelain)"
git push origin HEAD:feature/asoiaf-answer-desk-supervisor-v1
printf '%s\n' "$final_sha" > "$RUNNER_TEMP/supervisor-code-candidate-sha.txt"
