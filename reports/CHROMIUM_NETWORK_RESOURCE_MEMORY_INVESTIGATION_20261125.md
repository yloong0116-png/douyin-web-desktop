# Chromium Network Resources 内存累积调查（2026-11-25）

结论：**高度疑似，但缺少对象级证据。**

---

## 1. 已确认事实（实测 / 代码审查）

| 项 | 值 | 来源 |
|---|---|---|
| Playwright | **1.65.0** | `require(...).version` |
| Chromium | **158.0.8127.37**（系统 Chrome） | exe 版本信息 |
| 启动方式 | `launchPersistentContext` + `--remote-debugging-pipe` | 进程命令行 |
| 网络相关启动参数 | 仅 `--disable-background-networking`、若干 `--disable-features`（含 `NetworkTimeServiceQuerying`），**无代理、无 CDP 端口** | 命令行 |
| launcher.js 中的 CDP 用法 | **0 处**（无 `newCDPSession`、无 `page.route`） | grep |
| launcher.js 中的 request/response 监听 | **0 处**（原 `ctx.on('request')` 已于本轮删除） | grep |
| 参考 Issue 页面 | 存在，标题为 **"Chromium: DevTools network records grow without bound on a page that never navigates its main frame"** | HTTP 200 + 页面 title |
| Issue API 详情 | **403 限流**，未取到正文/状态/修复版本 | GitHub API |

**关键认知**：删掉应用层的 `ctx.on('request')` **不等于关闭 Network 域**。Playwright 为了让 `request`/`response` 事件与 `route` 能力可用，会在内部对每个 page 启用 CDP `Network.enable`——这是框架级行为，应用代码无法通过删监听器关掉。所以我上一轮删死代码降低的是**回调开销**（-21% 常驻、-32% CPU），与 NetworkResourcesData 是否累积是两件事。

## 2. 尚未证实的推断

参考 Issue 标题给的条件是「**主 frame 永不导航**」。我们的场景完全吻合：

- 抖音是 SPA，切换视频只做 history/pushState，主 frame 不导航
- 一次会话跑数小时 → 请求量几十万级
- 症状吻合：JS Heap 仅 230–280 MB，但 renderer Private 达 4.8 GB
- 刷新（主 frame 真正导航）后 renderer 从 4.4 GB 回落到 1.9 GB（此前实测）

这四条**指向**同一机制，但没有一条能证明「那些内存就是 `blink::NetworkResourcesData::ResourceData`」。

## 3. 对象级内存证据

**没有拿到。** 原因：

- 正式实例由 Playwright 以 pipe 方式驱动，无 TCP 端口，外部无法接 CDP
- 无法取 renderer 的原生堆快照（需要 DevTools 打开时的 `HeapProfiler`，且 Chromium 的原生堆需要 `chrome://inspect` 的 native snapshot，非 JS heap snapshot）
- 已知唯一可行的替代是 DevTools 的 Media 面板（上一轮验证过能力存在），但那是媒体管线，不是网络记录

**因此不能把 JS Heap 数值当作原生堆证据**，也不能声称"已确认是同一问题"。

## 4. 与参考案例的差异

| 维度 | 参考 Issue | 本项目 |
|---|---|---|
| 触发条件 | 页面主 frame 不导航 | 相同（SPA） |
| 版本 | 未取到（API 限流） | Playwright 1.65.0 / Chrome 158 |
| 是否已修复 | 未取到 | 未知 |
| 复现证据 | 关闭 Network 域后内存下降 | **未做该对照** |

差异点主要在「是否已在本版本修复」和「关闭 Network 域是否真能让内存下降」——两项都缺证据。

## 5. 可行方案与副作用（本轮不执行）

| 方案 | 可行性 | 副作用 | 风险 |
|---|---|---|---|
| **A. 定期重新导航主 frame**（等同刷新，或用 `page.goto` 同一 URL） | 高，已验证能回收 1.5–2.5 GB | 页面状态丢失、视频重载、下载面板需重开 | 低（但打断使用） |
| **B. 对 page 的 CDP session 发 `Network.disable`** | 待验证 | Playwright 的 `request`/`response` 事件、`page.route`、`waitForRequest` 全部失效；Playwright 可能因内部假设而报错 | **高**，可能破坏框架行为 |
| **C. 升级 Playwright** | 未知 | 需重新验证便携包兼容 | 中（且不确定是否有修复） |
| **D. 缩短单次会话时长**（用 2–3 小时重启一次） | 高 | 无 | 无 |

现在应用层已经不用 `request` 事件了（下载走 `__dySave` + parse API，与此无关），所以 B 的**功能影响**理论上比之前小——但「Playwright 内部是否强依赖 Network 域」必须实测，不能假设。

## 6. 下一步最小验证实验（不改正式实例）

在 **profile 副本 + 独立实例** 上做 A/B，30 分钟：

1. 组 A：默认启动，注入全部 userscript，循环切换视频/滚动，每 5 秒采 renderer Private
2. 组 B：同样操作，但在 page 的 CDP session 上发 `Network.disable`（若 Playwright 报错则记录并终止该组）
3. 对比两条曲线的斜率
4. 判定：
   - B 明显更平 → **确认为同一问题**（NetworkResourcesData）
   - 两组一致 → **不符合该问题特征**，回到媒体缓冲假设
   - B 无法运行（Playwright 崩溃） → **当前技术条件无法判断**，只能采用方案 A/D

这个实验不需要动正式实例、不需要改启动参数，只用一个临时脚本。

## 7. 未完成

1. Issue 正文与修复状态（API 403）
2. 对象级证据（无 CDP 接入）
3. A/B 对照实验（需用户批准运行一个独立实例，约 30 分钟）
4. 正式实例当前的真实 renderer 数值（本轮未重测，沿用此前 4.8 GB）
