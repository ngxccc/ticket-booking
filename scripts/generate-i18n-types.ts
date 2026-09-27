import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const I18N_DIR = join(process.cwd(), "src/i18n");
const OUTPUT_FILE = join(process.cwd(), "src/generated/i18n.generated.ts");
const PLACEHOLDER_REGEX = /\{([a-zA-Z0-9_.]+)\}/g;

async function generate() {
  // 1. Run nestjs-i18n CLI to generate base types
  execSync(
    `bunx nestjs-i18n -p ./src/i18n/ -o ./src/generated/i18n.generated.ts`,
    {
      stdio: "inherit",
    },
  );

  // 2. Scan all translation files to extract placeholders
  const placeholdersMap = new Map<string, Set<string>>();

  const langDirs = await readdir(I18N_DIR, { withFileTypes: true });
  for (const dir of langDirs) {
    if (!dir.isDirectory()) continue;
    const langPath = join(I18N_DIR, dir.name);
    const files = await readdir(langPath);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const domain = file.replace(".json", "");
      const content = await readFile(join(langPath, file), "utf-8");
      try {
        const json = JSON.parse(content) as Record<string, unknown>;
        for (const [key, value] of Object.entries(json)) {
          if (typeof value === "string") {
            const matches = [...value.matchAll(PLACEHOLDER_REGEX)]
              .map((m) => m[1])
              .filter((m): m is string => typeof m === "string");
            if (matches.length > 0) {
              const fullKey = `${domain}.${key}`;
              if (!placeholdersMap.has(fullKey)) {
                placeholdersMap.set(fullKey, new Set());
              }
              const set = placeholdersMap.get(fullKey);
              if (set) {
                for (const m of matches) {
                  set.add(m);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Failed to parse ${file}:`, err);
      }
    }
  }

  // 3. Generate TypeScript interfaces for args
  const sortedEntries = [...placeholdersMap.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const argsMapEntries = sortedEntries.map(([key, paramsSet]) => {
    const params = [...paramsSet].sort();
    const fields = params
      .map((p) => {
        const fieldName = p.includes(".") ? `"${p}"` : p;
        return `${fieldName}?: string | number;`;
      })
      .join(" ");
    return `    "${key}": { ${fields} };`;
  });

  const appendCode = `
/* prettier-ignore */
export interface I18nArgsMap {
${argsMapEntries.join("\n")}
}

/* prettier-ignore */
export type I18nArgs<K extends I18nPath> = K extends keyof I18nArgsMap
  ? I18nArgsMap[K]
  : Record<string, unknown> | undefined;
`;

  let currentContent = await readFile(OUTPUT_FILE, "utf-8");
  currentContent = currentContent.trimEnd() + "\n" + appendCode;
  await writeFile(OUTPUT_FILE, currentContent, "utf-8");

  console.log("Successfully generated strongly-typed i18n arguments map!");
}

generate().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
