export type LifeMetrics = {
  today: string;
  targetDate: string;
  livedDays: number;
  remainingDays: number;
  remainingWeeks: number;
  remainingYears: number;
  remainingMonths: number;
  remainingRemainderDays: number;
  nextBirthdayDays: number;
  progressPercent: number;
  bonusDays: number;
  isBonusChapter: boolean;
};

const DAY_MS = 86_400_000;

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Invalid date: ${value}`);
  return { year, month, day };
}

function formatDate(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toDayNumber(value: string) {
  const { year, month, day } = parseDate(value);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function daysBetween(start: string, end: string) {
  return toDayNumber(end) - toDayNumber(start);
}

export function addYearsClamped(value: string, years: number) {
  const { year, month, day } = parseDate(value);
  const targetYear = year + years;
  return formatDate(targetYear, month, Math.min(day, daysInMonth(targetYear, month)));
}

function addMonthsClamped(value: string, months: number) {
  const { year, month, day } = parseDate(value);
  const zeroBased = year * 12 + month - 1 + months;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = (zeroBased % 12) + 1;
  return formatDate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

export function todayInTimeZone(timeZone: string, now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function targetDateFromAge(birthDate: string, targetAge: number) {
  if (!Number.isInteger(targetAge) || targetAge < 30 || targetAge > 150) {
    throw new Error("Target age must be an integer between 30 and 150.");
  }
  return addYearsClamped(birthDate, targetAge);
}

function remainingCalendarParts(today: string, targetDate: string) {
  if (daysBetween(today, targetDate) <= 0) return { years: 0, months: 0, days: 0 };
  let cursor = today;
  let years = 0;
  while (daysBetween(addYearsClamped(cursor, 1), targetDate) >= 0) {
    cursor = addYearsClamped(cursor, 1);
    years += 1;
  }
  let months = 0;
  while (daysBetween(addMonthsClamped(cursor, 1), targetDate) >= 0) {
    cursor = addMonthsClamped(cursor, 1);
    months += 1;
  }
  return { years, months, days: daysBetween(cursor, targetDate) };
}

function nextBirthdayDays(birthDate: string, today: string) {
  const birth = parseDate(birthDate);
  const current = parseDate(today);
  let birthday = formatDate(current.year, birth.month, Math.min(birth.day, daysInMonth(current.year, birth.month)));
  if (daysBetween(today, birthday) < 0) {
    birthday = formatDate(current.year + 1, birth.month, Math.min(birth.day, daysInMonth(current.year + 1, birth.month)));
  }
  return daysBetween(today, birthday);
}

export function calculateLifeMetrics(input: {
  birthDate: string;
  targetAge?: number | null;
  targetDate?: string | null;
  timeZone: string;
  now?: Date;
}): LifeMetrics {
  const targetDate = input.targetDate || targetDateFromAge(input.birthDate, input.targetAge ?? 90);
  const today = todayInTimeZone(input.timeZone, input.now);
  const totalDays = Math.max(1, daysBetween(input.birthDate, targetDate));
  const livedDays = Math.max(0, daysBetween(input.birthDate, today));
  const rawRemaining = daysBetween(today, targetDate);
  const remainingDays = Math.max(0, rawRemaining);
  const calendar = remainingCalendarParts(today, targetDate);
  return {
    today,
    targetDate,
    livedDays,
    remainingDays,
    remainingWeeks: Math.floor(remainingDays / 7),
    remainingYears: calendar.years,
    remainingMonths: calendar.months,
    remainingRemainderDays: calendar.days,
    nextBirthdayDays: nextBirthdayDays(input.birthDate, today),
    progressPercent: Math.min(100, Math.max(0, (livedDays / totalDays) * 100)),
    bonusDays: Math.max(0, -rawRemaining),
    isBonusChapter: rawRemaining < 0,
  };
}

export function ageOnDate(birthDate: string, date: string) {
  const birth = parseDate(birthDate);
  const current = parseDate(date);
  let age = current.year - birth.year;
  if (current.month < birth.month || (current.month === birth.month && current.day < birth.day)) age -= 1;
  return age;
}
