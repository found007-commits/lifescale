// Localization coverage for the sanctuary subpackage: every Chinese string a user can
// read must resolve through the generated dictionary in all three languages. A literal
// that is missing renders as Chinese on an English phone, which is the failure mode this
// guards against.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL("../miniprogram/" + path, import.meta.url), "utf8");
const repoRead = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const translate = require("../miniprogram/utils/locale-copy.js");
const { chapterCopy, tributeCountLabel } = require("../miniprogram/utils/sanctuary-copy.js");

const app = JSON.parse(read("app.json"));
const SUBPACKAGE_ROOT = "subpackages/sanctuary";
const SUBPACKAGE_PAGES = ["pages/space/space", "pages/editor/editor", "pages/tribute/tribute"];
const CJK = /[\u4e00-\u9fff]/;

// The generated catalogue, so a key that exists but carries no English can be told apart
// from a key that is missing altogether.
function generatedDictionary() {
  const source = read("utils/locale.wxs");
  const marker = "var dictionary = ";
  const start = source.indexOf(marker) + marker.length;
  return JSON.parse(source.slice(start, source.indexOf("\n", start)).replace(/;$/, ""));
}

test("the sanctuary subpackage is declared and every page ships all four native files", () => {
  const group = (app.subPackages || app.subpackages || []).find((item) => item.root === SUBPACKAGE_ROOT);
  assert.ok(group, "subPackages must declare " + SUBPACKAGE_ROOT);
  assert.deepEqual(group.pages, SUBPACKAGE_PAGES);
  for (const page of SUBPACKAGE_PAGES) {
    for (const extension of ["js", "json", "wxml", "wxss"]) {
      assert.ok(existsSync(new URL(`../miniprogram/${SUBPACKAGE_ROOT}/${page}.${extension}`, import.meta.url)), `${page}.${extension}`);
    }
  }
  // The subpackage must not shadow a main package route.
  for (const page of app.pages) assert.doesNotMatch(page, new RegExp("^" + SUBPACKAGE_ROOT));
  assert.deepEqual(readdirSync(new URL(`../miniprogram/${SUBPACKAGE_ROOT}/pages`, import.meta.url)).sort(),
    ["editor", "space", "tribute"]);
});

// Comments are stripped first so an English-only code comment can never be mistaken for
// user facing copy, and vice versa.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function literals(source) {
  const found = new Set();
  for (const match of stripComments(source).matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    if (CJK.test(match[2])) found.add(match[2]);
  }
  return found;
}

function templateLiterals(source) {
  const stripped = stripComments(source);
  const found = new Set();
  for (const match of stripped.matchAll(/i18n\.t\('((?:\\.|[^'\\])*)'/g)) found.add(match[1]);
  // Only what is left after every interpolation is removed is real text-node copy.
  const withoutExpressions = stripped.replace(/\{\{[\s\S]*?\}\}/g, "");
  for (const text of withoutExpressions.matchAll(/>([^<>]+)</g)) {
    const value = text[1].trim();
    if (CJK.test(value)) found.add(value);
  }
  return found;
}

test("every Chinese string the sanctuary pages can render resolves in all three languages", () => {
  const dictionary = generatedDictionary();
  const sources = [];
  for (const page of SUBPACKAGE_PAGES) {
    sources.push(`${SUBPACKAGE_ROOT}/${page}.js`, `${SUBPACKAGE_ROOT}/${page}.wxml`);
  }
  // The settings row is the only main package copy this change introduces.
  sources.push("pages/settings/settings.wxml");

  const checked = [];
  for (const path of sources) {
    const source = read(path);
    const values = path.endsWith(".wxml") ? templateLiterals(source) : literals(source);
    for (const value of values) {
      checked.push(`${path}: ${value}`);
      const entry = dictionary[value];
      assert.ok(entry, `${path} has no dictionary entry for ${JSON.stringify(value)}`);
      assert.equal(typeof entry.en, "string", `${path} English for ${JSON.stringify(value)}`);
      assert.equal(typeof entry.tw, "string", `${path} Traditional Chinese for ${JSON.stringify(value)}`);
      // A key the mechanical migration picked up without a translation would keep the
      // Chinese as its English, which is exactly the leak this catches.
      assert.notEqual(entry.en, value, `${path} was never translated: ${JSON.stringify(value)}`);
      assert.equal(translate(value, "en"), entry.en, path);
      assert.equal(translate(value, "zh-TW"), entry.tw, path);
    }
  }
  assert.ok(checked.length >= 50, "expected the sanctuary pages to carry real copy, saw " + checked.length);
});

test("the sanctuary pages are titled in every language instead of echoing their route", () => {
  const source = read("utils/localized-page.js");
  const dictionary = generatedDictionary();
  for (const [name, zh, en] of [["space", "我的精神圣所", "My sanctuary"], ["editor", "编辑圣所", "Edit sanctuary"], ["tribute", "留下一段致意", "Leave a tribute"]]) {
    assert.match(source, new RegExp(`${name}: "${zh}"`), name);
    assert.equal(translate(zh, "en"), en);
    assert.equal(translate(zh, "zh-TW"), dictionary[zh].tw);
  }
  // The bar falls back to the product name for a route that is not listed, so all three
  // new pages have to appear in the lookup or they would read as the title placeholder.
  assert.match(source, /t\(titles\[name\] \|\| "余生有刻", locale\)/);
});

test("sanctuary page controllers follow the shared shell and never re-implement sharing", () => {
  for (const page of SUBPACKAGE_PAGES) {
    const js = read(`${SUBPACKAGE_ROOT}/${page}.js`);
    assert.match(js, /require\("\.\.\/\.\.\/\.\.\/\.\.\/utils\/localized-page"\)/, page);
    // Four levels up from subpackages/sanctuary/pages/<name>/ to miniprogram/utils.
    for (const match of js.matchAll(/require\("([^"]+)"\)/g)) {
      const depth = (match[1].match(/\.\.\//g) || []).length;
      assert.equal(depth, 4, `${page}.js requires ${match[1]}`);
    }
    assert.doesNotMatch(js, /hideShareMenu|onShareTimeline|onShareAppMessage|backdrop-filter/, page);
    assert.match(read(`${SUBPACKAGE_ROOT}/${page}.wxml`), /^<wxs src="\.\.\/\.\.\/\.\.\/\.\.\/utils\/locale\.wxs" module="i18n" \/>/, page);
    assert.doesNotMatch(read(`${SUBPACKAGE_ROOT}/${page}.wxss`), /@import|url\(https?:|backdrop-filter|animation:/, page);
  }
});

test("a sanctuary link may only be produced by its owner, and only once it is published", () => {
  let page;
  const sandbox = {
    module: { exports: {} }, console, setTimeout: () => 1, clearTimeout() {},
    getApp: () => ({ globalData: { locale: "zh" } }),
    getCurrentPages: () => [],
    // localized-page itself is exercised elsewhere; here the definition is what matters.
    require: (path) => (path.endsWith("localized-page") ? (definition) => { page = definition; } : require("../miniprogram/utils/" + path.split("/").pop() + ".js")),
    wx: { showShareMenu() {}, hideShareMenu() {}, setNavigationBarTitle() {}, setTabBarItem() {} },
  };
  vm.runInNewContext(read(`${SUBPACKAGE_ROOT}/pages/space/space.js`), sandbox);
  assert.ok(page, "space.js must hand its definition to the shared page shell");
  page.setData = function (values) { Object.assign(this.data, values); };

  page.setData({ isOwner: false, sanctuary: { user_id: "00000000-0000-0000-0000-0000000000a1", is_public: true } });
  assert.equal(page.shareOverride(), null, "a guest view must never hand out a sanctuary link");

  page.setData({ isOwner: true, sanctuary: { user_id: "00000000-0000-0000-0000-0000000000a1", is_public: false } });
  assert.equal(page.shareOverride(), null, "a private sanctuary must never be forwarded");

  page.setData({ isOwner: true, sanctuary: { user_id: "00000000-0000-0000-0000-0000000000a1", is_public: true } });
  const override = page.shareOverride();
  assert.equal(override.path, "/subpackages/sanctuary/pages/space/space?uid=00000000-0000-0000-0000-0000000000a1");
  assert.equal(translate(override.title, "zh"), override.title);

  // And the shared wrapper still refuses anything that is not a mini program route.
  const shareSandbox = {
    module: { exports: {} }, console,
    getApp: () => ({ globalData: { locale: "en" } }),
    require: () => translate,
    wx: { showShareMenu() {}, hideShareMenu() {} },
  };
  vm.runInNewContext(read("utils/app-share.js"), shareSandbox);
  const share = shareSandbox.module.exports;
  for (const path of ["https://evil.example/?uid=1", "//evil.example", "pages/index/index", "/pages/index/index?uid=<script>", "/subpackages/sanctuary/pages/space/space?uid=a b"]) {
    const wrapped = share({ shareOverride: () => ({ title: "x", path }) });
    assert.equal(wrapped.onShareAppMessage().path, "/pages/index/index", path);
  }
  const honest = share({ shareOverride: () => ({ title: "看看我为自己留下的字。", path: "/subpackages/sanctuary/pages/space/space?uid=abc" }) });
  assert.equal(honest.onShareAppMessage().path, "/subpackages/sanctuary/pages/space/space?uid=abc");
  assert.equal(honest.onShareAppMessage().title, "See the words I left for myself.");
  const fresh = share({ shareOverride() { return null; } });
  assert.equal(fresh.onShareAppMessage().path, "/pages/index/index");
  assert.match(fresh.onShareAppMessage().title, /LifeScale/);
});

test("tribute and chapter labels move with the language instead of leaking Chinese", () => {
  assert.equal(tributeCountLabel(0, "en"), "0 tributes");
  assert.equal(tributeCountLabel(1, "en"), "1 tribute");
  assert.equal(tributeCountLabel(1200, "en"), "1,200 tributes");
  assert.equal(tributeCountLabel(3, "zh"), "3 条致意");
  assert.equal(tributeCountLabel(3, "zh-TW"), "3 條致意");
  assert.equal(tributeCountLabel(3, "zh-CN"), "3 条致意");

  const chapter = { currentChapter: 3, chapterDayIndex: 1, chapterDaysRemaining: 999, isBonusLife: false, bonusDayCount: 0 };
  assert.deepEqual(chapterCopy(chapter, "en"), { chapterValue: "Chapter 3", dayValue: "Day 1", leftValue: "999 days", bonusValue: "" });
  assert.equal(chapterCopy(chapter, "zh").chapterValue, "第 3 章");
  assert.equal(chapterCopy(chapter, "zh-TW").chapterValue, "第 3 章");
  assert.equal(chapterCopy({ ...chapter, chapterDaysRemaining: 1 }, "en").leftValue, "1 day");
  assert.equal(chapterCopy({ ...chapter, chapterDayIndex: 1000 }, "zh").dayValue, "第 1,000 天");
  assert.equal(chapterCopy({ ...chapter, isBonusLife: true, bonusDayCount: 12 }, "zh").bonusValue, "额外第 12 天");
  assert.equal(chapterCopy({ ...chapter, isBonusLife: true, bonusDayCount: 12 }, "zh-TW").bonusValue, "額外第 12 天");
  assert.equal(chapterCopy({ ...chapter, isBonusLife: true, bonusDayCount: 12 }, "en").bonusValue, "Bonus day 12");
  assert.deepEqual(chapterCopy(null, "en"), { chapterValue: "", dayValue: "", leftValue: "", bonusValue: "" });
  for (const locale of ["en", "zh", "zh-TW"]) {
    for (const value of Object.values(chapterCopy({ ...chapter, isBonusLife: true, bonusDayCount: 12 }, locale))) {
      assert.doesNotMatch(value, /NaN|undefined/, locale);
    }
  }
});

test("the app shell keeps its own share card and does not depend on the new page copy", () => {
  const wrapper = repoRead("miniprogram/utils/app-share.js");
  assert.equal(translate("余生有刻 · 看见余生，认真今天。", "en").includes("LifeScale"), true);
  assert.doesNotMatch(wrapper, /uid|user_id/);
});
