import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeTargetAge } from "../app/components/TargetAgeField";

test("target age input removes leading zeroes and non-digits", () => {
  assert.equal(normalizeTargetAge("070"), "70");
  assert.equal(normalizeTargetAge("00090"), "90");
  assert.equal(normalizeTargetAge("0"), "");
  assert.equal(normalizeTargetAge(" 1a20 "), "120");
});

test("target age input is limited to three digits", () => {
  assert.equal(normalizeTargetAge("1500"), "150");
});

test("target age UI does not anchor users with preset lifespan numbers", () => {
  const source = readFileSync(new URL("../app/components/TargetAgeField.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /PRESET_AGES|Common target ages|常用目标年龄/);
  assert.match(source, /不提供推荐数字/);
});
