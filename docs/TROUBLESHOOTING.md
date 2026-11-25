# 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| `node launcher.js` 报 `Cannot find module 'playwright'` | 没装依赖 | `npm install`；或设 `DY_PLAYWRIGHT` 指向已有模块 |
| 启动报 `channel 'chrome' not found` | 系统没装 Chrome | 装 Chrome，或改 `channel` 为 `chromium` 并 `npx playwright install chromium` |
| 窗口打开但白屏 | 网络/代理问题 | 检查系统代理；必要时 `setx DY_PROXY http://127.0.0.1:7897` |
| 每次都要求重新登录 | `profile\` 被删或没写权限 | 确认 `%LOCALAPPDATA%\DouyinApp\profile` 存在且可写 |
| 下载按钮不出现 | 页面结构变化 / 脚本未加载 | 看 `launcher.log` 是否有 `[DouyinSave] v3.1 button mounted` |
| 下载失败 | 解析接口不可用 | 日志里 `parse(all) failed`；该接口是第三方服务，失效即无法下载 |
| 左侧导航出现多余入口 | 抖音改版，选择器失配 | 日志 `nativenav ready ... hidden=N`，N<4 即失配 |
| 返回后推荐流重载 | 已知问题 | 见 KNOWN_ISSUES，暂无修复 |
| 日志暴涨 | 页面反复报错 | 错误日志上限 40 条，超出自动停止记录 |
| 想临时关掉某个增强 | — | 把 `userscripts/xxx.js` 改名加 `.disabled`，重启应用 |
