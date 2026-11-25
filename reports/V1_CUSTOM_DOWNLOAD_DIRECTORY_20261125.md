# V1 自定义下载保存位置（2026-11-25）

状态：**代码已实现并安装，静态检查通过；真实运行验证待用户执行**（对话框交互无法由 Agent 代点）。

---

## 1. 原有下载机制调查（代码审查）

| 项 | 结论 |
|---|---|
| 下载方式 | **Node.js 直接写盘**：`download()` 里 `fetch(url)` → `Buffer` → `fs.writeFileSync(file, b)`，**不走 Chromium 下载事件** |
| 默认位置 | `const SAVE_DIR = process.env.DY_SAVE_DIR \|\| 'D:\\Media\\Douyin'` |
| 保存路径入口 | 仅 `__dySave` 一处：`fs.mkdirSync(SAVE_DIR)` + 4 处 `path.join(SAVE_DIR, name)` |
| 六类资源 | **共用同一 job 循环**：`buildJob()` 产出 `{k, url, ext, seq, tag}`，逐个 `download()` 写盘；文案走 `fs.writeFileSync(dir, stem + '.txt')`。改一处即全生效 |
| 配置存储 | `download-preferences.json`（与 `launcher.log` 同目录，即 `%LOCALAPPDATA%\DouyinApp`） |
| 与独立下载器仓库 | 两者**代码不共享**：V1 是 Node 侧写盘，独立仓库（douyin-video-downloader）是 `GM_download`，各自独立。本次只改 V1 |

## 2. 实现方案

```
页面（16-save-video.js 设置面板）
  ├─ 显示 window.__DVD_SAVE_DIR（启动时注入的当前路径）
  ├─ 点「更改文件夹」→ window.__dyPickDir()
  │     → launcher: PowerShell FolderBrowserDialog（-STA 单线程，原生对话框）
  │     └─ 用户取消 → 返回 null → 页面提示「已取消，未修改」
  └─ 返回路径 → window.__dySetDir(p)
        → launcher: mkdir + access(W_OK) + 写探针文件删除
        ├─ 失败 → {ok:false, err: 错误码} → 页面 toast 明确原因
        └─ 成功 → 写入 prefs.saveDir → {ok:true, dir}
```

下载时：`__dySave` 开头 `const dir = resolveSaveDir()`，**任务开始即固定**，下载过程中改设置不影响本次写入。

`resolveSaveDir()` 优先级：`prefs.saveDir` → `DY_SAVE_DIR` 环境变量 → `D:\Media\Douyin`（原默认值不变）。

## 3. 修改文件

| 文件 | 改动 |
|---|---|
| `launcher.js`（运行目录 / 项目 / 便携包，共 3 份） | `SAVE_DIR` 常量 → `resolveSaveDir()`；4 处引用改局部 `dir`；新增 `__dyPickDir` / `__dySetDir` 两个 binding；`normalizePrefs` 透传 `saveDir`；启动时注入 `__DVD_SAVE_DIR` |
| `16-save-video.js`（同 3 份） | 设置面板新增「保存位置」区块：当前路径 + 「更改文件夹」按钮 |

版本控制：`9ef9b70` → `33bfc06`（仅这两个提交涉及本功能）。工作树已提交、干净。

## 4. 配置存储

```json
{
  "media": true, "music": false, "cover": false, "music_cover": false,
  "avatar": false, "text": false,
  "saveDir": "D:\\"
}
```

`saveDir` 只在用户实际选择过之后才写入；未设置时沿用原默认路径。文件损坏 → `readPrefs` 已有 try/catch 回退默认，`saveDir` 缺失即走默认，不会崩。

## 5. 异常处理（代码审查）

| 情况 | 行为 |
|---|---|
| 用户取消 | 返回 `null`，页面提示「已取消，未修改」，路径不变 |
| 文件夹不存在 | `mkdirSync(recursive)` 自动创建 |
| 无写权限 | `accessSync(W_OK)` 抛错 → 返回 `EACCES` → 页面提示具体错误码 |
| 磁盘不可用 | `mkdir` 抛 `ENOENT/ENOSPC` → 同样返回错误码 |
| 下载中目录失效 | `download()` 已有 try/catch，单个资源失败记 `fail` 不中断其他；文件不落盘时日志明确 `fail <kind> <err>` |
| 配置损坏 | 回退默认值（原有逻辑） |

## 6. 真实运行验证

**未执行。** 需要你在客户端里点：

1. 点右下角 ⚙（设置）→ 看是否出现「保存位置」+ 当前路径（初始应为 `D:\Media\Douyin`）
2. 点「更改文件夹」→ 应弹出 Windows 原生文件夹选择框
3. 选一个新目录 → 面板路径立即更新，并提示「已保存到 …」
4. 下载一个视频 → 文件应出现在新目录
5. 关掉客户端重开 → 设置面板仍显示新路径
6. 再下载一次 → 仍进新目录
7. 点「更改文件夹」后直接取消 → 路径不变

我没有在对话框里替你点，所以 2–7 项都标为**未验证**。

## 7. 便携版兼容性

三份代码同步改了（运行目录 / 项目源码 / 便携包），便携 ZIP 已重打（253,421,599 B），但**未启动便携版实测**——它和桌面版共用同一套逻辑，风险主要在 PowerShell 对话框在便携环境下能否正常弹出（该 exe 无特殊权限要求，预期正常）。

## 8. 未解决问题

1. 真实交互未验证（上述 7 步）
2. 便携版未实测
3. 未发 Release（等实测通过）

## 9. 回滚

```powershell
cd <项目根>
git revert 33bfc06 --no-edit
```
运行目录与便携包需单独恢复（各自 launcher.js / 16-save-video.js）：
- 运行目录：`%LOCALAPPDATA%\DouyinApp\launcher.js` 与 `userscripts\16-save-video.js`
- 便携包：`Douyin-Web-Desktop-Portable\app\launcher.js` 与 `app\userscripts\16-save-video.js`

回滚后重启客户端，`download-preferences.json` 里的 `saveDir` 字段会被忽略（旧代码不读），其余配置不受影响。
