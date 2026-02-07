import { runAllEvals } from "../src/lib/evals";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required for evals.");
    process.exit(1);
  }

  const summary = await runAllEvals();

  console.log(
    `Ran evals at ${summary.ranAt} in ${summary.durationMs}ms: ${summary.totalPassed}/${summary.totalCases}`,
  );

  for (const result of summary.results) {
    const rate = ((result.passed / result.total) * 100).toFixed(1);
    console.log(`\n${result.name}: ${result.passed}/${result.total} (${rate}%)`);
    if (result.notes.length > 0) {
      for (const note of result.notes) {
        console.log(`- ${note}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
