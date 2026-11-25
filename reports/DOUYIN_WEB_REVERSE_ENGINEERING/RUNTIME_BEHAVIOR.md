# 运行时行为

## 实测数据

| 项 | 值 |
|---|---|
| DOM 节点（首屏） | 2783 |
| DOM 节点（滚动 5 次后） | 2783（不增长） |
| video 元素 | 1 |
| script 标签 | 见 `resources.json` |
| 首屏请求 | 454 / 457 |
| 上报域名请求 | mcs.zijieapi.com 32 次 |
| ping 类型请求 | 5 |

## 可确认的行为

1. **虚拟列表**：滚动不增加 DOM 节点、不产生新请求 → 内容复用同一批节点。
2. **首屏激进预取**：3 次 feed 接口共 9.4 MB，一次性拉取。
3. **上报独立成文件**：`collect.dy.js` 186 KB + 32 次 mcs 请求。

## 无法采集的项（工具限制，如实记录）

- **JS Heap / 定时器数量 / 监听器数量**：本次 CDP session 未 enable `Performance` 域，全部返回 null。此前用探针测过 JS Heap（230–280 MB 稳定），但那不是本次数据。
- **页面内定时器**：无公开枚举 API；CDP `Performance.getMetrics` 的 `EventListeners` 在本机 Chromium 158 上返回空。
- **抖音自身定时器**：只能通过代码审查其 bundle 推断，未做（混淆）。

## 与已知问题的关系

此前实测：renderer 长时间运行涨到 4–4.8 GB，F5 后回落 1.5–2.5 GB，JS Heap 稳定。结合本次"首屏 454 请求、后续几乎零请求"的观察，**高度疑似**内存增长来自浏览器为这批请求保留的记录（NetworkResourcesData），而非持续的新请求。**仍未取得对象级证据。**
