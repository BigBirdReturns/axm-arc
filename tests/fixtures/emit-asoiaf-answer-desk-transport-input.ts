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

const QUALIFICATION_SHELL = "set -euo pipefail\nfixture_directory=\"$RUNNER_TEMP/answer-transport-fixture\"\nestate_root=\"$RUNNER_TEMP/answer-desk\"\ncertificate_directory=\"$RUNNER_TEMP/answer-transport-certificates\"\nport=18443\nbase_url=\"https://127.0.0.1:${port}\"\nmkdir -p \"$fixture_directory\" \"$certificate_directory\"\n\nnpx vite-node tests/fixtures/emit-asoiaf-answer-desk-transport-input.ts \\\n  \"$fixture_directory\" \\\n  \"$estate_root\" \\\n  | tee \"$RUNNER_TEMP/fixture-emission.json\"\n\nnpm run --silent asoiaf:answer-desk -- adopt \\\n  --input \"$fixture_directory/adopt-input.json\" \\\n  --out \"$RUNNER_TEMP/adopt-result.json\"\n\nopenssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1 \\\n  -subj '/CN=AXM answer transport qualification CA' \\\n  -keyout \"$certificate_directory/ca.key\" \\\n  -out \"$certificate_directory/ca.crt\" \\\n  >/dev/null 2>&1\n\ncat > \"$certificate_directory/server.ext\" <<'EOF'\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\nEOF\nopenssl req -new -newkey rsa:2048 -nodes -sha256 \\\n  -subj '/CN=127.0.0.1' \\\n  -keyout \"$certificate_directory/server.key\" \\\n  -out \"$certificate_directory/server.csr\" \\\n  >/dev/null 2>&1\nopenssl x509 -req -sha256 -days 1 \\\n  -in \"$certificate_directory/server.csr\" \\\n  -CA \"$certificate_directory/ca.crt\" \\\n  -CAkey \"$certificate_directory/ca.key\" \\\n  -CAcreateserial \\\n  -extfile \"$certificate_directory/server.ext\" \\\n  -out \"$certificate_directory/server.crt\" \\\n  >/dev/null 2>&1\n\ncat > \"$certificate_directory/client.ext\" <<'EOF'\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=clientAuth\nEOF\nfor actor in reviewer assembler unregistered; do\n  openssl req -new -newkey rsa:2048 -nodes -sha256 \\\n    -subj \"/CN=${actor}\" \\\n    -keyout \"$certificate_directory/${actor}.key\" \\\n    -out \"$certificate_directory/${actor}.csr\" \\\n    >/dev/null 2>&1\n  openssl x509 -req -sha256 -days 1 \\\n    -in \"$certificate_directory/${actor}.csr\" \\\n    -CA \"$certificate_directory/ca.crt\" \\\n    -CAkey \"$certificate_directory/ca.key\" \\\n    -CAserial \"$certificate_directory/ca.srl\" \\\n    -extfile \"$certificate_directory/client.ext\" \\\n    -out \"$certificate_directory/${actor}.crt\" \\\n    >/dev/null 2>&1\ndone\n\nopenssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1 \\\n  -subj '/CN=Untrusted answer transport CA' \\\n  -keyout \"$certificate_directory/rogue-ca.key\" \\\n  -out \"$certificate_directory/rogue-ca.crt\" \\\n  >/dev/null 2>&1\nopenssl req -new -newkey rsa:2048 -nodes -sha256 \\\n  -subj '/CN=rogue-client' \\\n  -keyout \"$certificate_directory/rogue.key\" \\\n  -out \"$certificate_directory/rogue.csr\" \\\n  >/dev/null 2>&1\nopenssl x509 -req -sha256 -days 1 \\\n  -in \"$certificate_directory/rogue.csr\" \\\n  -CA \"$certificate_directory/rogue-ca.crt\" \\\n  -CAkey \"$certificate_directory/rogue-ca.key\" \\\n  -CAcreateserial \\\n  -extfile \"$certificate_directory/client.ext\" \\\n  -out \"$certificate_directory/rogue.crt\" \\\n  >/dev/null 2>&1\n\nnpm run --silent asoiaf:answer-transport -- fingerprint \\\n  --certificate \"$certificate_directory/reviewer.crt\" \\\n  --out \"$RUNNER_TEMP/reviewer-fingerprint.json\"\nnpm run --silent asoiaf:answer-transport -- fingerprint \\\n  --certificate \"$certificate_directory/assembler.crt\" \\\n  --out \"$RUNNER_TEMP/assembler-fingerprint.json\"\n\nnpm run --silent asoiaf:answer-transport -- register \\\n  --root \"$estate_root\" \\\n  --certificate \"$certificate_directory/reviewer.crt\" \\\n  --actor-id 'actor:qualification:transport:exact-locator-reviewer' \\\n  --actor-role exact-locator-reviewer \\\n  --registered-at '2026-08-05T06:00:00.000Z' \\\n  --operator-id 'qualification:answer-transport-register-reviewer' \\\n  --out \"$RUNNER_TEMP/reviewer-registration.json\"\nnpm run --silent asoiaf:answer-transport -- register \\\n  --root \"$estate_root\" \\\n  --certificate \"$certificate_directory/assembler.crt\" \\\n  --actor-id 'actor:qualification:transport:answer-assembler' \\\n  --actor-role answer-assembler \\\n  --registered-at '2026-08-05T06:00:00.000Z' \\\n  --operator-id 'qualification:answer-transport-register-assembler' \\\n  --out \"$RUNNER_TEMP/assembler-registration.json\"\n\nnode node_modules/vite-node/vite-node.mjs tools/asoiaf-answer-desk-transport.ts serve \\\n  --root \"$estate_root\" \\\n  --host 127.0.0.1 \\\n  --port \"$port\" \\\n  --server-certificate \"$certificate_directory/server.crt\" \\\n  --server-key \"$certificate_directory/server.key\" \\\n  --client-ca-certificate \"$certificate_directory/ca.crt\" \\\n  --operator-id 'qualification:answer-transport-server' \\\n  > \"$RUNNER_TEMP/transport-server.stdout\" \\\n  2> \"$RUNNER_TEMP/transport-server.stderr\" &\nserver_pid=$!\ncleanup() {\n  kill \"$server_pid\" 2>/dev/null || true\n  wait \"$server_pid\" 2>/dev/null || true\n}\ntrap cleanup EXIT\n\nready=false\nfor _ in $(seq 1 120); do\n  if grep -q '\"mutualTlsRequired\": true' \"$RUNNER_TEMP/transport-server.stdout\" 2>/dev/null; then\n    ready=true\n    break\n  fi\n  if ! kill -0 \"$server_pid\" 2>/dev/null; then\n    cat \"$RUNNER_TEMP/transport-server.stderr\" >&2 || true\n    exit 1\n  fi\n  sleep 0.25\ndone\ntest \"$ready\" = true\n\nset +e\ncurl --silent --show-error \\\n  --cacert \"$certificate_directory/ca.crt\" \\\n  -H 'content-type: application/json' \\\n  -H 'idempotency-key: qualification-no-client-0001' \\\n  --data-binary \"@$fixture_directory/review-issue-body.json\" \\\n  \"$base_url/v1/assignments/issue\" \\\n  > \"$RUNNER_TEMP/no-client-certificate.stdout\" \\\n  2> \"$RUNNER_TEMP/no-client-certificate.stderr\"\nno_client_status=$?\ncurl --silent --show-error \\\n  --cacert \"$certificate_directory/ca.crt\" \\\n  --cert \"$certificate_directory/rogue.crt\" \\\n  --key \"$certificate_directory/rogue.key\" \\\n  -H 'content-type: application/json' \\\n  -H 'idempotency-key: qualification-untrusted-client-0001' \\\n  --data-binary \"@$fixture_directory/review-issue-body.json\" \\\n  \"$base_url/v1/assignments/issue\" \\\n  > \"$RUNNER_TEMP/untrusted-client.stdout\" \\\n  2> \"$RUNNER_TEMP/untrusted-client.stderr\"\nuntrusted_status=$?\nset -e\ntest \"$no_client_status\" -ne 0\ntest \"$untrusted_status\" -ne 0\nnode - \"$no_client_status\" \"$untrusted_status\" <<'NODE'\nconst fs = require('node:fs');\nconst [noClient, untrusted] = process.argv.slice(2).map(Number);\nfs.writeFileSync(\n  `${process.env.RUNNER_TEMP}/tls-refusals.json`,\n  `${JSON.stringify({\n    ok: true,\n    noClientCertificate: { refused: noClient !== 0, exitStatus: noClient },\n    untrustedClientCertificate: { refused: untrusted !== 0, exitStatus: untrusted },\n    requestCustodyCreated: false,\n  }, null, 2)}\\n`,\n);\nNODE\n\nif npm run --silent asoiaf:answer-transport -- issue \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/unregistered.crt\" \\\n  --client-key \"$certificate_directory/unregistered.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-unregistered-client-0001' \\\n  --input \"$fixture_directory/review-issue-body.json\" \\\n  --out \"$RUNNER_TEMP/unregistered-client.json\"; then\n  echo 'trusted but unregistered certificate was accepted' >&2\n  exit 1\nfi\n\nnpm run --silent asoiaf:answer-transport -- issue \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/reviewer.crt\" \\\n  --client-key \"$certificate_directory/reviewer.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-review-issue-0001' \\\n  --input \"$fixture_directory/review-issue-body.json\" \\\n  --out \"$RUNNER_TEMP/review-issue-first.json\"\nnpm run --silent asoiaf:answer-transport -- issue \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/reviewer.crt\" \\\n  --client-key \"$certificate_directory/reviewer.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-review-issue-0001' \\\n  --input \"$fixture_directory/review-issue-body.json\" \\\n  --out \"$RUNNER_TEMP/review-issue-replay.json\"\n\nnode <<'NODE'\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst temp = process.env.RUNNER_TEMP;\nconst fixture = path.join(temp, 'answer-transport-fixture');\nconst changed = JSON.parse(fs.readFileSync(path.join(fixture, 'review-issue-body.json'), 'utf8'));\nchanged.leaseMilliseconds = 300000;\nfs.writeFileSync(path.join(fixture, 'review-issue-changed-body.json'), `${JSON.stringify(changed, null, 2)}\\n`);\nconst template = JSON.parse(fs.readFileSync(path.join(fixture, 'review-result-template.json'), 'utf8'));\nconst issued = JSON.parse(fs.readFileSync(path.join(temp, 'review-issue-first.json'), 'utf8'));\ntemplate.assignmentId = issued.response.payload.assignment.assignmentId;\nfs.writeFileSync(path.join(fixture, 'review-result-body.json'), `${JSON.stringify(template, null, 2)}\\n`);\nNODE\n\nif npm run --silent asoiaf:answer-transport -- issue \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/reviewer.crt\" \\\n  --client-key \"$certificate_directory/reviewer.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-review-issue-0001' \\\n  --input \"$fixture_directory/review-issue-changed-body.json\" \\\n  --out \"$RUNNER_TEMP/idempotency-body-conflict.json\"; then\n  echo 'changed body reused an idempotency key' >&2\n  exit 1\nfi\nif npm run --silent asoiaf:answer-transport -- issue \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/assembler.crt\" \\\n  --client-key \"$certificate_directory/assembler.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-review-issue-0001' \\\n  --input \"$fixture_directory/review-issue-body.json\" \\\n  --out \"$RUNNER_TEMP/idempotency-peer-conflict.json\"; then\n  echo 'different peer reused an idempotency key' >&2\n  exit 1\nfi\n\nnpm run --silent asoiaf:answer-transport -- admit \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/reviewer.crt\" \\\n  --client-key \"$certificate_directory/reviewer.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-review-admit-0001' \\\n  --input \"$fixture_directory/review-result-body.json\" \\\n  --out \"$RUNNER_TEMP/review-admit-first.json\"\nnpm run --silent asoiaf:answer-transport -- admit \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/reviewer.crt\" \\\n  --client-key \"$certificate_directory/reviewer.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-review-admit-0001' \\\n  --input \"$fixture_directory/review-result-body.json\" \\\n  --out \"$RUNNER_TEMP/review-admit-replay.json\"\n\nnpm run --silent asoiaf:answer-transport -- issue \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/assembler.crt\" \\\n  --client-key \"$certificate_directory/assembler.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-close-issue-0001' \\\n  --input \"$fixture_directory/close-issue-body.json\" \\\n  --out \"$RUNNER_TEMP/close-issue-first.json\"\nnpm run --silent asoiaf:answer-transport -- issue \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/assembler.crt\" \\\n  --client-key \"$certificate_directory/assembler.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-close-issue-0001' \\\n  --input \"$fixture_directory/close-issue-body.json\" \\\n  --out \"$RUNNER_TEMP/close-issue-replay.json\"\n\nnode <<'NODE'\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst temp = process.env.RUNNER_TEMP;\nconst fixture = path.join(temp, 'answer-transport-fixture');\nconst template = JSON.parse(fs.readFileSync(path.join(fixture, 'close-result-template.json'), 'utf8'));\nconst issued = JSON.parse(fs.readFileSync(path.join(temp, 'close-issue-first.json'), 'utf8'));\ntemplate.assignmentId = issued.response.payload.assignment.assignmentId;\nfs.writeFileSync(path.join(fixture, 'close-result-body.json'), `${JSON.stringify(template, null, 2)}\\n`);\nNODE\n\nnpm run --silent asoiaf:answer-transport -- admit \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/assembler.crt\" \\\n  --client-key \"$certificate_directory/assembler.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-close-admit-0001' \\\n  --input \"$fixture_directory/close-result-body.json\" \\\n  --out \"$RUNNER_TEMP/close-admit-first.json\"\nnpm run --silent asoiaf:answer-transport -- admit \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/assembler.crt\" \\\n  --client-key \"$certificate_directory/assembler.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-close-admit-0001' \\\n  --input \"$fixture_directory/close-result-body.json\" \\\n  --out \"$RUNNER_TEMP/close-admit-replay.json\"\n\nnpm run --silent asoiaf:answer-worker -- run \\\n  --input \"$fixture_directory/render-run-input.json\" \\\n  --out \"$RUNNER_TEMP/render-run-first.json\"\nnpm run --silent asoiaf:answer-worker -- run \\\n  --input \"$fixture_directory/render-run-input.json\" \\\n  --out \"$RUNNER_TEMP/render-run-replay.json\"\n\nrevoked_at=\"$(date -u +'%Y-%m-%dT%H:%M:%S.000Z')\"\nnpm run --silent asoiaf:answer-transport -- revoke \\\n  --root \"$estate_root\" \\\n  --certificate \"$certificate_directory/reviewer.crt\" \\\n  --revoked-at \"$revoked_at\" \\\n  --reason 'The qualification reviewer certificate is revoked after its retained transactions.' \\\n  --operator-id 'qualification:answer-transport-revoke-reviewer' \\\n  --out \"$RUNNER_TEMP/reviewer-revocation.json\"\nif npm run --silent asoiaf:answer-transport -- issue \\\n  --url \"$base_url\" \\\n  --client-certificate \"$certificate_directory/reviewer.crt\" \\\n  --client-key \"$certificate_directory/reviewer.key\" \\\n  --ca-certificate \"$certificate_directory/ca.crt\" \\\n  --idempotency-key 'qualification-revoked-client-0001' \\\n  --input \"$fixture_directory/review-issue-body.json\" \\\n  --out \"$RUNNER_TEMP/revoked-client.json\"; then\n  echo 'revoked certificate was accepted' >&2\n  exit 1\nfi\n\ncleanup\ntrap - EXIT\n\nnpm run --silent asoiaf:answer-transport -- status \\\n  --root \"$estate_root\" \\\n  --out \"$RUNNER_TEMP/transport-status.json\"\nnpm run --silent asoiaf:answer-transport -- verify \\\n  --root \"$estate_root\" \\\n  --out \"$RUNNER_TEMP/transport-verification.json\"\nnpm run --silent asoiaf:answer-transport -- paths \\\n  --root \"$estate_root\" \\\n  --out \"$RUNNER_TEMP/transport-paths.json\"\nnpm run --silent asoiaf:answer-exchange -- status \\\n  --root \"$estate_root\" \\\n  --out \"$RUNNER_TEMP/exchange-status.json\"\nnpm run --silent asoiaf:answer-exchange -- verify \\\n  --root \"$estate_root\" \\\n  --out \"$RUNNER_TEMP/exchange-verification.json\"\nnpm run --silent asoiaf:answer-worker -- status \\\n  --root \"$estate_root\" \\\n  --out \"$RUNNER_TEMP/worker-status.json\"\nnpm run --silent asoiaf:answer-worker -- verify \\\n  --root \"$estate_root\" \\\n  --out \"$RUNNER_TEMP/worker-verification.json\"\nnpm run --silent asoiaf:answer-desk -- status \\\n  --root \"$estate_root\" \\\n  > \"$RUNNER_TEMP/desk-status.json\"\nnpm run --silent asoiaf:answer-desk -- verify \\\n  --root \"$estate_root\" \\\n  > \"$RUNNER_TEMP/desk-verification.json\"\n\nnode <<'NODE'\nconst crypto = require('node:crypto');\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst assert = require('node:assert/strict');\nconst temp = process.env.RUNNER_TEMP;\nconst read = (name) => JSON.parse(fs.readFileSync(path.join(temp, name), 'utf8'));\nconst fixtureDir = path.join(temp, 'answer-transport-fixture');\nconst expected = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'expected.json'), 'utf8'));\nconst reviewerFingerprint = read('reviewer-fingerprint.json');\nconst assemblerFingerprint = read('assembler-fingerprint.json');\nconst reviewerRegistration = read('reviewer-registration.json');\nconst assemblerRegistration = read('assembler-registration.json');\nconst unregistered = read('unregistered-client.json');\nconst bodyConflict = read('idempotency-body-conflict.json');\nconst peerConflict = read('idempotency-peer-conflict.json');\nconst reviewIssue = read('review-issue-first.json');\nconst reviewIssueReplay = read('review-issue-replay.json');\nconst reviewAdmit = read('review-admit-first.json');\nconst reviewAdmitReplay = read('review-admit-replay.json');\nconst closeIssue = read('close-issue-first.json');\nconst closeIssueReplay = read('close-issue-replay.json');\nconst closeAdmit = read('close-admit-first.json');\nconst closeAdmitReplay = read('close-admit-replay.json');\nconst render = read('render-run-first.json');\nconst renderReplay = read('render-run-replay.json');\nconst revocation = read('reviewer-revocation.json');\nconst revoked = read('revoked-client.json');\nconst transportStatus = read('transport-status.json');\nconst transportVerification = read('transport-verification.json');\nconst transportPaths = read('transport-paths.json');\nconst exchangeStatus = read('exchange-status.json');\nconst exchangeVerification = read('exchange-verification.json');\nconst workerStatus = read('worker-status.json');\nconst workerVerification = read('worker-verification.json');\nconst deskStatus = read('desk-status.json');\nconst deskVerification = read('desk-verification.json');\n\nassert.equal(reviewerFingerprint.ok, true);\nassert.equal(assemblerFingerprint.ok, true);\nassert.equal(reviewerRegistration.registration.certificateFingerprint, reviewerFingerprint.certificateFingerprint);\nassert.equal(assemblerRegistration.registration.certificateFingerprint, assemblerFingerprint.certificateFingerprint);\nassert.equal(reviewerRegistration.registration.actorId, expected.reviewActor.actorId);\nassert.equal(assemblerRegistration.registration.actorId, expected.assemblerActor.actorId);\nassert.equal(reviewerRegistration.registration.certificateRetained, false);\nassert.equal(reviewerRegistration.registration.privateKeyRetained, false);\n\nassert.equal(unregistered.error.code, 'actor-not-registered');\nassert.equal(unregistered.request, null);\nassert.equal(unregistered.response, null);\nassert.equal(bodyConflict.error.code, 'idempotency-key-conflict');\nassert.equal(peerConflict.error.code, 'idempotency-key-conflict');\nassert.equal(revoked.error.code, 'actor-certificate-revoked');\nassert.equal(revoked.request, null);\nassert.equal(revoked.response, null);\n\nfor (const result of [reviewIssue, reviewAdmit, closeIssue, closeAdmit]) {\n  assert.equal(result.ok, true);\n  assert.equal(result.statusCode, 200);\n  assert.equal(result.requestReplayed, false);\n  assert.equal(result.responseReplayed, false);\n  assert.equal(result.request.authority, 'none');\n  assert.equal(result.response.authority, 'none');\n}\nfor (const result of [reviewIssueReplay, reviewAdmitReplay, closeIssueReplay, closeAdmitReplay]) {\n  assert.equal(result.ok, true);\n  assert.equal(result.requestReplayed, true);\n  assert.equal(result.responseReplayed, true);\n}\nassert.equal(reviewIssue.response.payload.assignment.itemId, expected.reviewItemId);\nassert.equal(reviewIssue.response.payload.assignment.actorId, expected.reviewActor.actorId);\nassert.equal(reviewIssue.response.payload.assignment.actorRole, expected.reviewActor.actorRole);\nassert.equal(reviewAdmit.response.payload.result.afterWorkOrderId, expected.reconciledWorkOrderId);\nassert.equal(closeIssue.response.payload.assignment.itemId, expected.closeItemId);\nassert.equal(closeIssue.response.payload.assignment.actorId, expected.assemblerActor.actorId);\nassert.equal(closeAdmit.response.payload.result.afterWorkOrderId, expected.readyWorkOrderId);\n\nassert.equal(render.claim.replayed, false);\nassert.equal(render.result.outcome, 'rendered');\nassert.equal(renderReplay.claim.replayed, true);\nassert.equal(renderReplay.invocationReplayed, true);\nassert.equal(renderReplay.resultReplayed, true);\nassert.equal(renderReplay.settlement.replayed, true);\nassert.equal(revocation.revocation.registrationId, reviewerRegistration.registration.registrationId);\n\nassert.equal(transportStatus.ok, true);\nassert.equal(transportStatus.counts.registrations, 2);\nassert.equal(transportStatus.counts.activeRegistrations, 1);\nassert.equal(transportStatus.counts.revocations, 1);\nassert.equal(transportStatus.counts.requests, 4);\nassert.equal(transportStatus.counts.responses, 4);\nassert.equal(transportStatus.counts.succeededResponses, 4);\nassert.equal(transportStatus.counts.refusedResponses, 0);\nassert.equal(transportStatus.requests.every((entry) => entry.privateTextIncluded === false), true);\nassert.equal(transportStatus.requests.every((entry) => entry.sourceTextIncluded === false), true);\nassert.equal(transportStatus.requests.every((entry) => entry.authority === 'none'), true);\nassert.equal(transportStatus.responses.every((entry) => entry.authority === 'none'), true);\nassert.equal(transportVerification.ok, true);\nassert.equal(transportVerification.counts.errors, 0);\n\nassert.equal(exchangeStatus.ok, true);\nassert.equal(exchangeStatus.counts.assignments, 2);\nassert.equal(exchangeStatus.counts.results, 2);\nassert.equal(exchangeStatus.counts.automaticAvailable, 0);\nassert.equal(exchangeStatus.counts.externalAvailable, 0);\nassert.equal(exchangeStatus.plan.nextAutomaticItemId, null);\nassert.equal(workerStatus.ok, true);\nassert.equal(workerStatus.counts.invocations, 1);\nassert.equal(workerStatus.counts.results, 1);\nassert.equal(workerStatus.counts.automaticAvailable, 0);\nassert.equal(deskStatus.ok, true);\nassert.equal(deskStatus.counts.workOrders, 3);\nassert.equal(deskStatus.counts.leases, 3);\nassert.equal(deskStatus.counts.settlements, 3);\nassert.deepEqual(deskStatus.state.availableItemIds, []);\nassert.equal(deskStatus.state.nextAvailableItemId, null);\nfor (const verification of [exchangeVerification, workerVerification, deskVerification]) {\n  assert.equal(verification.ok, true);\n  assert.deepEqual(verification.findings.filter((entry) => entry.severity === 'error'), []);\n}\n\nfor (const directory of [transportPaths.actors, transportPaths.revocations, transportPaths.requests, transportPaths.responses]) {\n  const names = fs.readdirSync(directory);\n  assert.equal(names.every((name) => /^[a-f0-9]{64}\\.json$/.test(name)), true);\n}\nconst forbidden = [];\nfor (const entry of fs.readdirSync(expected.estateRoot, { recursive: true, withFileTypes: true })) {\n  if (entry.isFile() && /\\.(?:key|crt|pem|csr)$/i.test(entry.name)) forbidden.push(entry.name);\n}\nassert.deepEqual(forbidden, []);\nconst renderReference = render.result.resultReferences.find((entry) => entry.kind === 'reviewed-answer-render');\nassert.ok(renderReference);\nconst output = fs.readFileSync(path.resolve(expected.estateRoot, renderReference.uri), 'utf8');\nassert.equal([...output].length, expected.renderedTextCharacters);\nassert.equal(`sha256:${crypto.createHash('sha256').update(output).digest('hex')}`, expected.renderedTextDigest);\nassert.equal(fs.existsSync(path.join(expected.estateRoot, '.transaction-lock')), false);\nNODE\n\n";

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

function itemId(
  workOrder: AsoiafAnswerWorkOrder,
  action: AsoiafAnswerWorkAction,
): string {
  const item = workOrder.items.find((entry) => entry.action === action);
  if (!item) throw new Error(`transport fixture work order lacks ${action}`);
  return item.itemId;
}

const outputDirectory = path.resolve(OUTPUT_DIRECTORY);
const estateRoot = path.resolve(ESTATE_ROOT);
const fixture = buildAsoiafAnswerDeskFixture();

const reviewActor = {
  actorId: "actor:qualification:transport:exact-locator-reviewer",
  actorRole: "exact-locator-reviewer" as const,
};
const assemblerActor = {
  actorId: "actor:qualification:transport:answer-assembler",
  actorRole: "answer-assembler" as const,
};
const adoptInput: AsoiafAnswerDeskAdoptInput = {
  root: estateRoot,
  workOrder: fixture.openWorkOrder,
  adoptedAt: "2026-08-05T06:20:01.000Z",
  operatorId: "qualification:answer-transport-adopt",
};
const reviewIssueBody: AsoiafAnswerTransportIssueBody = {
  itemId: itemId(fixture.openWorkOrder, "review-exact-locator"),
  claimedAt: "2026-08-05T06:21:00.000Z",
  issuedAt: "2026-08-05T06:21:01.000Z",
  leaseMilliseconds: 600_000,
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
    "The authenticated qualification reviewer returned the exact content-addressed transaction that proves the stable locator-review item satisfied.",
};
const closeIssueBody: AsoiafAnswerTransportIssueBody = {
  itemId: itemId(fixture.reconciledWorkOrder, "close-gap"),
  claimedAt: "2026-08-05T06:31:00.000Z",
  issuedAt: "2026-08-05T06:31:01.000Z",
  leaseMilliseconds: 600_000,
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
    "The authenticated qualification assembler returned the exact reviewed packet that closes the immutable gap and proves the stable close item satisfied.",
};
const renderRunInput: AsoiafAnswerDeskWorkerRunInput = {
  root: estateRoot,
  itemId: itemId(fixture.readyWorkOrder, "render-reviewed-answer"),
  claimedAt: "2026-08-05T06:41:10.000Z",
  requestedAt: "2026-08-05T06:41:11.000Z",
  completedAt: "2026-08-05T06:41:20.000Z",
  leaseMilliseconds: 60_000,
  operatorId: "qualification:answer-transport-render",
};
const expected = {
  estateRoot,
  reviewActor,
  assemblerActor,
  registeredAt: "2026-08-05T06:00:00.000Z",
  openWorkOrderId: fixture.openWorkOrder.workOrderId,
  reconciledWorkOrderId: fixture.reconciledWorkOrder.workOrderId,
  readyWorkOrderId: fixture.readyWorkOrder.workOrderId,
  reviewItemId: reviewIssueBody.itemId,
  closeItemId: closeIssueBody.itemId,
  renderItemId: renderRunInput.itemId,
  transactionId: fixture.transaction.transactionId,
  transactionFingerprint: fixture.transaction.transactionFingerprint,
  answerPacketId: fixture.answerPacket.answerPacketId,
  answerPacketFingerprint: fixture.answerPacket.answerPacketFingerprint,
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
  fs.writeFileSync(
    path.join(outputDirectory, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    outputDirectory,
    estateRoot,
    reviewActor,
    assemblerActor,
    reviewItemId: expected.reviewItemId,
    closeItemId: expected.closeItemId,
    renderItemId: expected.renderItemId,
  }, null, 2)}\n`,
);
