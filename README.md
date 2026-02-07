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
- Unit tests for grammar, guardrails, and model-output extraction

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env.local`:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
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

## Data setup

Create an `orders` table in ClickHouse Cloud with at least 1000 rows and columns listed in `src/lib/schema.ts`.

## Deployment

Deploy on Vercel and set environment variables in project settings.

## Loom checklist

- Walk through architecture and threat model
- Show live query generation and execution
- Show trace panel (SQL + validation + timings)
- Run evals and explain results
