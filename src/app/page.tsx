"use client";

import { useMemo, useState } from "react";

type QueryResponse = {
  question: string;
  sql: string;
  grammarValid: boolean;
  guardValid: boolean;
  queryEval?: {
    overallScore: number;
    intentScore: number;
    safetyScore: number;
    executionScore: number;
    clarityScore: number;
    criteria: { name: string; passed: boolean; detail: string }[];
  };
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  timingMs: { llm: number; db: number; total: number };
  model?: string;
  error?: { code: string; message?: string };
};

type EvalCaseResult = {
  question: string;
  passed: boolean;
  sql?: string;
  note?: string;
  score?: number;
};

type EvalResult = {
  name: string;
  passed: number;
  total: number;
  notes: string[];
  cases: EvalCaseResult[];
};

type EvalResponse = {
  ranAt: string;
  durationMs: number;
  totalPassed: number;
  totalCases: number;
  results: EvalResult[];
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
  const [isRunningEvals, setIsRunningEvals] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evals, setEvals] = useState<EvalResponse | null>(null);

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

  async function runLiveEvals() {
    setIsRunningEvals(true);
    setEvalError(null);

    try {
      const response = await fetch("/api/evals", {
        method: "POST",
      });

      const payload = (await response.json()) as EvalResponse;
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Live evals failed");
      }

      setEvals(payload);
    } catch (caught) {
      setEvals(null);
      setEvalError(caught instanceof Error ? caught.message : "Unexpected eval error");
    } finally {
      setIsRunningEvals(false);
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
            {result.queryEval ? (
              <div style={{ marginTop: "0.85rem" }}>
                <h3>Per-query eval</h3>
                <div className="metrics">
                  <div className="metric">
                    <div className="label">Overall</div>
                    <div className="value">{result.queryEval.overallScore}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Intent</div>
                    <div className="value">{result.queryEval.intentScore}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Safety</div>
                    <div className="value">{result.queryEval.safetyScore}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Execution</div>
                    <div className="value">{result.queryEval.executionScore}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Clarity</div>
                    <div className="value">{result.queryEval.clarityScore}</div>
                  </div>
                </div>
                <div className="eval-case" style={{ marginTop: "0.65rem" }}>
                  {result.queryEval.criteria.map((criterion) => (
                    <div key={`${criterion.name}:${criterion.detail}`}>
                      <span className={criterion.passed ? "case-pass" : "case-fail"}>
                        {criterion.passed ? "PASS" : "FAIL"}
                      </span>
                      {" - "}
                      {criterion.name}: {criterion.detail}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <h2>Results</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {headers.map((header, headerIndex) => (
                      <th key={`h:${headerIndex}:${header}`}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 100).map((row, index) => (
                    <tr key={index}>
                      {headers.map((header, headerIndex) => (
                        <td key={`c:${index}:${headerIndex}:${header}`}>{String(row[header] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <section className="panel">
        <h2>Live Evals</h2>
        <p>Run production-like evals from this app against your current local environment.</p>
        <button type="button" onClick={runLiveEvals} disabled={isRunningEvals}>
          {isRunningEvals ? "Running live evals..." : "Run Live Evals"}
        </button>

        {evalError ? <div className="error" style={{ marginTop: "0.6rem" }}>{evalError}</div> : null}

        {evals ? (
          <div style={{ marginTop: "0.8rem" }}>
            <div className="metrics">
              <div className="metric">
                <div className="label">Passed</div>
                <div className="value">
                  {evals.totalPassed}/{evals.totalCases}
                </div>
              </div>
              <div className="metric">
                <div className="label">Duration ms</div>
                <div className="value">{evals.durationMs}</div>
              </div>
              <div className="metric">
                <div className="label">Ran at</div>
                <div className="value">{new Date(evals.ranAt).toLocaleString()}</div>
              </div>
            </div>

            <div className="eval-grid">
              {evals.results.map((suite) => (
                <div className="eval-card" key={suite.name}>
                  <h3>{suite.name}</h3>
                  <div className="badges">
                    <span className={`badge ${suite.passed === suite.total ? "ok" : "fail"}`}>
                      {suite.passed}/{suite.total}
                    </span>
                  </div>
                  {suite.cases.map((testCase) => (
                    <div key={`${suite.name}:${testCase.question}`} className="eval-case">
                      <div className={testCase.passed ? "case-pass" : "case-fail"}>
                        {testCase.passed ? "PASS" : "FAIL"} - {testCase.question}
                      </div>
                      {testCase.sql ? <pre>{testCase.sql}</pre> : null}
                      {testCase.score !== undefined ? <div>UX score: {testCase.score}/5</div> : null}
                      {testCase.note ? <div className="error">{testCase.note}</div> : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
