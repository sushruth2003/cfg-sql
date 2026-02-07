import fs from "node:fs";
import path from "node:path";
import { generateSql } from "../src/lib/openai";
import { ORDERS_SCHEMA } from "../src/lib/schema";
import { normalizeSql, validateSql } from "../src/lib/sql-guard";

type CasesFile = {
  grammarReliability: string[];
  executionReliability: { question: string; assertions: string[] }[];
  uxCases: string[];
};

type EvalResult = {
  name: string;
  passed: number;
  total: number;
  notes: string[];
};

function readCases(): CasesFile {
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

  for (const question of casesFile.grammarReliability) {
    try {
      const generation = await generateSql(question, ORDERS_SCHEMA);
      const normalizedSql = normalizeSql(generation.sql, ORDERS_SCHEMA);
      const guard = validateSql(normalizedSql, ORDERS_SCHEMA, 100);
      if (guard.ok) {
        passed += 1;
      } else {
        notes.push(`[grammar] ${question} => blocked: ${guard.reason}`);
      }
    } catch (error) {
      notes.push(`[grammar] ${question} => error: ${(error as Error).message}`);
    }
  }

  return {
    name: "Grammar reliability",
    passed,
    total: casesFile.grammarReliability.length,
    notes,
  };
}

async function runExecutionReliability(casesFile: CasesFile): Promise<EvalResult> {
  let passed = 0;
  const notes: string[] = [];

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
      } else {
        notes.push(`[exec] ${testCase.question} => assertion mismatch: ${normalizedSql}`);
      }
    } catch (error) {
      notes.push(`[exec] ${testCase.question} => error: ${(error as Error).message}`);
    }
  }

  return {
    name: "Execution reliability",
    passed,
    total: casesFile.executionReliability.length,
    notes,
  };
}

async function runUxEval(casesFile: CasesFile): Promise<EvalResult> {
  let passed = 0;
  const notes: string[] = [];

  for (const question of casesFile.uxCases) {
    try {
      const generation = await generateSql(question, ORDERS_SCHEMA);
      const normalizedSql = normalizeSql(generation.sql, ORDERS_SCHEMA);
      const uxScore = scoreUx(normalizedSql);
      if (uxScore >= 4) {
        passed += 1;
      } else {
        notes.push(`[ux] ${question} => low score ${uxScore}/5: ${normalizedSql}`);
      }
    } catch (error) {
      notes.push(`[ux] ${question} => error: ${(error as Error).message}`);
    }
  }

  return {
    name: "UX eval",
    passed,
    total: casesFile.uxCases.length,
    notes,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required for evals.");
    process.exit(1);
  }

  const casesFile = readCases();

  const results = [
    await runGrammarReliability(casesFile),
    await runExecutionReliability(casesFile),
    await runUxEval(casesFile),
  ];

  for (const result of results) {
    const rate = ((result.passed / result.total) * 100).toFixed(1);
    console.log(`\n${result.name}: ${result.passed}/${result.total} (${rate}%)`);
    if (result.notes.length > 0) {
      for (const note of result.notes) {
        console.log(`- ${note}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
