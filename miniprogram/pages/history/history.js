const Page = require("../../utils/localized-page");
const { getEntries, requireSession } = require("../../utils/supabase");
const { confirmDeleteEntry } = require("../../utils/entry-actions");
const { openShare } = require("../../utils/preferences");
const { formatDate } = require("../../utils/share-card");
const { decorateMedia } = require("../../utils/media-policy");
const { stamp, reusable } = require("../../utils/data-freshness");

const moodLabels = { calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" };
const categoryLabels = { daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" };

function decorate(entry) {
  return {
    ...entry,
    dateLabel: formatDate(entry.entry_date, getApp().globalData.profile?.locale || getApp().globalData.locale),
    moodLabel: moodLabels[entry.mood] || "平静",
    categoryLabel: categoryLabels[entry.category] || "日常",
    imageUrl: entry.entry_media?.[0]?.signed_url || "",
    media: decorateMedia(entry.entry_media),
    imageUrls: (entry.entry_media || []).filter(media => !String(media.media_type).startsWith("video/")).map((media) => media.signed_url).filter(Boolean),
  };
}

Page({
  data: { loading: true, entries: [], error: "", more: false, loadingMore: false },
  onShow() { return this.load(); },
  onPullDownRefresh() { this.load(true); },
  async load(fromPull = false) {
    const session = requireSession();
    if (!session) { this.freshness = null; this.setData({ entries: [], more: false, loading: false }); return; }
    if (!fromPull && reusable(this.freshness, session.user.id)) return;
    const started = stamp(session.user.id);
    const generation = this.loadGeneration = (this.loadGeneration || 0) + 1;
    const current = () => this.loadGeneration === generation && requireSession()?.user.id === session.user.id;
    if (this.ownerId !== session.user.id) this.setData({ entries: [], more: false });
    this.ownerId = session.user.id;
    this.setData({ loading: !fromPull && this.data.entries.length === 0, error: "" });
    try {
      const entries = await getEntries(session.user.id, 20);
      if (!current()) return;
      this.setData({ entries: entries.map(decorate), more: entries.length === 20 });
      this.freshness = started;
    } catch (error) {
      if (current()) this.setData({ error: error.message || "记录加载失败。" });
    } finally {
      if (this.loadGeneration === generation) this.setData({ loading: false });
      if (fromPull) wx.stopPullDownRefresh();
    }
  },
  async loadMore() {
    if (this.data.loadingMore || this.data.loading || !this.data.more) return;
    const session = requireSession(); if (!session) return;
    const generation = this.loadGeneration;
    this.setData({ loadingMore: true });
    try {
      const rows = await getEntries(session.user.id, 20, this.data.entries.length);
      if (this.loadGeneration !== generation || requireSession()?.user.id !== session.user.id) return;
      this.setData({ entries: [...this.data.entries, ...rows.map(decorate)], more: rows.length === 20 });
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ loadingMore: false }); }
  },
  openEntry(event) {
    const entry = this.data.entries[Number(event.currentTarget.dataset.index)];
    if (entry) wx.navigateTo({ url: `/pages/entry/entry?id=${encodeURIComponent(entry.id)}` });
  },
  previewPhoto(event) {
    const entry = this.data.entries[Number(event.currentTarget.dataset.entry)];
    if (entry?.imageUrls.length) wx.previewImage({ urls: entry.imageUrls, current: entry.imageUrls[Number(event.currentTarget.dataset.photo)] });
  },
  addEntry() { wx.navigateTo({ url: "/pages/record/record" }); },
  shareEntry(event) { openShare(this.data.entries[Number(event.currentTarget.dataset.index)], getApp().globalData.profile?.locale || getApp().globalData.locale); },
  removeEntry(event) {
    return confirmDeleteEntry(this, this.data.entries[Number(event.currentTarget.dataset.index)], "entries");
  },
});
