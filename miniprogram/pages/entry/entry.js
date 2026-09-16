const Page = require("../../utils/localized-page");
const { requireSession, getEntry, signEntryMedia, getComments, addComment, editEntryOnce } = require("../../utils/supabase");
const { EDIT_NOTICE, EDIT_USED, canEdit, editChanged, editError } = require("../../utils/edit-policy");
const { decorateMedia } = require("../../utils/media-policy");
const { uuid } = require("../../utils/life");
const { openShare } = require("../../utils/preferences");
const t = require("../../utils/locale-copy");

Page({
  data: { entry: null, media: [], comments: [], loading: true, error: "", commentError: "", text: "", replyId: "", replyText: "", sending: false, more: false, commentsLoading: false,
    editing: false, editSaving: false, editError: "", editContent: "", editMood: "calm", editCategory: "daily", editAllowed: false,
    moods: [{value:"calm",label:"平静"},{value:"happy",label:"开心"},{value:"grateful",label:"感恩"},{value:"tired",label:"疲惫"},{value:"sad",label:"难过"},{value:"anxious",label:"焦虑"},{value:"hopeful",label:"充满希望"}],
    categories: [{value:"daily",label:"日常"},{value:"family",label:"家人"},{value:"work",label:"工作"},{value:"growth",label:"成长"},{value:"health",label:"健康"},{value:"travel",label:"旅行"},{value:"reflection",label:"感悟"},{value:"other",label:"其他"}],
    moodIndex: 0, categoryIndex: 0,
  },
  onLoad(options) { this.entryId = options.id; this.files = new Set(); this.load(); },
  onUnload() { this.closed = true; this.files.forEach(filePath => wx.getFileSystemManager().unlink({ filePath, fail() {} })); },
  onHide() { this.data.media.forEach((item, index) => { if (item.kind === "video" && item.active) wx.createVideoContext(`video-${index}`, this).pause(); }); },
  async load() {
    const session = requireSession();
    if (!session) return;
    this.setData({ loading: true, error: "" });
    try {
      const entry = await getEntry(this.entryId, session.user.id);
      if (this.closed) return;
      const media = decorateMedia((entry.entry_media || []).slice().sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
      this.setData({ entry, media, editAllowed: canEdit(entry), hasVideo: media.some(item => item.kind === "video") });
      await this.loadComments();
    } catch (error) { if (!this.closed) this.setData({ error: error.message || "记录加载失败。" }); }
    finally { if (!this.closed) this.setData({ loading: false }); }
  },
  startEdit() {
    if (!canEdit(this.data.entry) || this.data.editSaving) return;
    this.editRequestId = null;
    this.setData({ editing: true, editError: "", editContent: this.data.entry.content, editMood: this.data.entry.mood, editCategory: this.data.entry.category,
      moodIndex: this.data.moods.findIndex(item => item.value === this.data.entry.mood), categoryIndex: this.data.categories.findIndex(item => item.value === this.data.entry.category) });
  },
  cancelEdit() { if (!this.data.editSaving) this.setData({ editing: false, editError: "" }); },
  onEditContent(event) { if (!this.data.editSaving) this.setData({ editContent: event.detail.value.slice(0, 12000) }); },
  onEditMood(event) {
    const index = Number(event.detail.value); if (this.data.editSaving || !this.data.moods[index]) return;
    this.setData({ moodIndex: index, editMood: this.data.moods[index].value });
  },
  onEditCategory(event) {
    const index = Number(event.detail.value); if (this.data.editSaving || !this.data.categories[index]) return;
    this.setData({ categoryIndex: index, editCategory: this.data.categories[index].value });
  },
  async saveEdit() {
    if (this.data.editSaving || !this.data.editing) return;
    const values = { content: this.data.editContent.trim(), mood: this.data.editMood, category: this.data.editCategory };
    if (!editChanged(this.data.entry, values)) { this.setData({ editing: false }); return; }
    if (!values.content && !this.data.media.length) return this.setData({ editError: t("请保留文字或至少一个媒体文件。", this.data.locale) });
    if (!canEdit(this.data.entry)) return this.setData({ editError: t(EDIT_USED, this.data.locale) });
    this.setData({ editSaving: true, editError: "" });
    try {
      const answer = await new Promise(resolve => wx.showModal({ title: t("保存这次修改？", this.data.locale), content: t(EDIT_NOTICE, this.data.locale), confirmText: t("保存修改", this.data.locale), cancelText: t("再想想", this.data.locale), success: resolve, fail: () => resolve({confirm:false}) }));
      if (!answer.confirm || this.closed) return;
      const payload = JSON.stringify(values);
      if (!this.editRequestId || payload !== this.editPayload) { this.editRequestId = uuid(); this.editPayload = payload; }
      const entry = await editEntryOnce(this.entryId, values, this.editRequestId);
      if (this.closed) return;
      this.setData({ entry: { ...entry, entry_media: this.data.entry.entry_media }, editing: false, editAllowed: canEdit(entry) });
      wx.showToast({ title: t("修改已保存", this.data.locale), icon: "success" });
    } catch (error) { if (!this.closed) this.setData({ editError: t(editError(error), this.data.locale) }); }
    finally { if (!this.closed) this.setData({ editSaving: false }); }
  },
  async loadComments(append = false) {
    if (this.data.commentsLoading) return;
    this.setData({ commentsLoading: true, commentError: "" });
    try {
      const rows = await getComments(this.entryId, append ? this.data.comments.length : 0);
      if (!this.closed) this.setData({ comments: append ? [...this.data.comments, ...rows] : rows, more: rows.length === 30 });
    } catch (error) { if (!this.closed) this.setData({ commentError: error.message || "留言加载失败，请重试。" }); }
    finally { if (!this.closed) this.setData({ commentsLoading: false }); }
  },
  moreComments() { return this.loadComments(true); },
  retryComments() { return this.loadComments(); },
  async openMedia(event) {
    const index = Number(event.currentTarget.dataset.index), item = this.data.media[index];
    if (!item || item.loading) return;
    this.mediaRequests = this.mediaRequests || {};
    const request = this.mediaRequests[index] = (this.mediaRequests[index] || 0) + 1;
    const current = () => !this.closed && this.mediaRequests[index] === request;
    this.setData({ [`media[${index}].loading`]: true, [`media[${index}].error`]: "" });
    try {
      const signed = await signEntryMedia(item);
      if (current()) this.setData({ [`media[${index}].url`]: signed.signed_url, [`media[${index}].active`]: true });
    } catch { if (current()) this.setData({ [`media[${index}].error`]: "媒体加载失败，点此重试。" }); }
    finally { if (current()) this.setData({ [`media[${index}].loading`]: false }); }
  },
  closeMedia(event) {
    const index = Number(event.currentTarget.dataset.index), item = this.data.media[index];
    if (!item) return;
    this.mediaRequests = this.mediaRequests || {};
    this.mediaRequests[index] = (this.mediaRequests[index] || 0) + 1;
    if (item.kind === "video" && item.active) wx.createVideoContext(`video-${index}`, this).pause();
    this.setData({ [`media[${index}].active`]: false, [`media[${index}].url`]: "", [`media[${index}].loading`]: false, [`media[${index}].error`]: "" });
  },
  mediaError(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ [`media[${index}].active`]: false, [`media[${index}].url`]: "", [`media[${index}].error`]: "媒体加载失败，点此重试。" });
  },
  onText(event) { if (!this.data.sending) { this.commentId = null; this.setData({ text: event.detail.value, commentError: "" }); } },
  reply(event) {
    if (this.data.sending) return;
    const comment = this.data.comments.find(item => item.id === event.currentTarget.dataset.id);
    if (comment) { this.commentId = null; this.setData({ replyId: comment.id, replyText: comment.content }); }
  },
  cancelReply() { if (!this.data.sending) { this.commentId = null; this.setData({ replyId: "", replyText: "" }); } },
  async sendComment() {
    if (this.data.sending || !this.data.text.trim()) return;
    this.setData({ sending: true, commentError: "" });
    this.commentId = this.commentId || uuid();
    try {
      await addComment(this.entryId, this.data.text, this.data.replyId || null, this.commentId);
      if (this.closed) return;
      this.commentId = null;
      this.setData({ text: "", replyId: "", replyText: "" });
      await this.loadComments();
    } catch (error) { if (!this.closed) this.setData({ commentError: error.message || "留言未发送，请重试。" }); }
    finally { if (!this.closed) this.setData({ sending: false }); }
  },
  shareEntry() { openShare(this.data.entry, this.data.locale); },
  async shareMedia(event) {
    const item = this.data.media[Number(event.currentTarget.dataset.index)];
    if (!item || this.sharing) return;
    this.sharing = true;
    try {
      const method = item.kind === "video" ? "shareVideoMessage" : "showShareImageMenu";
      if (typeof wx[method] !== "function") throw new Error("当前微信暂不支持，请更新微信后重试。");
      const signed = await signEntryMedia(item);
      const result = await new Promise((resolve, reject) => wx.downloadFile({ url: signed.signed_url, timeout: 600000, success: resolve, fail: reject }));
      if (result.statusCode !== 200) throw new Error("下载失败，请重试。");
      this.files.add(result.tempFilePath);
      if (this.closed) { wx.getFileSystemManager().unlink({ filePath: result.tempFilePath, fail() {} }); return; }
      await new Promise((resolve, reject) => wx[method]({ filePath: result.tempFilePath, path: result.tempFilePath, success: resolve, fail: reject }));
    } catch (error) { if (!this.closed && !/cancel/i.test(error.errMsg || "")) wx.showToast({ title: t(error.message || "分享失败，请重试。", this.data.locale), icon: "none" }); }
    finally { this.sharing = false; }
  },
});
