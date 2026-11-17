# Interface contract: banksummary

This contract fixes only how the tool is invoked and how its machine-readable output looks, so that it can be tested automatically. It does not decide behaviour beyond that.

## Project layout and installation

- The project root contains an executable file named `banksummary` (with a `#!/usr/bin/env python3` shebang or a shell wrapper) that runs the tool.
- Python 3.11 or newer.
- If the tool needs third-party packages, list them in `requirements.txt` in the project root. They are installed with `pip install -r requirements.txt` into a virtual environment before the tool is run.

## Invocation

```
banksummary <csv-file> [--config <rules-file>] [--format text|json]
```

- `<csv-file>`: path to the transactions file. The file has a header row naming the columns `date`, `description` and `amount`.
- `--config <rules-file>`: path to the category rules file. If omitted, the tool uses `categories.toml` in the current working directory.
- `--format`: `text` (default, human-readable, layout is up to you) or `json` (see below).

## Rules file format (TOML)

```toml
[[rules]]
category = "Groceries"
keywords = ["tesco", "lidl", "whole foods"]

[[rules]]
category = "Housing"
keywords = ["rent", "mortgage"]
```

## JSON output (`--format json`)

Written to standard output as a single JSON object:

```json
{
  "months": [
    {
      "month": "2024-01",
      "income": "3000.00",
      "spending": "1287.19",
      "top_categories": [
        {"category": "Housing", "amount": "1200.00"},
        {"category": "Groceries", "amount": "54.20"}
      ]
    }
  ],
  "skipped_rows": [
    {"line": 7, "reason": "unrecognised date '2024-13-01'"}
  ],
  "warnings": []
}
```

- `month`: `YYYY-MM`.
- `income`, `spending` and `amount`: decimal strings with exactly two decimals. `spending` and category amounts are positive numbers (the size of the expense).
- `top_categories`: the largest expense categories of that month, largest first, at most five.
- `skipped_rows`: input rows that were not included in the summary, with the 1-based line number in the file (the header is line 1) and a short reason. Empty list if none.
- `warnings`: free-text warnings. Empty list if none.

## Exit status and errors

- `0`: a summary was produced.
- `1`: the tool could not produce a summary (for example the CSV file cannot be read). An error message goes to standard error.
- `2`: invalid command-line usage.

Error and warning messages go to standard error; standard output contains only the summary.
