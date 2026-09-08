const config = require("../config");
let ready = null;
let inFlight = null;

// Public service configuration only. Share one request across startup and API calls;
// never persist credentials, user data or a failed request.
function loadRuntimeConfig(language = "") {
  if (ready) return Promise.resolve(ready);
  if (inFlight) return inFlight;
  inFlight = new Promise((resolve, reject) => wx.request({
    url: `${config.apiBase}/api/miniprogram/config`, method: "GET", timeout: 4000,
    header: language ? { "Accept-Language": language.replace("_", "-") } : {},
    success(response) {
      const body = response.data;
      if (response.statusCode !== 200 || !body?.supabaseUrl?.startsWith("https://") || !body.publishableKey) {
        reject(new Error("服务配置暂不可用。"));
        return;
      }
      ready = { supabaseUrl: body.supabaseUrl, publishableKey: body.publishableKey, locale: body.locale };
      resolve(ready);
    },
    fail() { reject(new Error("网络连接失败。")); },
  })).finally(() => { inFlight = null; });
  return inFlight;
}

module.exports = { loadRuntimeConfig };
