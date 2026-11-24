# 安装（Windows 11，全新机器）

> 前提：你有管理员权限；系统已连网；抖音账号自备。

## 1. 环境要求

| 项 | 要求 |
|---|---|
| 系统 | Windows 11 x64（Windows 10 未验证） |
| 磁盘 | ≥ 2 GB（含浏览器与 Profile） |
| Node.js | **20 LTS 或更高** |
| 浏览器 | Chrome 158 或 Playwright 自带 Chromium |
| 网络 | 能访问 www.douyin.com（如需代理自行配置系统代理） |

## 2. 安装 Node.js

```powershell
winget install OpenJS.NodeJS.LTS
# 若没有 winget：到 https://nodejs.org 下载 LTS 的 .msi 安装
node -v      # 期望 v20.x 或更高
npm -v
```

## 3. 解压项目

```powershell
$dst = "$env:LOCALAPPDATA\DouyinApp"
New-Item -ItemType Directory -Force $dst | Out-Null
Expand-Archive -Path ".\Douyin-Web-Desktop-Handoff.zip" -DestinationPath $dst -Force
cd $dst
```

解压后应看到 `launcher.js`、`nav.js`、`userscripts\`、`package.json`。

## 4. 安装依赖

```powershell
cd "$env:LOCALAPPDATA\DouyinApp"
npm install
```

`npm install` 会装 `playwright@^1.65.0`（约 50 MB）。若想用 Playwright 自带 Chromium：

```powershell
npx playwright install chromium
```

本机若已装 Chrome 158，`channel:'chrome'` 会直接用系统 Chrome，可跳过上一步。

## 5. 配置（可选）

复制示例配置：

```powershell
Copy-Item .\download-preferences.example.json .\download-preferences.json
```

键说明见 [CONFIGURATION.md](CONFIGURATION.md)。

## 6. 下载目录

默认 `D:\Media\Douyin`，首次下载自动创建。想改路径用环境变量：

```powershell
setx DY_SAVE_DIR "E:\Douyin"
```

## 7. 首次运行

```powershell
cd "$env:LOCALAPPDATA\DouyinApp"
node launcher.js
```

预期：弹出无地址栏的抖音窗口，`launcher.log` 出现 `init: nav + early[...] late[...]`。

## 8. 登录抖音

在窗口内点右上角「登录」，扫码登录一次即可（登录态存进 `profile\`，之后免登录）。

## 9. 创建桌面快捷方式

```powershell
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$env:USERPROFILE\Desktop\抖音.lnk")
$s.TargetPath = "$env:LOCALAPPDATA\DouyinApp\node-launch.vbs"
$s.WorkingDirectory = "$env:LOCALAPPDATA\DouyinApp"
$s.IconLocation = "$env:LOCALAPPDATA\DouyinApp\douyin.ico"
$s.Save()
```

`node-launch.vbs` 用于无黑框启动（见交付包内同名文件）；也可直接：

```powershell
$s.TargetPath = "node.exe"
$s.Arguments = "\"$env:LOCALAPPDATA\DouyinApp\launcher.js\""
```

## 10. 升级

1. 备份 `profile\` 目录与 `download-preferences.json`
2. 覆盖新版本文件（保留 `profile\`、`node_modules\`、`download-preferences.json`）
3. `npm install` 补齐依赖
4. 重启应用

## 11. 卸载

```powershell
Remove-Item "$env:LOCALAPPDATA\DouyinApp" -Recurse -Force   # 会连登录态一起删
Remove-Item "$env:USERPROFILE\Desktop\抖音.lnk" -Force
```

## 12. 常见问题

见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。
