const config = require("../config");
let ready = null;
let inFlight = null;
const CACHE_KEY = "lifescale:public-config:v1";
// Only a rotated key changes this payload. A cached copy is served before the network so a
// cold start never waits on the API, and the refresh launched on every hit rewrites savedAt
// — so widening this window does not leave a rotated key in place for the whole window.
const CACHE_TTL = 24 * 60 * 60 * 1000;
function valid(body) {
  return body?.supabaseUrl?.startsWith("https://") && (!config.supabaseUrl || body.supabaseUrl === config.supabaseUrl) && typeof body.publishableKey === "string" && body.publishableKey.length > 0;
}

// Public service configuration only. Share one request across startup and API calls;
// Persist only public configuration, never sessions, user data or failed requests.
function loadRuntimeConfig() {
  if (ready) return Promise.resolve(ready);
  try {
    const cached = wx.getStorageSync(CACHE_KEY);
    if (cached?.apiBase === config.apiBase && cached.savedAt <= Date.now() && Date.now() - cached.savedAt < CACHE_TTL && valid(cached.value)) {
      ready = { supabaseUrl: cached.value.supabaseUrl, publishableKey: cached.value.publishableKey };
      refreshConfig().catch(() => {});
      return Promise.resolve(ready);
    }
  } catch {}
  return refreshConfig();
}
function refreshConfig() {
  if (inFlight) return inFlight;
  inFlight = new Promise((resolve, reject) => wx.request({
    url: `${config.apiBase}/api/miniprogram/service-config`, method: "GET", timeout: 4000,
    success(response) {
      const body = response.data;
      if (response.statusCode !== 200 || !valid(body)) {
        reject(new Error("服务配置暂不可用。"));
        return;
      }
      ready = { supabaseUrl: body.supabaseUrl, publishableKey: body.publishableKey };
      try { wx.setStorageSync(CACHE_KEY, { apiBase: config.apiBase, savedAt: Date.now(), value: ready }); } catch {}
      resolve(ready);
    },
    fail() { reject(new Error("网络连接失败。")); },
  })).finally(() => { inFlight = null; });
  return inFlight;
}

module.exports = { loadRuntimeConfig };
