const Page = require("../../utils/localized-page");
const { getProfile, sendOtp, verifyOtp, restoreSession } = require("../../utils/supabase");
const { wechatStatus, wechatAuth, acceptWechatSession, visibleEmail, errorText } = require("../../utils/wechat-auth");
const t = require("../../utils/locale-copy");
const { requiresWechatSetup } = require("../../utils/setup-policy");

Page({
  data: {
    email: "",
    code: "",
    sent: false,
    sending: false,
    verifying: false,
    seconds: 0,
    error: "",
    agreed: false,
    wechatEnabled: false,
    wechatChecking: true,
    wechatBusy: false,
    accountChoice: false,
    binding: false,
    manageMode: "",
  },

  onLoad(options = {}) {
    this.unloaded = false;
    this.returnTo = ["record", "onboarding"].includes(options.returnTo) ? options.returnTo : "";
    const manageMode = ["bind", "unbind"].includes(options.mode) ? options.mode : "";
    const existing = restoreSession();
    if (!manageMode && !this.returnTo && existing?.access_token && existing.user?.id &&
      (existing.refresh_token || !existing.expires_at || existing.expires_at * 1000 > Date.now())) {
      // Routing is local; the destination still authenticates every data request.
      wx.switchTab({ url: "/pages/dashboard/dashboard" });
      return;
    }
    if (manageMode) {
      const session = restoreSession();
      if (!session?.user?.id || !visibleEmail(session.user.email)) {
        wx.navigateBack();
        return;
      }
      this.setData({ manageMode, binding: manageMode === "bind", email: visibleEmail(session.user.email) });
    }
    wechatStatus().then(status => {
      if (!this.unloaded) this.setData({ wechatEnabled: status.enabled === true });
    }).catch(() => {}).finally(() => {
      if (!this.unloaded) this.setData({ wechatChecking: false });
    });
  },
  onUnload() {
    this.unloaded = true;
    if (this.timer) clearInterval(this.timer);
  },

  onEmailInput(event) {
    this.setData({ email: event.detail.value.trim(), error: "" });
  },

  onConsentChange(event) {
    this.setData({ agreed: event.detail.value.includes("agree"), error: "" });
  },

  checkConsent() {
    if (this.data.agreed === true) return true;
    this.setData({ error: t("请先阅读并自行选择是否同意服务条款和隐私政策。", this.data.locale) });
    return false;
  },

  browseWithoutLogin() {
    if (this.data.manageMode || this.returnTo === "record" && getCurrentPages().slice(-2)[0]?.route === "pages/record/record") wx.navigateBack();
    else wx.reLaunch({ url: "/pages/index/index?browse=1" });
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
    if (!this.checkConsent()) return;
    if (this.data.sending || this.data.verifying || this.data.wechatBusy || this.data.seconds > 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.data.email)) {
      this.setData({ error: "请输入有效的邮箱地址。" });
      return;
    }
    this.setData({ sending: true, error: "" });
    try {
      await sendOtp(this.data.email, !this.data.binding && !this.data.manageMode);
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
    if (!this.checkConsent()) return;
    if (this.data.verifying || this.data.sending || this.data.wechatBusy) return;
    if (!/^\d{6}$/.test(this.data.code)) {
      this.setData({ error: "请输入邮件中的 6 位验证码。" });
      return;
    }
    this.setData({ verifying: true, error: "" });
    try {
      let session;
      if (this.data.binding || this.data.manageMode) {
        const result = await wechatAuth(this.data.manageMode || "bind", { agreed: this.data.agreed, email: this.data.email, otp: this.data.code }, Boolean(this.data.manageMode));
        if (result.bindingConflict) {
          await this.notice("绑定未更改", "此微信或邮箱已绑定其他账户，不能自动合并。你仍可进入刚验证的邮箱账户，原记录不受影响。");
        } else await this.notice(result.unbound ? "已解除微信绑定" : "微信绑定成功", result.unbound ? "以后请使用邮箱登录。已有登录设备不会被自动退出。" : "下次可用微信直接进入这个账户，原记录和人生目标不变。");
        session = acceptWechatSession(result);
      } else session = await verifyOtp(this.data.email, this.data.code);
      await this.finishLogin(session);
    } catch (error) {
      this.setData({ error: this.data.binding || this.data.manageMode ? errorText(error, this.data.locale) : error.message || "验证码错误或已失效。" });
    } finally {
      this.setData({ verifying: false });
    }
  },

  async finishLogin(session, newWechatAccount = false) {
    if (this.data.manageMode) { wx.navigateBack(); return; }
    const profile = await getProfile(session.user.id);
    if (requiresWechatSetup(session, profile) || newWechatAccount && !profile?.onboarding_completed) {
      const resumeRecord = this.returnTo === "record" && getCurrentPages().slice(-2)[0]?.route === "pages/record/record";
      wx.redirectTo({ url: "/pages/onboarding/onboarding?required=1" + (resumeRecord ? "&returnTo=record" : "") });
      return;
    }
    if (this.returnTo === "record" && getCurrentPages().slice(-2)[0]?.route === "pages/record/record") {
      // Resume only after this explicit, consented login completed successfully.
      getCurrentPages().slice(-2)[0].resumeSave = true;
      wx.navigateBack();
    }
    else if (profile?.onboarding_completed) wx.reLaunch({ url: "/pages/dashboard/dashboard" });
    else if (this.returnTo === "onboarding") wx.redirectTo({ url: "/pages/onboarding/onboarding" });
    else wx.reLaunch({ url: "/pages/history/history" });
  },
  notice(title, content) {
    return new Promise(resolve => wx.showModal({ title: t(title, this.data.locale), content: t(content, this.data.locale), showCancel: false, complete: resolve }));
  },
  chooseExisting() { this.setData({ binding: true, accountChoice: false, error: "" }); },
  useEmailOnly() { this.setData({ binding: false, accountChoice: false, error: "" }); },
  async loginWithWechat() { return this.runWechat("login"); },
  async createWechatAccount() {
    // The explicit "I'm new" choice is the confirmation. No second native modal.
    if (!this.data.accountChoice || this.data.binding || this.data.manageMode) return;
    return this.runWechat("create");
  },
  async runWechat(action) {
    if (!this.checkConsent() || this.data.wechatBusy || this.data.sending || this.data.verifying) return;
    this.setData({ wechatBusy: true, error: "" });
    try {
      const result = await wechatAuth(action, { agreed: this.data.agreed, newAccountConfirmed: action === "create" });
      if (result.needsAccountChoice) this.setData({ accountChoice: true });
      else await this.finishLogin(acceptWechatSession(result), action === "create");
    } catch (error) { this.setData({ error: errorText(error, this.data.locale) }); }
    finally { this.setData({ wechatBusy: false }); }
  },
});
