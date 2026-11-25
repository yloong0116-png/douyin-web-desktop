# Chromium 进程与内存报告（只读审计）

- 日期：2026-11-25
- 审计类型：只读。未修改 launcher.js、userscripts、Profile、启动参数、缓存。
- 采样对象：用户当前正在运行的正式实例（登录态）
- 证据等级标注：**[实测]** = 本次真实采样；**[代码]** = 静态代码审查；**[推测]** = 未验证推断

---

## 1. 正式运行实例识别 [实测]

| 项 | 值 |
|---|---|
| 运行目录 | `%LOCALAPPDATA%\AppData\Local\DouyinApp` |
| 启动链 | `node.exe launcher.js` → `chrome.exe` → renderer/utility/gpu |
| node 主进程 PID | 27984（`%LOCALAPPDATA%\AppData\Local\Programs\nodejs\node.exe ...\DouyinApp\launcher.js`） |
| browser 主进程 PID | 22860 |
| Chrome 可执行文件 | `C:\Program Files\Google\Chrome\Application\chrome.exe`（channel: chrome，非 Playwright 自带 chromium） |
| Profile | `%LOCALAPPDATA%\AppData\Local\DouyinApp\profile`（925 MB） |
| 调试通道 | `--remote-debugging-pipe`（**无 TCP 端口，外部无法 attach**） |
| 启动时间 | 2026-11-25 17:18:09 |

**这条事实决定了两件事**：① 本阶段无法用 CDP 从外部读取 JS Heap / DOM 节点 / 资源瀑布（pipe 不是端口）；② 所有页面级指标只能来自此前的隔离副本实验，或需要用户批准后另起带 `--remote-debugging-port` 的独立实例。

---

## 2. 进程清单与内存 [实测，2026-11-25 17:30]

| PID | 类型 | Working Set (MB) | Private Bytes (MB) | CPU 累计 (s) |
|---|---|---|---|---|
| 23140 | renderer（主页面） | 2339.6 | 2360.2 | 265.3 |
| 13488 | renderer/utility | 497.6 | 794.8 | 84.5 |
| 27984 | node（launcher.js） | 186.6 | 196.6 | 14.2 |
| 22860 | browser（主进程） | 209.3 | 73.7 | 39.4 |
| 22292 | gpu-process | 82.6 | 38.1 | 1.1 |
| 25632 | utility | 53.0 | 20.7 | 18.4 |
| 20356 | gpu/utility | 32.4 | 17.0 | 0 |
| 16032 | utility | 20.3 | 9.4 | 0.3 |
| 11736 | utility | 23.7 | 8.8 | 3.7 |
| 19768 | utility | 10.9 | 2.5 | 0 |
| **合计（10 进程）** | | **3456.2** | **3521.7** | |

- 进程数：10（browser 1 + renderer 2 + gpu 2 + utility 5 + node 1）
- **单一 renderer 占 Private Bytes 的 67%**（2360 / 3522 MB）
- Working Set 会重复计算共享内存，Private Bytes 才是「独占」口径。本文所有结论以 Private Bytes 为准，WS 仅作参考。

### 2.1 与历史采样对照（同一实例，不同时间）

| 时间 | renderer | gpu | 可用内存 | 来源 |
|---|---|---|---|---|
| 17:02:42 | 3456 MB (WS) | 593 | 4502 | 前次报告 |
| 17:06:14 | 4421 MB (WS) | 636 | 3366 | 前次报告 |
| 17:30 本轮 | 2360 MB (Priv) | 38 | 见基线报告 | 本轮 |

**结论**：renderer 在 2.3–4.4 GB 之间大幅波动，回落点存在（-379 MB、-500 MB 级）。这说明它主要是**媒体解码缓冲 + 页面结构 + code cache**在涨落，而不是单调泄漏。

---

## 3. 启动参数审计 [实测，来自 PID 22860 的完整命令行]

### 3.1 Playwright 默认注入、但对「轻量 + 最小化降耗」是负收益的参数

| 参数 | 作用 | 与本项目目标的关系 |
|---|---|---|
| `--disable-background-timer-throttling` | 后台标签/最小化窗口的定时器**不降频** | ❌ 直接对抗目标 5「最小化降低消耗」。最小化后 11 个用户脚本的全部间隔定时器仍全速运行 |
| `--disable-backgrounding-occluded-windows` | 被遮挡窗口不做后台降级 | ❌ 窗口被其他应用盖住时不降级 |
| `--disable-renderer-backgrounding` | renderer 进程不降优先级/不降 CPU 配额 | ❌ 最小化后 renderer 仍按前台优先级占 CPU |
| `--disable-background-networking` | 关闭 Chromium 自身后台网络（更新、组件、指标上传） | ✅ 对轻量有利，建议保留 |
| `--disable-ipc-flooding-protection` | 关闭 IPC 洪泛保护 | ⚠️ 仅对高频 IPC 有影响，可保留 |
| `--enable-unsafe-swiftshader` | 允许软件光栅化后备 | ⚠️ 在 GPU 被禁用/失败时会把光栅工作压到 CPU。当前有独立 gpu-process，属兜底 |
| `--disable-hang-monitor` | 关闭无响应检测 | ⚠️ 会让页面卡死时窗口「假活」，不建议常开 |
| `--disable-features=...,PaintHolding,...` | 关闭绘制保持等特性 | ✅ 与轻量方向一致（减少等待绘制） |
| `--app=data:text/html,...` | 应用模式外壳 | 中性（避免标签栏 UI） |

### 3.2 launcher 自己追加的参数

```
--start-maximized  --no-first-run  --no-default-browser-check
--disable-extensions  --exclude-switches=enable-automation
```

- `--disable-extensions`：✅ 无扩展开销，符合轻量目标。
- 缺少的、值得评估的参数（**未采用，仅列入方案**）：`--disk-cache-size`、`--media-cache-size`、`--renderer-process-limit`、`--disable-gpu-shader-disk-cache`、`--js-flags="--max-old-space-size"`。
- **注意**：本项目边界禁止关闭硬件加速，因此**不评估** `--disable-gpu`。

---

## 4. 进程结构判断

### 4.1 必要的进程

| 进程 | 是否必要 | 理由 |
|---|---|---|
| browser (22860) | 必须 | 进程模型根 |
| renderer 主页面 (23140) | 必须 | 抖音页面本体 |
| renderer 第二 (13488) | **待确认** | 可能是 iframe 的 OOPIF（跨站 iframe 独立进程）或直播/播放器隔离进程。**需批准后开 CDP 才能确认它承载哪个 frame** |
| gpu-process (22292) | 必须 | 硬件加速解码/合成 |
| node (27984) | 必须 | launcher.js 是父进程；Playwright 需要它存活 |
| utility ×5 | 大部分必要 | network service、storage service、audio service、data decoder 等，Chromium 现代进程模型固定分配，**不建议强行削减** |

### 4.2 可减少的部分（不是「杀进程」，而是「不减慢降级」）

Chromium 在**允许后台降级**时，会把最小化窗口的 renderer 降到低优先级、把定时器限到 1 次/秒、暂停 raster。当前三个 `--disable-*` 参数把这套机制全关了。**这是本项目最大的单项结构性浪费**，且修复方式是「删参数」而不是「加代码」。

---

## 5. 缓存体积（与内存、启动时间直接相关）[实测]

`%LOCALAPPDATA%\AppData\Local\DouyinApp\profile` 共 **925 MB**：

| 子目录 | 体积 |
|---|---|
| `Default/Cache` | 410 MB |
| `Default/Code Cache` | 314 MB |
| `component_crx_cache` | 40 MB |
| `optimization_guide_model_store` | 41 MB |
| `WasmTtsEngine` | 25 MB |
| `Safe Browsing` | 19 MB |
| `GrShaderCache` | 13 MB |
| `GPUPersistentCache` | 6 MB |

- **Code Cache 314 MB** 是 V8 编译产物缓存：启动时会被 mmap 并按需载入 renderer 地址空间，是「首屏慢 + renderer 基线高」的隐性来源之一。
- `optimization_guide_model_store` 41 MB 与 `WasmTtsEngine` 25 MB 是抖音页面**不会用到**的 Chrome 组件模型（优化提示、TTS 引擎），属于可安全清理的纯浪费。
- 这些目录**本阶段未清理**（只读审计），清理动作列入 P1 并需要批准。

---

## 6. launcher 侧的进程级开销 [代码]

| 位置 | 行为 | 评价 |
|---|---|---|
| `log()`（第 16 行） | `fs.appendFileSync` **同步**写日志，每条 console error / DouyinSave 一次 | ⚠️ 同步 IO 阻塞 node 事件循环；`launcher.log` 已 830 KB / 8240 行，**无轮转** |
| `ctx.on('request')` | 每个 http(s) 请求都过一遍正则（4 个 RegExp） | ⚠️ 页面首屏数百请求 × 每请求 4 次正则 + 数组操作，可接受但不必要常开 |
| `watch(pg).on('console')` | 每个 console 消息都判前缀；error 上限 40 条 | ✅ 有上限，合理 |
| `setInterval(() => {}, 1 << 30)` | 保活事件循环 | ⚠️ 会让进程在 `disconnected` 之外无法自然退出；建议改为引用句柄（不影响功能） |
| node 常驻 196 MB | Playwright 模块 + 页面对象图 | ⚠️ 高于纯脚本包装器的预期。`DY_PLAYWRIGHT` 环境变量允许指向外部 playwright，若指向完整包则体积更大 |

---

## 7. 与 400 MB 目标的关系（必须明说的结论）

**400 MB 不是本架构可达的数字。**

- 当前单 renderer 的 Private Bytes = 2360 MB。
- 即使把全部 11 个用户脚本删掉、把 Chromium 全部后台降级打开，抖音自身的 React 页面 + 视频解码器 + 广告 SDK 在 1080p 播放下的原生内存典型在 500 MB–1.2 GB。
- 本机 GPU 进程仅 38 MB，说明**显存占用不在进程 Private Bytes 里**，把 GPU 算进「400 MB」没有意义。

因此项目把它按「探索性目标」处理是正确的。可交付的现实目标是：
1. **最小化态**把 renderer 的实际 CPU 与定时器开销降到接近 0（结构可实现）；
2. **长期运行**把 renderer 的 Private Bytes 基线从 2.3–4.4 GB 压到 1.2–1.8 GB 量级（需实测验证）；
3. **冷启动**从「到可交互」压缩 20–40%（需基线数据支撑）。

---

## 8. 未验证项（不得当成结论）

1. PID 13488 承载哪个 frame —— 需 CDP。
2. renderer 2.3 GB 中「视频解码 / DOM / code cache / JS 堆」各占多少 —— 需 CDP `Performance.getMetrics` + 进程级对照。
3. GPU 显存实际占用 —— 需 `chrome://gpu` 或厂商工具，本轮未采。
4. 最小化后 CPU 是否真的不降 —— 有参数级强证据，但**未做最小化前后 CPU 对照实测**。
5. Code Cache 314 MB 对首屏的实际贡献 —— 需清理前后对照。
