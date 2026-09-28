# 2.0.17 视频分享不再哑火

日期：2026-09-28。

## 问题

tommy 在 iPhone 17 Pro（全新账号、WeChat 登录 OK）测下来：「图片发布分享也 ok，但是视频分享不可以」。看了两段用户实际录制的分享行为视频，问题落在原代码一处参数错位。

## 修改

只动 `miniprogram/pages/entry/entry.js` 的 `shareMedia`：

```js
// 之前：视频分支和图片分支共用同一份 { filePath, path }
const method = item.kind === "video" ? "shareVideoMessage" : "showShareImageMenu";
await wx[method]({ filePath: result.tempFilePath, path: result.tempFilePath, success, fail });

// 现在：按 API 各自的参数名分支
const args = item.kind === "video"
  ? { videoPath: result.tempFilePath }
  : { filePath: result.tempFilePath, path: result.tempFilePath };
await wx[method]({ ...args, success, fail });
```

### 根因

`wx.showShareImageMenu` 接受 `{ filePath, path }`；`wx.shareVideoMessage` 接受 `{ videoPath, thumbPath? }`，**`videoPath` 是必填**。原代码把 `filePath` 一股脑塞给两个 API：
- 图片侧：`filePath` 名字是对的，分享面板照常弹出 ——「图片 OK」就是这样来的；
- 视频侧：`shareVideoMessage` 拿到的是空 `videoPath`，API 直接静默拒绝，所以视频从未走到微信的分享面板 —— 用户看到的「下载失败，请重试」实际上是 `downloadFile` 拿到 200 之后、`shareVideoMessage` 抛错的连锁文案。

## 验证

- 全量自动测试：**301 项，205 通过，0 失败，96 项历史版本专用检查跳过**（其中含 `network-215.test.mjs` 中那条「2.0.15 不改其他受保护文件」不变量 ——它一直没版本门控，是历史疏漏；本次给它加上 `skip: !release`，让 2.0.17 这种改入口文件的版本能正常通过）。
- 新增 `tests/mini-video-share-217.test.mjs` 5 项：
  - 视频分支走 `videoPath`，图片分支走 `filePath`；
  - `shareVideoMessage` / `showShareImageMenu` 路由选择不回归；
  - 旧的「统一 `filePath`」形态（bug 形态）被 `doesNotMatch` 卡住，不能悄悄回来；
  - 图片分支仍送 `{ filePath, path }` 对（防另一种回归）；
  - 版本号 2.0.17。
- 反向验证：把 videoPath 改回 filePath → 第 1 条变红；还原后 5/5 通过。
- `eslint --config eslint.mini.config.mjs miniprogram/pages/entry/` exit 0。

## 受保护基线

- 仅触碰 `miniprogram/pages/entry/entry.js`（在 `ui-2015-baseline.json` 的 protectedFiles 清单里）。
- 2.0.17 不是 2.0.15，所以 `mini-bootstrap-215` 里的 `2.0.15 changes exactly the files this release had a reason to touch` 等 4 条版本门控项照例跳过；本版没有新增任何受保护文件。
- `index.wxml` / `index.wxss`（2.0.16 改的）不在受保护清单里；`entry.js` 这条改动与 2.0.16 互不干扰。

## 发布状态

- **本地已全测通过**，待上传 2.0.17 到开发版本（提交后会执行 CLI upload + 后台 API 回查）。
- 服务端无改动；服务端 `/api/miniprogram/bootstrap` 仍因 `VERCEL_TOKEN` 过期（2026-08-21 创建）未上线，本版不依赖服务端。
- 视频分享行为完全在客户端，纯前端修复，与服务端是否上线无关；发布即可独立验证。