const t = require("./locale-copy");
const { formatDate } = require("./share-card");

function currentLocale() {
  return getApp().globalData.profile?.locale || getApp().globalData.locale || "zh";
}

module.exports = function localizedPage(definition) {
  const show = definition.onShow;
  definition.data = { ...definition.data, locale: "zh" };
  definition.onShow = async function (...args) {
    if (getApp().localeReady) await getApp().localeReady;
    this.setData({ locale: currentLocale() });
    const result = show ? await show.apply(this, args) : undefined;
    const locale = currentLocale();
    const localized = { locale };
    if (this.data.birthDate) localized.birthLabel = formatDate(this.data.birthDate, locale);
    if (this.data.genderLabels) localized.genderPickerLabels = this.data.genderLabels.map((label) => t(label, locale));
    if (this.data.modes) localized.modePickerLabels = this.data.modes.map((label) => t(label, locale));
    this.setData(localized);
    const titles = { index: "余生有刻", auth: "邮箱验证码登录", onboarding: "第一次设定", dashboard: "我的人生刻度", history: "留下的日子", report: "回望七天", settings: "个人偏好", record: "记录今天", share: "分享这一天", legal: this.data.document?.title || "隐私政策" };
    const name = this.route.split("/").pop();
    wx.setNavigationBarTitle({ title: t(titles[name] || "余生有刻", currentLocale()) });
    ["我的人生刻度", "留下的日子", "回望七天", "个人偏好"].forEach((text, index) => wx.setTabBarItem({ index, text: t(text, currentLocale()), fail() {} }));
    return result;
  };
  return Page(definition);
};
