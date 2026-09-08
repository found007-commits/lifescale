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

  onLoad(options = {}) { this.browsing = options.browse === "1"; },
  onShow() {
    const session = restoreSession();
    if (session?.user?.id) wx.switchTab({ url: "/pages/dashboard/dashboard" });
    else if (!this.browsing) wx.redirectTo({ url: "/pages/auth/auth" });
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
