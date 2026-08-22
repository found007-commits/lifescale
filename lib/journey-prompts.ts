import type { Locale } from "./types";

export type JourneyPrompt = {
  day: number;
  label: string;
  title: string;
  body: string;
};

export function getJourneyPrompt(totalDays: number, checkedToday: boolean, locale: Locale): JourneyPrompt {
  const en = locale === "en";
  if (totalDays === 100) {
    return {
      day: 100,
      label: en ? "DAY 100" : "第 100 天",
      title: en ? "Look back at your first hundred days." : "回望你的一百天",
      body: en
        ? "Do not let big data analyze you. Do not let others define you. Look back at your hundred days, then keep moving forward."
        : "不要让大数据分析你，不要让别人定义你，回望一下你的一百天，继续前进！",
    };
  }
  if (totalDays === 30) return { day: 30, label: en ? "DAY 30" : "第 30 天", title: en ? "A month has taken shape." : "一个月，已经有了形状", body: en ? "Look back without rushing to judge yourself. Keep what feels true." : "回看这些日子，但不急着评价自己。留下真实的感受，继续往前。" };
  if (totalDays === 7) return { day: 7, label: en ? "DAY 7" : "第 7 天", title: en ? "Your first seven days." : "你的第一个七天", body: en ? "Notice what occupied your time and what you want to carry into next week." : "看看什么占据了你的时间，也看看什么值得带进下一个七天。" };
  if (totalDays === 1) return { day: 1, label: en ? "DAY 1" : "第 1 天", title: en ? "Your first day is here." : "第一天，已经被你留下", body: en ? "No need to summarize yourself yet. Come back tomorrow and keep one more honest moment." : "先不急着总结自己。明天再回来，留下另一个真实的时刻。" };
  if (totalDays === 0) return { day: 1, label: en ? "START WITH DAY 1" : "从第 1 天开始", title: en ? "Leave one true thing from today." : "今天，先留下一件真实的事", body: en ? "One sentence or one photo is enough. The first day begins now." : "一句话或一张照片就够了。第一天，不必等准备好才开始。" };
  return {
    day: totalDays + (checkedToday ? 0 : 1),
    label: checkedToday ? (en ? `DAY ${totalDays}` : `第 ${totalDays} 天`) : (en ? `NEXT: DAY ${totalDays + 1}` : `下一次：第 ${totalDays + 1} 天`),
    title: checkedToday ? (en ? "Today has been kept." : "今天已经被你留下") : (en ? "Today is still waiting for you." : "今天，还在等你写下一句"),
    body: checkedToday ? (en ? "You do not need to add more. Return when another moment feels worth keeping." : "不必为了完整而多写。等下一个值得留下的时刻，再回来。") : (en ? "Record one thing you noticed, felt or did. Let your own words define the day." : "写下一件你看见、感受或做过的事。让今天由你自己的话来定义。"),
  };
}
