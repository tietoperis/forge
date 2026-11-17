// Reference implementation of the library-api spec (evals/specs/library-api/spec.md).
// Hand-checked against the spec; used only to validate the hidden test suite.
// Runs on Node 24 type stripping: no build step and no npm dependencies.
import { DatabaseSync } from "node:sqlite";
import type { IncomingMessage, ServerResponse } from "node:http";

export const MAX_ACTIVE_LOANS = 3;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn TEXT,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS members_email ON members(lower(email)) WHERE deleted_at IS NULL;
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id),
      member_id INTEGER NOT NULL REFERENCES members(id),
      loaned_at TEXT NOT NULL,
      returned_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan_per_book ON loans(book_id) WHERE returned_at IS NULL;
  `);
  return db;
}

// ---------- validation ----------

const nonEmptyString = (body: Record<string, unknown>, field: string): string => {
  const v = body[field];
  if (typeof v !== "string" || v.trim() === "") throw new HttpError(400, `${field} must be a non-empty string`);
  return v.trim();
};

export function isValidIsbn(raw: string): boolean {
  const s = raw.replace(/[-\s]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (10 - i) * (s[i] === "X" ? 10 : Number(s[i]));
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += (i % 2 === 0 ? 1 : 3) * Number(s[i]);
    return sum % 10 === 0;
  }
  return false;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const idValue = (v: unknown, field: string): number => {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) throw new HttpError(400, `${field} must be a positive integer id`);
  return v;
};

const pathId = (s: string): number => {
  if (!/^[1-9]\d*$/.test(s)) throw new HttpError(404, "not found");
  return Number(s);
};

// ---------- representation ----------

type Row = Record<string, any>;
const bookOut = (r: Row) => ({ id: r.id, title: r.title, author: r.author, isbn: r.isbn ?? null });
const memberOut = (r: Row) => ({ id: r.id, name: r.name, email: r.email });
const loanOut = (r: Row) => ({
  id: r.id, bookId: r.book_id, memberId: r.member_id, loanedAt: r.loaned_at, returnedAt: r.returned_at ?? null,
});

// ---------- handlers ----------

export function createHandler(db: DatabaseSync, now: () => Date = () => new Date()) {
  const one = (sql: string, ...args: any[]) => db.prepare(sql).get(...args) as Row | undefined;
  const all = (sql: string, ...args: any[]) => db.prepare(sql).all(...args) as Row[];
  const run = (sql: string, ...args: any[]) => db.prepare(sql).run(...args);

  const book = (id: number) => {
    const r = one("SELECT * FROM books WHERE id = ? AND deleted_at IS NULL", id);
    if (!r) throw new HttpError(404, `book ${id} not found`);
    return r;
  };
  const member = (id: number) => {
    const r = one("SELECT * FROM members WHERE id = ? AND deleted_at IS NULL", id);
    if (!r) throw new HttpError(404, `member ${id} not found`);
    return r;
  };
  const loan = (id: number) => {
    const r = one("SELECT * FROM loans WHERE id = ?", id);
    if (!r) throw new HttpError(404, `loan ${id} not found`);
    return r;
  };

  // Request handling is synchronous after the body is read, and node:sqlite is synchronous,
  // so one process serialises requests. The transaction keeps it correct even if that changes.
  const tx = <T>(fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };

  type Result = { status: number; body?: unknown };

  const route = (method: string, parts: string[], query: URLSearchParams, body: any): Result => {
    const [res, id, action] = parts;
    if (method === "GET" && res === "health" && parts.length === 1) return { status: 200, body: { status: "ok" } };

    if (res === "books") {
      if (parts.length === 1 && method === "POST") {
        const b = requireObject(body);
        const title = nonEmptyString(b, "title");
        const author = nonEmptyString(b, "author");
        let isbn: string | null = null;
        if (b.isbn !== undefined && b.isbn !== null) {
          if (typeof b.isbn !== "string" || !isValidIsbn(b.isbn)) throw new HttpError(400, "isbn must be a valid ISBN-10 or ISBN-13");
          isbn = b.isbn.trim();
        }
        const info = run("INSERT INTO books (title, author, isbn) VALUES (?, ?, ?)", title, author, isbn);
        return { status: 201, body: bookOut(book(Number(info.lastInsertRowid))) };
      }
      if (parts.length === 1 && method === "GET") return { status: 200, body: all("SELECT * FROM books WHERE deleted_at IS NULL ORDER BY id").map(bookOut) };
      if (parts.length === 2 && method === "GET") return { status: 200, body: bookOut(book(pathId(id))) };
      if (parts.length === 2 && method === "DELETE") {
        return tx(() => {
          const b = book(pathId(id));
          if (one("SELECT 1 FROM loans WHERE book_id = ? AND returned_at IS NULL", b.id)) throw new HttpError(409, "book is on loan");
          run("UPDATE books SET deleted_at = ? WHERE id = ?", now().toISOString(), b.id);
          return { status: 204 };
        });
      }
    }

    if (res === "members") {
      if (parts.length === 1 && method === "POST") {
        const b = requireObject(body);
        const name = nonEmptyString(b, "name");
        const email = nonEmptyString(b, "email");
        if (!EMAIL.test(email)) throw new HttpError(400, "email must be a valid email address");
        return tx(() => {
          if (one("SELECT 1 FROM members WHERE lower(email) = lower(?) AND deleted_at IS NULL", email)) throw new HttpError(409, "email already registered");
          const info = run("INSERT INTO members (name, email) VALUES (?, ?)", name, email);
          return { status: 201, body: memberOut(member(Number(info.lastInsertRowid))) };
        });
      }
      if (parts.length === 1 && method === "GET") return { status: 200, body: all("SELECT * FROM members WHERE deleted_at IS NULL ORDER BY id").map(memberOut) };
      if (parts.length === 2 && method === "GET") return { status: 200, body: memberOut(member(pathId(id))) };
      if (parts.length === 2 && method === "DELETE") {
        return tx(() => {
          const m = member(pathId(id));
          if (one("SELECT 1 FROM loans WHERE member_id = ? AND returned_at IS NULL", m.id)) throw new HttpError(409, "member has books on loan");
          run("UPDATE members SET deleted_at = ? WHERE id = ?", now().toISOString(), m.id);
          return { status: 204 };
        });
      }
    }

    if (res === "loans") {
      if (parts.length === 1 && method === "POST") {
        const b = requireObject(body);
        const bookId = idValue(b.bookId, "bookId");
        const memberId = idValue(b.memberId, "memberId");
        return tx(() => {
          book(bookId);
          member(memberId);
          if (one("SELECT 1 FROM loans WHERE book_id = ? AND returned_at IS NULL", bookId)) throw new HttpError(409, "book is already on loan");
          const { n } = one("SELECT COUNT(*) AS n FROM loans WHERE member_id = ? AND returned_at IS NULL", memberId)!;
          if (n >= MAX_ACTIVE_LOANS) throw new HttpError(409, `member already has ${MAX_ACTIVE_LOANS} books on loan`);
          const info = run("INSERT INTO loans (book_id, member_id, loaned_at) VALUES (?, ?, ?)", bookId, memberId, now().toISOString());
          return { status: 201, body: loanOut(loan(Number(info.lastInsertRowid))) };
        });
      }
      if (parts.length === 1 && method === "GET") {
        const where: string[] = [];
        const args: number[] = [];
        const mid = query.get("memberId");
        if (mid !== null) {
          if (!/^[1-9]\d*$/.test(mid)) throw new HttpError(400, "memberId must be an id");
          where.push("member_id = ?");
          args.push(Number(mid));
        }
        const active = query.get("active");
        if (active !== null && active !== "true" && active !== "false") throw new HttpError(400, "active must be true or false");
        if (active === "true") where.push("returned_at IS NULL");
        const sql = `SELECT * FROM loans ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id`;
        return { status: 200, body: all(sql, ...args).map(loanOut) };
      }
      if (parts.length === 2 && method === "GET") return { status: 200, body: loanOut(loan(pathId(id))) };
      if (parts.length === 3 && action === "return" && method === "POST") {
        return tx(() => {
          const l = loan(pathId(id));
          if (l.returned_at) throw new HttpError(409, "loan already returned");
          run("UPDATE loans SET returned_at = ? WHERE id = ?", now().toISOString(), l.id);
          return { status: 200, body: loanOut(loan(l.id)) };
        });
      }
    }
    throw new HttpError(404, "route not found");
  };

  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body?: unknown) => {
      if (body === undefined) {
        res.writeHead(status).end();
      } else {
        res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
      }
    };
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const parts = url.pathname.split("/").filter(Boolean);
      let body: unknown = undefined;
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > 100_000) throw new HttpError(413, "body too large");
          chunks.push(c as Buffer);
        }
        const text = Buffer.concat(chunks).toString("utf8");
        if (text.trim() !== "") {
          try {
            body = JSON.parse(text);
          } catch {
            throw new HttpError(400, "body is not valid JSON");
          }
        }
      }
      const r = route(req.method ?? "GET", parts, url.searchParams, body);
      send(r.status, r.body);
    } catch (e) {
      if (e instanceof HttpError) send(e.status, { error: e.message });
      else {
        console.error(e);
        send(500, { error: "internal server error" });
      }
    }
  };
}

function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "body must be a JSON object");
  return body as Record<string, unknown>;
}
