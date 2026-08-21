const { createEntry, requireSession } = require("../../utils/supabase");

Page({
  data: {
    content: "",
    mood: "calm",
    category: "daily",
    image: null,
    saving: false,
    error: "",
    moods: [
      { value: "calm", label: "平静" }, { value: "happy", label: "开心" }, { value: "grateful", label: "感恩" },
      { value: "tired", label: "疲惫" }, { value: "sad", label: "难过" }, { value: "anxious", label: "焦虑" }, { value: "hopeful", label: "充满希望" },
    ],
    categories: [
      { value: "daily", label: "日常" }, { value: "family", label: "家人" }, { value: "work", label: "工作" },
      { value: "growth", label: "成长" }, { value: "health", label: "健康" }, { value: "travel", label: "旅行" },
      { value: "reflection", label: "感悟" }, { value: "other", label: "其他" },
    ],
  },

  onLoad() { this.session = requireSession(); },
  onContentInput(event) { this.setData({ content: event.detail.value.slice(0, 2000), error: "" }); },
  chooseMood(event) { this.setData({ mood: event.currentTarget.dataset.value }); },
  chooseCategory(event) { this.setData({ category: event.currentTarget.dataset.value }); },
  chooseImage() {
    wx.chooseMedia({ count: 1, mediaType: ["image"], sizeType: ["compressed"], success: (result) => {
      const image = result.tempFiles[0];
      if (image.size > 10 * 1024 * 1024) wx.showToast({ title: "照片不能超过 10MB", icon: "none" });
      else this.setData({ image });
    } });
  },
  removeImage() { this.setData({ image: null }); },

  async saveEntry() {
    if (!this.session) return;
    if (!this.data.content.trim() && !this.data.image) return this.setData({ error: "写一句话或选择一张照片后再保存。" });
    this.setData({ saving: true, error: "" });
    try {
      await createEntry({ userId: this.session.user.id, content: this.data.content.trim(), mood: this.data.mood, category: this.data.category, image: this.data.image });
      wx.showToast({ title: "今天已留下", icon: "success", duration: 1200 });
      setTimeout(() => wx.reLaunch({ url: "/pages/dashboard/dashboard" }), 800);
    } catch (error) {
      this.setData({ error: error.message || "记录保存失败。" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
