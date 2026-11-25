# 前后台资源管理设计（2026-11-25）

只读调查 + 方案设计，**未修改任何代码**。所有结论标注证据级别。

---

## 1. 现状

### 1.1 可见性监听

| 脚本 | 是否监听 `visibilitychange` | 用途 |
|---|---|---|
| 10-frequenk | **是**（3598 行） | `document.hidden` 时 `statsTracker.flush()` 落盘每日统计 |
| 其余 8 个 | 否 | — |

结论：现有唯一监听是"数据落盘"，**不涉及资源管理**，与本次设计不冲突；但新逻辑必须保证不打断它的 flush（flush 是异步写，暂停视频不影响）。

### 1.2 下载状态可读性（关键限制）

| 事实 | 证据 |
|---|---|
| `launcher.js` 里**没有** pending / running / tasks 集合或计数器 | `grep -nE "pending\|running\|tasks\|activeTasks" launcher.js` → 零命中 |
| `16-save-video.js` 调用 `window.__dySave(payload)` **不 await、无回执** | 369 行：`try { window.__dySave(payload); flash('…'); }` |
| 下载完成只写 Node 侧日志，不通知页面 | launcher.js `__dySave` 结尾 `log(T + ' DONE ...')` |

**结论：当前无法从页面侧获知"是否真的在下载"。** 任何"下载中不暂停"的实现都必须依赖 launcher 侧配合，或用时间窗近似（见 §3）。

---

## 2. 视频暂停与恢复状态机

### 2.1 为什么必须提前快照

隐藏时暂停后，`video.paused` 会变成 `true`，恢复时再读它已经无法区分"用户本来暂停"和"我们暂停的"。**必须在隐藏处理前记录**。

### 2.2 数据结构

```js
// WeakMap：节点被抖音重建后自动回收，不会残留旧引用
const snapshot = new WeakMap(); // video -> { wasPlaying: boolean, time: number, muted: boolean }
let phase = 'active';           // 'active' | 'hidden'
let lastHideAt = 0;
```

用 `WeakMap` 而不是数组，避免节点销毁后仍被强引用（这正是"内存只增不减"的一类来源）。

### 2.3 隐藏流程

```
visibilitychange → document.hidden === true
  ├─ if (phase === 'hidden') return;            // 幂等
  ├─ if (Date.now() - lastHideAt < 500) return; // 连发去抖
  ├─ phase = 'hidden'; lastHideAt = now
  ├─ for (video of document.querySelectorAll('video'))
  │    ├─ 若 !video.isConnected 跳过
  │    ├─ 记录 { wasPlaying: !video.paused && !video.ended, time, muted }
  │    └─ 仅当 wasPlaying 时才 video.pause()
  └─ 记录本次暂停的元素数（用于日志）
```

要点：
- **只暂停本来在播的**，用户已暂停的不动
- 不调用 `removeAttribute('src')`、不销毁 `<video>`——保恢复成本最低
- 不暂停 `<video>` 之外的媒体（抖音无 audio 元素）

### 2.4 恢复流程

```
visibilitychange → document.hidden === false
  ├─ if (phase === 'active') return;   // 幂等
  ├─ phase = 'active'
  ├─ for ([video, snap] of snapshot)
  │    ├─ if (!video.isConnected) continue;        // 节点已被重建，丢弃
  │    ├─ if (!snap.wasPlaying) continue;          // 原本就在暂停，不 play
  │    ├─ if (!video.paused) continue;             // 抖音自己已经恢复了，不重复 play
  │    └─ video.play().catch(() => {})             // 允许失败，不重试
  └─ snapshot = new WeakMap();  // 清空，防旧状态污染下一轮
```

要点：
- `play()` 可能因自动播放策略被拒（`NotAllowedError`），**捕获后放弃，不重试**
- 不因为恢复而 `load()`、不 `currentTime` 跳转（保持播放进度）
- 不重启播放器、不刷新页面

### 2.5 各场景

| 场景 | 行为 |
|---|---|
| 单个视频在播 | 隐藏暂停，恢复续播 |
| 连续切换多个视频 | 每次只处理当前 `document.querySelectorAll('video')` 的结果；旧的已从 DOM 移除，`isConnected=false` 自动跳过 |
| 播放器被抖音重建（切视频） | 快照里的旧节点 `isConnected=false` → 丢弃；新节点不受影响（抖音自己会播） |
| 用户主动暂停后隐藏 | `wasPlaying=false` → 恢复时不 play，**保持用户意图** |
| 直播页 | 同上；注意直播暂停后恢复可能需重新缓冲，不额外干预 |
| 隐藏期间抖音自动切了视频 | 新视频不在 `snapshot` 里 → 不处理；恢复时它自己会播（`!paused`）→ 跳过 |

---

## 3. 下载任务保护

### 3.1 现实：读不到真实状态

见 §1.2。**当前架构无法实现"检测到真实下载任务"**，除非改 launcher。

### 3.2 两个方案

**方案 A（不改 launcher，本阶段唯一可行）——时间窗近似**

- 在 `16-save-video.js` 的提交处加一行：`window.__dvdLastSubmitAt = Date.now()`（1 行改动）
- 协调器：`if (Date.now() - window.__dvdLastSubmitAt < 45000) return;`（45 秒内不暂停）
- 缺陷（必须写进文档，不能假装准确）：
  - 用户点了取消也算"提交过"→ 误判 45 秒
  - 大文件下载 >45 秒 → 仍会被暂停中断
  - 并发多个任务 → 只认最后一次提交时间

**方案 B（需改 launcher，下一阶段）——真实计数**

- `__dySave` 返回 Promise，launcher 维护 `pendingTasks` Set
- 页面侧暴露 `window.__dvdPending`（或 `exposeBinding` 反向查询）
- 协调器读它判断"是否真有任务"
- 只有 B 能同时满足"面板开着但没任务 → 视为空闲"和"面板关了但仍在下载 → 视为忙"

### 3.3 建议

本阶段**先不做下载保护**，只做视频暂停（暂停视频不会中断 `__dySave` 的 Node 侧写盘，因为下载是 launcher 独立发起的 HTTP，不依赖页面播放状态）。

> 关键判断：**暂停 `<video>` 不会影响下载**——下载走 `parse.rcuts.com` + `fetch`（Node 侧），与页面播放器无关。所以"下载保护"的紧迫性低于最初设想。真正需要保护的是"不要刷新页面"，而本设计本来就不刷新。

结论：**下载保护可以降级为"不做"，等方案 B 再说**。这是本次设计最重要的收敛。

---

## 4. 定时器 / 观察器清单

| 脚本 | 任务 | 机制 | 频率 | 用途 | 隐藏时必要 | 建议 |
|---|---|---|---|---|---|---|
| 10 | `statsTracker.flush` | visibilitychange | 事件 | 统计落盘 | **是（必须跑）** | 保持 |
| 10 | `mainLoop`（DouyinEnhancer） | setInterval | 300ms | 跳广告/跳过直播/统计 | 否 | 暂不改 |
| 10 | `mainLoop`（LiveEnhancer） | setInterval | LOOP_INTERVAL_MS | 直播净化 | 否 | 暂不改 |
| 12 | `rateEnforcer` | setInterval | 900ms | 维持倍速 | 否（视频已暂停） | 暂不改 |
| 12 | `stallTimer` | setInterval | 900ms | 卡顿检测 | 否 | 暂不改 |
| 12 | `unlockTimer` → `runUnlock` | setInterval | 250ms | 解锁倍速/控件/登录遮罩 | 否 | 暂不改（内部已有配置守卫 + patch 幂等） |
| 12 | `pageThemeTimer` | setInterval | 未细查 | 主题变量兜底轮询 | 否 | 暂不改 |
| 13 | 2 个轮询 | setInterval | 未细查 | 智能信息流判定 | 否 | 暂不改 |
| 15 | 嗅探轮询 | setInterval | 未细查 | 捕获视频地址 | 否 | 暂不改 |
| 17 | MutationObserver | Observer | DOM 变化 + 220ms 去抖 | 隐藏导航 4 项 | **是**（否则恢复后闪一下未隐藏状态） | 保持 |
| 11 | `switchMaxResolution` 递归 | setTimeout | 已默认关闭 | — | — | 保持关闭 |
| 16 | 无 | 仅点击 | — | 下载面板 | — | 保持 |

**为什么不在本阶段改这些定时器**：改它们需要动 5 个脚本（10/12/13/15/17），每处都要加 `document.hidden` 判断，且必须验证"恢复后不重复注册、不漏跑关键补跑"。风险远高于收益，且违反"最小改动"。

---

## 5. 推荐架构：单文件协调器

新增 `19-idle-manager.js`（约 80 行，被 launcher 按文件名顺序自动加载）：

```js
(function () {
  'use strict';
  if (window.top !== window.self) return;
  var phase = 'active', lastHideAt = 0, snap = new WeakMap();

  function onHide() { ... §2.3 ... }
  function onShow() { ... §2.4 ... }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) onHide(); else onShow();
  });
  console.log('[DVD] idle-manager ready');
})();
```

职责边界：
- **只**处理 `<video>` 的暂停/恢复与 phase 幂等
- 不碰定时器、不碰 DOM 结构、不碰下载、不碰导航
- 停止方式：删文件即可（launcher 只加载 `userscripts/*.js`）

为什么不挂在现有脚本里：16 是下载 UI、17 是导航，职责不符；独立文件能一键删除回滚，且不影响其他脚本的更新。

---

## 6. 收益与风险

| 项 | 预计收益 | 级别 |
|---|---|---|
| 隐藏时暂停视频解码 | CPU/GPU 明显下降（解码停止），具体数值未测 | **合理推测** |
| 停 CSS 动画 | 抖音页面动画很少，收益小 | 合理推测 |
| 定时器降频 | 本阶段不做，收益为 0 | — |
| 恢复的开销 | 一次 `play()`，可忽略 | 静态审查 |

风险：
- `play()` 被自动播放策略拒绝 → 用户回到前台发现视频停着，需要手动点一次。**这是可接受的最坏情况**（比一直解码耗电好）
- 抖音自身可能在恢复时抢先 play → 已有 `if (!video.paused) continue` 防重复
- 直播恢复需重新缓冲，可能黑屏 1–2 秒 → 平台行为，不干预

---

## 7. 实施顺序与验收

**阶段 1（建议先做，改动 1 个新文件 + 0 处旧代码）**

1. 新增 `19-idle-manager.js`（仅 §2.3/§2.4 逻辑 + 日志）
2. 验收：
   - 正在播视频 → 最小化 → 视频暂停（日志 `paused=1`）
   - 恢复 → 继续播放，进度不跳
   - 用户手动暂停后最小化 → 恢复后仍暂停（日志 `paused=0`）
   - 连点最小化/恢复 5 次 → 无重复 play、无报错
   - 切 3 个视频后各测一次 → 不误伤
   - 直播页测一次
   - 下载进行中最小化 → 文件仍正常落盘（验证 §3.3 的判断）

**阶段 2（需要批准）**：给 12/10 的定时器加 hidden 检查（逐脚本、逐项验证）

**阶段 3（需要改 launcher）**：真实下载计数

---

## 8. 明确不建议改的

| 项 | 原因 |
|---|---|
| 17 的 MutationObserver | 隐藏期间抖音仍可能重建 DOM，停掉会导致恢复后导航项重新出现 |
| 10 的 `statsTracker.flush` | 必须在隐藏时执行，停了会丢统计 |
| 12 的 `relaxPlayerControls` | 负责隐藏登录遮罩，与"资源管理"无关，动它会复现登录弹窗 |
| 12 的 `unlockTimer` 降频 | 切视频后会出现倍速不生效，用户可感知 |
| 任何"停掉 GPU 加速"的想法 | 会让 CPU 暴涨，反向优化 |

## 9. 未验证

- 隐藏后 renderer/GPU 的实际下降幅度（需实现后测）
- 抖音在 `visibilitychange` 时自身是否会暂停（若平台已暂停，本设计收益变小——**这条最值得先测**）
- 直播页恢复的缓冲行为
- `19-idle-manager.js` 与 10 的 flush 是否相互干扰（预期不会，未实测）

> 附：验证"平台是否自己暂停"最快的方法是先只加一行日志的探针（不改行为），观察最小化时 `video.paused` 是否变化。如果平台已经暂停，整个任务的收益就要重估。
