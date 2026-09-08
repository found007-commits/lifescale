const Page = require("../../utils/localized-page");
const { calculateLifeMetrics } = require("../../utils/life");
const { getCheckins, getCheckinCount, getEntries, getProfile, updateProfile, requireSession } = require("../../utils/supabase");
const { journeyMessage, openShare } = require("../../utils/preferences");
const { formatDate } = require("../../utils/share-card");

const moodLabels = { calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" };
const categoryLabels = { daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" };

function decorateEntry(entry) {
  return {
    ...entry,
    dateLabel: formatDate(entry.entry_date, getApp().globalData.profile?.locale),
    moodLabel: moodLabels[entry.mood] || "平静",
    categoryLabel: categoryLabels[entry.category] || "日常",
    imageUrl: entry.entry_media?.[0]?.signed_url || "",
    imageUrls: (entry.entry_media || []).map((media) => media.signed_url).filter(Boolean),
  };
}

Page({
  data: { loading: true, profile: null, metrics: null, recentEntries: [], checkedToday: false, checkinCount: 0, journeyMessage: "", switching: false, error: "" },

  onShow() { return this.load(); },
  onPullDownRefresh() { this.load(true); },

  async load(fromPull = false) {
    const session = requireSession();
    if (!session) return;
    this.setData({ loading: !fromPull, error: "" });
    try {
      const profile = await getProfile(session.user.id);
      if (!profile?.onboarding_completed) {
        this.setData({ profile: null, metrics: null });
        return;
      }
      const [entries, checkins, checkinCount] = await Promise.all([getEntries(session.user.id, 3), getCheckins(session.user.id, 7), getCheckinCount(session.user.id)]);
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
        checkinCount,
        journeyMessage: journeyMessage(checkinCount),
      });
    } catch (error) {
      this.setData({ error: error.message || "人生刻度加载失败。" });
    } finally {
      this.setData({ loading: false });
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  previewPhoto(event) {
    const entry = this.data.recentEntries[Number(event.currentTarget.dataset.entry)];
    if (entry?.imageUrls.length) wx.previewImage({ urls: entry.imageUrls, current: entry.imageUrls[Number(event.currentTarget.dataset.photo)] });
  },
  recordToday() { wx.navigateTo({ url: "/pages/record/record" }); },
  setupTimeline() { wx.navigateTo({ url: "/pages/onboarding/onboarding" }); },
  shareEntry(event) { openShare(this.data.recentEntries[Number(event.currentTarget.dataset.index)], this.data.profile?.locale); },
  async setMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!this.data.profile || this.data.switching || !["gentle", "clear"].includes(mode)) return;
    this.setData({ switching: true });
    try {
      const profile = await updateProfile(this.data.profile.id, { display_mode: mode });
      this.setData({ profile });
    } catch (error) { wx.showToast({ title: error.message || "保存失败", icon: "none" }); }
    finally { this.setData({ switching: false }); }
  },
  viewHistory() { wx.switchTab({ url: "/pages/history/history" }); },
});
