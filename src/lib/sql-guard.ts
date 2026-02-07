import type { SchemaPolicy } from "@/lib/schema";

export type GuardResult = {
  ok: boolean;
  reason?: string;
};

const FORBIDDEN_TOKENS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "CREATE",
  "RENAME",
  "GRANT",
  "REVOKE",
  "SYSTEM",
  "FORMAT",
  "UNION",
  "EXISTS",
  "DESCRIBE",
  "SHOW",
];

const KNOWN_KEYWORDS = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "BY",
  "ORDER",
  "ASC",
  "DESC",
  "LIMIT",
  "AND",
  "INTERVAL",
  "HOUR",
  "DAY",
  "NOW",
]);

const KNOWN_FUNCTIONS = new Set(["count", "sum", "avg", "min", "max", "now"]);

function hasInlineComments(sql: string): boolean {
  return /--|\/\*/.test(sql);
}

function getLimit(sql: string): number | null {
  const match = sql.match(/\bLIMIT\s+(\d+)\b/i);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function extractIdentifiers(sql: string): string[] {
  return [...sql.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g)].map((match) => match[0]);
}

function findUnknownIdentifiers(sql: string, schema: SchemaPolicy): string[] {
  const allowedColumns = new Set(schema.columns.map((column) => column.name.toLowerCase()));
  const withoutStrings = sql.replace(/'[^']*'/g, "");
  const identifiers = extractIdentifiers(withoutStrings);

  return identifiers.filter((identifier) => {
    const lower = identifier.toLowerCase();
    return (
      !allowedColumns.has(lower) &&
      lower !== schema.table.toLowerCase() &&
      !KNOWN_KEYWORDS.has(identifier.toUpperCase()) &&
      !KNOWN_FUNCTIONS.has(lower)
    );
  });
}

export function normalizeSql(sql: string, schema: SchemaPolicy): string {
  const stringColumns = schema.columns
    .filter((column) => column.type === "string")
    .map((column) => column.name)
    .join("|");

  if (!stringColumns) {
    return sql;
  }

  const bareStringPattern = new RegExp(
    `\\b(${stringColumns})\\b\\s*(=|!=)\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\b`,
    "gi",
  );

  return sql.replace(bareStringPattern, (_match, column: string, comparator: string, value: string) => {
    const loweredValue = value.toLowerCase();
    if (KNOWN_FUNCTIONS.has(loweredValue) || KNOWN_KEYWORDS.has(value.toUpperCase())) {
      return `${column} ${comparator} ${value}`;
    }
    return `${column} ${comparator} '${value}'`;
  });
}

export function validateSql(sql: string, schema: SchemaPolicy, requestedMaxRows = 100): GuardResult {
  const normalized = normalizeSql(sql, schema).trim();
  if (!/^SELECT\b/i.test(normalized)) {
    return { ok: false, reason: "Only SELECT statements are allowed." };
  }

  if (hasInlineComments(normalized)) {
    return { ok: false, reason: "SQL comments are blocked." };
  }

  if (normalized.includes(";")) {
    return { ok: false, reason: "Multiple statements are blocked." };
  }

  if (/\*/.test(normalized)) {
    return { ok: false, reason: "Wildcard selects are blocked. Use explicit columns." };
  }

  for (const token of FORBIDDEN_TOKENS) {
    if (new RegExp(`\\b${token}\\b`, "i").test(normalized)) {
      return { ok: false, reason: `Forbidden token detected: ${token}` };
    }
  }

  const fromMatch = normalized.match(/\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/i);
  if (!fromMatch) {
    return { ok: false, reason: "Query must contain a FROM clause." };
  }

  if (fromMatch[1].toLowerCase() !== schema.table.toLowerCase()) {
    return { ok: false, reason: `Only table ${schema.table} is allowed.` };
  }

  if (/\bJOIN\b/i.test(normalized)) {
    return { ok: false, reason: "JOIN is blocked in strict mode." };
  }

  const unknownIdentifiers = findUnknownIdentifiers(normalized, schema);
  if (unknownIdentifiers.length > 0) {
    return {
      ok: false,
      reason: `Unknown identifier(s): ${Array.from(new Set(unknownIdentifiers)).join(", ")}`,
    };
  }

  const limit = getLimit(normalized);
  if (limit === null) {
    return { ok: false, reason: "LIMIT is required." };
  }

  if (limit <= 0) {
    return { ok: false, reason: "LIMIT must be positive." };
  }

  const hardCap = Math.min(schema.maxLimit, requestedMaxRows);
  if (limit > hardCap) {
    return {
      ok: false,
      reason: `LIMIT ${limit} exceeds cap ${hardCap}.`,
    };
  }

  return { ok: true };
}
