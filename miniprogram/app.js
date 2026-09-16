const { restoreSession } = require("./utils/supabase");
const { loadRuntimeConfig } = require("./utils/runtime-config");

App({
  globalData: {
    session: null,
    profile: null,
    locale: "zh",
  },

  onLaunch() {
    this.globalData.session = restoreSession();
    const language = (wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync()).language || "zh";
    this.globalData.locale = /^zh[_-](tw|hk|mo|hant)/i.test(language) ? "zh-TW" : /^zh/i.test(language) ? "zh" : "en";
    try {
      const cached = wx.getStorageSync("lifescale:startup-locale");
      if (["zh", "zh-TW", "en"].includes(cached)) this.globalData.locale = cached;
    } catch {}
    // The service-config payload carries no language, so the device, the saved preference and
    // the signed-in profile decide it. This request only warms the connection cache; pages
    // await it so their first paint is not gated by it.
    this.localeReady = loadRuntimeConfig().catch(() => {});
  },
});
