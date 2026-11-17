# Intake answers: library API

Fixed answers to the questions a careful reader of the prompt should ask. When a question is asked during intake, answer it from here. When a question is not covered here, answer "use your best judgement and state the assumption".

## Loans

**What happens when a member already has three books?**
The fourth loan is refused with 409. Only loans that have not been returned count.

**What happens when someone tries to borrow a book that is on loan?**
Refused with 409, whoever has it, including the same member.

**Must the limits hold under concurrent requests?**
Yes. Two simultaneous requests must never put the same book on loan twice or give a member a fourth book. One server process is enough; you don't need to support several processes on the same database.

**Which date is recorded when a book is returned?**
The server's current time, as an ISO 8601 UTC timestamp. Clients cannot choose it. Returning a loan that has already been returned is a 409; returning an unknown loan is a 404.

**Is there a due date or loan period?**
No.

## Deleting

**Can a member or a book with loans be deleted?**
Not while they have a loan that hasn't been returned: that's a 409. If all their loans have been returned, deletion is allowed (204), and the loan records stay: `GET /loans/{id}` still returns them.

## Validation

**What must a book have?**
`title` and `author`, non-empty after trimming spaces. `isbn` is optional; when given it must be a valid ISBN-10 or ISBN-13 including the check digit, with optional hyphens or spaces. Several books may share an ISBN; they are copies of the same title.

**What must a member have?**
`name` (non-empty) and `email`, which must look like an email address. Emails are unique, compared case-insensitively; a duplicate is a 409.

**What about wrong types or unknown fields?**
Wrong types are a 400: for example `"bookId": true` or `"title": 5` must not be accepted or converted. Unknown extra fields are ignored. A body that isn't valid JSON is a 400.

**Loan for a book or member that doesn't exist?**
404.

## Other

**Pagination, search, authentication?**
None. Lists return everything. No authentication; it's a small internal service.

**What should the README cover?**
How to install, run and test it from a clean checkout, and the endpoints.
