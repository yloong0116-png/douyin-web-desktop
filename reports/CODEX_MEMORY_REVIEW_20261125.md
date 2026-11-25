# Douyin-Web-Desktop 内存占用独立审查（2026-11-25）

范围：源码、仓库内历史报告及 CSV 的只读复核。没有运行浏览器、连接用户实例、改动配置或删除任何数据。本文中“当前启用”严格指仓库当前 launcher 会加载的脚本；已有运行实例报告所述的是另一份安装目录，不能自动等同。

证据标签：**[已实测]**=现存原始运行采样/日志记录；**[静态代码证据]**=当前 checkout 的源码；**[历史数据推断]**=不同时间或口径数据之间的推断；**[合理推测]**=机制上合理但缺少可归因测量；**[尚未验证]**=现有资料不能回答。

## 1. 当前架构概览

- **[静态代码证据]** `app/launcher/launcher.js:61` 以 `chromium.launchPersistentContext(PROFILE, ...)` 启动持久 BrowserContext，`PROFILE` 默认是仓库根下 `profile`，可由 `DY_PROFILE` 改写。`scriptList()` 在 `app/launcher/launcher.js:46` 只加载 `app/userscripts` 直接目录中后缀为 `.js` 的文件并按名称排序。源码没有创建额外 Page 的调用；入口选择 `ctx.pages()[0]` 并 `goto` 抖音。启动时因此通常只有一个 app 页面，但页面创建/弹窗仍可能由网站产生并由 context 的 page 事件接管。
- **[静态代码证据]** `app/launcher/launcher.js:61-67` 使用 Chrome channel、非 headless、app 窗口、默认参数排除 `--no-sandbox` 和 `--enable-automation`，自加 start-maximized/no-first-run/no-default-browser-check/disable-extensions。仓库这份源码未显式加禁用硬件加速参数。历史运行实例参数报告称另有 Playwright 注入的后台降级相关参数；需注意该命令行来自不同安装目录/运行版本，不能只凭仓库源码确认当前机器启动参数。
- **[静态代码证据]** `addInitScript` 在每个 frame 的新文档运行。`app/launcher/launcher.js:86-110` 把脚本按 document-start 与延迟批注入；脚本自身是否对 iframe 早退决定了每个 frame 上执行多少逻辑。
- **[静态代码证据]** launcher 监听请求并把最近至多 40 个媒体 URL 保存在 `mediaLog`（`app/launcher/launcher.js:114-127`），有界；监听页面 console/navigation/load，并维护 page 栈用于返回。没有发现源码中额外常驻后台 Page 创建流程。`setInterval(() => {}, 1 << 30)`（约第 366 行）用于保持 Node 事件循环，这影响的是 launcher 生命周期，不是 Renderer 的主要内存来源。
- **[尚未验证]** 仓库默认 Profile 的体积/状态与历史安装路径 `%LOCALAPPDATA%\DouyinApp\profile` 是否相同。本次没有访问或检查用户 Profile。

## 2. 历史内存数据复核

| 证据 | 数据 | 可支持的结论 |
|---|---|---|
| **[已实测]** 副本 15 次切换，`reports/memory_growth_investigation_20261125.md` | JS Heap 89 MB 起，主要 72–126 MB，切换结构突变时峰值 170 MB；DOM 1993→2711 平台，之后一次增到约 3.9k 后平台；video 从 1 变 3 | 这组短测未显示按每条视频持续累加的 JS Heap/DOM 趋势。不能代表真实登录态，也没有进程指标。 |
| **[已实测]** 真实实例 15 次切换，同报告补充 | renderer Working Set 约 3456→4421 MB，GPU WS 有波动；其间 renderer 有数百 MB 回落 | 确实观察到高 Working Set 和短时回落。WS 受共享页影响，不能等同私有内存或泄漏量；无法据此判定媒体是唯一来源。 |
| **[已实测]** 真实实例 50 次切换，同报告补充二 | JS Heap 多在 230–280 MB；DOM 约 4053 后连续平台；renderer WS 1035→峰 1440→末 1157 MB；刷新后 DOM 4053→2285 | 这次没有持续单向增长；规模和页面状态不同于上述 3–4 GB 观察。不能据此否认长会话/特定内容可能累积。 |
| **[已实测]** 进程 CSV `reports/audit/baseline_samples_20261125.csv`，86 个采样行，约 17:30:57–17:40:53 | 主 renderer Private Bytes 约 2419→3606 MB；总 Private Bytes 3582→5059 MB；系统可用内存 3918→2436 MB。GPU 字段是 `gpu_ws`，不是 GPU Private Bytes。 | 这 10.8 分钟的非受控时间窗里进程私有提交增长明显。采样没有页面 heap/DOM、视频操作标记和显存，不能把增量归因给某脚本或媒体。`avail_mb` 同时受机器其他进程影响。 |
| **[已实测]** `reports/audit/CHROMIUM_PROCESS_MEMORY_20261125.md` 单点 | 一次进程表把 renderer Private Bytes 记为约 2360 MB、gpu-process Private 为 38 MB；另有第二 renderer/utility 混合角色进程 | 单点说明某个 Renderer 可占大头，不给出内部子系统分解；不能把 GPU Private 低解释为 GPU 显存低。 |

**数据口径校正：**历史文档中“GPU Private 明显波动”的文字与可读的这份 CSV 不匹配：CSV 仅列 `gpu_ws`。本次找到的报告也没有给出对应 GPU Private 原始序列，因此该事实在本次材料中**尚未核验**。不同报告存在 renderer WS 与 Private Bytes 混用、采样阶段/运行版本不同的问题；不能把 4.4 GB WS 与 3.6 GB Private Bytes 直接当作同一序列。

## 3. Chromium 内存构成分析

- **JS Heap（V8）**只统计 JavaScript 堆对象。历史副本和 50 次切换的 heap 数值显著低于多 GB 的 Renderer 指标，支持“多数已观察到的进程占用不在当时可见 JS Heap 中”。**[已实测 + 历史数据推断]** 这不排除 JS 持有的 DOM/ArrayBuffer 等在采样口径、外部资源或延迟回收上的差异，也不能据此断言没有 JS 泄漏。
- **DOM/Blink**包括节点、布局/样式结构及相关原生分配；节点数平台是反对“节点按每条视频无限累加”的证据，但 DOM node count 不衡量每节点 backing store、图片纹理等。**[已实测]**
- **Renderer Working Set**是当前驻留页，可能含共享映射；不能称为纯“页面私有使用量”。**Private Bytes**表示进程私有提交，不等于当前驻留物理内存，也不直接指出分配者。二者都不是单独的泄漏判据。**[指标定义/历史字段]**
- **媒体管线**可能在 Blink/Chromium 原生组件中持有压缩数据、解码帧、色彩转换/合成资源以及播放器预取缓存；这些不都进入 V8 Heap。高分辨率播放、视频切换预取和多视频元素可造成峰值/平台。现有 1→3 个 video 元素是页面结构的实测，不等于三个均在解码或各自占有完整缓冲。**[合理推测]**
- **GPU**有独立 GPU process 与 GPU 资源，但 CPU 进程的 GPU Private Bytes/Working Set 均不等于显存。缺少 GPU 显存、解码器和纹理计数，无法建立 GPU 与 Renderer 增长的相关曲线。**[尚未验证]**
- **网页自身**是页面与播放器 DOM/脚本/图片/预取的主要工作负载，复杂 SPA 和跨站 OOPIF 可能拆分到多个 Renderer。历史进程表中另一个进程标注为 renderer/utility，归属 frame 未核实；抖音 iframe 是站点页面结构的一部分，不能把进程数量直接解释为多开实例。**[历史数据 + 尚未验证]**
- **Userscripts**消耗 JS 堆、DOM、事件/定时器执行和网络钩子。源码能证明有这些执行点，不能用脚本体积或事件监听器注册点数换算 MB。注入每 frame 会放大重复执行风险，但实际 frame 数和代码在各 frame 内成功运行情况未记录。**[静态代码证据 + 尚未验证]**

### 刷新后内存下降的机制

- **[已实测]** 历史 50 视频记录刷新后 DOM 节点数从 4053 降至 2285；这证明刷新重建了文档和 DOM 基线。
- **[合理推测]** 文档替换会释放该文档可达的 JS 对象、DOM、事件监听器、定时器、图片/样式资源引用，并使 Renderer 可回收播放器状态、MSE/解码器/帧队列等页面相关资源。异步原生资源可能稍后才归还；分配器也可能保留已提交页而不立即减少 Private Bytes/Working Set。
- **[尚未验证]** 提供的“刷新前 4.4 GB、刷新后约 1.9 GB”没有与本报告可读取的同一 CSV、同一 PID、同一口径的刷新前后时间戳配对。因此刷新确能令某次进程指标大降是历史描述，但具体下降量、RSS/Private Bytes 哪一项以及资源释放归属无法独立复核。不能以该现象证明泄漏，也不能证明仅是 Chromium 缓存。

## 4. Userscripts 逐个审查

### 当前仓库实际启用集合

**[静态代码证据]** 当前目录包含 9 个 `.js` 文件（README 本身不注入）：`00-gm-shim.js`、`00-vue.min.js`、`10-frequenk-enhancer.user.js`、`11-akface-fullscreen.user.js`、`15-akface-download.user.js`、`16-save-video.js`、`17-glass-nav.js`、`18-hide-assistant.js`、`20-layout-lab.js`。`12-douyinplus` 与 `13-smartfeed` 在当前仓库目录中不存在；`14-*.disabled` 也不存在。因此针对 12/13 的历史审计数字不适用于当前 checkout，不能据其提出当前源码级问题。历史安装目录日志记录的运行集含 12/13，说明执行环境与 checkout 有差异。

- **00-gm-shim.js**：模块初始化为 document 级兼容 API，鼠标监听和 UI 定时器用于按钮交互；文件没有顶层 frame guard。**[静态代码证据]** 可能在子 frame 重复安装轻量 helper；无历史证据指向其导致多 GB 占用。收益低，暂不单独改。
- **00-vue.min.js**：Vue 运行时依赖库；执行随 init script 作用于新 frame。**[静态代码证据]** 未见本次材料能证明它本身泄漏；其体积不是运行时存活内存证明。
- **10-frequenk-enhancer.user.js**：`SpeedController` 构造路径在约 3577–3619 行创建控制器、事件监听并启动 `mainLoop` 的 300 ms interval；`LivePurifier` 约 4366 行另起循环。`initialize()` 约 4813 行由文档就绪/路由适配调用。实例包含 `seenVideoUrls` Set（约 3590 行）且切换时新增 URL（约 4225–4227 行），静态代码表明它可能随唯一视频 URL 增长；没有数量/上限/会话时长数据，属于需要查实的强候选。**[静态代码证据；增长量尚未验证]** 文件没有 top-frame guard，因此 iframe 中重复注入可多份启动循环；实际发生数未知。
- **11-akface-fullscreen.user.js**：约 116 行定时器等待目标元素，命中后 `clearInterval`，有终止路径；`popstate` 监听通过返回的 unobserve 函数移除（约 41–57 行）。其余 hover idle timeout 是交互后置换。**[静态代码证据]** 未发现已证实的永久轮询或旧 video 引用；无 top-frame guard，子 frame 重复执行可能性存在。
- **12-douyinplus / 13-smartfeed**：当前 checkout 缺文件。历史脚本审计所述 4+2 个 interval、Observer 等无法复核源码、函数调用链与销毁路径。**[尚未验证]** 需要与实际安装版本取得一致后再判断；不能将历史清单计入“当前仓库启用”。
- **15-akface-download.user.js**：`Sniffer.start()`（约 270–276 行）挂 fetch/XHR hook 并每 2 秒调用 `scanPerformance()`；后者（约 339 行）遍历全部 Resource Timing entries。随着条目累计，重复遍历开销可能上升，频率固定；这首先是 CPU 工作，不足以解释 GB 级私有内存。`seenUrls` Set 在命中媒体 URL 后增长且没有清理（约 265、286–295 行），若 URL 基数持续增长会长期保留字符串；实测基数未知。**[静态代码证据；内存影响尚未验证]** MSE 下载 `VideoWriter` 组装 Blob/chunks 是用户触发下载路径；完成后是否归零引用需看完整调用流程，但不属于每次播放必然分配。
- **16-save-video.js**：`mount()`（约 403–419 行）以模块局部 `btn` 防止同一 JS realm 重复挂载；若 `body` 被替换且旧按钮被移除，模块变量仍指向旧节点，mount 会拒绝重建（功能风险），但未见重复 mount 造成无限按钮的源码路径。历史日志中多条 mounted 记录来自不同上下文/页面的解释只是推测；单凭日志不能推出同一 Document 重复初始化或泄漏。该脚本未见常驻 interval/MutationObserver。**[静态代码证据；历史重复日志的归属尚未验证]**
- **17-glass-nav.js**：顶层 frame guard 存在。`boot()` 创建对 `document.body/documentElement` 的 subtree `MutationObserver`，只要有 addedNodes 即安排 220 ms 合并扫描；observer 没有 disconnect，但与 Document 生命周期同寿命，通常随刷新销毁。SPA 下长期常驻属于预期；大范围 subtree 观察每次新增节点都触发回调，实际频率/耗时未测。**[静态代码证据；成本尚未验证]**
- **18-hide-assistant.js**：一次性 DOM 注入及样式操作，无常驻 timer/observer。**[静态代码证据]**
- **20-layout-lab.js**：默认标注为实验用途，事件/定时器在特定 fullscreen 路径触发；实际设置/开关是否启用未在当前代码或数据中证明。它属于仓库注入集合（launcher 不读取 enabled 标志），需把“默认关闭”的 README/配置说法与代码核实。**[静态代码证据；实际功能触发尚未验证]**

**iframe 重复加载说明：**当前 9 个脚本中 00-gm-shim、10、11、15、16、18 没有顶层 frame guard；00-vue 是依赖库。此静态事实只证明可能在子 frame 再执行，不证明“每个 iframe 都启动全部功能”或每个都占同等资源；具体网站 frame 数、同源限制与脚本内运行保护须运行时取证。**[静态代码证据 + 尚未验证]**

## 5. 最可疑的三个内存来源

1. **抖音页面/播放器/媒体栈的原生分配**：真实进程 Private Bytes 多 GB，JS Heap 与 DOM 短测远低于该值，且刷新后历史描述为大幅回落。媒体解码帧、页面图片/纹理、Blink/Skia 分配均合理；各自占比没有测量。**[已实测现象 + 合理推测归因]**
2. **10 脚本每视频增长的 Set 与多 frame 实例**：`seenVideoUrls` 对唯一 URL 增长且没有清理；同时脚本缺少顶层 guard。是当前代码里最具体的可达对象累积候选，但大小估算和不同文档/frames 上是否重复均未知。**[静态代码证据；尚未验证实际影响]**
3. **15 脚本的 seenUrls 与 Resource Timing 轮询**：URL Set 长期保留命中值；资源列表每 2 秒全表扫描，可能随会话变贵。更有把握的风险是 CPU/对象保留小量增长，不能解释数 GB。**[静态代码证据；规模尚未验证]**

## 6. 有证据的问题与尚未证实的问题

**有证据：**
- **[已实测]** 若干运行时段出现多 GB renderer 指标；不同记录使用 WS 和 Private Bytes 两种口径。
- **[已实测]** 50 次切换记录中 heap/DOM/renderer 指标没有表现持续单调增长；DOM 在约 4k 后平台。
- **[静态代码证据]** 当前 15 脚本有无界 Set 和全量 Resource Timing 重扫；10 脚本有 URL Set 且启动常驻循环；多个当前脚本无 top-frame guard。
- **[静态代码证据]** launcher 代码使用一个 PersistentContext 的初始 Page，当前启动流程没有明确创建多个后台页面的代码。

**尚未证实：**
- Renderer 数 GB 中媒体、GPU、Blink、网页 JS、userscript 各占多少；“主要是媒体”目前是合理推测。
- 4.4→1.9 GB 刷新前后是否为同一进程、同一指标与同一采样工具；刷新释放的确切分配者。
- GPU Private Bytes 曲线及与 Renderer 的相关性；GPU 显存大小。
- 安装目录版本当前是否仍在运行、真实启用脚本集合和 iframe 数量；仓库缺失的 12/13 是否注入在历史实例。
- 10/15 两个 Set 的元素数量、保留字节和是否达到值得修复的规模。
- 50 视频短测不覆盖小时级运行、直播/图集/长视频/登录差异，故不能排除特定状态的泄漏。

## 7–8. 可实施优化清单（本阶段仅建议）

| 建议 | 预期收益 | 风险 | 低干扰验证方式 |
|---|---|---|---|
| 先对齐审查目标与真实运行脚本版本（含 12/13 文件来源及 hash），只做清单核验 | 防止修改错误副本；本身不减内存 | 极低；可能发现版本漂移 | 比较运行目录与仓库文件名/hash、launcher 启动日志；不改文件 |
| 对 10 的 `seenVideoUrls`、15 的 `seenUrls` 做有界化或按 SPA 生命周期清理，先按实际 URL 语义设计 | 限制脚本自身长期字符串引用；预期收益小且未知 | 去重窗口变短可能重复统计/重复提示 | 在隔离 profile 记录 Set size 与 Private Bytes；先测量，改后短时同场景对照 |
| 为非页面级脚本加顶层 frame guard，前提是确认功能只应作用于主页面 | 减少子 frame 重复执行与轮询 | 如果功能需在直播/弹窗 frame 工作，会丢功能；不能盲加 | 隔离实例列出 frame 与脚本标记，验证下载/播放/直播 UI |
| 评估 15 的 Resource Timing 全表扫描改为增量读取/合适 Observer | 降低随资源条目数增长的扫描 CPU；内存收益不确定 | ResourceObserver 覆盖范围/时序差异可能漏嗅探下载资源 | 以短场景核对发现的 URL 与下载功能，不做长跑 |
| 若确认历史安装版本确实使用后台禁用参数，单独评估恢复 Chromium 默认后台降级 | 最可能降低最小化/被遮挡时 CPU 活动，不承诺降低前台 Renderer 峰值 | 可能影响后台播放、直播/下载和最小化体验；必须核实该窗口的 visibility 行为 | 隔离实例最小化前后各约 1 分钟比较 CPU 与播放连续性；不需数小时 |
| 如还需区分媒体/脚本，做隔离 profile 的一次短 A/B（当前脚本全开与禁用可疑脚本）并同步采样同一 renderer Private Bytes、Heap、DOM、video 数 | 给出方向性归因 | 会受登录态、缓存、视频内容差异影响；不是精确分账 | 每轮同一固定短视频/少量切换，先热身，标明采样器开销；不触碰正式 Profile |

以上均未实施。当前数据不足以承诺可节省的 MB 数。

## 9. 明确建议暂时不要修改的部分

- 不关闭硬件加速，不禁用 Chromium 核心服务，不加 `renderer-process-limit`、V8 堆硬上限等未经对照的参数。
- 不清理用户 Profile、Cache、Code Cache 或组件目录；磁盘缓存尺寸不能直接解释运行时 Renderer Private Bytes。
- 不改视频 `src`、暂停/卸载播放器、不拦截预取请求；这些做法可能破坏原生播放、恢复和画质体验，且没有媒体资源归属证据。
- 不根据历史“mounted 五次”日志直接在 16 增加幂等锁：当前 `mount()` 已用 `btn` 局部变量防止同一 realm 重复挂载，日志没有 page/frame/document 标识，不能证明同一文档重复。
- 不将 12/13 的历史审计结论直接应用于当前仓库，因为对应源码缺失；不引入自动刷新、自动重启或自动清理。
- 不把 400 MB 当验收目标，也不以 Working Set 单次升降作为泄漏证据。

## 10. 最终建议：下一步最值得做的一件事

**先完成运行脚本版本对齐，并在隔离环境对当前可疑脚本的集合大小做短时可观测性核验。**最小的一步是确认正式运行目录的 `.js` 文件名及 hash，特别是历史运行报告中的 12/13 是否仍在加载。原因是目前 repo 审查对象与历史被测对象不一致；若跳过这一步，任何后续优化都可能改错版本。之后若版本一致，优先度量 10/15 的 Set 基数，并将同一 renderer 的 Private Bytes 与 Heap/DOM/video 数同步采样，短时 A/B 才能判断是否值得修复。

这是一项建议，不是已授权实施变更；本次审查至此停止。

## 实施跟进（2026-11-25）

后续用户授权自主优化后，已实施下列小改动；它们尚未在实际最小化窗口中验证：

- **[静态代码证据]** 新增 `app/userscripts/05-background-manager.js`：仅顶层文档监听 `visibilitychange`，隐藏时暂停当时正在播放且未结束的 `<video>`，可见时不自动恢复播放、不移除源、不调用 `load()`。使用 `WeakSet` 不保留视频节点强引用。需要重启客户端/重新加载文档后生效。
- **[静态代码证据]** 当前仓库 `app/userscripts/15-akface-download.user.js`：后台仍保留 2 秒定时器节拍，但 hidden 时跳过全量 Resource Timing 扫描；恢复后下一次周期继续扫描，不改变嗅探功能的前台路径。
- **[静态代码证据]** 运行安装目录的 `12-douyinplus.user.js`：250ms unlock 回调在 `document.hidden` 或用户已关闭 unlock 配置时跳过；其余两个 900ms 回调未改。运行目录的 `15-akface-download.user.js` 同样加 hidden 门控。安装目录新增了同一份 05 脚本。对应 10/12/15 原文件已备份到 `%LOCALAPPDATA%\DouyinApp\codex-backups`，文件名带实施时间戳。
- **[已验证]** `node --check` 对新增脚本、运行副本 12/15 均通过。未重启正在运行的实例，因此运行时行为还未加载/验证。
- **[尚未验证]** 该 Chrome app 最小化时是否触发 `document.hidden`；历史报告称没有变化，但未有可复核原始 trace。当前实例是 `--remote-debugging-pipe`，未提供 TCP CDP；本次未自动最小化用户窗口。故后台暂停能力能否在此 app 生效尚不能确认。
- **[合理推测]** hidden 门控降低扫描与播放器活动，前台性能影响应很小；并未测得内存下降幅度，不能把 400 MB 作为已达目标。

未动 Chromium 参数、硬件加速、profile、缓存、12/13 的仓库版本同步、下载配置或正在运行实例；未做自动刷新/重启/清理。正式安装版本的 10/11/16 还与仓库文件不同，发布/打包仍须先明确版本同步策略。

## 实际读取的文件

- `app/launcher/launcher.js`
- `app/launcher/nav.js`（通过源码检索审查事件处理）
- `app/userscripts/README.md`
- `app/userscripts/00-gm-shim.js`
- `app/userscripts/00-vue.min.js`（确认存在/依赖角色；未逐行审计压缩库）
- `app/userscripts/10-frequenk-enhancer.user.js`
- `app/userscripts/11-akface-fullscreen.user.js`
- `app/userscripts/15-akface-download.user.js`
- `app/userscripts/16-save-video.js`
- `app/userscripts/17-glass-nav.js`
- `app/userscripts/18-hide-assistant.js`
- `app/userscripts/20-layout-lab.js`
- `package.json`
- `reports/memory_growth_investigation_20261125.md`
- `reports/audit/BASELINE_20261125.md`
- `reports/audit/baseline_samples_20261125.csv`
- `reports/audit/CHROMIUM_PROCESS_MEMORY_20261125.md`
- `reports/audit/WEB_RESOURCE_AUDIT_20261125.md`
- `reports/audit/USERSCRIPT_RESOURCE_AUDIT_20261125.md`
- `reports/audit/OPTIMIZATION_PRIORITY_20261125.md`
- `reports/audit/superseded_LIGHTWEIGHT_AUDIT_concurrent_1734.md`（仅核对其口径/范围说明）

## 没有读取到的关键资料

- 正式运行目录 `%LOCALAPPDATA%\DouyinApp` 当前 userscripts 文件及 hash；本次保持只读工作区边界，未扫描运行目录。
- 发生“刷新前约 4.4 GB、刷新后约 1.9 GB”的原始逐点 CSV/日志；当前项目内报告仅保留文字总结。
- GPU Private Bytes/显存原始采样序列；已找到的 baseline CSV 字段是 `gpu_ws`。
- 50 次切换原始 CSV；报告仅有概括数值。
- 运行时 CDP frame/target 列表、播放器 MSE/解码器状态和 userscript 每 frame 执行计数。
- `12-douyinplus`、`13-smartfeed` 当前源码（仓库文件不存在）。
- 用户 Profile 的文件内容、浏览器缓存内容与运行时进程；本次没有访问。
