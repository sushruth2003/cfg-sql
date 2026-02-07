# CFG SQL Demo (GPT-5 + ClickHouse)

This project demonstrates natural-language querying of ClickHouse with GPT-5 constrained by a custom context-free grammar (CFG) via OpenAI custom tools.

## What it includes

- Next.js app with one UI + one API endpoint
- GPT-5 generation constrained with a Lark grammar (`custom` tool `format: grammar`)
- Defense-in-depth SQL validation on server before execution
- ClickHouse Cloud query execution
- 3 eval tracks:
  - grammar reliability
  - execution reliability
  - UX-oriented quality score
- live eval runner in the app UI (`Run Live Evals` button)
- Unit tests for grammar, guardrails, and model-output extraction

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env.local`:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5
CLICKHOUSE_URL=https://<host>:8443
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=...
CLICKHOUSE_DATABASE=default
```

3. Run the app:

```bash
npm run dev
```

4. Run tests:

```bash
npm run test
```

5. Run evals:

```bash
npm run evals
```

6. Run real-environment E2E checks:

```bash
npm run test:e2e:real
```

## API

`POST /api/query`

Request body:

```json
{
  "question": "sum the total_amount for all orders in the last 30 hours",
  "maxRows": 100
}
```

Response includes SQL, validation statuses, timing, row count, columns, and rows.

`POST /api/evals`

Runs live eval suites in the backend and returns per-suite + per-case pass/fail results.

## Data setup

Create an `orders` table in ClickHouse Cloud with at least 1000 rows and columns listed in `src/lib/schema.ts`.

## Deployment

Deploy on Vercel and set environment variables in project settings.

## Latest captured evals

See `/Users/sushruth/cfg-sql/docs/live_eval_results.md`.

## Loom checklist

- Walk through architecture and threat model
- Show live query generation and execution
- Show trace panel (SQL + validation + timings)
- Run evals and explain results
