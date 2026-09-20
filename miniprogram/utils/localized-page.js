const t = require("./locale-copy");
const { formatDate } = require("./share-card");
const withAppShare = require("./app-share");

// Navigation bar and tab bar writes cross the JS-native bridge. Remember the last
// applied (locale, page, document title) so repeated onShow passes can skip them.
let lastApplied = "";

function currentLocale() {
  return getApp().globalData.profile?.locale || getApp().globalData.locale || "zh";
}

module.exports = function localizedPage(definition) {
  const show = definition.onShow;
  const hide = definition.onHide;
  const unload = definition.onUnload;
  definition.data = { ...definition.data, locale: "zh" };
  function applyLocale() {
    const locale = currentLocale();
    const localized = { locale };
    if (this.data.birthDate) localized.birthLabel = formatDate(this.data.birthDate, locale);
    if (this.data.genderLabels) localized.genderPickerLabels = this.data.genderLabels.map((label) => t(label, locale));
    if (this.data.modes) localized.modePickerLabels = this.data.modes.map((label) => t(label, locale));
    if (this.data.moods) localized.moodPickerLabels = this.data.moods.map((item) => t(item.label, locale));
    if (this.data.categories) localized.categoryPickerLabels = this.data.categories.map((item) => t(item.label, locale));
    ["entries", "recentEntries"].forEach(key => {
      if (Array.isArray(this.data[key])) this.data[key].forEach((entry, index) => {
        if (!entry.entry_date) return;
        const dateLabel = formatDate(entry.entry_date, locale);
        if (dateLabel !== entry.dateLabel) localized[`${key}[${index}].dateLabel`] = dateLabel;
      });
    });
    // Avoid repeated JS-to-view bridge writes for identical locale labels.
    Object.keys(localized).forEach(key => {
      if (key.includes("[")) return;
      const previous = this.data[key];
      const next = localized[key];
      if (previous === next || (Array.isArray(previous) && Array.isArray(next) && previous.length === next.length && previous.every((value, index) => value === next[index]))) delete localized[key];
    });
    if (Object.keys(localized).length) this.setData(localized);
    const pages = getCurrentPages();
    const name = (this.route || pages[pages.length - 1]?.route || "pages/index/index").split("/").pop();
    // Text only changes with the language or the active page; the document title is part
    // of the key because the legal page shows two different documents.
    const stamp = `${locale}|${name}|${this.data.document?.title || ""}`;
    if (stamp === lastApplied && this.appliedNavigationStamp === stamp) return;
    lastApplied = stamp;
    this.appliedNavigationStamp = stamp;
    const titles = { index: "余生有刻", auth: "登录余生有刻", onboarding: "第一次设定", dashboard: "我的人生刻度", history: "留下的日子", report: "回望七天", settings: "个人偏好", record: "记录今天", entry: "这一天", share: "分享这一天", legal: this.data.document?.title || "隐私政策", space: "我的精神圣所", editor: "编辑圣所", tribute: "留下一段致意" };
    wx.setNavigationBarTitle({ title: t(titles[name] || "余生有刻", locale) });
    ["历史", "今天", "小回顾", "设置"].forEach((text, index) => wx.setTabBarItem({ index, text: t(text, locale), fail() {} }));
  }
  definition.onShow = async function (...args) {
    const generation = this.localeGeneration = (this.localeGeneration || 0) + 1;
    this.localeActive = true;
    const update = () => {
      if (this.localeActive && this.localeGeneration === generation) applyLocale.call(this);
    };
    // Render and start page work immediately. IP language lookup is not a gate.
    update();
    getApp().localeReady?.then(update).catch(() => {});
    const result = show ? await show.apply(this, args) : undefined;
    update();
    return result;
  };
  definition.onHide = function (...args) { this.localeActive = false; return hide?.apply(this, args); };
  definition.onUnload = function (...args) { this.localeActive = false; return unload?.apply(this, args); };
  return Page(withAppShare(definition));
};
