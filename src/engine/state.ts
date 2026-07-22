import "./abi13.js";
import type {
  CartridgeStateChange,
  CartridgeStateDefinition,
  CartridgeStateEffect,
  CartridgeStateValue,
} from "./abi13.js";
import { compareCodepoints, orderRecordKeysDeep } from "./determinism.js";
import type { Arc, Organization } from "./types.js";

export class CartridgeStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartridgeStateError";
  }
}

function definitionsFor(arc: Arc): CartridgeStateDefinition[] {
  return [...(arc.stateDefinitions ?? [])].sort((left, right) => compareCodepoints(left.id, right.id));
}

function assertValue(definition: CartridgeStateDefinition, value: CartridgeStateValue): void {
  if (definition.kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new CartridgeStateError(`State "${definition.id}" requires a finite number.`);
    }
    if (value < definition.min || value > definition.max) {
      throw new CartridgeStateError(
        `State "${definition.id}" value ${value} is outside [${definition.min}, ${definition.max}].`,
      );
    }
    return;
  }
  if (definition.kind === "enum") {
    if (typeof value !== "string" || !definition.values.includes(value)) {
      throw new CartridgeStateError(
        `State "${definition.id}" requires one of: ${definition.values.join(", ")}.`,
      );
    }
    return;
  }
  if (typeof value !== "boolean") {
    throw new CartridgeStateError(`State "${definition.id}" requires a boolean.`);
  }
}

export function initialCartridgeState(arc: Arc): Record<string, CartridgeStateValue> {
  const state: Record<string, CartridgeStateValue> = {};
  for (const definition of definitionsFor(arc)) {
    assertValue(definition, definition.initial);
    state[definition.id] = definition.initial;
  }
  return orderRecordKeysDeep(state);
}

/** Backfill engine-1.3 state for a v2 save or legacy in-memory Organization.
 * Existing declared values are preserved exactly. Unknown state is refused so a
 * cartridge cannot silently inherit facts authored by another state contract. */
export function initializeCartridgeState(org: Organization, arc: Arc): Organization {
  const definitions = definitionsFor(arc);
  if (definitions.length === 0) {
    if (org.cartridgeState === undefined) return org;
    if (Object.keys(org.cartridgeState).length > 0) {
      throw new CartridgeStateError(`Organization carries cartridge state but Arc declares no state definitions.`);
    }
    return { ...org, cartridgeState: {} };
  }

  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const existing = org.cartridgeState ?? {};
  for (const stateId of Object.keys(existing)) {
    if (!byId.has(stateId)) {
      throw new CartridgeStateError(`Organization carries undeclared cartridge state "${stateId}".`);
    }
  }

  const state: Record<string, CartridgeStateValue> = {};
  for (const definition of definitions) {
    const value = existing[definition.id] ?? definition.initial;
    assertValue(definition, value);
    state[definition.id] = value;
  }
  return { ...org, cartridgeState: orderRecordKeysDeep(state) };
}

function numericAfter(
  definition: Extract<CartridgeStateDefinition, { kind: "number" }>,
  current: number,
  effect: Extract<CartridgeStateEffect, { operation: "increment" | "decrement" }>,
): number {
  const requested = effect.operation === "increment" ? current + effect.value : current - effect.value;
  if (requested >= definition.min && requested <= definition.max) return requested;
  if (effect.overflow === "clamp") {
    return Math.min(definition.max, Math.max(definition.min, requested));
  }
  throw new CartridgeStateError(
    `State effect on "${definition.id}" would produce ${requested}, outside [${definition.min}, ${definition.max}].`,
  );
}

export function applyCartridgeStateEffects(opts: {
  org: Organization;
  arc: Arc;
  effects: CartridgeStateEffect[];
  source: CartridgeStateChange["source"];
}): { org: Organization; changes: CartridgeStateChange[] } {
  const initialized = initializeCartridgeState(opts.org, opts.arc);
  if (opts.effects.length === 0) return { org: initialized, changes: [] };

  const definitionMap = new Map(definitionsFor(opts.arc).map((definition) => [definition.id, definition]));
  const nextState: Record<string, CartridgeStateValue> = { ...(initialized.cartridgeState ?? {}) };
  const changes: CartridgeStateChange[] = [];

  for (const effect of opts.effects) {
    const definition = definitionMap.get(effect.stateId);
    if (!definition) throw new CartridgeStateError(`State effect references undeclared state "${effect.stateId}".`);
    const before = nextState[effect.stateId];
    if (before === undefined) throw new CartridgeStateError(`State "${effect.stateId}" is not initialized.`);

    let after: CartridgeStateValue;
    if (effect.operation === "set") {
      after = effect.value;
    } else if (effect.operation === "increment" || effect.operation === "decrement") {
      if (definition.kind !== "number" || typeof before !== "number") {
        throw new CartridgeStateError(`${effect.operation} requires numeric state "${effect.stateId}".`);
      }
      if (!Number.isFinite(effect.value) || effect.value < 0) {
        throw new CartridgeStateError(`${effect.operation} on "${effect.stateId}" requires a non-negative finite value.`);
      }
      after = numericAfter(definition, before, effect);
    } else {
      if (effect.operation !== "transition") throw new CartridgeStateError(`Unsupported state operation ${effect.operation}.`);
      if (definition.kind !== "enum" || typeof before !== "string") {
        throw new CartridgeStateError(`transition requires enum state "${effect.stateId}".`);
      }
      if (effect.from !== undefined && before !== effect.from) {
        throw new CartridgeStateError(
          `State transition on "${effect.stateId}" expected "${effect.from}" but found "${before}".`,
        );
      }
      after = effect.to;
    }

    assertValue(definition, after);
    nextState[effect.stateId] = after;
    changes.push({
      stateId: effect.stateId,
      before,
      after,
      operation: effect.operation,
      reason: effect.reason,
      source: { ...opts.source },
    });
  }

  return {
    org: { ...initialized, cartridgeState: orderRecordKeysDeep(nextState) },
    changes,
  };
}
