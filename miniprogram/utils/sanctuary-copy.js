// Labels that carry a number cannot live in the flat locale dictionary, because the
// dictionary maps whole strings and the unit word also moves with the language
// ("第 3 章" against "Chapter 3"). They are composed here instead, and the pages render
// the result as data.

function group(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// "12 条致意" / "12 條致意" / "12 tributes".
function tributeCountLabel(count, locale) {
  const total = group(Math.max(0, Math.floor(Number(count) || 0)));
  if (locale === "en") return `${total} ${total === "1" ? "tribute" : "tributes"}`;
  return locale === "zh-TW" ? `${total} 條致意` : `${total} 条致意`;
}

// The chapter index is 1 based and rolls over every CHAPTER_DAYS days, matching
// utils/life.js. bonusValue is empty unless the owner is past their target date.
function chapterCopy(chapter, locale) {
  if (!chapter) return { chapterValue: "", dayValue: "", leftValue: "", bonusValue: "" };
  const left = Math.max(0, Math.floor(Number(chapter.chapterDaysRemaining) || 0));
  if (locale === "en") {
    return {
      chapterValue: `Chapter ${group(chapter.currentChapter)}`,
      dayValue: `Day ${group(chapter.chapterDayIndex)}`,
      leftValue: `${group(left)} ${left === 1 ? "day" : "days"}`,
      bonusValue: chapter.isBonusLife ? `Bonus day ${group(chapter.bonusDayCount)}` : "",
    };
  }
  return {
    chapterValue: `第 ${group(chapter.currentChapter)} 章`,
    dayValue: `第 ${group(chapter.chapterDayIndex)} 天`,
    leftValue: `${group(left)} 天`,
    bonusValue: chapter.isBonusLife
      ? `${locale === "zh-TW" ? "額外" : "额外"}第 ${group(chapter.bonusDayCount)} 天`
      : "",
  };
}

module.exports = { chapterCopy, group, tributeCountLabel };
