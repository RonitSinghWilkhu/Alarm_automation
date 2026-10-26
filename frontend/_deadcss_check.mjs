import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const cssPath = path.join(root, "src", "styles", "style.css");

// Collect source files (jsx/js/html), excluding the css itself.
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(jsx|js|tsx|ts|html)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const srcFiles = [
  ...walk(path.join(root, "src")),
  ...(fs.existsSync(path.join(root, "index.html")) ? [path.join(root, "index.html")] : []),
];

// Gather every identifier-like token used in source (covers template
// literals, conditional className strings, etc.)
const usedTokens = new Set();
for (const f of srcFiles) {
  const txt = fs.readFileSync(f, "utf8");
  for (const m of txt.matchAll(/[A-Za-z0-9_-]+/g)) usedTokens.add(m[0]);
}

// Extract class selectors from CSS.
const css = fs.readFileSync(cssPath, "utf8");
// strip comments
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const classNames = new Set();
for (const m of noComments.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) {
  classNames.add(m[1]);
}

const unused = [...classNames].filter((c) => !usedTokens.has(c)).sort();
console.log("Total distinct class selectors:", classNames.size);
console.log("Candidate UNUSED classes (name never appears in source):", unused.length);
console.log(JSON.stringify(unused, null, 2));
