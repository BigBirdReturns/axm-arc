import { describe, expect, it } from 'vitest';
import {
  initialStrategyExecutionState as initial, advanceStrategyPhase as advance,
  applyLegalStrategyAction as apply, listLegalActions, replayStrategyInputs,
  loadProgramOfRecordMini, type StrategyBoardDefinition, type StrategyExecutionRules,
  type StrategyExecutionState, type StrategyInput,
} from '../../src/engine/strategy-board';

// Independent generic fixture: no Program-of-Record vocabulary or behavior port.
const board: StrategyBoardDefinition = {
  id: 'exchange-test', name: 'Exchange', description: 'Executor conformance',
  seatCountRange: { min: 2, max: 3 },
  resources: [{ id: 'coin', name: 'Coin', description: '' }, { id: 'standing', name: 'Standing', description: '' }],
  doctrines: [{ id: 'maker', name: 'Maker', description: '', startingResources: [
    { resourceId: 'coin', amount: 20 }, { resourceId: 'standing', amount: 0 },
  ], permittedActionIds: ['build'] }],
  spaces: [
    { id: 'home', name: 'Home', type: 'start', region: 'r', adjacentSpaceIds: ['shop'] },
    { id: 'shop', name: 'Shop', type: 'asset', region: 'r', adjacentSpaceIds: ['home'], assetId: 'lease' },
  ],
  controlAssets: [{ id: 'lease', name: 'Lease', description: '', sitedOnSpaceId: 'shop',
    ownershipModel: 'buyable', effectScope: 'owner', acquisitionCost: { resourceId: 'coin', amount: 4 },
    income: { resourceId: 'coin', amountPerQuarter: 2 },
    toll: { resourceId: 'coin', amount: 3, chargedWhen: 'nonOwnerOccupant', eventKind: 'tollPayment' } }],
  auctions: [{ id: 'sale', assetId: 'lease', format: 'englishAscending', resourceId: 'coin',
    minIncrement: 2, honoredBy: 'buyAuctionPass', eventKind: 'auctionSettlement' }],
  programActions: [{ id: 'build', name: 'Build', description: '', target: 'self', honoredBy: 'programAction',
    cost: [{ resourceId: 'coin', delta: -2, eventKind: 'programActionCost' }],
    effect: { summary: 'Gain standing', mutations: [{ resourceId: 'standing', delta: 2, eventKind: 'programActionYield' }] } }],
  interferences: [{ id: 'contest', name: 'Contest', description: '', interferableActionIds: ['build'],
    honoredBy: 'reactionInterference', cost: [{ resourceId: 'coin', delta: -1, eventKind: 'interferenceCost' }],
    effect: { summary: 'Reduce active standing', mutations: [{ resourceId: 'standing', delta: -1, eventKind: 'programActionYield' }] } }],
  obligations: [{ id: 'dues', name: 'Dues', resourceId: 'coin', amountPerQuarter: 1, termQuarters: 2, eventKind: 'obligationSettlement' }],
  milestones: [{ id: 'established', name: 'Established', description: '', requirements: {
    resourceThresholds: [{ resourceId: 'standing', atLeast: 2 }], ownedAssetIds: ['lease'],
  }, reward: { mutations: [{ resourceId: 'coin', delta: 3, eventKind: 'milestoneReward' }], unlocks: ['finish'] }, contributesToEndingId: 'finish' }],
  endings: [{ id: 'finish', name: 'Finish', description: '', condition: { type: 'inevitabilityReached', note: 'Descriptive only' }, scoringNote: 'No numeric scoring law' }],
};
const rules: StrategyExecutionRules = { version: 1, startSpaceId: 'home', movement: 'adjacentInput',
  reactionLimitPerSeat: 1, interferenceEffect: 'activeSeatMutations', obligationDoctrineIds: { dues: ['maker'] },
  endings: [{ endingId: 'finish', milestoneIds: ['established'], quarterAtLeast: 3 }] };
const seats = ['a', 'b'];
const action = (seatId: string, kind: Extract<StrategyInput, {type: 'action'}>['kind'], refId: string | null,
  bids?: {seatId: string; amount: number}[]): Extract<StrategyInput, {type: 'action'}> =>
  ({ type: 'action', seatId, kind, refId, ...(bids ? { bids } : {}) });
const buyState = (def = board) => advance(def, advance(def, initial(def, seats, rules)), 'shop');
const programState = () => apply(board, buyState(), action('a', 'purchase', 'lease'));
const reactionState = () => apply(board, programState(), action('a', 'programAction', 'build'));
const milestoneState = () => apply(board, reactionState(), action('b', 'pass', null));

function reconcile(s: StrategyExecutionState) {
  const balances = initial(board, s.seats.map(x => x.seatId), rules).seats.map(x => ({ ...x.balances }));
  for (const e of s.execution.ledger) {
    expect(e.note.length).toBeGreaterThan(0);
    for (const m of e.mutations) {
      expect(e.kind).toBe(m.eventKind);
      balances[s.seats.findIndex(x => x.seatId === e.seatId)]![m.resourceId]! += m.delta;
    }
  }
  expect(s.seats.map(x => x.balances)).toEqual(balances);
  for (const seat of s.seats) for (const n of Object.values(seat.balances)) expect(Number.isSafeInteger(n) && n >= 0).toBe(true);
}

describe('bounded deterministic Strategy Board executor', () => {
  it('executes purchase, exact authored cost/yield, phase gating, and immutable transitions', () => {
    const before = buyState(), frozen = JSON.stringify(before);
    const after = apply(board, before, action('a', 'purchase', 'lease'));
    expect(JSON.stringify(before)).toBe(frozen);
    expect(after.ownership.lease).toBe('a'); expect(after.seats[0]!.balances.coin).toBe(15);
    expect(after.phase).toBe('programAction');
    const resolved = apply(board, after, action('a', 'programAction', 'build'));
    expect(resolved.seats[0]!.balances).toEqual({ coin: 13, standing: 2 });
    expect(() => apply(board, resolved, action('a', 'programAction', 'build'))).toThrow();
    expect(() => advance(board, after)).toThrow();
    expect(() => apply(board, after, action('b', 'programAction', 'build'))).toThrow();
    expect(() => apply(board, after, action('a', 'pass', null))).toThrow();
    reconcile(resolved);
  });

  it('lists only executable affordable choices, including cumulative resource costs', () => {
    const def = structuredClone(board);
    def.programActions[0]!.cost = [
      { resourceId: 'coin', delta: -11, eventKind: 'programActionCost' },
      { resourceId: 'coin', delta: -11, eventKind: 'programActionCost' },
    ];
    const s = apply(def, buyState(def), action('a', 'pass', null));
    expect(listLegalActions(def, s)).toEqual([]);
    expect(() => apply(def, s, action('a', 'programAction', 'build'))).toThrow();
    const states = [buyState(), programState(), reactionState()];
    for (const state of states) {
      const snapshot = JSON.stringify(state);
      for (const a of listLegalActions(board, state)) {
        const actor = state.phase === 'reactionInterference' ? 'b' : 'a';
        expect(() => apply(board, state, action(actor, a.kind, a.refId, a.kind === 'auction' ? [] : undefined))).not.toThrow();
      }
      expect(JSON.stringify(state)).toBe(snapshot);
      expect(() => apply(board, state, action('a', 'programAction', 'unknown'))).toThrow();
    }
  });

  it('settles ascending auctions to one payable owner and rejects malformed bids atomically', () => {
    const s = buyState();
    const sold = apply(board, s, action('a', 'auction', 'sale', [{ seatId: 'a', amount: 2 }, { seatId: 'b', amount: 4 }]));
    expect(sold.ownership.lease).toBe('b');
    expect(sold.seats.map(x => x.balances.coin)).toEqual([19, 16]);
    expect(sold.execution.ledger.filter(x => x.kind === 'auctionSettlement')).toHaveLength(1);
    reconcile(sold);
    const snapshot = JSON.stringify(s);
    for (const bids of [[{ seatId: 'a', amount: 1 }], [{ seatId: 'a', amount: 2 }, { seatId: 'b', amount: 3 }],
      [{ seatId: 'a', amount: 21 }], [{ seatId: 'ghost', amount: 2 }], [{ seatId: 'a', amount: NaN }],
      [{ seatId: 'a', amount: 2 }, { seatId: 'a', amount: 4 }]]) {
      expect(() => apply(board, s, action('a', 'auction', 'sale', bids))).toThrow();
      expect(JSON.stringify(s)).toBe(snapshot);
    }
    expect(apply(board, s, action('a', 'auction', 'sale', [])).ownership.lease).toBeNull();
  });

  it('sealed bids use seat order for ties, independent of input ordering, and reject duplicate bidders', () => {
    const def = structuredClone(board); def.auctions[0]!.format = 'sealedBid';
    const s = buyState(def), bids = [{ seatId: 'b', amount: 6 }, { seatId: 'a', amount: 6 }];
    for (const sequence of [bids, [...bids].reverse()]) {
      const result = apply(def, s, action('a', 'auction', 'sale', sequence));
      expect(result.ownership.lease).toBe('a');
      expect(result.seats.map(x => x.balances.coin)).toEqual([13, 20]);
    }
    expect(() => apply(def, s, action('a', 'auction', 'sale', [bids[0]!, bids[0]!]))).toThrow();
  });

  it('charges symmetric tolls only for a non-owner occupant; unpayable tolls roll back movement', () => {
    for (const owner of [null, 'a', 'b']) for (let toll = 0; toll <= 8; toll++) {
      const def = structuredClone(board); def.controlAssets[0]!.toll!.amount = toll;
      const s = advance(def, initial(def, seats, rules)); s.ownership.lease = owner;
      const result = advance(def, s, 'shop');
      const events = result.execution.ledger.filter(x => x.kind === 'tollPayment');
      expect(events).toHaveLength(owner === 'b' ? 2 : 0);
      expect(events.flatMap(x => x.mutations).reduce((n, m) => n + m.delta, 0)).toBe(0);
      expect(result.seats.map(x => x.balances.coin)).toEqual(owner === 'b' ? [19 - toll, 20 + toll] : [19, 20]);
    }
    const s = advance(board, initial(board, seats, rules)); s.ownership.lease = 'b'; s.seats[0]!.balances.coin = 0;
    const snapshot = JSON.stringify(s);
    expect(() => advance(board, s, 'shop')).toThrow(); expect(JSON.stringify(s)).toBe(snapshot);
    expect(() => advance(board, s, 'home')).toThrow(); expect(() => advance(board, s)).toThrow();
  });

  it('records interference against the acted program, once per non-active seat in order', () => {
    let s = initial(board, ['a', 'b', 'c'], rules);
    s = advance(board, advance(board, s), 'shop');
    s = apply(board, s, action('a', 'pass', null));
    s = apply(board, s, action('a', 'programAction', 'build'));
    expect(() => apply(board, s, action('c', 'interference', 'contest'))).toThrow();
    s = apply(board, s, action('b', 'interference', 'contest'));
    expect(() => apply(board, s, action('b', 'interference', 'contest'))).toThrow();
    s = apply(board, s, action('c', 'interference', 'contest'));
    expect(s.phase).toBe('milestoneAttempt'); expect(s.seats[0]!.balances.standing).toBe(0);
    expect(s.execution.receipts.filter(x => x.type === 'interference')).toHaveLength(2);
    expect(s.execution.ledger.filter(x => x.note.startsWith('interference:'))).toHaveLength(4);
    reconcile(s);
    const unrelated = reactionState(); unrelated.execution.programActionId = 'other';
    expect(listLegalActions(board, unrelated).map(x => x.kind)).toEqual(['pass']);
  });

  it('locks milestones monotonically, pays once, and emits a terminal ending exactly once', () => {
    let s = advance(board, milestoneState());
    expect(s.execution.milestones.a).toEqual(['established']);
    expect(s.execution.terminal).toBeNull();
    s.phase = 'milestoneAttempt'; s.seats[0]!.balances.standing = 0; s.ownership.lease = null; s.quarter = 3;
    const ended = advance(board, s);
    expect(ended.execution.milestones.a).toEqual(['established']);
    expect(ended.execution.ledger.filter(x => x.kind === 'milestoneReward')).toHaveLength(1);
    expect(ended.execution.receipts.filter(x => x.type === 'ending')).toHaveLength(1);
    expect(ended.execution.terminal).toEqual({ endingId: 'finish', seatId: 'a', quarter: 3 });
    expect(listLegalActions(board, ended)).toEqual([]);
    expect(() => advance(board, ended)).toThrow();
    expect(() => apply(board, ended, action('a', 'pass', null))).toThrow();
  });

  it('posts income before due obligations, expires terms, and advances quarter after every seat', () => {
    for (const quarter of [1, 2, 3]) {
      const s = initial(board, seats, rules); s.quarter = quarter; s.ownership.lease = 'a'; s.seats[0]!.balances.coin = 0;
      const next = advance(board, s);
      expect(next.seats[0]!.balances.coin).toBe(quarter <= 2 ? 1 : 2);
      expect(next.execution.ledger.map(x => x.kind)).toEqual(quarter <= 2 ? ['income', 'obligationSettlement'] : ['income']);
      s.phase = 'receiptLedger'; const b = advance(board, s);
      expect(b.activeSeatIndex).toBe(1); expect(b.quarter).toBe(quarter);
      b.phase = 'receiptLedger'; expect(advance(board, b).quarter).toBe(quarter + 1);
    }
  });

  it('replays generated multi-turn sequences byte-identically and reconciles every ledger prefix', () => {
    for (let scenario = 0; scenario < 16; scenario++) {
      let s = initial(board, seats, rules); const inputs: StrategyInput[] = [];
      for (let step = 0; step < 150 && !s.execution.terminal; step++) {
        let input: StrategyInput;
        if (['buyAuctionPass', 'programAction', 'reactionInterference'].includes(s.phase)) {
          const actions = listLegalActions(board, s);
          if (!actions.length) break; // Insolvency has no invented bailout/pass.
          const choice = actions[(scenario + step) % actions.length]!;
          const actor = s.phase === 'reactionInterference' ? seats[1 - s.activeSeatIndex]! : seats[s.activeSeatIndex]!;
          input = action(actor, choice.kind, choice.refId, choice.kind === 'auction' ? [] : undefined);
        } else input = { type: 'advance', ...(s.phase === 'movementResolution' ? {
          destinationSpaceId: s.execution.positions[seats[s.activeSeatIndex]!] === 'home' ? 'shop' : 'home',
        } : {}) };
        const previous = JSON.stringify(s);
        const next = input.type === 'advance' ? advance(board, s, input.destinationSpaceId) : apply(board, s, input);
        expect(JSON.stringify(s)).toBe(previous); inputs.push(input); s = next; reconcile(s);
      }
      expect(inputs.length).toBeGreaterThan(10);
      expect(JSON.stringify(replayStrategyInputs(board, seats, rules, inputs))).toBe(JSON.stringify(s));
      expect(JSON.stringify(replayStrategyInputs(board, seats, rules, inputs))).toBe(JSON.stringify(s));
    }
  });

  it('rejects under-specified behavior, invalid amounts, duplicate identities, and changed definitions', () => {
    expect(() => initial(loadProgramOfRecordMini(), seats, rules)).toThrow();
    for (const mutate of [
      (d: StrategyBoardDefinition) => { d.spaces[0]!.type = 'hazard'; },
      (d: StrategyBoardDefinition) => { d.programActions[0]!.target = 'seat'; },
      (d: StrategyBoardDefinition) => { d.interferences[0]!.effect.mutations = []; },
      (d: StrategyBoardDefinition) => { d.controlAssets[0]!.effectScope = 'region'; },
      (d: StrategyBoardDefinition) => { d.controlAssets[0]!.acquisitionCost!.amount = 0.5; },
      (d: StrategyBoardDefinition) => { d.resources.push(d.resources[0]!); },
      (d: StrategyBoardDefinition) => { d.milestones[0]!.reward.unlocks = ['unknown']; },
    ]) { const def = structuredClone(board); mutate(def); expect(() => initial(def, seats, rules)).toThrow(); }
    expect(() => initial(board, ['a', 'a'], rules)).toThrow();
    expect(() => initial(board, seats, { ...rules, endings: [] })).toThrow();
    expect(() => initial(board, seats, { ...rules, obligationDoctrineIds: {} })).toThrow();
    const changed = structuredClone(board); changed.controlAssets[0]!.acquisitionCost!.amount++;
    expect(() => advance(changed, initial(board, seats, rules))).toThrow();
  });

  it('arbitrates simultaneous endings in authored order and evaluates milestone rewards from a snapshot', () => {
    const def = structuredClone(board);
    def.endings.push({ ...def.endings[0]!, id: 'alternate' });
    def.milestones.push({ ...def.milestones[0]!, id: 'later', requirements: {
      resourceThresholds: [{ resourceId: 'standing', atLeast: 3 }],
    }, reward: { mutations: [], unlocks: [] } });
    def.milestones[0]!.reward.mutations.push({ resourceId: 'standing', delta: 1, eventKind: 'milestoneReward' });
    const law: StrategyExecutionRules = { ...rules, endings: [
      { endingId: 'alternate', milestoneIds: ['established'] },
      { endingId: 'finish', milestoneIds: ['established'] },
    ] };
    let s = initial(def, seats, law);
    s = advance(def, advance(def, s), 'shop');
    s = apply(def, s, action('a', 'purchase', 'lease'));
    s = apply(def, s, action('a', 'programAction', 'build'));
    s = apply(def, s, action('b', 'pass', null));
    s = advance(def, s);
    expect(s.execution.milestones.a).toEqual(['established']);
    expect(s.execution.terminal?.endingId).toBe('alternate');
  });

  it('rejects unsafe yield overflow and supports opaque resource identifiers', () => {
    const def = structuredClone(board);
    def.programActions[0]!.effect.mutations[0]!.delta = Number.MAX_SAFE_INTEGER;
    let s = apply(def, buyState(def), action('a', 'pass', null));
    s.seats[0]!.balances.standing = 1;
    expect(listLegalActions(def, s)).toEqual([]);
    expect(() => apply(def, s, action('a', 'programAction', 'build'))).toThrow();
    const opaque = JSON.parse(JSON.stringify(board).replaceAll('coin', '__proto__')) as StrategyBoardDefinition;
    s = initial(opaque, seats, rules);
    expect(s.seats[0]!.balances['__proto__']).toBe(20);
    expect(advance(opaque, s).seats[0]!.balances['__proto__']).toBe(19);
  });
});
