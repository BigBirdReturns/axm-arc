import fs from "node:fs";
import path from "node:path";
import {
  buildAsoiafAnswerDeskFixture,
} from "./asoiaf-answer-desk-fixture.js";
import type {
  AsoiafAnswerDeskAdoptInput,
} from "../../tools/lib/asoiaf-answer-desk-estate.js";
import type {
  AsoiafAnswerDeskWorkerRunInput,
} from "../../tools/lib/asoiaf-answer-desk-worker.js";
import type {
  AsoiafAnswerTransportAdmitBody,
  AsoiafAnswerTransportIssueBody,
} from "../../tools/lib/asoiaf-answer-desk-transport.js";
import type {
  AsoiafAnswerWorkAction,
  AsoiafAnswerWorkOrder,
} from "../../tools/lib/asoiaf-answer-work-order.js";

const QUALIFICATION_SHELL = String.raw`set -euo pipefail
fixture_directory="__DOLLAR__RUNNER_TEMP/answer-transport-operations-fixture"
estate_root="__DOLLAR__RUNNER_TEMP/answer-desk"
certificate_directory="__DOLLAR__RUNNER_TEMP/answer-transport-operations-certificates"
port=0
mkdir -p "__DOLLAR__fixture_directory" "__DOLLAR__certificate_directory"

node node_modules/vite-node/vite-node.mjs tests/fixtures/emit-asoiaf-answer-desk-transport-operations-input.ts \
  "__DOLLAR__fixture_directory" \
  "__DOLLAR__estate_root" \
  | tee "__DOLLAR__RUNNER_TEMP/operations-fixture-emission.json"

npm run --silent asoiaf:answer-desk -- adopt \
  --input "__DOLLAR__fixture_directory/adopt-input.json" \
  --out "__DOLLAR__RUNNER_TEMP/adopt-result.json"

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1 \
  -subj '/CN=AXM answer transport operations qualification CA' \
  -keyout "__DOLLAR__certificate_directory/ca.key" \
  -out "__DOLLAR__certificate_directory/ca.crt" \
  >/dev/null 2>&1

cat > "__DOLLAR__certificate_directory/server.ext" <<'EXT'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:127.0.0.1,DNS:localhost
EXT
openssl req -new -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=127.0.0.1' \
  -keyout "__DOLLAR__certificate_directory/server.key" \
  -out "__DOLLAR__certificate_directory/server.csr" \
  >/dev/null 2>&1
openssl x509 -req -sha256 -days 1 \
  -in "__DOLLAR__certificate_directory/server.csr" \
  -CA "__DOLLAR__certificate_directory/ca.crt" \
  -CAkey "__DOLLAR__certificate_directory/ca.key" \
  -CAcreateserial \
  -extfile "__DOLLAR__certificate_directory/server.ext" \
  -out "__DOLLAR__certificate_directory/server.crt" \
  >/dev/null 2>&1

cat > "__DOLLAR__certificate_directory/client.ext" <<'EXT'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth
EXT
for actor in reviewer-v1 reviewer-v2 assembler; do
  openssl req -new -newkey rsa:2048 -nodes -sha256 \
    -subj "/CN=__DOLLAR__{actor}" \
    -keyout "__DOLLAR__certificate_directory/__DOLLAR__{actor}.key" \
    -out "__DOLLAR__certificate_directory/__DOLLAR__{actor}.csr" \
    >/dev/null 2>&1
  openssl x509 -req -sha256 -days 1 \
    -in "__DOLLAR__certificate_directory/__DOLLAR__{actor}.csr" \
    -CA "__DOLLAR__certificate_directory/ca.crt" \
    -CAkey "__DOLLAR__certificate_directory/ca.key" \
    -CAserial "__DOLLAR__certificate_directory/ca.srl" \
    -extfile "__DOLLAR__certificate_directory/client.ext" \
    -out "__DOLLAR__certificate_directory/__DOLLAR__{actor}.crt" \
    >/dev/null 2>&1
done

node - "__DOLLAR__certificate_directory" "__DOLLAR__fixture_directory" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const [certificateDirectory, fixtureDirectory] = process.argv.slice(2);
const read = (name) => fs.readFileSync(path.join(certificateDirectory, name));
const schedule = (name, renewHours, retireHours) => {
  const certificate = new crypto.X509Certificate(read(name));
  const start = certificate.validFromDate.getTime();
  return {
    admittedAt: new Date(start).toISOString(),
    activateAt: new Date(start).toISOString(),
    renewAfter: new Date(start + renewHours * 60 * 60 * 1000).toISOString(),
    retireAfter: new Date(start + retireHours * 60 * 60 * 1000).toISOString(),
  };
};
const schedules = {
  server: schedule('server.crt', 6, 20),
  reviewerV1: schedule('reviewer-v1.crt', 6, 20),
  reviewerV2: schedule('reviewer-v2.crt', 12, 23),
  assembler: schedule('assembler.crt', 6, 20),
};
fs.writeFileSync(path.join(fixtureDirectory, 'certificate-schedules.json'), JSON.stringify(schedules, null, 2) + '\n');
NODE

field() {
  node -e 'const fs=require("node:fs"); const value=process.argv[2].split(".").reduce((x,k)=>x[k],JSON.parse(fs.readFileSync(process.argv[1],"utf8"))); process.stdout.write(String(value));' "__DOLLAR__1" "__DOLLAR__2"
}
schedules="__DOLLAR__fixture_directory/certificate-schedules.json"

npm run --silent asoiaf:answer-transport-operations -- admit-certificate \
  --root "__DOLLAR__estate_root" \
  --usage server-auth \
  --principal-id 'server:qualification:answer-transport-operations' \
  --certificate "__DOLLAR__certificate_directory/server.crt" \
  --issuer-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --admitted-at "__DOLLAR__(field "__DOLLAR__schedules" server.admittedAt)" \
  --activate-at "__DOLLAR__(field "__DOLLAR__schedules" server.activateAt)" \
  --renew-after "__DOLLAR__(field "__DOLLAR__schedules" server.renewAfter)" \
  --retire-after "__DOLLAR__(field "__DOLLAR__schedules" server.retireAfter)" \
  --reason 'The qualification operator admits one bounded server certificate for a pinned endpoint and no task authority.' \
  --operator-id 'qualification:transport-operations-admit-server' \
  --out "__DOLLAR__RUNNER_TEMP/server-admission.json"

npm run --silent asoiaf:answer-transport-operations -- admit-certificate \
  --root "__DOLLAR__estate_root" \
  --usage client-auth \
  --principal-id 'actor:qualification:transport-operations:exact-locator-reviewer' \
  --actor-role exact-locator-reviewer \
  --certificate "__DOLLAR__certificate_directory/reviewer-v1.crt" \
  --issuer-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --admitted-at "__DOLLAR__(field "__DOLLAR__schedules" reviewerV1.admittedAt)" \
  --activate-at "__DOLLAR__(field "__DOLLAR__schedules" reviewerV1.activateAt)" \
  --renew-after "__DOLLAR__(field "__DOLLAR__schedules" reviewerV1.renewAfter)" \
  --retire-after "__DOLLAR__(field "__DOLLAR__schedules" reviewerV1.retireAfter)" \
  --reason 'The qualification operator admits the predecessor reviewer certificate before an explicit overlap and retirement transaction.' \
  --operator-id 'qualification:transport-operations-admit-reviewer-v1' \
  --out "__DOLLAR__RUNNER_TEMP/reviewer-v1-admission.json"
reviewer_v1_fingerprint="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/reviewer-v1-admission.json" admission.certificateFingerprint)"

npm run --silent asoiaf:answer-transport-operations -- admit-certificate \
  --root "__DOLLAR__estate_root" \
  --usage client-auth \
  --principal-id 'actor:qualification:transport-operations:exact-locator-reviewer' \
  --actor-role exact-locator-reviewer \
  --certificate "__DOLLAR__certificate_directory/reviewer-v2.crt" \
  --issuer-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --admitted-at "__DOLLAR__(field "__DOLLAR__schedules" reviewerV2.admittedAt)" \
  --activate-at "__DOLLAR__(field "__DOLLAR__schedules" reviewerV2.activateAt)" \
  --renew-after "__DOLLAR__(field "__DOLLAR__schedules" reviewerV2.renewAfter)" \
  --retire-after "__DOLLAR__(field "__DOLLAR__schedules" reviewerV2.retireAfter)" \
  --predecessor-fingerprint "__DOLLAR__reviewer_v1_fingerprint" \
  --reason 'The qualification operator admits the exact overlapping reviewer successor before retiring the predecessor.' \
  --operator-id 'qualification:transport-operations-admit-reviewer-v2' \
  --out "__DOLLAR__RUNNER_TEMP/reviewer-v2-admission.json"
npm run --silent asoiaf:answer-transport-operations -- admit-certificate \
  --root "__DOLLAR__estate_root" \
  --usage client-auth \
  --principal-id 'actor:qualification:transport-operations:exact-locator-reviewer' \
  --actor-role exact-locator-reviewer \
  --certificate "__DOLLAR__certificate_directory/reviewer-v2.crt" \
  --issuer-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --admitted-at "__DOLLAR__(field "__DOLLAR__schedules" reviewerV2.admittedAt)" \
  --activate-at "__DOLLAR__(field "__DOLLAR__schedules" reviewerV2.activateAt)" \
  --renew-after "__DOLLAR__(field "__DOLLAR__schedules" reviewerV2.renewAfter)" \
  --retire-after "__DOLLAR__(field "__DOLLAR__schedules" reviewerV2.retireAfter)" \
  --predecessor-fingerprint "__DOLLAR__reviewer_v1_fingerprint" \
  --reason 'The qualification operator admits the exact overlapping reviewer successor before retiring the predecessor.' \
  --operator-id 'qualification:transport-operations-admit-reviewer-v2' \
  --out "__DOLLAR__RUNNER_TEMP/reviewer-v2-admission-replay.json"

npm run --silent asoiaf:answer-transport-operations -- admit-certificate \
  --root "__DOLLAR__estate_root" \
  --usage client-auth \
  --principal-id 'actor:qualification:transport-operations:answer-assembler' \
  --actor-role answer-assembler \
  --certificate "__DOLLAR__certificate_directory/assembler.crt" \
  --issuer-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --admitted-at "__DOLLAR__(field "__DOLLAR__schedules" assembler.admittedAt)" \
  --activate-at "__DOLLAR__(field "__DOLLAR__schedules" assembler.activateAt)" \
  --renew-after "__DOLLAR__(field "__DOLLAR__schedules" assembler.renewAfter)" \
  --retire-after "__DOLLAR__(field "__DOLLAR__schedules" assembler.retireAfter)" \
  --reason 'The qualification operator admits the answer assembler certificate for the separate close-gap transition.' \
  --operator-id 'qualification:transport-operations-admit-assembler' \
  --out "__DOLLAR__RUNNER_TEMP/assembler-admission.json"

retired_at="__DOLLAR__(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- retire-certificate \
  --root "__DOLLAR__estate_root" \
  --fingerprint "__DOLLAR__reviewer_v1_fingerprint" \
  --retired-at "__DOLLAR__retired_at" \
  --kind emergency \
  --reason 'The predecessor reviewer certificate is withdrawn after its admitted successor is present; later work must use the successor fingerprint.' \
  --operator-id 'qualification:transport-operations-retire-reviewer-v1' \
  --out "__DOLLAR__RUNNER_TEMP/reviewer-v1-retirement.json"

node node_modules/vite-node/vite-node.mjs tools/asoiaf-answer-desk-transport.ts serve \
  --root "__DOLLAR__estate_root" \
  --host 127.0.0.1 \
  --port "__DOLLAR__port" \
  --server-certificate "__DOLLAR__certificate_directory/server.crt" \
  --server-key "__DOLLAR__certificate_directory/server.key" \
  --client-ca-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --operator-id 'qualification:transport-operations-server' \
  > "__DOLLAR__RUNNER_TEMP/transport-operations-server.stdout" \
  2> "__DOLLAR__RUNNER_TEMP/transport-operations-server.stderr" &
server_pid=__DOLLAR__!
cleanup() {
  kill "__DOLLAR__server_pid" 2>/dev/null || true
  wait "__DOLLAR__server_pid" 2>/dev/null || true
}
trap cleanup EXIT
ready=false
for _ in __DOLLAR__(seq 1 120); do
  if grep -q '"mutualTlsRequired": true' "__DOLLAR__RUNNER_TEMP/transport-operations-server.stdout" 2>/dev/null; then
    ready=true
    break
  fi
  if ! kill -0 "__DOLLAR__server_pid" 2>/dev/null; then
    cat "__DOLLAR__RUNNER_TEMP/transport-operations-server.stderr" >&2 || true
    exit 1
  fi
  sleep 0.25
done
test "__DOLLAR__ready" = true
port="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/transport-operations-server.stdout" port)"
base_url="https://127.0.0.1:__DOLLAR__{port}"

server_fingerprint="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/server-admission.json" admission.certificateFingerprint)"
client_ca_fingerprint="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/reviewer-v2-admission.json" admission.issuerCertificateFingerprint)"
advertised_at="__DOLLAR__(field "__DOLLAR__schedules" server.activateAt)"
npm run --silent asoiaf:answer-transport-operations -- advertise \
  --root "__DOLLAR__estate_root" \
  --server-id 'server:qualification:answer-transport-operations' \
  --url "__DOLLAR__base_url" \
  --network-scope loopback \
  --priority 10 \
  --server-certificate-fingerprint "__DOLLAR__server_fingerprint" \
  --accepted-client-ca-fingerprint "__DOLLAR__client_ca_fingerprint" \
  --advertised-at "__DOLLAR__advertised_at" \
  --available-from "__DOLLAR__(field "__DOLLAR__schedules" server.activateAt)" \
  --expires-at "__DOLLAR__(field "__DOLLAR__schedules" server.retireAfter)" \
  --operator-id 'qualification:transport-operations-advertise' \
  --out "__DOLLAR__RUNNER_TEMP/endpoint-advertisement.json"
endpoint_id="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/endpoint-advertisement.json" endpoint.endpointLeaseId)"
reviewer_v2_fingerprint="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/reviewer-v2-admission.json" admission.certificateFingerprint)"
assembler_fingerprint="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/assembler-admission.json" admission.certificateFingerprint)"

if npm run --silent asoiaf:answer-transport-operations -- resolve \
  --root "__DOLLAR__estate_root" \
  --server-id 'server:qualification:answer-transport-operations' \
  --client-certificate-fingerprint "__DOLLAR__reviewer_v1_fingerprint" \
  --generated-at "__DOLLAR__(node -e 'process.stdout.write(new Date().toISOString())')" \
  --max-observation-age-ms 300000 \
  --operator-id 'qualification:transport-operations-retired-resolve' \
  --out "__DOLLAR__RUNNER_TEMP/retired-rendezvous.json" \
  > "__DOLLAR__RUNNER_TEMP/retired-rendezvous.stdout" \
  2> "__DOLLAR__RUNNER_TEMP/retired-rendezvous.stderr"; then
  echo 'retired reviewer certificate produced a rendezvous' >&2
  exit 1
fi

for actor in reviewer-v2 assembler; do
  observed_at="__DOLLAR__(node -e 'process.stdout.write(new Date().toISOString())')"
  npm run --silent asoiaf:answer-transport-operations -- probe \
    --root "__DOLLAR__estate_root" \
    --endpoint-id "__DOLLAR__endpoint_id" \
    --client-certificate "__DOLLAR__certificate_directory/__DOLLAR__{actor}.crt" \
    --client-key "__DOLLAR__certificate_directory/__DOLLAR__{actor}.key" \
    --server-ca-certificate "__DOLLAR__certificate_directory/ca.crt" \
    --observed-at "__DOLLAR__observed_at" \
    --timeout-ms 10000 \
    --out "__DOLLAR__RUNNER_TEMP/__DOLLAR__{actor}-probe.json"
done

review_probe_completed="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/reviewer-v2-probe.json" observation.completedAt)"
assembler_probe_completed="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/assembler-probe.json" observation.completedAt)"
npm run --silent asoiaf:answer-transport-operations -- resolve \
  --root "__DOLLAR__estate_root" \
  --server-id 'server:qualification:answer-transport-operations' \
  --client-certificate-fingerprint "__DOLLAR__reviewer_v2_fingerprint" \
  --generated-at "__DOLLAR__review_probe_completed" \
  --max-observation-age-ms 300000 \
  --operator-id 'qualification:transport-operations-resolve-reviewer' \
  --out "__DOLLAR__RUNNER_TEMP/reviewer-rendezvous.json"
npm run --silent asoiaf:answer-transport-operations -- resolve \
  --root "__DOLLAR__estate_root" \
  --server-id 'server:qualification:answer-transport-operations' \
  --client-certificate-fingerprint "__DOLLAR__assembler_fingerprint" \
  --generated-at "__DOLLAR__assembler_probe_completed" \
  --max-observation-age-ms 300000 \
  --operator-id 'qualification:transport-operations-resolve-assembler' \
  --out "__DOLLAR__RUNNER_TEMP/assembler-rendezvous.json"
review_rendezvous_id="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/reviewer-rendezvous.json" rendezvous.rendezvousId)"
assembler_rendezvous_id="__DOLLAR__(field "__DOLLAR__RUNNER_TEMP/assembler-rendezvous.json" rendezvous.rendezvousId)"

review_dispatched_at="__DOLLAR__(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- issue \
  --root "__DOLLAR__estate_root" \
  --rendezvous-id "__DOLLAR__review_rendezvous_id" \
  --input "__DOLLAR__fixture_directory/review-issue-body.json" \
  --idempotency-key 'qualification-operations-review-issue-0001' \
  --client-certificate "__DOLLAR__certificate_directory/reviewer-v2.crt" \
  --client-key "__DOLLAR__certificate_directory/reviewer-v2.key" \
  --server-ca-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --dispatched-at "__DOLLAR__review_dispatched_at" \
  --out "__DOLLAR__RUNNER_TEMP/review-issue-first.json"
node - "__DOLLAR__fixture_directory" "__DOLLAR__RUNNER_TEMP/review-issue-first.json" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [fixtureDirectory, issuePath] = process.argv.slice(2);
const template = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'review-result-template.json'), 'utf8'));
const issue = JSON.parse(fs.readFileSync(issuePath, 'utf8'));
template.assignmentId = issue.receipt.envelope.response.payload.assignment.assignmentId;
fs.writeFileSync(path.join(fixtureDirectory, 'review-result-body.json'), JSON.stringify(template, null, 2) + '\n');
NODE
review_admit_dispatched_at="__DOLLAR__(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- admit \
  --root "__DOLLAR__estate_root" \
  --rendezvous-id "__DOLLAR__review_rendezvous_id" \
  --input "__DOLLAR__fixture_directory/review-result-body.json" \
  --idempotency-key 'qualification-operations-review-admit-0001' \
  --client-certificate "__DOLLAR__certificate_directory/reviewer-v2.crt" \
  --client-key "__DOLLAR__certificate_directory/reviewer-v2.key" \
  --server-ca-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --dispatched-at "__DOLLAR__review_admit_dispatched_at" \
  --out "__DOLLAR__RUNNER_TEMP/review-admit-first.json"

close_dispatched_at="__DOLLAR__(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- issue \
  --root "__DOLLAR__estate_root" \
  --rendezvous-id "__DOLLAR__assembler_rendezvous_id" \
  --input "__DOLLAR__fixture_directory/close-issue-body.json" \
  --idempotency-key 'qualification-operations-close-issue-0001' \
  --client-certificate "__DOLLAR__certificate_directory/assembler.crt" \
  --client-key "__DOLLAR__certificate_directory/assembler.key" \
  --server-ca-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --dispatched-at "__DOLLAR__close_dispatched_at" \
  --out "__DOLLAR__RUNNER_TEMP/close-issue-first.json"
node - "__DOLLAR__fixture_directory" "__DOLLAR__RUNNER_TEMP/close-issue-first.json" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [fixtureDirectory, issuePath] = process.argv.slice(2);
const template = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'close-result-template.json'), 'utf8'));
const issue = JSON.parse(fs.readFileSync(issuePath, 'utf8'));
template.assignmentId = issue.receipt.envelope.response.payload.assignment.assignmentId;
fs.writeFileSync(path.join(fixtureDirectory, 'close-result-body.json'), JSON.stringify(template, null, 2) + '\n');
NODE
close_admit_dispatched_at="__DOLLAR__(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- admit \
  --root "__DOLLAR__estate_root" \
  --rendezvous-id "__DOLLAR__assembler_rendezvous_id" \
  --input "__DOLLAR__fixture_directory/close-result-body.json" \
  --idempotency-key 'qualification-operations-close-admit-0001' \
  --client-certificate "__DOLLAR__certificate_directory/assembler.crt" \
  --client-key "__DOLLAR__certificate_directory/assembler.key" \
  --server-ca-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --dispatched-at "__DOLLAR__close_admit_dispatched_at" \
  --out "__DOLLAR__RUNNER_TEMP/close-admit-first.json"

kill "__DOLLAR__server_pid"
wait "__DOLLAR__server_pid"
trap - EXIT

npm run --silent asoiaf:answer-transport-operations -- issue \
  --root "__DOLLAR__estate_root" \
  --rendezvous-id "__DOLLAR__review_rendezvous_id" \
  --input "__DOLLAR__fixture_directory/review-issue-body.json" \
  --idempotency-key 'qualification-operations-review-issue-0001' \
  --client-certificate "__DOLLAR__certificate_directory/reviewer-v2.crt" \
  --client-key "__DOLLAR__certificate_directory/reviewer-v2.key" \
  --server-ca-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --dispatched-at "__DOLLAR__review_dispatched_at" \
  --out "__DOLLAR__RUNNER_TEMP/review-issue-replay.json"
npm run --silent asoiaf:answer-transport-operations -- admit \
  --root "__DOLLAR__estate_root" \
  --rendezvous-id "__DOLLAR__assembler_rendezvous_id" \
  --input "__DOLLAR__fixture_directory/close-result-body.json" \
  --idempotency-key 'qualification-operations-close-admit-0001' \
  --client-certificate "__DOLLAR__certificate_directory/assembler.crt" \
  --client-key "__DOLLAR__certificate_directory/assembler.key" \
  --server-ca-certificate "__DOLLAR__certificate_directory/ca.crt" \
  --dispatched-at "__DOLLAR__close_admit_dispatched_at" \
  --out "__DOLLAR__RUNNER_TEMP/close-admit-replay.json"

npm run --silent asoiaf:answer-worker -- run \
  --input "__DOLLAR__fixture_directory/render-run-input.json" \
  --out "__DOLLAR__RUNNER_TEMP/render-run-first.json"
npm run --silent asoiaf:answer-worker -- run \
  --input "__DOLLAR__fixture_directory/render-run-input.json" \
  --out "__DOLLAR__RUNNER_TEMP/render-run-replay.json"

npm run --silent asoiaf:answer-transport-operations -- status --root "__DOLLAR__estate_root" --out "__DOLLAR__RUNNER_TEMP/operations-status.json"
npm run --silent asoiaf:answer-transport-operations -- verify --root "__DOLLAR__estate_root" --out "__DOLLAR__RUNNER_TEMP/operations-verification.json"
npm run --silent asoiaf:answer-transport -- status --root "__DOLLAR__estate_root" --out "__DOLLAR__RUNNER_TEMP/transport-status.json"
npm run --silent asoiaf:answer-exchange -- status --root "__DOLLAR__estate_root" --out "__DOLLAR__RUNNER_TEMP/exchange-status.json"
npm run --silent asoiaf:answer-worker -- status --root "__DOLLAR__estate_root" --out "__DOLLAR__RUNNER_TEMP/worker-status.json"
npm run --silent asoiaf:answer-desk -- status --root "__DOLLAR__estate_root" > "__DOLLAR__RUNNER_TEMP/desk-status.json"

node - "__DOLLAR__RUNNER_TEMP" "__DOLLAR__fixture_directory" <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const [temp, fixtureDirectory] = process.argv.slice(2);
const read = (name) => JSON.parse(fs.readFileSync(path.join(temp, name), 'utf8'));
const expected = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'expected.json'), 'utf8'));
const reviewerV1 = read('reviewer-v1-admission.json');
const reviewerV2 = read('reviewer-v2-admission.json');
const reviewerV2Replay = read('reviewer-v2-admission-replay.json');
const retirement = read('reviewer-v1-retirement.json');
const serverAdmission = read('server-admission.json');
const assemblerAdmission = read('assembler-admission.json');
const endpoint = read('endpoint-advertisement.json');
const reviewerProbe = read('reviewer-v2-probe.json');
const assemblerProbe = read('assembler-probe.json');
const reviewerRendezvous = read('reviewer-rendezvous.json');
const assemblerRendezvous = read('assembler-rendezvous.json');
const reviewIssue = read('review-issue-first.json');
const reviewIssueReplay = read('review-issue-replay.json');
const reviewAdmit = read('review-admit-first.json');
const closeIssue = read('close-issue-first.json');
const closeAdmit = read('close-admit-first.json');
const closeAdmitReplay = read('close-admit-replay.json');
const render = read('render-run-first.json');
const renderReplay = read('render-run-replay.json');
const operations = read('operations-status.json');
const operationsVerification = read('operations-verification.json');
const transport = read('transport-status.json');
const exchange = read('exchange-status.json');
const worker = read('worker-status.json');
const desk = read('desk-status.json');

assert.equal(reviewerV1.admission.usage, 'client-auth');
assert.equal(reviewerV2.admission.predecessorCertificateFingerprint, reviewerV1.admission.certificateFingerprint);
assert.equal(reviewerV2Replay.admissionReplayed, true);
assert.equal(reviewerV2Replay.transportRegistrationReplayed, true);
assert.equal(retirement.retirement.kind, 'emergency');
assert.equal(retirement.transportRevocation.registrationId, reviewerV1.transportRegistration.registrationId);
assert.equal(serverAdmission.admission.usage, 'server-auth');
assert.equal(assemblerAdmission.admission.actorRole, 'answer-assembler');
assert.equal(endpoint.endpoint.serverCertificateFingerprint, serverAdmission.admission.certificateFingerprint);
assert.equal(reviewerProbe.observation.outcome, 'available');
assert.equal(assemblerProbe.observation.outcome, 'available');
assert.equal(reviewerRendezvous.rendezvous.selectedEndpointLeaseId, endpoint.endpoint.endpointLeaseId);
assert.equal(assemblerRendezvous.rendezvous.selectedEndpointLeaseId, endpoint.endpoint.endpointLeaseId);
assert.equal(reviewerRendezvous.rendezvous.automaticFailover, false);

for (const result of [reviewIssue, reviewAdmit, closeIssue, closeAdmit]) {
  assert.equal(result.ok, true);
  assert.equal(result.receipt.statusCode, 200);
  assert.equal(result.networkAttempted, true);
  assert.equal(result.receipt.authority, 'none');
  assert.equal(result.receipt.certificateRetained, false);
  assert.equal(result.receipt.privateKeyRetained, false);
}
assert.equal(reviewIssue.receipt.envelope.response.payload.assignment.itemId, expected.reviewItemId);
assert.equal(reviewIssue.receipt.clientCertificateFingerprint, reviewerV2.admission.certificateFingerprint);
assert.equal(reviewAdmit.receipt.envelope.response.payload.result.afterWorkOrderId, expected.reconciledWorkOrderId);
assert.equal(closeIssue.receipt.envelope.response.payload.assignment.itemId, expected.closeItemId);
assert.equal(closeAdmit.receipt.envelope.response.payload.result.afterWorkOrderId, expected.readyWorkOrderId);
assert.equal(reviewIssueReplay.replayed, true);
assert.equal(reviewIssueReplay.networkAttempted, false);
assert.deepEqual(reviewIssueReplay.receipt, reviewIssue.receipt);
assert.equal(closeAdmitReplay.replayed, true);
assert.equal(closeAdmitReplay.networkAttempted, false);
assert.deepEqual(closeAdmitReplay.receipt, closeAdmit.receipt);

assert.equal(render.claim.replayed, false);
assert.equal(render.result.outcome, 'rendered');
assert.equal(renderReplay.claim.replayed, true);
assert.equal(renderReplay.invocationReplayed, true);
assert.equal(renderReplay.resultReplayed, true);
assert.equal(renderReplay.settlement.replayed, true);

assert.equal(operations.ok, true);
assert.equal(operations.counts.certificates, 4);
assert.equal(operations.counts.clientCertificates, 3);
assert.equal(operations.counts.serverCertificates, 1);
assert.equal(operations.counts.retirements, 1);
assert.equal(operations.counts.endpoints, 1);
assert.equal(operations.counts.availabilityObservations, 2);
assert.equal(operations.counts.availableObservations, 2);
assert.equal(operations.counts.rendezvous, 2);
assert.equal(operations.counts.selectedRendezvous, 2);
assert.equal(operations.counts.dispatches, 4);
assert.equal(operationsVerification.ok, true);
assert.equal(operationsVerification.counts.errors, 0);
assert.equal(operationsVerification.counts.warnings, 0);
assert.equal(transport.ok, true);
assert.equal(transport.counts.registrations, 3);
assert.equal(transport.counts.activeRegistrations, 2);
assert.equal(transport.counts.revocations, 1);
assert.equal(transport.counts.requests, 4);
assert.equal(transport.counts.responses, 4);
assert.equal(exchange.ok, true);
assert.equal(exchange.counts.assignments, 2);
assert.equal(exchange.counts.results, 2);
assert.equal(exchange.counts.automaticAvailable, 0);
assert.equal(exchange.counts.externalAvailable, 0);
assert.equal(worker.ok, true);
assert.equal(worker.counts.invocations, 1);
assert.equal(worker.counts.results, 1);
assert.equal(desk.ok, true);
assert.equal(desk.counts.workOrders, 3);
assert.equal(desk.counts.leases, 3);
assert.equal(desk.counts.settlements, 3);
assert.deepEqual(desk.state.availableItemIds, []);
assert.equal(desk.state.nextAvailableItemId, null);
assert.equal(fs.existsSync(path.join(expected.estateRoot, '.transaction-lock')), false);
NODE
`.replaceAll("__DOLLAR__", "$");

if (process.argv[2] === "--emit-qualification-shell") {
  const target = process.argv[3];
  if (!target) throw new Error("qualification shell target is required");
  const resolvedTarget = path.resolve(target);
  fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
  fs.writeFileSync(resolvedTarget, QUALIFICATION_SHELL, { encoding: "utf8", mode: 0o700 });
  process.stdout.write(`${JSON.stringify({ ok: true, target: resolvedTarget }, null, 2)}\n`);
  process.exit(0);
}

const OUTPUT_DIRECTORY = process.argv[2];
const ESTATE_ROOT = process.argv[3];
if (!OUTPUT_DIRECTORY || !ESTATE_ROOT) {
  throw new Error("output directory and estate root arguments are required");
}

function itemId(workOrder: AsoiafAnswerWorkOrder, action: AsoiafAnswerWorkAction): string {
  const item = workOrder.items.find((entry) => entry.action === action);
  if (!item) throw new Error(`transport operations fixture work order lacks ${action}`);
  return item.itemId;
}

const outputDirectory = path.resolve(OUTPUT_DIRECTORY);
const estateRoot = path.resolve(ESTATE_ROOT);
const fixture = buildAsoiafAnswerDeskFixture();
const now = Date.now();
const adoptInput: AsoiafAnswerDeskAdoptInput = {
  root: estateRoot,
  workOrder: fixture.openWorkOrder,
  adoptedAt: new Date(now).toISOString(),
  operatorId: "qualification:answer-transport-operations-adopt",
};
const reviewIssueBody: AsoiafAnswerTransportIssueBody = {
  itemId: itemId(fixture.openWorkOrder, "review-exact-locator"),
  claimedAt: new Date(now + 1).toISOString(),
  issuedAt: new Date(now + 2).toISOString(),
  leaseMilliseconds: 600_000,
};
const reviewResultTemplate: AsoiafAnswerTransportAdmitBody = {
  assignmentId: "__REVIEW_ASSIGNMENT_ID__",
  completedAt: new Date(now + 3).toISOString(),
  outcome: "satisfied",
  afterWorkOrder: fixture.reconciledWorkOrder,
  resultReferences: [{
    kind: "reviewed-answer-transaction",
    objectId: fixture.transaction.transactionId,
    fingerprint: fixture.transaction.transactionFingerprint,
    uri: null,
  }],
  reason:
    "The rotated authenticated reviewer returned the exact content-addressed transaction that proves the stable locator-review item satisfied.",
};
const closeIssueBody: AsoiafAnswerTransportIssueBody = {
  itemId: itemId(fixture.reconciledWorkOrder, "close-gap"),
  claimedAt: new Date(now + 4).toISOString(),
  issuedAt: new Date(now + 5).toISOString(),
  leaseMilliseconds: 600_000,
};
const closeResultTemplate: AsoiafAnswerTransportAdmitBody = {
  assignmentId: "__CLOSE_ASSIGNMENT_ID__",
  completedAt: new Date(now + 6).toISOString(),
  outcome: "satisfied",
  afterWorkOrder: fixture.readyWorkOrder,
  resultReferences: [{
    kind: "reviewed-answer-packet",
    objectId: fixture.answerPacket.answerPacketId,
    fingerprint: fixture.answerPacket.answerPacketFingerprint,
    uri: null,
  }],
  reason:
    "The separately authenticated answer assembler returned the exact reviewed packet that closes the immutable gap and proves the stable close item satisfied.",
};
const renderRunInput: AsoiafAnswerDeskWorkerRunInput = {
  root: estateRoot,
  itemId: itemId(fixture.readyWorkOrder, "render-reviewed-answer"),
  claimedAt: new Date(now + 7).toISOString(),
  requestedAt: new Date(now + 8).toISOString(),
  completedAt: new Date(now + 9).toISOString(),
  leaseMilliseconds: 60_000,
  operatorId: "qualification:answer-transport-operations-render",
};
const expected = {
  estateRoot,
  openWorkOrderId: fixture.openWorkOrder.workOrderId,
  reconciledWorkOrderId: fixture.reconciledWorkOrder.workOrderId,
  readyWorkOrderId: fixture.readyWorkOrder.workOrderId,
  reviewItemId: reviewIssueBody.itemId,
  closeItemId: closeIssueBody.itemId,
  renderItemId: renderRunInput.itemId,
  renderedTextDigest: fixture.answerPacket.renderedTextDigest,
  renderedTextCharacters: fixture.answerPacket.renderedTextCharacters,
};

fs.mkdirSync(outputDirectory, { recursive: true });
for (const [name, value] of [
  ["adopt-input.json", adoptInput],
  ["review-issue-body.json", reviewIssueBody],
  ["review-result-template.json", reviewResultTemplate],
  ["close-issue-body.json", closeIssueBody],
  ["close-result-template.json", closeResultTemplate],
  ["render-run-input.json", renderRunInput],
  ["expected.json", expected],
] as const) {
  fs.writeFileSync(path.join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  outputDirectory,
  estateRoot,
  reviewItemId: expected.reviewItemId,
  closeItemId: expected.closeItemId,
  renderItemId: expected.renderItemId,
}, null, 2)}\n`);
