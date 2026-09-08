const config = require("../config");
const { restoreSession, refreshSession, storeSession } = require("./supabase");
const t = require("./locale-copy");

const messages = {
  WECHAT_UNAVAILABLE: "微信登录暂不可用，请使用邮箱登录。",
  WECHAT_CODE_EXPIRED: "微信验证已过期，请重新点击重试。",
  EMAIL_VERIFY_FAILED: "邮箱验证码错误或已失效，请重新获取。",
  ACCOUNT_MISMATCH: "账户不一致，请使用当前账户的邮箱验证。",
  LAST_LOGIN_METHOD: "这是此账户唯一的登录方式，不能解除。",
  TRY_LATER: "操作太频繁，请稍后再试。",
  USE_EMAIL_LOGIN: "请使用邮箱登录此账户。",
  UNAUTHORIZED: "登录已过期，请重新登录。",
  LOGIN_RETRY: "登录未完成，请重新点击重试。",
  CONSENT_REQUIRED: "请先阅读并自行选择是否同意服务条款和隐私政策。",
};
function errorText(error, locale) {
  return t(messages[error.code || error.message] || "登录未完成，请重试或使用邮箱登录。", locale);
}
function visibleEmail(email) {
  return email && !email.toLowerCase().endsWith("@wechat.lifescale.invalid") ? email : "";
}
async function api(data, authenticated = false) {
  let session = authenticated ? restoreSession() : null;
  if (authenticated && !session?.access_token) throw Object.assign(new Error("UNAUTHORIZED"), { code: "UNAUTHORIZED" });
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) session = await refreshSession(session);
  return new Promise((resolve, reject) => wx.request({
    url: `${config.apiBase}/api/miniprogram/wechat`, method: data ? "POST" : "GET", timeout: 20000,
    header: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    ...(data ? { data } : {}),
    success(response) {
      if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
      else reject(Object.assign(new Error(response.data?.code || "WECHAT_UNAVAILABLE"), { code: response.data?.code }));
    },
    fail() { reject(new Error("WECHAT_UNAVAILABLE")); },
  }));
}
function loginCode() {
  return new Promise((resolve, reject) => wx.login({
    timeout: 10000,
    success(result) { result.code ? resolve(result.code) : reject(new Error("WECHAT_CODE_EXPIRED")); },
    fail() { reject(new Error("WECHAT_CODE_EXPIRED")); },
  }));
}
async function wechatAuth(action, options = {}, authenticated = false) {
  // No identity request before the user's active consent. Codes are never persisted.
  if (options.agreed !== true) throw new Error("CONSENT_REQUIRED");
  const code = action === "unbind" ? undefined : await loginCode();
  return api({ ...options, action, ...(code ? { code } : {}) }, authenticated);
}
function acceptWechatSession(result) {
  const session = result.session;
  if (!session?.user?.id || !session.access_token || !session.refresh_token) throw new Error("LOGIN_RETRY");
  return storeSession(session);
}
module.exports = { wechatStatus: api, wechatAuth, acceptWechatSession, visibleEmail, errorText };
