// Bounded, duplicate-aware JSON input for cartridges, runs, holder records, and
// future receipt formats. JSON.parse necessarily collapses duplicate object keys
// before validation can see them; this parser refuses them and applies explicit
// resource limits before any domain schema runs.

export interface BoundedJsonLimits {
  maxBytes: number;
  maxDepth: number;
  maxNodes: number;
  maxArrayItems: number;
  maxObjectMembers: number;
  maxStringBytes: number;
  maxNumberCharacters: number;
}

export const DEFAULT_BOUNDED_JSON_LIMITS: Readonly<BoundedJsonLimits> = Object.freeze({
  maxBytes: 16 * 1024 * 1024,
  maxDepth: 96,
  maxNodes: 250_000,
  maxArrayItems: 50_000,
  maxObjectMembers: 50_000,
  maxStringBytes: 4 * 1024 * 1024,
  maxNumberCharacters: 128,
});

export class BoundedJsonError extends Error {
  readonly offset: number;
  readonly line: number;
  readonly column: number;

  constructor(message: string, source: string, offset: number) {
    const location = locate(source, offset);
    super(`${message} at line ${location.line}, column ${location.column}.`);
    this.name = "BoundedJsonError";
    this.offset = offset;
    this.line = location.line;
    this.column = location.column;
  }
}

export function parseBoundedJson(
  source: string,
  overrides: Partial<BoundedJsonLimits> = {},
): unknown {
  const limits = normalizeLimits(overrides);
  const bytes = utf8Length(source);
  if (bytes > limits.maxBytes) {
    throw new BoundedJsonError(`JSON input is ${bytes} bytes; maximum is ${limits.maxBytes}`, source, 0);
  }
  return new Parser(source, limits).parse();
}

/** Apply the same complexity law to an already parsed JSON-compatible value.
 * This is used when API callers pass objects rather than text. Cycles, sparse
 * arrays, undefined, non-finite numbers, functions, symbols, bigint, and exotic
 * prototypes are refused because they do not have one portable JSON meaning. */
export function validateBoundedJsonValue(
  value: unknown,
  overrides: Partial<BoundedJsonLimits> = {},
): void {
  const limits = normalizeLimits(overrides);
  const state = { nodes: 0 };
  visitValue(value, 0, limits, state, new Set<object>());
}

function normalizeLimits(overrides: Partial<BoundedJsonLimits>): BoundedJsonLimits {
  const limits: BoundedJsonLimits = { ...DEFAULT_BOUNDED_JSON_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Bounded JSON limit ${key} must be a positive safe integer.`);
  }
  return limits;
}

class Parser {
  private index = 0;
  private nodes = 0;

  constructor(
    private readonly source: string,
    private readonly limits: BoundedJsonLimits,
  ) {}

  parse(): unknown {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.source.length) this.fail("Unexpected trailing content");
    return value;
  }

  private parseValue(depth: number): unknown {
    if (depth > this.limits.maxDepth) this.fail(`JSON nesting exceeds ${this.limits.maxDepth}`);
    this.nodes += 1;
    if (this.nodes > this.limits.maxNodes) this.fail(`JSON value count exceeds ${this.limits.maxNodes}`);
    const char = this.source[this.index];
    if (char === "{") return this.parseObject(depth + 1);
    if (char === "[") return this.parseArray(depth + 1);
    if (char === '"') return this.parseString();
    if (char === "t") return this.parseLiteral("true", true);
    if (char === "f") return this.parseLiteral("false", false);
    if (char === "n") return this.parseLiteral("null", null);
    if (char === "-" || isDigit(char)) return this.parseNumber();
    this.fail(char === undefined ? "Unexpected end of JSON input" : `Unexpected token ${JSON.stringify(char)}`);
  }

  private parseObject(depth: number): Record<string, unknown> {
    this.index += 1;
    this.skipWhitespace();
    const output: Record<string, unknown> = {};
    const seen = new Set<string>();
    if (this.source[this.index] === "}") {
      this.index += 1;
      return output;
    }
    let members = 0;
    while (true) {
      if (this.source[this.index] !== '"') this.fail("Object keys must be JSON strings");
      const keyOffset = this.index;
      const key = this.parseString();
      if (seen.has(key)) throw new BoundedJsonError(`Duplicate object key ${JSON.stringify(key)}`, this.source, keyOffset);
      seen.add(key);
      members += 1;
      if (members > this.limits.maxObjectMembers) this.fail(`Object member count exceeds ${this.limits.maxObjectMembers}`);
      this.skipWhitespace();
      if (this.source[this.index] !== ":") this.fail("Expected ':' after object key");
      this.index += 1;
      this.skipWhitespace();
      const value = this.parseValue(depth);
      // Define rather than assign so an authored "__proto__" key remains data and
      // cannot mutate the receiving object's prototype.
      Object.defineProperty(output, key, { value, enumerable: true, configurable: true, writable: true });
      this.skipWhitespace();
      const separator = this.source[this.index];
      if (separator === "}") {
        this.index += 1;
        return output;
      }
      if (separator !== ",") this.fail("Expected ',' or '}' in object");
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseArray(depth: number): unknown[] {
    this.index += 1;
    this.skipWhitespace();
    const output: unknown[] = [];
    if (this.source[this.index] === "]") {
      this.index += 1;
      return output;
    }
    while (true) {
      if (output.length >= this.limits.maxArrayItems) this.fail(`Array item count exceeds ${this.limits.maxArrayItems}`);
      output.push(this.parseValue(depth));
      this.skipWhitespace();
      const separator = this.source[this.index];
      if (separator === "]") {
        this.index += 1;
        return output;
      }
      if (separator !== ",") this.fail("Expected ',' or ']' in array");
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseString(): string {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      if (escaped) {
        if (code === 0x75) {
          for (let offset = 1; offset <= 4; offset += 1) {
            if (!isHex(this.source[this.index + offset])) this.fail("Invalid Unicode escape in JSON string");
          }
          this.index += 5;
          escaped = false;
          continue;
        }
        if (!'"\\/bfnrt'.includes(String.fromCharCode(code))) this.fail("Invalid escape in JSON string");
        this.index += 1;
        escaped = false;
        continue;
      }
      if (code === 0x5c) {
        escaped = true;
        this.index += 1;
        continue;
      }
      if (code === 0x22) {
        this.index += 1;
        const raw = this.source.slice(start, this.index);
        let decoded: string;
        try {
          decoded = JSON.parse(raw) as string;
        } catch {
          throw new BoundedJsonError("Invalid JSON string", this.source, start);
        }
        const bytes = utf8Length(decoded);
        if (bytes > this.limits.maxStringBytes) {
          throw new BoundedJsonError(`JSON string is ${bytes} bytes; maximum is ${this.limits.maxStringBytes}`, this.source, start);
        }
        assertUnicodeScalarString(decoded, this.source, start);
        return decoded;
      }
      if (code <= 0x1f) this.fail("Unescaped control character in JSON string");
      this.index += 1;
    }
    throw new BoundedJsonError("Unterminated JSON string", this.source, start);
  }

  private parseNumber(): number {
    const start = this.index;
    if (this.source[this.index] === "-") this.index += 1;
    if (this.source[this.index] === "0") {
      this.index += 1;
      if (isDigit(this.source[this.index])) this.fail("JSON number cannot contain a leading zero");
    } else {
      if (!isOneToNine(this.source[this.index])) this.fail("Invalid JSON number");
      while (isDigit(this.source[this.index])) this.index += 1;
    }
    if (this.source[this.index] === ".") {
      this.index += 1;
      if (!isDigit(this.source[this.index])) this.fail("JSON fraction requires a digit");
      while (isDigit(this.source[this.index])) this.index += 1;
    }
    if (this.source[this.index] === "e" || this.source[this.index] === "E") {
      this.index += 1;
      if (this.source[this.index] === "+" || this.source[this.index] === "-") this.index += 1;
      if (!isDigit(this.source[this.index])) this.fail("JSON exponent requires a digit");
      while (isDigit(this.source[this.index])) this.index += 1;
    }
    const raw = this.source.slice(start, this.index);
    if (raw.length > this.limits.maxNumberCharacters) {
      throw new BoundedJsonError(`JSON number exceeds ${this.limits.maxNumberCharacters} characters`, this.source, start);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new BoundedJsonError("JSON number is not finite", this.source, start);
    return value;
  }

  private parseLiteral<T>(literal: string, value: T): T {
    if (this.source.slice(this.index, this.index + literal.length) !== literal) this.fail(`Expected ${literal}`);
    this.index += literal.length;
    return value;
  }

  private skipWhitespace(): void {
    while (true) {
      const char = this.source[this.index];
      if (char === " " || char === "\n" || char === "\r" || char === "\t") this.index += 1;
      else return;
    }
  }

  private fail(message: string): never {
    throw new BoundedJsonError(message, this.source, this.index);
  }
}

function visitValue(
  value: unknown,
  depth: number,
  limits: BoundedJsonLimits,
  state: { nodes: number },
  ancestors: Set<object>,
): void {
  if (depth > limits.maxDepth) throw new Error(`JSON nesting exceeds ${limits.maxDepth}.`);
  state.nodes += 1;
  if (state.nodes > limits.maxNodes) throw new Error(`JSON value count exceeds ${limits.maxNodes}.`);
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    if (utf8Length(value) > limits.maxStringBytes) throw new Error(`JSON string exceeds ${limits.maxStringBytes} bytes.`);
    assertUnicodeScalarString(value, "", 0);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JSON number must be finite.");
    if (JSON.stringify(value).length > limits.maxNumberCharacters) throw new Error("JSON number representation is too long.");
    return;
  }
  if (typeof value !== "object") throw new Error(`Value of type ${typeof value} is not JSON-compatible.`);
  if (ancestors.has(value)) throw new Error("JSON-compatible value contains a cycle.");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > limits.maxArrayItems) throw new Error(`JSON array exceeds ${limits.maxArrayItems} items.`);
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) throw new Error("Sparse arrays are not portable JSON values.");
        visitValue(value[index], depth + 1, limits, state, ancestors);
      }
      return;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error("JSON objects must have a plain or null prototype.");
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length > limits.maxObjectMembers) throw new Error(`JSON object exceeds ${limits.maxObjectMembers} members.`);
    for (const key of keys) {
      if (utf8Length(key) > limits.maxStringBytes) throw new Error("JSON object key is too large.");
      assertUnicodeScalarString(key, "", 0);
      visitValue((value as Record<string, unknown>)[key], depth + 1, limits, state, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

function assertUnicodeScalarString(value: string, source: string, offset: number): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        if (source) throw new BoundedJsonError("JSON string contains an unpaired high surrogate", source, offset);
        throw new Error("JSON string contains an unpaired high surrogate.");
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      if (source) throw new BoundedJsonError("JSON string contains an unpaired low surrogate", source, offset);
      throw new Error("JSON string contains an unpaired low surrogate.");
    }
  }
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isOneToNine(char: string | undefined): boolean {
  return char !== undefined && char >= "1" && char <= "9";
}

function isHex(char: string | undefined): boolean {
  return char !== undefined && /[0-9a-fA-F]/.test(char);
}

function locate(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let index = 0; index < Math.min(offset, source.length); index += 1) {
    if (source[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}
