#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  buildAsoiafAnswerDeskState,
  claimAsoiafAnswerWorkItem,
  settleAsoiafAnswerWorkItem,
  validateAsoiafAnswerDeskState,
  validateAsoiafAnswerWorkLease,
  validateAsoiafAnswerWorkSettlement,
  type AsoiafAnswerDeskState,
  type AsoiafAnswerDeskStateInput,
  type AsoiafAnswerWorkLease,
  type AsoiafAnswerWorkLeaseInput,
  type AsoiafAnswerWorkSettlement,
  type AsoiafAnswerWorkSettlementInput,
} from "./lib/asoiaf-answer-work-lease.js";
import type {
  AsoiafAnswerWorkOrder,
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

function usage(): void {
  process.stdout.write("ASOIAF answer work lease\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  claim              Claim one exact open work item with a bounded immutable lease\n");
  process.stdout.write("  settle             Record advancement or an honest non-advancing terminal\n");
  process.stdout.write("  state              Compile active, expired, stale, settled, available, and blocked desk state\n");
  process.stdout.write("  verify-lease       Verify one lease against its exact work order\n");
  process.stdout.write("  verify-settlement  Verify one settlement against lease and before/after work orders\n");
  process.stdout.write("  verify-state       Verify one deterministic desk-state projection\n\n");
  process.stdout.write("Options:\n");
  process.stdout.write("  --input <json>       Claim, settlement, or state input\n");
  process.stdout.write("  --out <path>         Optional emitted JSON path\n");
  process.stdout.write("  --lease <json>       Lease JSON for verification\n");
  process.stdout.write("  --settlement <json>  Settlement JSON for verification\n");
  process.stdout.write("  --state <json>       Desk-state JSON for verification\n");
  process.stdout.write("  --work-order <json>  Exact work order for lease verification\n");
  process.stdout.write("  --before <json>      Before work order for settlement verification\n");
  process.stdout.write("  --after <json>       Optional after work order for settlement verification\n");
}

try {
  switch (command) {
    case "claim": {
      const input = readJson<AsoiafAnswerWorkLeaseInput>(required("input"));
      const lease = claimAsoiafAnswerWorkItem(input);
      writeJson(lease, value("out"), {
        leaseId: lease.leaseId,
        leaseFingerprint: lease.leaseFingerprint,
        workOrderId: lease.workOrderId,
        itemId: lease.itemId,
        action: lease.action,
        expiresAt: lease.expiresAt,
      });
      break;
    }
    case "settle": {
      const input = readJson<AsoiafAnswerWorkSettlementInput>(required("input"));
      const settlement = settleAsoiafAnswerWorkItem(input);
      writeJson(settlement, value("out"), {
        settlementId: settlement.settlementId,
        settlementFingerprint: settlement.settlementFingerprint,
        leaseId: settlement.leaseId,
        outcome: settlement.outcome,
        afterWorkOrderId: settlement.afterWorkOrderId,
        afterStatus: settlement.afterStatus,
      });
      break;
    }
    case "state": {
      const input = readJson<AsoiafAnswerDeskStateInput>(required("input"));
      const state = buildAsoiafAnswerDeskState(input);
      writeJson(state, value("out"), {
        stateId: state.stateId,
        stateFingerprint: state.stateFingerprint,
        workOrderId: state.workOrderId,
        nextAvailableItemId: state.nextAvailableItemId,
        activeLeaseCount: state.activeLeaseIds.length,
        availableItemCount: state.availableItemIds.length,
      });
      break;
    }
    case "verify-lease": {
      const lease = readJson<AsoiafAnswerWorkLease>(required("lease"));
      const workOrder = readJson<AsoiafAnswerWorkOrder>(required("work-order"));
      const findings = validateAsoiafAnswerWorkLease(lease, workOrder);
      const errors = findings.filter((entry) => entry.severity === "error");
      print({
        ok: errors.length === 0,
        findings,
        leaseId: lease.leaseId,
        workOrderId: lease.workOrderId,
        itemId: lease.itemId,
        action: lease.action,
        workerId: lease.workerId,
        expiresAt: lease.expiresAt,
      });
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "verify-settlement": {
      const settlement = readJson<AsoiafAnswerWorkSettlement>(
        required("settlement"),
      );
      const lease = readJson<AsoiafAnswerWorkLease>(required("lease"));
      const beforeWorkOrder = readJson<AsoiafAnswerWorkOrder>(required("before"));
      const afterPath = value("after");
      const afterWorkOrder = afterPath
        ? readJson<AsoiafAnswerWorkOrder>(afterPath)
        : null;
      const findings = validateAsoiafAnswerWorkSettlement(settlement, {
        lease,
        beforeWorkOrder,
        afterWorkOrder,
      });
      const errors = findings.filter((entry) => entry.severity === "error");
      print({
        ok: errors.length === 0,
        findings,
        settlementId: settlement.settlementId,
        leaseId: settlement.leaseId,
        outcome: settlement.outcome,
        beforeWorkOrderId: settlement.beforeWorkOrderId,
        afterWorkOrderId: settlement.afterWorkOrderId,
        afterStatus: settlement.afterStatus,
      });
      if (errors.length > 0) process.exitCode = 1;
      break;
    }
    case "verify-state": {
      const state = readJson<AsoiafAnswerDeskState>(required("state"));
      const input = readJson<AsoiafAnswerDeskStateInput>(required("input"));
      const findings = validateAsoiafAnswerDeskState(state, input);
      const errors = findings.filter((entry) => entry.severity === "error");
      print({
        ok: errors.length === 0,
        findings,
        stateId: state.stateId,
        workOrderId: state.workOrderId,
        activeLeaseIds: state.activeLeaseIds,
        expiredLeaseIds: state.expiredLeaseIds,
        staleLeaseIds: state.staleLeaseIds,
        settledLeaseIds: state.settledLeaseIds,
        nextAvailableItemId: state.nextAvailableItemId,
      });
      if (errors.length > 0) process.exitCode = 1;
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