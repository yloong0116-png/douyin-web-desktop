# 网页资源审计（只读）

- 日期：2026-11-25
- 范围：抖音 Web（`https://www.douyin.com/?recommend=1`）在本封装内的加载、DOM、视频资源与页面结构
- **重要边界**：正式实例以 `--remote-debugging-pipe` 启动，**无 TCP 调试端口**，因此本轮**无法**从外部采集首屏资源瀑布、JS Heap、DOM 节点、视频预加载数量的实时数据。本文把已有实测（历史隔离副本实验 + 进程级采样 + 磁盘缓存）与静态/结构分析**分列并标注等级**，不把推测写成实测。

---

## 1. 已有的实测数据（来自前次隔离副本实验，条件不同，仅供趋势参考）

来源：`reports/memory_growth_investigation_20261125.md`，条件 = profile 副本 + 独立实例 + 注入全部脚本 + `mouse.wheel` 连续切换 15 次。

| 采样点 | JS Heap | DOM 节点 | video 元素 |
|---|---|---|---|
| 基线 | 89 MB | 1993 | 1 |
| 切换 2 次后 | 120 MB | 2711 | 1 |
| 切换 11 次后 | 82 MB | 2663 | 1 |
| 切换 12 次后 | **170 MB** | **3803** | **3** |
| 切换 15 次后 | 92 MB | 3876 | 3 |
| 静置 30 s | 118 MB | 3879 | 3 |
| 静置 60 s | 117 MB | 3879 | 3 |

### 从这组数据能确定的三件事

1. **DOM 节点不是逐视频累积**：S2 之后连续 9 个采样点停在 2711，之后一次性跳到 3803 再稳定。这是一次结构切换（`video` 从 1 变 3），不是泄漏。
2. **JS Heap 有明确的 GC 回落**（126 → 72 MB）。不是线性泄漏。
3. **静置 60 秒 heap +25 MB 而节点不变** —— 与「常驻定时器周期性分配」一致（**推测**，非因果）。

### 从这组数据不能确定的

- 首屏资源数量/体积/耗时（未采 resource timing 明细）
- 视频预加载策略（`preload` 属性、`videos=3` 的出现条件）
- 路由切换是否重复创建组件（未采 DOM 快照 diff）
- 真实登录态下的基线（副本可能降级）

---

## 2. 从进程与磁盘侧得到的间接实测

| 指标 | 值 | 说明 |
|---|---|---|
| `Default/Cache` | 410 MB | HTTP 缓存磁盘占用。抖音图片/视频分片/JS 都在此 |
| `Default/Code Cache` | 314 MB | V8 编译缓存。**启动时按需 mmap 进 renderer**，直接影响首屏与 renderer 基线 |
| `Service Worker` | 1 MB | 抖音未重度使用 SW，✅ 无额外后台唤醒 |
| `GPUCache` + `GrShaderCache` | 19 MB | 着色器缓存，正常 |
| renderer Private Bytes | 2360 MB（17:30） | 页面本体运行时内存 |
| gpu-process | 38 MB（Priv） | **显存不在这个数字里**，不能当作「GPU 只用 38 MB」 |
| `optimization_guide_model_store` | 41 MB | Chrome 优化提示模型，抖音页面不依赖 |
| `WasmTtsEngine` | 25 MB | 阅读朗读引擎，本项目不使用 |

结论：磁盘缓存不是瓶颈，但 **Code Cache 314 MB + 两份无用组件模型 66 MB 是纯增量**。清理它们不改变功能，属于低风险 P1。

---

## 3. 页面结构层面的代码审查 [代码]

| 观察 | 证据 | 影响 |
|---|---|---|
| 抖音是重度 SPA，路由切换不重新加载文档 | `launcher.log` 中 `[nav]` 与 `[life] document load #N` 的比例：文档 load 次数远少于 URL 变化 | 用户脚本只在首次文档加载时初始化 → 路由变化后靠各自的轮询/观察器适配，反过来解释了为什么脚本必须常驻定时器 |
| `video` 元素数量会在 1 → 3 之间变化 | 前次实验 S12 | 多出的是预加载/浮层播放器。**预加载策略未改**，属正常行为 |
| launcher 用 `--app=data:text/html` + 随后 `goto` | launcher.js:64,168 | 会先渲染一个空白 app 页再跳转，首屏多一次导航（可忽略，非瓶颈） |
| `waitUntil: 'commit'` | launcher.js:168 | 不等待 DOM/网络空闲 → **启动更快**但「可交互」定义偏早。这是当前「启动快」的设计选择，不建议改回 `load` |
| 无请求拦截/改写 | launcher.js 全文 | ✅ 未触碰平台请求，符合项目边界 |

---

## 4. 可能可延迟/可裁剪的非核心模块（**未验证，仅列候选**）

| 候选 | 判断依据 | 风险 |
|---|---|---|
| 广告/推荐预热请求 | 抖音首屏会预取后续视频（`douyinvod` 域名请求在 `mediaLog` 中出现） | ⚠️ 直接拦截会破坏「连续上滑」体验，且可能触发风控。**不建议做** |
| 直播相关 SDK | 非直播页仍加载 | 无法在不破坏「点进直播」的前提下安全移除 |
| 组件模型目录（optimization_guide / WasmTtsEngine） | 属 Chrome 组件，非网页资源 | ✅ 可安全删除，P1 |
| `00-vue.min.js`(105 KB) | 供部分脚本使用 | ❌ 被依赖，不可删 |

**结论**：网页侧没有「安全、显著、可立即执行」的资源裁剪项。真正的收益在**后台状态管理**和**定时器治理**，不在拦请求。

---

## 5. 补齐实测所需的最小方案（需批准，不在本阶段执行）

以**隔离实例 + 独立 profile 副本**启动，仅增加一个调试端口，采集 9 个场景：

```powershell
# 只读采集，profile 用副本，不触碰正式实例
$env:DY_PROFILE = "<工作区>\temp\dy-audit-profile"
$env:DY_PLAYWRIGHT = "<playwright 路径>"
# 在 launcher 的 args 中临时追加（不改正式文件，用副本 launcher）：
#   --remote-debugging-port=9223
```

采集脚本（CDP）：

```js
// 每次采样
const m = await cdp.send('Performance.getMetrics');
const pick = n => (m.metrics.find(x => x.name === n) || {}).value;
// JSHeapUsedSize, Nodes, Documents, LayoutCount, RecalcStyleCount, TaskDuration
const res = await cdp.send('Runtime.evaluate', {expression: `
  JSON.stringify({
    res: performance.getEntriesByType('resource').length,
    bytes: performance.getEntriesByType('resource')
      .reduce((s,e)=>s+(e.transferSize||0),0),
    types: performance.getEntriesByType('resource')
      .reduce((a,e)=>{const t=e.initiatorType;a[t]=(a[t]||0)+1;return a},{}),
    videos: [...document.querySelectorAll('video')].map(v=>({
      preload: v.preload, autoplay: v.autoplay, src: (v.currentSrc||'').slice(0,60)
    })),
    fcp: (performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime
  })`, returnByValue: true});
```

场景脚本：冷启动到可交互 / 空闲 2 min / 播放 5 min / 切 15 个 / 切 50 个 / 静置 2 min / 最小化 2 min / 恢复前台 / 连续 30 min —— 与项目书第四节完全一致，每 5 s 一点，外部同时采进程 Private Bytes。

---

## 6. 本节诚实结论

- **没有实测到的**：首屏资源数量与体积、FCP/LCP、预加载策略、路由切换的 DOM 增量、登录态基线。
- **已经实测到的**：缓存与 code cache 体量、进程内存分布、DOM/Heap 的锯齿形变化、视频元素 1→3 的结构切换。
- 据此**不能**宣称「网页侧有 X MB 可省」。只能说：网页侧可省的部分集中在 **code cache / 无用组件模型（约 380 MB 磁盘 + 部分 renderer 映射）**，以及**最小化时不应当继续跑 12 次/秒的脚本回调**。
