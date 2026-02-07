import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORDERS_SCHEMA } from "@/lib/schema";

const createMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: class OpenAI {
      responses = {
        create: createMock,
      };
    },
  };
});

describe("generateSql", () => {
  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-5-mini");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses grammar-constrained custom tool output", async () => {
    createMock.mockResolvedValue({
      output: [
        {
          type: "custom_tool_call",
          name: "emit_sql",
          input: "SELECT status,count(order_id) FROM orders GROUP BY status LIMIT 10",
        },
      ],
    });

    const { generateSql } = await import("@/lib/openai");

    const result = await generateSql("count orders by status", ORDERS_SCHEMA);

    expect(result.sql).toContain("FROM orders");
    expect(result.model).toBe("gpt-5-mini");
    expect(createMock).toHaveBeenCalledTimes(1);

    const payload = createMock.mock.calls[0][0] as Record<string, unknown>;
    const tools = payload.tools as Array<Record<string, unknown>>;
    const tool = tools[0];
    const format = tool.format as Record<string, unknown>;

    expect(tool.type).toBe("custom");
    expect(tool.name).toBe("emit_sql");
    expect(format.type).toBe("grammar");
    expect(format.syntax).toBe("lark");
  });

  it("throws when the model does not call emit_sql", async () => {
    createMock.mockResolvedValue({ output: [] });

    const { generateSql } = await import("@/lib/openai");

    await expect(generateSql("sum total", ORDERS_SCHEMA)).rejects.toThrow(
      "Model did not produce a custom tool SQL payload.",
    );
  });
});
