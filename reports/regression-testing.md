# 回归测试记录

## 环境

- Windows 11，Chrome 158.0.8127.36，Playwright 1.65.0
- Chrome App 窗口（`--app=`），DPI 150%

## 已验证（多次冷启动复现）

| 项 | 证据 |
|---|---|
| 启动与脚本注入 | `init: nav + early[00-gm-shim.js,00-vue.min.js] late[...]` |
| 导航隐藏 | `nativenav ready containers=1 hidden=4` |
| 下载面板 | `[DouyinSave] v3.1 button mounted prefs={...}` |
| 偏好持久化 | `prefs saved ok=true` |
| 导航/页面生命周期 | `[nav] <url>`、`[life] document load #N` |

## 无法自动化的部分

对 Chrome App 窗口的 Windows 合成输入不可靠（DPI 150% + 光标被抢占 + 前台被覆盖），详见 docs/TESTING.md。UI 项只能人工或用 Playwright CDP 鼠标。

## 未做

- 六类下载的逐项回归
- 倍速/画质/直播增强的人工回归清单
- 30 分钟以上稳定性 soak
