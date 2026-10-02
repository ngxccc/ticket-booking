import * as p from "@clack/prompts";

/**
 * Common metadata contract for any runnable CLI test suite or benchmark target.
 */
export interface RunnerTargetItem {
  key: string;
  name: string;
  description: string;
}

/**
 * Discriminated union modeling all possible user intentions and CLI dispatch actions.
 */
export type RunnerAction<T extends RunnerTargetItem = RunnerTargetItem> =
  | { type: "list" }
  | { type: "all" }
  | { type: "target"; item: T }
  | { type: "error"; message: string };

/**
 * Configuration options required to bootstrap a unified CLI runner.
 */
export interface CliRunnerConfig<T extends RunnerTargetItem> {
  title: string;
  commandName: string;
  items: Record<string, T>;
  usageFlags?: { flag: string; description: string }[];
}

/**
 * Prints a formatted ANSI table and usage documentation for available CLI targets.
 */
export function printCliList<T extends RunnerTargetItem>(
  config: CliRunnerConfig<T>,
): void {
  p.intro(`📦 ${config.title}`);

  for (const [key, item] of Object.entries(config.items)) {
    console.log(`  \x1b[36m${key.padEnd(24)}\x1b[0m ${item.description}`);
  }

  console.log("\nSpecial Commands:");
  console.log(
    "  \x1b[33mall\x1b[0m                     Run all targets sequentially",
  );
  console.log(
    "  \x1b[33mls\x1b[0m                      List available targets and exit",
  );

  if (config.usageFlags && config.usageFlags.length > 0) {
    console.log("\nUsage Flags:");
    for (const flag of config.usageFlags) {
      console.log(`  ${flag.flag.padEnd(24)} ${flag.description}`);
    }
  }

  console.log("");
  p.outro(
    `Run: ${config.commandName} <target-name> or simply ${config.commandName}`,
  );
}

/**
 * Prompts the user with an interactive terminal select menu via @clack/prompts.
 */
export async function promptSelectCliTarget<T extends RunnerTargetItem>(
  config: CliRunnerConfig<T>,
): Promise<string> {
  p.intro(`🚀 ${config.title}`);

  const selected = await p.select({
    message: "Select a target to execute:",
    options: [
      {
        value: "all",
        label: "all",
        hint: "Run all targets sequentially with summary report",
      },
      ...Object.entries(config.items).map(([key, item]) => ({
        value: key,
        label: key,
        hint: item.description,
      })),
    ],
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled by user.");
    process.exit(0);
  }

  return selected;
}

/**
 * Resolves the appropriate CLI action based on positionals, special keywords, and TTY availability.
 */
export async function resolveCliAction<T extends RunnerTargetItem>(
  config: CliRunnerConfig<T>,
  rawTarget?: string,
  isTTY = process.stdin.isTTY,
): Promise<RunnerAction<T>> {
  // Case 1: No target provided
  if (!rawTarget) {
    if (!isTTY) {
      return {
        type: "error",
        message: "Missing target argument in non-interactive environment.",
      };
    }
    const chosen = await promptSelectCliTarget(config);
    return resolveCliAction(config, chosen, false);
  }

  // Case 2: Special command keywords
  const target = rawTarget.toLowerCase();
  if (target === "ls" || target === "list") {
    return { type: "list" };
  }
  if (target === "all") {
    return { type: "all" };
  }

  // Case 3: Direct or shorthand target match
  const exact = config.items[target];
  if (exact) {
    return { type: "target", item: exact };
  }

  const fuzzyMatches = Object.values(config.items).filter(
    (item) => item.key.includes(target) || item.name.includes(target),
  );
  if (fuzzyMatches.length === 1 && fuzzyMatches[0]) {
    return { type: "target", item: fuzzyMatches[0] };
  }

  return {
    type: "error",
    message: `Unknown target "${rawTarget}".`,
  };
}
