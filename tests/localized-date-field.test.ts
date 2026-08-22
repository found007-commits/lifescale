import assert from "node:assert/strict";
import test from "node:test";
import { dateFieldOrder, formatLocalizedDate } from "../app/components/LocalizedDateField";

test("Simplified and Traditional Chinese both use year-month-day order", () => {
  assert.deepEqual(dateFieldOrder("zh-CN"), ["year", "month", "day"]);
  assert.deepEqual(dateFieldOrder("zh-TW"), ["year", "month", "day"]);
  assert.equal(formatLocalizedDate("1982-05-09", "zh-CN"), "1982年5月9日");
  assert.equal(formatLocalizedDate("1982-05-09", "zh-TW"), "1982年5月9日");
});

test("English uses day-month-year order", () => {
  assert.deepEqual(dateFieldOrder("en"), ["day", "month", "year"]);
  assert.equal(formatLocalizedDate("1982-05-09", "en"), "09/05/1982");
});
