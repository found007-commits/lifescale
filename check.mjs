import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pages = [
  ["index.html", ["人生刻度 LifeScale", "/privacy", "/terms", "/third-parties", "/account-deletion"]],
  ["privacy.html", ["隐私政策", "登录与地区判断"]],
  ["terms.html", ["用户协议", "账号规则"]],
  ["third-parties.html", ["第三方信息共享清单", "微信 / 腾讯"]],
  ["account-deletion.html", ["账号注销与数据删除", "删除范围"]],
];

for (const [name, snippets] of pages) {
  const text = await readFile(resolve(root, "public", name), "utf8");
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${name} 缺少：${snippet}`);
  }
}

const server = await readFile(resolve(root, "server.js"), "utf8");
for (const route of ["/privacy", "/terms", "/third-parties", "/account-deletion", "/healthz"]) {
  if (!server.includes(route)) throw new Error(`server.js 缺少路由：${route}`);
}

console.log("LifeScale 页面与路由检查通过。");
