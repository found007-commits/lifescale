# 2.0.13 — 让四个法务页终于能变深色

日期：2026-09-20。基于 2.0.12 收尾提交 `a99dcda`；功能提交 `3056760`；基线与测试提交 `3f232af`。

## 这一版修的是一个「沉默地不生效」的问题

2.0.12 的收尾验收里，我给四个法务页各跑了 light/dark 两组用例并报了「通过」。**那四组 dark 用例什么都没验**：

```
/privacy-desktop-dark  theme=""  bg=rgb(245, 245, 247)   ← 与 light 一模一样
```

页面确实返回 200、文字确实正确、布局确实没坏——它只是**完全忽略了深色请求**。而当时我的断言只检查内容，不检查主题是否真的生效，于是它一路绿灯。

查下去根因很清楚：主题靠 `document.documentElement.dataset.theme` 生效，而**唯一会设置这个属性的是 `useTheme()`**，它只在 `Experience.tsx`（首页）、`Dashboard.tsx`、`GuidePage.tsx`（指南页）里被调用。`LegalPage.tsx` —— 也就是 `/privacy`、`/terms`、`/third-parties`、`/account-deletion` 四页 —— **从来没调用过它**，`layout.tsx` 里也没有任何初始化脚本。

所以这四个页面**永久浅色**：系统偏好无效，在首页选过深色也无效。

**为什么一直没被发现**：它不报错、不空白、不影响功能，只是永远白着。页头又是同一条 `.legal-header`，看着「跟首页一样」。

**为什么现在必须修**：2.0.11 让指南页能变深了，于是**同一个页头家族里出现了两套行为**——`/chapters` 变深、`/privacy` 不变。而 2.0.12 刚把这两类页面的法务文案做成同口径，视觉上却分家，说不过去。

## 改动内容

### 1. 在绘制前把主题写上去（`app/layout.tsx`）

```js
const THEME_INIT = `(function(){try{var k="lifescale:theme";var s=window.localStorage.getItem(k);var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`
```

放在 `<head>` 里。**读的是同一个存储键**，所以首页选过的深色会一路带到法务页。

顺带解决了另一件事：`useTheme()` 是在 effect 里设置的，也就是**首次绘制之后**——凡是用它的页面本来都可能有一帧白闪。绘制前执行把这个也一并消掉了。

> **为什么放在 layout 而不是给 LegalPage 加 `useTheme()`**：那样就得把整页变成客户端组件，只为了让一个属性被写上。放在 layout 是根因位置——**主题属于文档，不属于某一页**。

### 2. 法务页加上同款主题按钮（`ThemeButton.tsx` + `LegalPage.tsx`）

按钮单独拆成一个客户端组件，这样 `LegalPage` 仍是服务端组件——**和 2.0.10 给指南页拆 `LocaleSelect` 是同一个套路**，无障碍名称由调用方传入。

- 类名沿用 `.theme-button`，图标沿用同一个 `◐ / ☼`，**不发明第二套设计**；
- 页头把返回链接移进共用动作行 `.header-actions`，于是 2.0.10 为那行动写的规则需要**从 `.guide-header` 放宽到 `.legal-header`**——两个页头都是 `.legal-header`，一条规则管两处，而不是两条会各自漂移的规则；
- `≤760px` 隐藏直接继承既有规则，没有新增断点。

### 3. 一处硬编码色值必须跟着走

`.legal-content p, .legal-content li { color: #51685d }` 是法务页里**唯一**的硬编码颜色——接入主题之后，它就变成唯一会坏的东西：

| 组合 | 对比度 | 判定 |
|---|---|---|
| `#51685d` 在浅色底 `#ffffff` 上 | **5.53:1** | ✅ 达标，**保持原样** |
| `#51685d` 在深色底 `#151518` 上 | **3.03:1** | ❌ 低于正文所需的 4.5:1 |
| 换成令牌 `var(--green-2)` `#b0b0b9` 在深色底 | **9.19:1**（线上实测） | ✅ |

改法是**只加深色覆盖**，浅色一个像素都不动：

```css
:root[data-theme="dark"] .legal-content p,
:root[data-theme="dark"] .legal-content li { color: var(--green-2); }
```

## 受保护文件

法务页与样式表都在保护清单内，所以本版推版本号并冻结新基线：

```
inherited from ui-2012-baseline.json (2012)
protectedFiles 121 -> 122 (+1)
markup 9 -> 9 (+0)
added to protectedFiles:
  app/components/ThemeButton.tsx
changed since ui-2012-baseline.json:
  app/components/LegalPage.tsx
  app/globals.css
  app/layout.tsx
markup contracts identical to the previous release: 9/9
```

- 保护清单 **121 → 122**：新增一个新组件，**一个都没丢**；
- `changed` 集合**恰好 3 个文件**；
- **9 个模板绑定契约逐字未变**；
- **小程序与数据库 0 改动**（本版纯网站）。

## 验证

- **全量测试 301 项：217 通过、0 失败、84 跳过。**（2.0.12 为 288 / 215 / 73；本版新增 13 项，2.0.12 的门控随版本号自跳。）
- 新增 `tests/web-legal-theme-213.test.mjs`（13 项），重点不在「文件里有没有那行」，而在**会不会被静默改回去**：
  - **脚本必须渲染在 `<head>` 内**（不是「常量存在」——常量声明在 JSX 上方，只查名字的话，脚本被挪到 `<body>` 也照样绿）；
  - **初始化脚本与 `useTheme` 必须读同一个存储键**：两个读取者漂移到不同键，正是这个 bug 回来的方式；
  - 深色覆盖必须**指向与它替换的字面量相同的元素**，且不得引入第二个字面量；
  - **对比度用算术断言，不看眼睛**，并且**双向**断言：保留的浅色字面量达标、深色令牌达标、**以及被淘汰的那个组合确实不达标**（否则这条测试可能只是碰巧为真）。
- **反证**：
  - 把 layout 里的脚本换成空（`__html: ""`）→ **第 1、7 条失败**；
  - 删掉深色覆盖 → **第 1、11 条失败**；
  - 每次还原后 **13/13 复绿**。

  > 第一次做反证 A 时我用 `perl` 整段删除，结果**命令输出为空**——测试根本没跑起来（文件被我改坏了）。「没有失败」被我当时当成了别的东西。改用最小改动（只替换脚本体）后反证正常成立。**反证无效时不能算反证成立。**

- **发版门禁的部署前反证**：对仍是 2.0.12 的线上跑 `--verify-only` → 本版两条 CSS 标记 **0**、四个法务页主题按钮 **0**、退出码 **1**；同时前三版标记全为 1、2.0.12 的政策文本与撤回句判定不变（**既有检查没被本版顶掉**）。
- **真实浏览器验收，本地与线上各 17 项全通过、0 问题**（4 个路由 × 桌面 1280 / 窄屏 320 × light/dark，加一组开关与持久化）：

```
OK  privacy-desktop-light   theme=light bg=rgb(245,245,247) para=rgb(81,104,93)   5.53:1
OK  privacy-desktop-dark    theme=dark  bg=rgb(10,10,12)   para=rgb(176,176,185) 9.19:1
… 四个路由结果一致 …
OK  toggle-and-persist      light -> dark, cold load on /terms = dark
```

  另含：品牌仍在左端（2.0.11 的修复未被破坏）、320px 无横向溢出、`≤760px` 按钮按既有规则隐藏、**无脚本错误**。
- 线上部署完成，复验 `✓ deployed and verified`。

## 尚未完成 / 需要决策

**小程序旧四页的配色统一没有做**，因为调查之后发现原来的判断不准确，详见交付报告。简要说：

- 那 ~55 处「硬编码色值」**不全是漂移**。`dashboard.wxss` 的 `#f4f4f6 / #111116 / #d4af37` 是「温和/清醒」**两种模式的产品设计**；`index.wxss` 的 `#123f31` 是首页宣言色块的设计。
- 这 5 个文件**各自还写着 `prefers-color-scheme` 媒体查询**。
- 老调色板（暖米白＋墨绿）与 `.ui-207` 令牌（`--bg-main/--text-primary`）是**两套不同的颜色**，所以「迁到令牌」**必然改变外观**——它是一次视觉改版，不是一次等价替换。
- 因此它需要逐页确认外观，且只能在小程序模拟器里验（真机不可用）。建议单独一版、逐页过目。

其余未决：报告卡 PNG 与 PWA manifest 配色（需授权破受保护红线）；繁体下语言名称被 OpenCC 转换。**提审仍无法代做。**
