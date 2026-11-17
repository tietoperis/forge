import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHandler, isValidIsbn, openDb } from "../src/app.ts";

test("isbn check digits", () => {
  assert.ok(isValidIsbn("978-0-306-40615-7"));
  assert.ok(isValidIsbn("0-306-40615-2"));
  assert.ok(isValidIsbn("080442957X"));
  assert.ok(!isValidIsbn("978-0-306-40615-8"));
  assert.ok(!isValidIsbn("----------"));
});

test("loan limit and return", async () => {
  const server = createServer(createHandler(openDb(":memory:"))).listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const post = (p: string, b?: unknown) =>
    fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) });
  try {
    const m = await (await post("/members", { name: "A", email: "a@x.io" })).json();
    const books = [];
    for (let i = 0; i < 4; i++) books.push(await (await post("/books", { title: `T${i}`, author: "X" })).json());
    for (let i = 0; i < 3; i++) assert.equal((await post("/loans", { bookId: books[i].id, memberId: m.id })).status, 201);
    assert.equal((await post("/loans", { bookId: books[3].id, memberId: m.id })).status, 409);
    const ret = await post("/loans/1/return");
    assert.equal(ret.status, 200);
    assert.ok((await ret.json()).returnedAt);
    assert.equal((await post("/loans/1/return")).status, 409);
  } finally {
    server.close();
  }
});
