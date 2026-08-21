const { ageOnDate, calculateLifeMetrics, localDateString } = require("../../utils/life");
const { getProfile, restoreSession } = require("../../utils/supabase");

Page({
  data: {
    birthDate: "",
    targetAge: "90",
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
    const targetAge = Math.max(Number(this.data.targetAge) || 90, minimumAge);
    this.setData({ birthDate, minimumAge, targetAge: String(targetAge), preview: null });
  },

  onAgeInput(event) {
    this.setData({ targetAge: event.detail.value.replace(/\D/g, ""), preview: null });
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
