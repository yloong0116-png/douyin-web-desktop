# 优化优先级清单（P0–P3，方案，未实施）

- 日期：2026-11-25
- 每项包含：问题与证据 / 目标指标 / 功能影响 / 修改位置 / 回滚 / 验证 / 是否需批准
- 排序原则：**小改动、可独立回滚、先修错误行为再谈性能**

---

## 总览

| 级别 | 项数 | 性质 | 预计收益（保守表述） |
|---|---|---|---|
| **P0** | 5 | 明显的资源浪费或错误行为 | 结构性，不承诺 MB 数 |
| **P1** | 6 | 高收益、低风险 | 启动时间与常驻 CPU 为主 |
| **P2** | 4 | 需较多测试的网页/Chromium 优化 | 内存基线 |
| **P3** | 3 | 高风险或收益不确定 | 待实验 |

---

# P0 — 错误行为，先修

## P0-1　三份代码版本不一致（运行环境 ≠ 仓库 ≠ 便携包）

**问题**：用户实际运行的是 `%LOCALAPPDATA%\AppData\Local\DouyinApp`（11 个脚本，含 `12-douyinplus` 218 KB、`13-smartfeed` 165 KB）。项目仓库 `<项目根>` 和便携包 zip 只有 **8 个脚本，缺 12 与 13**。

**证据** [实测]：
- 运行目录 `userscripts/` 列出 11 个 `.js` + 5 个 `.bak` + 1 个 `.disabled`
- `launcher.log` 的 `init: nav + early[00-gm-shim,00-vue,10-frequenk,11-akface,12-douyinplus,15-akface] late[13-smartfeed,16,17,18,20]`
- zip 内容清单仅有 8 个 `.js`，无 12/13

**影响**：**在仓库里做的任何优化都不会作用到用户真实环境**；反向也一样，用户在跑的增强版无法被版本控制和回滚。这是本项目当前最大的流程性风险，比任何内存优化都优先。

**目标指标**：版本一致性 = 100%（运行目录 / 仓库 / 便携包三方 SHA256 对比表）

**修改位置**：`<项目根>\app\userscripts\`（补齐 12/13）；便携包重新打包；`manifests/FILES_SHA256.txt` 更新

**回滚**：新增文件，删除即回滚；不改动运行目录任何文件

**验证**：三方 `sha256sum` 对照；`launcher.log` 的 `init:` 行与仓库清单一致

**需批准**：✅ 需要（涉及往仓库新增 383 KB 第三方脚本 + 重打包）

---

## P0-2　Playwright 默认参数关闭了全部后台降级

**问题**：browser 主进程命令行含 `--disable-background-timer-throttling`、`--disable-backgrounding-occluded-windows`、`--disable-renderer-backgrounding`。最小化后：定时器不降频、renderer 不降优先级、窗口不做后台降级。

**证据** [实测]：PID 22860 完整命令行；`launcher.js:63` 只 ignore 了 `--no-sandbox` / `--enable-automation`。

**影响**：直接对抗「最小化降低资源消耗」这一核心目标。也是「最小化后风扇仍转、CPU 仍占」的可解释原因（**推测**，未做最小化 CPU 对照）。

**目标指标**：最小化 2 min 内 renderer CPU 增量 < 0.5 s/min（当前未测，作为改造后判据）

**修改位置**：`app/launcher/launcher.js:63`（`ignoreDefaultArgs` 数组）

**回滚**：恢复原数组，一行

**验证**：见 `BACKGROUND_RESOURCE_DESIGN_20261125.md` 第 4 节第 0 层；必须同时验证「失焦但可见」时画面不掉帧

**需批准**：✅ 需要（改启动参数 = 改运行行为）

---

## P0-3　`16-save-video.js` 重复挂载（同秒 5 次）

**问题**：`[DouyinSave] v3.3 button mounted` 在 484 ms 内出现 5 次，每次新建按钮 + 13 个监听器。

**证据** [日志]：`launcher.log` 2026-11-25T09:28:39.474Z–.958Z

**影响**：重复 DOM 节点、重复监听器、可能的闭包泄漏；是「节点数基线偏高」的直接来源之一。

**目标指标**：单文档挂载次数 = 1（可用日志断言）

**修改位置**：`16-save-video.js` 的挂载入口加幂等锁 `if (window.__dySaveMounted) return; window.__dySaveMounted = 1;`；并在脚本顶部加 top-frame 守卫

**回滚**：删除两行守卫

**验证**：重启后 `grep -c "button mounted" launcher.log` 单次会话应 = 1

**需批准**：✅ 需要（改运行中的脚本）

---

## P0-4　5 个脚本无 top-frame 守卫，iframe 内重复执行

**问题**：`addInitScript` 对每个 frame 生效；`00-gm-shim`、`10-frequenk`(230 KB)、`13-smartfeed`(165 KB)、`15-akface-download`、`16-save-video` 无 `window.top !== window.self` 守卫 → 每个子 iframe 重复解析执行约 445 KB 并各自启定时器。

**证据** [代码]：逐文件 grep `topguard=0`

**影响**：多 iframe 页面上成倍的 JS 解析与定时器；**iframe 实际数量未实测**（需 CDP），属未定量。

**目标指标**：非顶层 frame 的脚本执行次数 = 0

**修改位置**：5 个脚本首行各加一行守卫（`if (window.top !== window.self) return;` 需包在 IIFE 内）

**回滚**：删守卫

**验证**：CDP 列出所有 frame，检查各 frame 的 `window.__DYLC` / 脚本标志位

**需批准**：✅ 需要

---

## P0-5　launcher 日志同步写、无轮转

**问题**：`log()` 用 `fs.appendFileSync`；`launcher.log` 已 830 KB / 8240 行且持续增长；每条 console error 与 `[DouyinSave]` 都同步落盘。

**证据** [代码]+[实测]：`launcher.js:16`；日志文件大小

**影响**：node 事件循环被磁盘 IO 阻塞（虽然每次很小，但在日志风暴时会累积）；无限增长。

**目标指标**：日志写入改为异步 + 单文件上限 2 MB 轮转

**修改位置**：`app/launcher/launcher.js:16`

**回滚**：恢复 `appendFileSync` 版本

**验证**：日志行数不再无限增长；`[nav]` 时间戳间隔无异常

**需批准**：✅ 需要

---

# P1 — 高收益、低风险

## P1-1　清理 380 MB 无用 Chrome 组件与 code cache

**问题**：`profile` 内 `optimization_guide_model_store` 41 MB、`WasmTtsEngine` 25 MB 是抖音页面不依赖的 Chrome 组件模型；`Default/Code Cache` 314 MB。
**证据** [实测]：目录体积。
**目标指标**：profile 体积 −380 MB；冷启动到可交互时间（待基线）
**影响**：**组件模型删除后 Chrome 可能自动重新下载**（若 `--disable-component-update` 未生效）；code cache 删除后首次启动变慢、之后恢复
**位置**：`%LOCALAPPDATA%\AppData\Local\DouyinApp\profile\...`（在实例**关闭**时操作）
**回滚**：无需（Chrome 自建）；建议先整目录复制一份到临时目录再删
**验证**：启动正常、登录态保留、连续播放正常；对比启动耗时
**需批准**：✅ 需要（动 Profile 目录，虽不动登录数据）

## P1-2　常驻定时器 hidden 时跳过（7 个）

**问题**：7 个常驻定时器合计约 12 次/秒回调，最小化后不降频。
**证据** [代码]：见 Userscript 审计第 2 节
**目标指标**：hidden 期间回调次数 ≈ 0
**影响**：直播解锁（250 ms）若在 hidden 期间跳过，理论上不影响观看（窗口不可见）
**位置**：`12-douyinplus:1554/1555/1570/3918`、`10-frequenk:3619/4366`、`15-akface-download:276`
**回滚**：每处 `LC_ENABLED` 常量置 false
**验证**：A/B 30 min 内存与 CPU 对照
**需批准**：✅ 需要

## P1-3　新增 `05-lifecycle.js` 状态总线

**问题**：无任何 visibility/focus 感知。
**证据** [代码]：0 处命中
**目标指标**：三态（active/blurred/hidden）判定准确
**影响**：纯新增文件，不改现有脚本
**位置**：`app/userscripts/05-lifecycle.js`
**回滚**：删除文件
**验证**：Console 观察状态切换
**需批准**：✅ 需要（新增注入文件）

## P1-4　nav.js 的全局 capture `mousemove`

**问题**：每次鼠标移动都执行坐标判断，命中时写 `style.opacity`（触发样式重算）。
**证据** [代码]：`app/launcher/nav.js` 第 32–42 行
**目标指标**：mousemove 回调内 **0 次** 样式写入（只在状态真正变化时写）
**影响**：返回按钮显示逻辑不变
**位置**：`app/launcher/nav.js`
**回滚**：单文件还原
**验证**：DevTools Performance 录制 10 s 鼠标移动，检查无 Forced reflow
**需批准**：✅ 需要

## P1-5　`15-akface-download` 的 2 s 全量扫描降频 / 评估停用

**问题**：`scanPerformance()` 每 2 s 对全部 resource entries 做 `forEach` + `detect`。虽有 `seenUrls` 去重（成本被大幅削弱），但遍历本身是 O(n)。
**证据** [代码]：`15-akface-download:276,339-343`
**目标指标**：改为 `PerformanceObserver` 增量收集（0 轮询）
**影响**：需确认它与 `16-save-video` + `launcher.__dySave` 的功能重叠范围
**位置**：`15-akface-download.user.js`
**回滚**：单文件还原
**验证**：下载功能回归（视频/图集/音乐/封面）
**需批准**：✅ 需要（先做功能重叠评估）

## P1-6　node 侧 196 MB 与保活 hack

**问题**：node 常驻 Private 196 MB；`setInterval(()=>{},1<<30)` 强制保活。
**证据** [实测]+[代码]
**目标指标**：node 峰值 < 120 MB（需先确认 `DY_PLAYWRIGHT` 指向什么包）
**影响**：可能涉及替换为 `playwright-core`
**位置**：`launcher.js` 顶部 require + 末行
**回滚**：还原 require
**验证**：启动/下载/返回全回归
**需批准**：✅ 需要

---

# P2 — 需较多测试

## P2-1　最小化时暂停视频
`visibilitychange → video.pause()`。恢复**不**自动播放。交互方式需用户决定（提示 / 静默等待点击）。

## P2-2　延迟注入非关键脚本
`13-smartfeed`、`20-layout-lab` 改为首帧后注入。风险：首帧前依赖它们的逻辑（布局实验）会滞后。

## P2-3　`--media-cache-size` / `--disk-cache-size` 调优
限制磁盘缓存上限，减少 code cache 与媒体缓存膨胀。需实测对二次加载的影响。

## P2-4　`--js-flags="--max-old-space-size=…"` 限制 V8 堆
对 renderer 生效可压峰值，但可能引发更频繁 GC → 卡顿。需 A/B。

---

# P3 — 高风险 / 收益不确定

## P3-1　hidden 时 `video.src=''` 真正释放解码器
可能触发播放器错误重拉、黑屏。必须独立开关 + 可即时回滚。

## P3-2　`--renderer-process-limit` / 合并 renderer
抖音是多站点组合（douyin.com / live.douyin.com / 字节 CDN），`site-per-process` 下合并会破坏隔离并可能导致登录态异常。不建议。

## P3-3　替换 Playwright 为直接 `chrome --app` 启动
可去掉 node 中间层（省 196 MB），但要重做 `exposeBinding` 的下载/返回桥接（改用 `--remote-debugging-port` + 自建 CDP 客户端）。工作量大，属架构级重构。

---

## 建议实施顺序（供批准）

```
第 1 批（0 风险，只读动作）：P1-1 清理缓存/组件模型
第 2 批（1 行参数）：       P0-2 打开 Chromium 后台降级 → 实测 CPU
第 3 批（幂等 + 守卫）：    P0-3 / P0-4 → 重启验证日志
第 4 批（新增总线）：       P1-3 → P1-2（逐个脚本，逐个开关）
第 5 批（体验项）：         P2-1 暂停视频
第 6 批（架构）：           P1-6 / P3-3 —— 单独评估
```

第 1 批与第 2 批互不依赖，可以同一天做完并立刻拿到 CPU 对照数据。
**每一批之间必须做一次功能回归**（登录 / 播放 / 切换 / 下载六类 / 导航 / Alt+← / 最小化恢复）。
