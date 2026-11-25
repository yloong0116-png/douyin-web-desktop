# Userscript 资源审计（只读）

- 日期：2026-11-25
- 审计对象：`%LOCALAPPDATA%\AppData\Local\DouyinApp\userscripts`（**用户实际运行的那一份**）
- 方法：逐文件静态审查 + launcher.log 运行期取证。**未修改任何脚本。**
- 证据等级：**[代码]** 静态审查 / **[日志]** launcher.log 实测 / **[推测]** 未验证

---

## 0. 先说结论

1. 11 个启用脚本合计 **826 KB JS**，通过 `addInitScript` 注入。`addInitScript` 对**每个 frame** 生效，而 5 个脚本没有 top-frame 守卫 → 子 iframe 也会完整解析执行。
2. 常驻定时器合计 **7 个**（300/500/900/900/250/2000/3000 ms），另有 3 个条件性或一次性定时器。最小化后因 `--disable-background-timer-throttling` **全部不降频**。
3. 发现**重复初始化的直接证据**：`launcher.log` 同一秒内出现 5 条完全相同的 `[DouyinSave] v3.3 button mounted`。
4. 没有任何脚本监听 `visibilitychange`（0 处），因此「最小化减少工作」在用户脚本层完全不存在。
5. 已停用的 `14-dydl-download.user.js.disabled` **保持停用**，本审计不提议恢复。

---

## 1. 清单与静态指标 [代码]

| 脚本 | 体积 | setInterval | setTimeout | MutationObserver | addEventListener | top-frame 守卫 |
|---|---|---|---|---|---|---|
| 00-gm-shim.js | 6.4 KB | 0 | 1 | 0 | 7 | ❌ |
| 00-vue.min.js | 105 KB | 0 | 1 | 1 | 1 | — （库） |
| 10-frequenk-enhancer.user.js | 230 KB | **3** | 9 | 0 | 57 | ❌ |
| 11-akface-fullscreen.user.js | 18 KB | **1** | 6 | 0 | 4 | ❌ |
| 12-douyinplus.user.js | 218 KB | **4** | 13 | **3** | 26 | ✅ |
| 13-smartfeed.user.js | 165 KB | **2** | 10 | 0 | 20 | ❌ |
| 15-akface-download.user.js | 26 KB | **1** | 6 | 0 | 8 | ❌ |
| 16-save-video.js | 18 KB | 0 | 2 | 0 | 13 | ❌ |
| 17-glass-nav.js | 3.1 KB | 0 | 1 | 1 | 1 | ✅ |
| 18-hide-assistant.js | 1.4 KB | 0 | 0 | 0 | 1 | ❌ |
| 20-layout-lab.js | 6.2 KB | 0 | 3 | 0 | 2 | ✅ |
| **合计** | **826 KB** | **11** | 52 | 5 | 140 | 3/11 |

> 「top-frame 守卫」= 脚本内是否存在 `window.top !== window.self` 之类的早退判断。没有守卫意味着在抖音的每个子 iframe 里都会再跑一遍完整逻辑。

---

## 2. 常驻定时器逐一定性（不是数数，是判用途）

| 脚本:行 | 周期 | 实际做什么 | 运行条件 | 资源成本判断 |
|---|---|---|---|---|
| 10:3619 | **300 ms** | `SpeedController.mainLoop()`：读当前视频状态、判断是否需要跳过/调速 | 全局，页面加载后立即启动 | ⚠️ **P1 重点**。3.3 次/秒，每次都要查 DOM/读状态。最小化后不降频 |
| 10:4366 | **500 ms** | `LivePurifier.mainLoop()`：判断是否直播页，非直播页立即 return | 全局常驻，非直播页做一次 hostname/path 判断 | ✅ 成本低（早退），但仍是 2 次/秒的无意义唤醒 |
| 12:1554 | **900 ms** | `rateEnforcer()`：强制播放速率 | 全局 | ⚠️ 3 个定时器合计约 2.5 次/秒 |
| 12:1555 | **900 ms** | `checkPlaybackStall()`：卡顿检测 | 全局 | |
| 12:1570 | **250 ms** | `runUnlock()`：直播解锁（遍历 DOM 找锁定元素） | 全局，**4 次/秒** | ⚠️ **最贵的一个**。文档级查询 4 次/秒 |
| 12:3918 | **3000 ms** | `_setDarkFromPage()`：深色模式兜底轮询 | 仅当 `darkMode === 'auto'` | ✅ 条件生效，可忽略 |
| 15:276 | **2000 ms** | `scanPerformance()`：扫描 `performance.getEntriesByType('resource')` 找视频地址 | 全局 | ⚠️ **O(n) 每 2 秒**。长会话中 resource entries 会累积到数千条，每次全量遍历 → 随时间变贵（**推测**：需实测 entries 数量） |
| 11:150 | 无 delay（≈4 ms） | `setInterval` 等待 `document.head` 出现后注入样式，随后 `clearInterval` | 仅当 `document.head` 尚不存在 | ⚠️ 缺少间隔参数。head 存在时立即清除（通常 1–2 次）；若 head 被反复重建则会 4 ms 空转（**推测**） |
| 10:1312 | 条件 | `startSkipCheck()`：最多 5 次，判断跳过是否成功 | 用户触发跳过时 | ✅ 有上限，合理 |
| 13:620 | 2000 ms | 等待服务器响应期间打印进度 | 仅 AI 请求期间 | ✅ 临时 |
| 13:934 | 100 ms | `waitForElement` 轮询，最多 5 s | 调用时 | ✅ 有超时 |

**常驻唤醒总量（页面可见时）**：≈ 3.33 + 2 + 1.11 + 1.11 + 4 + 0.5 = **约 12 次/秒的回调**，每次回调都可能触发 DOM 查询。最小化时同样 12 次/秒。

---

## 3. 观察到的问题（按证据强度）

### P0-a　重复初始化有直接日志证据 [日志]

`launcher.log` 2026-11-25T09:28:39.474Z–.958Z（484 ms 内）出现 **5 条完全相同**的：

```
console: [DouyinSave] v3.3 button mounted prefs={"media":true,...}
```

含义：`16-save-video.js` 在同一个页面上下文里被挂载了 5 次。三次是 iframe 注入（无 top 守卫），两次是 SPA 内组件重建后重复执行。每次都会新建按钮、绑定 13 个监听器、可能留下未被回收的节点引用。

### P0-b　5 个脚本在子 iframe 里重复执行 [代码]

`addInitScript` 对所有 frame 生效（Playwright 语义）。`10`(230 KB)、`13`(165 KB)、`15`(26 KB)、`16`(18 KB)、`00-gm-shim`(6.4 KB) 无 top 守卫 → 抖音页面里每个 iframe 都要再解析执行这 ~445 KB 并启动自己的定时器。**抖音首页的 iframe 数量本轮未实测**（需 CDP），但「无守卫」这一事实本身已足以判定为浪费。

### P0-c　`15-akface-download` 的 2 秒全量扫描 [代码]

`scanPerformance()` 每 2 秒遍历 `performance` 资源条目。会话越长条目越多，成本随时间线性上升。若功能已被 `16-save-video.js` + `launcher.__dySave` 完全覆盖，它属于**纯浪费**（功能重叠关系需在 P1 验证后决定降频或停用，**不在本阶段动它**）。

### P1-a　全局 `mousemove` + 样式写入（nav.js）[代码]

`app\launcher\nav.js` 的返回按钮对 `document` 注册了 **capture 阶段**的 `mousemove`：鼠标每移动几像素就执行一次 `clientX/clientY` 判断，命中左上角时还会**写 `style.opacity`**（触发样式重算）。最小化/失焦时无效，但页面可见且用户在用鼠标时是持续开销。

### P1-b　`10-frequenk` 的 300 ms 主循环 [代码]

`SpeedController.mainLoop` 每 300 ms 执行一次完整状态判定（含 `getCurrentVideoKey()` 之类 DOM/URL 读取）。从 2026-11-25 的 heap 采样看，静置 60 秒 heap +26 MB 而 DOM 节点不变，符合「定时器周期性分配对象」的特征（**推测**，非因果证明）。

### P2　launcher 日志同步写、无轮转 [代码 + 日志]

`log()` 用 `appendFileSync`。`launcher.log` 已达 830 KB / 8240 行，且在持续追加。每条 console error 与 `[DouyinSave]` 消息都触发一次同步磁盘写。

### 已确认无问题

- `17-glass-nav.js`(3.1 KB)、`18-hide-assistant.js`(1.4 KB)、`20-layout-lab.js`(6.2 KB) 体量小、无定时器（17 有 1 个 MutationObserver，已连接/断开配对）。
- `00-vue.min.js` 是依赖库，无业务循环。

---

## 4. 与「前后台管理」的接口现状 [代码]

| 能力 | 现状 |
|---|---|
| 监听 `visibilitychange` | **0 处**（11 个脚本中无一处） |
| 监听 `window.blur/focus` | 0 处 |
| 暂停/恢复定时器 API | 无。所有 `setInterval` 都是裸调用，句柄未统一管理 |
| 插件级「休眠」开关 | 无 |
| launcher → 页面的状态通道 | 无。`exposeBinding` 只暴露了 `__dySetPrefs` / `__dySave` / `__dyBack` |

结论：要实现「最小化降耗、恢复前台不停初始化」，**必须先补一个统一的生命周期通道**（设计见 `BACKGROUND_RESOURCE_DESIGN_20261125.md`），且该通道必须与现有脚本的裸定时器改造配合，否则只能做到「暂停播放」而做不到「停止轮询」。

---

## 5. 本阶段没有做的事（明确边界）

- 未停用、未修改、未降频任何脚本。
- 未改动 `14-dydl-download.user.js.disabled`（保持停用）。
- 未重新测量每个脚本的独立内存贡献 —— 需要 A/B（注入 / 不注入）对照实验，列入 P1 验证计划。
