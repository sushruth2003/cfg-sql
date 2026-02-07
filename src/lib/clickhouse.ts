import { createClient } from "@clickhouse/client";

export type ClickHouseColumn = {
  name: string;
  type: string;
};

export type QueryResult = {
  columns: ClickHouseColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
};

let cachedClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.CLICKHOUSE_URL;
  const username = process.env.CLICKHOUSE_USERNAME;
  const password = process.env.CLICKHOUSE_PASSWORD;

  if (!url || !username || !password) {
    throw new Error("Missing ClickHouse credentials. Set CLICKHOUSE_URL, CLICKHOUSE_USERNAME, CLICKHOUSE_PASSWORD.");
  }

  cachedClient = createClient({
    url,
    username,
    password,
    database: process.env.CLICKHOUSE_DATABASE || "default",
  });

  return cachedClient;
}

export async function runQuery(sql: string): Promise<QueryResult> {
  const client = getClient();
  const resultSet = await client.query({
    query: sql,
  });

  const result = await resultSet.json<{
    meta: ClickHouseColumn[];
    data: Record<string, unknown>[];
    rows: number;
  }>();

  return {
    columns: result.meta ?? [],
    rows: result.data ?? [],
    rowCount: result.rows ?? 0,
  };
}
