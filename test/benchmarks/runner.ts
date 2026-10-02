import "@nestjs/common";
import "@nestjs/core";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { BenchmarkMetric } from "./benchmark.util";
import {
  printCliList,
  resolveCliAction,
  type CliRunnerConfig,
  type RunnerTargetItem,
} from "../helpers/cli-runner.helper";

export type BenchmarkFn = () =>
  | Promise<BenchmarkMetric[] | BenchmarkMetric>
  | BenchmarkMetric[]
  | BenchmarkMetric;

export interface BenchmarkTargetItem extends RunnerTargetItem {
  file: string;
}

const BENCHMARKS: Record<string, BenchmarkTargetItem> = {
  "shows-seats": {
    key: "shows-seats",
    name: "shows-seats",
    description: "Showtime seating chart matrix retrieval (Single-JOIN SQL)",
    file: "shows-seats.bench.ts",
  },
  "shows-batch": {
    key: "shows-batch",
    name: "shows-batch",
    description: "Batch show creation & slot collision timeline validation",
    file: "shows-batch.bench.ts",
  },
  "dto-validation": {
    key: "dto-validation",
    name: "dto-validation",
    description: "Zod Standard Schema DTO parsing throughput",
    file: "dto-validation.bench.ts",
  },
};

const BENCHMARK_RUNNER_CONFIG: CliRunnerConfig<BenchmarkTargetItem> = {
  title: "Available Micro-Benchmark Suites",
  commandName: "bun run test:bench",
  items: BENCHMARKS,
};

/**
 * Executes a single benchmark file and collects its reported metrics.
 */
async function executeBenchmarkFile(
  target: BenchmarkTargetItem,
): Promise<BenchmarkMetric[]> {
  const fullPath = join(import.meta.dir, target.file);
  // WHY: Dynamic import is required for the CLI runner to lazily load runtime-selected benchmark suite modules without executing all benchmark suites on startup.
  const mod = (await import(fullPath)) as {
    default?: BenchmarkFn;
    runBenchmark?: BenchmarkFn;
  };

  const runner = mod.default ?? mod.runBenchmark;
  if (typeof runner !== "function") {
    throw new Error(
      `Benchmark module '${target.file}' does not export a default or runBenchmark function.`,
    );
  }

  const result = await runner();
  return Array.isArray(result) ? result : [result];
}

/**
 * Prints a formatted console table summarizing benchmark metrics.
 */
function printBenchmarkTable(metrics: BenchmarkMetric[]): void {
  console.log("\nBenchmark Results Summary:");
  console.table(
    metrics.map((r) => ({
      Task: r.task,
      Iterations: r.iterations,
      "Min (ms)": r.minMs.toFixed(4),
      "Mean (ms)": r.avgMs.toFixed(4),
      "p50 (ms)": r.p50Ms.toFixed(4),
      "p95 (ms)": r.p95Ms.toFixed(4),
      "p99 (ms)": r.p99Ms.toFixed(4),
      "Throughput (ops/sec)": r.opsPerSec.toFixed(0),
    })),
  );
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) {
    printCliList(BENCHMARK_RUNNER_CONFIG);
    process.exit(0);
  }

  const action = await resolveCliAction(
    BENCHMARK_RUNNER_CONFIG,
    positionals[0],
  );

  switch (action.type) {
    case "list":
      printCliList(BENCHMARK_RUNNER_CONFIG);
      return;

    case "all": {
      const allResults: BenchmarkMetric[] = [];
      for (const item of Object.values(BENCHMARKS)) {
        console.log(`\n⚡ Executing benchmark: [${item.name}]...`);
        const results = await executeBenchmarkFile(item);
        allResults.push(...results);
      }
      if (allResults.length > 0) {
        printBenchmarkTable(allResults);
      }
      return;
    }

    case "target": {
      console.log(`\n⚡ Executing benchmark: [${action.item.name}]...`);
      const results = await executeBenchmarkFile(action.item);
      if (results.length > 0) {
        printBenchmarkTable(results);
      }
      return;
    }

    case "error":
      console.error(`\n❌ Error: ${action.message}`);
      printCliList(BENCHMARK_RUNNER_CONFIG);
      process.exit(1);
  }
}

void main();
