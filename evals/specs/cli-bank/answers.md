# Intake answers: banksummary

Fixed answers to the questions a careful reader of the prompt should ask. When a question is asked during intake, answer it from here. When a question is not covered here, answer "use your best judgement and state the assumption".

## Input format

**Which number formats must the amount column accept?**
Both `.` and `,` as the decimal separator; my bank exports use `,`. Thousands separators (`.`, `,`, space) may appear. The rule: if the last `.` or `,` in the number is followed by one or two digits, it is the decimal separator; every other `.`, `,` or space is a thousands separator. So `1234.56`, `1234,56`, `1,234.56`, `1.234,56` and `1 234,56` are all 1234.56, and `1,234` is 1234. A leading `-` means an expense. A currency symbol (`€`, `$`, `£`) next to the number is ignored.

**Comma or semicolon separated?**
Either. Detect it from the header row: if the header contains `;` it is semicolon-separated, otherwise comma-separated. Fields may be quoted with `"`.

**Which date formats?**
`YYYY-MM-DD`, `DD.MM.YYYY` and `DD/MM/YYYY`. Do not accept US `MM/DD/YYYY`; dates that are not valid in these formats (for example `2024-02-30` or `13/25/2024`) make the row invalid. Don't guess.

**Column order and extra columns?**
The header names the columns. Match `date`, `description` and `amount` case-insensitively and ignoring surrounding spaces, in any order. Ignore extra columns. If one of the three is missing, that is an error (exit 1). The file is UTF-8, possibly with a byte-order mark.

**What happens with a broken row?**
Skip it, list it in `skipped_rows` with its line number and the reason, and keep going. One bad row must not stop the summary. Completely empty lines are ignored silently (not listed). A row with a missing or empty date or amount is invalid; an empty description is fine (it is just uncategorised).

## Categories

**How do keywords match?**
Case-insensitively, as whole words: `rent` matches "RENT January" and "rent-payment" but not "Parent" or "Current". A keyword may contain several words (`whole foods`).

**What if two rules match?**
The first rule in the file wins.

**What if the config file is missing?**
If I didn't pass `--config` and `categories.toml` doesn't exist, still produce the summary with everything uncategorised and print a warning (also listed in `warnings`). If I passed `--config` with a path that doesn't exist or isn't valid, that's an error (exit 1).

**Should the tool ship a starter config?**
Yes, a `categories.toml` example in the project with a few typical rules is helpful.

## Summary

**What counts as income and spending?**
Positive amounts are income, negative amounts are spending. Refunds are just income; don't try to net them.

**Can "uncategorised" be one of the five largest expense categories?**
Yes, it is a category like the others.

**How are ties and short months handled?**
Sort categories by amount, largest first; equal amounts in alphabetical order of category name. If a month has fewer than five expense categories, show the ones it has. A month with only income has an empty category list.

**Several years of data?**
Each calendar month separately (`2023-01` and `2024-01` are different months), oldest first. Months without transactions are not shown.

**Precision?**
Exact decimal arithmetic, rounded to two decimals only for output.
