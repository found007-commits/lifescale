// Freezes a release baseline under tests/fixtures/ so the next delivery package can be
// checked against it. Two sets are recorded:
//
//   protectedFiles  runtime, policy, configuration, backend and database files, by SHA-256
//   markup          the binding contract of every template (expressions + non-visual
//                   attributes, with the presentation-only attributes stripped)
//
// The previous fixture's key list is the starting point, so a release only has to name
// what it adds. New paths are passed on the command line and invented nowhere, which keeps
// every protected file a reviewed decision.
//
//   node scripts/build-release-baseline.mjs 2.0.8 <commit-sha> [path ...]
//
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const [version, ref, ...additions] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || "")) throw new Error("usage: build-release-baseline.mjs <version> <commit-sha> [path ...]");
if (!/^[0-9a-f]{40}$/.test(ref || "")) throw new Error("the second argument must be the full commit sha the baseline describes");

const root = process.cwd();
const fixtures = "tests/fixtures";
// "2.0.8" -> ui-208-baseline.json, matching the existing 2.0.7 fixture name.
const target = path.join(fixtures, `ui-${version.split(".").join("")}-baseline.json`);

// The previous fixture is the highest other ui-*-baseline.json on disk.
const others = fs.readdirSync(fixtures).filter((name) => /^ui-\d+-baseline\.json$/.test(name) && path.join(fixtures, name) !== target).sort();
if (!others.length) throw new Error("no previous baseline to extend");
const previousPath = path.join(fixtures, others[others.length - 1]);
const previous = JSON.parse(fs.readFileSync(previousPath, "utf8"));

const sha = (source) => createHash("sha256").update(source).digest("hex");
function contract(source) {
  const expressions = [...source.matchAll(/\{\{([\s\S]*?)\}\}/g)].map((m) => m[1]).sort();
  const tags = [...source.matchAll(/<[a-z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g)]
    .map((m) => m[0].replace(/\s+(?:class|style|color|placeholder-style)="[^"]*"/g, "").replace(/\s+/g, " ").replace(/\s*\/?>$/, ">"))
    .filter((t) => t.slice(1, -1).trim().includes(" "));
  return sha(JSON.stringify({ expressions, tags }));
}

const protectedFiles = new Set(Object.keys(previous.protectedFiles));
const markup = new Set(Object.keys(previous.markup));
const added = { protectedFiles: [], markup: [] };
for (const file of additions) {
  if (protectedFiles.has(file) || markup.has(file)) throw new Error("already in a baseline: " + file);
  if (!fs.existsSync(path.join(root, file))) throw new Error("not found: " + file);
  const isMarkup = file.endsWith(".wxml");
  (isMarkup ? markup : protectedFiles).add(file);
  (isMarkup ? added.markup : added.protectedFiles).push(file);
}

const hash = (file) => sha(fs.readFileSync(path.join(root, file), "utf8"));
const fixture = {
  ref,
  protectedFiles: Object.fromEntries([...protectedFiles].sort().map((file) => [file, hash(file)])),
  markup: Object.fromEntries([...markup].sort().map((file) => [file, contract(fs.readFileSync(path.join(root, file), "utf8"))])),
};
fs.writeFileSync(target, JSON.stringify(fixture, null, 2) + "\n");

const moved = Object.entries(previous.protectedFiles).filter(([file, digest]) => fixture.protectedFiles[file] !== digest).map(([file]) => file);
const keptMarkup = Object.entries(previous.markup).filter(([file, digest]) => fixture.markup[file] === digest).length;
console.log(`wrote ${target}`);
console.log(`protectedFiles ${Object.keys(previous.protectedFiles).length} -> ${Object.keys(fixture.protectedFiles).length} (+${added.protectedFiles.length})`);
console.log(`markup ${Object.keys(previous.markup).length} -> ${Object.keys(fixture.markup).length} (+${added.markup.length})`);
if (added.protectedFiles.length) console.log("added to protectedFiles:\n  " + added.protectedFiles.join("\n  "));
if (added.markup.length) console.log("added to markup:\n  " + added.markup.join("\n  "));
console.log(`changed since ${others[others.length - 1]}:\n  ${moved.join("\n  ") || "(none)"}`);
console.log(`markup contracts identical to the previous release: ${keptMarkup}/${Object.keys(previous.markup).length}`);
