# 前后台资源管理设计（方案，未实施）

- 日期：2026-11-25
- 状态：**设计稿**。本阶段不写入任何代码。
- 前置结论：当前系统**完全没有**窗口状态管理（launcher 0 处 `visibilitychange`，userscripts 0 处），且 Playwright 默认参数把 Chromium 自带的后台降级全部关闭。所以这项设计不是「优化」，而是**把被关掉的能力接回来 + 给脚本一个统一的休眠开关**。

---

## 1. 必须区分的四种状态（不能混为一谈）

| 状态 | 判定来源 | 浏览器行为 | 本设计的处理 |
|---|---|---|---|
| **A. 前台活跃** | `document.visibilityState === 'visible'` 且窗口有焦点 | 全速 | 全功能 |
| **B. 失焦但仍可见**（点了别的窗口，抖音还露着） | `visibilityState === 'visible'` 且 `!document.hasFocus()` | 仍渲染、仍计时 | **只降频，不暂停**。用户能看见画面，暂停会显得「卡住」 |
| **C. 最小化** | `visibilityState === 'hidden'`（Chromium 对最小化窗口置 hidden） | 请求 1 fps 计时上限 | **暂停视频 + 停轮询 + 释放媒体** |
| **D. 窗口被完全遮挡**（另一个窗口盖住） | Electron/Win32 层面才有；DOM 无法可靠判断 | 视 OS 而定 | **不做特殊处理**（无法在网页层可靠识别，硬做会误判） |

关键：**B 和 C 必须分开**。用户的原始诉求是「窗口最小化→暂停」，不是「切走就暂停」。

---

## 2. 分层设计

### 第 0 层（最省事、收益最大）：把 Chromium 自己的后台降级打开

改动点：`app/launcher/launcher.js` 第 61–66 行的 `launchPersistentContext` 参数。

```js
ignoreDefaultArgs: [
  '--no-sandbox',
  '--enable-automation',
  '--disable-background-timer-throttling',        // ← 删掉
  '--disable-backgrounding-occluded-windows',     // ← 删掉
  '--disable-renderer-backgrounding',             // ← 删掉
],
```

效果（Chromium 内置机制，非自研）：
- 最小化后定时器被限到 **1 次/秒**
- renderer 进程降到低优先级（CPU 竞争让位）
- 光栅/合成降级

代价：**窗口可见但失焦时定时器也会被降频**（Chromium 对 occluded/backgrounded 的判定包含「窗口不可见」）。这可能影响「抖音在后台继续播放声音」——用户要求最小化时暂停播放，所以这一条反而是**符合诉求的**。但需要实测确认：**失焦但仍可见时是否也会被降频**（若会，则 B 状态下用户看到的画面可能掉帧 → 需要回滚其中一条）。

> 这是本设计唯一的「必须实测才能定稿」的点。其它层可以独立不动。

### 第 1 层：launcher 侧旁路监听窗口状态

Playwright 的 `BrowserContext` 不直接提供窗口最小化事件。可行方案（按可靠性排序）：

| 方案 | 做法 | 可靠性 |
|---|---|---|
| **①（推荐）** 页面内判定 | 注入一段极小的 lifecycle 脚本，监听 `document.visibilitychange`，把状态通过 `window.__dyLifecycle.state` 暴露，并用 `exposeBinding('__dyState')` 上报给 launcher | ✅ 零依赖，Chromium 对最小化一定发 hidden |
| ② Win32 钩子 | node 侧用 `ffi-napi` 监听 `WM_SIZE`/`SIZE_MINIMIZED` | ⚠️ 引入原生依赖，打包体积 + 崩溃风险 |
| ③ 轮询 `page.evaluate(() => document.visibilityState)` | 每 1 s 一次 | ❌ 自己制造轮询，与本项目目标相反 |

**选 ①**。

### 第 2 层：统一生命周期总线（页面内）

新增一个**独立文件** `app/userscripts/05-lifecycle.js`（编号在 00 之后、10 之前，保证先于业务脚本执行），提供：

```js
window.__DYLC = {
  state: 'active',              // active | blurred | hidden
  subs: new Set(),
  on(fn) { this.subs.add(fn); fn(this.state); return () => this.subs.delete(fn); },
  _emit(s) { if (s === this.state) return; this.state = s; for (const f of this.subs) { try { f(s); } catch (e) {} } }
};
// 三态判定：hidden 由 visibilityState 决定；blurred 由 hasFocus 决定
document.addEventListener('visibilitychange', () => {
  window.__DYLC._emit(document.visibilityState === 'hidden' ? 'hidden'
    : (document.hasFocus() ? 'active' : 'blurred'));
}, { passive: true });
window.addEventListener('focus', () => window.__DYLC._emit('active'), { passive: true });
window.addEventListener('blur',  () => window.__DYLC._emit(
  document.visibilityState === 'hidden' ? 'hidden' : 'blurred'), { passive: true });
// 兜底：某些情况下 hidden 不发事件（最小化到托盘）
setInterval(() => {
  const s = document.visibilityState === 'hidden' ? 'hidden'
    : (document.hasFocus() ? 'active' : 'blurred');
  window.__DYLC._emit(s);
}, 2000);   // ← 唯一的 2 s 心跳，只在状态可能漏发时使用
```

**设计约束**：
- 总线本身**不含业务逻辑**，只广播状态。
- 订阅者是各脚本自己，**不自动暂停别人的定时器**（避免误伤）。
- 总线在 `hidden` 时**不关闭自己的 2 s 心跳**（否则恢复时会漏事件）。

### 第 3 层：各脚本接入（逐个改造，可独立回滚）

每个常驻定时器改成「可暂停」形式：

```js
// 改造前
setInterval(() => this.mainLoop(), 300);

// 改造后（保留原周期，只是 hidden 时跳过）
this._timer = setInterval(() => {
  if (window.__DYLC && window.__DYLC.state === 'hidden') return;
  this.mainLoop();
}, 300);
```

更好的做法（真正省 CPU，而不只是提前 return）：在 hidden 时 `clearInterval`，active 时重建。但这会引入「恢复后状态错乱」风险 → **建议第一阶段只用「跳过执行」，验证稳定后再升级为「真暂停」**。

优先级（按收益/风险）：

| 脚本 | 定时器 | hidden 时 | blurred 时 |
|---|---|---|---|
| 12-douyinplus | 250 ms `runUnlock` | 暂停 | 降到 2000 ms |
| 12-douyinplus | 900 ms ×2 | 暂停 | 保持 |
| 10-frequenk | 300 ms `mainLoop` | 暂停 | 保持 |
| 10-frequenk | 500 ms `LivePurifier` | 暂停 | 保持 |
| 15-akface-download | 2000 ms `scanPerformance` | 暂停 | 保持 |
| 12-douyinplus | 3000 ms 深色兜底 | 暂停 | 保持 |
| nav.js | `mousemove` handler | 无需（窗口不可见时本就不触发） | 无需 |

### 第 4 层：视频暂停与媒体释放

用户要求「最小化时暂停视频播放」。

**暂停（低风险，优先做）**：

```js
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;
  for (const v of document.querySelectorAll('video')) { try { v.pause(); } catch (e) {} }
}, { passive: true });
```

恢复前台时**不自动播放**（自动播放会被抖音的播放器状态机覆盖，且可能触发风控/inline 播放异常）。改为：恢复前台时**提示一次「已暂停，点击继续」或依赖用户手动点击** —— 具体交互需用户确认（写进 P1 待批项）。

**释放媒体资源（高风险，暂不做）**：
`video.src = ''; video.load()` 会把解码器与缓冲释放掉，但抖音的播放器组件会认为「播放出错」，可能触发重拉流、黑屏、甚至上报异常。**列入 P3，需单独实验 + 可回滚开关。**

### 第 5 层：恢复前台不重复初始化

约束来自用户：不刷新页面、不重复初始化插件、不产生瞬时请求。

设计：
- 恢复时**只**做：重建被清除的定时器 / 把 state 广播为 `active` / 恢复 `document.title` 之类轻量操作。
- **不**调用任何 `init()`。现有脚本的 `init` 都会创建按钮、插样式、绑监听器 → 重复调用就是 `[DouyinSave] button mounted ×5` 的翻版。
- 用 `window.__DYLC.state` 作为幂等保护：脚本内的 `init()` 入口加 `if (window.__dyInitDone) return;`。

### 第 6 层：冷启动压缩（与前后台无关，但同属轻量化）

| 手段 | 机制 | 风险 |
|---|---|---|
| `waitUntil: 'commit'`（已采用） | 不等 load | ✅ 已是最快 |
| 延迟注入非关键脚本 | `13-smartfeed`、`20-layout-lab` 在首帧后再注入 | 低（需改 launcher 的 late 批次策略） |
| 无用组件模型清理 | 删 `optimization_guide_model_store`、`WasmTtsEngine` | 低（Chrome 会重建） |
| Code Cache 清理 | 删 `Default/Code Cache` | 低，但**下次启动会重新编译**，属一次性收益 |
| node 侧 Playwright 依赖 | 若 `DY_PLAYWRIGHT` 指向完整包，可换 `playwright-core` 减小加载 | 中（需验证 API 兼容） |

---

## 3. 状态机（实现时必须遵守）

```
        ┌────────── focus ──────────┐
        ▼                           │
   [active] ──blur(仍可见)──► [blurred] ──visibilitychange(hidden)──► [hidden]
        ▲                           ▲                                  │
        └───────── visibilitychange(visible) + focus ───────────────────┘

hidden  → active : 恢复定时器（不调 init）、不自动播放、不发请求
hidden  → blurred: 不应出现（最小化后失焦不改变 hidden）
```

---

## 4. 验证方法（每层独立）

| 层 | 怎么验 | 通过标准 |
|---|---|---|
| 0（删参数） | 最小化 2 min，外部 1 s 采一次 renderer 的 CPU 时间 | 最小化期间 renderer CPU 增量 < 0.5 s/min；恢复后立即恢复 |
| 1+2（总线） | Console 打 `__DYLC.state`，手动切换 4 种状态 | 状态切换无抖动、无重复广播 |
| 3（脚本接入） | 每个脚本单独加开关，A/B 对照 30 min 采样 | 定时器跳过比例 ≈ hidden 时长占比；恢复后功能正常 |
| 4（暂停） | 最小化 → 看 `video.paused` | 最小化后 1 s 内 paused=true；恢复后不自动播放且可手动播放 |
| 5（恢复） | 最小化 2 min → 恢复 → 检查 `launcher.log` | 不出现新的 `button mounted` / `init` 记录 |
| 6（启动） | 冷启动 5 次取中位数 | 到可交互时间下降，且功能回归全过 |

---

## 5. 回滚设计

- 第 0 层：`ignoreDefaultArgs` 恢复原数组（一行）。
- 第 1–5 层：`05-lifecycle.js` 单独文件，**删除即回滚**；各脚本改造点用独立开关常量 `const LC_ENABLED = true`，改 `false` 即恢复原行为。
- 第 6 层：缓存删除属一次性动作，无需回滚（Chrome 自建）。

---

## 6. 明确不做的事

- 不用 Win32/FFI 钩子监听窗口（引入原生依赖）。
- 不在 hidden 时 `video.src=''` 释放解码器（P3，需单独实验）。
- 不自动恢复播放。
- 不为省内存关闭硬件加速（项目硬边界）。
- 不靠持续轮询检测窗口状态（除第 2 层那一个 2 s 兜底心跳）。
