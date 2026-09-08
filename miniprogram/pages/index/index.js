const Page = require("../../utils/localized-page");
const { ageOnDate, calculateLifeMetrics, localDateString } = require("../../utils/life");
const { getProfile, restoreSession } = require("../../utils/supabase");
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

  async onShow() {
    const session = restoreSession();
    if (!session?.user?.id) return;
    try {
      const profile = await getProfile(session.user.id);
      if (profile?.onboarding_completed) wx.switchTab({ url: "/pages/dashboard/dashboard" });
      else wx.redirectTo({ url: "/pages/onboarding/onboarding" });
    } catch {}
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

  goLogin() {
    if (this.data.preview) wx.setStorageSync("lifescale:miniprogram-draft", { birthDate: this.data.birthDate, targetAge: Number(this.data.targetAge) });
    wx.navigateTo({ url: "/pages/auth/auth" });
  },
});
