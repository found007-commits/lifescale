const Page = require("../../utils/localized-page");
const { localDateString } = require("../../utils/life");
const { getCheckins, getEntries, requireSession } = require("../../utils/supabase");
const { stamp, reusable } = require("../../utils/data-freshness");

const moodLabels = { calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" };
const categoryLabels = { daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" };

function startDateString() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return localDateString(date);
}

function makeReport(entries, checkins) {
  const start = startDateString();
  const end = localDateString();
  const periodEntries = entries.filter((entry) => entry.entry_date.slice(0, 10) >= start && entry.entry_date.slice(0, 10) <= end);
  const recordedDates = new Set(checkins.filter((item) => item.checkin_date >= start && item.checkin_date <= end).map((item) => item.checkin_date));
  const moods = {};
  const categories = {};
  periodEntries.forEach((entry) => {
    moods[entry.mood] = (moods[entry.mood] || 0) + 1;
    categories[entry.category] = (categories[entry.category] || 0) + 1;
  });
  const moodTotal = Math.max(1, periodEntries.length);
  const moodRows = Object.keys(moods).map((key) => ({ key, label: moodLabels[key], count: moods[key], width: Math.round(moods[key] / moodTotal * 100) })).sort((a, b) => b.count - a.count);
  const topCategoryKey = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0];
  return { start, end, entryCount: periodEntries.length, recordedDays: recordedDates.size, moodRows, topCategory: topCategoryKey ? categoryLabels[topCategoryKey] : "", hasData: periodEntries.length > 0 };
}

Page({
  data: { loading: true, report: null, error: "" },
  onShow() { return this.load(); },
  onPullDownRefresh() { this.load(true); },
  async load(fromPull = false) {
    const session = requireSession();
    if (!session) { this.freshness = null; this.setData({ report: null, loading: false }); return; }
    if (!fromPull && reusable(this.freshness, session.user.id)) return;
    const started = stamp(session.user.id);
    const generation = this.loadGeneration = (this.loadGeneration || 0) + 1;
    const current = () => this.loadGeneration === generation && requireSession()?.user.id === session.user.id;
    if (this.ownerId !== session.user.id) this.setData({ report: null });
    this.ownerId = session.user.id;
    this.setData({ loading: !fromPull && !this.data.report, error: "" });
    try {
      const [entries, checkins] = await Promise.all([getEntries(session.user.id, 100, 0, { includeMedia: false }), getCheckins(session.user.id, 100)]);
      if (!current()) return;
      this.setData({ report: makeReport(entries, checkins) });
      this.freshness = started;
    } catch (error) {
      if (current()) this.setData({ error: error.message || "报告加载失败。" });
    } finally {
      if (this.loadGeneration === generation) this.setData({ loading: false });
      if (fromPull) wx.stopPullDownRefresh();
    }
  },
  recordToday() { wx.navigateTo({ url: "/pages/record/record" }); },
});
