# 配置

## download-preferences.json

位置：项目根目录，与 `launcher.js` 同级。

```json
{ "media": true, "music": false, "cover": false, "music_cover": false, "avatar": false, "text": false }
```

| 键 | 含义 | 默认 |
|---|---|---|
| media | 视频 / 图文（多图作品会存成 `_01.jpg`、`_02.jpg`…） | true |
| music | 原声 mp3 | false |
| cover | 作品封面图 | false |
| music_cover | 音乐封面图 | false |
| avatar | 作者头像 | false |
| text | 作品文案 `.txt` | false |

缺失、损坏、类型不对都会回退到上表默认值，并在日志里记一条 `prefs: read fallback`。

## 环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `DY_SAVE_DIR` | 下载保存目录 | `D:\Media\Douyin` |
| `DY_LOG` | 日志文件路径 | `<项目>\launcher.log` |
| `DY_PLAYWRIGHT` | playwright 模块路径 | 直接 `require('playwright')` |
| `DY_PROXY` | 传给 Chromium 的代理，如 `http://127.0.0.1:7897` | 不设置 |

## 脚本启停

`userscripts` 目录里**只有 `.js` 会被加载**：

- 停用某个脚本：改名加后缀，如 `14-dydl-download.user.js.disabled`
- 启用：改回 `.js`
- `.bak`、`.txt` 一律不加载，可安全存放候选/历史版本
