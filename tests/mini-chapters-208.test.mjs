import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const life = require("../miniprogram/utils/life.js");

// The delivered draft replaced module.exports wholesale, which would have silently
// removed every existing export. This locks the full surface down.
test("life.js keeps every pre-existing export alongside the chapter helpers", () => {
  for (const name of ["ageOnDate", "calculateLifeMetrics", "localDateString", "targetDateFromAge", "uuid"]) {
    assert.equal(typeof life[name], "function", `${name} must stay exported`);
  }
  assert.equal(typeof life.calculateChapterMetrics, "function");
  assert.equal(life.CHAPTER_DAYS, 1000);
  assert.equal(life.ageOnDate("1990-01-01", "2025-01-01"), 35);
  assert.equal(life.targetDateFromAge("2000-02-29", 30), "2030-02-28");
});

test("chapter boundaries are 1 based and roll over every 1000 days", () => {
  const cases = [
    [0, 1, 1, 999],
    [1, 1, 2, 998],
    [999, 1, 1000, 0],
    [1000, 2, 1, 999],
    [1999, 2, 1000, 0],
    [2000, 3, 1, 999],
    [5000, 6, 1, 999],
  ];
  for (const [lived, chapter, index, remaining] of cases) {
    const metrics = life.calculateChapterMetrics(lived, 30000);
    assert.deepEqual(
      [metrics.currentChapter, metrics.chapterDayIndex, metrics.chapterDaysRemaining],
      [chapter, index, remaining], `day ${lived}`);
  }
});

test("chapter metrics never disagree with calculateLifeMetrics about a bonus day", () => {
  // The draft used livedDays >= target with a +1 offset, which would have declared a
  // bonus on the target date itself while calculateLifeMetrics reports none that day.
  const onTarget = life.calculateChapterMetrics(30000, 30000);
  assert.equal(onTarget.isBonusLife, false);
  assert.equal(onTarget.bonusDayCount, 0);

  const firstBonus = life.calculateChapterMetrics(30001, 30000);
  assert.equal(firstBonus.isBonusLife, true);
  assert.equal(firstBonus.bonusDayCount, 1);

  // Both functions are driven by the same live clock, so compare them on real values.
  for (const targetDate of ["2025-01-01", "2099-01-01"]) {
    const metrics = life.calculateLifeMetrics({ birthDate: "1990-01-01", targetDate });
    const chapter = life.calculateChapterMetrics(metrics.livedDays, metrics.totalDays);
    assert.equal(chapter.isBonusLife, metrics.isBonus, targetDate);
    assert.equal(chapter.bonusDayCount, metrics.bonusDays, targetDate);
  }
});

test("an unset or nonsensical target is never treated as a bonus life", () => {
  for (const target of [0, -5, null, undefined, NaN, "abc"]) {
    const metrics = life.calculateChapterMetrics(500, target);
    assert.equal(metrics.isBonusLife, false, String(target));
    assert.equal(metrics.bonusDayCount, 0, String(target));
  }
  // A negative or non-numeric lived count clamps to day one rather than throwing.
  for (const lived of [-10, null, undefined, NaN]) {
    const metrics = life.calculateChapterMetrics(lived, 30000);
    assert.deepEqual(
      [metrics.currentChapter, metrics.chapterDayIndex, metrics.bonusDayCount],
      [1, 1, 0], String(lived));
  }
});
