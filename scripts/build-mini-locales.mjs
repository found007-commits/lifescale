import fs from "node:fs";
import path from "node:path";
import * as OpenCC from "opencc-js";
const root = path.resolve("miniprogram");
const dictionary = JSON.parse(fs.readFileSync(path.join(root, "utils/locale-dictionary.json"), "utf8"));
const convert = OpenCC.Converter({ from: "cn", to: "tw" });
const entries = {};
for (const [zh, en] of Object.entries(dictionary)) entries[zh] = { en, tw: convert(zh) };
// Generated dictionaries contain product copy only; private records never enter this build.
const json = JSON.stringify(entries);
fs.writeFileSync(path.join(root, "utils/locale.wxs"), `var dictionary = ${json};\nfunction t(value, locale) { var item = dictionary[value]; if (!item) return value; return locale === 'en' ? item.en : locale === 'zh-TW' ? item.tw : value; }\nmodule.exports = { t: t };\n`);
fs.writeFileSync(path.join(root, "utils/locale-copy.js"), `const dictionary = ${json};\nmodule.exports = (value, locale) => { const item = dictionary[value]; return item ? (locale === 'en' ? item.en : locale === 'zh-TW' ? item.tw : value) : value; };\n`);
// Mechanical template migration. Safe to repeat: already localized pages are skipped.
for (const name of fs.readdirSync(path.join(root, "pages"))) {
  const wxml = path.join(root, "pages", name, `${name}.wxml`);
  let source = fs.readFileSync(wxml, "utf8");
  if (source.startsWith('<wxs src="../../utils/locale.wxs"')) continue;
  const expressions = [];
  source = source.replace(/\{\{([\s\S]*?)\}\}/g, (_, expression) => {
    const translate = /[\u4e00-\u9fff]/.test(expression) && !/\.content|display_name/.test(expression);
    const label = /^(item\.(?:label|moodLabel|categoryLabel)|report.topCategory|journeyMessage|document.title|document.updated|item.heading|item.body|genderLabels\[genderIndex\]|modes\[modeIndex\])$/.test(expression.trim());
    const replacement = translate || label ? `{{i18n.t(${expression}, locale)}}` : `{{${expression}}}`;
    expressions.push(replacement);
    return `@@EXPR${expressions.length - 1}@@`;
  });
  function localizeText(text) {
    return text.split(/(@@EXPR\d+@@)/).map(part => {
      const trimmed = part.trim();
      if (!trimmed || !/[\u4e00-\u9fff]/.test(trimmed)) return part;
      if (!entries[trimmed]) { entries[trimmed] = { en: trimmed, tw: convert(trimmed) }; console.warn(`Missing English: ${trimmed}`); }
      return part.replace(trimmed, `{{i18n.t('${trimmed.replace(/'/g, "\\'")}', locale)}}`);
    }).join("");
  }
  source = source.replace(/>([^<>]+)</g, (_, value) => `>${localizeText(value)}<`);
  source = source.replace(/placeholder="([^"]*)"/g, (_, value) => `placeholder="${localizeText(value)}"`);
  source = source.replace(/@@EXPR(\d+)@@/g, (_, index) => expressions[Number(index)]);
  fs.writeFileSync(wxml, `<wxs src="../../utils/locale.wxs" module="i18n" />\n${source}`);
  const js = path.join(root, "pages", name, `${name}.js`);
  const code = fs.readFileSync(js, "utf8");
  if (!code.includes('const Page = require("../../utils/localized-page")')) fs.writeFileSync(js, `const Page = require("../../utils/localized-page");\n${code}`);
}
