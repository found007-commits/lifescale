const { localDateString } = require("../../utils/life");
const { getCheckins, getEntries, requireSession } = require("../../utils/supabase");

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
  onShow() { this.load(); },
  onPullDownRefresh() { this.load(true); },
  async load(fromPull = false) {
    const session = requireSession();
    if (!session) return;
    this.setData({ loading: !fromPull, error: "" });
    try {
      const [entries, checkins] = await Promise.all([getEntries(session.user.id, 100), getCheckins(session.user.id, 100)]);
      this.setData({ report: makeReport(entries, checkins) });
    } catch (error) {
      this.setData({ error: error.message || "报告加载失败。" });
    } finally {
      this.setData({ loading: false });
      if (fromPull) wx.stopPullDownRefresh();
    }
  },
  recordToday() { wx.navigateTo({ url: "/pages/record/record" }); },
});
