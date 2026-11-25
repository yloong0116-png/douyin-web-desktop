# 便携版交付报告（portable_delivery_report）

日期：2026-11-25　版本：1.1.0-portable　基线：Douyin-Web-Desktop 1.0.3（userscript v3.3）

## 1. 最终目录结构

```
Douyin-Web-Desktop-Portable/       554 MB / 499 文件
├─ DouyinLaunch.exe        6.1 KB   csc 编译，读自身目录，Mutex 单实例，失败弹窗
├─ README.txt              普通用户说明（解压/启动/登录/下载/升级/备份/退出/卸载/杀软）
├─ VERSION.txt             版本与运行时信息
├─ SHA256SUMS.txt          499 行
├─ runtime/                102 MB
│  ├─ node.exe             84 MB（Node v22.23.4 官方单文件）
│  └─ node_modules/        playwright 5 MB + playwright-core 14 MB
├─ browser/chrome-win64/   452 MB（Chrome for Testing 158.0.8127.18，chromium-1254，完整未裁剪）
└─ app/
   ├─ launcher.js          16.9 KB（路径可移植化 + 数据目录隔离 + 浏览器指向）
   ├─ nav.js、save-core.js
   ├─ userscripts/         9 个 .js
   └─ assets/douyin.ico、Launch.cs（启动器源码，便于复现）
```

ZIP：`<项目根>-Portable.zip`　**253,420,242 B（241.7 MB）**
SHA-256：`56f6eb101b1b5f7b55653982dd36e93339796b9930badcbc3c6ab7d9ecb42ed6`
解压校验：**499 项全部 OK，0 失配**（解压后逐文件比对 SHA256SUMS.txt）

## 2. 修改文件清单

| 文件 | 性质 |
|---|---|
| `Douyin-Web-Desktop-Portable/`（新目录） | 全新便携构建，不改动原项目 |
| `app/launcher.js` | 由交付版派生：路径层改造（见下） |
| `app/Launch.cs` → `DouyinLaunch.exe` | 新写 60 行 C# 启动器，替换原硬编码 exe |
| 原 `DouyinLaunch.exe` | 已备份至 `Douyin-Web-Desktop/backups/DouyinLaunch.exe.orig-20261125.bak`（sha `f2188eed…`） |

**未改动**：`launcher.js` 的业务逻辑（下载/绑定/日志文案）、`nav.js`、全部 userscript、原项目目录、Git 仓库、Release。

## 3. 每项修改的原因

| 改动 | 原因 |
|---|---|
| 启动器重编译 | 原 exe 的 UTF-16 字符串写死 `%LOCALAPPDATA%\...\node.exe`、`...\DouyinApp\launcher.js`，换机换目录必挂 |
| `ROOT` 用 `DY_PORTABLE_ROOT` / `__dirname` | 支持任意目录、中文、空格 |
| `require(路径 playwright)` | 不再依赖目标机 npm |
| `executablePath` 指向 `browser\chrome-win64\chrome.exe` | 不依赖系统 Chrome；找不到才退回 `channel:'chrome'` |
| 数据目录 → `%LOCALAPPDATA%\DouyinWebDesktop` | 升级不覆盖登录态；失败时回退到 `ROOT\data`（受限环境） |
| 单实例 Mutex | 重复双击不再开第二个实例 |
| 失败弹窗 | 普通用户看得懂 + 给日志路径 |
| **保留 `--no-sandbox`** | 实测移除后 Chrome 启动即崩（受限环境下必需），便携版优先兼容 |

## 4. 依赖与运行时

| 组件 | 版本 | 是否随包 |
|---|---|---|
| Node.js | v22.23.4 | ✅ runtime/node.exe |
| playwright / playwright-core | 1.65.0 | ✅ runtime/node_modules |
| Chrome for Testing | 158.0.8127.18 (chromium-1254) | ✅ browser/chrome-win64 |
| 系统 Chrome / Node / npm | — | ❌ 不需要 |

## 5–6. 产物

见第 1 节（ZIP 241.7 MB，sha `56f6eb10…`）。

## 7. 测试项目与真实结果

| 测试 | 结果 | 说明 |
|---|---|---|
| 中文 + 空格路径启动 | ✅ 通过 | 复制到 `<测试目录>` 后启动成功 |
| 不依赖系统 Node | ✅ 通过 | 全程用 `runtime\node.exe` 执行，系统 node 未参与 |
| 不依赖系统 Chrome | ✅ 通过 | `executablePath` 指向包内 chrome-win64，日志显示窗口正常 |
| 脚本注入 | ✅ 通过 | 日志 `init: nav + early[5个] late[4个]` |
| 下载面板 / 导航隐藏 | ✅ 通过 | `v3.3 button mounted`、`nativenav ready containers=1 hidden=4` |
| 独立 Profile 隔离 | ✅ 通过 | 数据目录指向 D 盘 temp，正式环境 `%LOCALAPPDATA%\DouyinApp` 未触碰 |
| ZIP 完整性 | ✅ 通过 | 解压后 499 文件全部哈希一致 |
| **无 Node 的干净系统** | ❌ **未验证** | 本机装有 node；虽未使用它，但无法证明"机器上没有 node 也能跑" |
| **`%LOCALAPPDATA%\DouyinWebDesktop` 创建** | ❌ **未验证** | 当前 Agent 环境对派生进程的 AppData 写入返回 EPERM（同机系统 node 可以，便携 node 不行），代码已加回退到 `ROOT\data` |
| 登录态跨重启保留 | ❌ 未验证 | 未做"登录→关闭→重开"往返 |
| 异机部署 | ❌ 未验证 | 无第二台机器 |

## 8. 未解决问题

1. **体积 241 MB**：`chrome.dll` 302 MB 压缩率有限。尝试裁剪 `locales`/`setup.exe` 会导致有头模式启动失败（已实测），因此保持完整。
2. **杀软误报**：便携 node + 无签名 exe + chrome-for-testing 三者叠加易被启发式拦截。README 已给"先校验哈希再单独放行"的做法，明确不要求关闭 Defender。
3. **AppData 写入未实测**：见第 7 节，属测试环境限制。
4. 导航返回整页重载（老问题，与便携化无关）。

## 9. 回滚

- 便携包本身：直接删目录/删 ZIP 即可，不影响任何已有环境。
- 若要恢复原启动器：`copy /y "%LOCALAPPDATA%\DouyinApp\..\DouyinApp\DouyinLaunch.exe.orig"` —— 实际备份在
  `<项目根>\backups\DouyinLaunch.exe.orig-20261125.bak`，
  复制回 `%LOCALAPPDATA%\DouyinApp\DouyinLaunch.exe` 即可。
- 原项目、Git 仓库、Release 均未改动，无需回滚。

## 10. 普通用户使用说明

见包内 `README.txt`（十节：解压 / 启动 / 登录 / 下载位置 / 升级 / 备份登录 / 彻底退出 / 卸载 / 杀软 / 常见问题）。
