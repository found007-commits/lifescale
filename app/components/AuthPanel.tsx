"use client";

import { useEffect, useState } from "react";
import type { Locale } from "../../lib/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase/client";

const messages = {
  zh: {
    eyebrow: "邮箱注册 / 登录", title: "从此刻开始。", intro: "输入邮箱，我们会发送六位验证码。首次登录后，你将郑重设定属于自己的余生刻度。",
    email: "你的邮箱地址", send: "发送验证码", sending: "正在发送…", sent: "六位验证码已发送，请查看邮箱。", code: "六位验证码",
    verify: "验证并继续", verifying: "正在验证…", change: "更换邮箱", resend: "重新发送", configured: "邮件服务正在配置，请稍后再试。",
    sendError: "验证码发送失败，请稍后再试。", verifyError: "验证码不正确或已过期，请重新获取。", legalA: "继续即表示你同意",
    terms: "服务条款", legalB: "并知悉", privacy: "隐私说明",
  },
  en: {
    eyebrow: "EMAIL SIGN UP / SIGN IN", title: "Begin from here.", intro: "Enter your email for a six-digit code. On your first sign-in, you will carefully set your personal life horizon.",
    email: "Your email address", send: "Send code", sending: "Sending…", sent: "Your six-digit code has been sent.", code: "Six-digit code",
    verify: "Verify and continue", verifying: "Verifying…", change: "Change email", resend: "Send again", configured: "Email sign-in is being configured. Please try again shortly.",
    sendError: "We could not send the code. Please try again.", verifyError: "That code is incorrect or expired. Request a new one.", legalA: "By continuing, you agree to the ",
    terms: "Terms", legalB: " and acknowledge the ", privacy: "Privacy Notice",
  },
} as const;

export function AuthPanel({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: Locale }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const t = messages[locale];

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (!open) return null;

  async function sendCode() {
    if (!isSupabaseConfigured()) { setStatus(t.configured); return; }
    setBusy(true); setStatus("");
    const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) { setStatus(error.message || t.sendError); return; }
    setStep("otp"); setCooldown(60); setStatus(t.sent);
  }

  async function verifyCode() {
    setBusy(true); setStatus("");
    const { error } = await getSupabaseBrowserClient().auth.verifyOtp({ email: email.trim().toLowerCase(), token: otp, type: "email" });
    setBusy(false);
    if (error) { setStatus(error.message || t.verifyError); return; }
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" onClick={onClose} aria-label={locale === "zh" ? "关闭" : "Close"}>×</button>
        <p className="kicker">{t.eyebrow}</p>
        <h2 id="auth-title">{t.title}</h2>
        <p className="auth-intro">{t.intro}</p>
        {step === "email" ? (
          <div className="email-row">
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t.email} aria-label={t.email} autoComplete="email" />
            <button className="primary-button" disabled={busy || !email.includes("@")} onClick={sendCode}>{busy ? t.sending : t.send}</button>
          </div>
        ) : (
          <>
            <p className="otp-destination">{t.sent} <strong>{email}</strong></p>
            <div className="email-row">
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder={t.code} aria-label={t.code} />
              <button className="primary-button" disabled={busy || otp.length !== 6} onClick={verifyCode}>{busy ? t.verifying : t.verify}</button>
            </div>
            <div className="otp-secondary-actions">
              <button className="change-email" onClick={() => { setStep("email"); setOtp(""); setStatus(""); }}>{t.change}</button>
              <button className="change-email" disabled={cooldown > 0 || busy} onClick={sendCode}>{cooldown > 0 ? `${t.resend} ${cooldown}s` : t.resend}</button>
            </div>
          </>
        )}
        {status ? <p className="form-status" role="status">{status}</p> : null}
        <p className="legal-note">{t.legalA}<a href="/terms">{t.terms}</a>{t.legalB}<a href="/privacy">{t.privacy}</a>。</p>
      </section>
    </div>
  );
}
