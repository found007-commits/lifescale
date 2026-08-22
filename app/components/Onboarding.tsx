"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { ageOnDate, calculateLifeMetrics, daysBetween, targetDateFromAge, todayInTimeZone } from "../../lib/life-calculations";
import { createProfile } from "../../lib/lifescale-data";
import type { LifeProfile, Locale } from "../../lib/types";
import { Brand } from "./Brand";
import { TargetAgeField } from "./TargetAgeField";

const PRIVACY_VERSION = "2026-08-22";

export function Onboarding({ session, onComplete }: { session: Session; onComplete: (profile: LifeProfile) => void }) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = todayInTimeZone(timezone);
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [targetType, setTargetType] = useState<"age" | "date">("age");
  const [targetAge, setTargetAge] = useState("90");
  const [targetDate, setTargetDate] = useState("");
  const [locale, setLocale] = useState<Locale>("zh");
  const [accepted, setAccepted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const en = locale === "en";

  useEffect(() => {
    try {
      const draft = JSON.parse(window.localStorage.getItem("lifescale:preview-draft") || "null") as { birthDate?: string; targetAge?: number; targetDate?: string; locale?: Locale } | null;
      if (!draft) return;
      const frame = window.requestAnimationFrame(() => {
        if (draft.birthDate) setBirthDate(draft.birthDate);
        if (draft.targetAge) setTargetAge(String(draft.targetAge));
        if (draft.targetDate) setTargetDate(draft.targetDate);
        if (draft.locale) setLocale(draft.locale);
      });
      return () => window.cancelAnimationFrame(frame);
    } catch { /* Ignore a malformed non-authoritative preview draft. */ }
  }, []);

  const currentAge = birthDate ? ageOnDate(birthDate, today) : 0;
  const minimumAge = Math.max(30, currentAge + 1);
  const numericTargetAge = Number.parseInt(targetAge, 10);
  const resolvedTargetDate = useMemo(() => {
    if (!birthDate) return "";
    if (targetType === "date") return targetDate;
    if (!Number.isInteger(numericTargetAge) || numericTargetAge < minimumAge || numericTargetAge > 150) return "";
    try { return targetDateFromAge(birthDate, numericTargetAge); } catch { return ""; }
  }, [birthDate, minimumAge, numericTargetAge, targetDate, targetType]);
  const validTarget = Boolean(
    birthDate && resolvedTargetDate && daysBetween(today, resolvedTargetDate) > 0 && daysBetween(targetDateFromAge(birthDate || "2000-01-01", 30), resolvedTargetDate) >= 0,
  );
  const metrics = validTarget ? calculateLifeMetrics({ birthDate, targetAge: targetType === "age" ? numericTargetAge : null, targetDate: resolvedTargetDate, timeZone: timezone }) : null;

  async function finish() {
    if (!accepted || !confirmed || !validTarget || !session.user.email) return;
    setBusy(true); setError("");
    try {
      const profile = await createProfile({
        id: session.user.id,
        email: session.user.email,
        display_name: displayName.trim() || null,
        locale,
        timezone,
        birth_date: birthDate,
        target_age: targetType === "age" ? numericTargetAge : null,
        target_date: resolvedTargetDate,
        display_mode: "gentle",
        onboarding_completed: true,
        privacy_version: PRIVACY_VERSION,
        privacy_accepted_at: new Date().toISOString(),
      });
      window.localStorage.removeItem("lifescale:preview-draft");
      onComplete(profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (en ? "Could not save your profile. Please try again." : "保存失败，请稍后再试。"));
    } finally { setBusy(false); }
  }

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header"><Brand /><span>{session.user.email}</span></header>
      <div className="onboarding-progress"><span className={step >= 0 ? "active" : ""}>{en ? "Understand LifeScale" : "理解余生有刻"}</span><i /><span className={step >= 1 ? "active" : ""}>{en ? "Set your scale" : "设定余生刻度"}</span><i /><span className={step >= 2 ? "active" : ""}>{en ? "Confirm carefully" : "郑重确认"}</span></div>

      {step === 0 ? (
        <section className="onboarding-welcome">
          <div className="onboarding-welcome-copy"><p className="kicker">WELCOME TO LIFESCALE</p><h1>{en ? "See the life ahead." : "看见余生，"}<em>{en ? " Make today count." : "认真今天。"}</em></h1><p>{en ? "LifeScale is a life-time account for the days you live, the time beyond your goal, and the memories you choose to preserve. It never predicts death. It helps you see time, keep today, and protect what matters." : "余生有刻是一款贯穿生前记录、生命加时与身后纪念的生命时间账户。它不预测死亡，只帮助你看见时间、留下今天，并把重要的事好好保存。"}</p><div className="welcome-privacy-promise"><strong>{en ? "Private by default, from the first record" : "从第一条记录开始，默认仅你可见"}</strong><p>{en ? "There is no creator or operations console for browsing or editing private records. Your core birth date and life target are confirmed only once." : "产品内没有供创作者或运营人员浏览、修改私密记录的内容后台；出生日期和人生目标只能郑重确认一次。"}</p></div><button className="primary-button large" onClick={() => setStep(1)}>{en ? "I understand. Set my scale" : "我理解，开始设定"}</button></div>
          <div className="onboarding-values"><article><span>01</span><h2>{en ? "Private by default" : "默认仅本人可见"}</h2><p>{en ? "Your records are not published and are isolated by account permissions." : "记录不公开，并通过账号权限与其他用户隔离。"}</p></article><article><span>02</span><h2>{en ? "Confirm once" : "核心资料只确认一次"}</h2><p>{en ? "Birth date and life target are permanently locked after confirmation." : "出生日期与人生目标保存后永久锁定，不能单独修改。"}</p></article><article><span>03</span><h2>{en ? "Leave completely" : "可注销并彻底删除"}</h2><p>{en ? "Export your data or permanently delete the account when you choose." : "你可以导出资料，也可以在决定离开时永久注销账号。"}</p></article></div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="onboarding-form-page">
          <div className="onboarding-form-intro"><p className="kicker">IMPORTANT</p><h1>{en ? "Take your time." : "请认真填写，"}<em>{en ? " This defines your scale." : "这会定义你的刻度。"}</em></h1><p>{en ? "Your birth date and target can only be confirmed once. They cannot be changed separately after saving, and the target is never treated as an actual date of death." : "出生日期和人生目标只能确认一次。正式保存后不能单独修改或删除，也不会被系统解释为真实死亡日期。"}</p></div>
          <div className="onboarding-card">
            <div className="critical-notice"><strong>{en ? "One final choice" : "只能确认一次"}</strong><p>{en ? "Check your birth date and target carefully before saving. They cannot be edited separately later; clearing them requires deleting the entire account. The target is a personal commitment, never a lifespan prediction." : "请慎重核对出生日期和人生目标。保存后无法单独修改；如需清除，只能注销整个账号。它是对自己的长期约定，不是寿命预测。"}</p></div>
            <label>{en ? "What should we call you? (optional)" : "如何称呼你（可选）"}<input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} placeholder={en ? "For example, Tommy" : "例如：Tommy"} /></label>
            <label>{en ? "Birth date" : "出生日期"}<input type="date" max={today} value={birthDate} onChange={(event) => { setBirthDate(event.target.value); setTargetDate(""); }} /></label>
            <fieldset className="target-type"><legend>{en ? "How would you like to set your goal?" : "目标设定方式"}</legend><button type="button" className={targetType === "age" ? "selected" : ""} onClick={() => setTargetType("age")}>{en ? "Target age" : "按目标年龄"}</button><button type="button" className={targetType === "date" ? "selected" : ""} onClick={() => setTargetType("date")}>{en ? "Exact date" : "按具体日期"}</button></fieldset>
            {targetType === "age" ? <TargetAgeField locale={locale} minimumAge={minimumAge} value={targetAge} onChange={setTargetAge} /> : <label>{en ? "Life target date" : "人生目标日期"}<input type="date" min={birthDate ? targetDateFromAge(birthDate, 30) : today} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /><small>{en ? "This is not an actual date of death and never triggers a death status." : "这不是实际死亡日期，也不会触发死亡标记。"}</small></label>}
            <label>{en ? "Interface language" : "界面语言"}<select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="zh">简体中文</option><option value="en">English</option></select></label>
            <label className="confirmation-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>{en ? "I have read and accept the " : "我已阅读并同意"}<a href="/terms" target="_blank">{en ? "Terms" : "《用户协议》"}</a>{en ? " and " : "与"}<a href="/privacy" target="_blank">{en ? "Privacy Notice" : "《隐私说明》"}</a>{en ? "." : "。"}</span></label>
            {!validTarget && birthDate ? <p className="form-status">{en ? "Your target must be after today and no earlier than your 30th birthday." : "目标必须晚于今天，且不早于你的 30 岁生日。"}</p> : null}
            <div className="onboarding-actions"><button className="change-email" onClick={() => setStep(0)}>{en ? "Back" : "返回"}</button><button className="primary-button" disabled={!accepted || !validTarget} onClick={() => setStep(2)}>{en ? "Review once more" : "核对最后一次"}</button></div>
          </div>
        </section>
      ) : null}

      {step === 2 && metrics ? (
        <section className="onboarding-confirm-page">
          <div className="confirm-heading"><p className="kicker">FINAL CONFIRMATION</p><h1>{en ? "This is your goal," : "这是你的目标，"}<em>{en ? " not your fate." : "不是命运。"}</em></h1><p>{en ? "This is the one time you can confirm your core target. After the target date, LifeScale enters Bonus Time and never marks you as deceased automatically." : "这是你唯一一次确认核心目标的机会。到达目标日期后，LifeScale 会进入“生命加时”，绝不会自动把你标记为死亡。"}</p></div>
          <div className="onboarding-card confirm-card"><div className="confirm-scale"><div><strong>{metrics.remainingDays.toLocaleString()}</strong><span>{en ? "days remaining" : "剩余天数"}</span></div></div><dl><div><dt>{en ? "Birth date" : "出生日期"}</dt><dd>{birthDate}</dd></div><div><dt>{targetType === "age" ? (en ? "Target age" : "目标年龄") : (en ? "Target method" : "目标方式")}</dt><dd>{targetType === "age" ? `${numericTargetAge}${en ? " years" : " 岁"}` : (en ? "Exact date" : "具体日期")}</dd></div><div><dt>{en ? "Target date" : "目标日期"}</dt><dd>{resolvedTargetDate}</dd></div><div><dt>{en ? "Target lock" : "目标锁定"}</dt><dd>{en ? "Permanent after confirmation" : "确认后永久锁定"}</dd></div></dl><div className="critical-notice final"><strong>{en ? "Check once more" : "请再次确认"}</strong><p>{en ? "After saving, your birth date, target age and target date cannot be changed separately. Clearing them requires deleting the entire account. Your future records remain private by default." : "保存后，出生日期、目标年龄和目标日期不能单独修改；如需清除，只能注销整个账户。此后创建的记录仍默认仅你本人可见。"}</p></div><label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{en ? "I checked every item and understand this core target can only be confirmed once." : "我已逐项核对，并理解核心目标只能确认一次。"}</span></label>{error ? <p className="form-status">{error}</p> : null}<div className="onboarding-actions"><button className="change-email" onClick={() => setStep(1)}>{en ? "Edit" : "返回修改"}</button><button className="primary-button" disabled={!confirmed || busy} onClick={finish}>{busy ? (en ? "Saving…" : "正在保存…") : (en ? "Confirm and enter LifeScale" : "确认并进入 LifeScale")}</button></div></div>
        </section>
      ) : null}
    </main>
  );
}
