// Black-box helpers: start the implementation with `npm start` and talk to it over HTTP.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const IMPL = process.env.IMPL_DIR;
if (!IMPL) throw new Error("IMPL_DIR is not set");

let nextPort = 4100 + Math.floor(Math.random() * 500);

/** Start the service; resolves once GET /health answers 200. */
export async function startServer({ dbPath } = {}) {
  const port = nextPort++;
  const db = dbPath ?? join(mkdtempSync(join(tmpdir(), "lib-")), "library.db");
  const child = spawn("npm", ["start"], {
    cwd: IMPL,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: db },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`service exited with ${child.exitCode}: ${log.slice(-1500)}`);
    try {
      const r = await fetch(`${base}/health`);
      if (r.status === 200) break;
    } catch {}
    if (Date.now() > deadline) {
      stop(child);
      throw new Error(`GET /health did not return 200 within 30 s: ${log.slice(-1500)}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return { base, db, child, stop: () => stop(child), log: () => log };
}

function stop(child) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const t = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
      resolve();
    }, 3000);
    child.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

/** HTTP call. body: object (JSON-encoded), string (sent raw) or undefined. */
export function client(base) {
  return async function call(method, path, body) {
    const init = { method, headers: {} };
    if (body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const res = await fetch(base + path, init);
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { status: res.status, json, text };
  };
}

let seq = 0;
export const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function makeBook(call, extra = {}) {
  const r = await call("POST", "/books", { title: `Book ${uniq()}`, author: "Author", ...extra });
  assert.equal(r.status, 201, `POST /books -> ${r.status} ${r.text}`);
  return r.json;
}

export async function makeMember(call) {
  const r = await call("POST", "/members", { name: "Member", email: `m${uniq()}@example.com` });
  assert.equal(r.status, 201, `POST /members -> ${r.status} ${r.text}`);
  return r.json;
}

export async function lend(call, book, member) {
  return call("POST", "/loans", { bookId: book.id, memberId: member.id });
}

export const expectStatus = (r, status, what) => assert.equal(r.status, status, `${what}: expected ${status}, got ${r.status} ${r.text.slice(0, 300)}`);

export const isIsoUtc = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]00:?00)$/.test(s) && !Number.isNaN(Date.parse(s));
