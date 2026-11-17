# Spec: library API

We are building a REST API in TypeScript with SQLite for a small library with books, members and loans. A member can have at most three books on loan, a book can be on loan to only one member at a time, and returning a book records the return time. We are not building a user interface, authentication, due dates, fines, reservations, pagination or search. We assume a single server process and a small internal user base.

The interface contract in `interface.md` (start-up, environment variables, routes, resource shapes, error statuses) is part of this spec.

Size profile: M (public HTTP interface, several resources).

## Requirements

### Resources

- **REQ-1** (must) Books can be created, listed, read and deleted as defined in the interface contract. A book has `title`, `author` and optional `isbn` (`null` when absent).
- **REQ-2** (must) Members can be created, listed, read and deleted. A member has `name` and `email`.
- **REQ-3** (must) Loans can be created, listed (optionally filtered by `memberId` and `active=true`), read and returned.
- **REQ-4** (must) Unknown ids in the path give 404.

### Loan rules

- **REQ-5** (must) A member can have at most three active (not returned) loans; a fourth loan request gets 409. Returned loans do not count.
- **REQ-6** (must) A book can have at most one active loan; a loan request for a book that is on loan gets 409, also when the requester is the member who has it.
- **REQ-7** (must) The limits in REQ-5 and REQ-6 hold under concurrent requests to a single server process.
- **REQ-8** (must) A new loan gets `loanedAt` set to the server time and `returnedAt` `null`. `POST /loans/{id}/return` sets `returnedAt` to the server time (ISO 8601 UTC); the client cannot choose it. Returning an already returned loan gets 409; an unknown loan gets 404.
- **REQ-9** (must) A loan request that refers to a book or member that does not exist gets 404.

### Deletion

- **REQ-10** (must) Deleting a book or member that has an active loan gets 409.
- **REQ-11** (must) Deleting a book or member whose loans are all returned succeeds (204); their loan records remain readable with `GET /loans/{id}`.

### Validation

- **REQ-12** (must) `title` and `author` are required non-empty strings (after trimming). `isbn`, when present, is a valid ISBN-10 or ISBN-13 including the check digit; hyphens and spaces are allowed. Several books may share an ISBN.
- **REQ-13** (must) `name` is a required non-empty string; `email` is required and must look like an email address. Emails are unique case-insensitively; a duplicate gets 409.
- **REQ-14** (must) Values of the wrong JSON type (for example `"bookId": true`, `"title": 5`) are rejected with 400, not converted. A body that is not valid JSON gets 400. Unknown extra fields are ignored.
- **REQ-15** (must) Error responses use the statuses in the interface contract and have a JSON body with an `error` field.

### Operation and quality

- **REQ-16** (must) The service starts with `npm install`, `npm run build` (if defined) and `npm start`, honours `PORT` and `DATABASE_PATH`, creates its schema on start, and answers `GET /health` with 200.
- **REQ-17** (must) Data persists in the SQLite file across restarts.
- **REQ-18** (must) The project includes automated tests and a README that explains how to install, run and test it from a clean checkout.

## Interface contract

See `interface.md` in the same directory; it is binding.
