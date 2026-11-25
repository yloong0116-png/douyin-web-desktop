# Douyin Web Desktop

把抖音网页版（www.douyin.com）包装成独立桌面窗口的 Windows 工具：无地址栏、独立 Profile、按序注入用户脚本、内置六类资源下载面板。

不是抖音官方客户端，不修改抖音服务端。

---

## 下载即用（推荐）

**[⬇ 下载 Douyin-Web-Desktop-Portable.zip](https://github.com/yloong0116-png/douyin-web-desktop/releases/latest)**（约 242 MB）

三步：

1. 解压到任意目录（中文、空格路径都可以）
2. 双击 `DouyinLaunch.exe`
3. 首次使用点右上角「登录」扫码

**不需要**安装 Node.js、Chrome、Playwright 或任何依赖 —— 运行时和浏览器都在包里。

ZIP SHA-256：`56f6eb101b1b5f7b55653982dd36e93339796b9930badcbc3c6ab7d9ecb42ed6`
包内 499 个文件的哈希见 `SHA256SUMS.txt`。

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
- **全屏优化、倍速、画质**（依赖注入的第三方脚本）
- **单实例**：重复双击不会开第二个

## 已知问题

**返回上一页会重新加载推荐流。** 抖音主文档带 `Cache-Control: no-store`，浏览器无法缓存页面（BFCache 永不生效），跨文档返回必然重新请求。已验证：移除 `--disable-back-forward-cache` 启动参数无效。彻底解决需要把 `/user/` 的进出改成站内 SPA 路由，目前未做。

其他未验证项见 [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md)。

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
| `app/userscripts/` | 9 个用户脚本，按文件名排序注入 |
| `docs/` | 架构、安装、配置、功能、排障、已知问题、第三方依赖 |
| `reports/` | 技术调查记录（下载系统、导航改造、BFCache 对照实验、便携化审计） |
| `manifests/` | 文件哈希、功能状态、依赖清单、项目续作档案 |
| `releases/` | 交付包（ZIP 另见 Release 页） |

接手开发先读 [`manifests/PROJECT_STATE.md`](manifests/PROJECT_STATE.md)。

## 许可

本项目自有代码见 [`LICENSES.md`](LICENSES.md)；内置第三方用户脚本各自保留原许可证与作者信息（10/11 为 GPL-3.0，15 为 MIT）。DouYinPlus 与 SmartFeed 因许可证不明未包含在仓库中，需要时请从原作者处获取。
