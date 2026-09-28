import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const readRoot = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const wxss = readRoot("miniprogram/pages/index/index.wxss");
const wxml = readRoot("miniprogram/pages/index/index.wxml");

// 2.0.16: rebuild the landing chrome so the WeChat capsule (··· and ◎) no longer fights
// the sign-in entry for the top-right corner. The custom-nav-bar now only carries the
// brand; the hero-actions-row holds a primary CTA ("write today") beside a quieter
// outlined CTA ("sign in"). Same handlers, same data flow.
const baseRule = wxss.slice(0, wxss.indexOf("@media"));

test("the top nav is a custom-nav-bar that leaves the right side empty for the WeChat capsule", () => {
  // The old landing-nav/brand-row shell is retired in favour of custom-nav-bar / nav-brand.
  assert.doesNotMatch(wxml, /<view class="landing-nav">/, "the old landing-nav shell must be retired");
  const nav = wxml.match(/<view class="custom-nav-bar">[\s\S]*?<\/view>/);
  assert.ok(nav, "the page must declare a custom-nav-bar");
  assert.match(nav[0], /class="nav-brand"/, "the brand lives inside custom-nav-bar");
  // Only the brand lives here — no sign-in entry, no capsule-collision target.
  assert.doesNotMatch(nav[0], /goLogin|sign ?in|登录/, "no sign-in entry may sit in the top nav");
});

test("the hero carries a primary + secondary CTA pair in a single row", () => {
  // hero-section has nested views (display-title, etc.); reach for hero-actions-row
  // directly to avoid the regex capturing the wrong closing tag.
  const actions = wxml.match(/<view class="hero-actions-row">[\s\S]*?<\/view>/);
  assert.ok(actions, "the hero must wrap both buttons in a single hero-actions-row");
  const primary = actions[0].indexOf('class="cta-btn primary"');
  const signin = actions[0].indexOf('class="cta-btn secondary"');
  assert.ok(primary > -1, "the primary CTA must be inside hero-actions-row");
  assert.ok(signin > -1, "the sign-in entry must be inside hero-actions-row");
  assert.ok(primary < signin, "the primary CTA leads the row, the sign-in entry follows");
});

test("the primary CTA is a filled control with the brand dark colour", () => {
  assert.match(baseRule, /\.cta-btn\.primary\s*\{[^}]*background-color:\s*#17382b/, "primary fills with the brand dark green");
  assert.match(baseRule, /\.cta-btn\.primary\s*\{[^}]*color:\s*#ffffff/, "primary uses white type");
  assert.doesNotMatch(baseRule, /\.cta-btn\.primary\s*\{[^}]*background-color:\s*transparent/, "no transparent background may come back");
});

test("the secondary CTA is quiet: light fill plus a thin border, not the brand colour", () => {
  assert.match(baseRule, /\.cta-btn\.secondary\s*\{[^}]*background-color:\s*rgba\(23, ?56, ?43/);
  assert.match(baseRule, /\.cta-btn\.secondary\s*\{[^}]*color:\s*#17382b/);
  assert.match(baseRule, /\.cta-btn\.secondary\s*\{[^}]*border:\s*1\.5rpx solid rgba\(23, ?56, ?43/);
  // Belt and braces: the secondary background must not be the brand solid colour.
  // The text colour (#17382b) is fine — it is the foreground, not the fill.
  const rule = baseRule.match(/\.cta-btn\.secondary\s*\{[^}]*\}/)[0];
  assert.doesNotMatch(rule, /background-color:\s*#123f31|background-color:\s*#17382b/, "the secondary fill must stay a tint of the brand colour, not the colour itself");
});

test("the dark scheme paints its own pair; the override is not dead code", () => {
  const dark = wxss.slice(wxss.indexOf("@media"));
  assert.match(dark, /\.cta-btn\.primary\s*\{[^}]*background-color:\s*#3f7359/, "dark primary shifts to the dark-scheme green");
  assert.match(dark, /\.cta-btn\.secondary\s*\{/, "dark secondary keeps its own fill");
  // Same trap the previous fold documented: an override placed before the base rule never wins.
  assert.ok(wxss.indexOf(".cta-btn.primary {") < wxss.lastIndexOf(".cta-btn.primary"), "the dark override must come after the base rule");
  assert.ok(wxss.indexOf(".cta-btn.secondary {") < wxss.lastIndexOf(".cta-btn.secondary"), "the dark override must come after the base rule");
});

test("the WeChat default button border is cleared so the secondary outline is exactly the one we drew", () => {
  assert.match(wxss, /\.cta-btn::after\s*\{[^}]*border:\s*none/, "button::after must be cleared to remove the default 1rpx ghost border");
});

test("the handlers bind to the existing startWriting / goLogin methods", () => {
  assert.match(wxml, /class="cta-btn primary"[^>]*bindtap="startWriting"/);
  assert.match(wxml, /class="cta-btn secondary"[^>]*bindtap="goLogin"/);
});

// ── What this release changed ────────────────────────────────────────────────────────────
const previous = JSON.parse(readRoot("tests/fixtures/ui-2014-baseline.json"));
const baseline = JSON.parse(readRoot("tests/fixtures/ui-2015-baseline.json"));
const release = JSON.parse(readRoot("miniprogram/package.json")).version === "2.0.16";
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

test("2.0.16 moves the mini program version to 2.0.16", { skip: !release }, () => {
  assert.equal(JSON.parse(readRoot("miniprogram/package.json")).version, "2.0.16");
});

test("2.0.16 changes no protected file beyond the 2.0.15 bootstrap fold", { skip: !release }, () => {
  // The landing-page rebuild only touches index/index.wxml + index/index.wxss. Both are
  // outside the protected-files watch list, so the set of legitimately changed protected
  // files must remain exactly the five from the 2.0.15 bootstrap fold.
  const changed = Object.entries(previous.protectedFiles).filter(([file, hash]) => sha(readRoot(file)) !== hash).map(([file]) => file).sort();
  assert.deepEqual(changed, [
    "app/components/Dashboard.tsx",
    "lib/supabase/client.ts",
    "miniprogram/app.js",
    "miniprogram/pages/dashboard/dashboard.js",
    "miniprogram/utils/supabase.js",
  ], "this fold adds no new protected changes on top of the bootstrap fold");

  // Markup contract: index.wxml is not a watched template. The bootstrap fold rewrote
  // dashboard.wxml and recorded the reason; this fold must not rewrite any other.
  const drifted = Object.entries(baseline.markup).filter(([file, hash]) => contract(readRoot(file)) !== hash).map(([file]) => file);
  assert.deepEqual(drifted, [], "this fold must not rewrite a watched template: " + drifted.join(", "));
});