import type { SchemaPolicy } from "@/lib/schema";

function quoteLiteral(value: string): string {
  return `"${value}"`;
}

export function buildSqlGrammar(schema: SchemaPolicy): string {
  const columns = schema.columns.map((column) => quoteLiteral(column.name)).join(" | ");
  const aggregates = schema.aggregates.map((agg) => quoteLiteral(agg)).join(" | ");
  const tableLiteral = quoteLiteral(schema.table);

  return [
    "start: query",
    "query: \"SELECT\" select_list \"FROM\" table where_clause? group_by_clause? order_by_clause? limit_clause",
    `table: ${tableLiteral}`,
    "select_list: select_item (\",\" select_item)*",
    "select_item: column | aggregate_expr",
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
    "group_by_clause: \"GROUP\" \"BY\" column (\",\" column)*",
    "order_by_clause: \"ORDER\" \"BY\" order_item (\",\" order_item)*",
    "order_item: column sort_dir",
    "sort_dir: \"ASC\" | \"DESC\"",
    "limit_clause: \"LIMIT\" INT",
    "INT: /[1-9][0-9]*/",
    "NUMBER: /-?[0-9]+(\\.[0-9]+)?/",
    "STRING: /'[^']*'/",
    "WS: /[ \\t\\n\\r]+/",
    "%ignore WS",
  ].join("\n");
}
