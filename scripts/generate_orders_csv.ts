import fs from "node:fs";
import path from "node:path";

type OrderStatus = "paid" | "refunded" | "pending" | "cancelled";
const STATUSES: OrderStatus[] = ["paid", "refunded", "pending", "cancelled"];
const COUNTRIES = ["US", "CA", "IN", "GB", "DE", "FR"];
const STATES = ["CA", "NY", "TX", "WA", "ON", "KA", "MH", "LDN", "BE"];
const PAYMENTS = ["card", "paypal", "apple_pay", "bank_transfer"];

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function csvEscape(value: string | number): string {
  const asText = String(value);
  if (asText.includes(",") || asText.includes('"')) {
    return `"${asText.replaceAll('"', '""')}"`;
  }
  return asText;
}

function generateRow(index: number): string[] {
  const now = Date.now();
  const lookbackMs = 1000 * 60 * 60 * 24 * 45;
  const ts = new Date(now - Math.floor(rand(0, lookbackMs))).toISOString().replace("T", " ").slice(0, 19);
  const subtotal = Number(rand(10, 500).toFixed(2));
  const tax = Number((subtotal * rand(0.04, 0.12)).toFixed(2));
  const shipping = Number(rand(0, 18).toFixed(2));
  const total = Number((subtotal + tax + shipping).toFixed(2));

  return [
    `ord_${100000 + index}`,
    `cust_${1000 + Math.floor(rand(1, 550))}`,
    ts,
    pick(STATUSES),
    subtotal,
    tax,
    shipping,
    total,
    pick(COUNTRIES),
    pick(STATES),
    pick(PAYMENTS),
  ].map(csvEscape);
}

function main() {
  const rowCount = Number.parseInt(process.argv[2] || "2000", 10);
  const outPath = path.join(process.cwd(), "docs", "orders_seed.csv");

  if (Number.isNaN(rowCount) || rowCount < 1000) {
    throw new Error("Row count must be a number >= 1000.");
  }

  const header = [
    "order_id",
    "customer_id",
    "order_ts",
    "status",
    "subtotal",
    "tax",
    "shipping",
    "total_amount",
    "country",
    "state",
    "payment_method",
  ].join(",");

  const rows = [header];
  for (let index = 0; index < rowCount; index += 1) {
    rows.push(generateRow(index).join(","));
  }

  fs.writeFileSync(outPath, `${rows.join("\n")}\n`, "utf8");
  console.log(`Wrote ${rowCount} rows to ${outPath}`);
}

main();
