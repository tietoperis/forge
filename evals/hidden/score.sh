#!/usr/bin/env bash
# Score one implementation against a hidden test suite in the isolated eval container.
#
#   evals/hidden/score.sh <spec> <implementation-dir> <result.json>
#
# The implementation is mounted read-only and copied inside the container, so the
# implementation directory is never modified and SQLite runs on the container's own disk.
set -euo pipefail
spec="${1:?usage: score.sh <spec> <impl-dir> <out.json>}"
impl="$(cd "${2:?missing impl dir}" && pwd)"
out="${3:?missing output file}"
here="$(cd "$(dirname "$0")" && pwd)"
[[ -d "$here/$spec/tests" ]] || { echo "unknown spec: $spec" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker is not running" >&2; exit 1; }
mkdir -p "$(dirname "$out")"
out_dir="$(cd "$(dirname "$out")" && pwd)"
docker run --rm \
  --cap-drop ALL --security-opt no-new-privileges --memory 4g --cpus 4 \
  -v "$impl:/src:ro" \
  -v "$here/$spec/tests:/hidden/tests:ro" \
  -v "$here/lib:/hidden/lib:ro" \
  -v "$out_dir:/out" \
  forge-eval-runner \
  node /hidden/lib/score.mjs --spec "$spec" --src /src --tests /hidden/tests --out "/out/$(basename "$out")"
