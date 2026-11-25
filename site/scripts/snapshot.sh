#!/usr/bin/env bash
# Writes site/data/github.json from one read-only gh call. The page draws from this snapshot only.
# If the call fails the old file stays in place. A value the API does not return stays null.
set -euo pipefail
repo="${OP_REPO:-hmrdkn-labs/open-pajak}"
out="$(cd "$(dirname "$0")/.." && pwd)/data/github.json"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

meta="$(gh api "repos/$repo")"

jq -n --arg repo "$repo" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson meta "$meta" '{
  generated_at: $at,
  repo: $repo,
  stars: $meta.stargazers_count,
  forks: $meta.forks_count,
  pushed_at: $meta.pushed_at,
  default_branch: $meta.default_branch,
  license: ($meta.license.spdx_id // null)
}' > "$tmp"
jq -e '.generated_at and .repo and .stars != null' "$tmp" > /dev/null
mv "$tmp" "$out"
echo "wrote $out"
