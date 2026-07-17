import { run as newmanRun } from "newman";
import { readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import type { NewmanRunOptions } from "newman";

// WHY: Use Bun's native import.meta.dir instead of __dirname to resolve the absolute path of this script.
const currentDir = import.meta.dir;
const SCENARIOS_DIR = join(currentDir, "scenarios");
const DATA_DIR = join(currentDir, "data");
const ENV_PATH = join(currentDir, "environments", "local_environment.json");

async function runAll() {
  const files = readdirSync(SCENARIOS_DIR).filter((file) =>
    file.endsWith(".json"),
  );
  console.log(`🔍 Found ${String(files.length)} API test scenarios...`);

  const summary: { name: string; success: boolean }[] = [];

  for (const file of files) {
    const scenarioPath = join(SCENARIOS_DIR, file);
    const scenarioName = basename(file, ".json");

    // Naming Rule: <scenario_name>.json strictly maps to <scenario_name>_data.json
    const dataPath = join(DATA_DIR, `${scenarioName}_data.json`);

    console.log(`\n🚀 Running scenario: ${scenarioName}...`);

    const runOptions: NewmanRunOptions = {
      collection: scenarioPath,
      environment: ENV_PATH,
      reporters: ["cli"],
    };

    if (existsSync(dataPath)) {
      console.log(`📂 Using iteration data: ${basename(dataPath)}`);
      runOptions.iterationData = dataPath;
    } else {
      console.log(
        `⚠️ No matching data file found at: ${dataPath} (running without iteration data)`,
      );
    }

    const success = await new Promise<boolean>((resolve) => {
      newmanRun(runOptions, (err, summaryResult) => {
        resolve(!err && summaryResult.run.failures.length === 0);
      });
    });

    summary.push({ name: scenarioName, success });

    if (!success) {
      console.error(`❌ Scenario ${scenarioName} failed!`);
    } else {
      console.log(`✅ Scenario ${scenarioName} completed successfully.`);
    }
  }

  console.log("\n📊 API INTEGRATION TESTS SUMMARY:");
  console.log("=================================");
  summary.forEach((item) => {
    console.log(`${item.success ? "✅" : "❌"} ${item.name}`);
  });
  console.log("=================================");

  const hasFailed = summary.some((item) => !item.success);
  if (hasFailed) {
    process.exit(1);
  }
}

runAll().catch((err: unknown) => {
  console.error("API test runner crashed:", err);
  process.exit(1);
});
