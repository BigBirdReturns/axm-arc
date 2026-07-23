import { useEffect, useMemo, useState } from "react";
import type { Arc, Organization, RunReport } from "../engine/types.js";
import { runCycle, type ChallengeAssignment, type PendingRewardChoice, type RewardDecision } from "../engine/cycle.js";
import {
  FIRST_CHARTER,
  KARAZHAN,
  KIND_GODS_OF_ILYON,
  LAMP_DISTRICT,
  RELIEF_CIRCUIT,
} from "../arcs/index.js";
import { foundOrganization } from "../engine/founding.js";
import { cartridgeDigest } from "../engine/cartridge-digest.js";
import type { PortableRunExtensions } from "../engine/portable-run.js";
import { loadSave, saveSave, clearSave } from "./lib/storage.js";
import {
  ensureBundledArc,
  loadActiveArcSelection,
  loadArcLibrary,
  saveActiveArc,
} from "./lib/arc-library.js";
import { getAdvanceBlockers, isAdvanceBlocked } from "./lib/advance-blockers.js";
import { triageDrama } from "../engine/drama-triage.js";
import { dramaTabBadge, reportsTabBadge } from "./lib/tab-badges.js";
import { RosterScreen } from "./components/RosterScreen.js";
import { AssignScreen } from "./components/AssignScreen.js";
import { DramaScreen } from "./components/DramaScreen.js";
import { BaseScreen } from "./components/BaseScreen.js";
import { ReportsScreen } from "./components/ReportsScreen.js";
import { SituationSidebar } from "./components/SituationSidebar.js";
import { CycleTransition } from "./components/CycleTransition.js";
import { TutorialGuide, useTutorial, deriveTutorialStep, tutorialPulseTab, tutorialPulseAdvance } from "./components/TutorialGuide.js";
import { TitleScreen } from "./components/TitleScreen.js";
import { LibraryScreen } from "./components/LibraryScreen.js";
import { DesignerScreen } from "./components/DesignerScreen.js";
import { WorkshopScreen } from "./components/WorkshopScreen.js";
import { GodscarForgeScreen } from "./components/GodscarForgeScreen.js";
import { DarkTombForgeScreen } from "./components/DarkTombForgeScreen.js";
import { CommonShipForgeScreen } from "./components/CommonShipForgeScreen.js";
import { RaidNightScreen } from "./components/RaidNightScreen.js";
import { GuildHallScreen } from "./components/GuildHallScreen.js";
import { ExpansionArchiveScreen } from "./components/ExpansionArchiveScreen.js";
import { CountUp } from "../liveness/index.js";
import { CycleChecklist } from "./components/CycleChecklist.js";
import { ThresholdBar } from "./components/ThresholdBar.js";
import { CartridgePortrait } from "./components/CartridgePortrait.js";
import { CodexOverlay } from "../codex/index.js";
import { WhatsNew, CURRENT_BUILD } from "../release-notes/index.js";
import { t, useLocale, type MessageId } from "../i18n/index.js";
import { LocaleSwitcher } from "../i18n/LocaleSwitcher.js";
import { SensorySwitcher } from "./components/SensorySwitcher.js";
import { playArcPresentationCue } from "./lib/sensory-prefs.js";
import { CartridgeEmblem, cartridgeThemeScope } from "./cartridge-theme.js";
import {
  exportPortableRunToJson,
  readHubTurnCheckpoint,
  withHubTurnCheckpoint,
} from "./lib/portable-run.js";

declare const __BUILD_SHA__: string;
const BUILD_SHA = typeof __BUILD_SHA__ === "string" ? __BUILD_SHA__ : "dev";

type Tab = "Roster" | "Assign" | "Drama" | "Base" | "Reports";

// Chrome-only: maps the internal Tab id to its localized nav label. The Tab ids
// themselves stay in English as engine-facing state keys.
const TAB_LABEL_ID: Record<Tab, MessageId> = {
  Roster: "nav.roster",
  Assign: "nav.assign",
  Drama: "nav.drama",
  Base: "nav.base",
  Reports: "nav.reports",
};

// Resolve the active arc: if the user has selected a different arc from the
// library and that arc is present, use it; otherwise fall back to the bundled
// default. Arc-agnostic — nothing here references first-charter beyond the
// bundled-default constant.
function resolveActiveArc(): typeof FIRST_CHARTER {
  ensureBundledArc(FIRST_CHARTER);
  ensureBundledArc(KARAZHAN);
  ensureBundledArc(KIND_GODS_OF_ILYON);
  ensureBundledArc(LAMP_DISTRICT);
  ensureBundledArc(RELIEF_CIRCUIT);
  const selection = loadActiveArcSelection();
  if (selection) {
    const match = loadArcLibrary().find(
      (entry) => entry.arc.meta.id === selection.id
        && cartridgeIdentity(entry.arc) === selection.digest,
    );
    if (match) return match.arc;
  }
  return FIRST_CHARTER;
}

function cartridgeIdentity(arc: Arc): string {
  // Kept local to avoid making presentation code interpret the digest. It is
  // only an exact revision key for active selection and trust lookup.
  return cartridgeDigest(arc);
}

const INTENT_KEY = "axm-arc:intent:v1";
const SEEN_BUILD_KEY = "axm-arc:seen-build:v1";
const THEME_KEY = "axm-arc:theme:v1";

type Theme = "light" | "dark";

// Initial theme: localStorage wins; otherwise honor prefers-color-scheme.
// Lifted from docs/designer-prototype/bench-app.jsx (the toggle pattern).
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* noop */ }
  if (typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

// One founding transition for bundled and imported arcs alike. No client-local
// roster, resource, facility, relationship, seed, or opening policy remains.
function buildNewOrg(activeArc: typeof FIRST_CHARTER): Organization {
  return foundOrganization(activeArc);
}

export function App(): JSX.Element {
  const [mode, setMode] = useState<"title" | "play" | "library" | "designer" | "workshop" | "godscar" | "darktomb" | "commonship" | "raidnight" | "guildhall" | "archive">("title");
  // Subscribe to the module-level locale so every t() call below re-renders on
  // switch; `locale` is also a dependency of the memos that bake t() output.
  const [locale] = useLocale();
  const tutorial = useTutorial();
  const [initial] = useState(() => {
    const activeArc = resolveActiveArc();
    const loaded = loadSave(activeArc);
    const activeOrg = loaded?.org ?? buildNewOrg(activeArc);
    const checkpoint = loaded
      ? readHubTurnCheckpoint(loaded.extensions, activeArc, activeOrg)
      : null;
    return {
      arc: activeArc,
      org: activeOrg,
      pendingRewardChoices: loaded?.pendingRewardChoices ?? [],
      extensions: loaded?.extensions ?? {},
      assignments: checkpoint?.assignments ?? [],
      rewardDecisions: checkpoint?.rewardDecisions ?? [],
    };
  });
  const [tab, setTab] = useState<Tab>("Roster");
  const [arc, setArc] = useState<Arc>(initial.arc);
  const [org, setOrg] = useState<Organization>(initial.org);
  const [assignments, setAssignments] = useState<ChallengeAssignment[]>(initial.assignments);
  const [lastReports, setLastReports] = useState<RunReport[]>([]);
  const [pendingRewardChoices, setPendingRewardChoices] = useState<PendingRewardChoice[]>(initial.pendingRewardChoices);
  const [rewardDecisions, setRewardDecisions] = useState<RewardDecision[]>(initial.rewardDecisions);
  const [portableExtensions, setPortableExtensions] = useState<PortableRunExtensions>(initial.extensions);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);
  const [runExportMessage, setRunExportMessage] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [cycleTransition, setCycleTransition] = useState<{ fromCycle: number; toCycle: number } | null>(null);
  const [codexOpen, setCodexOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [workshopSeedArc, setWorkshopSeedArc] = useState<Arc | null>(null);

  // Intent — player-authored pull-quote, persisted separately from game state
  const [intent, setIntent] = useState<string>(() => {
    try { return localStorage.getItem(INTENT_KEY) ?? ""; } catch { return ""; }
  });
  const [editingIntent, setEditingIntent] = useState(false);
  const [intentDraft, setIntentDraft] = useState("");

  // Light/dark theme — harvested from designer-prototype.
  const [theme, setTheme] = useState<Theme>(() => initialTheme());
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* noop */ }
  }, [theme]);

  // Bundled cartridges may carry a local presentation identity. Unknown or
  // imported Arcs deliberately receive no scope and keep the neutral house
  // style; changing presentation never changes authored or run state.
  useEffect(() => {
    const root = document.documentElement;
    const scope = cartridgeThemeScope(arc.meta.id);
    if (scope) root.setAttribute("data-cartridge", scope);
    else root.removeAttribute("data-cartridge");
    return () => root.removeAttribute("data-cartridge");
  }, [arc.meta.id]);

  useEffect(() => {
    const result = saveSave(
      org,
      arc,
      pendingRewardChoices,
      withHubTurnCheckpoint(portableExtensions, assignments, rewardDecisions),
    );
    setSaveFailure(result.ok ? null : result.message);
  }, [org, arc, pendingRewardChoices, portableExtensions, assignments, rewardDecisions]);

  useEffect(() => {
    try { localStorage.setItem(INTENT_KEY, intent); } catch { /* noop */ }
  }, [intent]);

  // "What's new" auto-open: only nag returning players (those with a save) whose
  // last-seen build differs from the current one. First-timers (no save yet) are
  // never interrupted; their seen-build is stamped silently so the next genuine
  // build change is what triggers the overlay. Runs once on mount.
  useEffect(() => {
    try {
      const hasSave = loadSave(arc) !== null;
      const seen = localStorage.getItem(SEEN_BUILD_KEY);
      if (!hasSave) {
        // Brand-new player: record the build without prompting.
        localStorage.setItem(SEEN_BUILD_KEY, CURRENT_BUILD);
        return;
      }
      if (seen !== CURRENT_BUILD) setWhatsNewOpen(true);
    } catch { /* noop */ }
  }, []);

  const exactExtensions = (): PortableRunExtensions =>
    withHubTurnCheckpoint(portableExtensions, assignments, rewardDecisions);

  const persistCurrentRun = () => {
    const result = saveSave(org, arc, pendingRewardChoices, exactExtensions());
    setSaveFailure(result.ok ? null : result.message);
    return result;
  };

  const exportCurrentRun = () => {
    const payload = exportPortableRunToJson({
      arc,
      org,
      pendingRewardChoices,
      extensions: exactExtensions(),
    });
    const blob = new Blob([payload.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setRunExportMessage(t("save.exported", { file: payload.filename }));
    playArcPresentationCue("record", arc.meta.id);
  };

  const restoreClientState = (nextArc: Arc): void => {
    const loaded = loadSave(nextArc);
    const nextOrg = loaded?.org ?? buildNewOrg(nextArc);
    const nextExtensions = loaded?.extensions ?? {};
    const checkpoint = loaded
      ? readHubTurnCheckpoint(nextExtensions, nextArc, nextOrg)
      : null;
    setArc(nextArc);
    setOrg(nextOrg);
    setPendingRewardChoices(loaded?.pendingRewardChoices ?? []);
    setPortableExtensions(nextExtensions);
    setAssignments(checkpoint?.assignments ?? []);
    setRewardDecisions(checkpoint?.rewardDecisions ?? []);
    setLastReports([]);
    setAdvanceError(null);
    setCycleTransition(null);
    setRunExportMessage(null);
    setTab(nextOrg.dramaQueue.length > 0 ? "Drama" : "Assign");
    playArcPresentationCue("enter", nextArc.meta.id);
  };

  const startFresh = (nextArc: Arc): void => {
    const nextOrg = buildNewOrg(nextArc);
    setArc(nextArc);
    setOrg(nextOrg);
    setPendingRewardChoices([]);
    setPortableExtensions({});
    setAssignments([]);
    setRewardDecisions([]);
    setLastReports([]);
    setAdvanceError(null);
    setCycleTransition(null);
    setRunExportMessage(null);
    setTab("Drama");
    playArcPresentationCue("enter", nextArc.meta.id);
  };

  // ── Tutorial: step derived from game state ──────────────────────────────
  const tutorialStep = deriveTutorialStep(
    tutorial.active,
    org.dramaQueue.length,
    assignments.length,
    org.cycle,
    lastReports.length,
  );
  const pulseTab = tutorialPulseTab(tutorialStep);
  const pulseAdvance = tutorialPulseAdvance(tutorialStep);

  // Trust for the currently-active arc (sourced from the library entry, never
  // from arc content). Re-derives when the arc swaps; bundled is the floor.
  const activeTrust = useMemo(() => {
    const digest = cartridgeIdentity(arc);
    return loadArcLibrary().find((entry) => cartridgeIdentity(entry.arc) === digest)?.trust ?? "bundled";
  }, [arc]);

  const advanceBlockers = useMemo(() => getAdvanceBlockers({
    dramaQueueCount: org.dramaQueue.length,
    pendingRewardChoicesCount: pendingRewardChoices.length,
    rewardDecisionsCount: rewardDecisions.length,
  }), [org.dramaQueue.length, pendingRewardChoices.length, rewardDecisions.length, locale]);

  const blocked = isAdvanceBlocked(advanceBlockers);
  const cycleContext = useMemo(() => {
    const dramaCount = org.dramaQueue.length;
    const unresolvedRewards = pendingRewardChoices.length - rewardDecisions.length;
    const totalDeployed = assignments.reduce((s, a) => s + a.agentIds.length, 0);
    if (dramaCount > 0)
      return { text: t("ctx.decisionsPending", { count: dramaCount }), color: "var(--accent)" };
    if (unresolvedRewards > 0)
      return { text: t("ctx.rewardsToAssign", { count: unresolvedRewards }), color: "var(--accent)" };
    if (assignments.length > 0)
      return { text: t("ctx.contractsQueued", { count: assignments.length, deployed: totalDeployed }), color: "var(--muted)" };
    return { text: t("ctx.readyToAdvance"), color: "var(--positive)" };
  }, [org.dramaQueue.length, pendingRewardChoices.length, rewardDecisions.length, assignments, locale]);

  const hasAdvancePayload = assignments.length > 0 || lastReports.length > 0;
  const canAdvanceCycle = hasAdvancePayload && !blocked;

  const advanceCycle = () => {
    setAdvanceError(null);
    if (blocked) { setAdvanceError(advanceBlockers.map((b) => b.message).join(" ")); return; }
    const fromCycle = org.cycle;
    const result = runCycle({ org, arc, assignments, pendingRewardDecisions: rewardDecisions });
    setOrg(result.org);
    setLastReports(result.reports);
    setPendingRewardChoices(result.pendingRewardChoices);
    setRewardDecisions([]);
    setAssignments([]);
    setCycleTransition({ fromCycle, toCycle: result.org.cycle });
    const outcomes = result.reports.map((report) => report.outcome);
    const cue = outcomes.some((outcome) => outcome === "failure")
      ? "cycle-failure"
      : outcomes.some((outcome) => outcome === "partial")
        ? "cycle-partial"
        : "cycle-success";
    playArcPresentationCue(cue, arc.meta.id);
  };

  const resetGame = () => {
    if (!confirm(t("confirm.reset"))) return;
    const clearedRun = clearSave(arc);
    if (!clearedRun.ok) setSaveFailure(clearedRun.message);
    try { localStorage.removeItem(INTENT_KEY); } catch { /* noop */ }
    startFresh(arc);
    setIntent("");
    tutorial.start();
  };

  const agentCount = Object.keys(org.agents).length;
  const cleared = new Set<string>();
  for (const a of Object.values(org.agents)) {
    for (const r of a.assignmentHistory) {
      if (r.outcome === "success") cleared.add(r.challengeId);
    }
  }

  const tabCounts: Record<Tab, number | string> = {
    Roster: agentCount,
    Assign: assignments.length,
    Drama: org.dramaQueue.length,
    Base: Object.values(org.infrastructure).filter((f) => f.level > 0).length,
    Reports: lastReports.length > 0 ? lastReports.length : "—",
  };

  // ── Tab status badges (display only — consumes the engine triageDrama
  //    selector; does NOT affect advance-gating). Ambient never badges. ──
  const dramaTriage = useMemo(() => triageDrama(org.dramaQueue), [org.dramaQueue]);
  const dramaBadge = useMemo(() => dramaTabBadge(dramaTriage), [dramaTriage]);
  const reportsBadge = useMemo(() => reportsTabBadge({
    reportCount: lastReports.length,
    pendingRewardChoices: pendingRewardChoices.length,
    resolvedRewardDecisions: rewardDecisions.length,
  }), [lastReports.length, pendingRewardChoices.length, rewardDecisions.length, locale]);
  const tabBadges: Partial<Record<Tab, { label: string; tone: string } | null>> = {
    Drama: dramaBadge,
    Reports: reportsBadge,
  };

  const upkeep = Object.values(org.agents).reduce((s, a) => s + a.upkeep, 0);
  const agentList = Object.values(org.agents);

  // Next reputation gate, read from arc progression tiers (not hardcoded).
  const nextRepGate = arc.progressionTiers
    .map((pt) => pt.unlockConditions.reputationMinimum)
    .filter((m): m is number => m !== null && m > org.reputation)
    .sort((a, b) => a - b)[0];

  // ── Intent block (shared across mobile + desktop) ────────────────────────
  const intentBlock = (
    <div className="intent-block">
      <div className="intent-label">
        <span>{t("intent.label")}</span>
        <button
          onClick={() => {
            if (editingIntent) {
              setIntent(intentDraft);
              setEditingIntent(false);
            } else {
              setIntentDraft(intent);
              setEditingIntent(true);
            }
          }}
        >
          {editingIntent ? t("common.save") : t("common.edit")}
        </button>
      </div>
      {editingIntent ? (
        <textarea
          autoFocus
          rows={2}
          value={intentDraft}
          placeholder={t("intent.placeholder")}
          onChange={(e) => setIntentDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              setIntent(intentDraft);
              setEditingIntent(false);
            }
          }}
        />
      ) : (
        <div className="intent-text">
          {intent || <span style={{ color: "var(--dim)", fontWeight: 400, fontSize: 14 }}>{t("intent.empty")}</span>}
        </div>
      )}
    </div>
  );

  // ── Stat strip ────────────────────────────────────────────────────────────
  const statStrip = (
    <div className="stat-strip">
      <div className="stat-cell">
        <div className="stat-lbl">{arc.tokenName}</div>
        <div className="stat-val"><CountUp value={org.resources.tokens} /></div>
        <div className="stat-sub">{t("stats.nextCycle", { n: arc.tokensPerCycle })}</div>
      </div>
      <div className="stat-cell">
        <div className="stat-lbl">{arc.currencyName}</div>
        <div className="stat-val"><CountUp value={org.resources.currency} /></div>
        <div className="stat-sub">{t("stats.upkeepSub", { n: upkeep })}</div>
      </div>
      <div className="stat-cell">
        <div className="stat-lbl">{arc.reputationName}</div>
        <div className="stat-val"><CountUp value={org.reputation} /></div>
        <div className="stat-sub">{nextRepGate !== undefined ? t("stats.ofToNextTier", { n: nextRepGate }) : t("header.statTopTier")}</div>
      </div>
      <div className="stat-cell">
        <div className="stat-lbl">{t("stats.drama")}</div>
        <div className={`stat-val${org.dramaQueue.length > 0 ? " accent" : ""}`}>{org.dramaQueue.length}</div>
        <div className="stat-sub">{t("stats.queued")}</div>
      </div>
    </div>
  );

  const advanceButton = (
    <div className="advance-footer">
      <CycleChecklist
        dramaCount={org.dramaQueue.length}
        rewardsResolved={rewardDecisions.length}
        rewardsTotal={pendingRewardChoices.length}
        assignmentCount={assignments.length}
      />
      {advanceError && (
        <div className="warning">{advanceError}</div>
      )}
      <button
        className={`primary${!blocked ? " accent" : ""}${pulseAdvance && canAdvanceCycle ? " tutorial-pulse-btn" : ""}`}
        disabled={!canAdvanceCycle}
        onClick={advanceCycle}
      >
        {blocked ? t("advance.blocked") : t("advance.cycle")}
      </button>
    </div>
  );

  const activeScreen = (
    <>
      {tab === "Roster" && <RosterScreen agents={agentList} arc={arc} />}
      {tab === "Assign" && (
        <>
          <AssignScreen arc={arc} org={org} assignments={assignments} setAssignments={setAssignments} />
        </>
      )}
      {tab === "Drama" && (
        <DramaScreen
          org={org}
          arc={arc}
          setOrg={setOrg}
          cycle={org.cycle}
          pendingRewardChoices={pendingRewardChoices}
        />
      )}
      {tab === "Base" && <BaseScreen arc={arc} org={org} setOrg={setOrg} />}
      {tab === "Reports" && (
        <ReportsScreen
          arc={arc} org={org} reports={lastReports}
          pendingRewardChoices={pendingRewardChoices}
          rewardDecisions={rewardDecisions}
          setRewardDecisions={setRewardDecisions}
        />
      )}
    </>
  );

  const standaloneControls = (
    <div className="standalone-presentation-controls">
      <SensorySwitcher />
      <LocaleSwitcher />
    </div>
  );

  const openWorkshop = (selectedArc: Arc | null): void => {
    setWorkshopSeedArc(selectedArc);
    setMode("workshop");
  };

  if (mode === "title") {
    return (
      <TitleScreen
        arc={arc}
        saveFailure={saveFailure}
        exportMessage={runExportMessage}
        onContinue={() => {
          restoreClientState(arc);
          setMode("play");
        }}
        onNewGame={() => {
          const clearedRun = clearSave(arc);
          if (!clearedRun.ok) setSaveFailure(clearedRun.message);
          startFresh(arc);
          tutorial.start();
          setMode("play");
        }}
        onExportRun={exportCurrentRun}
        onOpenLibrary={() => setMode("library")}
        onOpenDesigner={() => setMode("designer")}
        onOpenWorkshop={() => openWorkshop(null)}
        onOpenGodscar={() => setMode("godscar")}
        onOpenDarkTomb={() => setMode("darktomb")}
        onOpenCommonShip={() => setMode("commonship")}
        onOpenRaidNight={() => setMode("raidnight")}
        onOpenGuildHall={() => setMode("guildhall")}
        onOpenArchive={() => setMode("archive")}
      />
    );
  }

  if (mode === "designer") {
    return <>{standaloneControls}<DesignerScreen arc={arc} onBack={() => setMode("title")} onOpenWorkshop={() => openWorkshop(arc)} /></>;
  }

  if (mode === "workshop") {
    return <>{standaloneControls}<WorkshopScreen seedArc={workshopSeedArc} onBack={() => setMode("title")} onOpenLibrary={() => setMode("library")} /></>;
  }

  if (mode === "godscar") {
    return (
      <>{standaloneControls}<GodscarForgeScreen
        onBack={() => setMode("title")}
        onOpenLibrary={() => setMode("library")}
        onPlayArc={(nextArc) => {
          const active = saveActiveArc(nextArc);
          if (!active.ok) { setSaveFailure(active.message); return; }
          restoreClientState(nextArc);
          setMode("title");
        }}
      /></>
    );
  }

  if (mode === "darktomb") {
    return (
      <>{standaloneControls}<DarkTombForgeScreen
        onBack={() => setMode("title")}
        onOpenLibrary={() => setMode("library")}
        onPlayArc={(nextArc) => {
          const active = saveActiveArc(nextArc);
          if (!active.ok) { setSaveFailure(active.message); return; }
          restoreClientState(nextArc);
          setMode("title");
        }}
      /></>
    );
  }

  if (mode === "commonship") {
    return (
      <>{standaloneControls}<CommonShipForgeScreen
        onBack={() => setMode("title")}
        onOpenLibrary={() => setMode("library")}
        onPlayArc={(nextArc) => {
          const active = saveActiveArc(nextArc);
          if (!active.ok) { setSaveFailure(active.message); return; }
          restoreClientState(nextArc);
          setMode("title");
        }}
      /></>
    );
  }

  if (mode === "raidnight") {
    return <>{standaloneControls}<RaidNightScreen onBack={() => setMode("title")} /></>;
  }

  if (mode === "guildhall") {
    return <>{standaloneControls}<GuildHallScreen onBack={() => setMode("title")} /></>;
  }

  if (mode === "archive") {
    return <>{standaloneControls}<ExpansionArchiveScreen onBack={() => setMode("title")} onOpenLibrary={() => setMode("library")} /></>;
  }

  if (mode === "library") {
    return (
      <>{standaloneControls}<LibraryScreen
        arc={arc}
        onBack={() => setMode("title")}
        onOpenArchive={() => setMode("archive")}
        onOpenWorkshop={() => openWorkshop(null)}
        onLoadArc={(nextArc) => {
          const active = saveActiveArc(nextArc);
          if (!active.ok) {
            setSaveFailure(active.message);
            return;
          }
          restoreClientState(nextArc);
          setMode("title");
        }}
        onLoadRun={(nextArc) => {
          restoreClientState(nextArc);
          setMode("title");
        }}
      /></>
    );
  }

  return (
    <>
      <CodexOverlay
        arc={arc}
        open={codexOpen}
        onClose={() => setCodexOpen(false)}
        onReplayTutorial={tutorial.start}
        trust={activeTrust}
      />

      <WhatsNew
        open={whatsNewOpen}
        onClose={() => {
          setWhatsNewOpen(false);
          try { localStorage.setItem(SEEN_BUILD_KEY, CURRENT_BUILD); } catch { /* noop */ }
        }}
      />

      {/* ── TUTORIAL GUIDE (nudge bar) ── */}
      {tutorialStep !== null && (
        <TutorialGuide
          step={tutorialStep}
          setTab={setTab}
          onDismiss={tutorial.dismiss}
        />
      )}

      {/* ── CYCLE TRANSITION OVERLAY ── */}
      {cycleTransition && (
        <CycleTransition
          fromCycle={cycleTransition.fromCycle}
          toCycle={cycleTransition.toCycle}
          reports={lastReports}
          arc={arc}
          org={org}
          intent={intent}
          onComplete={() => {
            setCycleTransition(null);
            setTab("Reports");
          }}
        />
      )}

      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="top-row">
          <div className="kicker">{t("header.situationRoom", { cycle: String(org.cycle).padStart(2, "0") })}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <SensorySwitcher />
            <LocaleSwitcher />
            <button
              className="codex-trigger"
              aria-label={theme === "dark" ? t("header.switchToLight") : t("header.switchToDark")}
              title={theme === "dark" ? t("header.lightMode") : t("header.darkMode")}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <button
              className="codex-trigger"
              aria-label={t("header.openManual")}
              onClick={() => setCodexOpen(true)}
            >
              ?
            </button>
            <div className="wordmark">
              <em>AXM</em>
              <span className="sep">·</span>
              <span className="arc-num">ARC 01</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CartridgeEmblem arcId={arc.meta.id} size={28} />
          <h1>{arc.meta.name}</h1>
        </div>
        <div className="subtitle">
          {t("header.subtitle", { domain: arc.meta.domain, cleared: cleared.size, total: arc.challenges.length, build: BUILD_SHA })}
        </div>

        {/* Desktop inline stat strip */}
        <div className="desktop-header-stats" style={{ display: "none" }}>
          {[
            { lbl: arc.tokenName, val: org.resources.tokens, sub: t("header.statNext", { n: arc.tokensPerCycle }) },
            { lbl: arc.currencyName, val: org.resources.currency.toLocaleString(), sub: t("header.statUpkeep", { n: upkeep }) },
            { lbl: arc.reputationName, val: nextRepGate !== undefined ? `${org.reputation} / ${nextRepGate}` : `${org.reputation}`, sub: nextRepGate !== undefined ? t("header.statToNextTier") : t("header.statTopTier") },
            { lbl: t("stats.drama"), val: org.dramaQueue.length, sub: t("stats.queued"), accent: org.dramaQueue.length > 0 },
          ].map((s) => (
            <div key={s.lbl} className="stat-cell">
              <div className="stat-lbl">{s.lbl}</div>
              <div className={`stat-val${s.accent ? " accent" : ""}`}>{s.val}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="desktop-actions" style={{ display: "none" }}>
          <button className="secondary" onClick={persistCurrentRun}>{t("common.save")}</button>
          <button className="secondary" onClick={exportCurrentRun}>{t("common.exportRun")}</button>
          <button
            className={`primary${!blocked ? " accent" : ""}`}
            disabled={!canAdvanceCycle}
            onClick={advanceCycle}
            style={{ width: "auto" }}
          >
            {blocked ? t("advance.blockedShort") : t("advance.cycle")}
          </button>
        </div>
      </header>

      {saveFailure && (
        <div className="warning" role="alert" style={{ margin: "8px 16px" }}>
          {t("save.unsaved", { reason: saveFailure })}{" "}
          <button className="secondary" type="button" onClick={exportCurrentRun}>
            {t("common.exportRun")}
          </button>
        </div>
      )}
      {runExportMessage && (
        <div role="status" style={{ margin: "8px 16px", color: "var(--positive)", fontWeight: 600 }}>
          {runExportMessage}
        </div>
      )}

      {/* ── MOBILE ── */}
      <div className="mobile-only">
        {statStrip}
        <div style={{
          fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase" as const,
          padding: "6px 16px", borderBottom: "1px solid var(--rule)",
          background: "var(--paper-alt)", color: cycleContext.color,
        }}>
          {cycleContext.text}
        </div>
        {tab === "Assign" && intentBlock}
        {activeScreen}
        {(tab === "Assign" || tab === "Reports") && advanceButton}
      </div>

      {/* ── DESKTOP: 3-column Situation Room ── */}
      <div className="situation-room">
        <div className="situation-roster">
          <div className="row between" style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              {t("header.rosterCount", { count: String(agentCount).padStart(2, "0") })}
            </span>
            <button className="icon" onClick={resetGame} style={{ fontSize: 9, padding: "3px 6px", minHeight: 0 }}>{t("common.reset")}</button>
          </div>
          {agentList.map((a) => {
            const role = arc.roles.find((r) => r.id === a.role);
            return (
              <div key={a.id} className="card" style={{ cursor: "default" }}>
                <div className="row" style={{ gap: 8 }}>
                  <CartridgePortrait arcId={arc.meta.id} roleId={a.role} name={a.name} className={a.stress >= 8 ? "accent" : ""} />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div className="agent-name">{a.name}</div>
                    <div className="agent-meta">{role?.name ?? "Flex"}</div>
                  </div>
                  <span className="badge role">{a.tier.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="row" style={{ marginTop: 4, gap: 8 }}>
                  <div className="bar-wrap">
                    <ThresholdBar value={a.morale} max={100} kind="morale" threshold={30} direction="below" />
                  </div>
                  <div className="bar-wrap">
                    <ThresholdBar value={a.stress} max={10} kind="stress" threshold={7} direction="above" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="situation-main">
          <nav className="desktop-tabstrip">
            {(["Assign", "Drama", "Base", "Reports"] as Tab[]).map((tabId) => (
              <button
                key={tabId}
                className={`${tab === tabId ? "active" : ""}${pulseTab === tabId ? " tutorial-pulse" : ""}`}
                onClick={() => setTab(tabId)}
              >
                {t(TAB_LABEL_ID[tabId])}
                {tabBadges[tabId] && (
                  <span className={`tab-badge ${tabBadges[tabId]!.tone}`}>{tabBadges[tabId]!.label}</span>
                )}
              </button>
            ))}
          </nav>
          {tab === "Assign" && intentBlock}
          {activeScreen}
        </div>

        <div className="situation-sidebar">
          <SituationSidebar arc={arc} org={org} lastReports={lastReports} intent={intent} />
        </div>
      </div>

      {/* ── MOBILE: tab bar ── */}
      <nav className="tabbar">
        {(["Roster", "Assign", "Drama", "Base", "Reports"] as Tab[]).map((tabId) => (
          <button
            key={tabId}
            className={`${tab === tabId ? "active" : ""}${tabId === "Drama" && org.dramaQueue.length > 0 ? " drama-active" : ""}${pulseTab === tabId ? " tutorial-pulse" : ""}`}
            onClick={() => setTab(tabId)}
          >
            <span className="tab-count">{tabCounts[tabId]}</span>
            <span className="tab-label-row">
              {t(TAB_LABEL_ID[tabId])}
              {tabBadges[tabId] && (
                <span className={`tab-badge ${tabBadges[tabId]!.tone}`}>{tabBadges[tabId]!.label}</span>
              )}
            </span>
          </button>
        ))}
      </nav>
    </>
  );
}
