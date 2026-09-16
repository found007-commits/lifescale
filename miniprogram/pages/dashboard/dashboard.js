const Page = require("../../utils/localized-page");
const { calculateLifeMetrics } = require("../../utils/life");
const { getCheckins, getCheckinCount, getEntries, getProfile, updateProfile, requireSession } = require("../../utils/supabase");
const { journeyMessage, openShare } = require("../../utils/preferences");
const { formatDate } = require("../../utils/share-card");
const { confirmDeleteEntry } = require("../../utils/entry-actions");
const { requiresWechatSetup } = require("../../utils/setup-policy");
const { decorateMedia } = require("../../utils/media-policy");
const { stamp, reusable } = require("../../utils/data-freshness");

const moodLabels = { calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" };
const categoryLabels = { daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" };

function decorateEntry(entry) {
  return {
    ...entry,
    dateLabel: formatDate(entry.entry_date, getApp().globalData.profile?.locale),
    moodLabel: moodLabels[entry.mood] || "平静",
    categoryLabel: categoryLabels[entry.category] || "日常",
    imageUrl: entry.entry_media?.[0]?.signed_url || "",
    media: decorateMedia(entry.entry_media),
    imageUrls: (entry.entry_media || []).filter(media => !String(media.media_type).startsWith("video/")).map((media) => media.signed_url).filter(Boolean),
  };
}

Page({
  data: { loading: true, profile: null, metrics: null, recentEntries: [], checkedToday: false, checkinCount: 0, journeyMessage: "", switching: false, error: "", detailsOpen: false },

  onShow() { return this.load(); },
  onPullDownRefresh() { this.load(true); },

  async load(fromPull = false) {
    const session = requireSession();
    if (!session) { this.freshness = null; this.setData({ profile: null, metrics: null, recentEntries: [], loading: false }); return; }
    if (!fromPull && reusable(this.freshness, session.user.id)) return;
    const started = stamp(session.user.id);
    const generation = this.loadGeneration = (this.loadGeneration || 0) + 1;
    const current = () => this.loadGeneration === generation && requireSession()?.user.id === session.user.id;
    if (this.data.profile?.id !== session.user.id) this.setData({ profile: null, metrics: null, recentEntries: [] });
    this.setData({ loading: !fromPull && !this.data.profile, error: "" });
    try {
      // A WeChat account must prove its profile is complete before any entry is read, so the
      // profile lookup stays ahead of the reads. Email accounts have no such gate, but the
      // three reads below already run together, so this is one round trip either way.
      const profile = await getProfile(session.user.id);
      if (!current()) return;
      if (requiresWechatSetup(session, profile)) {
        wx.reLaunch({ url: "/pages/onboarding/onboarding?required=1" });
        return;
      }
      if (!profile?.onboarding_completed) {
        this.setData({ profile: null, metrics: null });
        return;
      }
      const metrics = calculateLifeMetrics({ birthDate: profile.birth_date, targetAge: profile.target_age, targetDate: profile.target_date });
      this.setData({
        profile,
        loading: false,
        metrics: {
          ...metrics,
          displayDays: metrics.isBonus ? metrics.bonusDays : metrics.remainingDays,
          displayDaysText: String(metrics.isBonus ? metrics.bonusDays : metrics.remainingDays).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
          livedDaysText: String(metrics.livedDays).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
          weeksText: String(metrics.remainingWeeks).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
          progressText: metrics.progress.toFixed(2),
        },
      });
      const [entries, checkins, checkinCount] = await Promise.all([getEntries(session.user.id, 3), getCheckins(session.user.id, 7), getCheckinCount(session.user.id)]);
      if (!current()) return;
      this.setData({
        recentEntries: entries.map(decorateEntry),
        checkedToday: checkins.some((item) => item.checkin_date === metrics.today),
        checkinCount,
        journeyMessage: journeyMessage(checkinCount),
      });
      this.freshness = started;
    } catch (error) {
      if (current()) this.setData({ error: error.message || "人生刻度加载失败。" });
    } finally {
      if (this.loadGeneration === generation) this.setData({ loading: false });
      if (fromPull) wx.stopPullDownRefresh();
    }
  },

  previewPhoto(event) {
    const entry = this.data.recentEntries[Number(event.currentTarget.dataset.entry)];
    if (entry?.imageUrls.length) wx.previewImage({ urls: entry.imageUrls, current: entry.imageUrls[Number(event.currentTarget.dataset.photo)] });
  },
  recordToday() { wx.navigateTo({ url: "/pages/record/record" }); },
  openEntry(event) {
    const entry = this.data.recentEntries[Number(event.currentTarget.dataset.index)];
    if (entry) wx.navigateTo({ url: `/pages/entry/entry?id=${encodeURIComponent(entry.id)}` });
  },
  toggleDetails() { this.setData({ detailsOpen: !this.data.detailsOpen }); },
  setupTimeline() { wx.navigateTo({ url: "/pages/onboarding/onboarding" }); },
  shareEntry(event) { openShare(this.data.recentEntries[Number(event.currentTarget.dataset.index)], this.data.profile?.locale); },
  removeEntry(event) { return confirmDeleteEntry(this, this.data.recentEntries[Number(event.currentTarget.dataset.index)], "recentEntries"); },
  async setMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!this.data.profile || this.data.switching || !["gentle", "clear"].includes(mode) || this.data.profile.display_mode === mode) return;
    const previous = this.data.profile;
    this.setData({ switching: true, profile: { ...previous, display_mode: mode } });
    try {
      const profile = await updateProfile(this.data.profile.id, { display_mode: mode });
      this.setData({ profile });
    } catch (error) { this.setData({ profile: previous }); wx.showToast({ title: error.message || "保存失败", icon: "none" }); }
    finally { this.setData({ switching: false }); }
  },
  viewHistory() { wx.switchTab({ url: "/pages/history/history" }); },
});
