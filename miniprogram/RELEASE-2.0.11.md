# 2.0.11 — 把品牌放回页头该在的位置，并让指南页也能切深色

日期：2026-09-20。基于 2.0.10 收尾提交 `b2d4315`；功能提交 `d382875`。

## 这一版改的仍然是网站，不是小程序

2.0.10 的发行说明里把两件事列为「尚未验证 / 待决」：**页头品牌位置**和**指南页缺明暗主题切换**。2.0.11 就是这两件，加上一件在收尾过程中发现的、比前两件都更值得说的事——**发行脚本自己是坏的**（见下一节）。

**小程序一个文件都没动**：56 个受保护文件、9 个模板绑定契约、12 个数据库文件逐字节一致。

## 改动内容

### 1. 页头品牌被一条给返回链接写的规则拖到了右端

`.legal-header` 是两列网格，第二条列里放返回链接。让它贴到最右边的写法是：

```css
.legal-header > a { justify-self: end; }
```

问题在于 **`Brand` 渲染出来的也是一个 `a`**，所以这条规则同样命中了品牌，把字标也推到了第 1 列的右端——于是页头左半边整块空着，字标紧贴着旁边的链接。2.0.10 之前这个错位就存在（法务页实测品牌位于 `[1170..1308]`、返回链接 `[1308..1380]`），只是 2.0.10 往右侧那一簇里又塞进一个语言控件，把右侧撑宽了，观感上才明显起来。

修法是一处限定：

```css
/* 2.0.11 website: the brand is an <a> too, so the rule written to push the back link to the
   far edge was also pushing the brand there, leaving the whole left half of the header
   empty and the wordmark touching the link beside it. The brand belongs at the start of the
   first column, the same place .site-header puts it. */
.legal-header > a:not(.brand) { justify-self: end; }
```

品牌于是回到第 1 列起点，与首页页头 `Brand` 的位置一致（实测 `brand@60 header@60`）。

**一条选择器修好 6 条路由**：`LegalPage.tsx` 服务 `/privacy`、`/terms`、`/third-parties`、`/account-deletion` 四页，`GuidePage.tsx`（`legal-header guide-header`）服务 `/chapters`、`/sanctuary` 两页。后两页本版另有改动，**前四个法务页本版一个文件都没碰**，纯靠共享选择器一起修正。

### 2. 指南页加了首页同款的主题切换按钮

两个指南页此前**跟随**已存储的主题（深色系统偏好或首页选择），却没有任何地方可以改——读者想换深色，得先回首页切一次再走回来。这与 2.0.10 给语言做的处理是同一类缺口。

按钮放进页头的 `.header-actions`，并**排在语言控件左侧**，与首页页头 `.header-actions` 里的顺序一致，两个页头不会把按钮重排成不同的次序。无障碍名称不写死在壳里，而是由调用方传入（`aria-label={t.theme}`）——`GuidePage.tsx` 必须保持零中文字符这条性质自 2.0.9 起就没变过，所以两个指南页各新增一个 `theme` 文案键，中英各一份，用词与首页页头完全相同（`切换明暗模式` / `Toggle color theme`），这样屏幕阅读器在两个页头上听到的是同一句话。

**没有新样式**：按钮复用的就是首页 `.theme-button` 那条既有规则，宽度、高度、色值、`≤760px` 隐藏全都继承，没有新增色值、自定义属性、远程资源、滤镜或动画。

## 顺带修好了发行脚本自己的一个静默 bug

这一件不在计划里，但它是本版最该被记下来的部分。

`scripts/build-release-baseline.mjs` 找「上一版基线」时用的是**文件名字典序**：

```js
.sort()   // 旧写法
```

而作为**文本**，`"ui-2010-baseline.json"` 排在 `"ui-207-baseline.json"` **之前**。于是生成 2.0.11 的基线时，父基线退成了 **2.0.9**，结果：

- 输出为 `protectedFiles 120 -> 120`，看着完全正常；
- 而 **2.0.10 新增的 `app/components/LocaleSelect.tsx` 从保护清单里消失了**；
- 没有任何报错，没有任何一行输出看起来不对。

**保护归零是静默的**——这正是整套基线机制存在的意义被反噬的方式。已改为按数值比较，并加了一条硬检查：**父基线必须是紧邻的上一版**，否则报错而不是生成一份比上一版更短的白名单；确实存在未发布的中间版本时，用 `--allow-version-gap` 显式放行。输出也改成打印父基线的名字，而不是只打印数字。

反证过：临时把 `ui-2010-baseline.json` 移走，脚本立刻抛错退出，不再静默降级。

## 严格保留

- 相对 2.0.10 基线，**网站改动集合恰好是 4 个文件**：`app/chapters/page.tsx`、`app/components/GuidePage.tsx`、`app/globals.css`、`app/sanctuary/page.tsx`。
- 受保护文件 **121 → 121**：本版没有新增受保护文件，也**一个都没丢**——`LocaleSelect.tsx` 仍在清单里（这正好是上面那个 bug 会踩掉的条目）。9 个模板绑定契约 **9/9 逐字未变**。
- 小程序 56 个受保护文件与 12 个数据库文件**逐字节未变**。
- `miniprogram/package.json` 的版本号推进到 `2.0.11`（该文件不在保护清单内，属版本门控读取的载体）。

## 验证

- **全量测试 276 项：220 通过、0 失败、56 跳过。** 跳过的是 2.0.7（9 项）、2.0.8（13 项）、2.0.9（18 项）、2.0.10（16 项）展示层基线的版本门控断言，随版本号自跳，属其设计行为。
- 新增 `tests/web-guide-theme-211.test.mjs`（18 项）：121 个受保护文件 SHA-256；变化集合**恰好等于**上面那 4 个文件；121 → 121 且键集合逐字相同；**「本版继承了上一版保护的每一个文件」**；**「任何一版都不许缩小保护清单」**（逐对比较全部 5 份夹具的 `protectedFiles` 与 `markup`，按文件名里的数字排序，不按文本排序）；小程序 56 个与数据库 12 个逐字节不变；9 个模板契约冻结；`.legal-header > a:not(.brand)` 必须存在且未限定的旧形式必须消失；主题控件在动作行内、排在语言控件之前、无障碍名称来自文案、图标随主题切换；两个指南页的中英文案键逐项等量（含新增的 `theme`）；新注释块内无字面色值、无新令牌，且既有 `.theme-button` 规则与 `≤760px` 隐藏规则都还在。
- **反证（确认测试真的会红而不是空过）**：
  - 从 `ui-2011-baseline.json` 删掉 `app/components/LocaleSelect.tsx` → **3 项失败**（第 2、3、4 条），其中第 4 条「任何一版都不许缩小保护清单」正是脚本旧 bug 会踩的那条。
  - 把 CSS 改回 `.legal-header > a { justify-self: end; }` → **2 项失败**（第 1 条哈希校验、第 15 条选择器形态）。
- **本地生产构建 + 真实浏览器实测 82 项全通过**（`next start` + 本机已装的 Chrome，未下载任何浏览器）：
  - **6 个页面的页头品牌全部回到左端**：`/privacy`、`/terms`、`/third-parties`、`/account-deletion`、`/chapters`、`/sanctuary` 实测均为 `brand@60 header@60`，动作区仍在右端 `actions→1380`，两者分离。
  - **主题切换生效**：点击后 `data-theme` 由 `light` 变 `dark`、页面背景由 `rgb(255,255,255)` 变 `rgb(21,21,24)`、深色下对比度 16.74。
  - **刷新后仍是深色**，证明选择被记住（与首页读的是同一个键）。
  - 760 / 375 / **320**px 三档宽度下：无横向溢出、品牌仍在左端、主题按钮与首页**同规则隐藏**（继承而非重写）、无重叠无裁切。
  - 6 个页面均无脚本错误。
  - 截图存于 `个人知识库/03-项目/lifescale-2.0.11-页头与主题验收/`（16 张）。
- **发版脚本的线上复验已扩到本版**：`MARKERS` 累加为本版新增的 `a:not(.brand)`（`.legal-header > a:not(.brand)` 的压缩形态，为 2.0.11 独有），指南页的 SSR 正文检查新增 `class="theme-button"`。
  - **反证**：在 2.0.11 尚未上线时对线上跑 `--verify-only` → `.chapter-section`=1、`.guide-header`=1（前两版在线），而 `a:not(.brand)`=0、`class="theme-button"`=0 → 脚本报错并**以退出码 1 结束**。三条标记都是活的，不是顺手打绿勾。
- 两套 ESLint、`tsc --noEmit`、`next build` 全部通过。

## 尚未验证 / 待决

- ~~**小程序 2.0.8 三页的实际渲染验收仍未做**：……必须先由人扫一次码登录，之后可由脚手架一键抓完三页。~~ **这一条已作废（2026-09-20 更正）**：验收已完成，且**不需要任何人工扫码**。当时把「缺一个前置条件」直接翻译成了「某个具体的人工动作」，却没有去读登录页实际提供了什么——`pages/auth/auth` 本来就有「微信一键登录」（`wechatEnabled: true`）与邮箱验证码两条路，都不需扫码。真正的坑在别处：勾同意框必须点外层 `label.consent-choice`，点原生 `<checkbox>` 不触发 `checkbox-group` 的 `change`，`agreed` 会一直是 `false`。更正后的结论见 `个人知识库/03-项目/lifescale-2.0.8-渲染验收/README.md`。
- **提审无法代做**：开发者工具内无 `submit_audit` 能力，只能在 mp.weixin.qq.com 后台点，或走官方 API 但需 AppSecret（Vercel 里那份是 Sensitive，读不回来）。
- 繁体（`zh-TW`）下语言名称仍会被 OpenCC 转换（`简体中文`→`簡體中文`），与首页同款控件行为一致；若希望语言名永不转换，`lib/use-traditional-chinese.ts` 已有 `.ignore-opencc` 逃生门。
- 2.0.7 遗留的**主题断层**：新页（2.0.7 起）用 `--bg-main/--text-primary` 令牌体系，旧页（首页/登录/设置/详情）仍是旧暖米白+墨绿，两套配色并存。
- 报告卡 PNG 与 PWA manifest 是否同步新配色（需授权破一次受保护红线）。
- `/privacy` 是否补圣所条款、`LegalPage` 页脚是否补齐 2.0.9 新增的两页（会动受保护文件）。
