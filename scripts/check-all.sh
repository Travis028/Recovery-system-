#!/usr/bin/env bash
# LDRS v6 — run every automated check. From the project root:  bash scripts/check-all.sh
# Read-only for the database. Needs `npm ci` done once in backend/ and frontend/.
set -uo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
fails=0
step() { printf '\n=== %s ===\n' "$1"; }
run() { if "$@"; then echo "OK"; else echo "FAILED: $*"; fails=$((fails+1)); fi; }

cd "$ROOT/backend"
step "backend: syntax";        run npm run -s check
step "backend: unit tests";    run npm test --silent
step "backend: database (read-only)"; run npm run -s check:db
step "backend: running API (skipped if not started)"
if curl -s -o /dev/null http://127.0.0.1:4001/api/v6/health; then run npm run -s smoke; else echo "backend not running — start it with: cd backend && npm start"; fi

cd "$ROOT/frontend"
step "frontend: unit tests";   run npm test --silent
step "frontend: lint";         run npm run -s lint
step "frontend: build";        run npm run -s build

printf '\n%s\n' "$([ $fails -eq 0 ] && echo 'ALL CHECKS PASSED' || echo "$fails CHECK(S) FAILED")"
exit $fails
