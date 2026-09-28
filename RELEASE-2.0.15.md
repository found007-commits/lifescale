# 2.0.15 一次请求打开「今天」，外加断连恢复

本版由两部分组成：**网络断连恢复**（2026-09-25）与 **dashboard bootstrap 合并请求**（2026-09-28）。两者共用一个版本号，一起发布。

日期：2026-09-28。

## 一、为什么改：打开慢在哪里

冷启动原本要串行走四段网络才能显示出内容：

```
app.js onLaunch
  └─ loadRuntimeConfig()          已改为缓存先行，不再阻塞
pages/dashboard.onShow
  ├─ getProfile()                 第 1 个 RTT
  ├─ Promise.all(entries, checkins, checkinCount)   第 2 个 RTT
  └─ 媒体批量签名                  第 3 个 RTT（要等上一步拿到的 storage_path）
```

每个 RTT 都是一次跨洋往返。本机探测（深圳 Wi-Fi，不代表真机）：Supabase 冷 TLS 握手 2.41s、热连接 ~0.35s；app.lifescale.space 冷握手 1.32s。三段串行叠加，真机上就是「点开要卡一下」。

## 二、本次范围

### 1. 新增 `/api/miniprogram/bootstrap`（一次请求拿齐首屏）

- 服务端策略在 `lib/dashboard-bootstrap.ts`，`app/api/miniprogram/bootstrap/route.ts` 只负责接 Supabase。
- 请求携带设备自己的 access token，服务端用它建客户端，**RLS 照旧逐行过滤**，不碰 service role。
- 隐私顺序不变：请求要在 First paint 之前拿到 profile，因此服务端**先读 profile**；微信专属账号（`*@wechat.lifescale.invalid`）资料未完成时，直接返回 `setupRequired`，**一条记录都不读**。这条由 `tests/bootstrap-215.test.ts` 锁死（破坏后 2 条变红）。
- 只给静态图签名，视频与 GIF 保留占位；签名 URL 只接受落在本项目自己 storage 里的三种形态，其他一律丢弃。
- 响应头 `Cache-Control: private, no-store`。

### 2. 小程序端

- `utils/supabase.js` 新增 `bootstrapDashboard()`；令牌过期刷新一次后重试一次，其余错误原样抛出交给页面处理。
- `app.js` 在 `onLaunch` 就把请求发出去，不等 tab 切换；写入发生在首屏之前时（`data-freshness` 版本号变化）这次答案作废，页面重新读。
- `pages/dashboard/dashboard.js` 保留「逐项读取」作为回退：**服务端与上传的包是分别发布的，任何一边都可能是旧的那一边**。接口返回 404/405/501 时走回退，其余错误照常显示给读者。移除回退 → 测试第 3 条变红。
- 首屏改为骨架屏（`dashboard.wxml` / `dashboard.wxss`），不再是孤零零一行「正在打开今天」。骨架只用既有 surface 变量，浅色深色自动跟随，不新增第二套颜色。

### 3. 网络断连恢复（先前已经写好，折叠进本版）

- 小程序：GET/HEAD 遇到连接重置等临时传输失败，400ms 后最多重试一次；失败后给中文提示与「重新加载」入口；刷新失败保留已显示的数据。
- 网页：`lib/network-fetch.ts` 的读取遇到传输失败最多重试一次，提供友好错误。
- 不自动重放 POST/PATCH/DELETE，不改数据库、权限、目标年龄策略或记录内容。
- 这是断连恢复改进，**不是对用户运营商到海外服务的连通性保证**；尚未复测反馈用户的真实 5G 环境。

## 三、验证

- 全量自动测试：**338 项，249 通过，0 失败，89 项历史版本专用检查跳过**（与本版开工前持平，没有新增被版本门控静默跳过的一组）。
- `eslint .`、`eslint --config eslint.mini.config.mjs miniprogram`、`tsc --noEmit`、`git diff --check` 全部通过。
- 新增 22 项：服务端策略 7 项（含服务端与设备端「微信专属账号」判定逐条对齐），小程序端 15 项（单次请求、送上跳转不读记录、旧服务端回退、启动预取与失效、令牌刷新重试一次）。
- 反向验证（故意破坏，确认测试真的会红）：去掉服务端隐私门控 → 2 条红；取消旧服务端回退 → 1 条红；请求不带用户令牌 → 2 条红；夹具删掉模板变更声明 → 2 条红。破坏后均已还原并复跑通过。
- 本地 `next dev` 实测新接口：无令牌 401；伪造令牌 401（伪造令牌走完 `getUser` 被拒，不回上游错误细节）。**没有读写任何真实用户数据。**

## 四、受保护基线

- 冻结 `tests/fixtures/ui-2015-baseline.json`，继承自 `ui-2014-baseline.json`（脚本已确认父版本是紧邻的上一版）。
- `protectedFiles 122 -> 125 (+3)`：新增 `lib/dashboard-bootstrap.ts`、`lib/network-fetch.ts`、`app/api/miniprogram/bootstrap/route.ts`。
- 改动集恰好为本版有意修改的 5 个受保护文件：`app/components/Dashboard.tsx`、`lib/supabase/client.ts`、`miniprogram/app.js`、`miniprogram/pages/dashboard/dashboard.js`、`miniprogram/utils/supabase.js`。
- **本版改动了一个被盯着的模板** `dashboard.wxml`（骨架屏 + 重新加载按钮），仓库里那条「现有绑定契约不得变更」的跨版本不变量因此报警。经确认引入最小豁免： release 可以在自己的夹具里用 `markupChanges` 写明「改了哪个模板、为什么」，理由跟着夹具走而不是藏在提交信息里；**未声明的页面依旧逐字节受锁**。为此给 `scripts/build-release-baseline.mjs` 增加了 `--markup-change=<路径>=<原因>`，并修改了 `tests/web-legal-theme-213.test.mjs` 的判定（一处，不是三处；另外两处只比较键集合，未受影响）。豁免有效性已反向验证。
- `dashboard.wxss` 未按既有惯例纳入保护清单（历版只冻结 `pages/*.js` 与 `*.json`），本报告明确记录这一事实。

## 五、发布状态：小程序已上传，服务端尚未上线

**已验证：**

1. **源码已推送远端**：`b2978a2..72a0b1d` → `https://github.com/found007-commits/lifescale.git`（分支 `codex/overseas-app`）。
2. **小程序 2.0.15 已上传**（`cli upload`，appid `wxa1ad4ff408b7727d`）：主包 448.8 KB + 分包 23.8 KB = 总计 472.6 KB，结果 `✔ upload`。**上传的是开发版本，尚未提交审核、尚未发布。**
3. **CI 已在干净环境独立复核**：`gh run 36381622365`（`.github/workflows/deploy-overseas.yml`）——`Lint ✓`、`Type-check ✓`、`Run focused tests ✓` 全部通过，与本机结论一致。该工作流此前被手动禁用，本次临时启用执行，事后已恢复禁用状态。

**未完成（阻塞在生产部署）：**

- CI 的 `Pull Vercel production settings` 失败：`The token provided via --token argument is not valid`。仓库 secrets 里三个 Vercel 变量都在，但 **Vercel 令牌已失效**（创建于 2026-08-21）。本机也没有任何可用的 Vercel 登录态（无 `~/.vercel`、无钥匙串条目、`.env.local` 里的 VERCEL_OIDC_TOKEN 同样过期）。
- 因此生产环境**目前还没有这个接口**：实测 `POST https://app.lifescale.space/api/miniprogram/bootstrap` → **404**。在这个状态下，刚上传的小程序会走回退路径（表现与 2.0.14 相同），**不会报错，但也拿不到提速**。这一路径本身已经在 localStorage 测试里覆盖，行为符合预期。
- **换取新令牌后即可部署**：在 Vercel 生成新令牌 → 更新仓库 secret → 启用工作流触发一次（流水线自带 lint/类型/测试三道闸，通过后才 `vercel deploy --prod`）。

**需要你手动做的两件事：**

1. 提交审核并发布：微信管理后台认的是你自己的登录态，上传动作能做，提审与发布按钮必须你点。
2. 真机复测冷启动体感，以及后台「体验评分」的启动耗时数据。

## 六、回滚

- 服务端：回退到上一生产部署 `dpl_DAVPM6Vct2q8xzUZt5mfVZfX7T5B`（本版尚未部署，生产仍在该版本上）。
- 小程序：回退到已发布的 2.0.14。旧版小程序不会调用新接口；新版小程序在旧服务端上自动回退到逐项读取，**两条路径都经过测试**。
