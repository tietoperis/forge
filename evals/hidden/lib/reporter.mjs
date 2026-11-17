// node:test reporter that emits one JSON line per finished test (leaf tests only).
export default async function* jsonLines(source) {
  for await (const event of source) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    const d = event.data;
    if (d.details?.type === "suite") continue;
    const err = d.details?.error;
    yield JSON.stringify({
      name: d.name,
      file: d.file,
      status: event.type === "test:pass" ? (d.skip ? "skipped" : "passed") : "failed",
      durationMs: Math.round(d.details?.duration_ms ?? 0),
      error: err ? String(err.cause?.message ?? err.message ?? err).slice(0, 2000) : undefined,
    }) + "\n";
  }
}
