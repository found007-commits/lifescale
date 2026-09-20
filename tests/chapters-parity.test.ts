import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { CHAPTER_DAYS, calculateChapterMetrics, calculateLifeMetrics } from "../lib/life-calculations";

const require = createRequire(import.meta.url);
const life = require("../miniprogram/utils/life.js");

// 2.0.9 adds the 1000-day chapter model to the website. The website and the mini program
// each carry their own copy of the arithmetic, so the only thing that keeps them honest is
// comparing the two implementations value by value rather than trusting that they match.
const CHAPTER_FIELDS = [
  "currentChapter",
  "chapterDayIndex",
  "chapterDaysRemaining",
  "isBonusLife",
  "bonusDayCount",
] as const;

test("both copies agree on the chapter length", () => {
  assert.equal(CHAPTER_DAYS, 1000);
  assert.equal(life.CHAPTER_DAYS, 1000);
});

test("the website and the mini program return identical chapter metrics", () => {
  const livedInputs = [0, 1, 2, 999, 1000, 1001, 1999, 2000, 2001, 3000, 3650, 4000, 4999, 5000, 7300, 10000];
  const targetInputs = [0, 1, 365, 1000, 2000, 3650, 5475, 7300, 10950, 36500];

  for (const lived of livedInputs) {
    for (const target of targetInputs) {
      const web = calculateChapterMetrics(lived, target);
      const mini = life.calculateChapterMetrics(lived, target);
      for (const field of CHAPTER_FIELDS) {
        assert.equal(web[field], mini[field], `${field} disagrees at lived=${lived} target=${target}`);
      }
    }
  }
});

test("chapter boundaries are 1 based and roll over every 1000 days", () => {
  assert.deepEqual(calculateChapterMetrics(0, 36500), {
    currentChapter: 1, chapterDayIndex: 1, chapterDaysRemaining: 999, isBonusLife: false, bonusDayCount: 0,
  });
  // The last day of a chapter is day 1000 with 0 remaining, not the first day of the next.
  assert.equal(calculateChapterMetrics(999, 36500).currentChapter, 1);
  assert.equal(calculateChapterMetrics(999, 36500).chapterDayIndex, 1000);
  assert.equal(calculateChapterMetrics(999, 36500).chapterDaysRemaining, 0);
  // The next day opens chapter 2 at day 1.
  assert.equal(calculateChapterMetrics(1000, 36500).currentChapter, 2);
  assert.equal(calculateChapterMetrics(1000, 36500).chapterDayIndex, 1);
  assert.equal(calculateChapterMetrics(1999, 36500).currentChapter, 2);
  assert.equal(calculateChapterMetrics(1999, 36500).chapterDayIndex, 1000);
  assert.equal(calculateChapterMetrics(2000, 36500).currentChapter, 3);
  assert.equal(calculateChapterMetrics(5000, 36500).currentChapter, 6);
});

test("an unset target is never a bonus life", () => {
  for (const lived of [0, 1000, 5000, 10000]) {
    for (const target of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const metrics = calculateChapterMetrics(lived, target);
      assert.equal(metrics.isBonusLife, false, `lived=${lived} target=${target}`);
      assert.equal(metrics.bonusDayCount, 0);
    }
  }
});

test("chapter metrics never disagree with calculateLifeMetrics about a bonus day", () => {
  const targetDate = "2025-01-01";
  // Sweep across the boundary so the two functions are compared on the day before, the
  // day of, and the day after the target. The website copy can be pinned to a date; the
  // mini program copy reads the device clock, so it is checked for self-consistency
  // instead of being fed a fake date it does not accept.
  for (let offset = -4; offset <= 4; offset += 1) {
    const now = new Date(Date.parse(`${targetDate}T12:00:00Z`) + offset * 86_400_000);
    const metrics = calculateLifeMetrics({ birthDate: "1990-01-01", targetDate, timeZone: "UTC", now });
    const chapters = calculateChapterMetrics(metrics.livedDays, metrics.totalDays);
    assert.equal(chapters.isBonusLife, metrics.isBonusChapter, `bonus flag disagrees at offset ${offset}`);
    assert.equal(chapters.bonusDayCount, metrics.bonusDays, `bonus day count disagrees at offset ${offset}`);
  }

  const mini = life.calculateLifeMetrics({ birthDate: "1990-01-01", targetDate });
  const miniChapters = life.calculateChapterMetrics(mini.livedDays, mini.totalDays);
  assert.equal(miniChapters.isBonusLife, mini.isBonus);
  assert.equal(miniChapters.bonusDayCount, mini.bonusDays);
});

test("lived days and total days can be reconstructed from the public metrics", () => {
  // The chapter model needs totalDays; the website exposes it directly so nobody has to
  // re-derive it as livedDays + remainingDays - bonusDays and get the bonus case wrong.
  for (const [birthDate, targetDate, now] of [
    ["1990-01-01", "2025-01-01", "2024-12-31T12:00:00Z"],
    ["1990-01-01", "2025-01-01", "2025-01-02T12:00:00Z"],
    ["1990-01-01", "2025-01-01", "2025-01-01T12:00:00Z"],
  ] as const) {
    const metrics = calculateLifeMetrics({ birthDate, targetDate, timeZone: "UTC", now: new Date(now) });
    assert.equal(metrics.totalDays, metrics.livedDays + metrics.remainingDays - metrics.bonusDays);
    assert.ok(metrics.totalDays > 0);
  }
});

test("odd inputs are clamped instead of producing NaN", () => {
  const NUMERIC_FIELDS = ["currentChapter", "chapterDayIndex", "chapterDaysRemaining", "bonusDayCount"] as const;
  for (const bad of [Number.NaN, -1, -1000, 12.7, "3" as unknown as number, null as unknown as number]) {
    const metrics = calculateChapterMetrics(bad, 36500);
    assert.equal(typeof metrics.isBonusLife, "boolean");
    for (const field of NUMERIC_FIELDS) {
      assert.ok(Number.isFinite(metrics[field]), `${field} is not finite for ${String(bad)}`);
    }
    assert.equal(metrics.currentChapter, 1);
    assert.equal(metrics.chapterDayIndex, Math.max(0, Math.floor(Number(bad) || 0)) % 1000 + 1);
    assert.equal(metrics.isBonusLife, false);
    // The mini program clamps identically.
    assert.equal(metrics.currentChapter, life.calculateChapterMetrics(bad, 36500).currentChapter);
    assert.equal(metrics.isBonusLife, life.calculateChapterMetrics(bad, 36500).isBonusLife);
  }
  // A fractional day floors rather than rounding, in both copies.
  assert.equal(calculateChapterMetrics(12.7, 100).chapterDayIndex, 13);
  assert.equal(life.calculateChapterMetrics(12.7, 100).chapterDayIndex, 13);
});
