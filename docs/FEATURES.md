# 功能清单（对照代码与运行日志核实）

状态口径：**已实现且实测通过** / **已实现但未完整测试** / **代码存在，运行状态未验证** / **已停用** / **已知故障** / **计划功能** / **不适用于第三者环境**

| 功能 | 状态 | 文件 | 依赖 | 证据 |
|---|---|---|---|---|
| 桌面启动器（无地址栏窗口） | 已实现且实测通过 | launcher.js | Playwright, Chrome | 多次冷启动，窗口正常 |
| 独立浏览器 Profile | 已实现且实测通过 | launcher.js:PROFILE | — | profile\ 持续保存登录态 |
| Userscript 顺序注入 | 已实现且实测通过 | launcher.js:scriptList | 00-gm-shim | 日志 `init: nav + early[...] late[...]` |
| 下载面板挂载 | 已实现且实测通过 | 16-save-video.js | DOM | 日志 `[DouyinSave] v3.1 button mounted` |
| 六类资源选择（媒体/音乐/封面/音乐封面/头像/文案） | 已实现但未完整测试 | 16-save-video.js, launcher.js | — | 面板与偏好读写实测；六类**逐项下载未逐一实测** |
| 默认仅勾视频/图文 | 已实现且实测通过 | launcher.js:PREF_DEFAULTS | — | 日志 `prefs={"media":true,...false}` |
| 下载偏好持久化 | 已实现且实测通过 | download-preferences.json | — | `prefs saved ok=true` |
| 视频文案 .txt 受勾选控制 | 已实现但未完整测试 | launcher.js:`wantsText` | — | 代码审查 |
| 左侧导航隐藏 4 项 | 已实现且实测通过 | 17-glass-nav.js | — | 日志 `nativenav ready containers=1 hidden=4` |
| 保留 6 个原生入口（纯图标） | 已实现且实测通过 | 17-glass-nav.js | — | 截图与日志 |
| 隐藏 SmartFeed 悬浮球 | 已实现且实测通过 | 18-hide-assistant.js | 13-smartfeed | 注入日志 |
| 16:9 全屏优化 | 已实现但未完整测试 | 11-akface-fullscreen.user.js | GM shim | 代码审查，未做逐项回归 |
| 倍速 | 代码存在，运行状态未验证 | 12-douyinplus.user.js | 抖音播放器 | 探针曾报 `2.0x not found` |
| 画质切换 | 代码存在，运行状态未验证 | 12-douyinplus.user.js, 11 | 抖音播放器 | 探针曾报「无多档位」 |
| 直播增强 | 已实现但未完整测试 | 12-douyinplus.user.js | — | 代码审查 |
| 智能信息流（SmartFeed） | 已实现但未完整测试 | 13-smartfeed.user.js | Vue, GM shim | 本轮**未打包**（许可证不明） |
| DouYinPlus 面板 | 已实现但未完整测试 | 12-douyinplus.user.js | Vue, GM shim | 本轮**未打包**（许可证不明） |
| AI 自动判断 | 已停用 | 13-smartfeed 配置项 | — | 关闭后无 AI 请求 |
| 布局实验室 | 已停用 | 20-layout-lab.js | — | localStorage 开关默认关 |
| 旧下载脚本 14-dydl | 已停用 | 14-dydl-download.user.js.disabled | — | 文件名后缀 |
| 返回上一页 | **已知故障** | launcher.js:__dyBack, nav.js | — | 见 KNOWN_ISSUES |
| 返回按钮 / Alt+← | 已实现且实测通过 | nav.js | — | 按钮与快捷键可用，但返回会整页重载 |
