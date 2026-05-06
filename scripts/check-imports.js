#!/usr/bin/env node
// pre-push guard: verifies every npm import in tracked source files has a
// matching entry in package.json (deps / devDeps / peerDeps). Catches the
// recurring "Module not found: 'X'" Vercel build failures caused by adding
// an import without running `npm install <X>`.

const fs = require('fs');
const { execFileSync } = require('child_process');

let pkg;
try {
  pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
} catch {
  console.log('check-imports: no package.json, skipping');
  process.exit(0);
}

const deps = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
]);

const builtins = new Set([
  'fs', 'path', 'crypto', 'http', 'https', 'url', 'util', 'os',
  'child_process', 'stream', 'events', 'buffer', 'net', 'tls', 'dns',
  'zlib', 'querystring', 'assert', 'readline', 'string_decoder',
  'punycode', 'timers', 'tty', 'vm', 'worker_threads', 'cluster',
  'perf_hooks', 'process', 'module', 'console', 'inspector',
]);

let files;
try {
  const out = execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs'], { encoding: 'utf8' });
  files = out.split('\n').filter((f) =>
    f && !f.endsWith('.d.ts') && !f.includes('node_modules') && !f.includes('.next/') && !f.startsWith('dist/'),
  );
} catch {
  files = [];
}

const missing = new Map();

for (const f of files) {
  let content;
  try { content = fs.readFileSync(f, 'utf8'); } catch { continue; }

  const re = /(?:^|[\s;{(])(?:import\s+(?:[^'"]+\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const imp = m[1];
    if (imp.startsWith('.') || imp.startsWith('@/') || imp.startsWith('~/') || imp.startsWith('/')) continue;
    if (imp.startsWith('node:')) continue;
    if (imp.startsWith('bun:')) continue;
    if (imp.includes('${') || imp.includes('`')) continue;
    const root = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0];
    if (builtins.has(root)) continue;
    if (!deps.has(root)) {
      if (!missing.has(root)) missing.set(root, []);
      missing.get(root).push(f);
    }
  }
}

if (missing.size > 0) {
  console.error('\n❌ check-imports: ' + missing.size + ' missing dep(s) in package.json:\n');
  for (const [pkgName, usedIn] of missing) {
    console.error('   ' + pkgName + '  (used in ' + usedIn.length + ' file' + (usedIn.length > 1 ? 's' : '') + ', e.g. ' + usedIn[0] + ')');
  }
  console.error('\nFix: npm install ' + [...missing.keys()].join(' '));
  console.error('     git add package.json package-lock.json');
  console.error('     git commit --amend --no-edit  # or new commit\n');
  process.exit(1);
}

console.log('✅ check-imports: ' + files.length + ' src files, all imports resolve against package.json');
