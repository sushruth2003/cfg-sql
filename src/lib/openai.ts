import OpenAI from "openai";
import type { ResponseCustomToolCall } from "openai/resources/responses/responses";
import { buildSqlGrammar } from "@/lib/grammar";
import type { SchemaPolicy } from "@/lib/schema";
import { schemaSummary } from "@/lib/schema";

export type SqlGeneration = {
  sql: string;
  model: string;
};

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export function extractCustomToolSql(output: unknown): string | null {
  if (!Array.isArray(output)) {
    return null;
  }

  const toolCall = output.find((item): item is ResponseCustomToolCall => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as Partial<ResponseCustomToolCall>;
    return candidate.type === "custom_tool_call" && candidate.name === "emit_sql";
  });

  if (!toolCall?.input) {
    return null;
  }

  return toolCall.input.trim();
}

export async function generateSql(question: string, schema: SchemaPolicy): Promise<SqlGeneration> {
  const client = getClient();
  const grammar = buildSqlGrammar(schema);
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: [
              "Translate user questions into strict ClickHouse SQL.",
              "Always call the emit_sql tool exactly once.",
              "Do not explain the query.",
              "Use only data from this schema:",
              schemaSummary(schema),
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: question }],
      },
    ],
    tools: [
      {
        type: "custom",
        name: "emit_sql",
        description: "Emit exactly one SQL SELECT query.",
        format: {
          type: "grammar",
          syntax: "lark",
          definition: grammar,
        },
      },
    ],
    tool_choice: {
      type: "custom",
      name: "emit_sql",
    },
    max_output_tokens: 220,
  });

  const sql = extractCustomToolSql(response.output);
  if (!sql) {
    throw new Error("Model did not produce a custom tool SQL payload.");
  }

  return {
    sql,
    model,
  };
}
