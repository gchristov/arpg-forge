#!/bin/bash
set -euo pipefail

# Usage: scripts/merge-pr.sh <pr number>
#
# Merges a pull request once every required check has passed: squash, no commit description, admin override
# (main requires an approval a solo repo never gets), branch deleted. Then updates local main and deletes the
# local branch. Waits for the required checks to appear first, since right after a push GitHub hasn't listed
# them yet, and a merge then would skip them. Exits without merging if any required check fails.

PR=${1:?Usage: scripts/merge-pr.sh <pr number>}
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
BASE=$(gh pr view "$PR" --json baseRefName --jq .baseRefName)
BRANCH=$(gh pr view "$PR" --json headRefName --jq .headRefName)
REQUIRED=$(gh api "repos/$REPO/branches/$BASE/protection/required_status_checks" --jq '[.checks[].context] | join(" ")')

echo "Waiting for required checks on #$PR: $REQUIRED"
for attempt in $(seq 1 120); do
  STATES=$(gh pr checks "$PR" --json name,bucket --jq "[.[] | select(.name as \$n | \"$REQUIRED\" | split(\" \") | index(\$n))]")
  SEEN=$(jq 'length' <<< "$STATES")
  if jq -e 'any(.bucket == "fail" or .bucket == "cancel")' <<< "$STATES" > /dev/null; then
    echo "❌ A required check failed:"
    jq -r '.[] | "  \(.name): \(.bucket)"' <<< "$STATES"
    exit 1
  fi
  if [ "$SEEN" -ge "$(wc -w <<< "$REQUIRED")" ] && jq -e 'all(.bucket == "pass")' <<< "$STATES" > /dev/null; then
    break
  fi
  if [ "$attempt" -eq 120 ]; then
    echo "❌ Timed out waiting for required checks."
    exit 1
  fi
  sleep 10
done

echo "All required checks passed. Merging #$PR."
gh pr merge "$PR" --squash --admin --body "" --delete-branch
git switch -q "$BASE"
git pull -q
git branch -D "$BRANCH" 2>/dev/null || true
git log --oneline -1
