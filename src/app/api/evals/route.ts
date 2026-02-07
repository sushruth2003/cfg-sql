import { NextResponse } from "next/server";
import { runAllEvals } from "@/lib/evals";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimit = enforceRateLimit(request, "evals");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: "Too many eval requests. Please try again later.",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(rateLimit.resetAt),
        },
      },
    );
  }

  try {
    const summary = await runAllEvals();
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json(
      {
        error: {
          code: "evals_failed",
          message,
        },
      },
      { status: 500 },
    );
  }
}
