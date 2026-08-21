const { calculateLifeMetrics } = require("../../utils/life");
const { getCheckins, getEntries, getProfile, requireSession } = require("../../utils/supabase");

const moodLabels = { calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" };
const categoryLabels = { daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" };

function decorateEntry(entry) {
  const date = new Date(entry.entry_date);
  return {
    ...entry,
    dateLabel: `${date.getMonth() + 1}月${date.getDate()}日`,
    moodLabel: moodLabels[entry.mood] || "平静",
    categoryLabel: categoryLabels[entry.category] || "日常",
    imageUrl: entry.entry_media?.[0]?.signed_url || "",
  };
}

Page({
  data: { loading: true, profile: null, metrics: null, recentEntries: [], checkedToday: false, checkinCount: 0, error: "" },

  onShow() { this.load(); },
  onPullDownRefresh() { this.load(true); },

  async load(fromPull = false) {
    const session = requireSession();
    if (!session) return;
    this.setData({ loading: !fromPull, error: "" });
    try {
      const profile = await getProfile(session.user.id);
      if (!profile?.onboarding_completed) {
        wx.redirectTo({ url: "/pages/onboarding/onboarding" });
        return;
      }
      const [entries, checkins] = await Promise.all([getEntries(session.user.id, 3), getCheckins(session.user.id, 365)]);
      const metrics = calculateLifeMetrics({ birthDate: profile.birth_date, targetAge: profile.target_age, targetDate: profile.target_date });
      this.setData({
        profile,
        metrics: {
          ...metrics,
          displayDays: metrics.isBonus ? metrics.bonusDays : metrics.remainingDays,
          displayDaysText: String(metrics.isBonus ? metrics.bonusDays : metrics.remainingDays).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
          livedDaysText: String(metrics.livedDays).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
          weeksText: String(metrics.remainingWeeks).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
          progressText: metrics.progress.toFixed(2),
        },
        recentEntries: entries.map(decorateEntry),
        checkedToday: checkins.some((item) => item.checkin_date === metrics.today),
        checkinCount: checkins.length,
      });
    } catch (error) {
      this.setData({ error: error.message || "人生刻度加载失败。" });
    } finally {
      this.setData({ loading: false });
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  recordToday() { wx.navigateTo({ url: "/pages/record/record" }); },
  viewHistory() { wx.switchTab({ url: "/pages/history/history" }); },
});
