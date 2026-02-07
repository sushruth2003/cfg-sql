CREATE TABLE IF NOT EXISTS orders (
  order_id String,
  customer_id String,
  order_ts DateTime,
  status String,
  subtotal Float64,
  tax Float64,
  shipping Float64,
  total_amount Float64,
  country String,
  state String,
  payment_method String
)
ENGINE = MergeTree
ORDER BY (order_ts, status, country);
