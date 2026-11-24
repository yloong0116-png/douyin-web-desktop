# Douyin Web Desktop

把抖音网页版（www.douyin.com）包装成一个独立桌面应用的 Windows 启动器：独立浏览器 Profile、无地址栏、按顺序注入用户脚本、内置下载面板。

不是抖音官方客户端，不修改抖音服务端，只在自己的浏览器里加载网页并注入本地脚本。

## 快速开始（新机器）

```powershell
# 1. 安装 Node.js 20 LTS（自带 npm）
winget install OpenJS.NodeJS.LTS

# 2. 解压交付包到 %LOCALAPPDATA%\DouyinApp
# 3. 安装依赖
cd "$env:LOCALAPPDATA\DouyinApp"
npm install

# 4. 首次运行
node launcher.js
```

详细步骤见 [docs/INSTALLATION.md](docs/INSTALLATION.md)。

## 目录

| 路径 | 内容 |
|---|---|
| `app/launcher/launcher.js` | 主程序：启动 Chromium、注入脚本、下载面板后端 |
| `app/launcher/nav.js` | 注入到页面的返回按钮 / Alt+←（原版，未启用候选补丁） |
| `app/launcher/save-core.js` | 下载核心工具函数 |
| `app/userscripts/` | 页面运行的用户脚本，按文件名排序加载 |
| `app/config/` | 配置模板（示例文件，不含个人数据） |
| `app/assets/` | 图标等资源 |
| `docs/` | 架构、安装、配置、功能、排障、开发、测试、已知问题、第三方依赖 |
| `reports/` | 本次开发的技术调查报告 |
| `manifests/` | 文件哈希、功能状态、依赖清单、续作档案 |
| `backups/` | 历史稳定版本备份 |

## 状态

- 版本：1.0.0
- 平台：Windows 11（Windows 10 未验证）
- 浏览器：Chrome 158 / Playwright 1.65
- 已知故障：从个人主页返回推荐页会整页重载（见 [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)）

## 许可

本项目自有代码见 [LICENSES.md](LICENSES.md)；内置第三方用户脚本各自保留原许可证与作者信息。
