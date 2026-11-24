# 左侧导航改造

## 目标

保留抖音原生左侧栏的视觉效果，只去掉不用的入口，不加玻璃、不加胶囊、不加文字、不改宽度。

## 做法（`17-glass-nav.js` v2.0）

1. 以可见的 `a[href]` 且 `textContent==='精选'` 为锚点。
2. 向上最多 8 层，找同时满足「子元素 ≥8」且「文本包含 ≥8 个导航名」的祖先 = 导航容器。
3. 在容器直接子元素里按文本精确匹配四个待隐藏项：AI抖音 / 放映厅 / 短剧 / 小游戏。
4. 命中的节点设 `display:none !important` 并打 `data-dy-hidden` 标记，避免重复处理。
5. `MutationObserver` 只在有 `addedNodes` 时触发一次 220ms 去抖的重扫 —— React 重渲染后自动恢复隐藏状态。

## 为什么不动布局

早期实验压缩左栏宽度/内边距 → 触发抖音自身 ResizeObserver → 节点重建、尺寸抖动。**结论：只隐藏，不改样式。**

## 实测证据

`launcher.log`：`[DouyinSave] nativenav ready containers=1 hidden=4 drop=AI抖音,放映厅,短剧,小游戏`（多次冷启动复现）。

## 已知风险

抖音改版导致文本或层级变化时，`hidden` 会变小（<4）；日志里能立刻看出来，需要重定位。
