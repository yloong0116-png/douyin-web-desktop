# 轻量化三个专项调查（2026-11-25）

只读调查，未修改任何文件。三项分开记录，各自给结论与是否值得做。

---

## 任务 1：10-frequenk 的两条 `mainLoop` 是否真实并存

### 结论：**不是重复注册，但存在"旧实例不销毁"的并存路径**（修正我上一轮的说法）

上一轮我说"疑似同类重复注册两条 300ms 循环"——**这个判断错了**，实际结构是：

| 位置 | 所属类 | 循环间隔 | 创建条件 |
|---|---|---|---|
| 3619 行 | `DouyinEnhancer` | 300 ms | 非直播页、非排除页，且 `!douyinEnhancer` |
| 4366 行 | `LiveEnhancer` | `LOOP_INTERVAL_MS` | 仅直播页，且 `!liveEnhancer` |

创建逻辑（`ensureEnhancerForCurrentRoute`，4770–4786）：

```js
if (isDouyinLivePage(url)) { if (!liveEnhancer) liveEnhancer = new LiveEnhancer(); return; }
if (!isExcludedPage(url) && !douyinEnhancer) douyinEnhancer = new DouyinEnhancer();
```

- **两个类不会同时被创建**（直播页 return，普通页只建另一个）✓
- **但旧实例永不销毁**：从普通页切到直播页后，`douyinEnhancer` 与它的 300ms 循环仍在跑 ✗

### 实际成本

两条 `mainLoop` 开头都有页面判断并提前 return：

- `DouyinEnhancer.mainLoop` → `shouldSkipCurrentPage()`（命中直播/视频页就返回）
- `LiveEnhancer.mainLoop` → `isSupportedLivePage()`（非直播页就返回）

所以并存时是**每 300ms 两次极轻量的字符串判断**，量级远低于 1% CPU。**不是 P0，也不建议为此改代码**——真要处理，正确做法是给两个类加 `dispose()`（清定时器 + 移除监听），而不是降频。

### 需要的运行时验证（本轮未做）

切到直播页后，用 `setInterval` 计数（只读探针）确认两条是否同时在跑。当前证据只到"代码路径允许并存"。

---

## 任务 2：12-douyinplus 的 `runUnlock` 能否按状态启停

### 它实际做什么（5348 行起）

```js
runUnlock() {
  this.unlockNativePlayerSpeed();   // ① 恢复原生倍速能力
  this.relaxPlayerControls();       // ② 放宽播放器控件限制
  if (!this.config.enableUnlock) {  // ③ 配置关闭时：清理登录态遮罩并 return
    ...清理 .${APP_ID}-hidden-login、manualLoginMode...
    return;
  }
  if (this.state.manualLoginMode) return;  // ④ 用户手动登录时不干预
  ...
}
```

- 250ms 定时器在 `bootstrap()` 里创建，**只创建一次**（`_runtimeBootstrapped` 守卫）✓
- ③ 有配置守卫，但 **①② 在守卫之前执行** → 即使用户关掉「解锁」，这两个方法仍每 250ms 跑一次，这是可优化点
- 高频的理由：抖音切视频会重建播放器，倍速/控件要在重建后尽快恢复，间隔太大会出现"切了视频倍速没了"

### 能否按状态启停：**可以，三条低风险路径**

| 方案 | 做法 | 收益 | 风险 |
|---|---|---|---|
| A. 配置关闭时彻底跳过 | 把 ①② 移到 `if (!config.enableUnlock)` 之后 | 关掉解锁的用户直接省掉全部 250ms 工作 | 极低（关掉就该不做） |
| B. 无播放器时提前返回 | `if (!getRuntimePlayer() && !document.querySelector('video')) return;` | 空闲/非视频页零成本 | 低（需确认切视频瞬间不会漏掉解锁） |
| C. 页面隐藏时暂停 | `if (document.hidden) return;` 恢复时立刻补跑一次 | 最小化后零成本 | 低（恢复时补跑一次即可） |

**不建议**单纯把 250ms 改成 1000ms：切视频后最长 1 秒倍速不生效，用户会感知。要降频必须先做 B（只在必要时跑），频率才有意义。

---

## 任务 3：前后台资源管理设计

### 核心原则

**只处理"最小化/隐藏"，不处理"失焦/被遮挡"**——后者仍在前台播放，暂停会误伤。

| 状态 | `visibilityState` | 是否处理 | 动作 |
|---|---|---|---|
| 窗口有焦点 | visible | 不处理 | 正常 |
| 输入框聚焦/点地址栏（失焦） | visible | **不处理** | 正常（不能用 blur 判断） |
| 被其他窗口遮挡 | visible | **不处理** | 正常播放 |
| 最小化 | **hidden** | 处理 | 暂停视频、停 CSS 动画、定时器降频 |
| 锁屏/切虚拟桌面 | hidden | 处理 | 同上，保留登录态 |

### 设计

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!video.paused) { wasPlaying = true; video.pause(); }   // 只暂停本来在播的
    setAnimations(false);                                       // 给 <html> 加 class，CSS 停动画
    slowDownTimers(5);                                          // 12/10/13 的轮询间隔 ×5
  } else {
    setAnimations(true);
    restoreTimers();
    if (wasPlaying) { video.play().catch(() => {}); wasPlaying = false; }  // 不强制
  }
});
```

### 明确不做的事

- 不刷新页面、不重新注入脚本、不重跑 init（避免"恢复时闪一下"）
- 不主动退出登录、不清缓存
- 不阻塞下载任务：判断 `if (下载中) 不暂停`
- 不在恢复时发额外请求

### 预期收益（**推测，未实测**）

最小化后 renderer 可能下降 300–800 MB（取决于当前视频），CPU 接近 0。必须实现后才能测，不能先写进结论。

---

## 三个任务的建议优先级

| 任务 | 结论 | 建议 |
|---|---|---|
| 1. 双 mainLoop | 不是重复注册，成本 <1%，存在旧实例不销毁 | **暂不做**。若要做就加 `dispose()`，别降频 |
| 2. runUnlock 启停 | 可按状态启停，三条低风险路径（A/B/C） | **先做 A**（配置关闭就跳过），再评估 B |
| 3. 前后台管理 | 方案清晰，只处理 hidden | **最值得做**，但要一次做对（错误的恢复逻辑比不做更烦） |

## 未验证

- 两条 mainLoop 是否真并存（需运行时计数）
- 最小化后的实际下降幅度（需实现后测）
- 抖音切视频时 `video.play()` 的自动恢复行为（若平台自己会恢复，我们的 play() 可能冲突）

## 修正记录

上一轮审计把 10 的两条 `mainLoop` 记为「疑似重复注册、P0」，**此处更正为「两个不同类的循环，互斥创建但旧实例不销毁，成本 <1%，不构成 P0」**。
