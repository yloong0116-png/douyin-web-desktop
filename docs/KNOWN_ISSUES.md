# 已知问题

## P0 返回上一页会整页重载

- **现象**：从个人主页点左上返回（或 Alt+←）回推荐页，推荐流重新加载、视频重新初始化。
- **已实测**：
  - 正式启动参数含 `--disable-back-forward-cache`（Playwright 默认注入，`launcher.js:62` 的 `ignoreDefaultArgs` 未忽略它）。
  - `history.back()` 后捕获到**主框架 Document 请求**（`resourceType=document`、`isNavigationRequest=true`、HTTP 200）。
  - `performance.timeOrigin` 改变、DOM 节点重建、`pageshow.persisted=false`。
- **已实测（隔离对照）**：移除 `--disable-back-forward-cache` 后行为**完全不变**；Chromium 的 `Page.backForwardCacheNotUsed` 给出原因 `MainResourceHasCacheControlNoStore`（抖音主文档 `Cache-Control: no-store`）+ `WebSocketUsedWithCCNS`。**改参数无用**。
- **未验证**：真实登录状态下从推荐流点作者进入 `/user/` 是 SPA 还是跨文档导航（测试环境未登录，无可点作者链接）；因此"最小修复"方案未定。
- **候选补丁**：`nav.v4-candidate.js.txt` 尝试点击左侧「推荐」入口做 SPA 返回，实测 `.click()` 与 CDP 指针点击对导航项（DIV，无 href）均**无效**，补丁不成立，未启用。

## P1 六类下载未逐一实测

面板与偏好读写已实测；音乐、封面、音乐封面、头像、文案的**逐项下载结果**没有完整回归证据。

## P1 播放器功能（倍速/画质）状态未知

`12-douyinplus` 的倍速与画质依赖抖音播放器菜单结构，探针曾报「选项未找到 / 无多档位」。属抖音改版敏感项。

## P2 部分脚本未打包

`12-douyinplus`、`13-smartfeed` 文件头无许可证声明，交付包只给来源与版本，不含源码。

## P2 无自动化回归

目前没有可重复的 UI 自动化测试（见 TESTING.md：本机对 Chrome App 窗口的合成输入不可靠）。

## P0-已修复：跨页面作品识别（2026-11-25）

- 旧逻辑只认 `[data-e2e="feed-active-video"]`、`/video/{id}` 路径、以及带 `data-e2e-vid` 的 video 宿主 → 个人主页/搜索页的作品以 `?modal_id=` 打开时三个来源全空，必然拒绝。
- 现为 v3.2：新增 `modal_id`/`vid`/`/note/` URL 识别、`<a href="/video/">` 祖先兜底、浮层作用域、权威来源裁决，冲突时明确拒绝。
- **仍未验证**：推荐页、关注页、朋友页在测试实例中页面不渲染作品标识，需人工确认。

## P0 修复中：关注页/朋友页串号（2026-11-25，v3.3）

- 现象：关注页/朋友页下载到首页推荐页的作品。
- 已定位：`resolve` 日志里固定出现 `dom-disagrees:7685228639953059237`，该 ID 跨多个页面重复 —— 推荐流播放器容器回收后 `data-e2e-vid` 未更新；加上旧 `lastClick` 跨路由有效，形成"唯一候选"假象。
- v3.3 修复：路由隔离、href 优先于属性、只认播放中的可见播放器、冲突即拒。
- **待验证**：关注页/朋友页真实下载（需人工在正式应用实测并回传 `resolve` 日志）。

## 内存占用（2026-11-25 定性）

**现象**：长时间使用后 renderer 涨到 4–4.8 GB，系统占用 90%+；刷新页面可回落 1.5–2.5 GB。

**定性：Chromium 侧的内存增长，不是本项目代码泄漏。**

| 证据 | 结论 |
|---|---|
| JS Heap 稳定 230–280 MB（50 个视频实测无累积） | JS 侧无泄漏 |
| DOM 节点一次性跃升后恒定（4053，连续 4 个采样点不变） | 无逐视频累积 |
| renderer Private 3146 MB vs Working Set 3182 MB | 真实驻留，不是换页 |
| F5 后 renderer 4.4 GB → 1.9 GB | 可回收，非永久泄漏 |

**高度疑似的机制**：`blink::NetworkResourcesData::ResourceData` 随请求数累积（对应 Playwright issue #44246 描述的场景——主 frame 永不导航的 SPA 页面）。本项目正是 SPA，条件吻合。

**证据级别**：高度疑似，**未取得对象级证据**（正式实例由 Playwright 以 CDP pipe 驱动，无端口接入，取不到原生堆）。因此不写成「已确认」。

**已验证的缓解**：F5 刷新回收 1.5–2.5 GB，登录态不受影响。建议长时间使用后刷新一次，或每 2–3 小时重启应用。

**不要为此关闭 Network 域**：会破坏 Playwright 的 request/route 能力，且尚未验证是否真能降低内存。

**已做的一处真实优化**（2026-11-25）：删除 launcher.js 中无消费方的 mediaLog 与 ctx.on('request') 监听。Node 进程 WS 114→90 MB（-21%）、30 秒 CPU 2.5→1.7 s（-32%），同条件重启对照。
