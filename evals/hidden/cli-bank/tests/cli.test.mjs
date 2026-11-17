// Hidden black-box acceptance tests for evals/specs/cli-bank. Test names start with the REQ ids they check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RULES, run, runJson, month, money, cats } from "./helpers.mjs";

const BASIC = `date,description,amount
2024-01-01,Salary,3000.00
2024-01-03,TESCO STORES 123,-54.20
2024-01-05,Netflix,-12.99
2024-01-09,Rent January,-1200.00
2024-01-12,Mystery vendor,-20.00
2024-02-01,Salary,3000.00
2024-02-04,Uber trip,-18.50
`;

// ---------- summary basics ----------

test("REQ-13 REQ-14 REQ-15 REQ-17: basic monthly summary in JSON", () => {
  const { json } = runJson(BASIC);
  assert.deepEqual(json.months.map((m) => m.month), ["2024-01", "2024-02"]);
  const jan = month(json, "2024-01");
  money(jan.income, "3000.00", "Jan income");
  money(jan.spending, "1287.19", "Jan spending");
  assert.deepEqual(cats(jan), [
    ["Housing", "1200.00"],
    ["Groceries", "54.20"],
    ["uncategorised", "32.99"],
  ]);
  const feb = month(json, "2024-02");
  money(feb.spending, "18.50", "Feb spending");
  assert.deepEqual(cats(feb), [["Transport", "18.50"]]);
  assert.deepEqual(json.skipped_rows, []);
});

test("REQ-17: text format is the default and names each month", () => {
  const r = run(["tx.csv", "--config", "rules.toml"], { "tx.csv": BASIC, "rules.toml": RULES });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /2024-01/);
  assert.match(r.stdout, /2024-02/);
});

test("REQ-18: missing arguments is a usage error (exit 2)", () => {
  const r = run([]);
  assert.equal(r.code, 2);
});

// ---------- input format ----------

test("REQ-1: columns in any order, any case, with extra columns", () => {
  const { json } = runJson(` Amount ;Account;DATE;Description
-10.00;FI12;2024-03-02;Tesco
25.00;FI12;2024-03-03;Gift
`.replace(/;/g, ","));
  const m = month(json, "2024-03");
  money(m.income, "25.00", "income");
  assert.deepEqual(cats(m), [["Groceries", "10.00"]]);
});

test("REQ-1: UTF-8 byte-order mark before the header", () => {
  const { json } = runJson("﻿date,description,amount\n2024-03-02,Tesco,-10.00\n");
  assert.deepEqual(cats(month(json, "2024-03")), [["Groceries", "10.00"]]);
});

test("REQ-2 REQ-3: semicolon-separated file with decimal commas", () => {
  const { json } = runJson(`date;description;amount
2024-01-03;Tesco;-54,20
2024-01-04;Salary;2500,00
`);
  const m = month(json, "2024-01");
  money(m.income, "2500.00", "income");
  money(m.spending, "54.20", "spending");
});

test("REQ-2: quoted fields may contain the separator", () => {
  const { json } = runJson(`date,description,amount
2024-01-03,"Tesco, Main Street",-10.00
2024-01-04,"Refund, shoes","1,234.50"
`);
  const m = month(json, "2024-01");
  assert.deepEqual(cats(m), [["Groceries", "10.00"]]);
  money(m.income, "1234.50", "income");
});

test("REQ-3: decimal comma in a comma-separated file (quoted)", () => {
  const { json } = runJson(`date,description,amount
2024-01-03,Tesco,"-54,20"
2024-01-04,Salary,"3000,00"
`);
  const m = month(json, "2024-01");
  money(m.spending, "54.20", "spending");
  money(m.income, "3000.00", "income");
});

test("REQ-3: thousands separators in several styles", () => {
  const { json } = runJson(`date;description;amount
2024-01-01;A;1.234,56
2024-01-02;B;1,234.56
2024-01-03;C;1 234,56
2024-01-04;D;1234.56
`);
  money(month(json, "2024-01").income, "4938.24", "income");
});

test("REQ-3: a comma followed by three digits is a thousands separator", () => {
  const { json } = runJson(`date;description;amount
2024-01-01;A;1,234
`);
  money(month(json, "2024-01").income, "1234.00", "income");
});

test("REQ-3: currency symbols are ignored", () => {
  const { json } = runJson(`date;description;amount
2024-01-01;Tesco;-12,50 €
2024-01-02;Tesco;€-7.50
2024-01-03;Salary;$100.00
`);
  const m = month(json, "2024-01");
  money(m.spending, "20.00", "spending");
  money(m.income, "100.00", "income");
});

test("REQ-4: DD.MM.YYYY and DD/MM/YYYY are day-first", () => {
  const { json } = runJson(`date,description,amount
03.04.2024,Tesco,-1.00
05/06/2024,Tesco,-2.00
2024-07-08,Tesco,-3.00
`);
  assert.deepEqual(json.months.map((m) => m.month), ["2024-04", "2024-06", "2024-07"]);
  assert.deepEqual(json.skipped_rows, []);
});

test("REQ-4 REQ-5: US month-first date is rejected and reported, not reinterpreted", () => {
  const { json } = runJson(`date,description,amount
2024-03-01,Tesco,-1.00
03/14/2024,Tesco,-2.00
`);
  assert.deepEqual(json.months.map((m) => m.month), ["2024-03"]);
  money(month(json, "2024-03").spending, "1.00", "spending");
  assert.deepEqual(json.skipped_rows.map((s) => s.line), [3]);
});

test("REQ-4 REQ-5: impossible date is reported", () => {
  const { json } = runJson(`date,description,amount
2024-02-30,Tesco,-2.00
2024-02-28,Tesco,-1.00
`);
  assert.deepEqual(json.skipped_rows.map((s) => s.line), [2]);
  money(month(json, "2024-02").spending, "1.00", "spending");
});

test("REQ-5: unparseable amount is skipped with its line number; the rest is summarised", () => {
  const r = runJson(`date,description,amount
2024-01-01,Salary,100.00
2024-01-02,Tesco,abc
2024-01-03,Tesco,-5.00
`);
  assert.equal(r.code, 0);
  assert.deepEqual(r.json.skipped_rows.map((s) => s.line), [3]);
  assert.equal(typeof r.json.skipped_rows[0].reason, "string");
  const m = month(r.json, "2024-01");
  money(m.income, "100.00", "income");
  money(m.spending, "5.00", "spending");
});

test("REQ-5: empty lines are ignored silently and line numbers stay physical", () => {
  const { json } = runJson(`date,description,amount
2024-01-01,Salary,100.00

2024-01-02,Tesco,-5.00

2024-01-03,Tesco,oops
`);
  // line 1 header, 2 salary, 3 empty, 4 tesco, 5 empty, 6 bad
  assert.deepEqual(json.skipped_rows.map((s) => s.line), [6]);
  money(month(json, "2024-01").spending, "5.00", "spending");
});

test("REQ-5: a row with the wrong number of fields is skipped", () => {
  const { json } = runJson(`date,description,amount
2024-01-01,Tesco
2024-01-02,Tesco,-5.00
`);
  assert.deepEqual(json.skipped_rows.map((s) => s.line), [2]);
  money(month(json, "2024-01").spending, "5.00", "spending");
});

test("REQ-5: empty amount or date is invalid; empty description is valid", () => {
  const { json } = runJson(`date,description,amount
2024-01-01,Tesco,
,Tesco,-3.00
2024-01-03,,-7.00
`);
  assert.deepEqual(json.skipped_rows.map((s) => s.line).sort(), [2, 3]);
  assert.deepEqual(cats(month(json, "2024-01")), [["uncategorised", "7.00"]]);
});

test("REQ-6: unreadable CSV file exits 1 with an error message", () => {
  const r = run(["missing.csv", "--config", "rules.toml"], { "rules.toml": RULES });
  assert.equal(r.code, 1);
  assert.ok(r.stderr.trim().length > 0, "no error message on stderr");
});

test("REQ-6: a missing required column exits 1", () => {
  const r = run(["tx.csv", "--config", "rules.toml"], { "tx.csv": "date,amount\n2024-01-01,-5\n", "rules.toml": RULES });
  assert.equal(r.code, 1);
  assert.ok(r.stderr.trim().length > 0, "no error message on stderr");
});

// ---------- categories ----------

test("REQ-7: categories.toml in the working directory is the default", () => {
  const { json } = runJson("date,description,amount\n2024-01-01,Coffee shop,-4.00\n", {
    rules: null,
    files: { "categories.toml": '[[rules]]\ncategory = "Cafe"\nkeywords = ["coffee"]\n' },
  });
  assert.deepEqual(cats(month(json, "2024-01")), [["Cafe", "4.00"]]);
});

test("REQ-7: --config selects another rules file", () => {
  const { json } = runJson("date,description,amount\n2024-01-01,Coffee shop,-4.00\n", {
    rules: '[[rules]]\ncategory = "Cafe"\nkeywords = ["coffee"]\n',
    files: { "categories.toml": '[[rules]]\ncategory = "Wrong"\nkeywords = ["coffee"]\n' },
  });
  assert.deepEqual(cats(month(json, "2024-01")), [["Cafe", "4.00"]]);
});

test("REQ-8: keywords match whole words, case-insensitively", () => {
  const { json } = runJson(`date,description,amount
2024-01-01,RENT January,-100.00
2024-01-02,rent-payment,-200.00
2024-01-03,Parent teacher fund,-1.00
2024-01-04,Current account fee,-2.00
2024-01-05,Torrential rain gear,-4.00
`);
  assert.deepEqual(cats(month(json, "2024-01")), [
    ["Housing", "300.00"],
    ["uncategorised", "7.00"],
  ]);
});

test("REQ-8: multi-word keywords match as a phrase", () => {
  const { json } = runJson(`date,description,amount
2024-01-01,WHOLE FOODS MARKET,-10.00
2024-01-02,Wholesale foods,-3.00
`);
  assert.deepEqual(cats(month(json, "2024-01")), [
    ["Groceries", "10.00"],
    ["uncategorised", "3.00"],
  ]);
});

test("REQ-9: the first matching rule in file order wins", () => {
  const rules = `[[rules]]
category = "Travel"
keywords = ["train"]

[[rules]]
category = "Food"
keywords = ["snack", "train"]
`;
  const { json } = runJson("date,description,amount\n2024-01-01,Train snack bar,-6.00\n", { rules });
  assert.deepEqual(cats(month(json, "2024-01")), [["Travel", "6.00"]]);
});

test("REQ-10: missing default rules file still gives a summary with a warning", () => {
  const { json, stderr } = runJson("date,description,amount\n2024-01-01,Tesco,-5.00\n", { rules: null });
  assert.deepEqual(cats(month(json, "2024-01")), [["uncategorised", "5.00"]]);
  assert.ok(Array.isArray(json.warnings) && json.warnings.length > 0, "warnings list is empty");
  assert.ok(stderr.trim().length > 0, "no warning on stderr");
});

test("REQ-11: --config pointing to a missing file exits 1", () => {
  const r = run(["tx.csv", "--config", "nope.toml"], { "tx.csv": BASIC });
  assert.equal(r.code, 1);
  assert.ok(r.stderr.trim().length > 0, "no error message on stderr");
});

test("REQ-11: an invalid rules file exits 1", () => {
  const r = run(["tx.csv", "--config", "rules.toml"], { "tx.csv": BASIC, "rules.toml": "[[rules]\ncategory = \n" });
  assert.equal(r.code, 1);
});

test("REQ-12: the project ships an example categories.toml that is a valid rules file", () => {
  const example = join(process.env.IMPL_DIR, "categories.toml");
  assert.ok(existsSync(example), "no categories.toml in the project root");
  const { json } = runJson("date,description,amount\n2024-01-01,Something,-1.00\n", { rules: null, extraArgs: ["--config", example] });
  assert.deepEqual(json.months.map((m) => m.month), ["2024-01"]);
});

// ---------- summary rules ----------

test("REQ-13: several years are separate months, oldest first, empty months omitted", () => {
  const { json } = runJson(`date,description,amount
2024-01-05,Tesco,-20.00
2023-12-30,Tesco,-5.00
2023-01-05,Tesco,-10.00
`);
  assert.deepEqual(json.months.map((m) => m.month), ["2023-01", "2023-12", "2024-01"]);
  money(month(json, "2023-01").spending, "10.00", "2023-01 spending");
  money(month(json, "2024-01").spending, "20.00", "2024-01 spending");
});

test("REQ-14: positive refunds are income, not reduced spending", () => {
  const { json } = runJson(`date,description,amount
2024-01-01,Tesco,-50.00
2024-01-02,Tesco refund,20.00
`);
  const m = month(json, "2024-01");
  money(m.income, "20.00", "income");
  money(m.spending, "50.00", "spending");
  assert.deepEqual(cats(m), [["Groceries", "50.00"]]);
});

test("REQ-15: at most five categories, largest first, ties alphabetical", () => {
  const rules = ["A", "B", "C", "D", "E", "F", "G"].map((c) => `[[rules]]\ncategory = "${c}"\nkeywords = ["${c.toLowerCase()}x"]\n`).join("\n");
  const { json } = runJson(`date,description,amount
2024-01-01,ax,-10.00
2024-01-01,bx,-30.00
2024-01-01,dx,-20.00
2024-01-01,cx,-20.00
2024-01-01,ex,-5.00
2024-01-01,fx,-40.00
2024-01-01,gx,-1.00
`, { rules });
  assert.deepEqual(cats(month(json, "2024-01")), [
    ["F", "40.00"],
    ["B", "30.00"],
    ["C", "20.00"],
    ["D", "20.00"],
    ["A", "10.00"],
  ]);
});

test("REQ-15: uncategorised competes for the top five", () => {
  const { json } = runJson(`date,description,amount
2024-01-01,Tesco,-5.00
2024-01-02,Something,-500.00
`);
  assert.deepEqual(cats(month(json, "2024-01")), [
    ["uncategorised", "500.00"],
    ["Groceries", "5.00"],
  ]);
});

test("REQ-15: a month with only income has an empty category list", () => {
  const { json } = runJson("date,description,amount\n2024-05-01,Salary,100.00\n");
  const m = month(json, "2024-05");
  assert.deepEqual(m.top_categories, []);
  money(m.spending, "0.00", "spending");
});

test("REQ-16: arithmetic is exact and output has two decimals", () => {
  // inputs with one and zero decimals: output must still have exactly two
  const rows = Array.from({ length: 30 }, (_, i) => `2024-01-${String((i % 28) + 1).padStart(2, "0")},Tesco,-0.1`).join("\n");
  const { json } = runJson(`date,description,amount\n${rows}\n2024-01-01,Salary,100\n2024-01-01,Bonus,0.2\n`);
  const m = month(json, "2024-01");
  money(m.spending, "3.00", "spending");
  money(m.income, "100.20", "income");
  assert.deepEqual(cats(m), [["Groceries", "3.00"]]);
});
