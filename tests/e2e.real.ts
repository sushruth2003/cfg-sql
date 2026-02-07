import fs from "node:fs";
import path from "node:path";
import { POST } from "@/app/api/query/route";

type ApiOk = {
  question: string;
  sql: string;
  grammarValid: boolean;
  guardValid: boolean;
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  timingMs: { llm: number; db: number; total: number };
  error?: { code: string; message?: string };
};

type ApiErr = {
  error?: { code?: string; message?: string };
  sql?: string;
  guardValid?: boolean;
};

type Case = {
  name: string;
  question: string;
  assert: (status: number, body: ApiOk | ApiErr) => void;
};

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");
    if (index <= 0) {
      continue;
    }

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function expectTruthy(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectIncludes(haystack: string, needle: string, message: string) {
  if (!haystack.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`${message}. SQL: ${haystack}`);
  }
}

function expectBlocked(status: number, body: ApiOk | ApiErr, contains: string) {
  const errBody = body as ApiErr;
  expectTruthy(status === 400, `Expected status 400, got ${status}`);
  expectTruthy(errBody.error?.code === "guard_blocked", `Expected guard_blocked, got ${errBody.error?.code}`);
  expectTruthy(
    (errBody.error?.message || "").toLowerCase().includes(contains.toLowerCase()),
    `Expected error message to include '${contains}', got '${errBody.error?.message || ""}'`,
  );
}

async function callQuery(question: string): Promise<{ status: number; body: ApiOk | ApiErr }> {
  const request = new Request("http://local/api/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, maxRows: 100 }),
  });

  const response = await POST(request);
  const body = (await response.json()) as ApiOk | ApiErr;
  return { status: response.status, body };
}

const cases: Case[] = [
  {
    name: "sum last 30 hours",
    question: "sum total_amount for all orders in the last 30 hours",
    assert: (status, body) => {
      const ok = body as ApiOk;
      expectTruthy(status === 200, `Expected 200, got ${status}`);
      expectIncludes(ok.sql, "sum(total_amount)", "Missing sum(total_amount)");
      expectIncludes(ok.sql, "order_ts", "Missing time filter");
      expectIncludes(ok.sql, "limit", "Missing LIMIT");
      expectTruthy(ok.rowCount === 1, `Expected 1 row aggregate, got ${ok.rowCount}`);
    },
  },
  {
    name: "count by status 7 days",
    question: "count orders by status in the last 7 days ordered by status asc",
    assert: (status, body) => {
      const ok = body as ApiOk;
      expectTruthy(status === 200, `Expected 200, got ${status}`);
      expectIncludes(ok.sql, "group by status", "Missing GROUP BY status");
      expectIncludes(ok.sql, "order by status asc", "Missing ORDER BY status ASC");
      expectTruthy(ok.rowCount >= 1, `Expected multiple rows, got ${ok.rowCount}`);
    },
  },
  {
    name: "avg by payment method",
    question: "average total_amount by payment_method for orders in the last day",
    assert: (status, body) => {
      const ok = body as ApiOk;
      expectTruthy(status === 200, `Expected 200, got ${status}`);
      expectIncludes(ok.sql, "avg(total_amount)", "Missing AVG(total_amount)");
      expectIncludes(ok.sql, "group by payment_method", "Missing GROUP BY payment_method");
    },
  },
  {
    name: "explicit columns sorted desc limit 25",
    question: "show order_id,customer_id,total_amount for orders in the last 12 hours order by total_amount desc limit 25",
    assert: (status, body) => {
      const ok = body as ApiOk;
      expectTruthy(status === 200, `Expected 200, got ${status}`);
      expectIncludes(ok.sql, "order by total_amount desc", "Missing ORDER BY total_amount DESC");
      expectIncludes(ok.sql, "limit 25", "Missing LIMIT 25");
      expectTruthy(ok.rowCount <= 25, `Expected <= 25 rows, got ${ok.rowCount}`);
    },
  },
  {
    name: "sum shipping by country",
    question: "sum shipping by country for orders in the last 3 days order by country asc",
    assert: (status, body) => {
      const ok = body as ApiOk;
      expectTruthy(status === 200, `Expected 200, got ${status}`);
      expectIncludes(ok.sql, "sum(shipping)", "Missing sum(shipping)");
      expectIncludes(ok.sql, "group by country", "Missing GROUP BY country");
    },
  },
  {
    name: "status paid filter",
    question: "sum total_amount for orders where status = 'paid' in the last 48 hours",
    assert: (status, body) => {
      const ok = body as ApiOk;
      expectTruthy(status === 200, `Expected 200, got ${status}`);
      expectIncludes(ok.sql, "status = 'paid'", "Missing paid status predicate");
      expectTruthy(ok.guardValid, "Expected guardValid=true");
    },
  },
  {
    name: "top states",
    question: "show top states by order count in the last day",
    assert: (status, body) => {
      const ok = body as ApiOk;
      expectTruthy(status === 200, `Expected 200, got ${status}`);
      expectIncludes(ok.sql, "order by", "Missing ORDER BY");
      expectIncludes(ok.sql, "limit", "Missing LIMIT");
      expectIncludes(ok.sql, "state", "Expected state-oriented query");
    },
  },
  {
    name: "block wildcard",
    question: "select * from orders limit 10",
    assert: (status, body) => {
      expectBlocked(status, body, "Wildcard selects are blocked");
    },
  },
  {
    name: "block delete",
    question: "delete from orders",
    assert: (status, body) => {
      expectBlocked(status, body, "Only SELECT statements are allowed");
    },
  },
  {
    name: "block unknown identifier",
    question: "sum revenue by product_category in the last week",
    assert: (status, body) => {
      expectBlocked(status, body, "Unknown identifier");
    },
  },
  {
    name: "list all orders",
    question: "list all orders",
    assert: (status, body) => {
      const ok = body as ApiOk;
      expectTruthy(status === 200, `Expected 200, got ${status}`);
      expectTruthy(!ok.sql.includes("*"), `Expected explicit columns, got ${ok.sql}`);
      expectIncludes(ok.sql, "limit", "Missing LIMIT");
    },
  },
  {
    name: "count by status 999 days",
    question: "count orders by status for the last 999 days",
    assert: (status, body) => {
      const ok = body as ApiOk;
      expectTruthy(status === 200, `Expected 200, got ${status}`);
      expectIncludes(ok.sql, "group by status", "Missing GROUP BY status");
      expectIncludes(ok.sql, "limit", "Missing LIMIT");
      expectTruthy(ok.guardValid, "Expected guardValid=true");
    },
  },
];

async function main() {
  loadDotEnvLocal();

  for (const key of ["OPENAI_API_KEY", "CLICKHOUSE_URL", "CLICKHOUSE_USERNAME", "CLICKHOUSE_PASSWORD"]) {
    expectTruthy(process.env[key], `Missing required env var: ${key}`);
  }

  let passed = 0;
  const failures: string[] = [];

  for (const testCase of cases) {
    try {
      const { status, body } = await callQuery(testCase.question);
      testCase.assert(status, body);
      const sql = (body as ApiOk).sql || "<blocked-before-sql>";
      console.log(`PASS - ${testCase.name}`);
      console.log(`  status=${status} sql=${sql}`);
      passed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${testCase.name}: ${message}`);
      console.log(`FAIL - ${testCase.name}`);
      console.log(`  ${message}`);
    }
  }

  console.log(`\nResult: ${passed}/${cases.length} passed`);

  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
