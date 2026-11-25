
# userscripts 目录

只有 `.js` 会被加载，按文件名排序；`00-*` 恒为早批（document-start）。

| 文件 | 作用 | 许可 |
|---|---|---|
| 05-background-manager.js | 最小化/隐藏时暂停正在播放的视频；恢复后等待用户手动继续 | 自有 |
| 00-gm-shim.js | GM_* 兼容层 | 自有 |
| 00-vue.min.js | Vue 3 运行时（10/12/13 依赖） | MIT |
| 10-frequenk-enhancer.user.js | 网页抖音体验增强 6.1 | GPL-3.0 |
| 11-akface-fullscreen.user.js | 全屏优化 1.2.10 | GPL-3.0 |
| 15-akface-download.user.js | 通用视频嗅探 22.3 | MIT |
| 16-save-video.js | 下载按钮与面板 | 自有 |
| 17-glass-nav.js | 左侧导航隐藏 4 项 | 自有 |
| 18-hide-assistant.js | 隐藏智能助手悬浮球 | 自有 |
| 20-layout-lab.js | 布局实验（默认关闭） | 自有 |

**未包含**：12-douyinplus、13-smartfeed —— 文件头无许可证声明，请按 docs/THIRD_PARTY_DEPENDENCIES.md 自行获取。
停用脚本：把后缀改成 `.disabled`。
