#!/usr/bin/env node
// Validates a hidden test suite: the reference must pass every test, and every mutant
// (a deliberately broken copy of the reference) must fail at least one test tagged with
// the requirement it breaks.
//
//   node evals/hidden/validate.mjs <spec> [--only <mutant-id>]
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const here = import.meta.dirname;
const spec = process.argv[2];
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
if (!spec) throw new Error("usage: validate.mjs <spec> [--only <mutant-id>]");

const reference = join(here, spec, "reference");
const mutants = JSON.parse(readFileSync(join(here, spec, "mutants.json"), "utf8")).filter((m) => !only || m.id === only);
const work = mkdtempSync(join(tmpdir(), `validate-${spec}-`));

function score(implDir, name) {
  const out = join(work, `${name}.json`);
  const r = spawnSync(join(here, "score.sh"), [spec, implDir, out], { encoding: "utf8", timeout: 1_800_000 });
  if (r.status !== 0) throw new Error(`score.sh failed for ${name}: ${r.stderr}`);
  return JSON.parse(readFileSync(out, "utf8"));
}

const rows = [];
let ok = true;

if (!only) {
  const ref = score(reference, "reference");
  const refOk = ref.totals.failed === 0 && ref.totals.total > 0;
  ok &&= refOk;
  rows.push({ id: "reference", verdict: refOk ? "ok" : "FAIL", detail: `${ref.totals.passed}/${ref.totals.total} passed` });
  for (const t of ref.tests.filter((t) => t.status !== "passed")) rows.push({ id: "", verdict: "", detail: `  failed: ${t.name}` });
}

for (const m of mutants) {
  const dir = join(work, m.id);
  cpSync(reference, dir, { recursive: true });
  const path = join(dir, m.file);
  let src = readFileSync(path, "utf8");
  for (const [from, to] of m.replace) {
    if (!src.includes(from)) throw new Error(`mutant ${m.id}: pattern not found in ${m.file}: ${from.slice(0, 80)}`);
    src = src.replace(from, to);
  }
  writeFileSync(path, src);
  const res = score(dir, m.id);
  const failed = res.tests.filter((t) => t.status !== "passed");
  const killedBy = failed.filter((t) => m.expectFail.some((req) => t.name.includes(`${req}:`) || t.name.includes(`${req} `)));
  const killed = killedBy.length > 0;
  ok &&= killed;
  rows.push({
    id: m.id,
    verdict: killed ? "killed" : "SURVIVED",
    detail: `${res.totals.failed} failing; expected ${m.expectFail.join(",")}: ${killedBy.map((t) => t.name.split(":")[0]).join("; ") || "none"}`,
  });
  rmSync(dir, { recursive: true, force: true });
}

for (const r of rows) console.log(`${r.id.padEnd(34)} ${r.verdict.padEnd(9)} ${r.detail}`);
console.log(ok ? "VALID" : "INVALID");
process.exit(ok ? 0 : 1);
