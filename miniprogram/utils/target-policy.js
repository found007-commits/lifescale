const RULE_ZH = "首次设定后一年内可修改 3 次；满一年后，每次修改需间隔一年，累计最多 7 次。首次设定不计次数。";
const RULE_EN = "You can make 3 changes in the first year after setup. After that, changes must be a year apart, with 7 changes in total. Initial setup does not count.";
// Match PostgreSQL's calendar-year arithmetic in UTC, including February 29.
function nextYear(timestamp) {
  const date = new Date(timestamp), month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.getTime();
}
function targetPolicy(profile, now = Date.now()) {
  const count = profile?.target_change_count;
  const until = Date.parse(profile?.target_locked_until || "");
  const created = Date.parse(profile?.created_at || "");
  const configured = Number.isInteger(count) && count >= 0 && count <= 7 && Number.isFinite(until) && Number.isFinite(created) && Number.isFinite(now) && created <= now;
  const anniversary = nextYear(created);
  const firstYear = configured && now < anniversary;
  const firstYearRemaining = firstYear ? Math.max(0, 3 - count) : 0;
  const remaining = configured ? 7 - count : 0;
  const available = firstYear ? (firstYearRemaining > 0 ? created : anniversary) : Math.max(anniversary, until);
  return { configured, used: configured ? count : 0, remaining, firstYear, firstYearRemaining, canChange: configured && remaining > 0 && now >= available, nextAt: configured && remaining > 0 ? new Date(available).toISOString() : "" };
}
function targetConfirmation(age, policy, en = false, traditional = false) {
  const remaining = Math.max(0, policy.remaining - 1);
  const timing = policy.firstYear
    ? (policy.firstYearRemaining > 1
      ? (en ? `You will have ${policy.firstYearRemaining - 1} first-year changes left, available without waiting.` : `首年还可修改 ${policy.firstYearRemaining - 1} 次，无需等待。`)
      : (en ? "Your first-year changes will be used up. The next change is available on your setup anniversary." : "首年修改机会将用完，下次需等首次设定满一年。"))
    : (en ? "The next change requires another full year." : "下次修改需再间隔一年。");
  if (traditional) {
    const after = !remaining ? "累計修改機會將全部用完。" : !policy.firstYear ? "下次修改需再間隔一年。" : policy.firstYearRemaining > 1 ? `首年還可修改 ${policy.firstYearRemaining - 1} 次，無需等待。` : "首年修改機會將用完，下次需等首次設定滿一年。";
    return `新目標：${age} 歲。本次使用一次機會，累計剩餘 ${remaining} / 7 次。${after}`;
  }
  return en ? `New target: ${age} years. This uses one change; ${remaining} of 7 will remain in total. ${remaining ? timing : "All 7 changes will be used up."}` : `新目标：${age} 岁。本次使用一次机会，累计剩余 ${remaining} / 7 次。${remaining ? timing : "累计修改机会将全部用完。"}`;
}
function targetError(message, en = false) {
  if (/TARGET_CHANGE_LIMIT/.test(message)) return en ? "All 7 target changes have been used." : "累计 7 次调整机会已用完。";
  if (/TARGET_CHANGE_LOCKED/.test(message)) return en ? "The next change is not available yet. Refresh to see its date." : "尚未到下次可调整时间，请刷新后查看。";
  if (/TARGET_DATE_PAST/.test(message)) return en ? "Choose a future target." : "请选择尚未到达的目标年龄。";
  return message;
}
module.exports = { RULE_ZH, RULE_EN, targetPolicy, targetError, targetConfirmation };
