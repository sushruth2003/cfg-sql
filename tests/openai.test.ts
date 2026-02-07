import { describe, expect, it } from "vitest";
import { extractCustomToolSql } from "@/lib/openai";

describe("extractCustomToolSql", () => {
  it("extracts SQL from a custom tool call", () => {
    const output = [
      {
        type: "custom_tool_call",
        name: "emit_sql",
        input: "SELECT status FROM orders LIMIT 10",
      },
    ];

    expect(extractCustomToolSql(output)).toBe("SELECT status FROM orders LIMIT 10");
  });

  it("returns null when payload is missing", () => {
    expect(extractCustomToolSql([])).toBeNull();
  });
});
