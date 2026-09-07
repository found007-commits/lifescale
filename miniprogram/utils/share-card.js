// Sharing is a local export. Never publish a journal row or its signed URL.
const WIDTH = 720;
const MAX_HEIGHT = 7200;
const t = require("./locale-copy");

function wrapText(ctx, text, width) {
  const lines = [];
  for (const paragraph of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    // Keep Latin words together when possible; split oversized words safely.
    const tokens = paragraph.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*|[^A-Za-z0-9]/gu) || [];
    for (const token of tokens) {
      if (ctx.measureText(line + token).width <= width) { line += token; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of Array.from(token)) {
        if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function formatDate(value, locale = "zh") {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!match) return "";
  const [, year, month, day] = match;
  return locale === "en" ? `${day}/${month}/${year}` : `${year}年${Number(month)}月${Number(day)}日`;
}

function planCard(ctx, content, photo, layout) {
  const overlay = layout === "overlay" && Boolean(photo);
  const fontSize = content.length > 2500 ? 26 : content.length > 1000 ? 30 : 34;
  const lineHeight = Math.ceil(fontSize * 1.6);
  ctx.font = `500 ${fontSize}px sans-serif`;
  const lines = wrapText(ctx, content, WIDTH - 128);
  const photoHeight = photo && !overlay ? Math.min(900, Math.max(200, Math.round(624 * photo.height / photo.width))) : 0;
  const top = 230 + (photoHeight ? photoHeight + 42 : 0);
  const capacity = Math.max(1, Math.floor((MAX_HEIGHT - top - 190) / lineHeight));
  const pages = [];
  for (let index = 0; index < lines.length; index += capacity) {
    const pageLines = lines.slice(index, index + capacity);
    pages.push({ lines: pageLines, height: Math.max(900, top + pageLines.length * lineHeight + 190), top });
  }
  return { width: WIDTH, fontSize, lineHeight, photoHeight, overlay, pages };
}

function cover(ctx, photo, x, y, width, height) {
  const scale = Math.max(width / photo.width, height / photo.height);
  const sw = width / scale, sh = height / scale;
  ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, x, y, width, height);
}

function drawCard(canvas, photo, entry, plan, pageIndex, locale = "zh") {
  const page = plan.pages[pageIndex];
  canvas.width = plan.width;
  canvas.height = page.height;
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const en = locale === "en";
  ctx.fillStyle = "#f4f0e6";
  ctx.fillRect(0, 0, plan.width, page.height);
  if (plan.overlay) {
    cover(ctx, photo, 0, 0, plan.width, page.height);
    ctx.fillStyle = "rgba(6,30,22,.4)";
    ctx.fillRect(0, 0, plan.width, page.height);
    // This opaque-enough veil remains readable even when canvas filters are unsupported.
    ctx.fillStyle = "rgba(6,30,22,.88)";
    ctx.fillRect(32, 168, plan.width - 64, page.height - 198);
  }
  ctx.fillStyle = "#143d2f";
  ctx.fillRect(0, 0, plan.width, 140);
  ctx.fillStyle = "#fffdf8";
  ctx.font = "600 30px sans-serif";
  ctx.fillText(t("我选择留下的这一天", locale), 48, 64);
  ctx.font = "16px sans-serif";
  ctx.fillText(t("余生有刻", locale) + " · LIFESCALE", 48, 100);
  ctx.fillStyle = "#d99b2f";
  ctx.fillRect(48, 115, 54, 3);
  if (photo && !plan.overlay) {
    const scale = Math.min(624 / photo.width, plan.photoHeight / photo.height);
    const w = photo.width * scale, h = photo.height * scale;
    ctx.drawImage(photo, (plan.width - w) / 2, 168 + (plan.photoHeight - h) / 2, w, h);
  }
  ctx.fillStyle = plan.overlay ? "#f1c66d" : "#805d14";
  ctx.font = "600 18px sans-serif";
  ctx.fillText(formatDate(entry.entry_date, locale), 64, page.top - 24);
  ctx.fillStyle = plan.overlay ? "#fffdf8" : "#143d2f";
  ctx.font = `500 ${plan.fontSize}px sans-serif`;
  ctx.textBaseline = "top";
  if (plan.overlay) { ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 4; }
  page.lines.forEach((line, i) => ctx.fillText(line, 64, page.top + i * plan.lineHeight));
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.textBaseline = "alphabetic";
  const footerY = page.height - 115;
  ctx.fillStyle = plan.overlay ? "rgba(255,253,248,.12)" : "rgba(20,61,47,.08)";
  ctx.fillRect(48, footerY - 30, 624, 48);
  ctx.fillStyle = plan.overlay ? "#fffdf8" : "#143d2f";
  ctx.font = "18px sans-serif";
  ctx.fillText([entry.moodLabel, entry.categoryLabel].filter(Boolean).map((label) => t(label, locale)).join(" · "), 64, footerY);
  ctx.font = "15px sans-serif";
  ctx.fillText(en ? "Make today count." : t("看见余生，认真今天。", locale), 48, page.height - 52);
  ctx.textAlign = "right";
  ctx.fillText(plan.pages.length > 1 ? `${pageIndex + 1} / ${plan.pages.length} · LifeScale` : "app.lifescale.space", 672, page.height - 52);
}

module.exports = { wrapText, planCard, drawCard, formatDate, MAX_HEIGHT };
