import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const readRoot = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const wxss = readRoot("miniprogram/pages/index/index.wxss");

// 2.0.16: the sign-in entry used to be a hairline outline at 22% opacity on the cream page —
// practically invisible. It must now be a filled control in both colour schemes.
const baseRule = wxss.slice(0, wxss.indexOf("@media"));

test("the sign-in button is a filled control, not a faded outline", () => {
  assert.ok(baseRule.includes(".mini-login"), "the selector must still exist");
  assert.match(baseRule, /\.mini-login\s*\{[^}]*background:\s*#123f31/, "light scheme fills with the brand green");
  assert.doesNotMatch(baseRule, /\.mini-login\s*\{[^}]*background:\s*transparent/, "no transparent background may come back");
  assert.doesNotMatch(baseRule, /\.mini-login\s*\{[^}]*border:\s*2rpx solid/, "the hairline outline is gone");
});

test("the dark scheme paints its own fill; the override is not dead code", () => {
  const dark = wxss.slice(wxss.indexOf("@media"));
  assert.match(dark, /\.mini-login\s*\{[^}]*background:\s*#3f7359/, "dark fills with the dark-scheme green");
  // Same trap 2.0.14 documented: an override placed before the base rule never wins.
  assert.ok(wxss.indexOf(".mini-login {") < wxss.lastIndexOf(".mini-login"), "the dark override must come after the base rule");
});

test("the button still opens the auth page", () => {
  const wxml = readRoot("miniprogram/pages/index/index.wxml");
  assert.match(wxml, /class="mini-login" bindtap="goLogin"/);
});

// ── What this release changed ────────────────────────────────────────────────────────────
const previous = JSON.parse(readRoot("tests/fixtures/ui-2015-baseline.json"));
const baseline = JSON.parse(readRoot("tests/fixtures/ui-2016-baseline.json"));
const release = JSON.parse(readRoot("miniprogram/package.json")).version === "2.0.16";
const { createHash } = await import("node:crypto");
const sha = source => createHash("sha256").update(source).digest("hex");

test("2.0.16 moves the mini program version to 2.0.16", { skip: !release }, () => {
  assert.equal(JSON.parse(readRoot("miniprogram/package.json")).version, "2.0.16");
});

test("2.0.16 changes no protected file and no markup contract", { skip: !release }, () => {
  const changed = Object.entries(previous.protectedFiles).filter(([file, hash]) => sha(readRoot(file)) !== hash).map(([file]) => file);
  assert.deepEqual(changed, [], "a style-only release must not touch watched files: " + changed.join(", "));
  assert.deepEqual(baseline.markup, previous.markup, "no template was rewritten");
});
