#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  buildAsoiafAnswerWorkOrder,
  validateAsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkItem,
  type AsoiafAnswerWorkOrder,
  type AsoiafAnswerWorkOrderInput,
} from "./lib/asoiaf-answer-work-order.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

function value(name: string, fallback?: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

function required(name: string): string {
  const result = value(name);
  if (!result) throw new Error(`--${name} is required`);
  return result;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as T;
}

function print(output: unknown): void {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function writeJson(
  output: unknown,
  target: string | undefined,
  receipt: Record<string, unknown>,
): void {
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (!target) {
    process.stdout.write(serialized);
    return;
  }
  const resolved = path.resolve(target);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, serialized, "utf8");
  print({ ok: true, output: resolved, ...receipt });
}

function summarizeItem(item: AsoiafAnswerWorkItem) {
  return {
    itemId: item.itemId,
    action: item.action,
    stage: item.stage,
    status: item.status,
    requiredForBoundedComplete: item.requiredForBoundedComplete,
    subjectIds: item.subjectIds,
    dependencyItemIds: item.dependencyItemIds,
    reason: item.reason,
  };
}

function summary(workOrder: AsoiafAnswerWorkOrder) {
  const findings = validateAsoiafAnswerWorkOrder(workOrder);
  const errors = findings.filter((entry) => entry.severity === "error");
  return {
    ok: errors.length === 0,
    workOrderId: workOrder.workOrderId,
    workOrderFingerprint: workOrder.workOrderFingerprint,
    dossierId: workOrder.dossierId,
    questionId: workOrder.questionId,
    status: workOrder.status,
    answerReady: workOrder.answerReady,
    boundedComplete: workOrder.boundedComplete,
    countsByStatus: workOrder.countsByStatus,
    resolvedCandidateIds: workOrder.resolvedCandidateIds,
    unresolvedCandidateIds: workOrder.unresolvedCandidateIds,
    reviewedPrivateReferenceIds: workOrder.reviewedPrivateReferenceIds,
    unreviewedPrivateReferenceIds: workOrder.unreviewedPrivateReferenceIds,
    closedGapIds: workOrder.closedGapIds,
    limitedGapIds: workOrder.limitedGapIds,
    openGapIds: workOrder.openGapIds,
    openDispositionReferenceIds: workOrder.openDispositionReferenceIds,
    openItems: workOrder.items
      .filter((item) => item.status === "open")
      .map(summarizeItem),
    blockedItems: workOrder.items
      .filter((item) => item.status === "blocked")
      .map(summarizeItem),
    findings,
  };
}

function usage(): void {
  process.stdout.write("ASOIAF answer work order\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  build   Compile one deterministic lifecycle work order\n");
  process.stdout.write("  verify  Verify dossier, transaction, packet, task, dependency, projection, and fingerprint custody\n");
  process.stdout.write("  status  Show complete lifecycle status, open work, and blockers\n");
  process.stdout.write("  next    Return the first exact open item and its dependencies\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>  Work-order input containing dossier and optional transactions or answer packet\n");
  process.stdout.write("  --file <json>   Emitted answer work order\n");
  process.stdout.write("  --out <path>    Optional output path for build\n");
}

try {
  switch (command) {
    case "build": {
      const input = readJson<AsoiafAnswerWorkOrderInput>(required("input"));
      const workOrder = buildAsoiafAnswerWorkOrder(input);
      writeJson(workOrder, value("out"), {
        workOrderId: workOrder.workOrderId,
        workOrderFingerprint: workOrder.workOrderFingerprint,
        status: workOrder.status,
        answerReady: workOrder.answerReady,
        boundedComplete: workOrder.boundedComplete,
      });
      break;
    }
    case "verify": {
      const workOrder = readJson<AsoiafAnswerWorkOrder>(required("file"));
      const report = summary(workOrder);
      print(report);
      if (!report.ok) process.exitCode = 1;
      break;
    }
    case "status": {
      const workOrder = readJson<AsoiafAnswerWorkOrder>(required("file"));
      const report = summary(workOrder);
      print(report);
      if (!report.ok) process.exitCode = 1;
      break;
    }
    case "next": {
      const workOrder = readJson<AsoiafAnswerWorkOrder>(required("file"));
      const report = summary(workOrder);
      const nextItem = workOrder.items.find((item) => item.status === "open") ?? null;
      print({
        ok: report.ok,
        workOrderId: workOrder.workOrderId,
        status: workOrder.status,
        answerReady: workOrder.answerReady,
        boundedComplete: workOrder.boundedComplete,
        nextItem: nextItem ? summarizeItem(nextItem) : null,
        blockedItems: report.blockedItems,
        findings: report.findings,
      });
      if (!report.ok) process.exitCode = 1;
      break;
    }
    case "help":
    case "--help":
    case "-h":
      usage();
      break;
    default:
      throw new Error(`unknown command ${command}`);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}