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
// The parent fixture is the release immediately before the one being written, compared as
// numbers rather than as file names, and a parent that is not the immediate predecessor is a
// hard error. The name sort cannot be trusted once a patch number passes 9: as text
// "ui-2010-baseline.json" sorts before "ui-207-baseline.json", so 2.0.11 would silently
// inherit its watch list from 2.0.9 and lose everything 2.0.10 had added.
//
//   node scripts/build-release-baseline.mjs 2.1.0 <commit-sha> --allow-version-gap
//
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const [version, ref, ...additions] = args.filter((arg) => !arg.startsWith("--"));
if (!/^\d+\.\d+\.\d+$/.test(version || "")) throw new Error("usage: build-release-baseline.mjs <version> <commit-sha> [path ...]");
if (!/^[0-9a-f]{40}$/.test(ref || "")) throw new Error("the second argument must be the full commit sha the baseline describes");

const root = process.cwd();
const fixtures = "tests/fixtures";
// "2.0.8" -> ui-208-baseline.json, matching the existing 2.0.7 fixture name.
const target = path.join(fixtures, `ui-${version.split(".").join("")}-baseline.json`);

// The previous fixture is the highest numbered one that is strictly older than this release.
// Compare the numbers, not the file names: as text "ui-2010-baseline.json" sorts BEFORE
// "ui-207-baseline.json", so a plain string sort picks 2.0.9 as the parent of 2.0.11 and
// quietly drops every file 2.0.10 had added from the watch list.
const numeric = (name) => Number(/^ui-(\d+)-baseline\.json$/.exec(name)[1]);
const others = fs.readdirSync(fixtures)
  .filter((name) => /^ui-\d+-baseline\.json$/.test(name) && path.join(fixtures, name) !== target)
  .map((name) => ({ name, version: numeric(name) }))
  .filter((entry) => entry.version < numeric(path.basename(target)))
  .sort((a, b) => a.version - b.version);
if (!others.length) throw new Error("no earlier baseline to extend");
const previousName = others[others.length - 1].name;
const previous = JSON.parse(fs.readFileSync(path.join(fixtures, previousName), "utf8"));

// The parent has to be the release immediately before this one, not merely the newest older
// fixture the name sort happened to surface. This is the check that would have caught the
// bug above: for 2.0.11 the parent must be 2.0.10, and anything else is a loud failure rather
// than a baseline that comes out quietly shorter than the one before it.
// A patch of 0 cannot know the previous patch number, so a gap is allowed there.
const [major, minor, patch] = version.split(".").map(Number);
if (patch > 0) {
  const expectedVersion = Number([major, minor, patch - 1].join(""));
  if (others[others.length - 1].version !== expectedVersion && !flags.has("--allow-version-gap")) {
    throw new Error(
      `the parent fixture should be ${major}.${minor}.${patch - 1} (ui-${expectedVersion}-baseline.json), ` +
      `but the newest older fixture on disk is version ${others[others.length - 1].version}. ` +
      `Pass --allow-version-gap if the versions in between were never released.`);
  }
}

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

// Protection is only ever widened here, because the watch list starts as a copy of the parent
// and files are only added. A release that genuinely needs to drop a file has to edit the
// fixture by hand and say why, which is the point: the loss should not be something a script
// does on its own.
fs.writeFileSync(target, JSON.stringify(fixture, null, 2) + "\n");
const moved = Object.entries(previous.protectedFiles).filter(([file, digest]) => fixture.protectedFiles[file] !== digest).map(([file]) => file);
const keptMarkup = Object.entries(previous.markup).filter(([file, digest]) => fixture.markup[file] === digest).length;
console.log(`wrote ${target}`);
console.log(`inherited from ${previousName} (${others[others.length - 1].version})`);
console.log(`protectedFiles ${Object.keys(previous.protectedFiles).length} -> ${Object.keys(fixture.protectedFiles).length} (+${added.protectedFiles.length})`);
console.log(`markup ${Object.keys(previous.markup).length} -> ${Object.keys(fixture.markup).length} (+${added.markup.length})`);
if (added.protectedFiles.length) console.log("added to protectedFiles:\n  " + added.protectedFiles.join("\n  "));
if (added.markup.length) console.log("added to markup:\n  " + added.markup.join("\n  "));
console.log(`changed since ${previousName}:\n  ${moved.join("\n  ") || "(none)"}`);
console.log(`markup contracts identical to the previous release: ${keptMarkup}/${Object.keys(previous.markup).length}`);
