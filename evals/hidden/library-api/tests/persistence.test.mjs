// Hidden test: data survives a restart on the same DATABASE_PATH.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startServer, client, makeBook, makeMember, lend, expectStatus } from "./helpers.mjs";

test("REQ-16 REQ-17: data persists in the SQLite file across restarts", async () => {
  const first = await startServer();
  let book, loan;
  try {
    const call = client(first.base);
    book = await makeBook(call, { title: "Persistent" });
    const m = await makeMember(call);
    loan = (await lend(call, book, m)).json;
  } finally {
    await first.stop();
  }
  const second = await startServer({ dbPath: first.db });
  try {
    const call = client(second.base);
    const got = await call("GET", `/books/${book.id}`);
    expectStatus(got, 200, "book after restart");
    assert.equal(got.json.title, "Persistent");
    const l = await call("GET", `/loans/${loan.id}`);
    expectStatus(l, 200, "loan after restart");
    assert.equal(l.json.returnedAt, null);
  } finally {
    await second.stop();
  }
});
