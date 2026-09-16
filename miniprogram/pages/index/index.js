const Page = require("../../utils/localized-page");
const { ageOnDate, calculateLifeMetrics, localDateString } = require("../../utils/life");
const { restoreSession } = require("../../utils/supabase");
const { normalizeAge } = require("../../utils/preferences");
const { formatDate } = require("../../utils/share-card");

Page({
  data: {
    birthDate: "",
    targetAge: "",
    maxDate: localDateString(),
    minimumAge: 30,
    preview: null,
  },

  onShow() {
    const session = restoreSession();
    // Guests (including old shared links) stay on the usable public homepage.
    // Only an existing usable session takes the shortcut to private records.
    if (session?.access_token && session.user?.id &&
      (session.refresh_token || !session.expires_at || session.expires_at * 1000 > Date.now())) {
      wx.switchTab({ url: "/pages/dashboard/dashboard" });
    }
  },

  onBirthChange(event) {
    const birthDate = event.detail.value;
    const minimumAge = Math.max(30, ageOnDate(birthDate) + 1);
    this.setData({ birthDate, birthLabel: formatDate(birthDate, this.data.locale), minimumAge, preview: null });
  },

  onAgeInput(event) {
    const value = normalizeAge(event.detail.value);
    this.setData({ targetAge: value, preview: null });
    return value;
  },

  previewScale() {
    const targetAge = Number(this.data.targetAge);
    if (!this.data.birthDate || targetAge < this.data.minimumAge || targetAge > 150) {
      wx.showToast({ title: `目标年龄应为 ${this.data.minimumAge}-150 岁`, icon: "none" });
      return;
    }
    const preview = calculateLifeMetrics({ birthDate: this.data.birthDate, targetAge });
    this.setData({ preview });
  },

  startWriting() { wx.navigateTo({ url: "/pages/record/record" }); },
  goLogin() {
    if (this.data.preview) wx.setStorageSync("lifescale:miniprogram-draft", { birthDate: this.data.birthDate, targetAge: Number(this.data.targetAge) });
    wx.navigateTo({ url: this.data.preview ? "/pages/auth/auth?returnTo=onboarding" : "/pages/auth/auth" });
  },
});
