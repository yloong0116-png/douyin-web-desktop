# Douyin Web Desktop

把抖音网页版（www.douyin.com）包装成独立桌面窗口的 Windows 工具：无地址栏、独立 Profile、按序注入用户脚本、内置六类资源下载面板。

不是抖音官方客户端，不修改抖音服务端。

---

## 下载即用（推荐）

**[⬇ 下载 Douyin-Web-Desktop-Portable.zip](https://github.com/yloong0116-png/douyin-web-desktop/releases/latest)**（约 242 MB，最新 1.1.1）

三步：

1. 解压到任意目录（中文、空格路径都可以）
2. 双击 `DouyinLaunch.exe`
3. 首次使用点右上角「登录」扫码

**不需要**安装 Node.js、Chrome、Playwright 或任何依赖 —— 运行时和浏览器都在包里。

### 数据存哪

| 内容 | 路径 |
|---|---|
| 登录态 / 配置 / 日志 | `%LOCALAPPDATA%\DouyinWebDesktop` |
| 下载的视频 / 图片 / 音频 | `D:\Media\Douyin`（首次下载自动创建） |

升级时覆盖程序文件不会丢登录；删掉程序目录也不会删除这些数据。

---

## 功能

- **下载面板**：六类资源（视频/图文、原声、封面、音乐封面、头像、文案），默认只勾视频/图文，偏好独立保存
- **导航精简**：保留 精选 / 推荐 / 关注 / 朋友 / 我的 / 直播，隐藏 AI抖音 / 放映厅 / 短剧 / 小游戏，不改原生样式
- **跨页面作品识别**：详情页、个人主页浮层、搜索页、关注页、朋友页都能锁定当前作品，识别不到就明确拒绝而不是乱下
- **全屏优化**（依赖注入的第三方脚本，默认关闭，菜单里可开）
- **单实例**：重复双击不会开第二个

## 已知问题

### 长时间运行内存高（Chromium 侧，非本项目泄漏）

跑几小时后渲染进程会涨到 4–4.8 GB，系统占用 90%+。**刷一次页面（F5）能立刻回收 1.5–2.5 GB，登录态不受影响。**

已查明的证据：

| 证据 | 结论 |
|---|---|
| JS Heap 稳定在 230–280 MB（连刷 50 个视频无累积） | 不是脚本泄漏 |
| DOM 节点一次性跃升后恒定 | 无逐视频累积 |
| renderer Private ≈ Working Set | 真实驻留 |
| F5 后 4.4 GB → 1.9 GB | 可回收，非永久泄漏 |

高度疑似 Chromium 内部的网络记录随请求数累积（SPA 页面主 frame 永不导航，正好命中该场景），但**未取得对象级证据**，所以只写"高度疑似"。实际建议：长时间用之后刷一次，或每 2–3 小时重启。

### 返回上一页会整页重载

抖音主文档带 `Cache-Control: no-store`，浏览器无法缓存页面（BFCache 永不生效），跨文档返回必然重新请求。已验证移除 `--disable-back-forward-cache` 启动参数无效。彻底解决需要把 `/user/` 的进出改成站内 SPA 路由，未做。

其他未验证项见 [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md)。

## 最近更新

**1.0.4 / 1.1.1**（2026-11-25）
- 删除启动器里无消费方的网络请求监听：Node 常驻内存 114→90 MB（-21%），30 秒 CPU 2.5→1.7 s（-32%），同条件重启对照
- 内存高位定性为 Chromium 侧，附证据与缓解建议
- 尝试过「最小化自动暂停」方案，实测该窗口最小化时 `document.hidden` 不变化，前提不成立，已放弃
- 历史中的本机路径已全部清理

---

## 源码版

仓库里的 `app/` 是可运行源码，自己装环境的方式：

```powershell
winget install OpenJS.NodeJS.LTS
git clone https://github.com/yloong0116-png/douyin-web-desktop.git "$env:LOCALAPPDATA\DouyinApp"
cd "$env:LOCALAPPDATA\DouyinApp"
npm install
npm start
```

需要 Node.js ≥ 20 和系统 Chrome 158+。完整步骤见 [`docs/INSTALLATION.md`](docs/INSTALLATION.md)。

> 便携版和源码版共用同一套 `app/` 代码；便携版只额外打包了 `runtime/`（Node + Playwright）和 `browser/`（Chromium），并把路径改成相对解析。

## 目录

| 路径 | 内容 |
|---|---|
| `app/launcher/launcher.js` | 主程序：启动 Chromium、注入脚本、下载后端 |
| `app/launcher/nav.js` | 页面内返回按钮 / Alt+← |
| `app/userscripts/` | 用户脚本，按文件名排序注入 |
| `docs/` | 架构、安装、配置、功能、排障、已知问题、第三方依赖 |
| `reports/` | 技术调查记录（下载系统、导航改造、内存分析、轻量化审计、便携化） |
| `manifests/` | 文件哈希、功能状态、依赖清单、项目续作档案 |
| `releases/` | 交付包（ZIP 另见 Release 页） |

接手开发先读 [`manifests/PROJECT_STATE.md`](manifests/PROJECT_STATE.md)。

## 许可

本项目自有代码 MIT，见 [`LICENSES.md`](LICENSES.md)；内置第三方用户脚本各自保留原许可证与作者信息（GPL-3.0 / MIT）。DouYinPlus 与 SmartFeed 因许可证不明未包含在仓库中，需要时请从原作者处获取。
