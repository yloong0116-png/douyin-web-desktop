# 许可证与第三方声明

## 本项目自有代码

`launcher.js`、`nav.js`、`save-core.js`、`userscripts/00-gm-shim.js`、`16-save-video.js`、`17-glass-nav.js`、`18-hide-assistant.js`、`20-layout-lab.js`：作者自用项目，未对外声明开源许可证。交付给第三方时按"可本地使用、不可再分发为商业产品"理解，具体条款由作者另行决定。

## 内置第三方代码

| 名称 | 版本 | 作者 | 许可证 | 来源 | 再分发 |
|---|---|---|---|---|---|
| Vue (runtime) | 3.x min | Evan You / Vue 团队 | MIT | vuejs.org | 允许，保留版权头 |
| 网页抖音体验增强 (10-frequenk) | 6.1 | Frequenk | **GPL-3.0** | greasyfork.org/scripts/539942 | 允许，须保留声明与源码可得 |
| 抖音全屏优化 (11-akface) | 1.2.10 | akace | **GPL-3.0** | github.com/akFace/userScript | 允许，须保留声明与源码可得 |
| Universal Video Sniffer (15) | 22.3 | jw23 | **MIT** | tampermonkey 社区 | 允许，保留版权头 |

## 未打包的第三方脚本（许可证状态不明）

以下脚本的文件头没有许可证声明，因此**不放入交付包**，只提供官方来源与版本，由使用者自行获取：

| 名称 | 版本 | 作者 | 来源 | 说明 |
|---|---|---|---|---|
| DouYinPlus (12) | 1.0.1 | Xiao Lan | github.com/isxlan0/DouYinPlus | 文件头仅 `@namespace`/`@author`，无 `@license` |
| 抖音推荐影响器 (13) | 2.3.5 | Baianjo | github.com/baianjo/Douyin-Smart-Feed-Assistant | 同上 |

> 若将来确认这两个项目的许可证，可按下表补充进 `app/userscripts/` 并更新 `manifests/FILES_SHA256.txt`。

## 运行时依赖

| 组件 | 版本 | 许可证 | 说明 |
|---|---|---|---|
| Node.js | ≥ 20 | MIT | 运行 launcher.js |
| Playwright | ^1.65.0 | Apache-2.0 | 驱动 Chromium |
| Google Chrome | 158.x（或 `npx playwright install chromium`） | 专有免费软件 | 浏览器本体 |
