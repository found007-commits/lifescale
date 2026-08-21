const { clearSession, deleteAccount, getProfile, requireSession } = require("../../utils/supabase");

Page({
  data: { loading: true, email: "", profile: null, lockDate: "", deleting: false, error: "" },
  onShow() { this.load(); },
  async load() {
    const session = requireSession();
    if (!session) return;
    this.session = session;
    this.setData({ loading: true, email: session.user.email || "", error: "" });
    try {
      const profile = await getProfile(session.user.id);
      const lockDate = profile?.target_locked_until ? new Date(profile.target_locked_until).toLocaleDateString("zh-CN") : "";
      this.setData({ profile, lockDate });
    } catch (error) {
      this.setData({ error: error.message || "资料加载失败。" });
    } finally {
      this.setData({ loading: false });
    }
  },
  openLegal(event) { wx.navigateTo({ url: `/pages/legal/legal?type=${event.currentTarget.dataset.type}` }); },
  signOut() {
    wx.showModal({ title: "退出登录？", content: "你的记录仍会安全保存在账户中。", success: (result) => {
      if (!result.confirm) return;
      clearSession();
      wx.reLaunch({ url: "/pages/index/index" });
    } });
  },
  removeAccount() {
    wx.showModal({
      title: "永久注销账户？",
      content: "所有个人资料、记录和照片都会永久删除，无法恢复。",
      confirmText: "继续注销",
      confirmColor: "#a3463d",
      success: (first) => {
        if (!first.confirm) return;
        wx.showModal({
          title: "最后确认",
          content: `将永久删除 ${this.data.email} 及其全部数据。`,
          confirmText: "永久删除",
          confirmColor: "#a3463d",
          success: async (second) => {
            if (!second.confirm) return;
            this.setData({ deleting: true });
            wx.showLoading({ title: "正在注销" });
            try {
              await deleteAccount();
              clearSession();
              wx.reLaunch({ url: "/pages/index/index" });
            } catch (error) {
              wx.showToast({ title: error.message || "注销失败", icon: "none" });
            } finally {
              wx.hideLoading();
              this.setData({ deleting: false });
            }
          },
        });
      },
    });
  },
});
