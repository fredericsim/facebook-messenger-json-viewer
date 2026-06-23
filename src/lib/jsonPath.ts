export type JsonPathKind = "array" | "boolean" | "number" | "object" | "string" | "unknown";

export interface JsonPathOption {
  path: string;
  kind: JsonPathKind;
  sample: string;
}

export function getByPath(value: unknown, path: string): unknown {
  if (!path) {
    return value;
  }

  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, value);
}

export function collectPathOptions(value: unknown, includeKinds: Set<JsonPathKind>, maxDepth = 3): JsonPathOption[] {
  const options: JsonPathOption[] = [];

  collect(value, "", 0, maxDepth, includeKinds, options);

  return options.sort((left, right) => left.path.localeCompare(right.path));
}

export function valueKind(value: unknown): JsonPathKind {
  if (Array.isArray(value)) {
    return "array";
  }

  if (typeof value === "string") {
    return "string";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (isRecord(value)) {
    return "object";
  }

  return "unknown";
}

export function sampleValue(value: unknown): string {
  if (typeof value === "string") {
    return truncate(value.replace(/\s+/g, " ").trim() || "(empty)");
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  if (isRecord(value)) {
    return `object(${Object.keys(value).slice(0, 4).join(", ")})`;
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asDisplayString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

export function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLocaleLowerCase() === "true";
  }

  return false;
}

export function asTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 && value < 100_000_000_000 ? Math.round(value * 1000) : value;
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);

    if (Number.isFinite(numeric)) {
      return numeric > 0 && numeric < 100_000_000_000 ? Math.round(numeric * 1000) : numeric;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function firstRecord(values: unknown[]): Record<string, unknown> | null {
  const record = values.find(isRecord);
  return record ?? null;
}

export function arrayAtPath(value: unknown, path: string): unknown[] {
  const candidate = getByPath(value, path);
  return Array.isArray(candidate) ? candidate : [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collect(
  value: unknown,
  prefix: string,
  depth: number,
  maxDepth: number,
  includeKinds: Set<JsonPathKind>,
  options: JsonPathOption[],
): void {
  if (!isRecord(value) || depth >= maxDepth) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key.includes(".")) {
      continue;
    }

    const path = prefix ? `${prefix}.${key}` : key;
    const kind = valueKind(child);

    if (includeKinds.has(kind)) {
      options.push({
        path,
        kind,
        sample: sampleValue(child),
      });
    }

    if (isRecord(child)) {
      collect(child, path, depth + 1, maxDepth, includeKinds, options);
    }
  }
}

function truncate(value: string): string {
  return value.length > 70 ? `${value.slice(0, 67)}...` : value;
}
