// ════════════════════════════════════════════════════════════════════
// bench-engine.js — the REAL axm-arc engine, inlined verbatim from the
// repo (prng.ts, constants.ts, character.ts, first-charter.ts,
// ui-helpers.ts) plus the Bench's engine-faithful derive helpers.
// Plain JS, exposed on window.AXM. No bundler, no imports.
//
// This is the single source of "truth" the Workshop runs on: a seed here
// rolls the same Agent the cycle engine would, because it uses the same
// mulberry32 stream.
// ════════════════════════════════════════════════════════════════════
(() => {
  // ── prng.ts ──────────────────────────────────────────────────────────
  function mulberry32(seed) {
    let s = seed >>> 0;
    return () => {
      s += 0x6d2b79f5;
      let z = s;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      z = (z ^ (z >>> 14)) >>> 0;
      return z / 0x100000000;
    };
  }
  class Rng {
    constructor(seed) { this._seed = seed >>> 0; this._raw = mulberry32(this._seed); this._calls = 0; }
    next() { this._calls++; return this._raw(); }
    int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
    uniform(min, max) { return this.next() * (max - min) + min; }
    pick(arr) { if (arr.length === 0) throw new RangeError("pick: empty array"); return arr[this.int(0, arr.length - 1)]; }
  }
  function hashSeed(...parts) {
    let h = 0x811c9dc5;
    for (const part of parts) {
      const s = String(part);
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      h ^= 0x1f; h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // ── constants.ts (trait + name pools) ────────────────────────────────
  const fx = (...e) => e;
  const DEFAULT_TRAIT_POOL = [
    { id:"industrious", name:"Industrious", description:"+30% efficiency in infrastructure assignments.", effects:fx({kind:"infraEfficiencyMultiplier",multiplier:1.3}) },
    { id:"greedy", name:"Greedy", description:"2x morale penalty from reward disappointment.", effects:fx({kind:"moralePenaltyMultiplierOnRewardDisappointment",multiplier:2.0}) },
    { id:"mentor_inclined", name:"Mentor-Inclined", description:"Can form Mentorship relationships with one tier gap instead of two.", effects:fx({kind:"mentorshipTierGapBonus",reducedGapRequired:1}) },
    { id:"loner", name:"Loner", description:"Relationship formation rate halved; immune to stress from Hostile relationships.", effects:fx({kind:"relationshipFormationMultiplier",multiplier:0.5},{kind:"hostileStressImmunity"}) },
    { id:"hothead", name:"Hothead", description:"+20% Reckless affliction chance at stress threshold; +10 to highest attribute when morale > 80.", effects:fx({kind:"recklessAfflictionChanceBonus",bonus:0.2},{kind:"attributeBonusWhenMoraleHigh",attributeId:"__highest__",threshold:80,bonus:10}) },
    { id:"stoic", name:"Stoic", description:"-30% stress accumulation; -50% morale gain from positive events.", effects:fx({kind:"stressAccumulationMultiplier",multiplier:0.7},{kind:"moraleGainMultiplier",multiplier:0.5}) },
    { id:"perfectionist", name:"Perfectionist", description:"+15% to Precision-equivalent checks; +1 stress on any partial-success.", effects:fx({kind:"attributeCheckBonus",attributeId:"__precision__",bonus:15},{kind:"stressOnPartialSuccess",amount:1}) },
    { id:"team_player", name:"Team Player", description:"Relationship affinity gains at 1.5x; morale more sensitive to team losses.", effects:fx({kind:"relationshipAffinityMultiplier",multiplier:1.5},{kind:"moraleSensitivityToTeamLoss",multiplier:1.5}) },
    { id:"ambitious_trait", name:"Ambitious", description:"Visible signal that hidden Ambition attribute is likely high.", effects:fx({kind:"ambitionSignal"}) },
    { id:"methodical", name:"Methodical", description:"-20% stress accumulation; no bonus variance modifiers apply.", effects:fx({kind:"stressAccumulationMultiplier",multiplier:0.8}) },
    { id:"restless", name:"Restless", description:"+25% morale gain from active challenge assignments.", effects:fx({kind:"moraleGainMultiplier",multiplier:1.25}) },
    { id:"charismatic", name:"Charismatic", description:"Relationship formation rate at 1.3x.", effects:fx({kind:"relationshipFormationMultiplier",multiplier:1.3}) },
  ];
  const DEFAULT_NAME_POOL = {
    firstNames:["Aric","Brennan","Lira","Vex","Korrin","Maeve","Tarek","Iona","Jorah","Sela","Davan","Rhea","Orin","Tessa","Calder","Nira","Brent","Kyra","Zale","Petra","Elan","Mira","Cael","Vara","Holt","Faye","Soren","Ilya","Dusk","Ren"],
    lastNames:["Ashveil","Bracken","Coldwater","Dorne","Evenmere","Frostholm","Gravenmoor","Harwick","Ironfeld","Keswick","Lorne","Maren","Nighthollow","Oakhurst","Proudfen","Ravenscroft","Steelmark","Tallow","Underhill","Voss"],
  };

  // ── first-charter.ts (arc data, verbatim) ────────────────────────────
  const ATTRIBUTES = [
    { id:"power", name:"Power", description:"Raw physical strength and martial capability." },
    { id:"wits", name:"Wits", description:"Tactical acuity, perception, and quick thinking." },
    { id:"spirit", name:"Spirit", description:"Force of will, healing attunement, and morale fortitude." },
    { id:"mettle", name:"Mettle", description:"Endurance, resilience, and the ability to hold the line." },
  ];
  const ROLES = [
    { id:"vanguard", name:"Vanguard", attributeWeights:{ power:0.2, wits:0.1, spirit:0.1, mettle:0.6 } },
    { id:"skirmisher", name:"Skirmisher", attributeWeights:{ power:0.6, wits:0.2, spirit:0.1, mettle:0.1 } },
    { id:"mender", name:"Mender", attributeWeights:{ power:0.1, wits:0.2, spirit:0.6, mettle:0.1 } },
  ];
  const TIERS = [
    { id:"recruit", name:"Recruit", statBudgetMin:20, statBudgetMax:32, upkeepCost:1, baseEfficiencyModifier:1.5 },
    { id:"veteran", name:"Veteran", statBudgetMin:32, statBudgetMax:48, upkeepCost:3, baseEfficiencyModifier:1.0 },
    { id:"champion", name:"Champion", statBudgetMin:48, statBudgetMax:60, upkeepCost:6, baseEfficiencyModifier:0.5 },
  ];
  const ARC_NAME_POOL = {
    firstNames:["Aldric","Brynna","Caelum","Dara","Eiran","Fylan","Gwenna","Harwick","Isolde","Jareth","Kael","Lyris","Mordain","Nyara","Oswin"],
    lastNames:["Ashgate","Brimstone","Crestfall","Dunmark","Emberveil","Forhaven","Greymantle","Hollowfen","Ironcroft","Jarndace"],
  };
  const ITEMS = [
    { id:"rusty-blade", name:"Rusty Blade", slot:"weapon", statBonuses:{power:1}, tierRequirement:"recruit", flavorText:"Worn but serviceable — a fitting start for any charter." },
    { id:"iron-pauldrons", name:"Iron Pauldrons", slot:"chest", statBonuses:{mettle:2}, tierRequirement:"recruit", flavorText:"Salvaged from the troll's lair, dented but solid." },
    { id:"trollhide-cloak", name:"Trollhide Cloak", slot:"cloak", statBonuses:{mettle:1,spirit:1}, tierRequirement:"recruit", flavorText:"Remarkably warm. Smells of river mud and victory." },
    { id:"merchants-favor", name:"Merchant's Favor", slot:"trinket", statBonuses:{wits:2}, tierRequirement:"recruit", flavorText:"A gilded token pressed into your hand with a grateful smile." },
    { id:"miners-pick", name:"Miner's Pick", slot:"weapon", statBonuses:{power:2,mettle:1}, tierRequirement:"veteran", flavorText:"Tempered for breaking rock — and anything else in the way." },
    { id:"bandit-trophy", name:"Bandit Trophy", slot:"trinket", statBonuses:{power:1,wits:1}, tierRequirement:"veteran", flavorText:"A crude signet ring, now yours. A warning to others." },
    { id:"wardens-blade", name:"Warden's Blade", slot:"weapon", statBonuses:{power:4,mettle:2}, tierRequirement:"champion", flavorText:"Forged for the keep's lord. Now it serves a better cause." },
    { id:"wardens-seal", name:"Warden's Seal", slot:"trinket", statBonuses:{spirit:3,wits:2}, tierRequirement:"veteran", flavorText:"The keep's authority, transferred. Open new doors." },
  ];
  const FIRST_CHARTER = {
    meta:{ id:"first-charter", name:"The First Charter", description:"A guild-management arc. Build a charter from raw recruits; the first raid is Karazhan.", author:"AXM", version:"0.0.1", engineVersion:"1.0", domain:"Guild Management", estimatedCycles:10 },
    attributes:ATTRIBUTES, roles:ROLES, tiers:TIERS, items:ITEMS,
    currencyName:"Gold", materialName:"Supplies", tokenName:"Charter Tokens", reputationName:"Renown",
    namePool:ARC_NAME_POOL, customTraits:[],
  };

  // ── character.ts (generateAgent, verbatim logic) ─────────────────────
  function buildTraitPool(arc) {
    const arcIds = new Set(arc.customTraits.map((t) => t.id));
    const base = DEFAULT_TRAIT_POOL.filter((t) => !arcIds.has(t.id));
    return [...arc.customTraits, ...base];
  }
  function distributeStats(rng, tier, attrIds, weights) {
    const budget = rng.int(tier.statBudgetMin, tier.statBudgetMax);
    const n = attrIds.length;
    const totalWeight = attrIds.reduce((s, id) => s + (weights[id] ?? 1), 0);
    const raw = attrIds.map((id) => {
      const w = (weights[id] ?? 1) / totalWeight;
      return Math.max(1, Math.min(20, Math.round(w * budget)));
    });
    let diff = budget - raw.reduce((s, v) => s + v, 0);
    const indices = attrIds.map((_, i) => i);
    while (diff !== 0) {
      const idx = rng.int(0, n - 1);
      const cur = raw[idx] ?? 0;
      if (diff > 0 && cur < 20) { raw[idx]++; diff--; }
      else if (diff < 0 && cur > 1) { raw[idx]--; diff++; }
      if (indices.every((i) => (raw[i] ?? 0) <= 1 || (raw[i] ?? 0) >= 20)) break;
    }
    const result = {};
    attrIds.forEach((id, i) => { result[id] = raw[i] ?? 1; });
    return result;
  }
  function generateAgent(opts) {
    const { rng, tier, arc, preferredRoleId } = opts;
    const role = preferredRoleId
      ? (arc.roles.find((r) => r.id === preferredRoleId) ?? null)
      : arc.roles.length > 0 ? rng.pick(arc.roles) : null;
    const attrIds = arc.attributes.map((a) => a.id);
    const weights = role ? { ...role.attributeWeights } : {};
    const attributes = distributeStats(rng, tier, attrIds, weights);
    const pool = buildTraitPool(arc);
    const traitCount = rng.int(2, 3);
    const picked = [];
    const available = [...pool];
    for (let i = 0; i < traitCount && available.length > 0; i++) {
      const idx = rng.int(0, available.length - 1);
      picked.push(available[idx]); available.splice(idx, 1);
    }
    const traitIds = picked.map((t) => t.id);
    const hiddenAttributes = { loyalty:rng.int(1,20), ambition:rng.int(1,20), volatility:rng.int(1,20), leadership:rng.int(1,20) };
    const tierMidpoint = (tier.statBudgetMin + tier.statBudgetMax) / 2;
    const tierMidpointAttrAvg = attrIds.length > 0 ? tierMidpoint / attrIds.length : tierMidpoint;
    let baseEfficiency = 20 - tierMidpointAttrAvg * 0.6;
    if (traitIds.includes("industrious")) baseEfficiency *= 1.3;
    const namePool = arc.namePool.firstNames.length > 0 ? arc.namePool : DEFAULT_NAME_POOL;
    const firstName = rng.pick(namePool.firstNames);
    const lastName = namePool.lastNames.length > 0 ? " " + rng.pick(namePool.lastNames) : "";
    const name = firstName + lastName;
    const id = `agent-${rng.int(100000, 999999)}`;
    return {
      id, name, attributes, hiddenAttributes, traits:traitIds,
      role: role?.id ?? null, secondaryRole:null, baseEfficiency,
      tier:tier.id, upkeep:tier.upkeepCost, morale:50, stress:0,
      attunements:[], assignmentHistory:[], afflictionHistory:[], rewardHistory:[],
      afflictionState:{ kind:"none" }, equippedItems:{}, downedUntilCycle:null,
      lastClearCycle:{}, revealedHiddenAttrs:0, revealedTraits:1,
    };
  }

  // ── ui-helpers.ts ────────────────────────────────────────────────────
  function agentInitials(name) {
    const parts = String(name || "").trim().split(/\s+/);
    if (parts.length === 1) return (parts[0] || "?").slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function tierBadgeColor(tierId) {
    switch (tierId) {
      case "recruit": return "#7a7065";
      case "veteran": return "#5b8aa3";
      case "champion": return "#b08d57";
      default: return "#888";
    }
  }

  // ── Bench-side derive helpers (mirror character.ts §1.2.5) ───────────
  function computeBaseEfficiency(arc, tier, traits) {
    const n = arc.attributes.length || 1;
    const tierMidpoint = (tier.statBudgetMin + tier.statBudgetMax) / 2;
    let be = 20 - (tierMidpoint / n) * 0.6;
    if (traits.includes("industrious")) be *= 1.3;
    return Math.round(be * 10) / 10;
  }
  function tierRank(arc, tierId) {
    const i = arc.tiers.findIndex((t) => t.id === tierId);
    return i < 0 ? 0 : i;
  }
  function randomSeed() { return Math.floor(Math.random() * 1_000_000_000); }
  function rollAgent(arc, seed) {
    const rng = new Rng(hashSeed("designer", seed));
    const tier = rng.pick(arc.tiers);
    return generateAgent({ rng, tier, arc, cycle: 0 });
  }

  window.AXM = {
    Rng, hashSeed, DEFAULT_TRAIT_POOL, DEFAULT_NAME_POOL, FIRST_CHARTER,
    generateAgent, buildTraitPool, agentInitials, tierBadgeColor,
    computeBaseEfficiency, tierRank, randomSeed, rollAgent,
  };
})();
