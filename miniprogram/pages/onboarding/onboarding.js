const Page = require("../../utils/localized-page");
const { ageOnDate, localDateString, targetDateFromAge } = require("../../utils/life");
const { createProfile, requireSession } = require("../../utils/supabase");
const { genders, genderLabels, normalizeAge } = require("../../utils/preferences");
const { formatDate } = require("../../utils/share-card");
const { isWechatOnly } = require("../../utils/setup-policy");

Page({
  data: {
    displayName: "",
    birthDate: "",
    targetAge: "",
    genders, genderLabels, genderIndex: -1,
    minimumAge: 30,
    maxDate: localDateString(),
    confirmed: false,
    saving: false,
    error: "",
    requiredSetup: false,
  },

  onLoad(options = {}) {
    this.session = requireSession();
    if (!this.session) return;
    this.returnTo = options.returnTo === "record" ? "record" : "";
    this.setData({ requiredSetup: options.required === "1" || isWechatOnly(this.session) });
    const draft = wx.getStorageSync("lifescale:miniprogram-draft");
    if (draft?.birthDate) {
      const minimumAge = Math.max(30, ageOnDate(draft.birthDate) + 1);
      this.setData({ birthDate: draft.birthDate, birthLabel: formatDate(draft.birthDate), minimumAge, targetAge: normalizeAge(draft.targetAge) });
    }
  },

  onNameInput(event) { this.setData({ displayName: event.detail.value.slice(0, 30) }); },
  skipSetup() { if (!this.data.saving && !this.data.requiredSetup) wx.switchTab({ url: "/pages/history/history" }); },
  onBirthChange(event) {
    const birthDate = event.detail.value;
    const minimumAge = Math.max(30, ageOnDate(birthDate) + 1);
    this.setData({ birthDate, birthLabel: formatDate(birthDate, this.data.locale), minimumAge, error: "" });
  },
  onAgeInput(event) { const value = normalizeAge(event.detail.value); this.setData({ targetAge: value, error: "" }); return value; },
  chooseGender(event) { this.setData({ genderIndex: Number(event.detail.value) }); },
  onConfirmChange(event) { this.setData({ confirmed: event.detail.value.includes("confirmed") }); },

  async saveProfile() {
    if (this.data.saving || !this.session) return;
    const targetAge = Number(this.data.targetAge);
    if (!this.data.birthDate) return this.setData({ error: "请填写出生日期。" });
    if (this.data.genderIndex < 0) return this.setData({ error: "请选择性别，也可以选择保密。" });
    if (!Number.isInteger(targetAge) || targetAge < this.data.minimumAge || targetAge > 150) return this.setData({ error: `目标年龄应为 ${this.data.minimumAge}-150 岁。` });
    if (!this.data.confirmed) return this.setData({ error: "请先确认这些重要数据已经核对无误。" });
    this.setData({ saving: true, error: "" });
    try {
      const now = new Date().toISOString();
      await createProfile({
        id: this.session.user.id,
        email: this.session.user.email,
        display_name: this.data.displayName.trim() || null,
        gender_identity: genders[this.data.genderIndex],
        locale: this.data.locale || getApp().globalData.locale || "zh",
        timezone: "Asia/Shanghai",
        birth_date: this.data.birthDate,
        target_age: targetAge,
        target_date: targetDateFromAge(this.data.birthDate, targetAge),
        display_mode: "gentle",
        onboarding_completed: true,
        privacy_version: "2026-09-07",
        privacy_accepted_at: now,
      });
      wx.removeStorageSync("lifescale:miniprogram-draft");
      const composer = this.returnTo === "record" ? getCurrentPages().slice(-2)[0] : null;
      if (composer?.route === "pages/record/record") {
        composer.resumeSave = true;
        wx.navigateBack();
        return;
      }
      wx.reLaunch({ url: "/pages/dashboard/dashboard" });
    } catch (error) {
      this.setData({ error: error.message || "资料保存失败。" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
