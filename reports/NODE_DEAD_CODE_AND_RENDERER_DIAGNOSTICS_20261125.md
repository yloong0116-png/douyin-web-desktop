# Node 死代码清理 + Renderer 媒体诊断（2026-11-25）

V1 项目：`<项目根>`（源码）+ `%LOCALAPPDATA%\AppData\Local\DouyinApp`（运行目录）
未触碰 V2。未提交 Git。

---

## 1. 修改文件与 SHA-256

| 文件 | 修改前 | 修改后 | 删除量 |
|---|---|---|---|
| 运行版 `DouyinApp\launcher.js` | `c1160d8fd56d0b95…` | `6be9d9e964f60150…` | 502 字符 / 16 行 |
| 项目版 `app\launcher\launcher.js` | `c621bd542c34dea6…` | `92c2191feda16fe9…` | 502 字符 / 16 行 |

备份：`launcher.js.deadcode-20261125.bak`（两处各一份，与原文件同目录）

## 2. 删除范围与引用搜索

删除的完整代码块（113–127 行，含注释）：

```js
  // 播放流记录：仅用于诊断与兜底，不再作为"当前作品"依据
  const mediaLog = [];
  ctx.on('request', (req) => {
    try {
      const u = req.url();
      if (!/^https?:/.test(u)) return;
      if (/douyinvod|\.mp4|video\/tos/i.test(u) && !/.../.test(u)) {
        const last = mediaLog[mediaLog.length - 1];
        if (last && last.u === u) return;
        mediaLog.push({ u: u, t: Date.now() });
        if (mediaLog.length > 40) mediaLog.shift();
      }
    } catch (e) {}
  });
```

引用搜索（`grep -rn mediaLog --include=*.js`，项目 + 运行目录，排除 node_modules）：

| 位置 | 结果 |
|---|---|
| 项目版 launcher.js | 4 处，全部在本块内 |
| 运行版 launcher.js | 4 处，全部在本块内 |
| `launcher.v2.js` | 4 处，但那是**历史备份文件**，不被加载，未动 |
| userscripts / 其他脚本 | **0 处** |
| 删除后复查 | `mediaLog` 引用 = 0，`ctx.on('request')` = 0 |

结论：无消费方。它只写日志用，注释里也写明"不再作为当前作品依据"；下载走 `__dySave` + 快照，与此监听无关。

## 3. Node 内存前后对照（严格同条件）

条件：同样杀进程 → `Start-Process DouyinLaunch.exe` → 等 25 秒 → 每 5 秒采样，共 6 次（30 秒）。

**BEFORE-FRESH**

```
ws=107 priv=115 h=230 t=17 cpu=2.0
ws=115 priv=124 h=230 t=14 cpu=2.4
ws=116 priv=125 h=230 t=14 cpu=2.4
ws=115 priv=123 h=230 t=14 cpu=2.5
ws=114 priv=122 h=230 t=14 cpu=2.5
ws=114 priv=122 h=230 t=14 cpu=2.5
```

**AFTER-FRESH**

```
ws=84 priv=91  h=230 t=17 cpu=1.2
ws=86 priv=92  h=229 t=14 cpu=1.3
ws=89 priv=96  h=229 t=14 cpu=1.5
ws=90 priv=96  h=229 t=14 cpu=1.5
ws=90 priv=96  h=229 t=14 cpu=1.6
ws=90 priv=96  h=229 t=14 cpu=1.7
```

| 指标 | 改前（末值） | 改后（末值） | 变化 |
|---|---|---|---|
| Working Set | 114 MB | 90 MB | **-21%** |
| Private Bytes | 122 MB | 96 MB | **-21%** |
| 30 秒 CPU | 2.5 s | 1.7 s | **-32%** |
| Handles | 230 | 229 | 持平 |

**注意（不夸大）**：这组数据是"启动后 30 秒"的对照，证明的是**监听回调的基础开销**被消除了。长时间（数小时）的差异本次**没有测**——理论上差距会更大（每请求都触发 vs 完全不触发），但没有实测数据，不作为结论。

## 4. 静态检查

- `node --check` 两个文件均通过
- 删除后 `mediaLog` / `ctx.on('request')` 引用数为 0
- 其余监听器（`page.on('console')`、`framenavigated`、`ctx.on('page')`、`close`）未动
- 下载逻辑、`exposeBinding`、浏览器上下文、窗口生命周期未动
- 应用重启后日志正常：`init: nav + early[...] late[...]`、`v3.3 button mounted`、`nativenav ready ... hidden=4`

## 5. Renderer 媒体诊断：尝试过程与结果

### 已验证可行（独立实例，非正式页面）

| 尝试 | 结果 |
|---|---|
| `page.goto('chrome://media-internals')` | **成功**，title = "Media Internals" |
| CDP `Media.enable` | **成功** |
| 加载抖音后监听 `Media.playerPropertiesChanged` | **收到 1 个事件**，含 15 个属性字段 |

说明：当前 Chromium 158 + Playwright 1.65 **完全支持**读取媒体管线，技术上没有障碍。

### 阻碍：接不到正式实例

- 正式实例由 Playwright 以 `--remote-debugging-pipe` 启动，**没有 TCP 端口**，外部无法建立 CDP 会话
- 独立实例能拿数据，但它不是同一个页面（无登录态），测不到那 4.3 GB 的真实持有情况

### 结论

**未完成**。不是能力问题，是接入问题。三条路径，都需要你决定：

1. **手动（零代码，最快）**：在 app 窗口按 `F12` → DevTools 右上角 `⋮` → More tools → **Media**，面板会显示当前播放器的 pipeline、decoder、buffer 大小。截图给我即可。
2. **临时端口（需改启动参数）**：给 launcher 加 `--remote-debugging-port` 条件开关，我用 CDP `Media` domain 采数据。**任务禁止本轮修改启动参数**，所以未做。
3. **诊断代码（需改 launcher）**：在 launcher 里加一段仅 `DY_DIAG=1` 时启用的 CDP `Media` 采集。属于新增代码，需另行批准。

## 6. 未完成事项

1. Renderer 4.3 GB 的持有者**尚未确定**（媒体管线数据未取到）
2. Node 长时间（数小时）的差异未测
3. 未验证删除监听后，`mediaLog` 相关的调试能力损失是否可接受（该能力本来就没有消费方）

## 7. 回滚

```powershell
copy /y "%LOCALAPPDATA%\DouyinApp\launcher.js.deadcode-20261125.bak" "%LOCALAPPDATA%\DouyinApp\launcher.js"
copy /y "<项目根>\app\launcher\launcher.js.deadcode-20261125.bak" "<项目根>\app\launcher\launcher.js"
```
回滚后重启应用。SHA 应回到 `c1160d8f…`（运行版）/ `c621bd54…`（项目版）。
