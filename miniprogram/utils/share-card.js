// Shared by web and mini program. Only a locally rendered copy is shared.
const MAX_HEIGHT = 7200;
const t = require("./locale-copy");

function wrapText(ctx, text, width) {
  const lines = [];
  for (const paragraph of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
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
  return locale === "en" ? day + "/" + month + "/" + year : year + "年" + Number(month) + "月" + Number(day) + "日";
}
function photoList(photo) { return Array.isArray(photo) ? photo : photo ? [photo] : []; }

function planCard(ctx, content, photo, layout, options = {}) {
  const photos = photoList(photo), width = options.width || 720, scale = width / 720;
  const overlay = layout === "overlay" && photos.length > 0;
  const fontSize = Math.round((content.length > 2500 ? 26 : content.length > 1000 ? 30 : 34) * scale);
  const lineHeight = Math.ceil(fontSize * 1.6), startY = 230 * scale, footer = 190 * scale;
  ctx.font = "500 " + fontSize + "px sans-serif";
  const lines = wrapText(ctx, content, width - 128 * scale);
  const rows = [];
  // Contact sheets use contain, never crop away faces or photo edges.
  for (let index = 0; index < photos.length; index += 2) {
    const indices = index + 1 < photos.length ? [index, index + 1] : [index];
    const p = photos[index];
    const imageHeight = indices.length === 1 ? Math.min(900 * scale, Math.max(200 * scale, 624 * scale * p.height / p.width)) : 310 * scale;
    rows.push({ indices, imageHeight, height: imageHeight + 42 * scale });
  }
  const pages = [];
  let current = { lines: [], photoRows: [], top: startY, height: 0 }, cursor = startY;
  function finish() {
    current.height = Math.ceil(Math.max(900 * scale, cursor + footer));
    pages.push(current);
    current = { lines: [], photoRows: [], top: startY, height: 0 }; cursor = startY;
  }
  function reserve(height) { if (cursor + height + footer > MAX_HEIGHT && (current.lines.length || current.photoRows.length)) finish(); }
  function addPhotos() {
    for (const row of rows) { reserve(row.height); current.photoRows.push({ ...row, y: cursor }); cursor += row.height; }
  }
  function addText() {
    for (const line of lines) {
      reserve(lineHeight);
      if (!current.lines.length) current.top = cursor;
      current.lines.push(line); cursor += lineHeight;
    }
  }
  if (!overlay) addPhotos();
  addText();
  if (overlay && photos.length > 1) { reserve(24 * scale); cursor += 24 * scale; addPhotos(); }
  if (current.lines.length || current.photoRows.length) finish();
  return { width, scale, fontSize, lineHeight, overlay, backgroundIndex: Math.max(0, Math.min(photos.length - 1, options.backgroundIndex || 0)), pages };
}
function cover(ctx, photo, x, y, width, height) {
  const ratio = Math.max(width / photo.width, height / photo.height), sw = width / ratio, sh = height / ratio;
  ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, x, y, width, height);
}
function drawCard(canvas, photo, entry, plan, pageIndex, locale = "zh") {
  const photos = photoList(photo), page = plan.pages[pageIndex], s = plan.scale;
  canvas.width = plan.width; canvas.height = page.height;
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f4f0e6"; ctx.fillRect(0, 0, plan.width, page.height);
  if (plan.overlay) {
    cover(ctx, photos[plan.backgroundIndex], 0, 0, plan.width, page.height);
    ctx.fillStyle = "rgba(6,30,22,.4)"; ctx.fillRect(0, 0, plan.width, page.height);
    ctx.fillStyle = "rgba(6,30,22,.88)"; ctx.fillRect(32 * s, 168 * s, plan.width - 64 * s, page.height - 198 * s);
  }
  ctx.fillStyle = "#143d2f"; ctx.fillRect(0, 0, plan.width, 140 * s);
  ctx.fillStyle = "#fffdf8"; ctx.font = "600 " + 30 * s + "px sans-serif";
  ctx.fillText(t("我选择留下的这一天", locale), 48 * s, 64 * s);
  ctx.font = 16 * s + "px sans-serif"; ctx.fillText(t("余生有刻", locale) + " · LIFESCALE", 48 * s, 100 * s);
  ctx.fillStyle = "#d99b2f"; ctx.fillRect(48 * s, 115 * s, 54 * s, 3 * s);
  ctx.fillStyle = plan.overlay ? "#f1c66d" : "#805d14"; ctx.font = "600 " + 18 * s + "px sans-serif";
  ctx.fillText(formatDate(entry.entry_date, locale), 64 * s, 202 * s);
  for (const row of page.photoRows) {
    const gap = 16 * s, cellWidth = (624 * s - (row.indices.length - 1) * gap) / row.indices.length;
    row.indices.forEach((index, column) => {
      const image = photos[index], x = 48 * s + column * (cellWidth + gap);
      ctx.fillStyle = "#e7e1d4"; ctx.fillRect(x, row.y, cellWidth, row.imageHeight);
      const ratio = Math.min(cellWidth / image.width, row.imageHeight / image.height);
      const w = image.width * ratio, h = image.height * ratio;
      ctx.drawImage(image, x + (cellWidth - w) / 2, row.y + (row.imageHeight - h) / 2, w, h);
      ctx.fillStyle = plan.overlay ? "#f1c66d" : "#805d14"; ctx.font = 15 * s + "px sans-serif";
      if (photos.length > 1) ctx.fillText(index + 1 + " / " + photos.length, x, row.y + row.imageHeight + 23 * s);
    });
  }
  ctx.fillStyle = plan.overlay ? "#fffdf8" : "#143d2f";
  ctx.font = "500 " + plan.fontSize + "px sans-serif"; ctx.textBaseline = "top";
  if (plan.overlay) { ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 4; }
  page.lines.forEach((line, i) => ctx.fillText(line, 64 * s, page.top + i * plan.lineHeight));
  ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; ctx.textBaseline = "alphabetic";
  const footerY = page.height - 115 * s;
  ctx.fillStyle = plan.overlay ? "rgba(255,253,248,.12)" : "rgba(20,61,47,.08)";
  ctx.fillRect(48 * s, footerY - 30 * s, 624 * s, 48 * s);
  ctx.fillStyle = plan.overlay ? "#fffdf8" : "#143d2f"; ctx.font = 18 * s + "px sans-serif";
  ctx.fillText([entry.moodLabel, entry.categoryLabel].filter(Boolean).map((label) => t(label, locale)).join(" · "), 64 * s, footerY);
  ctx.font = 15 * s + "px sans-serif";
  ctx.fillText(locale === "en" ? "Make today count." : t("看见余生，认真今天。", locale), 48 * s, page.height - 52 * s);
  ctx.textAlign = "right";
  ctx.fillText(plan.pages.length > 1 ? pageIndex + 1 + " / " + plan.pages.length + " · LifeScale" : "app.lifescale.space", 672 * s, page.height - 52 * s);
}
module.exports = { wrapText, planCard, drawCard, formatDate, MAX_HEIGHT };
