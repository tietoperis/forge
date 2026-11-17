# Interface contract: library API

This contract fixes only how the service is started and the shape of its HTTP interface, so that it can be tested automatically. It does not decide behaviour beyond that.

## Project layout and start-up

- Node.js 24, TypeScript, SQLite.
- The project root contains `package.json`. The service is prepared and started with:
  ```
  npm install
  npm run build   # only if package.json defines a "build" script
  npm start
  ```
- Environment variables:
  - `PORT`: TCP port to listen on (default 3000).
  - `DATABASE_PATH`: path of the SQLite database file. The service creates the file and its schema on start if they do not exist.
- `GET /health` returns status 200 once the service is ready to accept requests.

## Conventions

- Request and response bodies are JSON (`Content-Type: application/json`).
- Resource ids are assigned by the service. They may be JSON numbers or strings; clients send them back exactly as received.
- Timestamps are ISO 8601 strings in UTC, for example `2026-11-17T08:00:00.000Z`.
- Errors use status `400` (invalid input), `404` (a resource in the path or body does not exist) or `409` (the request conflicts with the current state), with a JSON body that has an `error` field (a string or an object with a message).

## Resources

### Books

| Method and path | Request body | Success response |
| --- | --- | --- |
| `POST /books` | `{"title": string, "author": string, "isbn"?: string}` | `201` book |
| `GET /books` | | `200` array of books |
| `GET /books/{id}` | | `200` book |
| `DELETE /books/{id}` | | `204` |

Book: `{"id", "title", "author", "isbn"}` (`isbn` is `null` when not given).

### Members

| Method and path | Request body | Success response |
| --- | --- | --- |
| `POST /members` | `{"name": string, "email": string}` | `201` member |
| `GET /members` | | `200` array of members |
| `GET /members/{id}` | | `200` member |
| `DELETE /members/{id}` | | `204` |

Member: `{"id", "name", "email"}`.

### Loans

| Method and path | Request body | Success response |
| --- | --- | --- |
| `POST /loans` | `{"bookId": id, "memberId": id}` | `201` loan |
| `GET /loans` | | `200` array of loans; optional query parameters `memberId={id}` and `active=true` (only loans not yet returned) |
| `GET /loans/{id}` | | `200` loan |
| `POST /loans/{id}/return` | none | `200` loan |

Loan: `{"id", "bookId", "memberId", "loanedAt", "returnedAt"}` (`returnedAt` is `null` while the book is on loan).
