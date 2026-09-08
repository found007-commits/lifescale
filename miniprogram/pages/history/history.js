const Page = require("../../utils/localized-page");
const { getEntries, requireSession } = require("../../utils/supabase");
const { confirmDeleteEntry } = require("../../utils/entry-actions");
const { openShare } = require("../../utils/preferences");
const { formatDate } = require("../../utils/share-card");

const moodLabels = { calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" };
const categoryLabels = { daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" };

function decorate(entry) {
  return {
    ...entry,
    dateLabel: formatDate(entry.entry_date, getApp().globalData.profile?.locale || getApp().globalData.locale),
    moodLabel: moodLabels[entry.mood] || "平静",
    categoryLabel: categoryLabels[entry.category] || "日常",
    imageUrl: entry.entry_media?.[0]?.signed_url || "",
    imageUrls: (entry.entry_media || []).map((media) => media.signed_url).filter(Boolean),
  };
}

Page({
  data: { loading: true, entries: [], error: "" },
  onShow() { return this.load(); },
  onPullDownRefresh() { this.load(true); },
  async load(fromPull = false) {
    const session = requireSession();
    if (!session) return;
    this.setData({ loading: !fromPull, error: "" });
    try {
      const entries = await getEntries(session.user.id, 200);
      this.setData({ entries: entries.map(decorate) });
    } catch (error) {
      this.setData({ error: error.message || "记录加载失败。" });
    } finally {
      this.setData({ loading: false });
      if (fromPull) wx.stopPullDownRefresh();
    }
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
