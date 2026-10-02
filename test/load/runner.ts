import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  printCliList,
  resolveCliAction,
  type CliRunnerConfig,
  type RunnerTargetItem,
} from "../helpers/cli-runner.helper";

interface LoadTestSuite extends RunnerTargetItem {
  entryFile: string;
  distFile: string;
  fixtureFile?: string;
  seedScript?: string;
  teardownScript?: string;
}

const SUITES: Record<string, LoadTestSuite> = {
  "booking-concurrency": {
    key: "booking-concurrency",
    name: "booking-concurrency",
    description: "Contended hot-seat reservation concurrency & rate-limiting",
    entryFile: "test/load/suites/booking-concurrency/scenario.k6.ts",
    distFile: "test/load/.dist/booking-concurrency.k6.js",
    fixtureFile: "test/load/.dist/booking-fixtures.json",
    seedScript: "test/load/suites/booking-concurrency/seed.ts",
    teardownScript: "test/load/suites/booking-concurrency/teardown.ts",
  },
  "shows-seats": {
    key: "shows-seats",
    name: "shows-seats",
    description: "Showtime seating chart matrix retrieval",
    entryFile: "test/load/suites/shows-seats/scenario.k6.ts",
    distFile: "test/load/.dist/shows-seats.k6.js",
    fixtureFile: "test/load/.dist/shows-seats-fixtures.json",
    seedScript: "test/load/suites/shows-seats/seed.ts",
    teardownScript: "test/load/suites/shows-seats/teardown.ts",
  },
};

const LOAD_RUNNER_CONFIG: CliRunnerConfig<LoadTestSuite> = {
  title: "Available Load Test Suites",
  commandName: "bun run test:load",
  items: SUITES,
  usageFlags: [
    { flag: "--skip-seed", description: "Skip database fixture provisioning" },
    {
      flag: "--skip-teardown",
      description: "Retain database fixtures after execution",
    },
    {
      flag: "--strict",
      description:
        "Enforce strict SLA gates; exit with code 1 if thresholds are crossed",
    },
  ],
};

/**
 * Executes a child process command and streams output to stdout/stderr.
 */
function runCommand(
  command: string,
  args: string[],
): Promise<{ thresholdsCrossed: boolean }> {
  const {
    promise,
    resolve,
    reject,
  }: PromiseWithResolvers<{ thresholdsCrossed: boolean }> =
    Promise.withResolvers();
  console.log(`\n▶ [Runner] Running: ${command} ${args.join(" ")}`);
  const proc = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  proc.on("close", (code) => {
    if (code === 0) {
      resolve({ thresholdsCrossed: false });
    } else if (command === "k6" && (code === 99 || code === 107)) {
      console.warn(
        `\n⚠️ [Runner] k6 thresholds crossed (exit code ${String(code)}) - recorded in baseline summary.`,
      );
      resolve({ thresholdsCrossed: true });
    } else {
      reject(
        new Error(
          `Command '${command} ${args.join(" ")}' exited with code ${String(code)}`,
        ),
      );
    }
  });

  proc.on("error", (err) => {
    reject(err);
  });
  return promise;
}

/**
 * Bundles a TypeScript k6 entry file to a standalone browser JS distribution.
 */
async function bundleK6Script(
  entryFile: string,
  distFile: string,
): Promise<void> {
  console.log(`\n🔨 [Runner] Bundling ${entryFile} -> ${distFile}...`);
  mkdirSync("test/load/.dist", { recursive: true });
  mkdirSync("test-results/load", { recursive: true });
  const buildResult = await Bun.build({
    entrypoints: [entryFile],
    target: "browser",
    external: ["k6", "k6/*"],
  });

  const output = buildResult.outputs[0];
  if (!buildResult.success || !output) {
    console.error("Bundle errors:", buildResult.logs);
    throw new Error(`Failed to bundle ${entryFile}`);
  }

  await Bun.write(distFile, await output.text());
}

/**
 * Probes the target server BEFORE ANY SEEDING occurs to verify that:
 * 1. The server is online and reachable.
 * 2. The server is running in the 'test' environment to prevent polluting the 'dev' database.
 */
async function probeServerEnvironment(targetUrl: string): Promise<void> {
  console.log(
    `\n🩺 [Runner] Pre-flight probe: Checking server health at ${targetUrl}...`,
  );

  let healthPayload: { status?: string; environment?: string } | null;
  try {
    const res = await fetch(`${targetUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      healthPayload = (await res.json()) as {
        status?: string;
        environment?: string;
      };
    } else {
      throw new Error(`Server returned HTTP ${String(res.status)}`);
    }
  } catch (error) {
    throw new Error(
      `Cannot connect to server at ${targetUrl} (${error instanceof Error ? error.message : String(error)}).\n` +
        `ABORTED BEFORE SEEDING: No database records were created.\n` +
        `ACTION: Start your server in TEST mode using: 'bun run dev:test' or 'bun run start:test'.`,
      { cause: error },
    );
  }

  // Verify that the running server is explicitly in 'test' mode
  const serverEnv = healthPayload.environment;
  if (!serverEnv) {
    throw new Error(
      `ABORTED: Server at ${targetUrl} did not expose environment or is running in PRODUCTION mode.\n` +
        `Refusing to seed or run load tests against a production endpoint!\n` +
        `ACTION: Start your local server in TEST mode using: 'bun run dev:test' or 'bun run start:test'.`,
    );
  }

  if (serverEnv !== "test") {
    throw new Error(
      `Environment mismatch detected BEFORE seeding!\n` +
        `- Server at ${targetUrl} is running in '${serverEnv}' environment.\n` +
        `- Load tests are configured for 'test' database.\n` +
        `ABORTED BEFORE SEEDING: Prevented polluting your '${serverEnv}' database.\n` +
        `ACTION: Restart your server in TEST mode using: 'bun run dev:test'.`,
    );
  }

  console.log(`   Server is online in 'test' mode. Safe to proceed.`);
}

/**
 * Verifies that the seeded show fixtures are immediately retrievable from the target server.
 */
async function verifySeededFixture(
  targetUrl: string,
  suite: LoadTestSuite,
): Promise<void> {
  const fixturePath = suite.fixtureFile;
  if (!fixturePath) return;

  const fixtureFile = Bun.file(fixturePath);
  if (!(await fixtureFile.exists())) return;

  let showId: string | undefined;
  if (suite.name === "shows-seats") {
    const fixture = (await fixtureFile.json()) as { standardShowId?: string };
    showId = fixture.standardShowId;
  } else if (suite.name === "booking-concurrency") {
    const fixture = (await fixtureFile.json()) as { showId?: string };
    showId = fixture.showId;
  }

  if (showId) {
    const probeRes = await fetch(`${targetUrl}/api/v1/shows/${showId}/seats`, {
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);

    if (probeRes?.status === 404) {
      throw new Error(
        `Post-seed consistency check failed: Server at ${targetUrl} returned HTTP 404 for seeded showId (${showId}).\n` +
          `Ensure server and runner are connecting to identical database instances.`,
      );
    }
  }
}

interface SuiteExecutionResult {
  suite: string;
  status: "PASSED" | "THRESHOLDS_CROSSED" | "FAILED";
  durationSec: number;
  error?: string;
}

async function runSingleSuite(
  suite: LoadTestSuite,
  options: { skipSeed: boolean; skipTeardown: boolean },
): Promise<SuiteExecutionResult> {
  const start = performance.now();
  console.log(`\n🚀 Starting Load Test Suite: [${suite.name}]`);
  console.log(`   Description: ${suite.description}`);

  try {
    const targetUrl = process.env["TARGET_URL"] ?? "http://127.0.0.1:3000";

    // Pre-flight Guard 1: Verify server reachability & environment BEFORE any seeding occurs!
    await probeServerEnvironment(targetUrl);

    // Step 1: Bundle k6 script
    await bundleK6Script(suite.entryFile, suite.distFile);

    // Step 2: Seed data if script exists
    if (suite.seedScript && !options.skipSeed) {
      console.log(
        `\n🌱 [Runner] Provisioning test fixtures via ${suite.seedScript}...`,
      );
      await runCommand("bun", [suite.seedScript]);
    }

    // Pre-flight Guard 2: Verify seeded show exists before launching k6
    await verifySeededFixture(targetUrl, suite);

    // Step 3: Execute k6 run
    console.log(`\n⚡ [Runner] Executing k6 run on ${suite.distFile}...`);
    const k6Args = ["run"];
    if (suite.fixtureFile) {
      k6Args.push("-e", `FIXTURES_PATH=${suite.fixtureFile}`);
    }
    k6Args.push(suite.distFile);
    const k6Result = await runCommand("k6", k6Args);

    // Step 4: Teardown & Invariant Verification
    if (suite.teardownScript && !options.skipTeardown) {
      console.log(
        `\n🧹 [Runner] Running teardown & verification via ${suite.teardownScript}...`,
      );
      await runCommand("bun", [suite.teardownScript]);
    }

    const durationSec = (performance.now() - start) / 1000;
    const status = k6Result.thresholdsCrossed ? "THRESHOLDS_CROSSED" : "PASSED";
    console.log(`\n✅ Suite [${suite.name}] completed with status: ${status}.`);
    return { suite: suite.name, status, durationSec };
  } catch (error) {
    const durationSec = (performance.now() - start) / 1000;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Suite [${suite.name}] failed:`, error);

    // Attempt best-effort teardown on failure if teardown script is registered
    if (suite.teardownScript && !options.skipTeardown) {
      console.log(
        `\n🧹 [Runner] Attempting emergency teardown via ${suite.teardownScript}...`,
      );
      await runCommand("bun", [suite.teardownScript]).catch(() => undefined);
    }

    return {
      suite: suite.name,
      status: "FAILED",
      durationSec,
      error: errorMessage,
    };
  }
}

async function runAllSuites(options: {
  skipSeed: boolean;
  skipTeardown: boolean;
  strict: boolean;
}): Promise<void> {
  const results: SuiteExecutionResult[] = [];
  const suitesToRun = Object.values(SUITES);

  for (const suite of suitesToRun) {
    const result = await runSingleSuite(suite, options);
    results.push(result);
  }

  console.log("\n📊 Load Testing Execution Summary:\n");
  console.table(
    results.map((r) => ({
      Suite: r.suite,
      Status: r.status,
      "Duration (s)": `${r.durationSec.toFixed(1)}s`,
      ...(r.error ? { Error: r.error } : {}),
    })),
  );

  const hasFailures = results.some((r) => r.status === "FAILED");
  const hasThresholdBreaches = results.some(
    (r) => r.status === "THRESHOLDS_CROSSED",
  );

  if (hasFailures || (options.strict && hasThresholdBreaches)) {
    console.error(
      "\n❌ One or more load test suites failed SLA quality gates.",
    );
    process.exit(1);
  }

  console.log("\n✨ All load test suites completed successfully.");
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "skip-seed": { type: "boolean", default: false },
      "skip-teardown": { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) {
    printCliList(LOAD_RUNNER_CONFIG);
    process.exit(0);
  }

  const options = {
    skipSeed: Boolean(values["skip-seed"]),
    skipTeardown: Boolean(values["skip-teardown"]),
    strict: Boolean(values.strict) || process.env["STRICT_SLA"] === "true",
  };

  const action = await resolveCliAction(LOAD_RUNNER_CONFIG, positionals[0]);

  switch (action.type) {
    case "list":
      printCliList(LOAD_RUNNER_CONFIG);
      return;

    case "all":
      await runAllSuites(options);
      return;

    case "target": {
      const result = await runSingleSuite(action.item, options);
      if (
        result.status === "FAILED" ||
        (options.strict && result.status === "THRESHOLDS_CROSSED")
      ) {
        process.exit(1);
      }
      return;
    }

    case "error":
      console.error(`\n❌ Error: ${action.message}`);
      printCliList(LOAD_RUNNER_CONFIG);
      process.exit(1);
  }
}
void main();
