import { describe, expect, it } from "vitest";
import { ORDERS_SCHEMA } from "@/lib/schema";
import { normalizeSql, validateSql } from "@/lib/sql-guard";

describe("validateSql", () => {
  it("accepts a valid strict query", () => {
    const sql =
      "SELECT status,count(order_id) FROM orders WHERE order_ts > now() - INTERVAL 24 HOUR GROUP BY status ORDER BY status ASC LIMIT 50";

    expect(validateSql(sql, ORDERS_SCHEMA, 100)).toEqual({ ok: true });
  });

  it("rejects non-select statements", () => {
    const sql = "DELETE FROM orders WHERE order_id = 'x'";
    const result = validateSql(sql, ORDERS_SCHEMA, 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Only SELECT");
  });

  it("rejects wildcard selects", () => {
    const sql = "SELECT * FROM orders LIMIT 10";
    const result = validateSql(sql, ORDERS_SCHEMA, 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Wildcard");
  });

  it("rejects unknown columns", () => {
    const sql = "SELECT secret_col FROM orders LIMIT 10";
    const result = validateSql(sql, ORDERS_SCHEMA, 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Unknown identifier");
  });

  it("rejects over-limit queries", () => {
    const sql = "SELECT status FROM orders LIMIT 450";
    const result = validateSql(sql, ORDERS_SCHEMA, 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("exceeds cap");
  });

  it("normalizes bare string filters", () => {
    const sql = "SELECT status FROM orders WHERE status = paid LIMIT 10";
    expect(normalizeSql(sql, ORDERS_SCHEMA)).toBe(
      "SELECT status FROM orders WHERE status = 'paid' LIMIT 10",
    );
  });

  it("accepts normalized bare string filters", () => {
    const sql = "SELECT status FROM orders WHERE status = paid LIMIT 10";
    const result = validateSql(sql, ORDERS_SCHEMA, 100);
    expect(result.ok).toBe(true);
  });

  it("rejects ordering by non-grouped columns in grouped queries", () => {
    const sql =
      "SELECT status,count(order_id) FROM orders WHERE order_ts >= now() - INTERVAL 7 DAY GROUP BY status ORDER BY country DESC LIMIT 100";
    const result = validateSql(sql, ORDERS_SCHEMA, 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("ORDER BY expression must be grouped or aggregated");
  });
});
