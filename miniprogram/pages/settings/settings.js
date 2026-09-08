const Page = require("../../utils/localized-page");
const { clearSession, deleteAccount, exportAccount, getProfile, updateProfile, requireSession } = require("../../utils/supabase");
const { genders, genderLabels } = require("../../utils/preferences");
const { formatDate } = require("../../utils/share-card");
const t = require("../../utils/locale-copy");
const { targetPolicy, targetError } = require("../../utils/target-policy");
const { normalizeAge } = require("../../utils/preferences");
const { targetDateFromAge, localDateString } = require("../../utils/life");
const { wechatStatus, visibleEmail } = require("../../utils/wechat-auth");

Page({
  data: { loading: true, email: "", profile: null, deleting: false, saving: false, error: "", genders, genderLabels, genderIndex: 7, displayName: "", localeIndex: 0, languages: ["简体中文", "繁體中文", "English"], modes: ["温和模式", "清醒模式"], modeIndex: 0 },
  onShow() { return this.load(); },
  async load() {
    const session = requireSession();
    if (!session) return;
    this.session = session;
    this.setData({ loading: true, email: visibleEmail(session.user.email), loginStatus: null, error: "" });
    wechatStatus(undefined, true).then(loginStatus => this.setData({ loginStatus })).catch(() => {});
    try {
      const profile = await getProfile(session.user.id);
      this.setData({ profile, displayName: profile?.display_name || "", genderIndex: Math.max(0, genders.indexOf(profile?.gender_identity || "private")), localeIndex: Math.max(0, ["zh", "zh-TW", "en"].indexOf(profile?.locale)), modeIndex: profile?.display_mode === "clear" ? 1 : 0, birthLabel: formatDate(profile?.birth_date, profile?.locale), targetLabel: formatDate(profile?.target_date, profile?.locale) });
      this.refreshTargetPolicy();
    } catch (error) {
      this.setData({ error: error.message || "资料加载失败。" });
    } finally {
      this.setData({ loading: false });
    }
  },
  openLegal(event) { wx.navigateTo({ url: `/pages/legal/legal?type=${event.currentTarget.dataset.type}` }); },
  setupTimeline() { wx.navigateTo({ url: "/pages/onboarding/onboarding" }); },
  manageWechat() {
    if (!this.data.loginStatus?.enabled || !this.data.email) return;
    wx.navigateTo({ url: `/pages/auth/auth?mode=${this.data.loginStatus.bound ? 'unbind' : 'bind'}` });
  },
  refreshTargetPolicy() {
    const policy = targetPolicy(this.data.profile);
    const next = policy.nextAt ? new Date(policy.nextAt) : null;
    const label = next ? formatDate(localDateString(next), this.data.locale) + ` ${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}` : "";
    this.setData({ policy, targetAgeInput: String(this.data.profile?.target_age || ""), nextTargetLabel: label });
  },
  onTargetAgeInput(event) { const value = normalizeAge(event.detail.value); this.setData({ targetAgeInput: value }); return value; },
  async adjustTarget() {
    const policy = targetPolicy(this.data.profile), age = Number(this.data.targetAgeInput);
    if (this.data.adjusting || !policy.canChange) return;
    if (!Number.isInteger(age) || age < 30 || age > 150 || targetDateFromAge(this.data.profile.birth_date, age) <= localDateString()) return this.setData({ error: t("请选择尚未到达的目标年龄（30-150 岁）。", this.data.locale) });
    const date = targetDateFromAge(this.data.profile.birth_date, age);
    if (age === this.data.profile.target_age && date === this.data.profile.target_date) return;
    const en = this.data.locale === "en";
    const confirmation = en ? `New target: ${age} years. This uses one adjustment; ${policy.remaining - 1} will remain. The next change requires another full year.` : this.data.locale === "zh-TW" ? `新目標：${age} 歲。本次將使用一次機會，之後剩餘 ${policy.remaining - 1} 次；下次調整需再滿一年。` : `新目标：${age} 岁。本次将使用一次机会，之后剩余 ${policy.remaining - 1} 次；下次调整需再满一年。`;
    this.setData({ adjusting: true, error: "" });
    try {
      const answer = await new Promise((resolve, reject) => wx.showModal({ title: t("确认调整目标？", this.data.locale), content: confirmation, confirmText: t("确认调整", this.data.locale), success: resolve, fail: reject }));
      if (!answer.confirm) return;
      const profile = await updateProfile(this.session.user.id, { target_age: age, target_date: date });
      this.setData({ profile, targetLabel: formatDate(profile.target_date, this.data.locale) });
      this.refreshTargetPolicy();
      wx.showToast({ title: t("已保存", this.data.locale), icon: "success" });
    } catch (error) { this.setData({ error: t(targetError(error.message || "保存失败，请重试。", en), this.data.locale) }); }
    finally { this.setData({ adjusting: false }); }
  },
  onNameInput(event) { this.setData({ displayName: event.detail.value }); },
  onGenderChange(event) { this.setData({ genderIndex: Number(event.detail.value) }); },
  onLocaleChange(event) { this.setData({ localeIndex: Number(event.detail.value) }); },
  onModeChange(event) { this.setData({ modeIndex: Number(event.detail.value) }); },
  async savePreferences() {
    if (this.data.saving) return;
    this.setData({ saving: true, error: "" });
    try {
      const profile = await updateProfile(this.session.user.id, { display_name: this.data.displayName.trim() || null, gender_identity: genders[this.data.genderIndex], locale: ["zh", "zh-TW", "en"][this.data.localeIndex], display_mode: this.data.modeIndex ? "clear" : "gentle" });
      this.setData({ profile, locale: profile.locale, genderPickerLabels: genderLabels.map((label) => t(label, profile.locale)), modePickerLabels: this.data.modes.map((label) => t(label, profile.locale)), birthLabel: formatDate(profile.birth_date, profile.locale), targetLabel: formatDate(profile.target_date, profile.locale) });
      this.refreshTargetPolicy();
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  },
  async exportData() {
    if (this.exporting) return;
    this.exporting = true;
    wx.showLoading({ title: "正在导出" });
    let filePath;
    try {
      const data = await exportAccount();
      filePath = `${wx.env.USER_DATA_PATH}/lifescale-export-${Date.now()}.json`;
      await new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({ filePath, data: JSON.stringify(data, null, 2), encoding: "utf8", success: resolve, fail: reject }));
      wx.hideLoading();
      await new Promise((resolve) => wx.showModal({ title: "导出已准备好", content: "文件含你的私人数据。请选择“文件传输助手”或你信任的接收方保存。", confirmText: "选择保存", success: (result) => {
        if (result.confirm && wx.shareFileMessage) wx.shareFileMessage({ filePath, fileName: "LifeScale-我的数据.json", complete: resolve });
        else resolve();
      }, fail: resolve }));
    } catch (error) { wx.showToast({ title: error.message || "导出失败", icon: "none" }); }
    finally {
      if (filePath) wx.getFileSystemManager().unlink({ filePath, fail() {} });
      wx.hideLoading(); this.exporting = false;
    }
  },
  signOut() {
    wx.showModal({ title: "退出登录？", content: "你的记录仍会安全保存在账户中。", success: (result) => {
      if (!result.confirm) return;
      clearSession();
      wx.reLaunch({ url: "/pages/index/index" });
    } });
  },
  removeAccount() {
    wx.showModal({
      title: "永久注销账户？",
      content: "所有个人资料、记录和照片都会永久删除，无法恢复。",
      confirmText: "继续注销",
      confirmColor: "#a3463d",
      success: (first) => {
        if (!first.confirm) return;
        wx.showModal({
          title: "最后确认",
          content: `将永久删除 ${this.data.email} 及其全部数据。`,
          confirmText: "永久删除",
          confirmColor: "#a3463d",
          success: async (second) => {
            if (!second.confirm) return;
            this.setData({ deleting: true });
            wx.showLoading({ title: "正在注销" });
            try {
              await deleteAccount();
              clearSession();
              wx.reLaunch({ url: "/pages/index/index" });
            } catch (error) {
              wx.showToast({ title: error.message || "注销失败", icon: "none" });
            } finally {
              wx.hideLoading();
              this.setData({ deleting: false });
            }
          },
        });
      },
    });
  },
});
