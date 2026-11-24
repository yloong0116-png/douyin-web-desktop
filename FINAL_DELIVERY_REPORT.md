# FINAL DELIVERY REPORT — Douyin Web Desktop

生成时间：2026-11-25 01:50:33　版本：1.0.3

## 1. 下载 P0

**已关闭（用户确认级）**。v3.3 修复串号根因：推荐流容器 `data-e2e-vid` 滞留 + 点击上下文跨路由存活。修复手段：路由隔离、href 优先于属性、只收播放中且可见的播放器、无权威来源冲突即拒。

证据分级：
- 自动化实测：详情页 / 他人主页浮层 / 自己主页浮层 / 搜索浮层 锁定正确；设置页正确拒绝。
- 用户确认：关注页、朋友页、精选、私信转发、我的-作品/喜欢/收藏/观看历史 均可正常下载。
- **未做**：逐文件内容比对（只登记为"用户确认"，不作为独立文件级验证）。

## 2. 当前稳定版本

| 项 | 值 |
|---|---|
| 版本 | 1.0.3（功能版本 v3.3） |
| 16-save-video.js | `8b13f7d07998b71b1942d85de3ecd949cf0cb924fab652ab2bd7356ae109af28` |
| launcher.js | `c1160d8fd56d0b9598c000cf38844124d82aae75e0eb9a3b6a599df260f1b080`（正式版；交付副本因路径可配置化而不同） |
| nav.js | `374c8bb8329b92e0ebd4eb7371f374979cd067e2b1b538669a5d1893886ed605`（原版） |
| 回滚备份 | `16-save-video.v3.2-20261125.bak` / `.v3.1-20261124.bak` |

## 3. Git

仓库 https://github.com/yloong0116-png/douyin-web-desktop ，最新功能提交 `a715ca8`。

## 4. 项目目录

`D:\DSH-Workspace\Douyin-Web-Desktop\`（app/ docs/ reports/ manifests/ backups/ releases/ + 根级说明文档）

## 5-6. 清理与归档

- 归档：项目目录 1.7 MB，其中源码+文档+报告约 900 KB，release 包 238 KB。
- 清理：本轮及前几轮实验产生的临时 profile 副本、探针脚本、中间 ZIP 全部删除（累计约 5.5 GB）。
- 保留（C 类，来源不明）：`temp\p.json`、`p2report.json`、`q.json`、`_acl-recovery\`、`_preview\`、`outputs\`。
- 未动：library（225 MB，含 knowledge 161 MB）、zhihu-agent-learner（355 MB）、media（62 MB）、projects（56 MB）、「备份（…）」目录、正式 profile（约 1 GB）。

## 7. 第三方交付包

| 项 | 值 |
|---|---|
| 路径 | `D:\DSH-Workspace\Douyin-Web-Desktop\releases\Douyin-Web-Desktop-Handoff.zip` |
| 大小 | 238850 bytes |
| SHA-256 | `efe18d89f85616ff3566233bf5efcafb90d2dddeca911c93dccff94669732ab2` |
| 校验 | 解压后逐文件比对 `manifests/FILES_SHA256.txt`，全部通过 |

## 8. 依赖与许可证

Node ≥20（MIT）、Playwright ^1.65（Apache-2.0）、Chrome 158（专有免费）、Vue 3（MIT）、10/11（GPL-3.0）、15（MIT）。**12-douyinplus 与 13-smartfeed 许可证不明，未打包**，仅给来源。

## 9. 部署测试

- 已完成：本机独立目录 + 独立 Profile 冒烟（9 脚本注入、面板挂载、导航隐藏 4 项）。
- **未完成**：异机 / 干净环境部署实测（无第二台机器）。标注为"未完成异机实测"。

## 10. 未解决问题

导航返回：进入部分页面后无法正常返回；返回推荐页会触发新的主框架 Document 请求与页面重建。已多轮取证（含 BFCache 对照实验：站点 `Cache-Control: no-store` 导致 bfcache 永不生效，移除启动参数无效）。`nav.js` 保持原版，候选补丁 `nav.v4-candidate.js.txt` 未启用且实测无效。

## 11. 未验证事项

六类资源逐项下载、视频文案 txt、倍速/画质、16:9 全屏回归、异机部署、返回后播放进度保留。

## 12. 回滚

```powershell
copy /y "%LOCALAPPDATA%\DouyinApp\userscripts\16-save-video.v3.2-20261125.bak" ^
        "%LOCALAPPDATA%\DouyinApp\userscripts\16-save-video.js"
```
然后重启应用。项目级回滚：`git checkout a715ca8`。

## 13. 下一阶段建议

1. 找一台干净 Windows 11 做真机部署验证（当前只有模拟）。
2. 若要继续解决返回问题，方向是"让 /user/ 进出都在同文档内（SPA）"，需先定位左侧导航真正带 href 的可点元素。
3. 六类下载做一次逐项回归，把结果写进 TESTING.md。
