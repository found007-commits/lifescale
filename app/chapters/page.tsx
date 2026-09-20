import type { Metadata } from "next";
import { headers } from "next/headers";
import { detectLocale } from "../../lib/i18n";
import { GuidePage, type GuideCopy } from "../components/GuidePage";

export const metadata: Metadata = {
  title: "双轨 1000 天",
  description: "每 1000 天算一章：目标日期之前是目标轨，之后是额外旅程。了解余生有刻的章节刻度，以及它与记录、报告之间的关系。",
};

const copy: { zh: GuideCopy; en: GuideCopy } = {
  zh: {
    eyebrow: "CHAPTERS",
    title: "把日子分成章",
    updated: "最后更新：2026年9月20日",
    lead: "余生有刻用 1000 天做尺度：你已经走过的天数，决定你此刻在第几章的第几天。目标日期之前是目标轨，之后是额外旅程——每一天都是多出来的时间。",
    figure: { value: "1000 天 = 1 章", caption: "第 1 章从第一天起算；走满 1000 天，第 1001 天进入第 2 章第 1 天。" },
    facts: [
      { heading: "目标轨", body: "从第一天到你为自己设定的目标那天。每 1000 天一章，章内天数从第 1 天数到第 1000 天。" },
      { heading: "额外旅程", body: "目标那天本身还不算额外旅程。从目标那天的下一天起，每一天都记为多出来的日子，并单独累计。" },
      { heading: "章节只描述时间", body: "章节来自你填写的出生日期与目标，不做寿命预测，也不会推断或写入任何实际日期。" },
    ],
    sections: [
      {
        heading: "章是怎么算出来的",
        body: "章节由「已经走过的天数」与「到目标那天的总天数」两个数字决定，规则很简单：",
        bullets: [
          "已经走过的天数每满 1000 天，章号加一，所以章号从第 1 章开始。",
          "章内天数是 1 到 1000：第 1000 天是本章最后一天，第 1001 天才是下一章的第 1 天。",
          "没有设定目标时，只按目标轨分章，不会出现额外旅程。",
          "目标那天不算额外旅程；从第二天起才开始累计多出来的日子。",
        ],
      },
      {
        heading: "小程序和网页用的是同一套算法",
        body: "两端的章节运算由各自的实现承担，但取值必须逐一相同：同一组输入在两处必须得出同一个章号、同一个章内天数、同一个额外旅程天数。这条一致性由回归测试锁住，任何一端改了算法都会在测试里先失败，而不是等用户看到两个不同的答案。",
      },
      {
        heading: "章节与记录、报告的关系",
        body: "章节只提供时间刻度，不改变你已有的任何内容。记录、图片、留言与 7 天报告都按原本的方式工作；章号只是让你在回看时多一个定位方式。任何一天属于哪一章，都由日期算出，不需要你手动维护。",
      },
      {
        heading: "设定的边界",
        body: "目标由你自己决定，也可以留空。出生日期确认后不可修改；目标年龄有调整次数限制。这些规则由服务端执行，与章节运算无关，也不影响你导出数据或注销账号。",
      },
    ],
    note: "提醒：这不是死亡预测。章节刻度回答的是「今天处在我设定的时间线里的哪一段」，而不是「我还剩多少时间」。目标可以随时重新理解，人生不该被一个数字绑架。",
    back: "返回余生有刻",
    privacy: "隐私说明",
    footer: [
      { label: "双轨 1000 天", href: "/chapters" },
      { label: "精神圣所", href: "/sanctuary" },
      { label: "隐私说明", href: "/privacy" },
      { label: "服务条款", href: "/terms" },
      { label: "第三方服务", href: "/third-parties" },
      { label: "账号注销", href: "/account-deletion" },
    ],
  },
  en: {
    eyebrow: "CHAPTERS",
    title: "Divide the days into chapters",
    updated: "Last updated: 20 September 2026",
    lead: "LifeScale uses 1,000 days as its unit: the days you have already lived decide which day of which chapter you are on right now. Until the target you set, you are on the main track; after it, you are on the bonus journey, where every day is extra time.",
    figure: { value: "1,000 days = 1 chapter", caption: "Chapter 1 starts on day one. After 1,000 days, day 1,001 opens chapter 2." },
    facts: [
      { heading: "Main track", body: "From day one to the target you set for yourself. Each chapter holds 1,000 days, counted from day 1 through day 1,000." },
      { heading: "Bonus journey", body: "The target day itself is not a bonus day. From the day after it, every day is counted as extra and tallied separately." },
      { heading: "Chapters describe time only", body: "A chapter comes from the birth date and target you entered. It never predicts a lifespan and never infers or writes any real date." },
    ],
    sections: [
      {
        heading: "How a chapter is calculated",
        body: "Two numbers decide the chapter: the days you have lived, and the total days from birth to your target date. The rule is short:",
        bullets: [
          "Every full 1,000 days lived moves the chapter number up by one, and chapters start at 1.",
          "Days inside a chapter run from 1 to 1,000, so day 1,000 is the last day of that chapter and day 1,001 opens the next.",
          "With no target set, chapters follow the main track only and no bonus journey appears.",
          "The target day itself is not a bonus day; extra days start counting the day after it.",
        ],
      },
      {
        heading: "The website and the mini program run the same arithmetic",
        body: "Each side carries its own implementation, so the results must agree value for value: the same input has to produce the same chapter number, the same day inside the chapter, and the same bonus day count on both. A regression test locks that in, so changing the arithmetic on one side fails the build instead of surprising a user with two different answers.",
      },
      {
        heading: "How chapters relate to entries and reports",
        body: "Chapters add a time scale; they change nothing you have already written. Entries, photos, comments and the 7-day report all keep working as before, and a chapter number simply gives you one more way to locate a day when you look back. Which chapter a day belongs to is derived from the date, so there is nothing to maintain by hand.",
      },
      {
        heading: "The limits of a setting",
        body: "The target is yours to choose and may be left empty. A confirmed birth date cannot be changed, and the target age allows a limited number of revisions. Those rules are enforced server side, they are unrelated to the chapter arithmetic, and they never block exporting your data or closing your account.",
      },
    ],
    note: "A reminder: this is not a prediction of death. A chapter answers “which part of the timeline I set for myself does today fall in”, not “how much time do I have left”. A target can be reconsidered at any time, and a life should never be ruled by one number.",
    back: "Back to LifeScale",
    privacy: "Privacy",
    footer: [
      { label: "1,000-day chapters", href: "/chapters" },
      { label: "The sanctuary", href: "/sanctuary" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Third parties", href: "/third-parties" },
      { label: "Delete account", href: "/account-deletion" },
    ],
  },
};

export default async function ChaptersPage() {
  const requestHeaders = await headers();
  const country = requestHeaders.get("x-vercel-ip-country") || requestHeaders.get("cf-ipcountry") || "";
  const initialLocale = detectLocale(country, requestHeaders.get("accept-language"));
  return <GuidePage initialLocale={initialLocale} copy={copy} />;
}
