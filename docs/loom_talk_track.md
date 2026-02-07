# Loom Talk Track (5-8 min)

1. Problem statement: convert business questions to SQL safely.
2. Why CFG: deterministic syntax envelope before SQL hits database.
3. Show grammar file generation from schema (`src/lib/grammar.ts`).
4. Show server guard (`src/lib/sql-guard.ts`) and explain defense-in-depth.
5. Live demo: two successful queries and one blocked unsafe prompt.
6. Show eval runner and metrics (`npm run evals`).
7. Discuss tradeoffs and next steps (multi-table joins, auth, caching).
