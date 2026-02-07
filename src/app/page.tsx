"use client";

import { useMemo, useState } from "react";

type QueryResponse = {
  question: string;
  sql: string;
  grammarValid: boolean;
  guardValid: boolean;
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  timingMs: { llm: number; db: number; total: number };
  model?: string;
  error?: { code: string; message?: string };
};

const EXAMPLES = [
  "sum the total_amount for all orders in the last 30 hours",
  "count orders by status in the last 7 days ordered by count descending",
  "average total_amount by payment_method for orders in the last day",
];

export default function Home() {
  const [question, setQuestion] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function runQuery() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, maxRows: 100 }),
      });

      const payload = (await response.json()) as QueryResponse;
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Query failed");
      }

      setResult(payload);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  }

  const headers = useMemo(() => result?.columns.map((column) => column.name) ?? [], [result]);

  return (
    <main>
      <h1>GPT-5 CFG SQL Demo</h1>
      <p>Natural language to constrained ClickHouse SQL with grammar + server guardrails.</p>

      <section className="panel">
        <label htmlFor="question">Ask a query</label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. sum total_amount in last 30 hours"
        />
        <button type="button" onClick={runQuery} disabled={isLoading || !question.trim()}>
          {isLoading ? "Running..." : "Run Query"}
        </button>
        <div className="examples">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="example-btn"
              onClick={() => setQuestion(example)}
              disabled={isLoading}
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <section className="panel">
          <div className="error">{error}</div>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="panel">
            <h2>Trace</h2>
            <div className="badges">
              <span className={`badge ${result.grammarValid ? "ok" : "fail"}`}>
                CFG {result.grammarValid ? "OK" : "FAIL"}
              </span>
              <span className={`badge ${result.guardValid ? "ok" : "fail"}`}>
                Guard {result.guardValid ? "OK" : "FAIL"}
              </span>
            </div>
            <pre>{result.sql}</pre>
            <div className="metrics" style={{ marginTop: "0.75rem" }}>
              <div className="metric">
                <div className="label">LLM ms</div>
                <div className="value">{result.timingMs.llm}</div>
              </div>
              <div className="metric">
                <div className="label">DB ms</div>
                <div className="value">{result.timingMs.db}</div>
              </div>
              <div className="metric">
                <div className="label">Total ms</div>
                <div className="value">{result.timingMs.total}</div>
              </div>
              <div className="metric">
                <div className="label">Rows</div>
                <div className="value">{result.rowCount}</div>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Results</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 100).map((row, index) => (
                    <tr key={index}>
                      {headers.map((header) => (
                        <td key={header}>{String(row[header] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
