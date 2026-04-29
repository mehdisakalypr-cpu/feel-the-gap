#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const declared = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
]);

let aliasPrefixes = [];
try {
  const raw = fs.readFileSync(path.join(ROOT, "tsconfig.json"), "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // jsonc tolerant: walk char-by-char, skip comments outside strings
    let out = "", i = 0, inStr = false, q = "";
    while (i < raw.length) {
      const c = raw[i], n = raw[i + 1];
      if (inStr) {
        if (c === "\\" && i + 1 < raw.length) { out += c + n; i += 2; continue; }
        if (c === q) inStr = false;
        out += c; i++; continue;
      }
      if (c === '"' || c === "'") { inStr = true; q = c; out += c; i++; continue; }
      if (c === "/" && n === "/") { while (i < raw.length && raw[i] !== "\n") i++; continue; }
      if (c === "/" && n === "*") { i += 2; while (i < raw.length - 1 && !(raw[i] === "*" && raw[i + 1] === "/")) i++; i += 2; continue; }
      out += c; i++;
    }
    parsed = JSON.parse(out);
  }
  const paths = parsed.compilerOptions && parsed.compilerOptions.paths;
  if (paths) for (const k of Object.keys(paths)) aliasPrefixes.push(k.replace(/\*$/, ""));
} catch (_) {}

const NODE_BUILTINS = new Set("fs fs/promises path os crypto http https stream stream/web stream/promises url util child_process events buffer querystring zlib net tls dns tty assert cluster module perf_hooks process readline repl string_decoder timers v8 vm worker_threads async_hooks constants dgram domain punycode sys trace_events test".split(" "));
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", ".vercel", ".turbo", "coverage", "out", ".cache"]);
const SKIP_FILE = /\.(d\.ts|test\.[tj]sx?|spec\.[tj]sx?)$/;
const FILE_EXT = /\.(tsx?|jsx?|mjs|cjs)$/;

// Skip files outside the Next.js bundle graph or with template-literal imports
const SKIP_FILE_PREFIXES = ["scripts/", "app/docs/api/"];

function walk(dir, acc) {
  let names;
  try { names = fs.readdirSync(dir); } catch { return acc; }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, acc);
    else if (FILE_EXT.test(name) && !SKIP_FILE.test(name)) {
      const rel = path.relative(ROOT, full);
      if (SKIP_FILE_PREFIXES.some(p => rel.startsWith(p))) continue;
      acc.push(full);
    }
  }
  return acc;
}

// Skip `import type ...` (TS-only, stripped at build, not bundled at runtime)
const RE = /(?:^|[^.\w])import\s+(?!type\s)(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|(?:^|[^.\w])import\s+['"]([^'"]+)['"]|(?:^|[^.\w])require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function pkgOf(spec) {
  if (!spec) return null;
  if (spec.startsWith(".") || spec.startsWith("/")) return null;
  if (spec.startsWith("node:")) return null;
  const head = spec.split("/")[0];
  if (NODE_BUILTINS.has(spec) || NODE_BUILTINS.has(head)) return null;
  for (const p of aliasPrefixes) if (spec.startsWith(p)) return null;
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    if (parts.length < 2) return null;
    return parts[0] + "/" + parts[1];
  }
  return head;
}

const files = walk(ROOT, []);
const missing = new Map();
for (const f of files) {
  let txt;
  try { txt = fs.readFileSync(f, "utf8"); } catch { continue; }
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(txt))) {
    const spec = m[1] || m[2] || m[3] || m[4];
    const p = pkgOf(spec);
    if (p && !declared.has(p)) {
      if (!missing.has(p)) missing.set(p, new Set());
      missing.get(p).add(path.relative(ROOT, f));
    }
  }
}

if (missing.size === 0) {
  console.log("✓ check-imports: " + files.length + " files OK, all imports declared in package.json");
  process.exit(0);
}
console.error("❌ check-imports: " + missing.size + " package(s) imported but NOT in package.json:");
for (const [name, set] of missing) {
  const arr = [...set].slice(0, 3);
  console.error("  • " + name);
  for (const f of arr) console.error("      " + f);
  if (set.size > 3) console.error("      +" + (set.size - 3) + " more");
}
console.error("\n  Fix : npm install " + [...missing.keys()].join(" "));
console.error("  Then commit package.json + package-lock.json before pushing.");
process.exit(1);
