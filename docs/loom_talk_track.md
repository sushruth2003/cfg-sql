# Loom Talk Track (5-8 min)

1. Problem statement: convert business questions to SQL safely.
2. Why CFG: deterministic syntax envelope before SQL hits database.
3. Show grammar file generation from schema (`src/lib/grammar.ts`).
4. Show server guard (`src/lib/sql-guard.ts`) and explain defense-in-depth.
5. Live demo: two successful queries and one blocked unsafe prompt.
6. Explain per-query eval scoring in `/api/query`:
   - `intentScore`: derived from prompt-vs-SQL intent checks (aggregate/order/group/time-window alignment).
   - `safetyScore`: guard pass + SELECT-only + LIMIT + no wildcard.
   - `executionScore`: DB execution success + valid row shape + latency budget.
   - `clarityScore`: whitelisted table, explicit projection, concise SQL.
   - `overallScore = 0.35*intent + 0.30*safety + 0.20*execution + 0.15*clarity`.
7. Show live eval suites (`Run Live Evals` / `npm run evals`) and exact pass logic:
   - Grammar reliability: generate -> normalize -> guard pass.
   - Execution reliability: assertion checks on generated SQL.
   - UX eval: 5-point heuristic, pass at `>= 4/5`.
8. Discuss tradeoffs and next steps (multi-table joins, auth, caching, DB-backed semantic evals).
