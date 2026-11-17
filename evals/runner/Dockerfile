# Eval runner: plain Claude Code runs (K1, branches A/B) and hidden-test scoring, isolated.
# Only the run directory is mounted; no host home, no Docker socket, not privileged.
FROM node:24-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv git ca-certificates sqlite3 ffmpeg jq \
 && rm -rf /var/lib/apt/lists/*

ARG CLAUDE_CODE_VERSION=2.1.311
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Run as the unprivileged "node" user (uid 1000) so bypass mode is not root.
USER node
WORKDIR /work
ENV IS_SANDBOX=1
