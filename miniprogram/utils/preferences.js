const genders = ["male", "female", "l", "g", "b", "t", "q", "private"];
const genderLabels = ["男", "女", "L", "G", "B", "T", "Q", "保密"];
function normalizeAge(value) { return String(value || "").replace(/\D/g, "").replace(/^0+/, "").slice(0, 3); }
function journeyMessage(days) {
  if (days === 100) return "不要让大数据分析你，不要让别人定义你，回望一下你的一百天，继续前进！";
  if (days === 30) return "回看这些日子，但不急着评价自己。留下真实的感受，继续往前。";
  if (days === 7) return "看看什么占据了你的时间，也看看什么值得带进下一个七天。";
  if (days <= 1) return "从第一天开始，让今天由你自己的话来定义。先不急着总结自己，留下一个真实的时刻。";
  return "不必让数据定义自己。写下一件你看见、感受或做过的事。";
}
function openShare(entry, locale) {
  if (!entry) return;
  if ((entry.entry_media || []).some(item => String(item.media_type).startsWith("video/"))) {
    wx.showModal({ title: "分享视频", content: "图片分享卡不能播放视频。请打开这一天，选择视频下方的分享按钮，发送原视频。", confirmText: "打开记录", success: result => {
      if (result.confirm) wx.navigateTo({ url: `/pages/entry/entry?id=${encodeURIComponent(entry.id)}` });
    } });
    return;
  }
  wx.navigateTo({ url: "/pages/share/share", success: (result) => result.eventChannel.emit("entry", { entry, locale }) });
}
module.exports = { genders, genderLabels, normalizeAge, journeyMessage, openShare };
