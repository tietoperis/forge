#!/usr/bin/env bash
# Run one K1 prompt with plain Claude Code (branch A) in the isolated runner container.
#
#   evals/k1/run.sh P1                  # first run with the prompt from evals/k1-prompts.md
#   evals/k1/run.sh P1 --answer "text"  # resume the same session with a short answer
#
# Token: put the output of `claude setup-token` in ~/.forge/oauth_token (chmod 600).
# The run directory ~/forge-runs/k1/<id>/work is the only project folder mounted.
set -euo pipefail

id="${1:?usage: run.sh P<n> [--answer text]}"
shift
answer=""
if [[ "${1:-}" == "--answer" ]]; then answer="${2:?missing answer}"; fi

repo="$(cd "$(dirname "$0")/../.." && pwd)"
token_file="${FORGE_TOKEN_FILE:-$HOME/.forge/oauth_token}"
[[ -s "$token_file" ]] || { echo "missing token file: $token_file" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker is not running" >&2; exit 1; }

run_root="$HOME/forge-runs/k1/$id"
work="$run_root/work"
cfg="$run_root/claude-config"
log_dir="$repo/evals/k1-runs/$id"
mkdir -p "$work" "$cfg" "$log_dir"

if [[ -z "$answer" ]]; then
  if [[ -n "$(ls -A "$work")" ]]; then echo "work dir not empty: $work" >&2; exit 1; fi
  # The prompt is the blockquote line under "### <id>:" in k1-prompts.md, used verbatim.
  prompt="$(awk -v id="$id" '
    $0 ~ "^### " id ":" {found=1; next}
    found && /^> / {sub(/^> /, ""); print; exit}' "$repo/evals/k1-prompts.md")"
  [[ -n "$prompt" ]] || { echo "prompt $id not found" >&2; exit 1; }
  printf '%s\n' "$prompt" > "$log_dir/prompt.txt"
  turn=1
  resume_args=()
  msg="$prompt"
else
  session_id="$(cat "$log_dir/session_id")"
  turn=$(( $(ls "$log_dir"/turn-*.jsonl | wc -l) + 1 ))
  printf 'turn %d answer: %s\n' "$turn" "$answer" >> "$log_dir/answers.txt"
  resume_args=(--resume "$session_id")
  msg="$answer"
fi

out="$log_dir/turn-$turn.jsonl"
start=$(date +%s)
CLAUDE_CODE_OAUTH_TOKEN="$(cat "$token_file")" \
docker run --rm -i \
  --name "forge-k1-$id" \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 6g --cpus 4 \
  -e CLAUDE_CODE_OAUTH_TOKEN \
  -e CLAUDE_CONFIG_DIR=/home/node/.claude-config \
  -v "$work:/work" \
  -v "$cfg:/home/node/.claude-config" \
  forge-eval-runner \
  claude -p "$msg" ${resume_args[@]+"${resume_args[@]}"} \
    --dangerously-skip-permissions \
    --output-format stream-json --verbose \
  > "$out" 2> "$log_dir/turn-$turn.stderr" || echo "claude exited non-zero" >&2
end=$(date +%s)

jq -r 'select(.type=="system" and .subtype=="init") | .session_id' "$out" | head -1 > "$log_dir/session_id.tmp" \
  && [[ -s "$log_dir/session_id.tmp" ]] && mv "$log_dir/session_id.tmp" "$log_dir/session_id" || rm -f "$log_dir/session_id.tmp"
jq -c 'select(.type=="result") | {turn: '"$turn"', duration_s: '"$((end-start))"', num_turns, is_error, subtype, usage, modelUsage}' "$out" >> "$log_dir/meta.jsonl" || true
echo "--- final message (turn $turn, $((end-start)) s) ---"
jq -r 'select(.type=="result") | .result' "$out"
