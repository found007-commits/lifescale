"use client";

import { useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";

type Providers = { google: boolean; apple: boolean; facebook: boolean; email: boolean };

export function AuthPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [providers, setProviders] = useState<Providers>({ google: false, apple: false, facebook: false, email: false });
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/config").then((r) => r.json() as Promise<{ providers: Providers }>).then((r) => setProviders(r.providers)).catch(() => undefined); }, []);
  if (!open) return null;

  async function social(provider: "google" | "apple" | "facebook") {
    if (!providers[provider]) { setStatus(`${provider[0].toUpperCase()}${provider.slice(1)} sign-in will activate after final provider approval.`); return; }
    await authClient.signIn.social({ provider, callbackURL: "/" });
  }

  async function sendCode() {
    if (!providers.email) { setStatus("Email delivery will activate after the sending domain is verified."); return; }
    setBusy(true); setStatus("");
    const response = await fetch("/api/auth/email-otp/send-verification-otp", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, type: "sign-in" }),
    });
    setBusy(false);
    if (!response.ok) { setStatus("We could not send a code. Please try again shortly."); return; }
    setStep("otp"); setStatus("A six-digit code is on its way.");
  }

  async function verifyCode() {
    setBusy(true); setStatus("");
    const response = await fetch("/api/auth/sign-in/email-otp", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    setBusy(false);
    if (!response.ok) { setStatus("That code is invalid or has expired."); return; }
    window.location.reload();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <p className="kicker">YOUR PRIVATE SPACE</p>
        <h2 id="auth-title">Begin with one quiet moment.</h2>
        <p className="auth-intro">Sign in to keep your timeline and memories safely connected across devices.</p>
        <div className="social-grid">
          <button onClick={() => social("google")}><span className="provider-g">G</span> Continue with Google</button>
          <button onClick={() => social("apple")}><span className="provider-apple">●</span> Continue with Apple</button>
          <button onClick={() => social("facebook")}><span className="provider-f">f</span> Continue with Facebook</button>
        </div>
        <div className="or"><span>or use email</span></div>
        {step === "email" ? (
          <div className="email-row">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" />
            <button className="primary-button" disabled={busy || !email.includes("@") } onClick={sendCode}>{busy ? "Sending…" : "Send code"}</button>
          </div>
        ) : (
          <div className="email-row">
            <input inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code" aria-label="Verification code" />
            <button className="primary-button" disabled={busy || otp.length !== 6} onClick={verifyCode}>{busy ? "Checking…" : "Continue"}</button>
          </div>
        )}
        {status && <p className="form-status" role="status">{status}</p>}
        <p className="legal-note">By continuing, you agree to the <a href="/terms">Terms</a> and acknowledge the <a href="/privacy">Privacy Notice</a>.</p>
      </section>
    </div>
  );
}
