# 轻量化审计（2026-11-25）

对象：Douyin Web Desktop 正式版（`%LOCALAPPDATA%\DouyinApp`，launcher 1.0.3 / userscript 16-save-video v3.3 / AKFace 已默认关闭）
方式：全程只读。采样数据来自 `temp\mem2.csv`、`temp\mem3.csv`（3 秒/点）。
本文合并了进程内存、网页资源、userscript、前后台设计、优先级五部分。

---

## 0. 结论先行

| 指标 | 实测值 | 判断 |
|---|---|---|
| renderer 合计 | **2845 MB WS / 2822 MB Priv（3 个进程）** | 内存绝对主体 |
| GPU | 497 MB WS / **826 MB Priv** | 第二大户，私有提交远超常驻 |
| node（launcher） | **189 MB WS / 199 MB Priv** | 对"启动器"来说偏重 |
| browser | 210 MB / 74 MB | 正常 |
| utility ×3 + crashpad | 108 MB | 正常 |
| **合计** | **约 3.85 GB** | — |
| 连续切换 15 个视频 | renderer +530 MB（约 35 MB/个），到顶后不降 | 媒体缓冲累积 |

**400 MB 目标不可达**，理由见 §6。不把它当承诺。

---

## 1. Chromium 进程架构（实测）

```
node             x1   WS=189MB  Priv=199MB     ← launcher.js 本体（含 playwright 模块）
browser          x1   WS=210MB  Priv= 74MB
crashpad-handler x1   WS= 11MB  Priv=  3MB
gpu-process      x1   WS=497MB  Priv=826MB
utility          x3   WS= 97MB  Priv= 39MB
renderer         x3   WS=2845MB Priv=2822MB    ← 主页面 + iframe（验证码/storage-bridge）
```

- 版本：Chrome **158.0.8127.37**（Playwright 以 `channel:'chrome'` 调用）
- 启动参数：`--app=data:text/html,...`、`--start-maximized`、`--no-first-run`、`--no-default-browser-check`、`--disable-extensions`、`--exclude-switches=enable-automation` + Playwright 默认集（含 `--disable-back-forward-cache`、`--disable-background-networking` 等）
- **没有** `--disable-gpu`、没有音频禁用参数（符合前次音频结论）

可削减性判断：

| 进程 | 可否削减 | 说明 |
|---|---|---|
| renderer ×3 | **不可减** | 主页面不可动；两个 iframe 来自抖音自身的验证码/存储桥，拦了可能影响登录与风控 |
| gpu-process | 不可减 | 关掉=软件渲染，CPU 暴涨，反而更慢（项目边界也禁止） |
| node 189MB | **可查** | launcher 常驻只是转发绑定，189MB 主要来自 playwright 模块与 V8 堆；可考虑启动后不持有大对象，但收益上限约 100MB |
| utility ×3 | 不可减 | 网络/存储/音频服务 |
| crashpad | 可减（可忽略） | 仅 11MB |

---

## 2. 网页资源（部分未测，如实标注）

| 项 | 数据 | 级别 |
|---|---|---|
| DOM 节点 | 基线 1993 → 稳定 2711 → 切换后 3800–3970 | 实测（CDP） |
| video 元素 | 1 → 3（切换后） | 实测 |
| JS Heap | 89–170 MB，有 GC 回落 | 实测 |
| 首屏资源数量/体积/耗时 | **未测**（无 DevTools Network 权限，app 窗口无地址栏） | 未验证 |
| 预加载策略 | 观察到切换后 video 由 1 变 3，疑似预加载下一条 | 推测 |
| 视频资源释放 | 切换后 renderer 只增不减，静置 2 分钟仅 -4% | 实测 |

结论：**JS 侧很轻（<200MB），2.8GB 全在原生侧**——媒体解码帧、VideoFrame 池、GPU 纹理映射。这部分网页层无法控制。

---

## 3. Userscript 审计（代码审查）

| 脚本 | 常驻定时器 | Observer | 监听器 | 频率与用途 | 风险 |
|---|---|---|---|---|---|
| 10-frequenk | 3（含 **两条 `mainLoop`**：3619 / 4366） | 0 | 57 | 300ms 主循环 ×2、跳过检测 | **高**：疑似重复注册两条 300ms 循环 |
| 12-douyinplus | 4 | 2 | 26 | 250ms `runUnlock`、900ms 倍速、900ms 卡顿检测、主题轮询 | **高**：250ms 常驻 |
| 13-smartfeed | 2 | 0 | 20 | 智能信息流轮询 | 中 |
| 11-akface | 1 | 0 | 4 | 已加开关，默认全关 | 低（已改） |
| 15-akface-download | 1 | 0 | 8 | 嗅探轮询 | 低 |
| 17-glass-nav | 0 | 1 | 1 | MutationObserver + 220ms 去抖 | 低 |
| 16-save-video | 0 | 0 | 1 | 仅点击 | 低 |
| 18 / 20 | 0 | 0 | 0 | 静态 | 无 |

**关键发现**：10-frequenk 里有两条不同位置的 `setInterval(() => this.mainLoop(), ...)`（3619 行 300ms、4366 行 `LOOP_INTERVAL_MS`），如果两个类实例都会被创建，就是**两倍的主循环开销**。需要二次确认（代码审查级，未运行时验证）。

12 的 250ms `runUnlock` 是全场最高频任务，且与播放/直播解锁强相关，**不能直接删**，只能降频或按页面条件启用。

---

## 4. 基线数据（原始采样）

**mem3.csv（8 分钟，刷 15 个视频 + 静置 2 分钟）**

```
17:20:17  wsR=3165 privR=3137 free=3105
17:20:33  wsR=1452 privR=1400 free=4780   ← 一次 -1.7GB 释放（页面重载）
17:21:19  wsR=1497 privR=1455            ← 新基线
17:22:06  wsR=2032 privR=1820            ← 峰值（+530MB）
17:23:27  wsR=1948 privR=1893            ← 静置 2 分钟，仅 -4%
```

**mem2.csv（4 分钟空闲）**：renderer 3047→3118 缓涨，WS≈Private，GPU Priv 871–1488 波动。

---

## 5. 前后台资源管理设计（可行性）

必须先区分四种状态，当前代码**一个都没处理**：

| 状态 | `document.visibilityState` | `blur` 事件 | 建议动作 |
|---|---|---|---|
| 窗口失焦（仍可见） | visible | 触发 | **不动**：还在播放，只是没焦点 |
| 窗口被遮挡 | visible | 可能触发 | **不动** |
| 窗口最小化 | **hidden** | 触发 | 暂停视频、停动画、定时器降频到 1/5 |
| 切换到其他虚拟桌面/锁屏 | hidden | 触发 | 同最小化，但保留登录态 |

实现要点（不改业务逻辑）：

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause + 降频/暂停 } else { 恢复 }
});
```

- 用 `visibilitychange`，**不要用 `blur`**（blur 在点地址栏/输入法时也触发，会误暂停）
- 恢复时**不重新注入脚本、不刷新页面、不发请求**，只恢复定时器频率与 `video.play()`
- 判断"是否在播放"用 `video.paused`，不要强行 play()（用户可能主动暂停过）

---

## 6. 为什么 400 MB 不可达

当前 renderer 2.8 GB，要压到 400 MB 需削减 86%。唯一的办法是**不加载抖音网页 / 不播视频**，那等于把产品废掉。可达到的现实区间：

- 空闲（视频暂停、页面最小化）：**1.5–2.0 GB**
- 正常刷：2.0–3.0 GB
- 长时间（50+ 视频）：3.0–4.0 GB，刷新回落

所以本文不承诺 400 MB，只承诺"不再无上限增长 + 最小化后明显下降"。

---

## 7. 优化优先级清单（本轮不执行）

### P0 — 明显浪费，风险低

| # | 问题 | 证据 | 预计收益 | 影响 | 位置 | 验证 | 需批准 |
|---|---|---|---|---|---|---|---|
| P0-1 | 10-frequenk 可能注册了**两条 300ms mainLoop** | 3619 / 4366 两处 `setInterval(mainLoop)` | CPU 周期性开销减半（估计 <5%） | 若两条确有不同用途，删错会掉功能 | 10-frequenk 3619/4366 | 加计数日志确认执行次数 | 是 |
| P0-2 | 12 的 `runUnlock` 250ms 常驻，但只在直播/倍速场景有意义 | 1570 行 | 空闲 CPU 显著下降 | 直播解锁可能变慢 | 12-douyinplus 1570 | 改前后对比 idle CPU | 是 |

### P1 — 高收益低风险

| # | 项 | 收益 | 风险 |
|---|---|---|---|
| P1-1 | 最小化时暂停视频 + 定时器降频（visibilitychange） | 最小化内存/CPU 明显下降（预估 renderer -300~800MB，随视频而定） | 中：需要正确恢复，不能误暂停 |
| P1-2 | node 侧减少常驻对象（mediaLog、request 监听保留但限长） | launcher 189MB → 估计 120–150MB | 低 |
| P1-3 | 空闲 30 分钟自动 reload（可配置、默认关） | 回收 1–2GB | 中：会打断操作，必须"仅在无下载、无播放、页面可见"时触发 |

### P2 — 需较多测试

| # | 项 | 说明 |
|---|---|---|
| P2-1 | 减少预加载 video 数量（1→3 的问题） | 属于抖音播放器行为，只能通过 DOM 干预，风险高 |
| P2-2 | GPU 私有提交 826MB 的成因（显存池/纹理缓存） | 需 `chrome://gpu` + 显存采样，本轮未测 |

### P3 — 高风险/收益不明

- 换 `channel:'chromium'` 内置浏览器（版本配对、行为差异未知）
- 关闭 GPU 加速（项目明确禁止，且会让 CPU 暴涨）
- 拦截平台请求（会破坏登录与风控）

---

## 8. 未验证清单

- 首屏资源数量/体积/耗时（无 Network 面板）
- CPU 占用率、GPU 利用率、启动耗时
- 10 的两条 mainLoop 是否真的都在跑（需运行时计数）
- 最小化后的实际下降幅度（需实现 P1-1 才能测）
- 50+ 视频的长期曲线

## 9. 下一阶段建议

先做 P0-1（加计数确认是否重复）与 P0-2（250ms 降频），这两项改动小、可独立回滚、不影响下载与识别。确认收益后再做 P1-1 的 visibilitychange 方案。
