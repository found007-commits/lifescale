const { restoreSession } = require("./utils/supabase");
const config = require("./config");

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
    this.localeReady = new Promise((resolve) => wx.request({
      url: `${config.apiBase}/api/miniprogram/config`, timeout: 4000,
      header: { "Accept-Language": language.replace("_", "-") },
      success: (result) => {
        if (["zh", "zh-TW", "en"].includes(result.data?.locale)) this.globalData.locale = result.data.locale;
      },
      complete: resolve,
    }));
  },
});
