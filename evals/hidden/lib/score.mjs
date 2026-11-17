// Runs inside the eval container: copies the implementation, installs it, runs the hidden
// tests for one spec and writes an aggregated JSON result.
//
//   node score.mjs --spec <name> --src <dir> --tests <dir> --out <file>
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith("--") ? [...acc, [v.slice(2), a[i + 1]]] : acc), []),
);
for (const k of ["spec", "src", "tests", "out"]) if (!args[k]) throw new Error(`missing --${k}`);

const IMPL = "/home/node/impl";
const SKIP = new Set(["node_modules", ".venv", "venv", ".git", "__pycache__", ".pytest_cache", "dist"]);
cpSync(args.src, IMPL, {
  recursive: true,
  filter: (p) => !SKIP.has(basename(p)) && !/\.(db|sqlite3?)(-wal|-shm|-journal)?$/.test(p),
});

const sh = (cmd, opts = {}) => {
  const r = spawnSync("bash", ["-lc", cmd], { cwd: IMPL, encoding: "utf8", timeout: 600_000, ...opts });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.slice(-4000) };
};

// ---------- setup (only what interface.md promises) ----------
const env = { ...process.env, IMPL_DIR: IMPL };
const setup = [];
if (args.spec === "cli-bank") {
  if (existsSync(join(IMPL, "requirements.txt"))) {
    setup.push({ step: "venv", ...sh("python3 -m venv /home/node/venv && /home/node/venv/bin/pip install -q -r requirements.txt") });
    env.PATH = `/home/node/venv/bin:${env.PATH}`;
  }
  if (existsSync(join(IMPL, "banksummary"))) sh("chmod +x banksummary");
} else if (args.spec === "library-api") {
  setup.push({ step: "npm install", ...sh("npm install --no-audit --no-fund") });
  const pkg = existsSync(join(IMPL, "package.json")) ? JSON.parse(readFileSync(join(IMPL, "package.json"), "utf8")) : {};
  if (pkg.scripts?.build) setup.push({ step: "npm run build", ...sh("npm run build") });
} else {
  throw new Error(`unknown spec ${args.spec}`);
}

// ---------- tests ----------
const files = readdirSync(args.tests).filter((f) => f.endsWith(".test.mjs")).sort().map((f) => join(args.tests, f));
const started = Date.now();
const r = spawnSync(
  "node",
  ["--test", "--test-concurrency=1", "--test-timeout=60000", `--test-reporter=${join(import.meta.dirname, "reporter.mjs")}`, ...files],
  { encoding: "utf8", env, timeout: 1_200_000, maxBuffer: 64 * 1024 * 1024 },
);
const tests = (r.stdout ?? "")
  .split("\n")
  .filter((l) => l.startsWith("{"))
  .map((l) => JSON.parse(l))
  .map((t) => ({ ...t, file: basename(t.file ?? ""), reqs: t.name.match(/REQ-\d+/g) ?? [] }));

// ---------- aggregate ----------
const perRequirement = {};
for (const t of tests) {
  for (const req of t.reqs) {
    perRequirement[req] ??= { passed: 0, total: 0 };
    perRequirement[req].total++;
    if (t.status === "passed") perRequirement[req].passed++;
  }
}
const passed = tests.filter((t) => t.status === "passed").length;
const result = {
  spec: args.spec,
  scoredAt: new Date().toISOString(),
  durationMs: Date.now() - started,
  setup: setup.map(({ step, code, out }) => ({ step, ok: code === 0, output: code === 0 ? undefined : out })),
  totals: { passed, failed: tests.length - passed, total: tests.length, passRate: tests.length ? passed / tests.length : 0 },
  perRequirement: Object.fromEntries(Object.entries(perRequirement).sort(([a], [b]) => Number(a.slice(4)) - Number(b.slice(4)))),
  tests: tests.map(({ name, file, status, error, durationMs }) => ({ name, file, status, durationMs, error })),
  runnerStderr: tests.length ? undefined : (r.stderr ?? "").slice(-4000),
};
mkdirSync(join(args.out, ".."), { recursive: true });
writeFileSync(args.out, JSON.stringify(result, null, 2) + "\n");
console.log(`${args.spec}: ${passed}/${tests.length} passed (${(result.totals.passRate * 100).toFixed(1)} %)`);
for (const t of tests.filter((t) => t.status !== "passed")) console.log(`  FAIL ${t.name}\n       ${(t.error ?? "").split("\n")[0]}`);
