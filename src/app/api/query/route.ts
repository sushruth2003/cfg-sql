import { NextResponse } from "next/server";
import { z } from "zod";
import { runQuery } from "@/lib/clickhouse";
import { generateSql } from "@/lib/openai";
import { ORDERS_SCHEMA } from "@/lib/schema";
import { normalizeSql, validateSql } from "@/lib/sql-guard";

const requestSchema = z.object({
  question: z.string().min(3).max(400),
  maxRows: z.number().int().min(1).max(500).optional(),
});

function prevalidateQuestion(question: string): { blocked: boolean; reason?: string } {
  const lowered = question.toLowerCase();

  if (/\bselect\s+\*/i.test(lowered)) {
    return { blocked: true, reason: "Wildcard selects are blocked. Use explicit columns." };
  }

  if (/\b(delete|drop|truncate|update|insert|alter|create)\b/i.test(lowered)) {
    return { blocked: true, reason: "Only SELECT statements are allowed." };
  }

  const knownColumns = new Set(ORDERS_SCHEMA.columns.map((column) => column.name.toLowerCase()));
  const snakeCaseTokens = lowered.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [];
  const unknownTokens = snakeCaseTokens.filter((token) => !knownColumns.has(token));

  if (unknownTokens.length > 0) {
    return {
      blocked: true,
      reason: `Unknown identifier(s): ${Array.from(new Set(unknownTokens)).join(", ")}`,
    };
  }

  return { blocked: false };
}

export async function POST(request: Request) {
  const totalStart = Date.now();

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_request",
            message: parsed.error.issues.map((issue) => issue.message).join("; "),
          },
        },
        { status: 400 },
      );
    }

    const { question, maxRows = 100 } = parsed.data;
    const questionPrecheck = prevalidateQuestion(question);
    if (questionPrecheck.blocked) {
      return NextResponse.json(
        {
          question,
          sql: "",
          grammarValid: false,
          guardValid: false,
          timingMs: {
            llm: 0,
            db: 0,
            total: Date.now() - totalStart,
          },
          rowCount: 0,
          columns: [],
          rows: [],
          error: {
            code: "guard_blocked",
            message: questionPrecheck.reason,
          },
        },
        { status: 400 },
      );
    }

    const llmStart = Date.now();
    const generation = await generateSql(question, ORDERS_SCHEMA);
    const llmMs = Date.now() - llmStart;
    const normalizedSql = normalizeSql(generation.sql, ORDERS_SCHEMA);

    const guard = validateSql(normalizedSql, ORDERS_SCHEMA, maxRows);
    if (!guard.ok) {
      return NextResponse.json(
        {
          question,
          sql: normalizedSql,
          grammarValid: true,
          guardValid: false,
          timingMs: {
            llm: llmMs,
            db: 0,
            total: Date.now() - totalStart,
          },
          rowCount: 0,
          columns: [],
          rows: [],
          error: {
            code: "guard_blocked",
            message: guard.reason,
          },
        },
        { status: 400 },
      );
    }

    const dbStart = Date.now();
    const result = await runQuery(normalizedSql);
    const dbMs = Date.now() - dbStart;

    return NextResponse.json({
      question,
      sql: normalizedSql,
      model: generation.model,
      grammarValid: true,
      guardValid: true,
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      timingMs: {
        llm: llmMs,
        db: dbMs,
        total: Date.now() - totalStart,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      {
        error: {
          code: "server_error",
          message,
        },
      },
      { status: 500 },
    );
  }
}
