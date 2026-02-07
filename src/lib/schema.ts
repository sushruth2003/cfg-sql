export type ColumnDef = {
  name: string;
  type: "string" | "number" | "datetime";
};

export type SchemaPolicy = {
  table: string;
  columns: ColumnDef[];
  aggregates: string[];
  comparators: string[];
  maxLimit: number;
};

export const ORDERS_SCHEMA: SchemaPolicy = {
  table: "orders",
  columns: [
    { name: "order_id", type: "string" },
    { name: "customer_id", type: "string" },
    { name: "order_ts", type: "datetime" },
    { name: "status", type: "string" },
    { name: "subtotal", type: "number" },
    { name: "tax", type: "number" },
    { name: "shipping", type: "number" },
    { name: "total_amount", type: "number" },
    { name: "country", type: "string" },
    { name: "state", type: "string" },
    { name: "payment_method", type: "string" },
  ],
  aggregates: ["count", "sum", "avg", "min", "max"],
  comparators: ["=", "!=", ">", "<", ">=", "<="],
  maxLimit: 500,
};

export function schemaSummary(schema: SchemaPolicy): string {
  return [
    `Table: ${schema.table}`,
    `Columns: ${schema.columns.map((column) => `${column.name}(${column.type})`).join(", ")}`,
    `Aggregates: ${schema.aggregates.join(", ")}`,
    `Comparators: ${schema.comparators.join(" ")}`,
    `Max LIMIT: ${schema.maxLimit}`,
  ].join("\n");
}
