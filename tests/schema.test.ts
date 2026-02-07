import { describe, expect, it } from "vitest";
import { ORDERS_SCHEMA, schemaSummary } from "@/lib/schema";

describe("schemaSummary", () => {
  it("renders key schema metadata", () => {
    const summary = schemaSummary(ORDERS_SCHEMA);

    expect(summary).toContain("Table: orders");
    expect(summary).toContain("Columns:");
    expect(summary).toContain("Aggregates: count, sum, avg, min, max");
    expect(summary).toContain("Max LIMIT: 500");
  });
});
