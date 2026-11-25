# 开发

## 改代码的位置

| 想改什么 | 改哪里 | 注意 |
|---|---|---|
| 启动参数 / 窗口 | `launcher.js` 的 `launchPersistentContext` | 不要加 `--remote-debugging-port` 到正式环境 |
| 注入顺序 | `launcher.js:scriptList` / `runAtOf` | `00-*` 恒为早批 |
| 下载逻辑 | `launcher.js:__dySave` | 下载以点击瞬间快照为准，解析结果 id 必须与快照一致 |
| 返回逻辑 | `nav.js` | 见 KNOWN_ISSUES |
| 导航隐藏 | `17-glass-nav.js` | 只隐藏，不改样式 |

## 调试手段（不影响正式环境）

1. 复制 `profile\` 到临时目录，用独立 `userDataDir` 启动一个实验实例。
2. 用 Playwright 的 `page.on('request')`、`request.resourceType()==='document'` 判断是否真的导航；**不要用 `load` 事件判断整页刷新**。
3. 需要 bfcache 诊断时监听 CDP `Page.backForwardCacheNotUsed`，能拿到 `notRestoredExplanations`。
4. 页面内探针用 `console.log('[DouyinSave] ...')`，会被 launcher 收进日志。

## 禁止

- 不覆盖 `backups/DouyinApp-v3.1-stable`
- 不把候选补丁改名成 `.js` 直接放进 `userscripts`
- 不在正式 Profile 上做隔离实验
- 不用 DOM 强改压缩布局、不全局禁用 ResizeObserver
