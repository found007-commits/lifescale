// These accounts were explicitly created through WeChat, without an email account.
// This is a navigation rule only; API authentication and record ownership stay server-side.
function isWechatOnly(session) {
  return Boolean(session?.user?.id && /@wechat\.lifescale\.invalid$/i.test(session.user.email || ""));
}
function requiresWechatSetup(session, profile) {
  return isWechatOnly(session) && !(profile?.id === session.user.id && profile.onboarding_completed);
}
module.exports = { isWechatOnly, requiresWechatSetup };
