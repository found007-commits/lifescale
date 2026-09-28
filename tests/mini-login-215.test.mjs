import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const readRoot = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const wxss = readRoot("miniprogram/pages/index/index.wxss");
const wxml = readRoot("miniprogram/pages/index/index.wxml");

// 2.0.15 (this fold): the sign-in entry used to be a hairline outline at 22% opacity on the
// cream page — practically invisible. It must now be a filled control in both colour schemes,
// AND it must not live in the top nav where it crammed against the brand and the timer chip.
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

test("the sign-in entry has moved out of the top nav into the hero actions", () => {
  // The landing nav only carries the brand now; the timer chip is a sibling. The sign-in
  // button must not appear here — tommy called this one out: it got pushed under the timer
  // and stopped being a discoverable action.
  const navOpen = wxml.indexOf('<view class="landing-nav">');
  const navBlock = wxml.slice(navOpen, wxml.indexOf("</view>", navOpen));
  assert.doesNotMatch(navBlock, /class="mini-login"/, "the sign-in entry must not live in the top nav");

  // The button now lives inside a single hero-actions row, beside the primary CTA.
  const actions = wxml.match(/<view class="hero-actions">[\s\S]*?<\/view>/);
  assert.ok(actions, "the hero must wrap both buttons in a single hero-actions row");
  const primary = actions[0].indexOf('class="primary-button hero-button"');
  const signin = actions[0].indexOf('class="mini-login"');
  assert.ok(primary > -1, "the primary CTA must be inside hero-actions");
  assert.ok(signin > -1, "the sign-in entry must be inside hero-actions");
  assert.ok(primary < signin, "the primary CTA leads, the sign-in entry follows");
});

test("the button still opens the auth page", () => {
  assert.match(wxml, /class="mini-login" bindtap="goLogin"/);
});

// ── What this release changed ────────────────────────────────────────────────────────────
const previous = JSON.parse(readRoot("tests/fixtures/ui-2014-baseline.json"));
const baseline = JSON.parse(readRoot("tests/fixtures/ui-2015-baseline.json"));
const release = JSON.parse(readRoot("miniprogram/package.json")).version === "2.0.15";
const sha = source => createHash("sha256").update(source).digest("hex");
// Same binding-contract fingerprint as scripts/build-release-baseline.mjs: drop the
// presentation-only attributes, keep the expressions and the rest of the tag shape.
const contract = source => {
  const expressions = [...source.matchAll(/\{\{([\s\S]*?)\}\}/g)].map(m => m[1]).sort();
  const tags = [...source.matchAll(/<[a-z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g)]
    .map(m => m[0].replace(/\s+(?:class|style|color|placeholder-style)="[^"]*"/g, "").replace(/\s+/g, " ").replace(/\s*\/?>$/, ">"))
    .filter(t => t.slice(1, -1).trim().includes(" "));
  return sha(JSON.stringify({ expressions, tags }));
};

test("2.0.15 moves the mini program version to 2.0.15", { skip: !release }, () => {
  assert.equal(JSON.parse(readRoot("miniprogram/package.json")).version, "2.0.15");
});

test("2.0.15 changes no protected file in this fold and no markup contract", { skip: !release }, () => {
  // The sign-in style + position fold is layered onto the existing 2.0.15 bootstrap
  // baseline. The five files the bootstrap fold legitimately changed stay changed; nothing
  // else in the watch list may move.
  const changed = Object.entries(previous.protectedFiles).filter(([file, hash]) => sha(readRoot(file)) !== hash).map(([file]) => file).sort();
  assert.deepEqual(changed, [
    "app/components/Dashboard.tsx",
    "lib/supabase/client.ts",
    "miniprogram/app.js",
    "miniprogram/pages/dashboard/dashboard.js",
    "miniprogram/utils/supabase.js",
  ], "this fold adds no new protected changes on top of the bootstrap fold");

  // Markup contract: every page the contract watches must still match the baseline
  // fingerprint. The bootstrap fold rewrote dashboard.wxml and recorded the reason in
  // the fixture; this fold must not rewrite any other watched template.
  const drifted = Object.entries(baseline.markup).filter(([file, hash]) => contract(readRoot(file)) !== hash).map(([file]) => file);
  assert.deepEqual(drifted, [], "this fold must not rewrite a watched template: " + drifted.join(", "));
});