# Bundle 分析

方法：从采集结果中取可测体积的 script，下载正文做静态检查（体积、sourcemap、关键词）。**未做反混淆、未做函数级还原。**

## 可测样本（31 个，合计 3 MB）

| 体积 | 文件 | sourcemap | 特征关键词 |
|---|---|---|---|
| 466 KB | `player-0.4f7a56ae.js` | 无 | player 199 处 |
| 421 KB | `pre-build-xgplayer.3614409a.js` | 无 | player 572 处 |
| 333 KB | `framework.78673791.js` | 无 | stat 9 |
| 264 KB | `pre-build-util.daf61047.js` | 无 | search 7 |
| 258 KB | `player-3.493e9fda.js` | 无 | — |
| 234 KB | `player-2.6c934f0d.js` | 无 | — |
| 192 KB | `player-1.3279c996.js` | 无 | player 355 |
| 191 KB | `player-5.aeb1e14d.js` | 无 | player 45 |
| 189 KB | `player-4.49d56c43.js` | 无 | — |
| 186 KB | `collect.dy.js` | 无 | **stat 33**（上报脚本） |

## 结论（严格区分级别）

### 已证实
1. **全部样本无 sourceMappingURL** → 拿不到原始源码，**函数级逆向不可行**，只能做 chunk 级识别。
2. 播放器被拆成 **至少 6 个 `player-*` chunk + 1 个 `pre-build-xgplayer`**，是最大的单一功能簇。
3. 存在独立的 **`collect.dy.js`**（186 KB，stat 关键词 33 处），性质为数据采集/上报。
4. 未检出 `__webpack_require__` 特征 → 不是标准 webpack 产物（字节自研打包器或 ESM）。

### 推测（无证据支撑到结论级）
- `player-N` 可能按视频类型/清晰度/场景拆分（编号 + 体积分布，**仅推测**）。
- `pylon-wasm`（1.1 MB）可能承担风控/签名（体积 + 加载时机，**仅推测**）。

### 未知
- 151 个无体积 script 的内容与作用。
- 各 chunk 之间的真实依赖图（需要运行时模块系统 hook，属于高风险介入）。
- 是否存在可延迟加载的广告/推广 chunk（关键词法在混淆代码上不可靠）。

## 不能做的事

- 不能按文件名（`player`、`collect`）就断定能否拦截 —— 播放器 chunk 拦了直接没画面；`collect.dy.js` 拦了可能触发风控降级。
- 不能反混淆后批量替换（违反任务边界，且无 sourcemap 无法验证正确性）。
