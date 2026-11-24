# 第三方依赖

## 运行时

| 依赖 | 版本 | 许可 | 获取 |
|---|---|---|---|
| Node.js | ≥ 20 LTS | MIT | https://nodejs.org |
| playwright (npm) | ^1.65.0 | Apache-2.0 | `npm install` |
| Google Chrome | 158.x（实测 158.0.8127.36） | 专有免费 | https://www.google.com/chrome/ |
| Chromium（替代） | 随 Playwright | BSD 系 | `npx playwright install chromium` |

## 包内 JS 库

| 文件 | 版本 | 许可 | 来源 |
|---|---|---|---|
| `00-vue.min.js` | Vue 3 min | MIT | https://unpkg.com/vue@3/dist/vue.global.prod.js |

## 包内用户脚本（第三方）

| 文件 | 版本 | 作者 | 许可 |
|---|---|---|---|
| `10-frequenk-enhancer.user.js` | 6.1 | Frequenk | GPL-3.0 |
| `11-akface-fullscreen.user.js` | 1.2.10 | akace | GPL-3.0 |
| `15-akface-download.user.js` | 22.3 | jw23 | MIT |

## 未打包（许可不明）

| 文件 | 版本 | 来源 |
|---|---|---|
| DouYinPlus | 1.0.1 | https://github.com/isxlan0/DouYinPlus |
| 抖音推荐影响器 | 2.3.5 | https://github.com/baianjo/Douyin-Smart-Feed-Assistant |

## 外部服务

- 下载解析接口 `https://parse.rcuts.com:8443/v1/parse`：第三方服务，非本项目维护，随时可能失效。**这是下载功能的外部依赖，交付包不包含其代码。**
