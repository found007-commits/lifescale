import { daysBetween } from "./life-calculations";
import type { Checkin, EntryCategory, LifeEntry, Mood } from "./types";

export function calculateStreak(checkins: Checkin[], today: string) {
  const dates = new Set(checkins.map((item) => item.checkin_date));
  let cursor = today;
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    const date = new Date(`${cursor}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    cursor = date.toISOString().slice(0, 10);
  }
  return streak;
}

export function sevenDayWindow(today: string) {
  const end = today;
  const startDate = new Date(`${today}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  return { start: startDate.toISOString().slice(0, 10), end };
}

export function buildSevenDayReport(entries: LifeEntry[], checkins: Checkin[], today: string) {
  const window = sevenDayWindow(today);
  const periodEntries = entries.filter((entry) => {
    const date = entry.entry_date.slice(0, 10);
    return daysBetween(window.start, date) >= 0 && daysBetween(date, window.end) >= 0;
  });
  const periodCheckins = checkins.filter((item) => daysBetween(window.start, item.checkin_date) >= 0 && daysBetween(item.checkin_date, window.end) >= 0);
  const moods = {} as Record<Mood, number>;
  const categories = {} as Record<EntryCategory, number>;
  for (const entry of periodEntries) {
    moods[entry.mood] = (moods[entry.mood] || 0) + 1;
    categories[entry.category] = (categories[entry.category] || 0) + 1;
  }
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] as EntryCategory | undefined;
  return {
    start: window.start,
    end: window.end,
    entryCount: periodEntries.length,
    recordedDays: new Set(periodCheckins.map((item) => item.checkin_date)).size,
    currentStreak: calculateStreak(checkins, today),
    moods,
    categories,
    topCategory: topCategory || null,
    entries: periodEntries,
  };
}
