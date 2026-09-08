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
    this.localeReady = loadRuntimeConfig(language).then(result => {
      if (["zh", "zh-TW", "en"].includes(result.locale)) {
        this.globalData.locale = result.locale;
        try { wx.setStorageSync("lifescale:startup-locale", result.locale); } catch {}
      }
    }).catch(() => {});
  },
});
