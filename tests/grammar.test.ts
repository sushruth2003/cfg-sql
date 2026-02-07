import { describe, expect, it } from "vitest";
import { buildSqlGrammar } from "@/lib/grammar";
import { ORDERS_SCHEMA } from "@/lib/schema";

describe("buildSqlGrammar", () => {
  it("includes a single whitelisted table", () => {
    const grammar = buildSqlGrammar(ORDERS_SCHEMA);
    expect(grammar).toContain('table: "orders"');
  });

  it("includes every allowed column", () => {
    const grammar = buildSqlGrammar(ORDERS_SCHEMA);
    for (const column of ORDERS_SCHEMA.columns) {
      expect(grammar).toContain(`"${column.name}"`);
    }
  });

  it("requires a LIMIT clause", () => {
    const grammar = buildSqlGrammar(ORDERS_SCHEMA);
    expect(grammar).toContain("limit_clause: \"LIMIT\" INT");
  });

  it("constrains grouped ORDER BY to grouped column or aggregates", () => {
    const grammar = buildSqlGrammar(ORDERS_SCHEMA);
    expect(grammar).toContain('grouped_order_item_status: "status" sort_dir | aggregate_expr sort_dir');
  });
});
