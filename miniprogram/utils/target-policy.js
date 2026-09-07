const RULE_ZH = "首次设定后，每满一年可调整一次，累计最多 3 次。认真选择，给未来留一点余地。";
const RULE_EN = "After your first setting, you may adjust your target once a full year has passed, up to 3 times in total. Choose thoughtfully, with room for the future.";
function targetPolicy(profile, now = Date.now()) {
  const count = profile?.target_change_count;
  const until = Date.parse(profile?.target_locked_until || "");
  const configured = Number.isInteger(count) && count >= 0 && count <= 3 && Number.isFinite(until);
  const remaining = configured ? 3 - count : 0;
  return { configured, used: configured ? count : 0, remaining, canChange: configured && remaining > 0 && now >= until, nextAt: configured ? profile.target_locked_until : "" };
}
function targetError(message, en = false) {
  if (/TARGET_CHANGE_LIMIT/.test(message)) return en ? "All 3 target adjustments have been used." : "累计 3 次调整机会已用完。";
  if (/TARGET_CHANGE_LOCKED/.test(message)) return en ? "A full year must pass before the next adjustment. Refresh to see the available date." : "距离上次设定尚未满一年，请刷新查看下次可调整时间。";
  if (/TARGET_DATE_PAST/.test(message)) return en ? "Choose a future target." : "请选择尚未到达的目标年龄。";
  return message;
}
module.exports = { RULE_ZH, RULE_EN, targetPolicy, targetError };
