# 2.0.9 — 网站侧 1000 天篇章与精神圣所

日期：2026-09-20。基于 2.0.8 收尾提交 `5cb4423`；功能提交 `3d9f5f9`。

## 这一版改的是网站，不是小程序

2.0.8 把「1000 天篇章」与「精神圣所」给了小程序，网站对这两件事一无所知。2.0.9 把它们搬到网站上：**小程序一个文件都没动**（56 个受保护文件、9 个模板绑定契约、12 个数据库文件逐字节一致，见「验证」一节）。

## 新增能力

- **算法对齐**：`lib/life-calculations.ts` 新增 `CHAPTER_DAYS = 1000` 与 `calculateChapterMetrics(daysLived, totalTargetDays)`，返回 `currentChapter / chapterDayIndex / chapterDaysRemaining / isBonusLife / bonusDayCount`，与小程序 `utils/life.js` 同名同参同语义。`calculateLifeMetrics` 增加返回值 `totalDays`：章节模型需要「出生到目标」的总天数，而用 `livedDays + remainingDays - bonusDays` 反推在额外旅程阶段会算错。
- **首页篇章区**：`#chapters` 区段，两张卡片分别讲「双轨 1000 天」与「精神圣所」，导航新增一项、页脚新增两项，各自链到对应指南页。
- **`/chapters` 与 `/sanctuary` 两个指南页**：共用 `app/components/GuidePage.tsx`（客户端组件 + 服务端下发的 `initialLocale`），与落地页走同一套语言规则：服务端按国家/`Accept-Language` 判定首帧语言，本地存储里用户已选的语言在 hydration 后接管，繁体由既有的 OpenCC 过程转换，因此只维护 zh/en 两份文案。

## 首页那一行章号是「算出来才显示」

首页的「我此刻的这一章」直接复用免费预览已有的 `metrics`，因此两者不可能互相矛盾；并且只在用户真的填了出生日期与目标年龄之后才渲染——**没有输入就没有数字，不编一个出来**。英文页的分支（`isBonusLife ? 额外旅程第 N 天 : 距本章结束还有 N 天`）与小程序用同一条 `lived > target` 边界。

## 严格保留

- `app/` 下原有 33 个受保护文件里，只动了 `Experience.tsx`（首页）与 `globals.css`；`lib/` 下 16 个里只动了 `life-calculations.ts`。其余 44 个网站文件逐字节未变。
- 5 个既有路由（`/`、`/privacy`、`/terms`、`/third-parties`、`/account-deletion`）全部保留，新增的两页是并列关系，没有替换任何页面。
- 所有既有导出保留，`calculateLifeMetrics` 只增字段不改字段。`life.js` 与数据库迁移未触碰。
- 新样式只使用 2.0.7 已有令牌（`--paper` / `--line` / `--green` / `--green-2` / `--gold` / `--muted` / `--surface-soft` / `--serif`），**没有引入任何新色值、新自定义属性、远程资源、滤镜或动画**，因此明暗两套主题与字体决策都自动生效。

## 分享与隐私口径

2.0.8 引入的 `shareOverride()` 例外（仅「本人查看 + 圣所已公开」时分享链接带自己的 uid）**这是小程序侧的行为**，网站没有分享卡。但 `/sanctuary` 把它写成公开说明，中英各一段，明确列出唯一例外与边界（私密圣所、他人圣所、访客视角一律回落首页卡片；未公开的记录、邮箱、出生日期、目标年龄与图片地址在任何情况下都不进入分享内容），使网站上的承诺与 `miniprogram/README.md` 的条款一致，而不是只存在于仓库里。

## 验证

- **全量测试 242 项：220 通过、0 失败、22 跳过。** 跳过的是 2.0.7（9 项）与 2.0.8（13 项）展示层基线的版本门控断言，随版本号自跳，属其设计行为。
- 新增两个测试文件、共 25 项：
  - `tests/chapters-parity.test.ts`（7 项）：网站与小程序两份章节实现**逐值对拍**（16×10 组输入交叉、5 个字段全等），1-based 滚动边界，未设目标不产生额外旅程，两个函数的 bonus 边界与计数一致，`totalDays` 可由公开指标复算，异常输入钳位一致。
  - `tests/web-chapters-209.test.mjs`（18 项，2.0.9 交付基线）：120 个受保护文件的 SHA-256；相对 2.0.8 基线的**变化集合恰好等于** `Experience.tsx`、`globals.css`、`life-calculations.ts` 三个文件；小程序 56 个受保护文件与 12 个数据库文件逐字节不变（并断言这两个集合非空，避免 glob 失效后空跑通过）；9 个模板绑定契约冻结；两页双语结构键逐项等量且英文文案无中文残留、组件内零硬编码文案；新样式无字面色值/无新令牌且引用的令牌都已被声明；6 组实际用到的令牌配色在明暗两套下对比度 ≥ 4.5；`/sanctuary` 已公开写明分享例外。
- **与 2.0.8 基线交叉比对**：`protectedFiles` 由 117 增至 120（新增 3 个网站文件）；`changed` 集合恰好是上面那 3 个；**9 个模板的绑定契约 9/9 逐字未变**。
- 全量 ESLint、小程序 ESLint、`tsc --noEmit`、`next build` 全部通过；构建产物中 `/chapters` 与 `/sanctuary` 均已注册。
- **本地生产构建实测抓取**（`next start`，绕开沙箱代理）：
  - `/chapters`、`/sanctuary` 均 200；`Accept-Language: zh-CN` 得到简体正文，`en-US` 得到英文正文，`<main lang>` 分别为 `zh-CN` 与 `en`。
  - 英文页**去标签后的可见正文不含中文**；唯一的中文是 `<title>`（`双轨 1000 天｜余生有刻`）——这是全站既有行为（`app/layout.tsx` 的 metadata 只有中文，`<html lang="zh-CN">`），不是本版引入。
  - 真实渲染快照已保存在 `~/个人知识库/03-项目/lifescale-2.0.9-页面快照/`（4 个文件，样式已内联，可离线打开）。
- 受保护基线重建为 `tests/fixtures/ui-209-baseline.json`（120 个文件 + 9 个绑定契约；`ref` 记录功能提交 `3d9f5f9`，哈希在随后的收尾提交中冻结）。重建仍走 `scripts/build-release-baseline.mjs <版本> <提交> [新增文件…]`，3 个新增文件在命令行显式列出。

## 尚未验证

- **未部署到 `app.lifescale.space`**。网站改动的上线通道是 `.github/workflows/deploy-overseas.yml`（push 到 `codex/overseas-app` 或手动触发），但它 8/8 次运行都在 `Pull Vercel production settings` 失败，根因是仓库 secret `VERCEL_TOKEN`（2026-08-21 设置）已失效：`The token provided via --token argument is not valid`。本机也没有 Vercel 凭据。**要上线必须先换 token**。
- **首页篇章区未过肉眼**：落地页是客户端渲染，`isPending` 期间只输出 `<main class="app-loading full">LifeScale</main>`，抓取到的 HTML 里没有区段内容（这是既有架构，2.0.7/2.0.8 亦然）。两个指南页是服务端渲染，已实测；首页新增区段的实际排版、折行与移动端表现需要在浏览器里看一次。
- 未做真机/多浏览器视觉验收；未测屏幕阅读器对新增 `aria-live="polite"` 章号区域的实际朗读。

## 待决（未擅自改）

- `/privacy` 正文写「记录和图片不提供公开选项」。圣所既不是记录也不是图片，且默认私密，因此不构成直接矛盾；是否要在隐私说明里补一句圣所条款（以及 2.0.8 那次分享例外），属对外法律文案，留给决策人。
- `/privacy`、`/terms` 等法务页共用 `LegalPage` 的页脚只有 4 个链接，不含新两页；两个指南页的页脚含全部 6 项。补齐法务页页脚会改动受保护文件 `LegalPage.tsx`，未做。
- 2.0.7 遗留的两项（主题断层：`theme.json` 原生导航栏与 tabBar 仍是旧色；报告卡 PNG 与 PWA manifest 仍是旧配色）本版未触碰。
