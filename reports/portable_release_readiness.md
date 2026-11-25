# 便携包发布前验收（portable_release_readiness）

日期：2026-11-25　对象：`Douyin-Web-Desktop-Portable.zip`
结论：**不建议现在发布**。核心功能在包内运行时下已跑通，但「便携包在自己电脑上首次启动」有两个环节无法在当前环境验证，需你本机 5 分钟冒烟后再发。

---

## 一、用户数据目录（重点）

### 现象与定位

| 实验 | 结果 |
|---|---|
| shell `touch %LOCALAPPDATA%\DouyinWebDesktop\t3.txt` | **OK** |
| 系统 node 写同目录 `t1.txt` | **OK** |
| 便携 `runtime\node.exe` 写同目录 `t2.txt` | **EPERM** |
| 系统 node 跑 `app/launcher.js` | 目录 + `launcher.log` + `profile` **创建成功** |
| 便携 node 跑 `app/launcher.js`（数据目录指向 D 盘） | 完整跑通（见第二节） |

**结论**：同一目录、同一用户、同一时刻，唯一变量是可执行文件 —— 便携 `node.exe` 被当前 Agent 沙箱判定为"派生可执行文件"而禁止写入用户目录。**这是本机测试环境的限制，不是包或代码的缺陷**；同机系统 node 用同一份 launcher.js 能正常创建 `%LOCALAPPDATA%\DouyinWebDesktop`。

### 已采取的设计

- 数据目录：`%LOCALAPPDATA%\DouyinWebDesktop`（profile / launcher.log / download-preferences.json）
- 若创建失败：自动回退到 `<解压目录>\data`，并在日志里写明 —— **不会静默写进解压目录**（回退路径有明确日志）
- 升级不覆盖：数据目录与程序目录分离，覆盖程序文件不会动 profile

### 未验证

- 便携 node 在**真实用户双击**场景下写 AppData（本轮只能证明代码正确，证明不了运行时不受限）
- 系统 node 在 `%LOCALAPPDATA%` profile 下启动 Chrome：报 `Failed to create a ProcessSingleton for your profile directory`，未查明（疑似同一环境限制或残留锁）

## 二、登录态持久化

**未完成**：需要真人扫码登录，本轮没有做。
已验证的部分：profile 目录会在首次启动时创建（系统 node 场景）；数据目录与程序目录分离，替换程序文件不会删除 profile。
未验证：关闭→重启后登录是否保留、替换文件后是否保留。

## 三、干净环境

| 项 | 状态 |
|---|---|
| 只用包内 node（不碰系统 node） | ✅ 已验证（D 盘数据目录一轮全程用 `runtime\node.exe`） |
| 只用包内 Chromium | ✅ 已验证（`executablePath` 指向 chrome-win64，日志正常） |
| 中文 + 空格路径 | ✅ 已验证（`<测试目录>`） |
| 无 Node 的干净系统 | ❌ **未验证**（本机装有 node） |
| 无 Playwright/无全局 npm | ✅ 结构上不依赖（require 指向包内），未在干净系统实测 |
| 异机部署 | ❌ **未验证** |

## 四、交付完整性

| 项 | 值 |
|---|---|
| ZIP | `<项目根>-Portable.zip` |
| 大小 | 253,420,242 B（241.7 MB） |
| SHA-256 | `56f6eb101b1b5f7b55653982dd36e93339796b9930badcbc3c6ab7d9ecb42ed6` |
| 文件数 | 499（SHA256SUMS.txt 499 行） |
| 逐文件校验 | 解压后 **499 OK / 0 失配** |
| 正式环境 | launcher.js `c1160d8f…`、nav.js `374c8bb8…`、原 DouyinLaunch.exe `f2188eed…` —— 均未改动 |
| 原启动器备份 | `Douyin-Web-Desktop\backups\DouyinLaunch.exe.orig-20261125.bak`，sha `f2188eed…` 与原件一致 |
| 测试残留 | `%LOCALAPPDATA%\DouyinWebDesktop` 已删除；测试目录已删；正式 `%LOCALAPPDATA%\DouyinApp` 未被触碰 |

## 五、发布决策

### 已通过
ZIP 完整性、包内运行时可用、中文空格路径、脚本注入 9 个、下载面板挂载、导航隐藏 4 项、不依赖系统 Node/Chrome（结构+实测）、原环境零改动。

### 未通过
无（没有出现"做了但失败了"的项）。

### 未验证（阻塞发布的关键两项）
1. 真实用户双击后 `%LOCALAPPDATA%\DouyinWebDesktop` 能否自动创建
2. 登录后关闭再打开，登录态是否保留

### 已知风险
- 体积 241.7 MB（chrome.dll 302 MB 压缩率有限；裁剪会让有头模式启动失败，已实测）
- 杀软对 node.exe / 无签名 exe / chrome-for-testing 的启发式误报
- 若真实机器上 AppData 也写不了，会回退到解压目录 `data\`（能跑，但不便携）

### 建议
**先不要发 Release。** 请在你自己电脑上做一次 5 分钟冒烟（不要用我这边的测试环境）：

1. 解压 zip 到任意目录（中文/空格路径更好）
2. 双击 `DouyinLaunch.exe`
3. 确认窗口出现、左侧只剩 6 个入口、右下有下载按钮
4. 看 `%LOCALAPPDATA%\DouyinWebDesktop\launcher.log` 是否生成、里面有没有 `init: nav + early[...]` 和 `v3.3 button mounted`
5. 关掉窗口，再双击一次，确认不用重新登录

这 5 步过了，两个未验证项就闭环，可以发 `v1.1.0-portable`。哪一步不对，把日志尾部发我，我按真实报错修。
