// Black-box helpers: run the implementation's `banksummary` executable in a fresh temp dir.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const IMPL = process.env.IMPL_DIR;
if (!IMPL) throw new Error("IMPL_DIR is not set");

export const RULES = `
[[rules]]
category = "Groceries"
keywords = ["tesco", "lidl", "whole foods"]

[[rules]]
category = "Housing"
keywords = ["rent", "mortgage"]

[[rules]]
category = "Transport"
keywords = ["uber", "train"]
`;

/** Write files into a fresh directory and run banksummary there. */
export function run(args, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "bank-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  const r = spawnSync(join(IMPL, "banksummary"), args, { cwd: dir, encoding: "utf8", timeout: 20_000 });
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", error: r.error, dir };
}

/** Run with --format json and parse stdout; asserts exit 0 and valid JSON. */
export function runJson(csv, { rules = RULES, extraArgs = [], files = {} } = {}) {
  const all = { "tx.csv": csv, ...files };
  const args = ["tx.csv", "--format", "json", ...extraArgs];
  if (rules !== null) {
    all["rules.toml"] = rules;
    args.push("--config", "rules.toml");
  }
  const r = run(args, all);
  assert.equal(r.error, undefined, `could not run banksummary: ${r.error}`);
  assert.equal(r.code, 0, `exit status ${r.code}; stderr: ${r.stderr.slice(0, 500)}`);
  let json;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not JSON: ${r.stdout.slice(0, 300)}`);
  }
  return { ...r, json };
}

export const month = (json, key) => {
  const m = json.months.find((x) => x.month === key);
  assert.ok(m, `month ${key} missing; months: ${json.months.map((x) => x.month).join(", ")}`);
  return m;
};

/** Compare money strings numerically to two decimals, also checking the two-decimal format. */
export const money = (actual, expected, what = "amount") => {
  assert.match(String(actual), /^-?\d+\.\d{2}$/, `${what} ${JSON.stringify(actual)} is not a two-decimal string`);
  assert.equal(String(actual), expected, `${what}`);
};

export const cats = (m) => m.top_categories.map((c) => [c.category, c.amount]);
