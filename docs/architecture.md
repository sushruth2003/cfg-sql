# Architecture

## Request Flow

1. User enters a natural-language question in the web UI.
2. `POST /api/query` validates request shape with `zod`.
3. Backend calls GPT-5 through OpenAI Responses API with a `custom` tool using `format: grammar` (Lark CFG).
4. Model emits SQL via the `emit_sql` tool input.
5. Server-side SQL guard verifies read-only policy and schema whitelist.
6. Valid query runs on ClickHouse Cloud.
7. API returns SQL trace, validation status, timing, and result rows.

## Safety Layers

- CFG-constrained decoding limits generation to a strict SQL subset.
- SQL guard blocks forbidden tokens, multi-statement payloads, wildcard projections, unknown identifiers, and oversized LIMIT values.
- ClickHouse credentials stay server-side only.

## API Contract

### `POST /api/query`

Request:

```json
{
  "question": "sum the total_amount for all orders in the last 30 hours",
  "maxRows": 100
}
```

Response:

```json
{
  "question": "...",
  "sql": "SELECT ...",
  "model": "gpt-5-mini",
  "grammarValid": true,
  "guardValid": true,
  "columns": [{ "name": "status", "type": "String" }],
  "rows": [{ "status": "paid", "count(order_id)": 42 }],
  "rowCount": 4,
  "timingMs": { "llm": 640, "db": 87, "total": 744 }
}
```
