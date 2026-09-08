// A share is an explicit copy: never mutate the stored entry or forward its identity.
function buildShareCopy(original, text, photos, options = {}) {
  const content = String(text || "").slice(0, 12000).trim();
  const imageUrls = photos.filter((photo) => photo.selected === true).map((photo) => photo.url);
  if (!content && !imageUrls.length) throw new Error("请至少保留一段文字或一张照片。");
  return {
    entry: {
      content, entry_date: options.showDate === false ? "" : original.entry_date,
      moodLabel: options.showMood === false ? "" : ({ calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" })[original.mood] || "",
      categoryLabel: options.showMood === false ? "" : ({ daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" })[original.category] || "",
      ...(options.showSignature === true && options.nickname ? { signature: normalizeNickname(options.nickname) } : {}),
    },
    imageUrls,
  };
}
function normalizeNickname(value) {
  // Display name only, never fall back to account email or an identifier.
  return Array.from(String(value || "").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").trim()).slice(0, 80).join("");
}
module.exports = { buildShareCopy, normalizeNickname };
