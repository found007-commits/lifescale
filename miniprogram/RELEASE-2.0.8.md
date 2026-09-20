# 2.0.8 — 双轨 1000 天 + 精神圣所

日期：2026-09-20。基于 2.0.7 提交 `02d879f`。

## 新增能力

- **1000 天篇章**：`utils/life.js` 新增 `CHAPTER_DAYS = 1000` 与 `calculateChapterMetrics(daysLived, totalTargetDays)`，返回 `currentChapter / chapterDayIndex / chapterDaysRemaining / isBonusLife / bonusDayCount`。`calculateLifeMetrics` 增加一个返回值 `totalDays`，让两个函数能对同一条生命线取同一组输入。
- **精神圣所**（分包 `subpackages/sanctuary`，三页）：
  - `pages/space/space`：墓志铭、三条信条、当前篇章、致意墙；自视时显示篇章，访客视角只显示对方公开的部分。
  - `pages/editor/editor`：墓志铭与三条信条的编辑，以及「公开我的圣所」开关。
  - `pages/tribute/tribute`：选择致意类型（`spark` / `flower`）与留言，送达后返回。
- **入口**：设置页顶部新增「我的精神圣所」。

## 数据库

新增迁移 `supabase/migrations/20260920120000_sanctuary_and_chapters.sql`：

- 三张表 `sanctuary_profiles`、`sanctuary_tributes`、`sanctuary_tribute_limits`，以及枚举 `public.sanctuary_tribute_kind ('spark','flower')`。
- **默认私密**：`is_public boolean not null default false`。未公开时，除本人外无人可读，也不会对外暴露「该账号有没有圣所」。
- **服务端决定身份**：`guest_name` 由触发器从留言者自己的 `profiles.display_name` 读取，客户端列级授权里没有它；`tribute_count` 同样不在任何客户端授权列中。
- **限频**：每位访客每小时 20 条，计数器放在客户端角色不可达的 `sanctuary_tribute_limits`。
- 9 条策略全部 `to authenticated`，加 `revoke all ... from public, anon, authenticated, service_role` 与列级 `grant`。匿名角色两张表都不可达。
- 端到端「胶囊」**没有**另建表：`public.future_letters` 已经是有 `deliver_at` / `status` 的密封信件模型，再建一套会成为第二个真源。

## 与原稿的必要差异

原稿不能按原样落地，以下是改动及原因：

1. **`life.js` 会丢导出**。原稿的 `module.exports` 里「保留原有导出」只是注释，直接写会把既有 5 个导出全部抹掉。现保留全部 5 个并新增 2 项，另有测试锁死。
2. **`getSupabaseClient` 不存在**。工程没有 `supabase-js`，是手写 `wx.request` 封装。改为在 `utils/supabase.js` 追加 5 个领域函数，复用既有的 `request()`（401 重试、token 刷新、缓存失效）。
3. **分包 `require` 少一层**。分包页到 `utils/` 需要 4 层 `../../../../`，原稿写了 3 层。
4. **迁移可被滥用**。原稿默认公开、策略不限角色（含 anon）、无 `revoke`、客户端可自定署名、无限频。已全部重写，并在真实 Postgres 上逐条断言。
5. **bonus 边界不一致**。原稿 `isBonusLife` 用 `lived >= target` 且带 `+1` 偏移，会在目标日当天就判定为「额外时光」，与既有 `calculateLifeMetrics.isBonus`（`rawRemaining < 0`）互相矛盾。现统一为 `lived > target`。

另外，原稿提到的「已写好的 WXML/WXSS」在仓库与整个 `~/ChatGPT/lifescale` 中都不存在。三页版面按 2.0.7 设计体系（`.ui-207` + 令牌变量）新写，随主题自动切换明暗。

## 保存路径的一处修正

PostgREST 的 `Prefer: resolution=merge-duplicates` 在 `DO UPDATE SET` 里同时会写 `user_id = excluded.user_id`，而列级授权里没有 `user_id` 的 UPDATE 权限，因此**整个语句会被 403 拒绝**。`saveSanctuaryProfile` 改为先 `PATCH`、为空再 `INSERT`（PATCH 未命中返回 200 + 空数组，可安全用作存在性探测），并对并发首次保存的 409 做一次 PATCH 重试。已在 PGlite 中把这个拒绝行为固化成回归断言。

## 分享

`utils/app-share.js` 保持「只分享应用本身」的默认行为不变。新增一个**显式、可审计**的例外：页面通过 `shareOverride()` 返回 `{ title, path }` 才能改写信封，且路径必须匹配路由形状的白名单正则。目前只有圣所页实现它，并同时要求「本人查看」且「该圣所已公开」；私密圣所与访客视角一律返回 `null`，回落到应用卡片。故私密页面在任何界面都无法被转发。

## 本地化

- `locale-dictionary.json` 453 → 520 条，仅追加、无改写、无删除，原顺序不变。
- `locale.wxs` / `locale-copy.js` 由 `scripts/build-mini-locales.mjs` 重新生成，同样是纯追加（453 → 520，0 改写）。
- `localized-page.js` 导航栏标题表新增 `space` / `editor` / `tribute`；漏加会让标题栏显示裸路由名。
- 数字相关的文案（`第 3 章` / `Chapter 3`、`12 条致意` / `12 tributes`）无法走扁平的整句词典，单独放在 `utils/sanctuary-copy.js` 里按语言组合。

## 严格保留

- 既有 11 个主包页面的数据表达式、事件绑定、条件与循环未改动；`dashboard` / `record` / `history` / `report` / `share` / `onboarding` 六页 WXML 的绑定契约与 2.0.7 基线逐字一致。
- 原年龄修改策略、微信与邮箱登录、仅自己可见、仅媒体记录、一次编辑、留言与删除确认、性能优化代码均未改动。
- 保存路径改为 PATCH + INSERT 后，`miniprogram/utils/supabase.js` 为纯新增 + `saveSanctuaryProfile` 内部实现重写，其余导出未动。
- 未新增运行时依赖；未使用远程字体、模糊滤镜或装饰动画。

## 验证

- 全量测试 217 项：208 通过、0 失败、9 跳过（跳过的 9 项是 2.0.7 展示层基线的版本门控断言，随版本号自跳，属其设计行为）。
- 新增四个测试文件、共 27 项：
  - `tests/sanctuary-database-208.test.ts`（3 项，PGlite 真跑迁移）：未公开不可读、不可伪造署名、不可自致意、不可写计数、20 次限频、旁观者删不掉、房主可清空、匿名角色两表均不可达、9 条策略无 anon；以及本次新增的 PATCH + INSERT 与 upsert 拒绝回归。
  - `tests/mini-chapters-208.test.mjs`（4 项）：`life.js` 原 5 个导出仍在、1-based 滚动边界、两个函数 bonus 语义一致、异常输入钳位。
  - `tests/mini-sanctuary-208.test.mjs`（7 项）：分包四文件完整性、三页所有中文字符串在三语中均可解析且确实已翻译、导航标题、`require` 层级、分享只由本人且已公开时产生、分享路径白名单、数字文案三语。
  - `tests/mini-ui-208.test.mjs`（13 项，2.0.8 交付基线）：117 个受保护文件的 SHA-256；「本次只动小程序」——`app/`、`lib/`、既有 API 与既有迁移与 2.0.7 逐字节一致；9 个模板的绑定契约冻结；无模拟数据/远程资源；18 组实际用到的配色对比度均 ≥ 4.5。
- 与 2.0.7 基线交叉比对：`protectedFiles` 由 109 增至 117（新增 8 个），其中 99 个字节相同；发生变化的 10 个文件恰为本次有意修改的 9 个 `miniprogram/` 文件，加上 `app/globals.css`（其 2.0.7 记录值早于已授权的网站同步）。**六个 2.0.7 页面的绑定契约 6/6 逐字未变。**
- 全量 ESLint、小程序 ESLint、`tsc --noEmit`、`next build`、`git diff --check` 全部通过。
- 受保护基线重建为 `tests/fixtures/ui-208-baseline.json`（`ref` 指向 `fdec932`，117 个文件 + 9 个绑定契约），供本次之后的交付核验使用。

## 尚未验证

- **未在微信开发者工具中渲染**：本会话无法运行开发者工具，三页的实际视觉、暗色模式与不同机型布局尚未过肉眼验收。
- **未上传、未提审、未发布**。需要用户在微信开发者工具中上传 2.0.8 并提交审核。
- 跨用户访问圣所的路径依赖分享链接（见上「分享」一节）。应用内目前只有「设置 → 我的精神圣所」这一个入口；若希望在自己首页也能直接进入篇章与圣所，需要再决定是否在首页加一处入口。
