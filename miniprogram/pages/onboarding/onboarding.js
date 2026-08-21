const { ageOnDate, localDateString, targetDateFromAge } = require("../../utils/life");
const { createProfile, requireSession } = require("../../utils/supabase");

Page({
  data: {
    displayName: "",
    birthDate: "",
    targetAge: "90",
    minimumAge: 30,
    maxDate: localDateString(),
    confirmed: false,
    saving: false,
    error: "",
  },

  onLoad() {
    this.session = requireSession();
    if (!this.session) return;
    const draft = wx.getStorageSync("lifescale:miniprogram-draft");
    if (draft?.birthDate) {
      const minimumAge = Math.max(30, ageOnDate(draft.birthDate) + 1);
      this.setData({ birthDate: draft.birthDate, minimumAge, targetAge: String(Math.max(draft.targetAge || 90, minimumAge)) });
    }
  },

  onNameInput(event) { this.setData({ displayName: event.detail.value.slice(0, 30) }); },
  onBirthChange(event) {
    const birthDate = event.detail.value;
    const minimumAge = Math.max(30, ageOnDate(birthDate) + 1);
    this.setData({ birthDate, minimumAge, targetAge: String(Math.max(Number(this.data.targetAge) || 90, minimumAge)), error: "" });
  },
  onAgeInput(event) { this.setData({ targetAge: event.detail.value.replace(/\D/g, ""), error: "" }); },
  onConfirmChange(event) { this.setData({ confirmed: event.detail.value.includes("confirmed") }); },

  async saveProfile() {
    const targetAge = Number(this.data.targetAge);
    if (!this.data.birthDate) return this.setData({ error: "请填写出生日期。" });
    if (targetAge < this.data.minimumAge || targetAge > 150) return this.setData({ error: `目标年龄应为 ${this.data.minimumAge}-150 岁。` });
    if (!this.data.confirmed) return this.setData({ error: "请先确认这些重要数据已经核对无误。" });
    this.setData({ saving: true, error: "" });
    try {
      const now = new Date().toISOString();
      await createProfile({
        id: this.session.user.id,
        email: this.session.user.email,
        display_name: this.data.displayName.trim() || null,
        locale: "zh",
        timezone: "Asia/Shanghai",
        birth_date: this.data.birthDate,
        target_age: targetAge,
        target_date: targetDateFromAge(this.data.birthDate, targetAge),
        display_mode: "gentle",
        onboarding_completed: true,
        privacy_version: "2026-08-21",
        privacy_accepted_at: now,
      });
      wx.removeStorageSync("lifescale:miniprogram-draft");
      wx.reLaunch({ url: "/pages/dashboard/dashboard" });
    } catch (error) {
      this.setData({ error: error.message || "资料保存失败。" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
