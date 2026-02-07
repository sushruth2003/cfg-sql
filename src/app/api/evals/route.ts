import { NextResponse } from "next/server";
import { runAllEvals } from "@/lib/evals";

export async function POST() {
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
