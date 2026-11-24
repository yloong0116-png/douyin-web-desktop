# 下载系统

## 组成

| 层 | 文件 | 职责 |
|---|---|---|
| 页面按钮 | `16-save-video.js` | 渲染 ⬇ 按钮、勾选面板、把六类选择与作品快照交给 `__dySave` |
| 后端绑定 | `launcher.js:__dySave` | 调解析接口 → 校验 id → 按选择下载 → 写日志 |
| 偏好存储 | `launcher.js:readPrefs/writePrefs` | `download-preferences.json` 读写，异常回退默认 |
| 偏好绑定 | `launcher.js:__dySetPrefs` | 面板保存时落盘 |
| 嗅探（备用） | `15-akface-download.user.js` | 通用视频嗅探，独立于上面的链路 |

## 流程

1. 用户点 ⬇ → 页面生成快照 `{task_id, aweme_id, via, captured_at, title, selected[]}`。
2. 后端 `__dySave` 校验 `aweme_id` 为 8 位以上数字，否则拒单。
3. 调 `POST https://parse.rcuts.com:8443/v1/parse`（`quality: 'all'`）。
4. 用返回的 `quality_list` 取最高档二次解析（若 id 一致则升级）。
5. 按 `selected` 组装任务：media / music / cover / music_cover / avatar / text。
6. 文件名 `<清洗标题>_<时间戳>`，同秒同名自动加 `_1`/`_2`，**绝不覆盖**。
7. 逐项下载并记 `ok` / `fail`，最后一行 `DONE files=N`。

## 默认勾选

`media: true`，其余五项 false（见 `PREF_DEFAULTS`）。

## 已实测

- 面板挂载与偏好读写：`[DouyinSave] v3.1 button mounted prefs=...`、`prefs saved ok=true`。
- 下载目录自动创建（`fs.mkdirSync(SAVE_DIR, {recursive:true})`，代码审查）。
- 解析失败分支、id 不一致中止分支（代码审查）。

## 未完整测试

- 六类**逐项**下载结果；音乐/封面/头像的实际文件可用性。
- 图文作品的批量序号命名。

## 已知限制

- 解析接口是第三方服务（`parse.rcuts.com`），失效即下载功能整体失效，本项目无法修复。
- 标题清洗只保留 60 字符，特殊字符替换为空格。
