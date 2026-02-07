import fs from "node:fs";
import path from "node:path";
import { generateSql } from "@/lib/openai";
import { ORDERS_SCHEMA } from "@/lib/schema";
import { normalizeSql, validateSql } from "@/lib/sql-guard";

export type CasesFile = {
  grammarReliability: string[];
  executionReliability: { question: string; assertions: string[] }[];
  uxCases: string[];
};

export type EvalCaseResult = {
  question: string;
  passed: boolean;
  sql?: string;
  note?: string;
  score?: number;
};

export type EvalResult = {
  name: string;
  passed: number;
  total: number;
  notes: string[];
  cases: EvalCaseResult[];
};

export type EvalRunSummary = {
  ranAt: string;
  durationMs: number;
  totalPassed: number;
  totalCases: number;
  results: EvalResult[];
};

export function readCases(): CasesFile {
  const filePath = path.join(process.cwd(), "evals", "cases.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as CasesFile;
}

function scoreUx(sql: string): number {
  let score = 0;
  if (sql.includes("LIMIT")) score += 1;
  if (sql.includes("WHERE")) score += 1;
  if (sql.includes("ORDER BY") || sql.includes("GROUP BY")) score += 1;
  if (!sql.includes("*")) score += 1;
  if (/\bFROM\s+orders\b/i.test(sql)) score += 1;
  return score;
}

async function runGrammarReliability(casesFile: CasesFile): Promise<EvalResult> {
  let passed = 0;
  const notes: string[] = [];
  const cases: EvalCaseResult[] = [];

  for (const question of casesFile.grammarReliability) {
    try {
      const generation = await generateSql(question, ORDERS_SCHEMA);
      const normalizedSql = normalizeSql(generation.sql, ORDERS_SCHEMA);
      const guard = validateSql(normalizedSql, ORDERS_SCHEMA, 100);
      if (guard.ok) {
        passed += 1;
        cases.push({ question, passed: true, sql: normalizedSql });
      } else {
        const note = `[grammar] ${question} => blocked: ${guard.reason}`;
        notes.push(note);
        cases.push({ question, passed: false, sql: normalizedSql, note });
      }
    } catch (error) {
      const note = `[grammar] ${question} => error: ${(error as Error).message}`;
      notes.push(note);
      cases.push({ question, passed: false, note });
    }
  }

  return {
    name: "Grammar reliability",
    passed,
    total: casesFile.grammarReliability.length,
    notes,
    cases,
  };
}

async function runExecutionReliability(casesFile: CasesFile): Promise<EvalResult> {
  let passed = 0;
  const notes: string[] = [];
  const cases: EvalCaseResult[] = [];

  for (const testCase of casesFile.executionReliability) {
    try {
      const generation = await generateSql(testCase.question, ORDERS_SCHEMA);
      const normalizedSql = normalizeSql(generation.sql, ORDERS_SCHEMA);
      const checks = testCase.assertions.every((assertion) => {
        const [kind, expected] = assertion.split(":");
        if (kind === "contains") {
          return normalizedSql.toLowerCase().includes(expected.toLowerCase());
        }
        return false;
      });

      if (checks) {
        passed += 1;
        cases.push({ question: testCase.question, passed: true, sql: normalizedSql });
      } else {
        const note = `[exec] ${testCase.question} => assertion mismatch: ${normalizedSql}`;
        notes.push(note);
        cases.push({ question: testCase.question, passed: false, sql: normalizedSql, note });
      }
    } catch (error) {
      const note = `[exec] ${testCase.question} => error: ${(error as Error).message}`;
      notes.push(note);
      cases.push({ question: testCase.question, passed: false, note });
    }
  }

  return {
    name: "Execution reliability",
    passed,
    total: casesFile.executionReliability.length,
    notes,
    cases,
  };
}

async function runUxEval(casesFile: CasesFile): Promise<EvalResult> {
  let passed = 0;
  const notes: string[] = [];
  const cases: EvalCaseResult[] = [];

  for (const question of casesFile.uxCases) {
    try {
      const generation = await generateSql(question, ORDERS_SCHEMA);
      const normalizedSql = normalizeSql(generation.sql, ORDERS_SCHEMA);
      const uxScore = scoreUx(normalizedSql);
      if (uxScore >= 4) {
        passed += 1;
        cases.push({ question, passed: true, sql: normalizedSql, score: uxScore });
      } else {
        const note = `[ux] ${question} => low score ${uxScore}/5: ${normalizedSql}`;
        notes.push(note);
        cases.push({ question, passed: false, sql: normalizedSql, note, score: uxScore });
      }
    } catch (error) {
      const note = `[ux] ${question} => error: ${(error as Error).message}`;
      notes.push(note);
      cases.push({ question, passed: false, note });
    }
  }

  return {
    name: "UX eval",
    passed,
    total: casesFile.uxCases.length,
    notes,
    cases,
  };
}

export async function runAllEvals(casesFile = readCases()): Promise<EvalRunSummary> {
  const started = Date.now();
  const results = [
    await runGrammarReliability(casesFile),
    await runExecutionReliability(casesFile),
    await runUxEval(casesFile),
  ];

  const totalPassed = results.reduce((sum, result) => sum + result.passed, 0);
  const totalCases = results.reduce((sum, result) => sum + result.total, 0);

  return {
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    totalPassed,
    totalCases,
    results,
  };
}
