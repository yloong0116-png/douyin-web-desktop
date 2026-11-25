# 音频播放故障调查（2026-11-25）

症状：有声时视频卡住；静音可正常播放；播放中取消静音又卡住。
调查方式：全程只读（服务/设备/进程/注册表/脚本源码/日志），未改任何配置。

## 0. 结论速览

**最可能是 Chromium 的音频输出链路在真实设备上建立后无法稳定推进**（audio renderer 卡在 waiting/underrun，video 被 audio clock 拖着不走）。静音时 Chrome 不需要真实音频输出，所以能播。

不是 userscript 干扰（已排除），不是 Chrome 启动参数（已排除），不是 Windows 音频服务停摆（已排除），也不是设备缺失。

## 1. 已实测事实

| 检查项 | 结果 | 判定 |
|---|---|---|
| `Audiosrv` | STATE 4 RUNNING | 正常 |
| `AudioEndpointBuilder` | STATE 4 RUNNING | 正常 |
| `audiodg.exe` | 存在（1 个） | 音频引擎在跑 |
| Chrome audio service 进程 | `audio.mojom.AudioService` ×1 | 在跑，未崩溃 |
| Chrome 启动参数 | 无 `--mute-audio`、无 `--disable-audio-output`、无音频相关 `--disable-features` | 排除参数问题 |
| Chrome 版本 | **158.0.8127.37**（此前记录为 .36） | 重启前后发生了小版本自动更新 |
| 渲染端点 | 「扬声器 (Senary Audio)」OK、「扬声器 (HECATE G2 GAMING HEADSET)」OK、蓝牙 Baseus 为 Unknown(未连) | 两个活动端点并存 |
| 系统事件日志（近 3 天，Audio/HDAudio/Kernel-PnP 的 Error/Warning） | **空** | 无驱动级报错 |
| 脚本对音频 API 的调用 | `grep .muted / .volume / setSinkId / AudioContext` 在 9 个脚本中**零命中** | userscript 干扰排除 |
| 页面日志 | 无 `MEDIA_ERR_*`、无 decode 相关 | 解码层未见异常 |

## 2. 关键对照逻辑

静音 / 非静音在这套链路里的差别只有一处：

```
静音：video 元素 muted=true → Chrome 不向真实输出设备建立音频流（或走空输出）
有声：video 元素 muted=false → Chrome 必须建立 AudioOutputStream → 对接 Windows endpoint
```

有声卡住、静音正常 ⇒ 问题在「建立/驱动真实音频输出」这一步，而不在解码、不在视频渲染、不在网络。

`audio.mojom.AudioService` 进程存在但只有一个，说明服务本身没崩；更可能是它建立了 stream 却推进不了（underrun / device clock 不动 / 端点被切走）。

## 3. 三个可能根因（按证据强度）

### ① USB 耳机端点（HECATE G2）音频流推进异常 —— 最可能

- 支持：系统里同时有板载「扬声器 (Senary Audio)」和 USB「扬声器 (HECATE G2)」两个 ACTIVE endpoint；USB 声卡常出现采样率不匹配、hub 供电不足、驱动缓冲过小导致的持续 underrun，表现正是「一出声就卡、静音正常」
- 支持：症状与「audio clock 不动 → video 等待」完全吻合
- 反对：系统日志无 USB/音频错误；`Get-PnpDevice` 显示该设备 Status=OK
- 缺验证：不知道 Windows **默认输出设备**究竟是哪一个；没读 `chrome://media-internals` 的实际 pipeline 状态

### ② Chrome 音频服务与端点格式不匹配 —— 次可能

- 支持：Chrome 在重启前后从 `8127.36` 自动更新到 `8127.37`
- 支持：新版本若改变了音频输出默认参数（如强制某一采样率），旧端点可能协商失败
- 反对：patch 级更新通常不涉及音频管线；且当前 audio service 进程正常运行
- 缺验证：`chrome://gpu`、`chrome://media-internals` 未读；无 Chrome 侧 stderr

### ③ 默认设备在「耳机/扬声器」之间被系统切换 —— 较弱

- 支持：存在 4 个音频设备（含 NVIDIA Virtual Audio），切换后 Chrome 需要重建 stream，重建失败会卡住当前播放
- 反对：切换通常只导致短暂无声，不至于持续卡死；系统日志无端点切换记录
- 缺验证：默认设备 GUID 与切换历史未取到（需要读 HKCU PolicyConfig，未做）

**明确排除**：Windows 音频服务停止、设备被禁用/拆除、Chrome 带静音参数、userscript 改 muted/volume/setSinkId、视频解码失败、多实例竞争（那是上一份报告的问题，与音频无关）。

## 4. 尚未验证（需要你做，都是只读/可回退的小操作）

1. 打开 `chrome://media-internals`（在普通 Chrome 里开一个标签即可，不影响本应用），有声播放时看 `audio_renderer` 的 `state` 与 `audio_output_device` 名称。
2. `chrome://gpu` 里 `Audio` 相关行是否报错。
3. **关键对照**：把 Windows 默认播放设备临时切到「扬声器 (Senary Audio)」板载，重启应用看是否恢复。这一步能直接证伪/证实根因①。
4. 若切到板载就好了，再用 HECATE 单独测一次，确认是耳机端点问题。

## 5. 最小修复方案（本轮不执行）

按风险从低到高，**都不动代码、不动 userscript、不动下载/识别/导航**：

1. **配置层（零风险，先试）**：把默认播放设备设为板载「扬声器 (Senary Audio)」。若恢复，问题定位在 USB 耳机端点。
2. **USB 耳机侧**：换到主板后置 USB 口（不经 hub），或在「声音设置 → 该设备 → 高级」把默认格式降到 `16 位 48000 Hz`。
3. **Chrome 侧兜底（需批准改启动参数）**：给 `launcher.js` 的 args 加 `--disable-features=AudioServiceOutOfProcess`，让音频回到浏览器进程，绕开 utility 进程与端点的协商问题。这是参数级改动，可一行回滚。
4. 不建议：改 userscript、重置 Profile、清缓存 —— 没有任何证据指向它们。

## 6. 结论

故障定位在**音频输出链路**，解码、视频渲染、网络、脚本都已排除。最可能是 USB 耳机端点（HECATE G2）作为默认输出时无法稳定推进音频时钟。

**下一句话就能验证**：把 Windows 默认播放设备切成板载「扬声器（Senary Audio）」，重启应用，看有声能不能播。能播 ⇒ 根因①；仍不能 ⇒ 我按 `media-internals` 的实际报错继续查（那时需要你把那个页面的 `audio_renderer` 段截图给我）。
