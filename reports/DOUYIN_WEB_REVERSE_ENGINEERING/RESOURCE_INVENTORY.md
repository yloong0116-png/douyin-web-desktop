# 前端资源盘点（只读实测）

采集方式：Playwright + profile 副本（登录态），首页 `?recommend=1`，监听全部 response，首屏等 15 秒，再滚动 5 次。
采集时间：2026-11-25　样本：1 次（单次采样，不代表长期分布）

## 总量

| 指标 | 值 |
|---|---|
| 请求总数 | **457** |
| 首屏 15 秒内 | **454**（99% 都发生在首屏） |
| 传输总量（有 content-length 的） | 约 **22 MB** |
| DOM 节点 | 2783（滚动 5 次后仍 2783） |
| video 元素 | 1 |

## 按类型

| 类型 | 数量 |
|---|---|
| script | **182** |
| image | 91 |
| xhr | 75 |
| font | **59** |
| stylesheet | 28 |
| fetch | 7 |
| ping | 5 |
| document | 4（含 2 个 iframe：验证码 / storage-bridge） |
| other / manifest | 5 / 1 |

## 按主机

| 主机 | 请求数 | 判断 |
|---|---|---|
| lf-douyin-pc-web.douyinstatic.com | 196 | 主站静态资源（JS/CSS/字体） |
| lf3-pendah.bytetos.com | 59 | 字节对象存储（图片/资源） |
| p3-pc-sign.douyinpic.com | 54 | 图片 CDN |
| **mcs.zijieapi.com** | **32** | **字节监控/上报（mcs = monitor）** |
| www.douyin.com | 30 | 接口 |
| lf1-cdn-tos.bytescm.com | 12 | 静态 CDN |

## 体积最大的资源

| 大小 | 类型 | 资源 |
|---|---|---|
| 3203 KB | xhr | `/aweme/v2/web/module/feed/`（首页数据） |
| 3135 KB | xhr | 同上（第 2 次） |
| 3049 KB | xhr | 同上（第 3 次） |
| 1142 KB | fetch | `pylon-wasm/index_v2.wasm`（疑似风控/加密模块） |
| 795 KB | image | 首屏大图 |
| 466 KB | script | `player-0.4f7a56ae.js` |
| 421 KB | script | `pre-build-xgplayer.3614409a.js` |
| 413 KB | image | 直播间封面 |

## 关键观察（实测）

1. **首屏吃掉 99% 的请求**（454/457），滚动不产生新请求 → 说明是**预取 + 虚拟列表**，滚动只换 DOM 内容。
2. **三次 feed 请求共 9.4 MB**，单次 3 MB 的 JSON —— 数据预取是首屏最大开销。
3. **59 个字体请求**异常多，属于可关注项（但字体属核心样式，不能直接拦）。
4. **32 个 mcs.zijieapi.com 请求**是上报/监控，与用户可见功能无关（判断依据：域名 + 请求频率 + 无渲染结果依赖，**属推测**）。
5. 182 个 script 里只有 31 个能读到 content-length，其余 151 个为 chunked 或 CDN 未回报体积 —— **script 真实总量远大于 3 MB**。
