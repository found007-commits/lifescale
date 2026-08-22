import assert from "node:assert/strict";
import test from "node:test";
import { detectLocale, isLocale } from "../lib/i18n";

test("IP country selects the expected language family", () => {
  assert.equal(detectLocale("CN", "en-US"), "zh");
  assert.equal(detectLocale("HK", "en-US"), "zh-TW");
  assert.equal(detectLocale("MO", "en-US"), "zh-TW");
  assert.equal(detectLocale("TW", "en-US"), "zh-TW");
  assert.equal(detectLocale("SG", "zh-CN"), "en");
  assert.equal(detectLocale("US", "zh-TW"), "en");
});

test("browser language is only a fallback when IP country is unavailable", () => {
  assert.equal(detectLocale(null, "zh-TW,zh;q=0.9"), "zh-TW");
  assert.equal(detectLocale(null, "zh-CN,zh;q=0.9"), "zh");
  assert.equal(detectLocale(null, "ja-JP"), "en");
});

test("saved locale values are validated", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("zh-TW"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
});
