import assert from "node:assert/strict";
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
