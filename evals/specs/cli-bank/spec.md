# Spec: banksummary

We are building a Python command-line tool, `banksummary`, that reads a CSV file of bank transactions and prints a monthly summary: total income, total spending and the five largest expense categories. Categories come from keyword rules in a TOML file that the user edits. We are not building a GUI, a database, currency conversion, budgeting or charts. We assume one currency per file and that the user runs the tool locally.

The interface contract in `interface.md` (invocation, rules file format, JSON output, exit codes) is part of this spec and is repeated at the end.

Size profile: S (one component, a few files, no UI, no persistent state).

## Requirements

### Input

- **REQ-1** (must) The tool reads a CSV file whose header names the columns `date`, `description` and `amount`, matched case-insensitively and ignoring surrounding spaces, in any order. Extra columns are ignored. The file is UTF-8, optionally with a byte-order mark.
- **REQ-2** (must) The field separator is `;` if the header row contains `;`, otherwise `,`. Fields may be quoted with `"`.
- **REQ-3** (must) Amounts accept `.` or `,` as the decimal separator and `.`, `,` or space as thousands separators: the last `.` or `,` followed by one or two digits is the decimal separator, all other separators are thousands separators. `1234.56`, `1234,56`, `1,234.56`, `1.234,56` and `1 234,56` all mean 1234.56; `1,234` means 1234. A leading `-` marks an expense. A currency symbol (`€`, `$`, `£`) is ignored.
- **REQ-4** (must) Dates are accepted as `YYYY-MM-DD`, `DD.MM.YYYY` and `DD/MM/YYYY` only. US `MM/DD/YYYY` and impossible dates make the row invalid.
- **REQ-5** (must) An invalid row (unparseable date or amount, missing or empty date or amount, wrong number of fields) is skipped and reported in `skipped_rows` with its 1-based line number (header = line 1) and a reason; processing continues. Completely empty lines are ignored without a report. An empty description is valid.
- **REQ-6** (must) If the CSV file cannot be read or a required column is missing, the tool exits with status 1 and an error message on standard error.

### Categories

- **REQ-7** (must) Rules come from a TOML file (`[[rules]]` with `category` and `keywords`). The default is `categories.toml` in the current working directory; `--config` selects another file.
- **REQ-8** (must) A keyword matches the description case-insensitively as a whole word or phrase: `rent` matches "RENT January" and "rent-payment", not "Parent" or "Current". Multi-word keywords are allowed.
- **REQ-9** (must) If several rules match, the first rule in file order wins. A description that matches no rule is categorised as `uncategorised`.
- **REQ-10** (must) If `--config` is not given and the default file does not exist, the summary is still produced with all expenses in `uncategorised`, and a warning is printed to standard error and listed in `warnings`.
- **REQ-11** (must) If `--config` points to a file that does not exist or is not a valid rules file, the tool exits with status 1 and an error message.
- **REQ-12** (should) The project ships an example `categories.toml` with a few typical rules.

### Summary

- **REQ-13** (must) Transactions are grouped by calendar month (`YYYY-MM`); months appear oldest first; months without transactions are not shown. Different years are different months.
- **REQ-14** (must) For each month: income is the sum of positive amounts; spending is the sum of the absolute values of negative amounts. Refunds are income.
- **REQ-15** (must) For each month, the top expense categories are the categories with the largest spending, at most five, largest first; ties are ordered alphabetically by category name. `uncategorised` competes like any other category. A month without expenses has an empty list.
- **REQ-16** (must) Arithmetic is exact (decimal); output amounts have exactly two decimals.
- **REQ-17** (must) `--format json` prints the JSON object defined in the interface contract; `--format text` (default) prints a human-readable summary that names each month as `YYYY-MM`.
- **REQ-18** (must) Exit status 0 when a summary was produced (even with skipped rows), 1 when it could not be produced, 2 for invalid usage.

### Quality

- **REQ-19** (must) The project includes automated tests.

## Interface contract

See `interface.md` in the same directory; it is binding.
