import fs from "node:fs";
import path from "node:path";
import {
  buildAsoiafAnswerDeskFixture,
} from "./asoiaf-answer-desk-fixture.js";
import {
  buildAsoiafAnswerSupervisorPolicy,
} from "../../tools/lib/asoiaf-answer-desk-supervisor.js";
import type {
  AsoiafAnswerDeskAdoptInput,
} from "../../tools/lib/asoiaf-answer-desk-estate.js";
import type {
  AsoiafAnswerTransportAdmitBody,
} from "../../tools/lib/asoiaf-answer-desk-transport.js";
import type {
  AsoiafAnswerWorkAction,
  AsoiafAnswerWorkOrder,
} from "../../tools/lib/asoiaf-answer-work-order.js";

const QUALIFICATION_SHELL = String.raw`set -euo pipefail
fixture_directory="$RUNNER_TEMP/answer-remote-supervisor-fixture"
estate_root="$RUNNER_TEMP/answer-desk"
certificate_directory="$RUNNER_TEMP/answer-remote-supervisor-certificates"
secret_input_directory="$RUNNER_TEMP/answer-remote-supervisor-secret-inputs"
port="$(node -e "const net=require('node:net'); const server=net.createServer(); server.listen(0,'127.0.0.1',()=>{ process.stdout.write(String(server.address().port)); server.close(); });")"
base_url="https://127.0.0.1:$port/"
mkdir -p "$fixture_directory" "$certificate_directory" "$secret_input_directory"

node node_modules/vite-node/vite-node.mjs \
  tests/fixtures/emit-asoiaf-answer-desk-remote-supervisor-input.ts \
  "$fixture_directory" \
  "$estate_root" \
  | tee "$RUNNER_TEMP/fixture-emission.json"

npm run --silent asoiaf:answer-desk -- adopt \
  --input "$fixture_directory/adopt-input.json" \
  --out "$RUNNER_TEMP/adopt-result.json"

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1 \
  -subj '/CN=AXM remote supervisor qualification CA' \
  -addext 'basicConstraints=critical,CA:TRUE' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -keyout "$certificate_directory/ca.key" \
  -out "$certificate_directory/ca.crt" \
  >/dev/null 2>&1

cat > "$certificate_directory/server.ext" <<'CERTEXT'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:127.0.0.1,DNS:localhost
CERTEXT
openssl req -new -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=127.0.0.1' \
  -keyout "$certificate_directory/server.key" \
  -out "$certificate_directory/server.csr" \
  >/dev/null 2>&1
openssl x509 -req -sha256 -days 1 \
  -in "$certificate_directory/server.csr" \
  -CA "$certificate_directory/ca.crt" \
  -CAkey "$certificate_directory/ca.key" \
  -set_serial 101 \
  -extfile "$certificate_directory/server.ext" \
  -out "$certificate_directory/server.crt" \
  >/dev/null 2>&1

cat > "$certificate_directory/client.ext" <<'CERTEXT'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth
CERTEXT
for actor in reviewer assembler; do
  serial=201
  if test "$actor" = assembler; then serial=202; fi
  openssl req -new -newkey rsa:2048 -nodes -sha256 \
    -subj "/CN=$actor" \
    -keyout "$certificate_directory/$actor.key" \
    -out "$certificate_directory/$actor.csr" \
    >/dev/null 2>&1
  openssl x509 -req -sha256 -days 1 \
    -in "$certificate_directory/$actor.csr" \
    -CA "$certificate_directory/ca.crt" \
    -CAkey "$certificate_directory/ca.key" \
    -set_serial "$serial" \
    -extfile "$certificate_directory/client.ext" \
    -out "$certificate_directory/$actor.crt" \
    >/dev/null 2>&1
done

CERTIFICATE_DIRECTORY="$certificate_directory" node <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const directory = process.env.CERTIFICATE_DIRECTORY;
if (!directory) throw new Error('certificate directory is required');
const output = {};
for (const name of ['server', 'reviewer', 'assembler']) {
  const certificatePath = path.join(directory, name + '.crt');
  const certificate = new crypto.X509Certificate(fs.readFileSync(certificatePath));
  const start = certificate.validFromDate.getTime();
  output[name] = {
    admittedAt: new Date(start).toISOString(),
    activateAt: new Date(start).toISOString(),
    renewAfter: new Date(start + 6 * 60 * 60 * 1000).toISOString(),
    retireAfter: new Date(start + 12 * 60 * 60 * 1000).toISOString(),
  };
}
fs.writeFileSync(path.join(directory, 'times.json'), JSON.stringify(output, null, 2) + '\n');
NODE

read_time() {
  node - "$certificate_directory/times.json" "$1" "$2" <<'NODE'
const fs = require('node:fs');
const [file, name, field] = process.argv.slice(2);
process.stdout.write(JSON.parse(fs.readFileSync(file, 'utf8'))[name][field]);
NODE
}

server_admitted_at="$(read_time server admittedAt)"
server_activate_at="$(read_time server activateAt)"
server_renew_after="$(read_time server renewAfter)"
server_retire_after="$(read_time server retireAfter)"
reviewer_admitted_at="$(read_time reviewer admittedAt)"
reviewer_activate_at="$(read_time reviewer activateAt)"
reviewer_renew_after="$(read_time reviewer renewAfter)"
reviewer_retire_after="$(read_time reviewer retireAfter)"
assembler_admitted_at="$(read_time assembler admittedAt)"
assembler_activate_at="$(read_time assembler activateAt)"
assembler_renew_after="$(read_time assembler renewAfter)"
assembler_retire_after="$(read_time assembler retireAfter)"

npm run --silent asoiaf:answer-transport-operations -- admit-certificate \
  --root "$estate_root" \
  --usage server-auth \
  --principal-id 'server:qualification:remote-supervisor' \
  --certificate "$certificate_directory/server.crt" \
  --issuer-certificate "$certificate_directory/ca.crt" \
  --admitted-at "$server_admitted_at" \
  --activate-at "$server_activate_at" \
  --renew-after "$server_renew_after" \
  --retire-after "$server_retire_after" \
  --reason 'The operator admits one bounded server certificate for exact remote-supervisor qualification and no task authority.' \
  --operator-id 'qualification:remote-supervisor-server-admission' \
  --out "$RUNNER_TEMP/server-admission.json"

npm run --silent asoiaf:answer-transport-operations -- admit-certificate \
  --root "$estate_root" \
  --usage client-auth \
  --principal-id 'actor:qualification:remote-supervisor:reviewer' \
  --actor-role exact-locator-reviewer \
  --certificate "$certificate_directory/reviewer.crt" \
  --issuer-certificate "$certificate_directory/ca.crt" \
  --admitted-at "$reviewer_admitted_at" \
  --activate-at "$reviewer_activate_at" \
  --renew-after "$reviewer_renew_after" \
  --retire-after "$reviewer_retire_after" \
  --reason 'The operator admits one bounded exact-locator reviewer certificate for remote scheduling and pinned dispatch qualification.' \
  --operator-id 'qualification:remote-supervisor-reviewer-admission' \
  --out "$RUNNER_TEMP/reviewer-admission.json"

npm run --silent asoiaf:answer-transport-operations -- admit-certificate \
  --root "$estate_root" \
  --usage client-auth \
  --principal-id 'actor:qualification:remote-supervisor:assembler' \
  --actor-role answer-assembler \
  --certificate "$certificate_directory/assembler.crt" \
  --issuer-certificate "$certificate_directory/ca.crt" \
  --admitted-at "$assembler_admitted_at" \
  --activate-at "$assembler_activate_at" \
  --renew-after "$assembler_renew_after" \
  --retire-after "$assembler_retire_after" \
  --reason 'The operator admits one bounded answer-assembler certificate for remote scheduling and pinned dispatch qualification.' \
  --operator-id 'qualification:remote-supervisor-assembler-admission' \
  --out "$RUNNER_TEMP/assembler-admission.json"

node node_modules/vite-node/vite-node.mjs tools/asoiaf-answer-desk-transport.ts serve \
  --root "$estate_root" \
  --host 127.0.0.1 \
  --port "$port" \
  --server-certificate "$certificate_directory/server.crt" \
  --server-key "$certificate_directory/server.key" \
  --client-ca-certificate "$certificate_directory/ca.crt" \
  --operator-id 'qualification:remote-supervisor-server' \
  > "$RUNNER_TEMP/transport-server.stdout" \
  2> "$RUNNER_TEMP/transport-server.stderr" &
server_pid=$!
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT

ready=false
for _ in $(seq 1 120); do
  if grep -q '"mutualTlsRequired": true' "$RUNNER_TEMP/transport-server.stdout" 2>/dev/null; then
    ready=true
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    cat "$RUNNER_TEMP/transport-server.stderr" >&2 || true
    exit 1
  fi
  sleep 0.25
done
test "$ready" = true

SERVER_ADMISSION="$RUNNER_TEMP/server-admission.json" CA_CERTIFICATE="$certificate_directory/ca.crt" node <<'NODE' > "$RUNNER_TEMP/endpoint-vars"
const crypto = require('node:crypto');
const fs = require('node:fs');
const server = JSON.parse(fs.readFileSync(process.env.SERVER_ADMISSION, 'utf8')).admission;
const ca = new crypto.X509Certificate(fs.readFileSync(process.env.CA_CERTIFICATE));
const caFingerprint = 'sha256:' + crypto.createHash('sha256').update(ca.raw).digest('hex');
const expiresAt = new Date(Date.parse(server.activateAt) + 10 * 60 * 60 * 1000).toISOString();
console.log('server_id=' + JSON.stringify(server.principalId));
console.log('server_fingerprint=' + JSON.stringify(server.certificateFingerprint));
console.log('client_ca_fingerprint=' + JSON.stringify(caFingerprint));
console.log('endpoint_expires_at=' + JSON.stringify(expiresAt));
NODE
source "$RUNNER_TEMP/endpoint-vars"

npm run --silent asoiaf:answer-transport-operations -- advertise \
  --root "$estate_root" \
  --server-id "$server_id" \
  --url "$base_url" \
  --network-scope loopback \
  --priority 10 \
  --server-certificate-fingerprint "$server_fingerprint" \
  --accepted-client-ca-fingerprint "$client_ca_fingerprint" \
  --advertised-at "$server_admitted_at" \
  --available-from "$server_activate_at" \
  --expires-at "$endpoint_expires_at" \
  --operator-id 'qualification:remote-supervisor-endpoint' \
  --out "$RUNNER_TEMP/endpoint-advertisement.json"

endpoint_id="$(node -e "const x=require(process.argv[1]); process.stdout.write(x.endpoint.endpointLeaseId)" "$RUNNER_TEMP/endpoint-advertisement.json")"
reviewer_fingerprint="$(node -e "const x=require(process.argv[1]); process.stdout.write(x.admission.certificateFingerprint)" "$RUNNER_TEMP/reviewer-admission.json")"
assembler_fingerprint="$(node -e "const x=require(process.argv[1]); process.stdout.write(x.admission.certificateFingerprint)" "$RUNNER_TEMP/assembler-admission.json")"

reviewer_observed_at="$(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- probe \
  --root "$estate_root" \
  --endpoint-id "$endpoint_id" \
  --client-certificate "$certificate_directory/reviewer.crt" \
  --client-key "$certificate_directory/reviewer.key" \
  --server-ca-certificate "$certificate_directory/ca.crt" \
  --observed-at "$reviewer_observed_at" \
  --out "$RUNNER_TEMP/reviewer-probe.json"

assembler_observed_at="$(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- probe \
  --root "$estate_root" \
  --endpoint-id "$endpoint_id" \
  --client-certificate "$certificate_directory/assembler.crt" \
  --client-key "$certificate_directory/assembler.key" \
  --server-ca-certificate "$certificate_directory/ca.crt" \
  --observed-at "$assembler_observed_at" \
  --out "$RUNNER_TEMP/assembler-probe.json"

generated_at="$(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- resolve \
  --root "$estate_root" \
  --server-id "$server_id" \
  --client-certificate-fingerprint "$reviewer_fingerprint" \
  --generated-at "$generated_at" \
  --max-observation-age-ms 300000 \
  --operator-id 'qualification:remote-supervisor-reviewer-rendezvous' \
  --out "$RUNNER_TEMP/reviewer-rendezvous.json"

npm run --silent asoiaf:answer-transport-operations -- resolve \
  --root "$estate_root" \
  --server-id "$server_id" \
  --client-certificate-fingerprint "$assembler_fingerprint" \
  --generated-at "$generated_at" \
  --max-observation-age-ms 300000 \
  --operator-id 'qualification:remote-supervisor-assembler-rendezvous' \
  --out "$RUNNER_TEMP/assembler-rendezvous.json"

ESTATE_ROOT="$estate_root" FIXTURE_DIRECTORY="$fixture_directory" RUNNER_TEMP="$RUNNER_TEMP" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.ESTATE_ROOT;
const fixture = process.env.FIXTURE_DIRECTORY;
const temp = process.env.RUNNER_TEMP;
const supervisorPolicy = JSON.parse(fs.readFileSync(path.join(fixture, 'supervisor-policy.json'), 'utf8'));
const reviewerAdmission = JSON.parse(fs.readFileSync(path.join(temp, 'reviewer-admission.json'), 'utf8')).admission;
const assemblerAdmission = JSON.parse(fs.readFileSync(path.join(temp, 'assembler-admission.json'), 'utf8')).admission;
const reviewerRendezvous = JSON.parse(fs.readFileSync(path.join(temp, 'reviewer-rendezvous.json'), 'utf8')).rendezvous;
const assemblerRendezvous = JSON.parse(fs.readFileSync(path.join(temp, 'assembler-rendezvous.json'), 'utf8')).rendezvous;
const reviewerBinding = supervisorPolicy.actorBindings.find((entry) => entry.actorId === reviewerAdmission.principalId);
const assemblerBinding = supervisorPolicy.actorBindings.find((entry) => entry.actorId === assemblerAdmission.principalId);
if (!reviewerBinding || !assemblerBinding) throw new Error('supervisor actor bindings are absent');
const input = {
  root,
  createdBy: 'qualification:remote-supervisor-policy',
  createdAt: new Date().toISOString(),
  supervisorPolicy,
  remoteBindings: [
    {
      supervisorBindingId: reviewerBinding.bindingId,
      certificateAdmissionId: reviewerAdmission.admissionId,
      rendezvousId: reviewerRendezvous.rendezvousId,
    },
    {
      supervisorBindingId: assemblerBinding.bindingId,
      certificateAdmissionId: assemblerAdmission.admissionId,
      rendezvousId: assemblerRendezvous.rendezvousId,
    },
  ],
};
fs.writeFileSync(path.join(fixture, 'remote-policy-input.json'), JSON.stringify(input, null, 2) + '\n');
NODE

npm run --silent asoiaf:answer-remote-supervisor -- policy \
  --input "$fixture_directory/remote-policy-input.json" \
  --out "$RUNNER_TEMP/remote-policy-result.json"
node - "$RUNNER_TEMP/remote-policy-result.json" "$fixture_directory/remote-policy.json" <<'NODE'
const fs = require('node:fs');
const [source, target] = process.argv.slice(2);
const result = JSON.parse(fs.readFileSync(source, 'utf8'));
if (!result.ok) throw new Error('remote policy did not validate');
fs.writeFileSync(target, JSON.stringify(result.policy, null, 2) + '\n');
NODE

ESTATE_ROOT="$estate_root" FIXTURE_DIRECTORY="$fixture_directory" SECRET_INPUT_DIRECTORY="$secret_input_directory" CERTIFICATE_DIRECTORY="$certificate_directory" RUNNER_TEMP="$RUNNER_TEMP" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.ESTATE_ROOT;
const fixture = process.env.FIXTURE_DIRECTORY;
const secret = process.env.SECRET_INPUT_DIRECTORY;
const certs = process.env.CERTIFICATE_DIRECTORY;
const temp = process.env.RUNNER_TEMP;
const policy = JSON.parse(fs.readFileSync(path.join(fixture, 'remote-policy.json'), 'utf8'));
const reviewerAdmission = JSON.parse(fs.readFileSync(path.join(temp, 'reviewer-admission.json'), 'utf8')).admission;
const assemblerAdmission = JSON.parse(fs.readFileSync(path.join(temp, 'assembler-admission.json'), 'utf8')).admission;
const write = (name, value) => fs.writeFileSync(path.join(secret, name), JSON.stringify(value, null, 2) + '\n');
write('review-tick.json', {
  root,
  requestKey: 'qualification:remote-supervisor-review',
  policy,
  requestedAt: new Date().toISOString(),
  automaticCompletedAt: null,
  operatorId: 'qualification:remote-supervisor',
  credentialFiles: {
    certificateAdmissionId: reviewerAdmission.admissionId,
    clientCertificate: path.join(certs, 'reviewer.crt'),
    clientPrivateKey: path.join(certs, 'reviewer.key'),
    serverCertificateAuthority: path.join(certs, 'ca.crt'),
  },
});
write('close-tick.json', {
  root,
  requestKey: 'qualification:remote-supervisor-close',
  policy,
  requestedAt: null,
  automaticCompletedAt: null,
  operatorId: 'qualification:remote-supervisor',
  credentialFiles: {
    certificateAdmissionId: assemblerAdmission.admissionId,
    clientCertificate: path.join(certs, 'assembler.crt'),
    clientPrivateKey: path.join(certs, 'assembler.key'),
    serverCertificateAuthority: path.join(certs, 'ca.crt'),
  },
});
NODE

npm run --silent asoiaf:answer-remote-supervisor -- plan \
  --input "$secret_input_directory/review-tick.json" \
  --out "$RUNNER_TEMP/remote-plan-open.json"
npm run --silent asoiaf:answer-remote-supervisor -- prepare \
  --input "$secret_input_directory/review-tick.json" \
  --out "$RUNNER_TEMP/review-prepare.json"
npm run --silent asoiaf:answer-desk -- status \
  --root "$estate_root" \
  > "$RUNNER_TEMP/desk-after-remote-prepare.json"
npm run --silent asoiaf:answer-supervisor -- status \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/supervisor-after-remote-prepare.json"
npm run --silent asoiaf:answer-transport-operations -- status \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/operations-after-remote-prepare.json"

npm run --silent asoiaf:answer-remote-supervisor -- tick \
  --input "$secret_input_directory/review-tick.json" \
  --out "$RUNNER_TEMP/review-remote-tick-first.json"
npm run --silent asoiaf:answer-remote-supervisor -- tick \
  --input "$secret_input_directory/review-tick.json" \
  --out "$RUNNER_TEMP/review-remote-tick-replay-live.json"

RUNNER_TEMP="$RUNNER_TEMP" FIXTURE_DIRECTORY="$fixture_directory" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const temp = process.env.RUNNER_TEMP;
const fixture = process.env.FIXTURE_DIRECTORY;
const tick = JSON.parse(fs.readFileSync(path.join(temp, 'review-remote-tick-first.json'), 'utf8'));
const template = JSON.parse(fs.readFileSync(path.join(fixture, 'review-result-template.json'), 'utf8'));
const assignment = tick.dispatch.envelope.response.payload.assignment;
template.assignmentId = assignment.assignmentId;
template.completedAt = new Date().toISOString();
fs.writeFileSync(path.join(fixture, 'review-result-body.json'), JSON.stringify(template, null, 2) + '\n');
NODE
reviewer_rendezvous_id="$(node -e "const x=require(process.argv[1]); process.stdout.write(x.rendezvous.rendezvousId)" "$RUNNER_TEMP/reviewer-rendezvous.json")"
review_result_time="$(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- admit \
  --root "$estate_root" \
  --rendezvous-id "$reviewer_rendezvous_id" \
  --input "$fixture_directory/review-result-body.json" \
  --idempotency-key 'qualification-remote-review-result-0001' \
  --client-certificate "$certificate_directory/reviewer.crt" \
  --client-key "$certificate_directory/reviewer.key" \
  --server-ca-certificate "$certificate_directory/ca.crt" \
  --dispatched-at "$review_result_time" \
  --out "$RUNNER_TEMP/review-result-first.json"
npm run --silent asoiaf:answer-transport-operations -- admit \
  --root "$estate_root" \
  --rendezvous-id "$reviewer_rendezvous_id" \
  --input "$fixture_directory/review-result-body.json" \
  --idempotency-key 'qualification-remote-review-result-0001' \
  --client-certificate "$certificate_directory/reviewer.crt" \
  --client-key "$certificate_directory/reviewer.key" \
  --server-ca-certificate "$certificate_directory/ca.crt" \
  --dispatched-at "$review_result_time" \
  --out "$RUNNER_TEMP/review-result-replay.json"

SECRET_INPUT_DIRECTORY="$secret_input_directory" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.env.SECRET_INPUT_DIRECTORY, 'close-tick.json');
const value = JSON.parse(fs.readFileSync(file, 'utf8'));
value.requestedAt = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
NODE
npm run --silent asoiaf:answer-remote-supervisor -- plan \
  --input "$secret_input_directory/close-tick.json" \
  --out "$RUNNER_TEMP/remote-plan-reconciled.json"
npm run --silent asoiaf:answer-remote-supervisor -- tick \
  --input "$secret_input_directory/close-tick.json" \
  --out "$RUNNER_TEMP/close-remote-tick-first.json"
npm run --silent asoiaf:answer-remote-supervisor -- tick \
  --input "$secret_input_directory/close-tick.json" \
  --out "$RUNNER_TEMP/close-remote-tick-replay-live.json"

RUNNER_TEMP="$RUNNER_TEMP" FIXTURE_DIRECTORY="$fixture_directory" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const temp = process.env.RUNNER_TEMP;
const fixture = process.env.FIXTURE_DIRECTORY;
const tick = JSON.parse(fs.readFileSync(path.join(temp, 'close-remote-tick-first.json'), 'utf8'));
const template = JSON.parse(fs.readFileSync(path.join(fixture, 'close-result-template.json'), 'utf8'));
const assignment = tick.dispatch.envelope.response.payload.assignment;
template.assignmentId = assignment.assignmentId;
template.completedAt = new Date().toISOString();
fs.writeFileSync(path.join(fixture, 'close-result-body.json'), JSON.stringify(template, null, 2) + '\n');
NODE
assembler_rendezvous_id="$(node -e "const x=require(process.argv[1]); process.stdout.write(x.rendezvous.rendezvousId)" "$RUNNER_TEMP/assembler-rendezvous.json")"
close_result_time="$(node -e 'process.stdout.write(new Date().toISOString())')"
npm run --silent asoiaf:answer-transport-operations -- admit \
  --root "$estate_root" \
  --rendezvous-id "$assembler_rendezvous_id" \
  --input "$fixture_directory/close-result-body.json" \
  --idempotency-key 'qualification-remote-close-result-0001' \
  --client-certificate "$certificate_directory/assembler.crt" \
  --client-key "$certificate_directory/assembler.key" \
  --server-ca-certificate "$certificate_directory/ca.crt" \
  --dispatched-at "$close_result_time" \
  --out "$RUNNER_TEMP/close-result-first.json"
npm run --silent asoiaf:answer-transport-operations -- admit \
  --root "$estate_root" \
  --rendezvous-id "$assembler_rendezvous_id" \
  --input "$fixture_directory/close-result-body.json" \
  --idempotency-key 'qualification-remote-close-result-0001' \
  --client-certificate "$certificate_directory/assembler.crt" \
  --client-key "$certificate_directory/assembler.key" \
  --server-ca-certificate "$certificate_directory/ca.crt" \
  --dispatched-at "$close_result_time" \
  --out "$RUNNER_TEMP/close-result-replay.json"

cleanup
trap - EXIT

SECRET_INPUT_DIRECTORY="$secret_input_directory" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const directory = process.env.SECRET_INPUT_DIRECTORY;
for (const name of ['review-tick.json', 'close-tick.json']) {
  const file = path.join(directory, name);
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  value.credentialFiles = null;
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
NODE
npm run --silent asoiaf:answer-remote-supervisor -- tick \
  --input "$secret_input_directory/review-tick.json" \
  --out "$RUNNER_TEMP/review-remote-tick-replay-offline.json"
npm run --silent asoiaf:answer-remote-supervisor -- tick \
  --input "$secret_input_directory/close-tick.json" \
  --out "$RUNNER_TEMP/close-remote-tick-replay-offline.json"

ESTATE_ROOT="$estate_root" FIXTURE_DIRECTORY="$fixture_directory" SECRET_INPUT_DIRECTORY="$secret_input_directory" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.ESTATE_ROOT;
const fixture = process.env.FIXTURE_DIRECTORY;
const secret = process.env.SECRET_INPUT_DIRECTORY;
const policy = JSON.parse(fs.readFileSync(path.join(fixture, 'remote-policy.json'), 'utf8'));
const requestedAt = new Date().toISOString();
const input = {
  root,
  requestKey: 'qualification:remote-supervisor-render',
  policy,
  requestedAt,
  automaticCompletedAt: new Date(Date.parse(requestedAt) + 1000).toISOString(),
  operatorId: 'qualification:remote-supervisor',
  credentialFiles: null,
};
fs.writeFileSync(path.join(secret, 'render-tick.json'), JSON.stringify(input, null, 2) + '\n');
NODE
npm run --silent asoiaf:answer-remote-supervisor -- plan \
  --input "$secret_input_directory/render-tick.json" \
  --out "$RUNNER_TEMP/remote-plan-ready.json"
npm run --silent asoiaf:answer-remote-supervisor -- tick \
  --input "$secret_input_directory/render-tick.json" \
  --out "$RUNNER_TEMP/render-remote-tick-first.json"
npm run --silent asoiaf:answer-remote-supervisor -- tick \
  --input "$secret_input_directory/render-tick.json" \
  --out "$RUNNER_TEMP/render-remote-tick-replay.json"

npm run --silent asoiaf:answer-remote-supervisor -- status \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/remote-supervisor-status.json"
npm run --silent asoiaf:answer-remote-supervisor -- verify \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/remote-supervisor-verification.json"
npm run --silent asoiaf:answer-supervisor -- status \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/supervisor-status.json"
npm run --silent asoiaf:answer-supervisor -- verify \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/supervisor-verification.json"
npm run --silent asoiaf:answer-transport-operations -- status \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/operations-status.json"
npm run --silent asoiaf:answer-transport-operations -- verify \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/operations-verification.json"
npm run --silent asoiaf:answer-transport -- status \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/transport-status.json"
npm run --silent asoiaf:answer-exchange -- status \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/exchange-status.json"
npm run --silent asoiaf:answer-worker -- status \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/worker-status.json"
npm run --silent asoiaf:answer-desk -- status \
  --root "$estate_root" \
  > "$RUNNER_TEMP/desk-status.json"
npm run --silent asoiaf:answer-desk -- verify \
  --root "$estate_root" \
  > "$RUNNER_TEMP/desk-verification.json"
npm run --silent asoiaf:answer-remote-supervisor -- paths \
  --root "$estate_root" \
  --out "$RUNNER_TEMP/remote-supervisor-paths.json"

RUNNER_TEMP="$RUNNER_TEMP" node <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const temp = process.env.RUNNER_TEMP;
const read = (name) => JSON.parse(fs.readFileSync(path.join(temp, name), 'utf8'));
const deskAfterPrepare = read('desk-after-remote-prepare.json');
const supervisorAfterPrepare = read('supervisor-after-remote-prepare.json');
const operationsAfterPrepare = read('operations-after-remote-prepare.json');
assert.equal(deskAfterPrepare.leases.length, 0);
assert.equal(supervisorAfterPrepare.counts.intents, 0);
assert.equal(operationsAfterPrepare.counts.dispatches, 0);
const review = read('review-remote-tick-first.json');
const reviewReplay = read('review-remote-tick-replay-offline.json');
const close = read('close-remote-tick-first.json');
const closeReplay = read('close-remote-tick-replay-offline.json');
const render = read('render-remote-tick-first.json');
const renderReplay = read('render-remote-tick-replay.json');
assert.equal(review.run.outcome, 'external-dispatched');
assert.equal(review.networkAttempted, true);
assert.equal(review.baseSupervisorRun.operationReplayed, true);
assert.deepEqual(reviewReplay.run, review.run);
assert.equal(reviewReplay.networkAttempted, false);
assert.equal(close.run.outcome, 'external-dispatched');
assert.equal(close.networkAttempted, true);
assert.equal(close.baseSupervisorRun.operationReplayed, true);
assert.deepEqual(closeReplay.run, close.run);
assert.equal(closeReplay.networkAttempted, false);
assert.equal(render.run.outcome, 'automatic-rendered');
assert.equal(render.dispatch, null);
assert.deepEqual(renderReplay.run, render.run);
const remote = read('remote-supervisor-status.json');
const remoteVerification = read('remote-supervisor-verification.json');
const supervisor = read('supervisor-status.json');
const operations = read('operations-status.json');
const transport = read('transport-status.json');
const exchange = read('exchange-status.json');
const worker = read('worker-status.json');
const desk = read('desk-status.json');
assert.equal(remote.counts.intents, 3);
assert.equal(remote.counts.runs, 3);
assert.equal(remote.counts.pendingIntents, 0);
assert.equal(remoteVerification.ok, true);
assert.equal(remoteVerification.counts.errors, 0);
assert.equal(remoteVerification.counts.warnings, 0);
assert.equal(supervisor.counts.intents, 3);
assert.equal(supervisor.counts.runs, 3);
assert.equal(operations.counts.certificates, 3);
assert.equal(operations.counts.endpoints, 1);
assert.equal(operations.counts.availableObservations, 2);
assert.equal(operations.counts.selectedRendezvous, 2);
assert.equal(operations.counts.dispatches, 4);
assert.equal(transport.counts.requests, 4);
assert.equal(transport.counts.responses, 4);
assert.equal(exchange.counts.assignments, 2);
assert.equal(exchange.counts.results, 2);
assert.equal(worker.counts.invocations, 1);
assert.equal(worker.counts.results, 1);
assert.equal(desk.workOrders.length, 3);
assert.equal(desk.leases.length, 3);
assert.equal(desk.settlements.length, 3);
assert.equal(desk.state.availableItemIds.length, 0);
assert.equal(desk.state.nextAvailableItemId, null);
NODE

rm -rf "$certificate_directory" "$secret_input_directory"
`;

function itemId(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkAction,
): string {
  const item = workOrder.items.find((entry) => entry.action === action);
  if (!item) throw new Error(`remote supervisor fixture lacks ${action}`);
  return item.itemId;
}

function emitQualificationShell(target: string): void {
  const resolved = path.resolve(target);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, QUALIFICATION_SHELL, { mode: 0o700 });
  process.stdout.write(`${JSON.stringify({ ok: true, target: resolved }, null, 2)}\n`);
}

const first = process.argv[2];
if (first === "--emit-qualification-shell") {
  const target = process.argv[3];
  if (!target) throw new Error("qualification shell target is required");
  emitQualificationShell(target);
} else {
  const outputDirectory = first;
  const estateRoot = process.argv[3];
  if (!outputDirectory || !estateRoot) {
    throw new Error("output directory and estate root arguments are required");
  }
  const output = path.resolve(outputDirectory);
  const root = path.resolve(estateRoot);
  const fixture = buildAsoiafAnswerDeskFixture();
  const supervisorPolicy = buildAsoiafAnswerSupervisorPolicy({
    createdBy: "qualification:remote-supervisor-base-policy",
    createdAt: "2026-08-05T06:20:00.000Z",
    automaticWorkerEnabled: true,
    automaticLeaseMilliseconds: 60_000,
    actorBindings: [
      {
        actorRole: "exact-locator-reviewer",
        actorId: "actor:qualification:remote-supervisor:reviewer",
        capacity: 1,
        leaseMilliseconds: 600_000,
        priority: 10,
      },
      {
        actorRole: "answer-assembler",
        actorId: "actor:qualification:remote-supervisor:assembler",
        capacity: 1,
        leaseMilliseconds: 600_000,
        priority: 20,
      },
    ],
  });
  const adoptInput: AsoiafAnswerDeskAdoptInput = {
    root,
    workOrder: fixture.openWorkOrder,
    adoptedAt: "2026-08-05T06:20:01.000Z",
    operatorId: "qualification:remote-supervisor-adopt",
  };
  const reviewResultTemplate: AsoiafAnswerTransportAdmitBody = {
    assignmentId: "__REVIEW_ASSIGNMENT_ID__",
    completedAt: "2026-08-05T06:30:00.000Z",
    outcome: "satisfied",
    afterWorkOrder: fixture.reconciledWorkOrder,
    resultReferences: [
      {
        kind: "reviewed-answer-transaction",
        objectId: fixture.transaction.transactionId,
        fingerprint: fixture.transaction.transactionFingerprint,
        uri: null,
      },
    ],
    reason:
      "The certificate-bound qualification reviewer returns the exact reviewed transaction through the permanent transport validators.",
  };
  const closeResultTemplate: AsoiafAnswerTransportAdmitBody = {
    assignmentId: "__CLOSE_ASSIGNMENT_ID__",
    completedAt: "2026-08-05T06:40:00.000Z",
    outcome: "satisfied",
    afterWorkOrder: fixture.readyWorkOrder,
    resultReferences: [
      {
        kind: "reviewed-answer-packet",
        objectId: fixture.answerPacket.answerPacketId,
        fingerprint: fixture.answerPacket.answerPacketFingerprint,
        uri: null,
      },
    ],
    reason:
      "The certificate-bound qualification assembler returns the exact reviewed packet through the permanent transport validators.",
  };
  const expected = {
    estateRoot: root,
    openWorkOrderId: fixture.openWorkOrder.workOrderId,
    reconciledWorkOrderId: fixture.reconciledWorkOrder.workOrderId,
    readyWorkOrderId: fixture.readyWorkOrder.workOrderId,
    reviewItemId: itemId(fixture.openWorkOrder, "review-exact-locator"),
    closeItemId: itemId(fixture.reconciledWorkOrder, "close-gap"),
    renderItemId: itemId(fixture.readyWorkOrder, "render-reviewed-answer"),
    transactionId: fixture.transaction.transactionId,
    answerPacketId: fixture.answerPacket.answerPacketId,
    renderedTextDigest: fixture.answerPacket.renderedTextDigest,
    renderedTextCharacters: fixture.answerPacket.renderedTextCharacters,
  };
  fs.mkdirSync(output, { recursive: true });
  for (const [name, value] of [
    ["adopt-input.json", adoptInput],
    ["supervisor-policy.json", supervisorPolicy],
    ["review-result-template.json", reviewResultTemplate],
    ["close-result-template.json", closeResultTemplate],
    ["expected.json", expected],
  ] as const) {
    fs.writeFileSync(
      path.join(output, name),
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    outputDirectory: output,
    estateRoot: root,
    openWorkOrderId: expected.openWorkOrderId,
    reviewItemId: expected.reviewItemId,
    closeItemId: expected.closeItemId,
    renderItemId: expected.renderItemId,
  }, null, 2)}\n`);
}
