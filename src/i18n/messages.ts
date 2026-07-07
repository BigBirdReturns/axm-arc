// Typed message catalog. Ported in shape from axm-world's i18n/messages.ts.
// Message values are either plain strings or small formatting functions that take
// a params bag — this lets pluralized English strings and their zh-Hant
// counterparts live side by side under one id without any runtime template-string
// parsing.
//
// GRAMMAR RULE (same as world): only arc-app-authored CHROME strings belong here.
// Loaded-arc data (arc.meta.name/domain/description, resource names like
// tokenName/currencyName/reputationName, challenge/role/attribute/item names,
// drama narrativeText and option labels, agent names) and variant-branded labels
// (VARIANT_LABELS) must keep flowing verbatim — they are the cartridge's own
// vocabulary and are never catalogued or translated here, so a second arc's
// vocabulary always wins.
//
// DELIBERATELY VERBATIM (documented boundaries, not oversights):
// - Engine-emitted strings (src/engine/**): projection attributeSummary /
//   scopeHint / improvementHint / targetSummary, predictImminentEvents lines,
//   affliction kinds, relationship states. The engine is the deterministic sim;
//   its strings are treated as data. Unknown values fall back to raw display.
// - generateHeadline / agentRunLine internals (game/lib/headline.ts): consumers
//   string-match headline.primary, so the RAW values stay English; the known
//   value set is translated at DISPLAY time via headline.* ids (unknown → raw).
//   agentRunLine's per-agent narrative prose stays English this pass.
// - DesignerScreen (authoring tool) and WhatsNew note CONTENT (versioned release
//   notes). WhatsNew chrome (title/section labels) IS catalogued.
// - "The Daily Charter" masthead — an in-fiction brand riffing on the bundled
//   arc's vocabulary; treated as a wordmark.

import type { Locale } from "./locale.js";

export type MessageParams = Record<string, string | number>;

type MessageValue = string | ((params: MessageParams) => string);

export type MessageId =
  // ── locale switcher ──
  | "locale.enLabel"
  | "locale.zhHantLabel"
  // ── shared vocabulary ──
  | "common.save"
  | "common.edit"
  | "common.reset"
  | "common.manual"
  | "common.designer"
  | "common.close"
  | "common.cancel"
  | "common.back"
  | "common.remove"
  | "common.flex"
  | "common.pass"
  | "common.fail"
  // ── primary navigation ──
  | "nav.roster"
  | "nav.assign"
  | "nav.drama"
  | "nav.base"
  | "nav.reports"
  // ── app header chrome ──
  | "header.situationRoom"
  | "header.rosterCount"
  | "header.subtitle"
  | "header.statNext"
  | "header.statUpkeep"
  | "header.statToNextTier"
  | "header.statTopTier"
  | "header.lightMode"
  | "header.darkMode"
  | "header.switchToLight"
  | "header.switchToDark"
  | "header.openManual"
  // ── stat strip ──
  | "stats.drama"
  | "stats.queued"
  | "stats.nextCycle"
  | "stats.upkeepSub"
  | "stats.ofToNextTier"
  // ── intent block ──
  | "intent.label"
  | "intent.empty"
  | "intent.placeholder"
  // ── advance-cycle ──
  | "advance.cycle"
  | "advance.blocked"
  | "advance.blockedShort"
  | "blockers.dramaCards"
  | "blockers.rewardDecisions"
  // ── mobile cycle-context strip ──
  | "ctx.decisionsPending"
  | "ctx.rewardsToAssign"
  | "ctx.contractsQueued"
  | "ctx.readyToAdvance"
  // ── tab badges ──
  | "badge.new"
  // ── confirms ──
  | "confirm.reset"
  | "confirm.loadArc"
  | "confirm.removeArc"
  // ── title screen ──
  | "title.continue"
  | "title.agentsCount"
  | "title.reputation"
  | "title.contractsItems"
  | "title.guaranteeDeterministicLabel"
  | "title.guaranteeDeterministicBody"
  | "title.guaranteeOfflineLabel"
  | "title.guaranteeOfflineBody"
  | "title.guaranteePortableLabel"
  | "title.guaranteePortableBody"
  | "title.colophon"
  | "title.designerPrototype"
  | "title.releaseNotes"
  | "title.workshop"
  | "title.raidNight"
  | "raidnight.title"
  | "raidnight.subtitle"
  | "raidnight.raidParty"
  | "raidnight.bench"
  | "raidnight.pull"
  | "raidnight.pullAgain"
  | "raidnight.attempt"
  | "raidnight.closestYet"
  | "raidnight.cleared"
  | "raidnight.clearedIn"
  | "raidnight.wipe"
  | "raidnight.whyWiped"
  | "raidnight.bottleneck"
  | "raidnight.threeThings"
  | "raidnight.apply"
  | "raidnight.applied"
  | "raidnight.field"
  | "raidnight.benchVerb"
  | "raidnight.benchedCount"
  | "raidnight.nightsAttended"
  | "raidnight.moraleShaky"
  | "raidnight.stressStrained"
  | "raidnight.partyIllegal"
  | "raidnight.needed"
  | "raidnight.putUp"
  | "raidnight.stress"
  | "raidnight.morale"
  | "raidnight.back"
  | "raidnight.reset"
  | "raidnight.lastPull"
  | "raidnight.changed"
  | "raidnight.tradeoffLabel"
  | "raidnight.ifApplied"
  | "raidnight.guildCarried"
  | "raidnight.freshGuild"
  | "raidnight.incompatible"
  | "raidnight.startFresh"
  | "raidnight.callItNight"
  | "raidnight.consequences"
  | "raidnight.consNotSaved"
  | "raidnight.commit"
  | "raidnight.committed"
  | "raidnight.consequencesRemain"
  | "raidnight.startNextTier"
  | "raidnight.tryIncompatible"
  | "raidnight.ready"
  | "raidnight.ledgerNone"
  | "raidnight.rightHint"
  | "raidnight.consScars"
  | "raidnight.consLegends"
  | "raidnight.consMorale"
  | "raidnight.consLoot"
  | "raidnight.consLootFair"
  | "raidnight.consPrecedents"
  | "raidnight.consProgress"
  | "raidnight.consTierUnlocked"
  | "raidnight.consNoAdvance"
  // ── roster screen ──
  | "roster.personnel"
  | "roster.activeCount"
  | "roster.empty"
  | "roster.morale"
  | "roster.stress"
  | "roster.afflicted"
  | "roster.thresholdNear"
  | "roster.agentNo"
  | "roster.attributes"
  | "roster.hiddenAttributes"
  | "roster.traits"
  | "roster.equipment"
  | "roster.undiscovered"
  | "roster.unequipped"
  | "roster.footer"
  | "roster.hiddenLoyalty"
  | "roster.hiddenAmbition"
  | "roster.hiddenVolatility"
  | "roster.hiddenLeadership"
  | "bark.threshold0"
  | "bark.threshold1"
  | "bark.threshold2"
  | "bark.afflicted0"
  | "bark.afflicted1"
  | "bark.afflicted2"
  | "bark.high0"
  | "bark.high1"
  | "bark.high2"
  | "bark.low0"
  | "bark.low1"
  | "bark.low2"
  // ── reveal hints (ui-helpers) ──
  | "hints.traitReveal"
  | "hints.hiddenReveal"
  | "hints.allRevealed"
  // ── assign screen ──
  | "assign.contracts"
  | "assign.tierAvailable"
  | "assign.guidance"
  | "assign.contractNo"
  | "assign.firstClearPush"
  | "assign.farm"
  | "assign.diff"
  | "assign.assignedLockout"
  | "assign.checksCount"
  | "assign.passN"
  | "assign.tightN"
  | "assign.failN"
  | "assign.projectedMechanics"
  | "assign.available"
  | "assign.nothingUnlocked"
  | "assign.cleared"
  | "assign.agentsRange"
  | "assign.queued"
  | "assign.farmLockout"
  | "assign.recommended"
  | "assign.noLegalTeam"
  | "assign.noLegalTeamText"
  | "assign.notReady"
  | "assign.notReadyText"
  | "assign.notReadyFallback"
  | "assign.riskyClear"
  | "assign.riskyClearText"
  | "assign.goodPlan"
  | "assign.goodPlanText"
  | "assign.reads"
  | "assign.team"
  | "assign.pickRange"
  | "assign.autofill"
  | "assign.recommendedRoster"
  | "assign.useRecommended"
  | "assign.liveReadout"
  | "assign.stressBadge"
  | "assign.roleReqNotMet"
  | "assign.slotRoster"
  | "assign.assessComfortable"
  | "assign.assessTight"
  | "assign.assessFail"
  // ── drama screen ──
  | "drama.precedentLogged"
  | "drama.councilCycle"
  | "drama.decisions"
  | "drama.empty"
  | "drama.evidence"
  | "drama.cardXofY"
  | "drama.hlRewardPre"
  | "drama.hlRewardPost"
  | "drama.hlReward"
  | "drama.hlRelationship"
  | "drama.hlAffliction"
  | "drama.hlMorale"
  | "drama.hlPrecedent"
  | "drama.hlBenching"
  | "drama.hlRivalry"
  | "drama.hlBond"
  | "drama.twoEligible"
  | "drama.noDropYet"
  | "drama.newUnderequipped"
  | "drama.noDropInCycles"
  | "drama.disenchant"
  | "drama.award"
  | "drama.tagBasis"
  | "drama.tagVisible"
  | "drama.tagHidden"
  | "drama.orgWide"
  | "drama.effectOn"
  | "drama.precedentConsistency"
  | "drama.loyaltyViolation"
  | "drama.moraleSmall"
  | "drama.precedentLast"
  | "drama.hiddenLoyaltyAmbition"
  | "basis.award_a"
  | "basis.award_b"
  | "basis.promise_rotation"
  | "basis.stay_course"
  | "basis.promote_officer"
  | "basis.intervene"
  | "basis.separate"
  | "basis.let_it_play"
  | "basis.rest_treatment"
  | "basis.push_through"
  | "basis.bench_indefinitely"
  | "basis.acknowledge"
  | "basis.private_talk"
  | "basis.ignore"
  | "basis.explain"
  | "basis.double_down"
  | "basis.revert"
  | "basis.acknowledge_winner"
  | "basis.mentor_pair"
  | "basis.ignore_gap"
  | "basis.memorial"
  | "basis.new_assignment"
  | "basis.leave_of_absence"
  // ── base screen ──
  | "base.heading"
  | "base.facilitiesCount"
  | "base.guidance"
  | "base.recommendedMove"
  | "base.recReasonStress"
  | "base.recReasonTraining"
  | "base.alsoRaises"
  | "base.rosterCap"
  | "base.upkeepCycle"
  | "base.unbuilt"
  | "base.assignedN"
  | "base.upgradeTo"
  | "fac.Quarters.name"
  | "fac.Quarters.desc"
  | "fac.Quarters.why"
  | "fac.Production.name"
  | "fac.Production.desc"
  | "fac.Production.why"
  | "fac.Recreation.name"
  | "fac.Recreation.desc"
  | "fac.Recreation.why"
  | "fac.Research.name"
  | "fac.Research.desc"
  | "fac.Research.why"
  | "fac.Training.name"
  | "fac.Training.desc"
  | "fac.Training.why"
  | "fac.Storage.name"
  | "fac.Storage.desc"
  | "fac.Storage.why"
  | "fac.Medical.name"
  | "fac.Medical.desc"
  | "fac.Medical.why"
  // ── reports screen ──
  | "reports.empty"
  | "reports.dropsPending"
  | "reports.awarded"
  | "reports.decisionPending"
  | "reports.from"
  | "reports.fieldReportNo"
  | "reports.cycleComposition"
  | "reports.abstract"
  | "reports.outcome"
  | "reports.checks"
  | "reports.failedN"
  | "reports.allPassed"
  | "reports.stressDelta"
  | "reports.acrossRoster"
  | "reports.loot"
  | "reports.pendingN"
  | "reports.noDrops"
  | "reports.repPlus"
  | "reports.noRep"
  | "reports.resolveCallout"
  | "reports.clutchCallout"
  | "reports.audit"
  | "reports.heroic"
  | "reports.stressChip"
  | "reports.downedChip"
  | "reports.cleanChip"
  | "reports.teamAggregate"
  | "reports.vsThreshold"
  | "reports.dropsN"
  | "reports.eligible"
  | "reports.outcomeClean"
  | "reports.outcomePartial"
  | "reports.outcomeWipe"
  | "reports.outcomeSuccessWord"
  | "reports.outcomePartialWord"
  | "reports.outcomeFailureWord"
  | "reports.sumFullClearLoot"
  | "reports.sumFullClear"
  | "reports.sumStressAccrued"
  | "reports.sumZeroStress"
  | "reports.sumPartial"
  | "reports.sumStressAcross"
  | "reports.sumChecksMet"
  | "reports.sumStressDistributed"
  | "reports.sumDowned"
  | "reports.sumAwardDrop"
  | "reports.sumConsiderResting"
  | "reports.sumTeamReady"
  | "reports.sumRestHighStress"
  | "reports.sumReevaluate"
  | "reports.sumDownedUnavailable"
  | "reports.sumReevaluateRetry"
  | "reports.absCompleted"
  | "reports.absFailed"
  | "reports.absChecksFailedLine"
  | "reports.absAllPassed"
  | "reports.absCostIn"
  | "reports.absStressToll"
  | "reports.absCameHomeClean"
  | "reports.absCameHome"
  // ── cycle checklist ──
  | "checklist.dramaResolved"
  | "checklist.dramaUnresolved"
  | "checklist.rewardsResolved"
  | "checklist.rewardsPending"
  | "checklist.contractsQueued"
  | "checklist.noContracts"
  // ── tutorial ──
  | "tutorial.step0"
  | "tutorial.step1"
  | "tutorial.step2"
  | "tutorial.step3"
  | "tutorial.skip"
  // ── cycle transition ──
  | "transition.processing"
  | "transition.tickerCleared"
  | "transition.tickerPartial"
  | "transition.tickerFailed"
  | "transition.tickerStress"
  | "transition.tickerMoraleDown"
  | "transition.tickerMoraleUp"
  | "transition.tickerRel"
  | "transition.kickerCleanSweep"
  | "transition.kickerPersonnelCrisis"
  | "transition.kickerRaidReport"
  | "transition.kickerStandout"
  | "transition.kickerCloseCall"
  | "transition.kickerCycleUpdate"
  | "transition.deckHeavyLosses"
  | "transition.deckBarelyHeld"
  | "transition.deckRazorThin"
  | "transition.deckPerfect"
  | "transition.deckSteppedUp"
  | "transition.deckPartialPressure"
  | "transition.deckCouldntHold"
  | "transition.deckAnotherCycle"
  | "transition.cycleArc"
  | "transition.intent"
  | "transition.achieved"
  | "transition.missed"
  | "transition.partial"
  | "transition.achievedRow"
  | "transition.missedRow"
  | "transition.partialRow"
  | "transition.tapContinue"
  // ── headline display map (raw values stay English internally) ──
  | "headline.wipedGroup"
  | "headline.failed"
  | "headline.fellApart"
  | "headline.partialClear"
  | "headline.carried"
  | "headline.clearedBarely"
  | "headline.clean"
  | "headline.clear"
  | "headline.nearly"
  // ── cycle digest ──
  | "digest.editionNo"
  | "digest.cycle"
  | "digest.fieldDigest"
  | "digest.tallyCleared"
  | "digest.tallyPartial"
  | "digest.tallyFailed"
  | "digest.tallyAfflictions"
  | "digest.tallyDrops"
  | "digest.applied"
  | "digest.cycleTally"
  | "digest.perf"
  | "digest.stressChip"
  | "digest.downed"
  | "digest.heroic"
  | "digest.contractAudits"
  | "digest.carry"
  | "digest.drops"
  | "digest.docket"
  | "digest.appliedChip"
  // ── situation sidebar ──
  | "sidebar.dramaQueued"
  | "sidebar.blocking"
  | "sidebar.optionsTap"
  | "sidebar.stressThreshold"
  | "sidebar.lastReport"
  | "sidebar.checksPassed"
  | "sidebar.dropsSuffix"
  | "sidebar.imminent"
  | "sidebar.alertOneBadCycle"
  | "sidebar.alertWatchThis"
  | "sidebar.alertIsAfflicted"
  | "sidebar.alertThreeAmbitious"
  | "sidebar.alertHostilePairs"
  | "sidebar.subOptionsTap"
  | "sidebar.subRecreation"
  | "sidebar.subRest"
  | "sidebar.subStressPer"
  // ── library screen ──
  | "library.heading"
  | "library.arcsAvailable"
  | "library.active"
  | "library.inspect"
  | "library.export"
  | "library.load"
  | "library.resume"
  | "library.removeAria"
  | "library.exportBlocked"
  | "library.exported"
  | "library.importArc"
  | "library.importHelp"
  | "library.validateSave"
  | "library.validationFailed"
  | "library.imported"
  // ── workshop screen ──
  | "workshop.heading"
  | "workshop.intro"
  | "workshop.newFromSkeleton"
  | "workshop.duplicateFromLibrary"
  | "workshop.duplicateSelectAria"
  | "workshop.duplicateSelectPlaceholder"
  | "workshop.duplicateLoad"
  | "workshop.duplicateEmptyLibrary"
  | "workshop.importFileAria"
  | "workshop.editorAria"
  | "workshop.validate"
  | "workshop.saveToLibrary"
  | "workshop.exportArc"
  | "workshop.validOk"
  | "workshop.digest"
  | "workshop.validationFailed"
  | "workshop.countChallenges"
  | "workshop.countRoles"
  | "workshop.countItems"
  | "workshop.countAttunementChains"
  | "workshop.countNarrativeEvents"
  | "workshop.countProgressionTiers"
  | "workshop.saved"
  | "workshop.saveBlocked"
  | "workshop.exported"
  | "workshop.exportBlocked"
  // ── codex overlay ──
  | "codex.attributes"
  | "codex.roles"
  | "codex.traits"
  | "codex.facilities"
  | "codex.howChallenges"
  | "codex.manualAria"
  | "codex.closeManualAria"
  | "codex.replayTutorial"
  | "codexRef.usedInRoles"
  | "codexRef.checkedIn"
  | "codexRef.notChecked"
  | "codexRef.checkWeight"
  | "codexRef.leadAttribute"
  | "codexRef.weightBreakdown"
  | "codexRef.mechEffect"
  | "codexRef.attrsThatMatter"
  | "codexRef.noAttrsWeighted"
  | "codexRef.howScored"
  | "codexRef.target"
  | "codexRef.whenUpgrade"
  | "scope.per_agent"
  | "scope.team_aggregate"
  | "scope.role_specific"
  | "fac.Quarters.upgrade"
  | "fac.Production.upgrade"
  | "fac.Recreation.upgrade"
  | "fac.Research.upgrade"
  | "fac.Training.upgrade"
  | "fac.Storage.upgrade"
  | "fac.Medical.upgrade"
  | "traitfx.infraEfficiencyMultiplier"
  | "traitfx.moralePenaltyMultiplierOnRewardDisappointment"
  | "traitfx.mentorshipTierGapBonus"
  | "traitfx.relationshipFormationMultiplier"
  | "traitfx.hostileStressImmunity"
  | "traitfx.recklessAfflictionChanceBonus"
  | "traitfx.attributeBonusWhenMoraleHigh"
  | "traitfx.stressAccumulationMultiplier"
  | "traitfx.moraleGainMultiplier"
  | "traitfx.attributeCheckBonus"
  | "traitfx.stressOnPartialSuccess"
  | "traitfx.relationshipAffinityMultiplier"
  | "traitfx.moraleSensitivityToTeamLoss"
  | "traitfx.ambitionSignal"
  // ── trust chips ──
  | "trust.bundled"
  | "trust.importedUnsigned"
  | "trust.verified"
  | "trust.quarantined"
  // ── what's new (chrome only; note content is versioned data) ──
  | "whatsnew.title"
  | "whatsnew.added"
  | "whatsnew.changed"
  | "whatsnew.fixed"
  | "whatsnew.closeAria"
  // ── shared effect vocabulary (engine enum display; unknown → raw) ──
  | "vocab.morale"
  | "vocab.stress"
  | "vocab.loyalty"
  | "vocab.Hostile"
  | "vocab.Rivalrous"
  | "trigger.reward_dispute"
  | "trigger.relationship_transition"
  | "trigger.affliction_threshold"
  | "trigger.morale_extreme"
  | "trigger.precedent_violation"
  | "trigger.prolonged_benching"
  | "trigger.rivalrous_perf_gap"
  | "trigger.bonded_partner_lost";

/**
 * Ids intentionally left out of the zh-Hant catalog. Documented, not accidental —
 * the locale guard test (tests/i18n/locale.test.ts) checks every en id is either
 * present in zh-Hant OR listed here.
 *
 * "title.designerPrototype" is the seeded demo id that exercises the
 * zh-Hant → en fallback path honestly; keep it missing on purpose.
 */
export const EN_ONLY_IDS: MessageId[] = [
  "title.designerPrototype",
];

function num(params: MessageParams, key: string): number {
  return Number(params[key] ?? 0);
}

function str(params: MessageParams, key: string): string {
  return String(params[key] ?? "");
}

const ZH_NUM = ["零", "一", "兩", "三", "四", "五", "六", "七", "八", "九", "十"];
const EN_NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

export const MESSAGES: Record<Locale, Partial<Record<MessageId, MessageValue>>> = {
  en: {
    "locale.enLabel": "EN",
    "locale.zhHantLabel": "中文",

    "common.save": "Save",
    "common.edit": "Edit",
    "common.reset": "Reset",
    "common.manual": "Manual",
    "common.designer": "Designer",
    "common.close": "Close",
    "common.cancel": "Cancel",
    "common.back": "Back",
    "common.remove": "Remove",
    "common.flex": "Flex",
    "common.pass": "PASS",
    "common.fail": "FAIL",

    "nav.roster": "Roster",
    "nav.assign": "Assign",
    "nav.drama": "Drama",
    "nav.base": "Base",
    "nav.reports": "Reports",

    "header.situationRoom": (p) => `Situation Room · Cycle ${str(p, "cycle")}`,
    "header.rosterCount": (p) => `Roster · ${str(p, "count")}`,
    "header.subtitle": (p) => `${str(p, "domain")} · Tier I · ${num(p, "cleared")} of ${num(p, "total")} cleared · build ${str(p, "build")}`,
    "header.statNext": (p) => `+${num(p, "n")} next`,
    "header.statUpkeep": (p) => `-${num(p, "n")}`,
    "header.statToNextTier": "to next tier",
    "header.statTopTier": "top tier",
    "header.lightMode": "Light mode",
    "header.darkMode": "Dark mode",
    "header.switchToLight": "Switch to light mode",
    "header.switchToDark": "Switch to dark mode",
    "header.openManual": "Open manual",

    "stats.drama": "Drama",
    "stats.queued": "queued",
    "stats.nextCycle": (p) => `+${num(p, "n")} next cycle`,
    "stats.upkeepSub": (p) => `-${num(p, "n")} upkeep`,
    "stats.ofToNextTier": (p) => `of ${num(p, "n")} to next tier`,

    "intent.label": "Intent · This Cycle",
    "intent.empty": "No intent set. Tap Edit to add one.",
    "intent.placeholder": "e.g. Run Attumen on farm. Push Moroes for first clear.",

    "advance.cycle": "Advance Cycle →",
    "advance.blocked": "Advance blocked",
    "advance.blockedShort": "Blocked",
    "blockers.dramaCards": (p) => {
      const count = num(p, "count");
      return `Resolve ${count} drama card${count === 1 ? "" : "s"} before advancing.`;
    },
    "blockers.rewardDecisions": (p) => {
      const count = num(p, "count");
      return `Resolve ${count} pending reward decision${count === 1 ? "" : "s"} in Reports.`;
    },

    "ctx.decisionsPending": (p) => {
      const n = num(p, "count");
      return `${n} decision${n === 1 ? "" : "s"} pending`;
    },
    "ctx.rewardsToAssign": (p) => {
      const n = num(p, "count");
      return `${n} reward${n === 1 ? "" : "s"} to assign`;
    },
    "ctx.contractsQueued": (p) => {
      const n = num(p, "count");
      return `${n} contract${n === 1 ? "" : "s"} queued · ${num(p, "deployed")} deployed`;
    },
    "ctx.readyToAdvance": "Ready to advance",

    "badge.new": "NEW",

    "confirm.reset": "Reset the game? All progress will be lost.",
    "confirm.loadArc": "Loading a different arc will clear your current save. Continue?",
    "confirm.removeArc": (p) => `Remove "${str(p, "name")}" from the library? Bundled arcs cannot be removed; only imported ones.`,

    "title.continue": (p) => `Continue · Cycle ${str(p, "cycle")}`,
    "title.agentsCount": (p) => {
      const count = num(p, "count");
      return `${count} agent${count === 1 ? "" : "s"}`;
    },
    "title.reputation": (p) => `Reputation ${str(p, "value")}`,
    "title.contractsItems": (p) => `${num(p, "contracts")} contracts${num(p, "items") > 0 ? ` · ${num(p, "items")} items` : ""}`,
    "title.guaranteeDeterministicLabel": "Deterministic",
    "title.guaranteeDeterministicBody": "Same seed, same run",
    "title.guaranteeOfflineLabel": "Offline",
    "title.guaranteeOfflineBody": "No API, no cloud",
    "title.guaranteePortableLabel": "Portable",
    "title.guaranteePortableBody": "JSON arc format",
    "title.colophon": (p) => `AXM Arc · v${str(p, "version")} · Engine ${str(p, "engine")}`,
    "title.designerPrototype": "Designer Prototype",
    "title.releaseNotes": "Release notes",
    "title.workshop": "Workshop",
    "title.raidNight": "Raid Night",
    "raidnight.title": "RAID NIGHT",
    "raidnight.subtitle": "One lockout. One wall. Pull until the guild is ready.",
    "raidnight.raidParty": "Raid Party",
    "raidnight.bench": "Bench",
    "raidnight.pull": "Pull the Boss",
    "raidnight.pullAgain": "Pull Again",
    "raidnight.attempt": (p) => `Attempt ${num(p, "n")}`,
    "raidnight.closestYet": (p) => `closest yet: ${num(p, "n")} short`,
    "raidnight.cleared": "CLEARED",
    "raidnight.clearedIn": (p) => {
      const n = num(p, "n");
      return `cleared in ${n} ${n === 1 ? "attempt" : "attempts"}`;
    },
    "raidnight.wipe": "WIPE",
    "raidnight.whyWiped": "Why we wiped",
    "raidnight.bottleneck": "Bottleneck",
    "raidnight.threeThings": "Three things you can change before reset",
    "raidnight.apply": "Apply",
    "raidnight.applied": "Applied — pull again.",
    "raidnight.field": "Field",
    "raidnight.benchVerb": "Bench",
    "raidnight.benchedCount": (p) => `benched ${num(p, "n")}`,
    "raidnight.nightsAttended": (p) => `${num(p, "n")} nights`,
    "raidnight.moraleShaky": "shaky — morale under 30",
    "raidnight.stressStrained": "strained — stress over 7",
    "raidnight.partyIllegal": (p) => `Party needs ${num(p, "min")}–${num(p, "max")}, including its required roles`,
    "raidnight.needed": "needed",
    "raidnight.putUp": "put up",
    "raidnight.stress": "stress",
    "raidnight.morale": "morale",
    "raidnight.back": "Back",
    "raidnight.reset": "New Guild",
    "raidnight.lastPull": "Last pull",
    "raidnight.changed": "Changed before next pull",
    "raidnight.tradeoffLabel": "Tradeoff",
    "raidnight.ifApplied": "If applied",
    "raidnight.guildCarried": (p) => `Guild carried — ${num(p, "n")} raiders`,
    "raidnight.freshGuild": "Fresh guild — no ledger yet",
    "raidnight.incompatible": "INCOMPATIBLE GUILD",
    "raidnight.startFresh": "Start Fresh Here",
    "raidnight.callItNight": "Call It a Night",
    "raidnight.consequences": "What this night did to the guild",
    "raidnight.consNotSaved": "not recorded yet",
    "raidnight.commit": "Commit to Guild Record",
    "raidnight.committed": "Committed",
    "raidnight.consequencesRemain": "The night is won. The consequences remain.",
    "raidnight.startNextTier": (p) => `Start Next Tier — ${str(p, "boss")}`,
    "raidnight.tryIncompatible": "Try an incompatible tier (demo)",
    "raidnight.ready": "READY",
    "raidnight.ledgerNone": "No record yet",
    "raidnight.rightHint": "Pull the boss to see the outcome.",
    "raidnight.consScars": "Scars",
    "raidnight.consLegends": "Legends of the run",
    "raidnight.consMorale": "Morale & stress",
    "raidnight.consLoot": "Loot & fairness",
    "raidnight.consLootFair": "won · fairness preserved",
    "raidnight.consPrecedents": "New precedents",
    "raidnight.consProgress": "Progression",
    "raidnight.consTierUnlocked": "Next tier unlocked",
    "raidnight.consNoAdvance": "No tier advance",

    "roster.personnel": "Personnel",
    "roster.activeCount": (p) => `${num(p, "count")} Active`,
    "roster.empty": "No agents. Recruit from the Base screen.",
    "roster.morale": "Morale",
    "roster.stress": "Stress",
    "roster.afflicted": (p) => `Afflicted: ${str(p, "kind")}`,
    "roster.thresholdNear": "Stress threshold near",
    "roster.agentNo": (p) => `N° ${str(p, "n")}`,
    "roster.attributes": "Attributes",
    "roster.hiddenAttributes": "Hidden Attributes",
    "roster.traits": "Traits",
    "roster.equipment": "Equipment",
    "roster.undiscovered": "(undiscovered)",
    "roster.unequipped": "Unequipped.",
    "roster.footer": (p) => `Tier ${str(p, "tier")} · Upkeep ${num(p, "upkeep")}/cycle · Base eff. ${str(p, "eff")}`,
    "roster.hiddenLoyalty": "Loyalty",
    "roster.hiddenAmbition": "Ambition",
    "roster.hiddenVolatility": "Volatility",
    "roster.hiddenLeadership": "Leadership",
    "bark.threshold0": "I can do one more. Maybe.",
    "bark.threshold1": "Don't put me next to them again.",
    "bark.threshold2": "The numbers are fine. I'm fine.",
    "bark.afflicted0": "I'm done volunteering.",
    "bark.afflicted1": "Ask someone who still cares.",
    "bark.afflicted2": "You already know what I think.",
    "bark.high0": "Put me in. Any contract.",
    "bark.high1": "We're better than what we've been running.",
    "bark.high2": "This is what it's supposed to feel like.",
    "bark.low0": "Whatever you decide.",
    "bark.low1": "I'll be on the bench if you need me.",
    "bark.low2": "Starting to wonder what the point is.",

    "hints.traitReveal": (p) => `Trait reveal in ${num(p, "n")} assignments`,
    "hints.hiddenReveal": (p) => `Hidden attribute reveal in ${num(p, "n")} assignments`,
    "hints.allRevealed": "All info revealed",

    "assign.contracts": "Contracts",
    "assign.tierAvailable": (p) => `Tier I · ${num(p, "count")} available`,
    "assign.guidance": "Core loop: pick a contract, read the projected checks, slot the recommended roster, then use gold on Base upgrades when the readout says you are not ready.",
    "assign.contractNo": (p) => `Contract ${str(p, "n")} · `,
    "assign.firstClearPush": "First Clear Push",
    "assign.farm": "Farm",
    "assign.diff": (p) => `Diff ${str(p, "n")}`,
    "assign.assignedLockout": (p) => `${num(p, "have")} / ${str(p, "max")} assigned · ${num(p, "tokens")} lockout`,
    "assign.checksCount": (p) => `${num(p, "n")} checks`,
    "assign.passN": (p) => `${num(p, "n")} pass`,
    "assign.tightN": (p) => `${num(p, "n")} tight`,
    "assign.failN": (p) => `${num(p, "n")} fail`,
    "assign.projectedMechanics": (p) => `Projected Mechanics · ${num(p, "n")} checks`,
    "assign.available": "Available",
    "assign.nothingUnlocked": "Nothing unlocked yet.",
    "assign.cleared": "Cleared",
    "assign.agentsRange": (p) => `${num(p, "min")}-${num(p, "max")} agents`,
    "assign.queued": " · Queued",
    "assign.farmLockout": " · 0 lockout (farm)",
    "assign.recommended": (p) => `Recommended: ${str(p, "names")}`,
    "assign.noLegalTeam": "No legal team",
    "assign.noLegalTeamText": "You do not currently have enough available agents for this contract's role and roster requirements.",
    "assign.notReady": "Not ready",
    "assign.notReadyText": (p) => `Best roster still misses ${str(p, "mechanic")} by ${num(p, "margin")}. Build Training, gear ${str(p, "attr")}, or recruit before forcing it.`,
    "assign.notReadyFallback": "Best roster still fails at least one check.",
    "assign.riskyClear": "Risky clear",
    "assign.riskyClearText": (p) => {
      const n = num(p, "n");
      return `${n} check${n === 1 ? "" : "s"} are close. You can run it, but stress/morale swings may matter after the report.`;
    },
    "assign.goodPlan": "Good plan",
    "assign.goodPlanText": "Current roster clears every projected check comfortably. This is the safe pick.",
    "assign.reads": (p) => `Reads ${str(p, "summary")}`,
    "assign.team": "Team",
    "assign.pickRange": (p) => `Pick ${num(p, "min")}-${num(p, "max")} agents · ${num(p, "selected")} selected`,
    "assign.autofill": "Auto-fill",
    "assign.recommendedRoster": "Recommended roster",
    "assign.useRecommended": "Use recommended roster",
    "assign.liveReadout": "Live Readout · before you slot",
    "assign.stressBadge": "STRESS",
    "assign.roleReqNotMet": "Role requirements not met.",
    "assign.slotRoster": (p) => `Slot Roster (${num(p, "n")} agents, 1 lockout)`,
    "assign.assessComfortable": "COMFORTABLE",
    "assign.assessTight": "TIGHT",
    "assign.assessFail": "FAIL",

    "drama.precedentLogged": "PRECEDENT LOGGED",
    "drama.councilCycle": (p) => `Council · Cycle ${str(p, "cycle")}`,
    "drama.decisions": (p) => {
      const n = num(p, "count");
      return `${(EN_NUM[n] ?? String(n)).toUpperCase()} ${n === 1 ? "DECISION" : "DECISIONS"}`;
    },
    "drama.empty": "No drama cards in the queue. Drama generates after each cycle from stress events, relationship shifts, and contract outcomes.",
    "drama.evidence": (p) => `Evidence / ${str(p, "type")}`,
    "drama.cardXofY": (p) => `Card ${str(p, "x")}/${str(p, "y")}`,
    "drama.hlRewardPre": "THE ",
    "drama.hlRewardPost": " DROPPED.",
    "drama.hlReward": "A REWARD DROPPED.",
    "drama.hlRelationship": "RELATIONSHIP SHIFT.",
    "drama.hlAffliction": "STRESS THRESHOLD HIT.",
    "drama.hlMorale": "MORALE EXTREME.",
    "drama.hlPrecedent": "PRECEDENT VIOLATION.",
    "drama.hlBenching": "BENCHING NOTICED.",
    "drama.hlRivalry": "RIVALRY ESCALATING.",
    "drama.hlBond": "BOND BROKEN.",
    "drama.twoEligible": (p) => `Two ${str(p, "role")}s are eligible.`,
    "drama.noDropYet": (p) => `${str(p, "name")} hasn't received a drop yet.`,
    "drama.newUnderequipped": (p) => `${str(p, "name")} is new and underequipped.`,
    "drama.noDropInCycles": (p) => `${str(p, "name")} hasn't received a drop in ${num(p, "n")} cycles.`,
    "drama.disenchant": "Disenchant for materials · No drama, no upgrade",
    "drama.award": (p) => `Award ${str(p, "name")}`,
    "drama.tagBasis": "BASIS",
    "drama.tagVisible": "VISIBLE",
    "drama.tagHidden": "HIDDEN",
    "drama.orgWide": (p) => `${str(p, "delta")} ${str(p, "type")} (org-wide)`,
    "drama.effectOn": (p) => `${str(p, "delta")} ${str(p, "type")} on ${str(p, "name")}`,
    "drama.precedentConsistency": "+precedent consistency · Korrin notices",
    "drama.loyaltyViolation": (p) => `-${num(p, "n")} loyalty on three ambitious agents · precedent violation`,
    "drama.moraleSmall": (p) => `${str(p, "delta")} morale on ${str(p, "name")} (small)`,
    "drama.precedentLast": (p) => `Precedent · Last ${num(p, "n")} Reward Decisions`,
    "drama.hiddenLoyaltyAmbition": (p) => ` · Loyalty ${str(p, "loyalty")} · Ambition ${str(p, "ambition")}`,
    "basis.award_a": "merit · seniority",
    "basis.award_b": "need · rotation",
    "basis.promise_rotation": "rotation",
    "basis.stay_course": "status quo",
    "basis.promote_officer": "favoritism",
    "basis.intervene": "direct",
    "basis.separate": "separation",
    "basis.let_it_play": "non-intervention",
    "basis.rest_treatment": "welfare",
    "basis.push_through": "output priority",
    "basis.bench_indefinitely": "removal",
    "basis.acknowledge": "recognition",
    "basis.private_talk": "direct",
    "basis.ignore": "non-intervention",
    "basis.explain": "transparency",
    "basis.double_down": "authority",
    "basis.revert": "consistency",
    "basis.acknowledge_winner": "merit signal",
    "basis.mentor_pair": "development",
    "basis.ignore_gap": "non-intervention",
    "basis.memorial": "acknowledgment",
    "basis.new_assignment": "distraction",
    "basis.leave_of_absence": "welfare",

    "base.heading": "Base",
    "base.facilitiesCount": (p) => `${num(p, "count")} Facilities`,
    "base.guidance": (p) => `Gold upgrades facilities. Every facility level increases next-cycle ${str(p, "token")} regeneration by ${num(p, "pct")}% (currently +${num(p, "current")}%, capped at +50%). Training is the long-term lever for failed stat checks; Recreation is the short-term stress valve.`,
    "base.recommendedMove": "Recommended base move",
    "base.recReasonStress": (p) => {
      const n = num(p, "n");
      return `${n} agent${n === 1 ? " is" : "s are"} near stress trouble. Recreation buys safer repeat runs.`;
    },
    "base.recReasonTraining": "Training is the cleanest answer when assignment readouts say the roster is not ready.",
    "base.alsoRaises": (p) => ` Base levels also raise next-cycle ${str(p, "token")} income, so upgrades turn into more contract attempts.`,
    "base.rosterCap": "Roster cap",
    "base.upkeepCycle": "Upkeep/cycle",
    "base.unbuilt": "Unbuilt",
    "base.assignedN": (p) => `${num(p, "n")} assigned`,
    "base.upgradeTo": (p) => `Upgrade to L${num(p, "level")} (${num(p, "cost")} ${str(p, "currency")})`,
    "fac.Quarters.name": "Quarters",
    "fac.Quarters.desc": "Roster capacity (5 per level).",
    "fac.Quarters.why": "Raises roster cap, so you can carry more specialists without cutting veterans.",
    "fac.Production.name": "Production",
    "fac.Production.desc": "Crafts gear. Output scales with assigned agents' base efficiency.",
    "fac.Production.why": "Turns assigned agents into materials each cycle; materials feed future crafting/content loops.",
    "fac.Recreation.name": "Recreation",
    "fac.Recreation.desc": "Stress recovery. Improves recruitment pool quality.",
    "fac.Recreation.why": "Assigned agents recover 2 stress and get a morale floor of level × 10.",
    "fac.Research.name": "Research",
    "fac.Research.desc": "Unlocks challenge intel and arc lore.",
    "fac.Research.why": "Assigned agents generate intel events; this is where hidden context/lore should surface.",
    "fac.Training.name": "Training",
    "fac.Training.desc": "Accelerates stat growth for assigned agents.",
    "fac.Training.why": "Assigned agents gain random attributes over time — the direct answer to failed stat checks.",
    "fac.Storage.name": "Storage",
    "fac.Storage.desc": "Resource capacity between cycles.",
    "fac.Storage.why": "Intended to protect larger resource stockpiles as the economy expands.",
    "fac.Medical.name": "Medical",
    "fac.Medical.desc": "Reduces downed-agent recovery time.",
    "fac.Medical.why": "Shortens downed-agent recovery using facility level plus assigned staff resilience.",

    "reports.empty": "No reports yet. Go to Assign, slot a roster on a contract, then hit Advance Cycle.",
    "reports.dropsPending": (p) => `Drops · ${num(p, "n")} pending`,
    "reports.awarded": "Awarded",
    "reports.decisionPending": "Decision Pending",
    "reports.from": (p) => `From: ${str(p, "source")} · Cycle ${num(p, "cycle")}`,
    "reports.fieldReportNo": (p) => `Field Report / No. ${str(p, "n")} · ${str(p, "domain")} · Tier I`,
    "reports.cycleComposition": (p) => `Cycle ${num(p, "cycle")} · Composition: ${num(p, "agents")} agents · 1 lockout spent · ${str(p, "outcome")}`,
    "reports.abstract": "Abstract",
    "reports.outcome": "Outcome",
    "reports.checks": "Checks",
    "reports.failedN": (p) => `${num(p, "n")} failed`,
    "reports.allPassed": "all passed",
    "reports.stressDelta": "Stress Δ",
    "reports.acrossRoster": "across roster",
    "reports.loot": "Loot",
    "reports.pendingN": (p) => `${num(p, "n")} pending`,
    "reports.noDrops": "no drops",
    "reports.repPlus": (p) => `+${num(p, "n")} rep`,
    "reports.noRep": "no rep",
    "reports.resolveCallout": (p) => `${str(p, "name")} hit their stress ceiling and rolled Resolve. +3 to every check for two cycles. The team felt it.`,
    "reports.clutchCallout": (p) => `${str(p, "name")} pulled the party through. The margin was not comfortable.`,
    "reports.audit": (p) => `The Audit · ${num(p, "n")} Checks`,
    "reports.heroic": "HEROIC",
    "reports.stressChip": (p) => ` +${num(p, "n")} STRESS`,
    "reports.downedChip": "DOWNED",
    "reports.cleanChip": "CLEAN",
    "reports.teamAggregate": "Team aggregate",
    "reports.vsThreshold": (p) => ` · ${num(p, "score")} vs threshold ${num(p, "threshold")}`,
    "reports.dropsN": (p) => `Drops · ${num(p, "n")}`,
    "reports.eligible": (p) => `Eligible: ${str(p, "names")}`,
    "reports.outcomeClean": "Clean",
    "reports.outcomePartial": "Partial",
    "reports.outcomeWipe": "Wipe",
    "reports.outcomeSuccessWord": "SUCCESS",
    "reports.outcomePartialWord": "PARTIAL",
    "reports.outcomeFailureWord": "FAILURE",
    "reports.sumFullClearLoot": (p) => {
      const drops = num(p, "drops");
      return `Full clear — all ${num(p, "checks")} checks passed. ${drops} loot drop${drops > 1 ? "s" : ""}.`;
    },
    "reports.sumFullClear": (p) => `Full clear — all ${num(p, "checks")} checks passed.`,
    "reports.sumStressAccrued": (p) => ` Total stress accrued: +${num(p, "n")}.`,
    "reports.sumZeroStress": " Zero stress.",
    "reports.sumPartial": (p) => `${num(p, "passed")} of ${num(p, "total")} checks passed; ${num(p, "failed")} failed.`,
    "reports.sumStressAcross": (p) => ` +${num(p, "n")} stress across roster.`,
    "reports.sumChecksMet": (p) => `${num(p, "passed")} of ${num(p, "total")} checks met.`,
    "reports.sumStressDistributed": (p) => ` +${num(p, "n")} stress distributed.`,
    "reports.sumDowned": (p) => ` ${str(p, "names")} downed.`,
    "reports.sumAwardDrop": "Award the drop below.",
    "reports.sumConsiderResting": (p) => `Consider resting ${str(p, "names")} before next deployment.`,
    "reports.sumTeamReady": "Team is ready to advance.",
    "reports.sumRestHighStress": "Consider resting high-stress agents before retry.",
    "reports.sumReevaluate": "Re-evaluate roster composition before retry.",
    "reports.sumDownedUnavailable": "Downed agents are unavailable next cycle. Re-evaluate roster for retry.",
    "reports.sumReevaluateRetry": "Re-evaluate roster for retry.",
    "reports.absCompleted": "The contract was completed.",
    "reports.absFailed": "The contract failed.",
    "reports.absChecksFailedLine": (p) => {
      const failed = num(p, "failed");
      const name = str(p, "name");
      let base = failed === 1 ? "One mechanic check failed" : `${failed} of ${num(p, "total")} mechanic checks failed`;
      if (name) base += `; one was carried by ${name}'s clutch resolve`;
      return base + ".";
    },
    "reports.absAllPassed": "All checks passed.",
    "reports.absCostIn": (p) => `The cost is in ${str(p, "name")}.`,
    "reports.absStressToll": "The stress toll was significant.",
    "reports.absCameHomeClean": "The team came home clean.",
    "reports.absCameHome": "The team came home.",

    "checklist.dramaResolved": "Drama resolved",
    "checklist.dramaUnresolved": (p) => `${num(p, "n")} drama unresolved`,
    "checklist.rewardsResolved": "Rewards resolved",
    "checklist.rewardsPending": (p) => {
      const n = num(p, "n");
      return `${n} reward${n === 1 ? "" : "s"} pending`;
    },
    "checklist.contractsQueued": (p) => {
      const n = num(p, "n");
      return `${n} contract${n === 1 ? "" : "s"} queued`;
    },
    "checklist.noContracts": "No contracts assigned",

    "tutorial.step0": "A rivalry is already brewing. Resolve the drama card below.",
    "tutorial.step1": "Good. Now go to Assign — use the recommended roster and read why each check passes or fails.",
    "tutorial.step2": "Agents slotted. If the readout says Good or Risky, hit Advance Cycle. If it says Not ready, build Training or adjust the roster.",
    "tutorial.step3": "Your first Field Report. The loop is contract → report → loot/base upgrade → harder contract.",
    "tutorial.skip": "skip",

    "transition.processing": "PROCESSING",
    "transition.tickerCleared": (p) => `${str(p, "name")} — CLEARED`,
    "transition.tickerPartial": (p) => `${str(p, "name")} — PARTIAL`,
    "transition.tickerFailed": (p) => `${str(p, "name")} — FAILED`,
    "transition.tickerStress": (p) => `${str(p, "name")} — STRESS +${num(p, "n")}`,
    "transition.tickerMoraleDown": (p) => `${str(p, "name")} — MORALE ↓`,
    "transition.tickerMoraleUp": (p) => `${str(p, "name")} — MORALE ↑`,
    "transition.tickerRel": (p) => `${str(p, "a")} → ${str(p, "state")} W/ ${str(p, "b")}`,
    "transition.kickerCleanSweep": "CLEAN SWEEP",
    "transition.kickerPersonnelCrisis": "PERSONNEL CRISIS",
    "transition.kickerRaidReport": "RAID REPORT",
    "transition.kickerStandout": "STANDOUT PERFORMANCE",
    "transition.kickerCloseCall": "CLOSE CALL",
    "transition.kickerCycleUpdate": "CYCLE UPDATE",
    "transition.deckHeavyLosses": (p) => `The roster took heavy losses against ${str(p, "challenge")}.`,
    "transition.deckBarelyHeld": (p) => `${str(p, "name")} barely held the line.`,
    "transition.deckRazorThin": "The margin was razor-thin.",
    "transition.deckPerfect": "No issues. The group executed perfectly.",
    "transition.deckSteppedUp": (p) => `${str(p, "name")} stepped up when it mattered.`,
    "transition.deckPartialPressure": "The group managed a partial clear under pressure.",
    "transition.deckCouldntHold": (p) => `${str(p, "name")} couldn't hold it together.`,
    "transition.deckAnotherCycle": "Another cycle in the books.",
    "transition.cycleArc": (p) => `CYCLE ${str(p, "cycle")} · ARC 01`,
    "transition.intent": "INTENT",
    "transition.achieved": "ACHIEVED",
    "transition.missed": "MISSED",
    "transition.partial": "PARTIAL",
    "transition.achievedRow": "Achieved",
    "transition.missedRow": "Missed",
    "transition.partialRow": "Partial",
    "transition.tapContinue": "TAP TO CONTINUE",

    "headline.wipedGroup": "WIPED THE GROUP.",
    "headline.failed": "FAILED.",
    "headline.fellApart": "FELL APART.",
    "headline.partialClear": "PARTIAL CLEAR.",
    "headline.carried": (p) => `${str(p, "name")} CARRIED IT.`,
    "headline.clearedBarely": "CLEARED. BARELY.",
    "headline.clean": "CLEAN.",
    "headline.clear": "CLEAR.",
    "headline.nearly": "NEARLY",

    "digest.editionNo": (p) => `No. ${str(p, "n")}`,
    "digest.cycle": (p) => `Cycle ${num(p, "n")}`,
    "digest.fieldDigest": "Field Digest",
    "digest.tallyCleared": (p) => `${num(p, "n")} cleared`,
    "digest.tallyPartial": (p) => `${num(p, "n")} partial`,
    "digest.tallyFailed": (p) => `${num(p, "n")} failed`,
    "digest.tallyAfflictions": (p) => `${num(p, "n")} afflictions`,
    "digest.tallyDrops": (p) => `${num(p, "n")} drops`,
    "digest.applied": "All outcomes applied — nothing to collect. The report below is the record.",
    "digest.cycleTally": "Cycle Tally",
    "digest.perf": (p) => `PERF ${num(p, "n")}`,
    "digest.stressChip": (p) => `${str(p, "delta")} STRESS`,
    "digest.downed": "DOWNED",
    "digest.heroic": "HEROIC",
    "digest.contractAudits": "Contract Audits",
    "digest.carry": (p) => `carry · ${str(p, "name")}`,
    "digest.drops": "Drops",
    "digest.docket": "DOCKET",
    "digest.appliedChip": "APPLIED",

    "sidebar.dramaQueued": (p) => `Drama · ${str(p, "n")} Queued`,
    "sidebar.blocking": "Blocking",
    "sidebar.optionsTap": (p) => {
      const n = num(p, "n");
      return `${n} option${n > 1 ? "s" : ""} · tap to resolve`;
    },
    "sidebar.stressThreshold": "Stress · Threshold",
    "sidebar.lastReport": (p) => `Last Report · Cycle ${str(p, "n")}`,
    "sidebar.checksPassed": (p) => `${num(p, "passed")} of ${num(p, "total")} checks passed.`,
    "sidebar.dropsSuffix": (p) => {
      const n = num(p, "n");
      return ` ${n} drop${n > 1 ? "s" : ""}.`;
    },
    "sidebar.imminent": "Imminent",
    "sidebar.alertOneBadCycle": (p) => `${str(p, "name")} IS AT ${num(p, "n")}. ONE BAD CYCLE.`,
    "sidebar.alertWatchThis": (p) => `${str(p, "name")} IS AT ${num(p, "n")}. WATCH THIS.`,
    "sidebar.alertIsAfflicted": (p) => `${str(p, "name")} IS ${str(p, "kind")}.`,
    "sidebar.alertThreeAmbitious": "THREE AMBITIOUS AGENTS NOTICED.",
    "sidebar.alertHostilePairs": (p) => {
      const n = num(p, "n");
      return `${n} HOSTILE PAIR${n > 1 ? "S" : ""} IN ROTATION.`;
    },
    "sidebar.subOptionsTap": (p) => `${num(p, "n")} options · tap to resolve`,
    "sidebar.subRecreation": "Send to Recreation or reduce assignments",
    "sidebar.subRest": "Rest or mentor to clear",
    "sidebar.subStressPer": "+1 stress per shared challenge",

    "library.heading": "Library",
    "library.arcsAvailable": (p) => {
      const n = num(p, "n");
      return `${n} arc${n === 1 ? "" : "s"} available`;
    },
    "library.active": "Active",
    "library.inspect": "Inspect",
    "library.export": "Export",
    "library.load": "Load",
    "library.resume": "Resume",
    "library.removeAria": "Remove arc",
    "library.exportBlocked": (p) => `Export blocked — "${str(p, "name")}" failed validation:`,
    "library.exported": (p) => `Exported "${str(p, "name")}" as ${str(p, "file")}.`,
    "library.importArc": "Import arc",
    "library.importHelp": "Paste arc JSON below, or upload a file. Import runs schema validation; invalid arcs are rejected with a line-by-line explanation.",
    "library.validateSave": "Validate & Save",
    "library.validationFailed": "Validation failed:",
    "library.imported": (p) => `Imported "${str(p, "name")}" v${str(p, "version")}.`,

    "workshop.heading": "Cartridge Workshop",
    "workshop.intro": "Author or edit a cartridge as JSON. Validate runs the real schema check used everywhere else; nothing here is saved until you say so.",
    "workshop.newFromSkeleton": "New from Skeleton",
    "workshop.duplicateFromLibrary": "Duplicate from Library",
    "workshop.duplicateSelectAria": "Choose an arc from the library to duplicate",
    "workshop.duplicateSelectPlaceholder": "Choose an arc…",
    "workshop.duplicateLoad": "Load into Editor",
    "workshop.duplicateEmptyLibrary": "No arcs in the library yet.",
    "workshop.importFileAria": "Import a cartridge file",
    "workshop.editorAria": "Cartridge JSON editor",
    "workshop.validate": "Validate",
    "workshop.saveToLibrary": "Save to Library",
    "workshop.exportArc": "Export .arc.json",
    "workshop.validOk": "Valid.",
    "workshop.digest": (p) => `Digest ${str(p, "digest")}`,
    "workshop.validationFailed": "Validation failed:",
    "workshop.countChallenges": (p) => {
      const n = num(p, "n");
      return `${n} challenge${n === 1 ? "" : "s"}`;
    },
    "workshop.countRoles": (p) => {
      const n = num(p, "n");
      return `${n} role${n === 1 ? "" : "s"}`;
    },
    "workshop.countItems": (p) => {
      const n = num(p, "n");
      return `${n} item${n === 1 ? "" : "s"}`;
    },
    "workshop.countAttunementChains": (p) => {
      const n = num(p, "n");
      return `${n} attunement chain${n === 1 ? "" : "s"}`;
    },
    "workshop.countNarrativeEvents": (p) => {
      const n = num(p, "n");
      return `${n} narrative event${n === 1 ? "" : "s"}`;
    },
    "workshop.countProgressionTiers": (p) => {
      const n = num(p, "n");
      return `${n} progression tier${n === 1 ? "" : "s"}`;
    },
    "workshop.saved": (p) => `Saved "${str(p, "name")}" v${str(p, "version")} to the library.`,
    "workshop.saveBlocked": "Save blocked — validation failed:",
    "workshop.exported": (p) => `Exported "${str(p, "name")}" as ${str(p, "file")}.`,
    "workshop.exportBlocked": "Export blocked — validation failed:",

    "codex.attributes": "Attributes",
    "codex.roles": "Roles",
    "codex.traits": "Traits",
    "codex.facilities": "Facilities",
    "codex.howChallenges": "How challenges resolve",
    "codex.manualAria": "Manual",
    "codex.closeManualAria": "Close manual",
    "codex.replayTutorial": "Replay tutorial",
    "codexRef.usedInRoles": "Used in roles:",
    "codexRef.checkedIn": "Checked in:",
    "codexRef.notChecked": "Not directly checked in any challenge.",
    "codexRef.checkWeight": (p) => `${str(p, "challenge")} — ${str(p, "check")} (weight ${str(p, "weight")})`,
    "codexRef.leadAttribute": "Lead attribute:",
    "codexRef.weightBreakdown": "Weight breakdown:",
    "codexRef.mechEffect": "Mechanical effect:",
    "codexRef.attrsThatMatter": "Attributes that matter:",
    "codexRef.noAttrsWeighted": "No attributes weighted for this check.",
    "codexRef.howScored": "How it's scored:",
    "codexRef.target": "Target:",
    "codexRef.whenUpgrade": "When you upgrade:",
    "scope.per_agent": "Each assigned agent is checked individually.",
    "scope.team_aggregate": "The whole team's combined score is checked.",
    "scope.role_specific": "Only agents in the required role are checked.",
    "fac.Quarters.upgrade": "Each level raises the roster cap by 5, letting you carry more agents.",
    "fac.Production.upgrade": "Higher level multiplies per-agent material output each cycle.",
    "fac.Recreation.upgrade": "Higher level raises the morale floor (level × 10) for assigned agents.",
    "fac.Research.upgrade": "Higher level increases intel generated by assigned agents.",
    "fac.Training.upgrade": "Higher level grows assigned agents' attributes faster — the long-term fix for failed stat checks.",
    "fac.Storage.upgrade": "Higher level protects a larger resource stockpile between cycles.",
    "fac.Medical.upgrade": "Higher level shortens downed-agent recovery time.",
    "traitfx.infraEfficiencyMultiplier": (p) => `Infrastructure output is multiplied by ${str(p, "multiplier")}.`,
    "traitfx.moralePenaltyMultiplierOnRewardDisappointment": (p) => `Morale penalty from reward disappointment is multiplied by ${str(p, "multiplier")}.`,
    "traitfx.mentorshipTierGapBonus": (p) => `Can form Mentorship across a tier gap of only ${str(p, "gap")}.`,
    "traitfx.relationshipFormationMultiplier": (p) => `Relationship formation rate is multiplied by ${str(p, "multiplier")}.`,
    "traitfx.hostileStressImmunity": "Immune to stress from Hostile relationships.",
    "traitfx.recklessAfflictionChanceBonus": (p) => `Reckless affliction chance increased by ${num(p, "pct")}%.`,
    "traitfx.attributeBonusWhenMoraleHigh": (p) => `+${str(p, "bonus")} to ${str(p, "attr")} when morale is above ${str(p, "threshold")}.`,
    "traitfx.stressAccumulationMultiplier": (p) => `Stress accumulation is multiplied by ${str(p, "multiplier")}.`,
    "traitfx.moraleGainMultiplier": (p) => `Morale gain is multiplied by ${str(p, "multiplier")}.`,
    "traitfx.attributeCheckBonus": (p) => `+${str(p, "bonus")} to ${str(p, "attr")} checks.`,
    "traitfx.stressOnPartialSuccess": (p) => `Gains ${str(p, "amount")} stress on any partial success.`,
    "traitfx.relationshipAffinityMultiplier": (p) => `Relationship affinity gains are multiplied by ${str(p, "multiplier")}.`,
    "traitfx.moraleSensitivityToTeamLoss": (p) => `Morale sensitivity to team losses is multiplied by ${str(p, "multiplier")}.`,
    "traitfx.ambitionSignal": "Signals that hidden Ambition is likely high.",

    "trust.bundled": "Bundled",
    "trust.importedUnsigned": "Imported · Unsigned",
    "trust.verified": "Verified",
    "trust.quarantined": "Quarantined",

    "whatsnew.title": "What's new",
    "whatsnew.added": "Added",
    "whatsnew.changed": "Changed",
    "whatsnew.fixed": "Fixed",
    "whatsnew.closeAria": "Close what's new",

    "vocab.morale": "morale",
    "vocab.stress": "stress",
    "vocab.loyalty": "loyalty",
    "vocab.Hostile": "HOSTILE",
    "vocab.Rivalrous": "RIVALROUS",
    "trigger.reward_dispute": "reward dispute",
    "trigger.relationship_transition": "relationship transition",
    "trigger.affliction_threshold": "affliction threshold",
    "trigger.morale_extreme": "morale extreme",
    "trigger.precedent_violation": "precedent violation",
    "trigger.prolonged_benching": "prolonged benching",
    "trigger.rivalrous_perf_gap": "rivalrous performance gap",
    "trigger.bonded_partner_lost": "bonded partner lost",
  },
  "zh-Hant": {
    "locale.enLabel": "EN",
    "locale.zhHantLabel": "中文",

    "common.save": "儲存",
    "common.edit": "編輯",
    "common.reset": "重設",
    "common.manual": "手冊",
    "common.designer": "設計器",
    "common.close": "關閉",
    "common.cancel": "取消",
    "common.back": "返回",
    "common.remove": "移除",
    "common.flex": "機動",
    "common.pass": "通過",
    "common.fail": "未過",

    "nav.roster": "名冊",
    "nav.assign": "指派",
    "nav.drama": "劇情",
    "nav.base": "基地",
    "nav.reports": "報告",

    "header.situationRoom": (p) => `戰情室 · 週期 ${str(p, "cycle")}`,
    "header.rosterCount": (p) => `名冊 · ${str(p, "count")}`,
    "header.subtitle": (p) => `${str(p, "domain")} · 第一階 · 已通關 ${num(p, "cleared")}／${num(p, "total")} · 版本 ${str(p, "build")}`,
    "header.statNext": (p) => `下週期 +${num(p, "n")}`,
    "header.statUpkeep": (p) => `-${num(p, "n")}`,
    "header.statToNextTier": "距下一階",
    "header.statTopTier": "最高階",
    "header.lightMode": "淺色模式",
    "header.darkMode": "深色模式",
    "header.switchToLight": "切換至淺色模式",
    "header.switchToDark": "切換至深色模式",
    "header.openManual": "開啟手冊",

    "stats.drama": "劇情",
    "stats.queued": "待處理",
    "stats.nextCycle": (p) => `下週期 +${num(p, "n")}`,
    "stats.upkeepSub": (p) => `維持費 -${num(p, "n")}`,
    "stats.ofToNextTier": (p) => `距下一階還差 ${num(p, "n")}`,

    "intent.label": "意圖 · 本週期",
    "intent.empty": "尚未設定意圖。點擊「編輯」新增。",
    "intent.placeholder": "例：刷 Attumen 農本。推 Moroes 首殺。",

    "advance.cycle": "推進週期 →",
    "advance.blocked": "推進受阻",
    "advance.blockedShort": "受阻",
    "blockers.dramaCards": (p) => `推進前請先處理 ${num(p, "count")} 張劇情卡。`,
    "blockers.rewardDecisions": (p) => `請在報告中處理 ${num(p, "count")} 項待定的獎勵決策。`,

    "ctx.decisionsPending": (p) => `${num(p, "count")} 項決策待處理`,
    "ctx.rewardsToAssign": (p) => `${num(p, "count")} 項獎勵待分配`,
    "ctx.contractsQueued": (p) => `${num(p, "count")} 份契約已排入 · ${num(p, "deployed")} 人出動`,
    "ctx.readyToAdvance": "可以推進",

    "badge.new": "新",

    "confirm.reset": "重設遊戲？所有進度將會遺失。",
    "confirm.loadArc": "載入其他弧會清除目前的存檔。要繼續嗎？",
    "confirm.removeArc": (p) => `要從資料庫移除「${str(p, "name")}」嗎？內建的弧無法移除；只能移除匯入的。`,

    "title.continue": (p) => `繼續 · 週期 ${str(p, "cycle")}`,
    "title.agentsCount": (p) => `${num(p, "count")} 名人員`,
    "title.reputation": (p) => `聲望 ${str(p, "value")}`,
    "title.contractsItems": (p) => `${num(p, "contracts")} 份契約${num(p, "items") > 0 ? ` · ${num(p, "items")} 件物品` : ""}`,
    "title.guaranteeDeterministicLabel": "確定性",
    "title.guaranteeDeterministicBody": "相同種子，相同執行",
    "title.guaranteeOfflineLabel": "離線",
    "title.guaranteeOfflineBody": "無 API，無雲端",
    "title.guaranteePortableLabel": "可攜",
    "title.guaranteePortableBody": "JSON 弧格式",
    "title.colophon": (p) => `AXM 弧 · v${str(p, "version")} · 引擎 ${str(p, "engine")}`,
    // "title.designerPrototype" intentionally untranslated (see EN_ONLY_IDS).
    "title.releaseNotes": "發行說明",
    "title.workshop": "工坊",
    "title.raidNight": "團本之夜",
    "raidnight.title": "團本之夜",
    "raidnight.subtitle": "一次鎖定，一道高牆。不斷開怪，直到公會準備就緒。",
    "raidnight.raidParty": "出戰隊伍",
    "raidnight.bench": "替補席",
    "raidnight.pull": "開怪",
    "raidnight.pullAgain": "再次開怪",
    "raidnight.attempt": (p) => `第 ${num(p, "n")} 次嘗試`,
    "raidnight.closestYet": (p) => `最接近：差 ${num(p, "n")}`,
    "raidnight.cleared": "已通關",
    "raidnight.clearedIn": (p) => `以 ${num(p, "n")} 次嘗試通關`,
    "raidnight.wipe": "團滅",
    "raidnight.whyWiped": "團滅原因",
    "raidnight.bottleneck": "瓶頸",
    "raidnight.threeThings": "重置前你可以改變的三件事",
    "raidnight.apply": "採用",
    "raidnight.ifApplied": "若採用",
    "raidnight.applied": "已採用——再次開怪。",
    "raidnight.field": "上場",
    "raidnight.benchVerb": "換下",
    "raidnight.benchedCount": (p) => `替補 ${num(p, "n")} 次`,
    "raidnight.nightsAttended": (p) => `出戰 ${num(p, "n")} 次`,
    "raidnight.moraleShaky": "動搖——士氣低於 30",
    "raidnight.stressStrained": "緊繃——壓力高於 7",
    "raidnight.partyIllegal": (p) => `隊伍需要 ${num(p, "min")}–${num(p, "max")} 人，且包含必需的職責`,
    "raidnight.needed": "需要",
    "raidnight.putUp": "打出",
    "raidnight.stress": "壓力",
    "raidnight.morale": "士氣",
    "raidnight.back": "返回",
    "raidnight.reset": "新公會",
    "raidnight.lastPull": "上次開怪",
    "raidnight.changed": "下次開怪前的變更",
    "raidnight.tradeoffLabel": "取捨",
    "raidnight.guildCarried": (p) => `公會延續——${num(p, "n")} 名團員`,
    "raidnight.freshGuild": "全新公會——尚無記錄",
    "raidnight.incompatible": "公會不相容",
    "raidnight.startFresh": "在此重新開始",
    "raidnight.callItNight": "今晚到此為止",
    "raidnight.consequences": "這一夜為公會留下了什麼",
    "raidnight.consNotSaved": "尚未記錄",
    "raidnight.commit": "寫入公會記錄",
    "raidnight.committed": "已寫入",
    "raidnight.consequencesRemain": "勝負已定，餘波長存。",
    "raidnight.startNextTier": (p) => `進入下一階——${str(p, "boss")}`,
    "raidnight.tryIncompatible": "嘗試不相容的階段（示範）",
    "raidnight.ready": "準備就緒",
    "raidnight.ledgerNone": "尚無記錄",
    "raidnight.rightHint": "開怪以查看結果。",
    "raidnight.consScars": "傷痕",
    "raidnight.consLegends": "此戰傳奇",
    "raidnight.consMorale": "士氣與壓力",
    "raidnight.consLoot": "戰利品與公平",
    "raidnight.consLootFair": "件 · 分配公平",
    "raidnight.consPrecedents": "新慣例",
    "raidnight.consProgress": "進程",
    "raidnight.consTierUnlocked": "解鎖下一階",
    "raidnight.consNoAdvance": "未推進階段",

    "roster.personnel": "人員",
    "roster.activeCount": (p) => `${num(p, "count")} 名現役`,
    "roster.empty": "沒有人員。請到基地畫面招募。",
    "roster.morale": "士氣",
    "roster.stress": "壓力",
    "roster.afflicted": (p) => `受創狀態：${str(p, "kind")}`,
    "roster.thresholdNear": "接近壓力閾值",
    "roster.agentNo": (p) => `編號 ${str(p, "n")}`,
    "roster.attributes": "屬性",
    "roster.hiddenAttributes": "隱藏屬性",
    "roster.traits": "特質",
    "roster.equipment": "裝備",
    "roster.undiscovered": "（尚未發現）",
    "roster.unequipped": "未裝備。",
    "roster.footer": (p) => `階級 ${str(p, "tier")} · 維持費 ${num(p, "upkeep")}／週期 · 基礎效率 ${str(p, "eff")}`,
    "roster.hiddenLoyalty": "忠誠",
    "roster.hiddenAmbition": "野心",
    "roster.hiddenVolatility": "易變",
    "roster.hiddenLeadership": "領導",
    "bark.threshold0": "我還能再撐一場。大概吧。",
    "bark.threshold1": "別再把我排在他們旁邊。",
    "bark.threshold2": "數字沒問題。我沒問題。",
    "bark.afflicted0": "我不再自願了。",
    "bark.afflicted1": "去問還在乎的人吧。",
    "bark.afflicted2": "你早就知道我的想法。",
    "bark.high0": "讓我上。什麼契約都行。",
    "bark.high1": "我們比一直在跑的那些更強。",
    "bark.high2": "這才是應有的感覺。",
    "bark.low0": "隨你決定。",
    "bark.low1": "需要我的話，我在候補席。",
    "bark.low2": "開始懷疑這一切有什麼意義。",

    "hints.traitReveal": (p) => `再 ${num(p, "n")} 次任務揭示特質`,
    "hints.hiddenReveal": (p) => `再 ${num(p, "n")} 次任務揭示隱藏屬性`,
    "hints.allRevealed": "所有資訊已揭示",

    "assign.contracts": "契約",
    "assign.tierAvailable": (p) => `第一階 · ${num(p, "count")} 份可接`,
    "assign.guidance": "核心循環：選一份契約，讀預估檢定，套用推薦隊伍；當讀數顯示尚未就緒時，把金幣花在基地升級上。",
    "assign.contractNo": (p) => `契約 ${str(p, "n")} · `,
    "assign.firstClearPush": "首次通關衝刺",
    "assign.farm": "農本",
    "assign.diff": (p) => `難度 ${str(p, "n")}`,
    "assign.assignedLockout": (p) => `已指派 ${num(p, "have")}／${str(p, "max")} · 鎖定 ${num(p, "tokens")}`,
    "assign.checksCount": (p) => `${num(p, "n")} 項檢定`,
    "assign.passN": (p) => `${num(p, "n")} 過`,
    "assign.tightN": (p) => `${num(p, "n")} 緊`,
    "assign.failN": (p) => `${num(p, "n")} 敗`,
    "assign.projectedMechanics": (p) => `預估機制 · ${num(p, "n")} 項檢定`,
    "assign.available": "可接契約",
    "assign.nothingUnlocked": "尚未解鎖任何契約。",
    "assign.cleared": "已通關",
    "assign.agentsRange": (p) => `${num(p, "min")}-${num(p, "max")} 名人員`,
    "assign.queued": " · 已排入",
    "assign.farmLockout": " · 0 鎖定（農本）",
    "assign.recommended": (p) => `推薦：${str(p, "names")}`,
    "assign.noLegalTeam": "無合法隊伍",
    "assign.noLegalTeamText": "目前可用人員不足以滿足此契約的職責與隊伍需求。",
    "assign.notReady": "尚未就緒",
    "assign.notReadyText": (p) => `最佳隊伍在 ${str(p, "mechanic")} 仍差 ${num(p, "margin")}。強行之前，先蓋訓練所、補 ${str(p, "attr")} 裝備，或招募新人。`,
    "assign.notReadyFallback": "最佳隊伍仍至少有一項檢定未過。",
    "assign.riskyClear": "冒險通關",
    "assign.riskyClearText": (p) => `${num(p, "n")} 項檢定很接近。可以執行，但報告之後的壓力／士氣波動可能有影響。`,
    "assign.goodPlan": "計畫良好",
    "assign.goodPlanText": "目前隊伍能從容通過所有預估檢定。這是穩妥之選。",
    "assign.reads": (p) => `讀取 ${str(p, "summary")}`,
    "assign.team": "全隊",
    "assign.pickRange": (p) => `選 ${num(p, "min")}-${num(p, "max")} 名人員 · 已選 ${num(p, "selected")}`,
    "assign.autofill": "自動填入",
    "assign.recommendedRoster": "推薦隊伍",
    "assign.useRecommended": "採用推薦隊伍",
    "assign.liveReadout": "即時讀數 · 上場之前",
    "assign.stressBadge": "壓力",
    "assign.roleReqNotMet": "職責需求未滿足。",
    "assign.slotRoster": (p) => `編入隊伍（${num(p, "n")} 名人員，1 鎖定）`,
    "assign.assessComfortable": "從容",
    "assign.assessTight": "緊繃",
    "assign.assessFail": "未過",

    "drama.precedentLogged": "先例已記錄",
    "drama.councilCycle": (p) => `議會 · 週期 ${str(p, "cycle")}`,
    "drama.decisions": (p) => {
      const n = num(p, "count");
      return `${ZH_NUM[n] ?? String(n)}項決策`;
    },
    "drama.empty": "佇列中沒有劇情卡。每個週期結束後，壓力事件、關係變化與契約結果會產生劇情。",
    "drama.evidence": (p) => `證據 / ${str(p, "type")}`,
    "drama.cardXofY": (p) => `第 ${str(p, "x")}/${str(p, "y")} 張`,
    "drama.hlRewardPre": "「",
    "drama.hlRewardPost": "」掉落了。",
    "drama.hlReward": "一件獎勵掉落了。",
    "drama.hlRelationship": "關係出現變化。",
    "drama.hlAffliction": "觸及壓力閾值。",
    "drama.hlMorale": "士氣走向極端。",
    "drama.hlPrecedent": "違反先例。",
    "drama.hlBenching": "冷板凳被注意到了。",
    "drama.hlRivalry": "對立正在升級。",
    "drama.hlBond": "羈絆斷裂。",
    "drama.twoEligible": (p) => `兩名${str(p, "role")}皆符合資格。`,
    "drama.noDropYet": (p) => `${str(p, "name")} 還沒拿過任何掉落。`,
    "drama.newUnderequipped": (p) => `${str(p, "name")} 是新人，裝備不足。`,
    "drama.noDropInCycles": (p) => `${str(p, "name")} 已 ${num(p, "n")} 個週期沒拿到掉落。`,
    "drama.disenchant": "分解為材料 · 沒有劇情，沒有升級",
    "drama.award": (p) => `頒給 ${str(p, "name")}`,
    "drama.tagBasis": "依據",
    "drama.tagVisible": "可見",
    "drama.tagHidden": "隱藏",
    "drama.orgWide": (p) => `${str(p, "delta")} ${str(p, "type")}（全組織）`,
    "drama.effectOn": (p) => `${str(p, "name")} ${str(p, "delta")} ${str(p, "type")}`,
    "drama.precedentConsistency": "+先例一致性 · Korrin 注意到了",
    "drama.loyaltyViolation": (p) => `三名有野心的人員忠誠 -${num(p, "n")} · 違反先例`,
    "drama.moraleSmall": (p) => `${str(p, "name")} 士氣 ${str(p, "delta")}（輕微）`,
    "drama.precedentLast": (p) => `先例 · 最近 ${num(p, "n")} 次獎勵決策`,
    "drama.hiddenLoyaltyAmbition": (p) => ` · 忠誠 ${str(p, "loyalty")} · 野心 ${str(p, "ambition")}`,
    "basis.award_a": "功績 · 資歷",
    "basis.award_b": "需求 · 輪替",
    "basis.promise_rotation": "輪替",
    "basis.stay_course": "維持現狀",
    "basis.promote_officer": "偏袒",
    "basis.intervene": "直接介入",
    "basis.separate": "隔離",
    "basis.let_it_play": "不介入",
    "basis.rest_treatment": "照護",
    "basis.push_through": "產出優先",
    "basis.bench_indefinitely": "撤除",
    "basis.acknowledge": "表彰",
    "basis.private_talk": "直接介入",
    "basis.ignore": "不介入",
    "basis.explain": "透明",
    "basis.double_down": "權威",
    "basis.revert": "一致性",
    "basis.acknowledge_winner": "功績訊號",
    "basis.mentor_pair": "培養",
    "basis.ignore_gap": "不介入",
    "basis.memorial": "追念",
    "basis.new_assignment": "轉移注意",
    "basis.leave_of_absence": "照護",

    "base.heading": "基地",
    "base.facilitiesCount": (p) => `${num(p, "count")} 座設施`,
    "base.guidance": (p) => `金幣用於升級設施。每一級設施都會使下週期的${str(p, "token")}回復提高 ${num(p, "pct")}%（目前 +${num(p, "current")}%，上限 +50%）。訓練所是屬性檢定失敗的長期解方；娛樂設施是短期的壓力閥。`,
    "base.recommendedMove": "推薦的基地行動",
    "base.recReasonStress": (p) => `${num(p, "n")} 名人員接近壓力危險區。娛樂設施能換來更安全的重複執行。`,
    "base.recReasonTraining": "當指派讀數顯示隊伍尚未就緒時，訓練所是最乾淨的答案。",
    "base.alsoRaises": (p) => ` 基地等級也會提高下週期的${str(p, "token")}收入，升級因此轉化為更多契約嘗試。`,
    "base.rosterCap": "名冊上限",
    "base.upkeepCycle": "維持費／週期",
    "base.unbuilt": "未建造",
    "base.assignedN": (p) => `已指派 ${num(p, "n")} 人`,
    "base.upgradeTo": (p) => `升級至 L${num(p, "level")}（${num(p, "cost")} ${str(p, "currency")}）`,
    "fac.Quarters.name": "宿舍",
    "fac.Quarters.desc": "名冊容量（每級 5 人）。",
    "fac.Quarters.why": "提高名冊上限，讓你能容納更多專才而不必裁掉老手。",
    "fac.Production.name": "生產",
    "fac.Production.desc": "打造裝備。產出隨駐派人員的基礎效率提升。",
    "fac.Production.why": "每個週期把駐派人員轉化為材料；材料供給日後的製作／內容循環。",
    "fac.Recreation.name": "娛樂",
    "fac.Recreation.desc": "壓力恢復。提升招募池品質。",
    "fac.Recreation.why": "駐派人員回復 2 點壓力，並獲得等級 × 10 的士氣下限。",
    "fac.Research.name": "研究",
    "fac.Research.desc": "解鎖挑戰情報與弧的背景設定。",
    "fac.Research.why": "駐派人員產生情報事件；隱藏脈絡／設定應在此浮現。",
    "fac.Training.name": "訓練",
    "fac.Training.desc": "加速駐派人員的屬性成長。",
    "fac.Training.why": "駐派人員隨時間獲得隨機屬性——這是屬性檢定失敗的直接解答。",
    "fac.Storage.name": "倉儲",
    "fac.Storage.desc": "跨週期的資源容量。",
    "fac.Storage.why": "用於在經濟擴張時保護更大的資源儲備。",
    "fac.Medical.name": "醫療",
    "fac.Medical.desc": "縮短倒下人員的恢復時間。",
    "fac.Medical.why": "以設施等級加上駐派人員的韌性，縮短倒下人員的恢復期。",

    "reports.empty": "尚無報告。請到「指派」為契約編入隊伍，然後按「推進週期」。",
    "reports.dropsPending": (p) => `掉落 · ${num(p, "n")} 項待定`,
    "reports.awarded": "已頒發",
    "reports.decisionPending": "決策待定",
    "reports.from": (p) => `來源：${str(p, "source")} · 週期 ${num(p, "cycle")}`,
    "reports.fieldReportNo": (p) => `戰地報告 / 第 ${str(p, "n")} 號 · ${str(p, "domain")} · 第一階`,
    "reports.cycleComposition": (p) => `週期 ${num(p, "cycle")} · 編制：${num(p, "agents")} 名人員 · 消耗 1 鎖定 · ${str(p, "outcome")}`,
    "reports.abstract": "摘要",
    "reports.outcome": "結果",
    "reports.checks": "檢定",
    "reports.failedN": (p) => `${num(p, "n")} 項未過`,
    "reports.allPassed": "全數通過",
    "reports.stressDelta": "壓力 Δ",
    "reports.acrossRoster": "全隊合計",
    "reports.loot": "戰利品",
    "reports.pendingN": (p) => `${num(p, "n")} 項待定`,
    "reports.noDrops": "無掉落",
    "reports.repPlus": (p) => `聲望 +${num(p, "n")}`,
    "reports.noRep": "無聲望",
    "reports.resolveCallout": (p) => `${str(p, "name")} 觸頂壓力上限，擲出了「堅毅」。兩個週期內所有檢定 +3。全隊都感受到了。`,
    "reports.clutchCallout": (p) => `${str(p, "name")} 把隊伍拉了回來。差距一點也不從容。`,
    "reports.audit": (p) => `審計 · ${num(p, "n")} 項檢定`,
    "reports.heroic": "英勇",
    "reports.stressChip": (p) => ` 壓力 +${num(p, "n")}`,
    "reports.downedChip": "倒下",
    "reports.cleanChip": "無傷",
    "reports.teamAggregate": "全隊合算",
    "reports.vsThreshold": (p) => ` · ${num(p, "score")} 對閾值 ${num(p, "threshold")}`,
    "reports.dropsN": (p) => `掉落 · ${num(p, "n")}`,
    "reports.eligible": (p) => `符合資格：${str(p, "names")}`,
    "reports.outcomeClean": "無傷",
    "reports.outcomePartial": "部分",
    "reports.outcomeWipe": "全滅",
    "reports.outcomeSuccessWord": "成功",
    "reports.outcomePartialWord": "部分",
    "reports.outcomeFailureWord": "失敗",
    "reports.sumFullClearLoot": (p) => `完全通關——${num(p, "checks")} 項檢定全數通過。${num(p, "drops")} 件戰利品掉落。`,
    "reports.sumFullClear": (p) => `完全通關——${num(p, "checks")} 項檢定全數通過。`,
    "reports.sumStressAccrued": (p) => ` 累計壓力：+${num(p, "n")}。`,
    "reports.sumZeroStress": " 零壓力。",
    "reports.sumPartial": (p) => `${num(p, "total")} 項檢定通過 ${num(p, "passed")} 項；${num(p, "failed")} 項未過。`,
    "reports.sumStressAcross": (p) => ` 全隊壓力 +${num(p, "n")}。`,
    "reports.sumChecksMet": (p) => `${num(p, "total")} 項檢定達成 ${num(p, "passed")} 項。`,
    "reports.sumStressDistributed": (p) => ` 分攤壓力 +${num(p, "n")}。`,
    "reports.sumDowned": (p) => ` ${str(p, "names")} 倒下。`,
    "reports.sumAwardDrop": "請頒發下方的掉落。",
    "reports.sumConsiderResting": (p) => `下次出動前，考慮讓 ${str(p, "names")} 休息。`,
    "reports.sumTeamReady": "隊伍已可推進。",
    "reports.sumRestHighStress": "重試前考慮讓高壓力人員休息。",
    "reports.sumReevaluate": "重試前重新評估隊伍編成。",
    "reports.sumDownedUnavailable": "倒下的人員下個週期無法出動。重試前重新評估隊伍。",
    "reports.sumReevaluateRetry": "重試前重新評估隊伍。",
    "reports.absCompleted": "契約已完成。",
    "reports.absFailed": "契約失敗。",
    "reports.absChecksFailedLine": (p) => {
      const failed = num(p, "failed");
      const name = str(p, "name");
      let base = failed === 1 ? "一項機制檢定未過" : `${num(p, "total")} 項機制檢定中有 ${failed} 項未過`;
      if (name) base += `；其中一項靠 ${name} 的關鍵堅毅撐了下來`;
      return base + "。";
    },
    "reports.absAllPassed": "所有檢定通過。",
    "reports.absCostIn": (p) => `代價落在 ${str(p, "name")} 身上。`,
    "reports.absStressToll": "壓力代價相當可觀。",
    "reports.absCameHomeClean": "隊伍毫髮無傷地回來了。",
    "reports.absCameHome": "隊伍回來了。",

    "checklist.dramaResolved": "劇情已處理",
    "checklist.dramaUnresolved": (p) => `${num(p, "n")} 項劇情未處理`,
    "checklist.rewardsResolved": "獎勵已處理",
    "checklist.rewardsPending": (p) => `${num(p, "n")} 項獎勵待定`,
    "checklist.contractsQueued": (p) => `${num(p, "n")} 份契約已排入`,
    "checklist.noContracts": "尚未指派契約",

    "tutorial.step0": "一場對立已在醞釀。請處理下方的劇情卡。",
    "tutorial.step1": "很好。現在到「指派」——採用推薦隊伍，並讀懂每項檢定為何通過或失敗。",
    "tutorial.step2": "人員已就位。若讀數顯示「良好」或「冒險」，按「推進週期」；若顯示「尚未就緒」，就蓋訓練所或調整隊伍。",
    "tutorial.step3": "你的第一份戰地報告。循環是：契約 → 報告 → 戰利品／基地升級 → 更難的契約。",
    "tutorial.skip": "略過",

    "transition.processing": "處理中",
    "transition.tickerCleared": (p) => `${str(p, "name")} — 通關`,
    "transition.tickerPartial": (p) => `${str(p, "name")} — 部分`,
    "transition.tickerFailed": (p) => `${str(p, "name")} — 失敗`,
    "transition.tickerStress": (p) => `${str(p, "name")} — 壓力 +${num(p, "n")}`,
    "transition.tickerMoraleDown": (p) => `${str(p, "name")} — 士氣 ↓`,
    "transition.tickerMoraleUp": (p) => `${str(p, "name")} — 士氣 ↑`,
    "transition.tickerRel": (p) => `${str(p, "a")} → 與 ${str(p, "b")} ${str(p, "state")}`,
    "transition.kickerCleanSweep": "完美橫掃",
    "transition.kickerPersonnelCrisis": "人事危機",
    "transition.kickerRaidReport": "征戰快報",
    "transition.kickerStandout": "傑出表現",
    "transition.kickerCloseCall": "千鈞一髮",
    "transition.kickerCycleUpdate": "週期快報",
    "transition.deckHeavyLosses": (p) => `隊伍在 ${str(p, "challenge")} 損失慘重。`,
    "transition.deckBarelyHeld": (p) => `${str(p, "name")} 勉強守住了防線。`,
    "transition.deckRazorThin": "勝負只在毫釐之間。",
    "transition.deckPerfect": "毫無問題。隊伍執行得完美無缺。",
    "transition.deckSteppedUp": (p) => `${str(p, "name")} 在關鍵時刻挺身而出。`,
    "transition.deckPartialPressure": "隊伍在壓力下完成了部分通關。",
    "transition.deckCouldntHold": (p) => `${str(p, "name")} 撐不住了。`,
    "transition.deckAnotherCycle": "又一個週期載入史冊。",
    "transition.cycleArc": (p) => `週期 ${str(p, "cycle")} · 弧 01`,
    "transition.intent": "意圖",
    "transition.achieved": "達成",
    "transition.missed": "未達",
    "transition.partial": "部分",
    "transition.achievedRow": "達成",
    "transition.missedRow": "未達",
    "transition.partialRow": "部分",
    "transition.tapContinue": "點擊繼續",

    "headline.wipedGroup": "全隊覆滅。",
    "headline.failed": "失敗。",
    "headline.fellApart": "分崩離析。",
    "headline.partialClear": "部分通關。",
    "headline.carried": (p) => `${str(p, "name")} 一肩扛起。`,
    "headline.clearedBarely": "通關。險之又險。",
    "headline.clean": "無傷通關。",
    "headline.clear": "通關。",
    "headline.nearly": "險些",

    "digest.editionNo": (p) => `第 ${str(p, "n")} 號`,
    "digest.cycle": (p) => `週期 ${num(p, "n")}`,
    "digest.fieldDigest": "戰地摘要",
    "digest.tallyCleared": (p) => `${num(p, "n")} 通關`,
    "digest.tallyPartial": (p) => `${num(p, "n")} 部分`,
    "digest.tallyFailed": (p) => `${num(p, "n")} 失敗`,
    "digest.tallyAfflictions": (p) => `${num(p, "n")} 受創`,
    "digest.tallyDrops": (p) => `${num(p, "n")} 掉落`,
    "digest.applied": "所有結果已套用——無需領取。下方的報告即是紀錄。",
    "digest.cycleTally": "週期結算",
    "digest.perf": (p) => `表現 ${num(p, "n")}`,
    "digest.stressChip": (p) => `壓力 ${str(p, "delta")}`,
    "digest.downed": "倒下",
    "digest.heroic": "英勇",
    "digest.contractAudits": "契約審計",
    "digest.carry": (p) => `主力 · ${str(p, "name")}`,
    "digest.drops": "掉落",
    "digest.docket": "待議",
    "digest.appliedChip": "已套用",

    "sidebar.dramaQueued": (p) => `劇情 · ${str(p, "n")} 項排隊中`,
    "sidebar.blocking": "阻擋推進",
    "sidebar.optionsTap": (p) => `${num(p, "n")} 個選項 · 點擊處理`,
    "sidebar.stressThreshold": "壓力 · 閾值",
    "sidebar.lastReport": (p) => `上次報告 · 週期 ${str(p, "n")}`,
    "sidebar.checksPassed": (p) => `${num(p, "total")} 項檢定通過 ${num(p, "passed")} 項。`,
    "sidebar.dropsSuffix": (p) => ` ${num(p, "n")} 件掉落。`,
    "sidebar.imminent": "迫近事件",
    "sidebar.alertOneBadCycle": (p) => `${str(p, "name")} 已達 ${num(p, "n")}。再一個壞週期就出事。`,
    "sidebar.alertWatchThis": (p) => `${str(p, "name")} 已達 ${num(p, "n")}。盯緊這裡。`,
    "sidebar.alertIsAfflicted": (p) => `${str(p, "name")} 目前 ${str(p, "kind")}。`,
    "sidebar.alertThreeAmbitious": "三名有野心的人員注意到了。",
    "sidebar.alertHostilePairs": (p) => `${num(p, "n")} 組敵對人員仍在輪替。`,
    "sidebar.subOptionsTap": (p) => `${num(p, "n")} 個選項 · 點擊處理`,
    "sidebar.subRecreation": "送去娛樂設施或減少指派",
    "sidebar.subRest": "休息或由導師輔導以解除",
    "sidebar.subStressPer": "每次共同出任務 +1 壓力",

    "library.heading": "資料庫",
    "library.arcsAvailable": (p) => `${num(p, "n")} 個弧可用`,
    "library.active": "使用中",
    "library.inspect": "檢視",
    "library.export": "匯出",
    "library.load": "載入",
    "library.resume": "繼續",
    "library.removeAria": "移除弧",
    "library.exportBlocked": (p) => `匯出受阻——「${str(p, "name")}」未通過驗證：`,
    "library.exported": (p) => `已將「${str(p, "name")}」匯出為 ${str(p, "file")}。`,
    "library.importArc": "匯入弧",
    "library.importHelp": "在下方貼上弧的 JSON，或上傳檔案。匯入會執行結構驗證；無效的弧會被拒絕，並逐行說明原因。",
    "library.validateSave": "驗證並儲存",
    "library.validationFailed": "驗證失敗：",
    "library.imported": (p) => `已匯入「${str(p, "name")}」v${str(p, "version")}。`,

    "workshop.heading": "卡帶工坊",
    "workshop.intro": "以 JSON 撰寫或編輯卡帶。「驗證」執行的是與其他地方相同的真實結構檢查；在你按下儲存之前，這裡的內容不會被寫入。",
    "workshop.newFromSkeleton": "從骨架新建",
    "workshop.duplicateFromLibrary": "從資料庫複製",
    "workshop.duplicateSelectAria": "選擇要複製的資料庫弧",
    "workshop.duplicateSelectPlaceholder": "選擇一個弧…",
    "workshop.duplicateLoad": "載入編輯器",
    "workshop.duplicateEmptyLibrary": "資料庫中尚無任何弧。",
    "workshop.importFileAria": "匯入卡帶檔案",
    "workshop.editorAria": "卡帶 JSON 編輯器",
    "workshop.validate": "驗證",
    "workshop.saveToLibrary": "儲存至資料庫",
    "workshop.exportArc": "匯出 .arc.json",
    "workshop.validOk": "有效。",
    "workshop.digest": (p) => `指紋 ${str(p, "digest")}`,
    "workshop.validationFailed": "驗證失敗：",
    "workshop.countChallenges": (p) => `${num(p, "n")} 個挑戰`,
    "workshop.countRoles": (p) => `${num(p, "n")} 個職責`,
    "workshop.countItems": (p) => `${num(p, "n")} 件物品`,
    "workshop.countAttunementChains": (p) => `${num(p, "n")} 條調諧鏈`,
    "workshop.countNarrativeEvents": (p) => `${num(p, "n")} 個敘事事件`,
    "workshop.countProgressionTiers": (p) => `${num(p, "n")} 個進程階段`,
    "workshop.saved": (p) => `已將「${str(p, "name")}」v${str(p, "version")} 儲存至資料庫。`,
    "workshop.saveBlocked": "儲存受阻——驗證失敗：",
    "workshop.exported": (p) => `已將「${str(p, "name")}」匯出為 ${str(p, "file")}。`,
    "workshop.exportBlocked": "匯出受阻——驗證失敗：",

    "codex.attributes": "屬性",
    "codex.roles": "職責",
    "codex.traits": "特質",
    "codex.facilities": "設施",
    "codex.howChallenges": "挑戰如何結算",
    "codex.manualAria": "手冊",
    "codex.closeManualAria": "關閉手冊",
    "codex.replayTutorial": "重播教學",
    "codexRef.usedInRoles": "使用此屬性的職責：",
    "codexRef.checkedIn": "出現於檢定：",
    "codexRef.notChecked": "未在任何挑戰中直接檢定。",
    "codexRef.checkWeight": (p) => `${str(p, "challenge")} — ${str(p, "check")}（權重 ${str(p, "weight")}）`,
    "codexRef.leadAttribute": "主導屬性：",
    "codexRef.weightBreakdown": "權重分佈：",
    "codexRef.mechEffect": "機制效果：",
    "codexRef.attrsThatMatter": "相關屬性：",
    "codexRef.noAttrsWeighted": "此檢定沒有加權任何屬性。",
    "codexRef.howScored": "計分方式：",
    "codexRef.target": "目標值：",
    "codexRef.whenUpgrade": "升級效果：",
    "scope.per_agent": "每名指派的人員個別檢定。",
    "scope.team_aggregate": "以全隊合計分數檢定。",
    "scope.role_specific": "僅檢定指定職責的人員。",
    "fac.Quarters.upgrade": "每一級使名冊上限增加 5，可容納更多人員。",
    "fac.Production.upgrade": "等級越高，每人每週期的材料產出倍率越高。",
    "fac.Recreation.upgrade": "等級越高，駐派人員的士氣下限越高（等級 × 10）。",
    "fac.Research.upgrade": "等級越高，駐派人員產生的情報越多。",
    "fac.Training.upgrade": "等級越高，駐派人員的屬性成長越快——屬性檢定失敗的長期解方。",
    "fac.Storage.upgrade": "等級越高，可在週期之間保護更多的資源儲備。",
    "fac.Medical.upgrade": "等級越高，倒下人員的恢復時間越短。",
    "traitfx.infraEfficiencyMultiplier": (p) => `基礎設施產出乘以 ${str(p, "multiplier")}。`,
    "traitfx.moralePenaltyMultiplierOnRewardDisappointment": (p) => `獎勵落空造成的士氣懲罰乘以 ${str(p, "multiplier")}。`,
    "traitfx.mentorshipTierGapBonus": (p) => `階級差距僅需 ${str(p, "gap")} 即可建立師徒關係。`,
    "traitfx.relationshipFormationMultiplier": (p) => `關係建立速率乘以 ${str(p, "multiplier")}。`,
    "traitfx.hostileStressImmunity": "免疫敵對關係造成的壓力。",
    "traitfx.recklessAfflictionChanceBonus": (p) => `魯莽受創機率增加 ${num(p, "pct")}%。`,
    "traitfx.attributeBonusWhenMoraleHigh": (p) => `士氣高於 ${str(p, "threshold")} 時，${str(p, "attr")} +${str(p, "bonus")}。`,
    "traitfx.stressAccumulationMultiplier": (p) => `壓力累積乘以 ${str(p, "multiplier")}。`,
    "traitfx.moraleGainMultiplier": (p) => `士氣獲得乘以 ${str(p, "multiplier")}。`,
    "traitfx.attributeCheckBonus": (p) => `${str(p, "attr")} 檢定 +${str(p, "bonus")}。`,
    "traitfx.stressOnPartialSuccess": (p) => `任何部分成功都會獲得 ${str(p, "amount")} 點壓力。`,
    "traitfx.relationshipAffinityMultiplier": (p) => `關係親和度獲得乘以 ${str(p, "multiplier")}。`,
    "traitfx.moraleSensitivityToTeamLoss": (p) => `對隊伍損失的士氣敏感度乘以 ${str(p, "multiplier")}。`,
    "traitfx.ambitionSignal": "暗示其隱藏的「野心」可能很高。",

    "trust.bundled": "內建",
    "trust.importedUnsigned": "已匯入 · 未簽署",
    "trust.verified": "已驗證",
    "trust.quarantined": "已隔離",

    "whatsnew.title": "新內容",
    "whatsnew.added": "新增",
    "whatsnew.changed": "變更",
    "whatsnew.fixed": "修正",
    "whatsnew.closeAria": "關閉新內容",

    "vocab.morale": "士氣",
    "vocab.stress": "壓力",
    "vocab.loyalty": "忠誠",
    "vocab.Hostile": "敵對",
    "vocab.Rivalrous": "對立",
    "trigger.reward_dispute": "獎勵爭議",
    "trigger.relationship_transition": "關係轉變",
    "trigger.affliction_threshold": "受創閾值",
    "trigger.morale_extreme": "士氣極端",
    "trigger.precedent_violation": "違反先例",
    "trigger.prolonged_benching": "長期冷板凳",
    "trigger.rivalrous_perf_gap": "對立表現差距",
    "trigger.bonded_partner_lost": "失去羈絆夥伴",
  },
};

export function formatMessage(locale: Locale, id: MessageId, params?: MessageParams): string {
  const value = MESSAGES[locale]?.[id] ?? MESSAGES.en[id];
  if (value === undefined) return id;
  if (typeof value === "function") return value(params ?? {});
  return value;
}
