import assert from "node:assert/strict";
import test from "node:test";
import { addYearsClamped, calculateLifeMetrics, daysBetween, targetDateFromAge, todayInTimeZone } from "../lib/life-calculations";
import { buildSevenDayReport, calculateStreak } from "../lib/report-calculations";
import type { Checkin, LifeEntry } from "../lib/types";

test("uses calendar years and clamps leap-day targets", () => {
  assert.equal(addYearsClamped("2000-02-29", 30), "2030-02-28");
  assert.equal(targetDateFromAge("2000-02-29", 90), "2090-02-28");
  assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2);
});

test("updates at the user's local date boundary", () => {
  const instant = new Date("2026-08-20T16:30:00.000Z");
  assert.equal(todayInTimeZone("Asia/Shanghai", instant), "2026-08-21");
  assert.equal(todayInTimeZone("America/Los_Angeles", instant), "2026-08-20");
});

test("switches to bonus chapter without a negative countdown", () => {
  const metrics = calculateLifeMetrics({ birthDate: "1990-01-01", targetDate: "2025-01-01", timeZone: "UTC", now: new Date("2025-01-04T12:00:00Z") });
  assert.equal(metrics.remainingDays, 0);
  assert.equal(metrics.isBonusChapter, true);
  assert.equal(metrics.bonusDays, 3);
});

test("builds a real seven-day statistical report", () => {
  const checkins = ["2026-08-19", "2026-08-20", "2026-08-21"].map((date, index) => ({ id: String(index), user_id: "u", checkin_date: date, created_at: `${date}T12:00:00Z` })) as Checkin[];
  const entries = [{ id: "e1", user_id: "u", entry_date: "2026-08-21T12:00:00Z", content: "Today", mood: "grateful", category: "family", visibility: "private", created_at: "", updated_at: "", entry_media: [] }] as LifeEntry[];
  assert.equal(calculateStreak(checkins, "2026-08-21"), 3);
  const report = buildSevenDayReport(entries, checkins, "2026-08-21");
  assert.equal(report.recordedDays, 3);
  assert.equal(report.entryCount, 1);
  assert.equal(report.moods.grateful, 1);
  assert.equal(report.topCategory, "family");
});
