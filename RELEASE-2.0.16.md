# 2.0.16 把「登录」从右上角挪走，让位给微信胶囊

日期：2026-09-28。

## 问题

登录按钮虽然在前一版改成实底看得见了，但仍然挤在右上角和品牌、时间胶囊之间。tommy 在两次截图反馈里都指出：「右上角塞太多东西，作为行动按钮它根本没起到作用」。

真正的根因不是样式而是**位置**：`navigationStyle: "custom"` 把整页拆掉之后，**微信小程序原生胶囊（`•••` 和 `◎`）强制渲染在右上角、不可移除、不可隐藏**。任何把按钮绝对定位到右上角的做法都会和胶囊打架 —— 轻则被压住看不见，重则顶进状态栏电量图标。

## 修改

只动 `miniprogram/pages/index/index.wxml` 与 `.wxss`。

### 1. 顶栏：自定义导航栏右侧完全留白避让胶囊

旧：`.landing-nav` 内 `.brand-row`（左侧品牌）+ 登录按钮（右侧）。
新：`.custom-nav-bar` 内 `.nav-brand`（左侧品牌），**右侧不放任何元素**。padding-top 100rpx 留出刘海/状态栏空间。

### 2. Hero：主 CTA + 次 CTA 双按钮组

旧：单「先写下今天」主 CTA + 同色实底登录按钮作为 `.mini-login` 附在旁边（仍然是填充态，容易抢主 CTA 风头）。
新：`.hero-actions-row` 包两个 `.cta-btn`：

| 按钮 | class | 浅色样式 | 深色样式 | 占比 | 事件 |
|---|---|---|---|---|---|
| 主 CTA | `.cta-btn.primary` | `#17382b` 实底 + 白字 | `#3f7359` 实底 | flex: 1.3 | `startWriting` |
| 次 CTA | `.cta-btn.secondary` | `rgba(23,56,43,0.05)` 浅底 + 1.5rpx 细边框 | `rgba(237,243,239,0.06)` + 1.5rpx 细边框 | flex: 1 | `goLogin` |

`button::after { border: none; }` 全局已清零，这次重复声明以保证细边框就是我们画的边框，不掺杂微信默认 1rpx 灰边。

### 3. 行为零变化

`startWriting` 仍然 `navigateTo` 到 `/pages/record/record`，`goLogin` 仍然按「带预览则跳 onboarding、不带则跳 auth」分发。i18n 键、js handler、data flow 都不动。

## 验证

- 全量自动测试：**347 项，254 通过，0 失败，93 跳过**（与本折开工前 344 项对比，新增 3 项：hero 双 CTA 行存在断言、secondary 是「浅底 + 细边框」而不是实底、dark 模式下 secondary 也要走自己的规则）。
- `eslint --config eslint.mini.config.mjs miniprogram`、`tsc --noEmit`、`git diff --check` 全部通过。
- 反向验证（故意破坏，确认测试真的会红）：把按钮塞回 `.custom-nav-bar` 内 + 拆掉 `.hero-actions-row` → 第 1、2、7 条红；把 `.cta-btn.secondary` 改成实底 `#17382b` → 第 4 条红。还原后全绿。
- 关键修正（上一折就在用的）`scripts/build-release-baseline.mjs` 里 `contract(source)` 指纹：剥离 `class`/`style`/`color`/`placeholder-style` 后的标签+表达式哈希；本版 `markup 9 -> 9 (+0)`、`markup contracts identical to the previous release: 9/9`。

## 受保护基线

- 冻结 `tests/fixtures/ui-2016-baseline.json`，继承自 `ui-2015-baseline.json`（脚本已确认父版本是紧邻的上一版）。
- `protectedFiles 125 -> 125 (+0)`，本折无新增受保护文件；改动集恰好不包含 `protectedFiles` 中的任何项（`miniprogram/pages/index/index.wxml` 与 `.wxss` 历来不在受保护清单中）。
- `dashboard.wxss` 未按既有惯例纳入保护清单（历版只冻结 `pages/*.js` 与 `*.json`），本报告明确记录这一事实。

## 发布状态

- 源码已推送远端：`4524d97..a6cb18e` → `https://github.com/found007-commits/lifescale.git`（分支 `codex/overseas-app`）。
- 小程序 2.0.16 已通过开发者工具 CLI 上传为开发版本（`✔ upload`，appid `wxa1ad4ff408b7727d`，473.7 KB），后台 `develop_info.info_list[0].basic_info.version = "2.0.16"`，上传时间 2026-09-28 15:03:26。
- **提交审核与发布需 tommy 在微信后台操作**（开发者后台认的是你自己的登录态）。今日仍建议直接提审 2.0.16。
- 服务端无改动；`app.lifescale.space` 仍缺 2.0.15 的 `/api/miniprogram/bootstrap`（Vercel 令牌过期待换），与本版无关 —— 本版不依赖服务端。