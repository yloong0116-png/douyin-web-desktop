# 依赖清单

## 必须

| 组件 | 版本 | 安装 |
|---|---|---|
| Node.js | ≥ 20 LTS | `winget install OpenJS.NodeJS.LTS` |
| playwright | ^1.65.0 | `npm install`（package.json 已锁定） |
| 浏览器 | Chrome 158.x 或 Playwright Chromium | 装 Chrome，或 `npx playwright install chromium` |

## 可选

| 组件 | 用途 |
|---|---|
| 系统代理 | 访问抖音需要时，用 `DY_PROXY` 环境变量 |
| git | 后续版本管理 |

## 外部服务

| 服务 | 用途 | 可控性 |
|---|---|---|
| `https://parse.rcuts.com:8443/v1/parse` | 视频解析（下载） | 第三方，随时可能失效 |
| `www.douyin.com` | 主体页面 | 第三方 |

## 端口与网络

- 应用自身**不监听任何 TCP 端口**（Playwright 用 `--remote-debugging-pipe`）。
- 出站 HTTPS + WSS（抖音长连接）。
