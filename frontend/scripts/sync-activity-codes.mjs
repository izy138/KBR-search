import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const csvPath = join(root, "backend", "indexer", "data", "Activity_Codes.csv");
const outPath = join(root, "frontend", "src", "data", "activityCodeTitles.json");

const text = readFileSync(csvPath, "utf8");
const lines = text.trim().split(/\r?\n/);
const header = lines[0].split(",");
if (header[0] !== "Activity Code" || header[1] !== "Title") {
  throw new Error(`Unexpected CSV header: ${lines[0]}`);
}

const titles = {};
for (let i = 1; i < lines.length; i += 1) {
  const line = lines[i];
  const comma = line.indexOf(",");
  if (comma < 0) continue;
  const code = line.slice(0, comma).trim();
  const title = line.slice(comma + 1).trim();
  if (code) titles[code] = title;
}

writeFileSync(outPath, `${JSON.stringify(titles, null, 2)}\n`, "utf8");
console.log(`Wrote ${Object.keys(titles).length} activity codes to ${outPath}`);
