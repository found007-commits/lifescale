const Page = require("../../utils/localized-page");
const { createEntry, uploadEntryImage, restoreSession, getProfile } = require("../../utils/supabase");
const { isWechatOnly, requiresWechatSetup } = require("../../utils/setup-policy");
const { topics, questionAt } = require("../../utils/record-prompts");
const { prepareMedia } = require("../../utils/prepare-media");
const { uuid } = require("../../utils/life");

// errno 112 means the privacy guideline does not declare the album scope, while 103 and 104
// mean the user declined the popup. All three need the same user action, so they share one
// message that deliberately does not tell the user to retry.
const PRIVACY_BLOCKED = "需要同意隐私保护指引后才能选择照片或视频。";
function privacyBlockMessage(error) {
  const errno = error?.errno;
  if (errno === 103 || errno === 104 || errno === 112) return PRIVACY_BLOCKED;
  return /privacy/i.test(error?.errMsg || "") ? PRIVACY_BLOCKED : "";
}

Page({
  data: {
    content: "",
    mood: "calm",
    category: "daily",
    images: [], processing: false, notice: "", progress: "", persisted: false,
    saving: false,
    error: "",
    privacyOpen: false,
    guest: true, saved: false, topics, topic: -1, promptIndex: 0, prompt: "", inspirationOpen: false, moodIndex: 0, categoryIndex: 0,
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

  onLoad() {
    this.entryId = uuid(); this.uploaded = new Set(); this.files = new Set();
    // WeChat raises this when an interface protected by the privacy guideline runs before the
    // user has agreed to it. The agreement can only be given from a button inside the popup,
    // so the platform's pending resolve waits here until the user answers.
    this.onPrivacyNeeded = (resolve) => { this.privacyResolve = resolve; this.setData({ privacyOpen: true }); };
    if (wx.onNeedPrivacyAuthorization) wx.onNeedPrivacyAuthorization(this.onPrivacyNeeded);
  },
  onShow() {
    this.session = restoreSession();
    this.setData({ guest: !this.session?.user?.id });
    const resume = this.pendingSave && this.resumeSave;
    this.pendingSave = false;
    this.resumeSave = false;
    if (resume && this.session?.user?.id) return this.saveEntry();
  },
  chooseTopic(event) {
    if (this.data.saving || this.data.persisted) return;
    const topic = Number(event.currentTarget.dataset.index);
    this.setData({ topic, promptIndex: 0, prompt: questionAt(topic) });
  },
  toggleInspiration() {
    if (this.data.saving || this.data.persisted) return;
    this.setData({ inspirationOpen: !this.data.inspirationOpen });
  },
  onMoodChange(event) {
    const index = Number(event.detail.value);
    if (this.data.saving || this.data.persisted || !Number.isInteger(index) || !this.data.moods[index]) return;
    this.setData({ moodIndex: index, mood: this.data.moods[index].value });
  },
  onCategoryChange(event) {
    const index = Number(event.detail.value);
    if (this.data.saving || this.data.persisted || !Number.isInteger(index) || !this.data.categories[index]) return;
    this.setData({ categoryIndex: index, category: this.data.categories[index].value });
  },
  nextPrompt() {
    if (this.data.saving || this.data.persisted) return;
    const promptIndex = this.data.promptIndex + 1;
    this.setData({ promptIndex, prompt: questionAt(this.data.topic, promptIndex) });
  },
  onUnload() {
    this.closed = true;
    if (wx.offNeedPrivacyAuthorization && this.onPrivacyNeeded) wx.offNeedPrivacyAuthorization(this.onPrivacyNeeded);
    // Answer the platform before leaving, so a blocked interface fails instead of hanging.
    this.settlePrivacy(false);
    this.files.forEach((filePath) => wx.getFileSystemManager().unlink({ filePath, fail() {} }));
  },
  settlePrivacy(agreed) {
    const resolve = this.privacyResolve;
    this.privacyResolve = null;
    if (!resolve) return;
    if (!this.closed) this.setData({ privacyOpen: false });
    resolve(agreed ? { buttonId: "privacy-agree", event: "agree" } : { event: "disagree" });
  },
  onPrivacyAgree() { this.settlePrivacy(true); },
  onPrivacyDecline() { this.settlePrivacy(false); },
  onPrivacyContract() {
    const openLocalPolicy = () => wx.navigateTo({ url: "/pages/legal/legal?type=privacy" });
    if (wx.openPrivacyContract) wx.openPrivacyContract({ fail: openLocalPolicy });
    else openLocalPolicy();
  },
  // Ask before the album picker runs, so the popup explains itself instead of an errno 104.
  ensurePrivacyAuthorized() {
    if (!wx.requirePrivacyAuthorize) return Promise.resolve(true);
    return new Promise((resolve) => {
      wx.requirePrivacyAuthorize({ success: () => resolve(true), fail: () => resolve(false) });
    });
  },
  onContentInput(event) { this.setData({ content: event.detail.value.slice(0, 12000), error: "" }); },
  async chooseImage() {
    if (this.picking || this.data.saving || this.data.persisted) return;
    this.picking = true; this.setData({ processing: true, error: "" });
    try {
      if (!(await this.ensurePrivacyAuthorized())) {
        this.setData({ error: PRIVACY_BLOCKED });
        return;
      }
      const result = await new Promise((resolve, reject) => wx.chooseMedia({ count: 9, mediaType: ["image", "video"], sourceType: ["album"], sizeType: ["original"], success: resolve, fail: reject }));
      if (result.tempFiles.some((file) => file.size > 10 * 1024 * 1024)) this.setData({ notice: "文件较大，处理和上传可能较慢，请保持页面打开。" });
      const canvas = this.canvas || await new Promise((resolve, reject) => wx.createSelectorQuery().in(this).select("#photoCanvas").fields({ node: true }).exec((rows) => rows[0]?.node ? resolve(rows[0].node) : reject(new Error("图片组件尚未准备好，请重试。"))));
      this.canvas = canvas;
      for (let i = 0; i < result.tempFiles.length; i++) {
        if (this.closed) break;
        const id = uuid();
        this.setData({ progress: `${i + 1} / ${result.tempFiles.length}`, images: [...this.data.images, { id, processing: true }] });
        try {
          const image = await prepareMedia(canvas, result.tempFiles[i]);
          if (this.closed) { wx.getFileSystemManager().unlink({ filePath: image.tempFilePath, fail() {} }); break; }
          this.files.add(image.tempFilePath);
          this.setData({ images: this.data.images.map((item) => item.id === id ? { id, ...image } : item) });
        } catch (error) {
          this.setData({ images: this.data.images.map((item) => item.id === id ? { id, error: error.message || "图片无法读取，请转存为 JPG 或 PNG。" } : item) });
        }
      }
    } catch (error) { if (!/cancel/i.test(error.errMsg || "")) this.setData({ error: privacyBlockMessage(error) || error.message || "选择图片失败，请重试。" }); }
    finally { this.picking = false; if (!this.closed) this.setData({ processing: false, progress: "" }); }
  },
  removeImage(event) {
    if (this.data.saving || this.data.persisted || this.data.processing) return;
    const image = this.data.images[Number(event.currentTarget.dataset.index)];
    if (image?.tempFilePath) { wx.getFileSystemManager().unlink({ filePath: image.tempFilePath, fail() {} }); this.files.delete(image.tempFilePath); }
    this.setData({ images: this.data.images.filter((item) => item.id !== image?.id) });
  },

  async saveEntry() {
    if (this.data.saving || this.data.saved || this.picking) return;
    if (!this.data.content.trim() && !this.data.images.length) return this.setData({ error: "写一句话，或添加图片、视频、GIF 后保存。" });
    if (this.data.images.some((image) => image.error || !image.tempFilePath)) return this.setData({ error: "请先移除无法读取的图片，再保存。" });
    this.session = restoreSession();
    if (!this.session?.user?.id) {
      if (this.pendingSave) return;
      this.pendingSave = true;
      wx.navigateTo({ url: "/pages/auth/auth?returnTo=record", fail: () => { this.pendingSave = false; } });
      return;
    }
    this.setData({ saving: true, error: "" });
    try {
      if (!this.data.persisted && isWechatOnly(this.session) && requiresWechatSetup(this.session, getApp().globalData.profile)) {
        const profile = await getProfile(this.session.user.id);
        if (requiresWechatSetup(this.session, profile)) {
          this.pendingSave = true;
          wx.navigateTo({ url: "/pages/onboarding/onboarding?required=1&returnTo=record", fail: () => { this.pendingSave = false; } });
          return;
        }
      }
      if (!this.data.persisted) {
        await createEntry({ id: this.entryId, userId: this.session.user.id, content: this.data.content.trim(), mood: this.data.mood, category: this.data.category });
        this.setData({ persisted: true });
      }
      for (let i = 0; i < this.data.images.length; i++) {
        if (this.closed) return;
        const image = this.data.images[i];
        if (this.uploaded.has(image.id)) continue;
        this.setData({ progress: `${i + 1} / ${this.data.images.length}` });
        await uploadEntryImage(this.session.user.id, this.entryId, image, image.id);
        this.uploaded.add(image.id);
      }
      this.setData({ saved: true });
      wx.showToast({ title: "今天已留下", icon: "success", duration: 1200 });
      setTimeout(() => { if (!this.closed) wx.reLaunch({ url: "/pages/history/history" }); }, 800);
    } catch (error) {
      this.setData({ error: (error.message || "记录保存失败。") + (this.data.persisted ? " 记录和已上传照片已保留，重试只继续剩余上传。" : "") });
    } finally {
      if (!this.closed) this.setData({ saving: false });
    }
  },
});
