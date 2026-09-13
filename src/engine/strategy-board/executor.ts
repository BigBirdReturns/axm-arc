import { validateStrategyBoard } from './schema';
import { initialStrategyState, type TurnState, type LegalAction } from './turn';
import type { StrategyBoardDefinition, ResourceLedgerMutation, StrategyLedgerEvent } from './types';

/** Versioned execution law, supplied as data alongside the generic definition.
 * Notes/summaries never become predicates. All quantities use safe integer units. */
export interface StrategyExecutionRules {
  version: 1;
  startSpaceId: string;
  movement: 'adjacentInput';
  reactionLimitPerSeat: 1;
  interferenceEffect: 'activeSeatMutations';
  obligationDoctrineIds: Record<string, string[]>;
  endings: { endingId: string; milestoneIds: string[]; quarterAtLeast?: number }[];
}

export interface StrategyExecutionState extends TurnState {
  execution: {
    definitionJson: string;
    rules: StrategyExecutionRules;
    positions: Record<string, string>;
    reactionIndex: number;
    programActionId: string | null;
    milestones: Record<string, string[]>;
    terminal: { endingId: string; seatId: string; quarter: number } | null;
    ledger: StrategyLedgerEvent[];
    receipts: { type: string; quarter: number; seatId: string; refId: string | null; ledgerLength: number }[];
  };
}

export type StrategyInput =
  | { type: 'advance'; destinationSpaceId?: string }
  | { type: 'action'; seatId: string; kind: LegalAction['kind']; refId: string | null;
      bids?: { seatId: string; amount: number }[] };

function requireThat(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Strategy executor: ${message}`);
}
const units = (n: number) => Number.isSafeInteger(n) && n >= 0;
const activeId = (s: TurnState) => s.seats[s.activeSeatIndex]!.seatId;
function actorId(s: StrategyExecutionState): string {
  return s.phase === 'reactionInterference'
    ? s.seats[(s.activeSeatIndex + 1 + s.execution.reactionIndex) % s.seats.length]!.seatId
    : activeId(s);
}
function affordable(s: TurnState, id: string, mutations: ResourceLedgerMutation[]): boolean {
  const balances = { ...s.seats.find(x => x.seatId === id)!.balances };
  for (const m of mutations) {
    const next = balances[m.resourceId]! + m.delta;
    if (!units(next)) return false;
    balances[m.resourceId] = next;
  }
  return true;
}

export function initialStrategyExecutionState(
  input: StrategyBoardDefinition, seatIds: string[], rules: StrategyExecutionRules,
): StrategyExecutionState {
  const def = validateStrategyBoard(input);
  requireThat(new Set(seatIds).size === seatIds.length && seatIds.every(x => x.length > 0), 'duplicate/empty seat');
  for (const group of [def.spaces, def.resources, def.doctrines, def.controlAssets, def.auctions,
    def.programActions, def.interferences, def.obligations, def.milestones, def.endings]) {
    requireThat(new Set(group.map(x => x.id)).size === group.length, 'duplicate definition id');
  }
  requireThat(rules.version === 1 && rules.movement === 'adjacentInput' &&
    rules.reactionLimitPerSeat === 1 && rules.interferenceEffect === 'activeSeatMutations', 'unsupported execution law');
  requireThat(def.spaces.some(x => x.id === rules.startSpaceId), 'unknown start space');
  requireThat(!def.spaces.some(x => x.type === 'hazard'), 'hazards lack executable law');
  for (const d of def.doctrines) {
    requireThat(new Set(d.startingResources.map(x => x.resourceId)).size === d.startingResources.length, 'duplicate starting resource');
    for (const r of d.startingResources) requireThat(units(r.amount), 'invalid starting amount');
  }
  const mutations = (ms: ResourceLedgerMutation[], kind?: string, debit = false) => {
    for (const m of ms) requireThat(Number.isSafeInteger(m.delta) && (!kind || m.eventKind === kind) &&
      (!debit || m.delta <= 0), 'unsupported mutation');
  };
  for (const a of def.controlAssets) {
    requireThat(a.ownershipModel !== 'fixed' && a.effectScope === 'owner', 'unsupported ownership/effect scope');
    requireThat(def.spaces.find(x => x.id === a.sitedOnSpaceId)?.assetId === a.id, 'asset location mismatch');
    if (a.ownershipModel === 'buyable') requireThat(a.acquisitionCost, 'missing purchase price');
    for (const n of [a.acquisitionCost?.amount, a.income?.amountPerQuarter, a.toll?.amount])
      if (n !== undefined) requireThat(units(n), 'invalid asset amount');
  }
  for (const space of def.spaces) if (space.assetId)
    requireThat(def.controlAssets.find(a => a.id === space.assetId)?.sitedOnSpaceId === space.id, 'space location mismatch');
  for (const a of def.auctions) requireThat(units(a.minIncrement) && a.minIncrement > 0, 'invalid increment');
  for (const a of def.programActions) {
    requireThat(a.target === 'self' || a.target === 'none', 'unsupported program target');
    mutations(a.cost, 'programActionCost', true); mutations(a.effect.mutations, 'programActionYield');
  }
  for (const i of def.interferences) {
    requireThat(i.effect.mutations.length > 0, 'interference has no executable effect');
    mutations(i.cost, 'interferenceCost', true); mutations(i.effect.mutations, 'programActionYield');
  }
  requireThat(Object.keys(rules.obligationDoctrineIds).length === def.obligations.length, 'obligation assignment missing/extra');
  for (const o of def.obligations) {
    requireThat(units(o.amountPerQuarter), 'invalid obligation amount');
    const ids = rules.obligationDoctrineIds[o.id];
    requireThat(ids && new Set(ids).size === ids.length && ids.every(id => def.doctrines.some(d => d.id === id)), 'invalid obligation assignment');
  }
  requireThat(rules.endings.length === def.endings.length && new Set(rules.endings.map(x => x.endingId)).size === rules.endings.length, 'ending law missing/duplicate');
  for (const e of rules.endings) {
    requireThat(def.endings.some(x => x.id === e.endingId) &&
      e.milestoneIds.every(id => def.milestones.some(m => m.id === id)) &&
      (e.milestoneIds.length > 0 || e.quarterAtLeast !== undefined) &&
      (e.quarterAtLeast === undefined || (units(e.quarterAtLeast) && e.quarterAtLeast > 0)), 'invalid ending predicate');
  }
  for (const m of def.milestones) {
    mutations(m.reward.mutations, 'milestoneReward');
    requireThat(m.reward.unlocks.every(id => rules.endings.some(e => e.endingId === id && e.milestoneIds.includes(m.id))), 'unsupported unlock');
    for (const t of m.requirements.resourceThresholds ?? []) requireThat(units(t.atLeast), 'invalid threshold');
  }
  return { ...initialStrategyState(def, seatIds), execution: {
    definitionJson: JSON.stringify(input),
    rules: structuredClone(rules), positions: Object.fromEntries(seatIds.map(id => [id, rules.startSpaceId])),
    reactionIndex: 0, programActionId: null, milestones: Object.fromEntries(seatIds.map(id => [id, []])),
    terminal: null, ledger: [], receipts: [],
  } };
}

/** Executable choices have exactly one acting seat; reactions follow cyclic seat order. */
export function listExecutableStrategyActions(def: StrategyBoardDefinition, s: StrategyExecutionState): LegalAction[] {
  requireThat(JSON.stringify(def) === s.execution.definitionJson, 'definition changed during run');
  if (s.execution.terminal) return [];
  const id = actorId(s);
  const out: LegalAction[] = [];
  const add = (kind: LegalAction['kind'], refId: string | null, resolver: string, ms: ResourceLedgerMutation[] = []) =>
    out.push({ kind, refId, resolver, honoredByPhase: s.phase, declaredMutations: structuredClone(ms) });
  if (s.phase === 'programAction') {
    const permitted = def.doctrines.find(d => d.id === s.seats[s.activeSeatIndex]!.doctrineId)!.permittedActionIds;
    for (const a of def.programActions) if (permitted.includes(a.id) && affordable(s, id, [...a.cost, ...a.effect.mutations]))
      add('programAction', a.id, 'resolveProgramAction', a.cost);
  } else if (s.phase === 'buyAuctionPass') {
    const asset = def.controlAssets.find(a => a.sitedOnSpaceId === s.execution.positions[id]);
    if (asset && s.ownership[asset.id] === null) {
      if (asset.ownershipModel === 'buyable' && asset.acquisitionCost) {
        const ms: ResourceLedgerMutation[] = [{ resourceId: asset.acquisitionCost.resourceId, delta: -asset.acquisitionCost.amount, eventKind: 'purchase' }];
        if (affordable(s, id, ms)) add('purchase', asset.id, 'resolvePurchase', ms);
      }
      for (const a of def.auctions) if (a.assetId === asset.id) add('auction', a.id, 'resolveAuction');
    }
    add('pass', null, 'resolvePass');
  } else if (s.phase === 'reactionInterference') {
    for (const i of def.interferences) if (i.interferableActionIds.includes(s.execution.programActionId!) &&
      affordable(s, id, i.cost) && affordable(s, activeId(s), i.effect.mutations)) add('interference', i.id, 'resolveInterference', i.cost);
    add('pass', null, 'resolvePass');
  }
  return out;
}

function record(s: StrategyExecutionState, type: string, seatId: string, refId: string | null) {
  s.execution.receipts.push({ type, quarter: s.quarter, seatId, refId, ledgerLength: s.execution.ledger.length });
}
/** Sole resource-writing seam. Rejected inputs leave the caller's entire state unchanged. */
function post(s: StrategyExecutionState, id: string, ms: ResourceLedgerMutation[], cause: string) {
  requireThat(affordable(s, id, ms), 'unpayable mutation');
  const seat = s.seats.find(x => x.seatId === id)!;
  for (const m of ms) {
    seat.balances[m.resourceId]! += m.delta;
    s.execution.ledger.push({ kind: m.eventKind, seatId: id, mutations: [structuredClone(m)], note: cause });
  }
}
function amount(resourceId: string, delta: number, eventKind: ResourceLedgerMutation['eventKind']): ResourceLedgerMutation[] {
  return [{ resourceId, delta, eventKind }];
}

export function applyLegalStrategyAction(def: StrategyBoardDefinition, state: StrategyExecutionState,
  input: Extract<StrategyInput, { type: 'action' }>): StrategyExecutionState {
  requireThat(!state.execution.terminal && input.seatId === actorId(state), 'wrong actor or terminal run');
  const legal = listExecutableStrategyActions(def, state).find(a => a.kind === input.kind && a.refId === input.refId);
  requireThat(legal, 'illegal action');
  requireThat(input.kind === 'auction' || input.bids === undefined, 'unexpected bids');
  const s = structuredClone(state), id = input.seatId;
  if (input.kind === 'purchase') {
    post(s, id, legal.declaredMutations, `purchase:${input.refId}`);
    s.ownership[input.refId!] = id;
  } else if (input.kind === 'auction') {
    const a = def.auctions.find(x => x.id === input.refId)!;
    requireThat(input.bids, 'auction requires explicit bid sequence (empty means no sale)');
    let winner: string | null = null, price = 0;
    const seen = new Set<string>();
    for (const bid of input.bids) {
      requireThat(s.seats.some(x => x.seatId === bid.seatId) && units(bid.amount) && bid.amount >= a.minIncrement &&
        affordable(s, bid.seatId, amount(a.resourceId, -bid.amount, a.eventKind)), 'invalid/unpayable bid');
      if (a.format === 'englishAscending') {
        requireThat(bid.amount >= price + a.minIncrement && bid.seatId !== winner, 'invalid ascending bid');
        winner = bid.seatId; price = bid.amount;
      } else {
        requireThat(!seen.has(bid.seatId), 'duplicate sealed bid'); seen.add(bid.seatId);
        if (bid.amount > price || (bid.amount === price && s.seats.findIndex(x => x.seatId === bid.seatId) < s.seats.findIndex(x => x.seatId === winner))) {
          winner = bid.seatId; price = bid.amount;
        }
      }
      record(s, `bid:${bid.amount}`, bid.seatId, a.id);
    }
    if (winner) { post(s, winner, amount(a.resourceId, -price, a.eventKind), `auction:${a.id}`); s.ownership[a.assetId] = winner; }
  } else if (input.kind === 'programAction') {
    const a = def.programActions.find(x => x.id === input.refId)!;
    post(s, id, a.cost, `action:${a.id}:cost`); post(s, id, a.effect.mutations, `action:${a.id}:effect`);
    s.execution.programActionId = a.id;
  } else if (input.kind === 'interference') {
    const i = def.interferences.find(x => x.id === input.refId)!;
    post(s, id, i.cost, `interference:${i.id}:cost`);
    post(s, activeId(s), i.effect.mutations, `interference:${i.id}:effect`);
  }
  record(s, input.kind, id, input.refId);
  if (s.phase === 'buyAuctionPass') s.phase = 'programAction';
  else if (s.phase === 'programAction') s.phase = 'reactionInterference';
  else if (++s.execution.reactionIndex === s.seats.length - 1) s.phase = 'milestoneAttempt';
  return s;
}

export function advanceStrategyPhase(def: StrategyBoardDefinition, state: StrategyExecutionState,
  destinationSpaceId?: string): StrategyExecutionState {
  requireThat(JSON.stringify(def) === state.execution.definitionJson, 'definition changed during run');
  requireThat(!state.execution.terminal, 'terminal run');
  requireThat(destinationSpaceId === undefined || state.phase === 'movementResolution', 'unexpected movement input');
  const s = structuredClone(state), id = activeId(s);
  if (s.phase === 'quarterStart') {
    for (const a of def.controlAssets) if (s.ownership[a.id] === id && a.income)
      post(s, id, amount(a.income.resourceId, a.income.amountPerQuarter, 'income'), `income:${a.id}`);
    for (const o of def.obligations) if (s.quarter <= o.termQuarters &&
      s.execution.rules.obligationDoctrineIds[o.id]!.includes(s.seats[s.activeSeatIndex]!.doctrineId))
      post(s, id, amount(o.resourceId, -o.amountPerQuarter, o.eventKind), `obligation:${o.id}`);
    s.phase = 'movementResolution';
  } else if (s.phase === 'movementResolution') {
    const from = def.spaces.find(x => x.id === s.execution.positions[id])!;
    requireThat(destinationSpaceId && from.adjacentSpaceIds.includes(destinationSpaceId), 'movement requires adjacent destination');
    s.execution.positions[id] = destinationSpaceId;
    const a = def.controlAssets.find(x => x.sitedOnSpaceId === destinationSpaceId);
    const owner = a && s.ownership[a.id];
    if (a?.toll && owner && owner !== id) {
      post(s, id, amount(a.toll.resourceId, -a.toll.amount, 'tollPayment'), `toll:${a.id}`);
      post(s, owner, amount(a.toll.resourceId, a.toll.amount, 'tollPayment'), `toll:${a.id}`);
    }
    s.phase = 'buyAuctionPass';
  } else if (s.phase === 'milestoneAttempt') {
    // Eligibility is a snapshot: rewards cannot create order-dependent chains in this phase.
    const eligible = def.milestones.filter(m => !s.execution.milestones[id]!.includes(m.id) &&
      (m.requirements.resourceThresholds ?? []).every(t => s.seats[s.activeSeatIndex]!.balances[t.resourceId]! >= t.atLeast) &&
      (m.requirements.ownedAssetIds ?? []).every(a => s.ownership[a] === id));
    for (const m of eligible) {
      post(s, id, m.reward.mutations, `milestone:${m.id}`);
      s.execution.milestones[id]!.push(m.id); record(s, 'milestone', id, m.id);
    }
    // Authored rule order arbitrates simultaneous endings. No inferred score/winner.
    const ending = s.execution.rules.endings.find(e => (e.quarterAtLeast === undefined || s.quarter >= e.quarterAtLeast) &&
      e.milestoneIds.every(m => s.execution.milestones[id]!.includes(m)));
    if (ending) {
      s.execution.terminal = { endingId: ending.endingId, seatId: id, quarter: s.quarter };
      record(s, 'ending', id, ending.endingId);
    }
    s.phase = 'receiptLedger';
  } else if (s.phase === 'receiptLedger') {
    s.activeSeatIndex = (s.activeSeatIndex + 1) % s.seats.length;
    if (s.activeSeatIndex === 0) { requireThat(units(s.quarter + 1), 'quarter overflow'); s.quarter++; }
    s.execution.reactionIndex = 0; s.execution.programActionId = null; s.phase = 'quarterStart';
  } else throw new Error('Strategy executor: choice phase requires an action');
  record(s, `phase:${state.phase}`, id, destinationSpaceId ?? null);
  return s;
}

export function replayStrategyInputs(def: StrategyBoardDefinition, seats: string[], rules: StrategyExecutionRules,
  inputs: readonly StrategyInput[]): StrategyExecutionState {
  return inputs.reduce((s, i) => i.type === 'advance' ? advanceStrategyPhase(def, s, i.destinationSpaceId)
    : applyLegalStrategyAction(def, s, i), initialStrategyExecutionState(def, seats, rules));
}
