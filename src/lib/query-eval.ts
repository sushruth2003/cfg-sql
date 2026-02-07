export type QueryEvalCriterion = {
  name: string;
  passed: boolean;
  detail: string;
};

export type QueryEvalSummary = {
  overallScore: number;
  intentScore: number;
  safetyScore: number;
  executionScore: number;
  clarityScore: number;
  criteria: QueryEvalCriterion[];
};

type EvaluateQueryInput = {
  question: string;
  sql: string;
  guardValid: boolean;
  dbSucceeded: boolean;
  rowCount: number;
  totalMs: number;
};

function toScore(passed: number, total: number): number {
  if (total === 0) {
    return 100;
  }
  return Math.round((passed / total) * 100);
}

function lower(value: string): string {
  return value.toLowerCase();
}

function scoreIntent(question: string, sql: string): { score: number; criteria: QueryEvalCriterion[] } {
  const questionLower = lower(question);
  const sqlLower = lower(sql);
  const criteria: QueryEvalCriterion[] = [];

  const add = (name: string, passed: boolean, detail: string) => {
    criteria.push({ name, passed, detail });
  };

  if (/\b(sum|total)\b/.test(questionLower)) {
    add("Aggregation intent (sum/total)", /\bsum\s*\(/.test(sqlLower), "Question asks for sum/total.");
  }
  if (/\b(count|number of)\b/.test(questionLower)) {
    add("Aggregation intent (count)", /\bcount\s*\(/.test(sqlLower), "Question asks for counts.");
  }
  if (/\b(avg|average|mean)\b/.test(questionLower)) {
    add("Aggregation intent (avg)", /\bavg\s*\(/.test(sqlLower), "Question asks for average.");
  }
  if (/\b(top|desc|descending)\b/.test(questionLower)) {
    add("Ordering intent (DESC)", /\border by\b[\s\S]*\bdesc\b/.test(sqlLower), "Question asks for top/descending order.");
  }
  if (/\b(asc|ascending)\b/.test(questionLower)) {
    add("Ordering intent (ASC)", /\border by\b[\s\S]*\basc\b/.test(sqlLower), "Question asks for ascending order.");
  }
  if (/\b(last|past)\s+\d+\s+(hour|hours|day|days|week|weeks)\b/.test(questionLower)) {
    add(
      "Time-window intent",
      /\border_ts\b/.test(sqlLower) && /\binterval\b/.test(sqlLower),
      "Question asks for a relative time window.",
    );
  }

  const byMatches = [...questionLower.matchAll(/\bby\s+([a-z_][a-z0-9_]*)\b/g)];
  for (const match of byMatches) {
    const column = match[1];
    add(
      `Grouping intent (${column})`,
      new RegExp(`\\bgroup\\s+by\\b[\\s\\S]*\\b${column}\\b`).test(sqlLower),
      `Question groups by ${column}.`,
    );
  }

  const passed = criteria.filter((criterion) => criterion.passed).length;
  return { score: toScore(passed, criteria.length), criteria };
}

function scoreSafety(sql: string, guardValid: boolean): { score: number; criteria: QueryEvalCriterion[] } {
  const sqlLower = lower(sql);
  const criteria: QueryEvalCriterion[] = [
    { name: "Guard validation", passed: guardValid, detail: "Server guard accepted the SQL." },
    { name: "Read-only query", passed: /^\s*select\b/.test(sqlLower), detail: "SQL starts with SELECT." },
    { name: "Explicit limit", passed: /\blimit\s+\d+\b/.test(sqlLower), detail: "SQL includes LIMIT." },
    { name: "No wildcard select", passed: !/\bselect\s+\*/.test(sqlLower), detail: "SQL avoids SELECT *." },
  ];
  const passed = criteria.filter((criterion) => criterion.passed).length;
  return { score: toScore(passed, criteria.length), criteria };
}

function scoreExecution(
  dbSucceeded: boolean,
  rowCount: number,
  totalMs: number,
): { score: number; criteria: QueryEvalCriterion[] } {
  const criteria: QueryEvalCriterion[] = [
    { name: "Database execution", passed: dbSucceeded, detail: "Query executed successfully." },
    { name: "Result shape", passed: rowCount >= 0, detail: "Response has a valid row count." },
    {
      name: "Latency budget",
      passed: totalMs > 0 && totalMs < 15000,
      detail: "Total response time under 15s budget.",
    },
  ];
  const passed = criteria.filter((criterion) => criterion.passed).length;
  return { score: toScore(passed, criteria.length), criteria };
}

function scoreClarity(sql: string): { score: number; criteria: QueryEvalCriterion[] } {
  const sqlLower = lower(sql);
  const criteria: QueryEvalCriterion[] = [
    { name: "Known table", passed: /\bfrom\s+orders\b/.test(sqlLower), detail: "SQL targets whitelisted table." },
    {
      name: "Readable length",
      passed: sql.trim().length > 0 && sql.trim().length <= 500,
      detail: "SQL stays concise for debugging and demos.",
    },
    {
      name: "Explicit projection",
      passed: !/\bselect\s+\*/.test(sqlLower),
      detail: "Selected fields or aggregates are explicit.",
    },
  ];
  const passed = criteria.filter((criterion) => criterion.passed).length;
  return { score: toScore(passed, criteria.length), criteria };
}

export function evaluateQuery(input: EvaluateQueryInput): QueryEvalSummary {
  const intent = scoreIntent(input.question, input.sql);
  const safety = scoreSafety(input.sql, input.guardValid);
  const execution = scoreExecution(input.dbSucceeded, input.rowCount, input.totalMs);
  const clarity = scoreClarity(input.sql);

  const overallScore = Math.round(
    (intent.score * 0.35 + safety.score * 0.3 + execution.score * 0.2 + clarity.score * 0.15) * 100,
  ) / 100;

  return {
    overallScore,
    intentScore: intent.score,
    safetyScore: safety.score,
    executionScore: execution.score,
    clarityScore: clarity.score,
    criteria: [...intent.criteria, ...safety.criteria, ...execution.criteria, ...clarity.criteria],
  };
}
