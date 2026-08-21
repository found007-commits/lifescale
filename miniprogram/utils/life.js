const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function ageOnDate(birthDate, targetDate = localDateString()) {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, day] = targetDate.split("-").map(Number);
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age;
}

function targetDateFromAge(birthDate, targetAge) {
  const [year, month, day] = birthDate.split("-").map(Number);
  const targetYear = year + Number(targetAge);
  const targetDay = month === 2 && day === 29 && !isLeapYear(targetYear) ? 28 : day;
  return `${targetYear}-${pad(month)}-${pad(targetDay)}`;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function calculateLifeMetrics({ birthDate, targetAge, targetDate }) {
  const today = localDateString();
  const goalDate = targetDate || targetDateFromAge(birthDate, targetAge);
  const birth = parseDate(birthDate);
  const now = parseDate(today);
  const goal = parseDate(goalDate);
  const livedDays = Math.max(0, Math.floor((now - birth) / DAY_MS));
  const totalDays = Math.max(1, Math.floor((goal - birth) / DAY_MS));
  const rawRemaining = Math.floor((goal - now) / DAY_MS);
  const remainingDays = Math.max(0, rawRemaining);
  const progress = Math.min(100, Math.max(0, (livedDays / totalDays) * 100));

  return {
    today,
    goalDate,
    livedDays,
    remainingDays,
    remainingWeeks: Math.floor(remainingDays / 7),
    progress,
    bonusDays: Math.max(0, -rawRemaining),
    isBonus: rawRemaining < 0,
  };
}

function uuid() {
  const seed = `${Date.now()}-${Math.random()}-${Math.random()}`;
  let index = 0;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = (seed.charCodeAt(index++ % seed.length) + Math.random() * 16) % 16 | 0;
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

module.exports = {
  ageOnDate,
  calculateLifeMetrics,
  localDateString,
  targetDateFromAge,
  uuid,
};
