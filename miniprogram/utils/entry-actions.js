const { deleteEntry } = require("./supabase");
const t = require("./locale-copy");
const reflection = "人生的每一步，未必都完美；记录的每一笔，也是如此。偶尔写错，也成了自己的历史。留下或删去，都由自己决定。";

async function confirmDeleteEntry(page, entry, listKey) {
  if (!entry?.id || page.deletingEntry) return;
  page.deletingEntry = true;
  const locale = page.data.locale || "zh";
  let loading = false;
  try {
    const answer = await new Promise(resolve => wx.showModal({
      title: t("删除这条记录？", locale),
      content: t(reflection, locale) + "\n\n" + t("确认删除后，文字、影像和留言会永久删除，无法恢复。", locale),
      confirmText: t("删除", locale), cancelText: t("保留", locale), confirmColor: "#a3463d",
      success: resolve, fail: () => resolve({ confirm: false }),
    }));
    if (!answer.confirm) return;
    loading = true;
    wx.showLoading({ title: t("正在删除", locale) });
    await deleteEntry(entry);
    // Use the captured ID, not an index that may have changed during the dialog.
    page.setData({ [listKey]: page.data[listKey].filter(item => item.id !== entry.id) });
    wx.hideLoading();
    loading = false;
    wx.showToast({ title: t("已删除", locale), icon: "success" });
  } catch (error) {
    if (loading) { wx.hideLoading(); loading = false; }
    wx.showToast({ title: t(error.message || "删除失败，请重试。", locale), icon: "none" });
  } finally {
    if (loading) wx.hideLoading();
    page.deletingEntry = false;
  }
}

module.exports = { confirmDeleteEntry };
