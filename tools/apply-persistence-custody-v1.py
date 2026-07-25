from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new))


replace_once(
    "src/game/lib/ledger.ts",
    'import { buildStartingOrg } from "../../sim/cartridge-conformance.js";\n',
    '''import { buildStartingOrg } from "../../sim/cartridge-conformance.js";
import { parseBoundedJson } from "../../engine/bounded-json.js";
import {
  removeStorageTransaction,
  serializationFailure,
  writeStorageTransaction,
  type RecoveryArtifact,
  type SaveResult,
  type StorageWriter,
} from "./persistence.js";
''',
)
replace_once(
    "src/game/lib/ledger.ts",
    '''export function loadLedger(): CampaignLedger | null {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (ledgerShapeErrors(parsed).length > 0) return null;   // reject non-ledger blobs (parity with importLedger)
    return migrate(parsed as CampaignLedger);                // migrate may refuse (null) a newer schema
  } catch {
    return null;
  }
}
export function saveLedger(ledger: CampaignLedger): void {
  try { localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)); } catch { /* headless / quota */ }
}
export function clearLedger(): void {
  try { localStorage.removeItem(LEDGER_KEY); } catch { /* headless */ }
}
export function exportLedger(ledger: CampaignLedger): { filename: string; json: string } {
  return { filename: `${ledger.guild.name.replace(/\\s+/g, "-").toLowerCase()}.guild.json`, json: JSON.stringify(ledger, null, 2) };
}''',
    '''export function loadLedger(storage: StorageWriter = localStorage): CampaignLedger | null {
  try {
    const raw = storage.getItem(LEDGER_KEY);
    if (!raw) return null;
    const parsed = parseBoundedJson(raw, { maxBytes: 12 * 1024 * 1024 });
    if (ledgerShapeErrors(parsed).length > 0) return null;   // reject non-ledger blobs (parity with importLedger)
    return migrate(parsed as CampaignLedger);                // migrate may refuse (null) a newer schema
  } catch {
    return null;
  }
}
export function saveLedger(
  ledger: CampaignLedger,
  storage?: StorageWriter | null,
): SaveResult {
  let json: string;
  try {
    json = JSON.stringify(ledger);
  } catch {
    return serializationFailure("Saving the campaign ledger");
  }
  return writeStorageTransaction(LEDGER_KEY, json, storage, "Saving the campaign ledger");
}
export function clearLedger(storage?: StorageWriter | null): SaveResult {
  return removeStorageTransaction(LEDGER_KEY, storage, "Clearing the campaign ledger");
}
export function exportLedger(ledger: CampaignLedger): RecoveryArtifact {
  return { filename: `${ledger.guild.name.replace(/\\s+/g, "-").toLowerCase()}.guild.json`, json: JSON.stringify(ledger, null, 2) };
}''',
)

replace_once(
    "src/game/lib/raid-night.ts",
    'import type { Agent, Arc, Challenge, Organization, RunReport } from "../../engine/types.js";\n',
    'import type { SaveResult, StorageWriter } from "./persistence.js";\nimport type { Agent, Arc, Challenge, Organization, RunReport } from "../../engine/types.js";\n',
)
replace_once(
    "src/game/lib/raid-night.ts",
    '''/** Commit a cleared night to the guild record ("Commit to Guild Record"). May
 *  advance progression. Persists locally and returns the new ledger. */
export function commitNightVictory(state: RaidNightState): CampaignLedger {
  const led = commitVictory(state.ledger, nightResult(state));
  saveLedger(led);
  return led;
}

/** Commit a failed lockout ("Call It a Night"). Preserves scars/morale/stress/
 *  attendance/bench/best-pull; does not advance the tier gate. */
export function commitNightFailed(state: RaidNightState): CampaignLedger {
  const led = commitFailedLockout(state.ledger, nightResult(state));
  saveLedger(led);
  return led;
}''',
    '''/** Pure/headless adapter: commit a cleared night to a new in-memory ledger.
 * Interactive callers use the result-bearing path so a browser write failure
 * cannot be mislabeled as a committed record. */
export function commitNightVictory(state: RaidNightState): CampaignLedger {
  return commitVictory(state.ledger, nightResult(state));
}

/** Pure/headless adapter for a failed lockout. */
export function commitNightFailed(state: RaidNightState): CampaignLedger {
  return commitFailedLockout(state.ledger, nightResult(state));
}

export interface LedgerCommitResult {
  ledger: CampaignLedger;
  save: SaveResult;
}

export function commitNightVictoryWithResult(
  state: RaidNightState,
  storage?: StorageWriter | null,
): LedgerCommitResult {
  const ledger = commitVictory(state.ledger, nightResult(state));
  return { ledger, save: saveLedger(ledger, storage) };
}

export function commitNightFailedWithResult(
  state: RaidNightState,
  storage?: StorageWriter | null,
): LedgerCommitResult {
  const ledger = commitFailedLockout(state.ledger, nightResult(state));
  return { ledger, save: saveLedger(ledger, storage) };
}''',
)

replace_once(
    "src/game/components/RaidNightScreen.tsx",
    '''  RAID_ARC_T2, newRaidNight, newRaidNightFrom, pull, applyFix, toggleFielded, partyLegal,
  nightConsequences, commitNightVictory, commitNightFailed,
  type RaidNightState,
} from "../lib/raid-night.js";''',
    '''  RAID_ARC_T2, newRaidNight, newRaidNightFrom, pull, applyFix, toggleFielded, partyLegal,
  nightConsequences, commitNightVictoryWithResult, commitNightFailedWithResult,
  type LedgerCommitResult, type RaidNightState,
} from "../lib/raid-night.js";
import { exportLedger, saveLedger } from "../lib/ledger.js";
import { downloadJsonArtifact } from "../lib/download.js";''',
)
replace_once(
    "src/game/components/RaidNightScreen.tsx",
    '''  const [state, setState] = useState<RaidNightState>(() => newRaidNight(1));
  const [committed, setCommitted] = useState<import("../lib/ledger.js").CampaignLedger | null>(null);
  const boss = bossOf(state.arc);''',
    '''  const [state, setState] = useState<RaidNightState>(() => newRaidNight(1));
  const [commitAttempt, setCommitAttempt] = useState<LedgerCommitResult | null>(null);
  const [recoveryExported, setRecoveryExported] = useState(false);
  const committed = commitAttempt?.save.ok ? commitAttempt.ledger : null;
  const commitFailure = commitAttempt && !commitAttempt.save.ok ? commitAttempt.save : null;
  const boss = bossOf(state.arc);''',
)
replace_once(
    "src/game/components/RaidNightScreen.tsx",
    '  const party = state.partyIds.map((id) => state.org.agents[id]).filter(Boolean) as Agent[];',
    '''  const recordCommit = (result: LedgerCommitResult) => {
    setCommitAttempt(result);
    setRecoveryExported(false);
  };

  const retryCommit = () => {
    if (!commitAttempt) return;
    setCommitAttempt({ ...commitAttempt, save: saveLedger(commitAttempt.ledger) });
    setRecoveryExported(false);
  };

  const exportCommitRecovery = () => {
    if (!commitAttempt || !commitFailure?.recoverable) return;
    downloadJsonArtifact(exportLedger(commitAttempt.ledger));
    setRecoveryExported(true);
  };

  const party = state.partyIds.map((id) => state.org.agents[id]).filter(Boolean) as Agent[];''',
)
replace_once(
    "src/game/components/RaidNightScreen.tsx",
    '{committed ? t("raidnight.committed") : t("raidnight.ledgerNone")}',
    '{committed ? t("raidnight.committed") : commitFailure ? t("persistence.unsaved") : t("raidnight.ledgerNone")}',
)
replace_once(
    "src/game/components/RaidNightScreen.tsx",
    '      {state.blocked ? (',
    '''      {commitFailure && (
        <div
          className="card danger persistence-alert"
          data-testid="ledger-save-failure"
          role="alert"
          style={{ margin: "12px 16px", padding: 14 }}
        >
          <strong>{t("persistence.unsaved")}</strong>
          <div>{commitFailure.reason === "serialization"
            ? t("persistence.serializationFailure")
            : commitFailure.reason === "rollback"
              ? t("persistence.rollbackFailure")
              : t("persistence.failure", { reason: commitFailure.reason })}</div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button className="secondary" onClick={retryCommit}>{t("persistence.retry")}</button>
            {commitFailure.recoverable && (
              <button className="secondary" onClick={exportCommitRecovery}>{t("persistence.exportRecovery")}</button>
            )}
          </div>
          {recoveryExported && <div role="status">{t("persistence.recoveryExported")}</div>}
        </div>
      )}

      {state.blocked ? (''',
)
replace_once(
    "src/game/components/RaidNightScreen.tsx",
    '<button className="secondary" onClick={() => { commitNightFailed(state); setCommitted(state.ledger); }}>',
    '<button className="secondary" onClick={() => recordCommit(commitNightFailedWithResult(state))}>',
)
replace_once(
    "src/game/components/RaidNightScreen.tsx",
    '''            {state.cleared && <Consequence state={state} committed={committed}
              onCommit={() => setCommitted(commitNightVictory(state))}
              onNextTier={() => { setState(newRaidNightFrom(RAID_ARC_T2, committed, 1)); setCommitted(null); }}
              onTryIncompatible={() => { setState(newRaidNightFrom(INCOMPATIBLE, committed, 1)); setCommitted(null); }}
              nextBoss={bossOf(RAID_ARC_T2).name} />}''',
    '''            {state.cleared && <Consequence state={state} committed={committed}
              onCommit={() => recordCommit(commitNightVictoryWithResult(state))}
              onNextTier={() => { setState(newRaidNightFrom(RAID_ARC_T2, committed, 1)); setCommitAttempt(null); }}
              onTryIncompatible={() => { setState(newRaidNightFrom(INCOMPATIBLE, committed, 1)); setCommitAttempt(null); }}
              nextBoss={bossOf(RAID_ARC_T2).name} />}''',
)
replace_once(
    "src/game/components/RaidNightScreen.tsx",
    '<button className="secondary" onClick={() => { setState(newRaidNight(1)); setCommitted(null); }}>{t("raidnight.reset")}</button>',
    '<button className="secondary" onClick={() => { setState(newRaidNight(1)); setCommitAttempt(null); setRecoveryExported(false); }}>{t("raidnight.reset")}</button>',
)

replace_once(
    "src/i18n/messages.ts",
    '  | "common.fail"\n',
    '''  | "common.fail"
  // ── load-bearing persistence ──
  | "persistence.unsaved"
  | "persistence.failure"
  | "persistence.serializationFailure"
  | "persistence.rollbackFailure"
  | "persistence.retry"
  | "persistence.exportRecovery"
  | "persistence.recoveryExported"
''',
)
replace_once(
    "src/i18n/messages.ts",
    '''    "common.pass": "PASS",
    "common.fail": "FAIL",
''',
    '''    "common.pass": "PASS",
    "common.fail": "FAIL",

    "persistence.unsaved": "Unsaved",
    "persistence.failure": (p) => `Storage write failed (${str(p, "reason")}). This session is still in memory; do not close this page until retry succeeds or you export a recovery file.`,
    "persistence.serializationFailure": "The current state could not be serialized. It remains in memory, but no recovery file can be prepared yet. Do not close this page.",
    "persistence.rollbackFailure": "The write failed and the previous stored value could not be verified. Keep this page open and export the in-memory recovery file before doing anything else.",
    "persistence.retry": "Retry save",
    "persistence.exportRecovery": "Export recovery file",
    "persistence.recoveryExported": "Recovery file exported.",
''',
)
replace_once(
    "src/i18n/messages.ts",
    '''    "common.pass": "通過",
    "common.fail": "未過",
''',
    '''    "common.pass": "通過",
    "common.fail": "未過",

    "persistence.unsaved": "尚未儲存",
    "persistence.failure": (p) => `儲存空間寫入失敗（${str(p, "reason")}）。目前資料仍在記憶體中；在重試成功或匯出復原檔之前，請勿關閉此頁面。`,
    "persistence.serializationFailure": "目前狀態無法序列化。資料仍在記憶體中，但尚無法建立復原檔；請勿關閉此頁面。",
    "persistence.rollbackFailure": "寫入失敗，且無法驗證先前的儲存值。請保持此頁面開啟，並先匯出記憶體中的復原檔。",
    "persistence.retry": "重試儲存",
    "persistence.exportRecovery": "匯出復原檔",
    "persistence.recoveryExported": "復原檔已匯出。",
''',
)
