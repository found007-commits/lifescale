const { restoreSession } = require("./utils/supabase");

App({
  globalData: {
    session: null,
    profile: null,
  },

  onLaunch() {
    this.globalData.session = restoreSession();
  },
});
