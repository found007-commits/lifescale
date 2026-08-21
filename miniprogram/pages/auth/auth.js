const { getProfile, sendOtp, verifyOtp } = require("../../utils/supabase");

Page({
  data: {
    email: "",
    code: "",
    sent: false,
    sending: false,
    verifying: false,
    seconds: 0,
    error: "",
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
  },

  onEmailInput(event) {
    this.setData({ email: event.detail.value.trim(), error: "" });
  },

  onCodeInput(event) {
    this.setData({ code: event.detail.value.replace(/\D/g, "").slice(0, 6), error: "" });
  },

  startCountdown() {
    if (this.timer) clearInterval(this.timer);
    this.setData({ seconds: 60 });
    this.timer = setInterval(() => {
      const seconds = this.data.seconds - 1;
      this.setData({ seconds });
      if (seconds <= 0) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 1000);
  },

  async sendCode() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.data.email)) {
      this.setData({ error: "请输入有效的邮箱地址。" });
      return;
    }
    this.setData({ sending: true, error: "" });
    try {
      await sendOtp(this.data.email);
      this.setData({ sent: true });
      this.startCountdown();
      wx.showToast({ title: "验证码已发送", icon: "success" });
    } catch (error) {
      this.setData({ error: error.message || "验证码发送失败。" });
    } finally {
      this.setData({ sending: false });
    }
  },

  async verifyCode() {
    if (!/^\d{6}$/.test(this.data.code)) {
      this.setData({ error: "请输入邮件中的 6 位验证码。" });
      return;
    }
    this.setData({ verifying: true, error: "" });
    try {
      const session = await verifyOtp(this.data.email, this.data.code);
      const profile = await getProfile(session.user.id);
      if (profile?.onboarding_completed) wx.reLaunch({ url: "/pages/dashboard/dashboard" });
      else wx.redirectTo({ url: "/pages/onboarding/onboarding" });
    } catch (error) {
      this.setData({ error: error.message || "验证码错误或已失效。" });
    } finally {
      this.setData({ verifying: false });
    }
  },
});
