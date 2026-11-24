# CHANGELOG

## 1.0.0 — 2026-11-25

首个打包版本，功能冻结，进入维护。

### 启动器
- Playwright 持久化上下文 + Chrome app 模式（无地址栏）
- 独立 Profile（`%LOCALAPPDATA%\DouyinApp\profile`）
- 脚本按 `00-*` 优先、其余按文件名排序注入；支持 `@run-at document-start`
- 运行日志 `launcher.log`（媒体请求、导航、`[DouyinSave]` 前缀的页面日志）
- 下载面板后端：`__dySave` / `__dySetPrefs` / `__dyBack` 三个绑定
- 下载偏好独立存储：`download-preferences.json`（六类资源，默认只勾视频/图文）

### 页面脚本
- 左侧导航隐藏 AI抖音 / 放映厅 / 短剧 / 小游戏（保留精选、推荐、关注、朋友、我的、直播）
- 隐藏 SmartFeed 悬浮球
- 下载按钮（`16-save-video.js`）+ 视频嗅探（`15-akface-download`）
- 16:9 全屏优化（`11-akface-fullscreen`）
- DouYinPlus 面板 / 直播增强 / 倍速 / 画质（`12-douyinplus`）
- 布局实验室 `20-layout-lab.js`：默认关闭

### 停用
- `14-dydl-download.user.js` → 改名 `.disabled`（体积大、与 15/16 功能重叠，造成页面卡顿）
- `20-layout-lab.js` 默认关闭（实验项）

### 已知限制
- 返回上一页会整页重载（详见 docs/KNOWN_ISSUES.md）
- `nav.v4-candidate.js.txt` 为未启用的候选补丁，实测无效
