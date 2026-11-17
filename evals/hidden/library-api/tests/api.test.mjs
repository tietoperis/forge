// Hidden black-box acceptance tests for evals/specs/library-api. Test names start with the REQ ids they check.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, client, makeBook, makeMember, lend, expectStatus, isIsoUtc, uniq } from "./helpers.mjs";

let server;
let call;
before(async () => {
  server = await startServer();
  call = client(server.base);
});
after(async () => {
  await server?.stop();
});

const near = (iso, ms = 120_000) => Math.abs(Date.parse(iso) - Date.now()) < ms;

// ---------- resources ----------

test("REQ-16: GET /health answers 200", async () => {
  expectStatus(await call("GET", "/health"), 200, "health");
});

test("REQ-1: create, read and list a book", async () => {
  const r = await call("POST", "/books", { title: "Dune", author: "Frank Herbert" });
  expectStatus(r, 201, "create book");
  assert.equal(r.json.title, "Dune");
  assert.equal(r.json.author, "Frank Herbert");
  assert.equal(r.json.isbn, null);
  assert.ok(r.json.id !== undefined && r.json.id !== null);
  const got = await call("GET", `/books/${r.json.id}`);
  expectStatus(got, 200, "get book");
  assert.equal(got.json.title, "Dune");
  const list = await call("GET", "/books");
  expectStatus(list, 200, "list books");
  assert.ok(Array.isArray(list.json) && list.json.some((b) => b.id === r.json.id));
});

test("REQ-1: delete a book without loans", async () => {
  const b = await makeBook(call);
  expectStatus(await call("DELETE", `/books/${b.id}`), 204, "delete book");
  expectStatus(await call("GET", `/books/${b.id}`), 404, "get deleted book");
});

test("REQ-2: create, read, list and delete a member", async () => {
  const email = `ada${uniq()}@example.com`;
  const r = await call("POST", "/members", { name: "Ada", email });
  expectStatus(r, 201, "create member");
  assert.equal(r.json.name, "Ada");
  assert.equal(r.json.email.toLowerCase(), email);
  expectStatus(await call("GET", `/members/${r.json.id}`), 200, "get member");
  const list = await call("GET", "/members");
  assert.ok(Array.isArray(list.json) && list.json.some((m) => m.id === r.json.id));
  expectStatus(await call("DELETE", `/members/${r.json.id}`), 204, "delete member");
  expectStatus(await call("GET", `/members/${r.json.id}`), 404, "get deleted member");
});

test("REQ-3 REQ-8: a new loan records loanedAt and has returnedAt null", async () => {
  const b = await makeBook(call);
  const m = await makeMember(call);
  const r = await lend(call, b, m);
  expectStatus(r, 201, "create loan");
  assert.equal(r.json.bookId, b.id);
  assert.equal(r.json.memberId, m.id);
  assert.ok(isIsoUtc(r.json.loanedAt), `loanedAt ${r.json.loanedAt} is not an ISO 8601 UTC timestamp`);
  assert.ok(near(r.json.loanedAt), "loanedAt is not the current time");
  assert.equal(r.json.returnedAt, null);
  const got = await call("GET", `/loans/${r.json.id}`);
  expectStatus(got, 200, "get loan");
  assert.equal(got.json.bookId, b.id);
});

test("REQ-3: list loans filtered by member and active", async () => {
  const m = await makeMember(call);
  const other = await makeMember(call);
  const [b1, b2, b3] = [await makeBook(call), await makeBook(call), await makeBook(call)];
  const l1 = (await lend(call, b1, m)).json;
  const l2 = (await lend(call, b2, m)).json;
  await lend(call, b3, other);
  expectStatus(await call("POST", `/loans/${l1.id}/return`), 200, "return");
  const mine = await call("GET", `/loans?memberId=${encodeURIComponent(m.id)}`);
  expectStatus(mine, 200, "list member loans");
  assert.deepEqual(mine.json.map((l) => l.id).sort(), [l1.id, l2.id].sort());
  const active = await call("GET", `/loans?memberId=${encodeURIComponent(m.id)}&active=true`);
  assert.deepEqual(active.json.map((l) => l.id), [l2.id]);
  const all = await call("GET", "/loans");
  assert.ok(all.json.length >= 3);
});

test("REQ-4: unknown ids give 404", async () => {
  expectStatus(await call("GET", "/books/987654"), 404, "book");
  expectStatus(await call("GET", "/members/987654"), 404, "member");
  expectStatus(await call("GET", "/loans/987654"), 404, "loan");
  expectStatus(await call("DELETE", "/books/987654"), 404, "delete book");
});

// ---------- loan rules ----------

test("REQ-5: a fourth active loan is refused with 409", async () => {
  const m = await makeMember(call);
  const books = [];
  for (let i = 0; i < 4; i++) books.push(await makeBook(call));
  for (let i = 0; i < 3; i++) expectStatus(await lend(call, books[i], m), 201, `loan ${i + 1}`);
  expectStatus(await lend(call, books[3], m), 409, "fourth loan");
});

test("REQ-5: returned loans do not count toward the limit", async () => {
  const m = await makeMember(call);
  const books = [];
  for (let i = 0; i < 4; i++) books.push(await makeBook(call));
  const loans = [];
  for (let i = 0; i < 3; i++) loans.push((await lend(call, books[i], m)).json);
  expectStatus(await call("POST", `/loans/${loans[0].id}/return`), 200, "return");
  expectStatus(await lend(call, books[3], m), 201, "loan after return");
});

test("REQ-6: a book on loan cannot be borrowed by another member", async () => {
  const b = await makeBook(call);
  expectStatus(await lend(call, b, await makeMember(call)), 201, "first loan");
  expectStatus(await lend(call, b, await makeMember(call)), 409, "second loan");
});

test("REQ-6: a book on loan cannot be borrowed again by the same member", async () => {
  const b = await makeBook(call);
  const m = await makeMember(call);
  expectStatus(await lend(call, b, m), 201, "first loan");
  expectStatus(await lend(call, b, m), 409, "same member again");
});

test("REQ-6: a returned book can be borrowed again", async () => {
  const b = await makeBook(call);
  const l = (await lend(call, b, await makeMember(call))).json;
  expectStatus(await call("POST", `/loans/${l.id}/return`), 200, "return");
  expectStatus(await lend(call, b, await makeMember(call)), 201, "loan after return");
});

test("REQ-7: concurrent requests never lend the same book twice", async () => {
  const b = await makeBook(call);
  const members = [];
  for (let i = 0; i < 10; i++) members.push(await makeMember(call));
  const results = await Promise.all(members.map((m) => lend(call, b, m)));
  const codes = results.map((r) => r.status);
  assert.equal(codes.filter((c) => c === 201).length, 1, `statuses: ${codes.join(",")}`);
  assert.equal(codes.filter((c) => c === 409).length, 9, `statuses: ${codes.join(",")}`);
});

test("REQ-7: concurrent requests never give a member a fourth book", async () => {
  const m = await makeMember(call);
  const books = [];
  for (let i = 0; i < 8; i++) books.push(await makeBook(call));
  const results = await Promise.all(books.map((b) => lend(call, b, m)));
  const codes = results.map((r) => r.status);
  assert.equal(codes.filter((c) => c === 201).length, 3, `statuses: ${codes.join(",")}`);
  assert.equal(codes.filter((c) => c === 409).length, 5, `statuses: ${codes.join(",")}`);
  const active = await call("GET", `/loans?memberId=${encodeURIComponent(m.id)}&active=true`);
  assert.equal(active.json.length, 3);
});

test("REQ-8: returning records the server time", async () => {
  const l = (await lend(call, await makeBook(call), await makeMember(call))).json;
  const r = await call("POST", `/loans/${l.id}/return`);
  expectStatus(r, 200, "return");
  assert.ok(isIsoUtc(r.json.returnedAt), `returnedAt ${r.json.returnedAt} is not an ISO 8601 UTC timestamp`);
  assert.ok(near(r.json.returnedAt), "returnedAt is not the current time");
  assert.ok(Date.parse(r.json.returnedAt) >= Date.parse(r.json.loanedAt));
  const got = await call("GET", `/loans/${l.id}`);
  assert.equal(got.json.returnedAt, r.json.returnedAt);
});

test("REQ-8: the client cannot choose the return date", async () => {
  const l = (await lend(call, await makeBook(call), await makeMember(call))).json;
  const r = await call("POST", `/loans/${l.id}/return`, { returnedAt: "2001-01-01T00:00:00.000Z" });
  assert.ok([200, 400].includes(r.status), `unexpected status ${r.status}`);
  const got = await call("GET", `/loans/${l.id}`);
  if (got.json.returnedAt !== null) {
    assert.ok(!got.json.returnedAt.startsWith("2001"), "client-supplied return date was stored");
    assert.ok(near(got.json.returnedAt));
  }
});

test("REQ-8: returning twice is 409 and returning an unknown loan is 404", async () => {
  const l = (await lend(call, await makeBook(call), await makeMember(call))).json;
  expectStatus(await call("POST", `/loans/${l.id}/return`), 200, "first return");
  expectStatus(await call("POST", `/loans/${l.id}/return`), 409, "second return");
  expectStatus(await call("POST", "/loans/987654/return"), 404, "unknown loan");
});

test("REQ-9: a loan for a book or member that does not exist is 404", async () => {
  const b = await makeBook(call);
  const m = await makeMember(call);
  const unknown = typeof b.id === "number" ? 987654 : "987654";
  expectStatus(await call("POST", "/loans", { bookId: unknown, memberId: m.id }), 404, "unknown book");
  expectStatus(await call("POST", "/loans", { bookId: b.id, memberId: unknown }), 404, "unknown member");
});

// ---------- deletion ----------

test("REQ-10: a member or book with an active loan cannot be deleted", async () => {
  const b = await makeBook(call);
  const m = await makeMember(call);
  expectStatus(await lend(call, b, m), 201, "loan");
  expectStatus(await call("DELETE", `/members/${m.id}`), 409, "delete member");
  expectStatus(await call("DELETE", `/books/${b.id}`), 409, "delete book");
  expectStatus(await call("GET", `/members/${m.id}`), 200, "member still there");
  expectStatus(await call("GET", `/books/${b.id}`), 200, "book still there");
});

test("REQ-11: after all loans are returned, deletion succeeds and loan records remain", async () => {
  const b = await makeBook(call);
  const m = await makeMember(call);
  const l = (await lend(call, b, m)).json;
  expectStatus(await call("POST", `/loans/${l.id}/return`), 200, "return");
  expectStatus(await call("DELETE", `/members/${m.id}`), 204, "delete member");
  expectStatus(await call("DELETE", `/books/${b.id}`), 204, "delete book");
  const got = await call("GET", `/loans/${l.id}`);
  expectStatus(got, 200, "loan record after deletion");
  assert.equal(got.json.bookId, b.id);
  assert.equal(got.json.memberId, m.id);
  assert.ok(got.json.returnedAt);
});

// ---------- validation ----------

test("REQ-12: title and author are required and non-empty", async () => {
  expectStatus(await call("POST", "/books", { author: "A" }), 400, "missing title");
  expectStatus(await call("POST", "/books", { title: "T" }), 400, "missing author");
  expectStatus(await call("POST", "/books", { title: "   ", author: "A" }), 400, "blank title");
});

test("REQ-12: valid ISBN-10 and ISBN-13 with hyphens are accepted", async () => {
  expectStatus(await call("POST", "/books", { title: "T", author: "A", isbn: "978-0-306-40615-7" }), 201, "ISBN-13");
  expectStatus(await call("POST", "/books", { title: "T", author: "A", isbn: "0-306-40615-2" }), 201, "ISBN-10");
  expectStatus(await call("POST", "/books", { title: "T", author: "A", isbn: "0-8044-2957-X" }), 201, "ISBN-10 with X");
});

test("REQ-12: ISBNs with a wrong check digit or nonsense are rejected", async () => {
  expectStatus(await call("POST", "/books", { title: "T", author: "A", isbn: "978-0-306-40615-8" }), 400, "bad ISBN-13 check digit");
  expectStatus(await call("POST", "/books", { title: "T", author: "A", isbn: "0-306-40615-3" }), 400, "bad ISBN-10 check digit");
  expectStatus(await call("POST", "/books", { title: "T", author: "A", isbn: "----------" }), 400, "hyphens only");
});

test("REQ-12: several copies may share an ISBN", async () => {
  expectStatus(await call("POST", "/books", { title: "Copy", author: "A", isbn: "9780306406157" }), 201, "first copy");
  expectStatus(await call("POST", "/books", { title: "Copy", author: "A", isbn: "9780306406157" }), 201, "second copy");
});

test("REQ-13: member name and a valid email are required", async () => {
  expectStatus(await call("POST", "/members", { email: `x${uniq()}@example.com` }), 400, "missing name");
  expectStatus(await call("POST", "/members", { name: "X" }), 400, "missing email");
  expectStatus(await call("POST", "/members", { name: "X", email: "not-an-email" }), 400, "invalid email");
});

test("REQ-13: emails are unique case-insensitively", async () => {
  const email = `case${uniq()}@example.com`;
  expectStatus(await call("POST", "/members", { name: "A", email }), 201, "first");
  expectStatus(await call("POST", "/members", { name: "B", email: email.toUpperCase() }), 409, "duplicate in upper case");
});

test("REQ-14: wrong JSON types are rejected, not converted", async () => {
  const m = await makeMember(call);
  expectStatus(await call("POST", "/books", { title: 5, author: "A" }), 400, "numeric title");
  expectStatus(await call("POST", "/loans", { bookId: true, memberId: m.id }), 400, "boolean bookId");
  expectStatus(await call("POST", "/members", { name: ["A"], email: `t${uniq()}@example.com` }), 400, "array name");
});

test("REQ-14: a body that is not valid JSON is 400", async () => {
  expectStatus(await call("POST", "/books", "{not json"), 400, "malformed JSON");
});

test("REQ-14: unknown extra fields are ignored", async () => {
  const r = await call("POST", "/books", { title: "Extra", author: "A", colour: "red" });
  expectStatus(r, 201, "book with extra field");
});

test("REQ-15: error responses have a JSON body with an error field", async () => {
  const responses = [
    await call("POST", "/books", { author: "A" }),
    await call("GET", "/books/987654"),
  ];
  const b = await makeBook(call);
  await lend(call, b, await makeMember(call));
  responses.push(await lend(call, b, await makeMember(call)));
  assert.deepEqual(responses.map((r) => r.status), [400, 404, 409]);
  for (const r of responses) {
    assert.ok(r.json && typeof r.json === "object" && "error" in r.json, `no error field in ${r.status} body: ${r.text.slice(0, 200)}`);
  }
});
