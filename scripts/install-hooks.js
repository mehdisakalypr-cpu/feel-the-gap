#!/usr/bin/env node
// Copies our pre-push hook to .git/hooks/pre-push so committer-email + import-check
// + build run before every push. Idempotent — safe to run on each `npm install`.
//
// Layer 0 (committer email) was added 2026-04-29 after Vercel blocked 4 deploys
// for "GitHub could not associate the committer". See feedback memory :
//   ~/.claude/projects/-root/memory/feedback_vercel_github_committer_lookup.md
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const gitDir = path.join(root, '.git');
if (!fs.existsSync(gitDir)) { console.log('install-hooks: not a git repo, skipping'); process.exit(0); }

const hookPath = path.join(gitDir, 'hooks', 'pre-push');
const body = `#!/bin/sh
# Auto-installed pre-push hook — durable Vercel deploy guard.
# Layer 0: committer email check (anti GitHub user attribution failure)
# Layer 1: import-check (fast, ~1s)
# Layer 2: next build (slow, ~30-60s)
# Bypass with: git push --no-verify  (NOT recommended — CI will still fail).
set -e
cd "$(git rev-parse --show-toplevel)"

# ---------------------------------------------------------------------------
# Layer 0 — committer email check
# Vercel blocks deploys when the committer email is not associated with a
# verified GitHub user. We refuse the push here to avoid the trip to Vercel.
# ---------------------------------------------------------------------------
COMMITTER_EMAIL=\$(git log -1 --format="%ae" HEAD)
case "\$COMMITTER_EMAIL" in
  mehdi.sakalypr@gmail.com|noreply@github.com|*@users.noreply.github.com)
    : ;;  # OK
  *)
    echo "❌ pre-push: committer email \\"\$COMMITTER_EMAIL\\" is not in the verified whitelist."
    echo "   Vercel will block this deploy with: \\"GitHub could not associate the committer\\"."
    echo ""
    echo "   Fix : amend with verified email :"
    echo "     git commit --amend --author=\\"Mehdi Sakaly <mehdi.sakalypr@gmail.com>\\" --no-edit"
    echo "   Then re-push (force-with-lease if already pushed)."
    exit 1
    ;;
esac
echo "▶ pre-push: layer 0 — committer email OK (\$COMMITTER_EMAIL)"

# ---------------------------------------------------------------------------
# Layer 1 — imports check
# ---------------------------------------------------------------------------
if [ -f scripts/check-imports.js ]; then
  echo "▶ pre-push: layer 1 — import-check..."
  node scripts/check-imports.js
fi

# ---------------------------------------------------------------------------
# Layer 2 — full Next.js build
# ---------------------------------------------------------------------------
if grep -q "\\"build\\"" package.json 2>/dev/null && [ -z "\$SKIP_BUILD_CHECK" ]; then
  echo "▶ pre-push: layer 2 — npm run build (set SKIP_BUILD_CHECK=1 to skip)..."
  npm run build --silent || { echo "❌ pre-push: build failed — fix before pushing"; exit 1; }
fi

echo "✅ pre-push: all layers passed"
`;

fs.writeFileSync(hookPath, body, { mode: 0o755 });
console.log('install-hooks: installed', hookPath);
