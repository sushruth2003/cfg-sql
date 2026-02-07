import type { SchemaPolicy } from "@/lib/schema";

function quoteLiteral(value: string): string {
  return `"${value}"`;
}

function safeRuleSuffix(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

export function buildSqlGrammar(schema: SchemaPolicy): string {
  const columns = schema.columns.map((column) => quoteLiteral(column.name)).join(" | ");
  const aggregates = schema.aggregates.map((agg) => quoteLiteral(agg)).join(" | ");
  const tableLiteral = quoteLiteral(schema.table);
  const groupedRuleNames = schema.columns.map((column) => `grouped_query_${safeRuleSuffix(column.name)}`);
  const groupedRules = schema.columns.flatMap((column) => {
    const suffix = safeRuleSuffix(column.name);
    const groupedRuleName = `grouped_query_${suffix}`;
    const groupedOrderClauseName = `grouped_order_clause_${suffix}`;
    const groupedOrderItemName = `grouped_order_item_${suffix}`;
    const col = quoteLiteral(column.name);

    return [
      `${groupedRuleName}: "SELECT" ${col} "," aggregate_list "FROM" table where_clause? "GROUP" "BY" ${col} ${groupedOrderClauseName}? limit_clause`,
      `${groupedOrderClauseName}: "ORDER" "BY" ${groupedOrderItemName} ("," ${groupedOrderItemName})*`,
      `${groupedOrderItemName}: ${col} sort_dir | aggregate_expr sort_dir`,
    ];
  });

  return [
    "start: query",
    `query: flat_query | ${groupedRuleNames.join(" | ")}`,
    "flat_query: \"SELECT\" select_list \"FROM\" table where_clause? order_by_clause? limit_clause",
    `table: ${tableLiteral}`,
    "select_list: select_item (\",\" select_item)*",
    "select_item: column | aggregate_expr",
    "aggregate_list: aggregate_expr (\",\" aggregate_expr)*",
    "aggregate_expr: agg_func \"(\" column \")\"",
    `agg_func: ${aggregates}`,
    `column: ${columns}`,
    "where_clause: \"WHERE\" predicate (\"AND\" predicate)*",
    "predicate: column comparator value | time_predicate",
    "time_predicate: \"order_ts\" comparator time_expr",
    "time_expr: \"now()\" \"-\" \"INTERVAL\" INT time_unit",
    "time_unit: \"HOUR\" | \"DAY\"",
    "comparator: \"=\" | \"!=\" | \">\" | \"<\" | \">=\" | \"<=\"",
    "value: NUMBER | STRING",
    "order_by_clause: \"ORDER\" \"BY\" order_item (\",\" order_item)*",
    "order_item: column sort_dir",
    "sort_dir: \"ASC\" | \"DESC\"",
    "limit_clause: \"LIMIT\" INT",
    ...groupedRules,
    "INT: /[1-9][0-9]*/",
    "NUMBER: /-?[0-9]+(\\.[0-9]+)?/",
    "STRING: /'[^']*'/",
    "WS: /[ \\t\\n\\r]+/",
    "%ignore WS",
  ].join("\n");
}
