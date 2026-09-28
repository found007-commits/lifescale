const { restoreSession, bootstrapDashboard } = require("./utils/supabase");
const { loadRuntimeConfig } = require("./utils/runtime-config");
const freshness = require("./utils/data-freshness");

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
    this.startDashboard();
  },

  // Start the dashboard's round trip now, not after the tab switch: someone who is already
  // signed in lands on "今天" anyway, and the index page still has to render before it can
  // switch tabs. This only moves the request earlier — it changes no permission and reads
  // nothing the page would not read a moment later.
  startDashboard() {
    const session = this.globalData.session;
    if (!session?.user?.id || typeof bootstrapDashboard !== "function") return;
    const revision = freshness.state.revision;
    // Rejected here deliberately: the page decides what a failure means, including falling
    // back to reading one thing at a time. A write before the first paint invalidates the
    // answer, so a stale bundle is dropped rather than replayed.
    this.dashboardBootstrap = bootstrapDashboard()
      .then(bundle => (bundle && freshness.state.revision === revision ? bundle : null))
      .catch(() => null);
  },
});
