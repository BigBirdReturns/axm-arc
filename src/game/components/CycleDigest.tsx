import type { Arc, Organization, RunReport, AgentRunResult } from "../../engine/types.js";
import { generateHeadline } from "../lib/headline.js";
import { agentInitials } from "../lib/ui-helpers.js";

interface Props {
  arc: Arc;
  org: Organization;
  reports: RunReport[];
}

// Deterministic agent iteration order — identical to src/engine/stress.ts:43.
function orderedAgentIds(org: Organization): string[] {
  return Object.keys(org.agents).sort((a, b) => a.localeCompare(b));
}

export default function CycleDigest({ arc, org, reports }: Props): JSX.Element | null {
  if (reports.length === 0) return null;

  const agentMap = new Map(Object.entries(org.agents));

  // ── 1. Masthead derivations ───────────────────────────────────────────────
  const cycleNo = reports.reduce((m, r) => Math.max(m, r.cycle), 0);
  const editionStamp = `No. ${String(cycleNo).padStart(2, "0")}`;

  // ── 2. Headline + deck ────────────────────────────────────────────────────
  // generateHeadline operates on a single RunReport. The cycle digest sits
  // above per-report cards, so we lead with the most consequential report:
  //   failure > partial > success; ties broken by array order (stable).
  const headlinePick = pickHeadlineReport(reports);
  const headline = generateHeadline(headlinePick, arc, agentMap);

  // No existing arc-wide "so what" summary helper is exported (ReportsScreen
  // has a local buildSummary specific to per-report card rendering). Derive a
  // bounded tally from the passed reports only.
  const successCount = reports.filter((r) => r.outcome === "success").length;
  const partialCount = reports.filter((r) => r.outcome === "partial").length;
  const failureCount = reports.filter((r) => r.outcome === "failure").length;
  const dramaCount = reports.reduce((s, r) => s + r.dramaTriggers.length, 0);
  const dropCount = reports.reduce((s, r) => s + r.lootDrops.length, 0);

  const tallyParts: string[] = [];
  tallyParts.push(`${successCount} cleared`);
  if (partialCount > 0) tallyParts.push(`${partialCount} partial`);
  if (failureCount > 0) tallyParts.push(`${failureCount} failed`);
  if (dramaCount > 0) tallyParts.push(`${dramaCount} afflictions`);
  if (dropCount > 0) tallyParts.push(`${dropCount} drops`);
  const deck = tallyParts.join(" · ") + ".";

  // ── 4. Per-agent tally — agents who actually deployed ────────────────────
  // Aggregate AgentRunResult slices across all reports, keyed by agentId.
  const perAgent = new Map<string, AgentRunResult[]>();
  for (const r of reports) {
    for (const ar of r.assignedAgents) {
      const list = perAgent.get(ar.agentId) ?? [];
      list.push(ar);
      perAgent.set(ar.agentId, list);
    }
  }

  const tallyRows = orderedAgentIds(org)
    .filter((id) => perAgent.has(id))
    .map((id) => {
      const agent = agentMap.get(id);
      const slices = perAgent.get(id)!;
      const stressGained = slices.reduce((s, x) => s + x.stressGained, 0);
      const perf = slices.reduce((s, x) => s + x.performanceRating, 0) / slices.length;
      const wasDowned = slices.some((x) => x.wasDowned);
      const isHeroic = slices.some((x) => x.isHeroic);
      const roleName = agent?.role
        ? arc.roles.find((ro) => ro.id === agent.role)?.name ?? "Flex"
        : "Flex";
      return { id, agent, roleName, stressGained, perf, wasDowned, isHeroic };
    });

  // ── 6. All drops, flattened in report order, then within-report order ────
  const drops = reports.flatMap((r) =>
    r.lootDrops.map((l) => ({ drop: l, challengeId: r.challengeId })),
  );

  return (
    <div className="digest">
      {/* ── 1. Masthead ── */}
      <div className="digest-masthead">
        <div className="digest-masthead-title digest-masthead-typeset">
          {arc.meta.name.split(/\s+/).map((word, i) => (
            <span key={i} className="w" style={{ animationDelay: `${i * 0.08}s` }}>
              {word}
              {i < arc.meta.name.split(/\s+/).length - 1 ? " " : ""}
            </span>
          ))}
        </div>
        <div className="digest-masthead-meta">
          <span>{editionStamp}</span>
          <span>·</span>
          <span>Cycle {cycleNo}</span>
          <span>·</span>
          <span>{arc.meta.domain}</span>
        </div>
      </div>

      {/* ── 2. Headline + deck ── */}
      <div className="digest-kicker">Field Digest</div>
      <div className="digest-headline">
        {headline.challenge}{" "}
        {headline.qualifier && <span className="accent">{headline.qualifier} </span>}
        {headline.primary}
      </div>
      <div className="digest-deck">{deck}</div>

      {/* ── 3. Applied affordance ── */}
      <div className="digest-applied">
        All outcomes applied — nothing to collect. The report below is the record.
      </div>

      {/* ── 4. Per-agent tally ── */}
      {tallyRows.length > 0 && (
        <div className="digest-tally">
          <div className="digest-section-label">Cycle Tally</div>
          {tallyRows.map((row) => (
            <div key={row.id} className="digest-tally-row">
              <div className={`portrait small${row.wasDowned ? " accent" : ""}`}>
                {agentInitials(row.agent?.name ?? row.id)}
              </div>
              <div className="digest-tally-id">
                <div className="digest-tally-name">{row.agent?.name ?? row.id}</div>
                <div className="digest-tally-role">{row.roleName}</div>
              </div>
              <div className="digest-tally-chips">
                <span className={`digest-chip${row.stressGained > 0 ? " accent" : ""}`}>
                  {row.stressGained > 0 ? `+${row.stressGained}` : `${row.stressGained}`} STRESS
                </span>
                <span className="digest-chip">PERF {Math.round(row.perf)}</span>
                {row.wasDowned && <span className="digest-chip downed">DOWNED</span>}
                {row.isHeroic && <span className="digest-chip heroic">HEROIC</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 5. Contract audits, one block per report (given order) ── */}
      <div className="digest-section-label">Contract Audits</div>
      {reports.map((r, i) => {
        const challenge = arc.challenges.find((c) => c.id === r.challengeId);
        const contractName = challenge?.name ?? r.challengeId;
        // Mechanic IDs are stable across agents for one challenge — read from
        // the first assigned agent's results, NOT from arc.challenges, so we
        // only render mechanics actually exercised in this report.
        const mechanicIds = r.assignedAgents[0]?.mechanicResults.map((m) => m.mechanicId) ?? [];

        return (
          <div key={i} className="digest-audit">
            <div className="digest-audit-head">
              <span className="digest-audit-name">{contractName}</span>
              <span className={`digest-chip outcome-${r.outcome}`}>{r.outcome.toUpperCase()}</span>
            </div>

            {mechanicIds.map((mid) => {
              const mech = challenge?.mechanicChecks.find((m) => m.id === mid);
              const mechName = mech?.name ?? mid;

              // Sum aggregate score across all agents (per spec: simplest path).
              let aggregate = 0;
              let threshold = 0;
              for (const ar of r.assignedAgents) {
                const mr = ar.mechanicResults.find((x) => x.mechanicId === mid);
                if (!mr) continue;
                aggregate += mr.score;
                threshold = mr.threshold; // identical across agents for one mechanic
              }
              const passed = aggregate >= threshold;

              // ── Carry derivation ──
              // Highest single-agent score for this mechanic; tie-break by
              // agentId.localeCompare. Order-stable, deterministic.
              let carryId: string | null = null;
              let carryScore = -Infinity;
              for (const ar of r.assignedAgents) {
                const mr = ar.mechanicResults.find((x) => x.mechanicId === mid);
                if (!mr) continue;
                if (mr.score > carryScore || (mr.score === carryScore && carryId !== null && ar.agentId.localeCompare(carryId) < 0)) {
                  carryScore = mr.score;
                  carryId = ar.agentId;
                }
              }
              const carryName = carryId ? agentMap.get(carryId)?.name ?? carryId : "—";

              return (
                <div key={mid} className="digest-audit-row">
                  <span className="digest-audit-mech">{mechName}</span>
                  <span className="digest-audit-score">
                    {Math.round(aggregate)} / {threshold}
                  </span>
                  <span className={`digest-chip ${passed ? "pass" : "fail"}`}>
                    {passed ? "PASS" : "FAIL"}
                  </span>
                  <span className="digest-audit-carry">carry · {carryName}</span>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── 6. Drops ── */}
      {drops.length > 0 && (
        <div className="digest-drops">
          <div className="digest-section-label">Drops</div>
          {drops.map(({ drop, challengeId }, idx) => {
            const item = arc.items.find((it) => it.id === drop.itemId);
            const name = item?.name ?? drop.itemId;
            const isDocket = drop.eligibleAgents.length > 1;
            return (
              <div key={`${challengeId}-${drop.itemId}-${idx}`} className="digest-drop-row">
                <span className="digest-drop-name">{name}</span>
                <span className={`digest-chip ${isDocket ? "docket" : "applied"}`}>
                  {isDocket ? "DOCKET" : "APPLIED"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Pick the report whose headline best leads the digest. Stable: filter, then
// take first in given array order — never sort.
function pickHeadlineReport(reports: RunReport[]): RunReport {
  const failure = reports.find((r) => r.outcome === "failure");
  if (failure) return failure;
  const partial = reports.find((r) => r.outcome === "partial");
  if (partial) return partial;
  return reports[0]!;
}
