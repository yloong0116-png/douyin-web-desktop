# 交付自检清单（DELIVERY CHECKLIST）

交付物：`Douyin-Web-Desktop-Handoff.zip`
版本：1.0.0
生成时间：2026-11-25

## 一、打包完整性自检（交付方已执行）

| # | 检查项 | 结果 |
|---|---|---|
| 1 | ZIP 能正常解压 | 通过（Expand-Archive 解压成功） |
| 2 | 无空目录冒充模块 | 通过（docs/reports/manifests 均有实体文件） |
| 3 | 核心源文件齐全（launcher.js / nav.js / save-core.js / userscripts 9 个） | 通过 |
| 4 | 配置模板格式正确（JSON 可解析） | 通过 |
| 5 | README 与安装手册存在 | 通过 |
| 6 | 依赖清单完整（DEPENDENCY_MANIFEST.md） | 通过 |
| 7 | 功能状态表完整（FEATURES.md + FEATURE_STATUS.md） | 通过 |
| 8 | 续作档案完整（PROJECT_STATE.md） | 通过 |
| 9 | 不含浏览器 Profile / Cookie / Token / 密码 | 通过（仅源码与文档） |
| 10 | 不含个人数据（下载历史、聊天、账号） | 通过 |
| 11 | 第三方二进制/许可不明代码未再分发 | 通过（12/13 未打包，仅给来源） |
| 12 | 无大型临时缓存 | 通过（整包 < 1 MB） |
| 13 | 包内哈希与交付目录一致 | 通过（FILES_SHA256.txt 校验） |

## 二、第三者验收步骤（拿到包的人）

1. 解压后先看 `README.md`，确认识别项目用途。
2. 打开 `docs/INSTALLATION.md`，按 1→11 步执行。
3. 启动后检查项目根目录出现 `launcher.log`，且包含：
   - `init: nav + early[...] late[...]`
   - `[DouyinSave] v3.1 button mounted`
   - `[DouyinSave] nativenav ready containers=1 hidden=4`
4. 校验文件完整性：
   ```powershell
   Get-Content manifests\FILES_SHA256.txt | ForEach-Object {
     $h,$p = $_ -split '  ',2
     if ((Get-FileHash $p -Algorithm SHA256).Hash.ToLower() -ne $h) { Write-Host "MISMATCH $p" } else { Write-Host "OK $p" }
   }
   ```
5. 核对 `manifests/PACKAGE_SHA256.txt` 与 ZIP 本身的 SHA-256 一致。
6. 阅读 `docs/KNOWN_ISSUES.md`，确认已知故障（返回上一页会重载）符合预期。

## 三、未完成项（必须知情）

- **未完成异机实测**：本包在开发机的独立目录 + 独立 Profile 下做过冒烟测试，**没有在第二台电脑上跑过**。
- 12-douyinplus / 13-smartfeed 未包含（许可证不明），需要的功能（倍速、画质、直播增强、智能信息流）交付包内**不可用**。
- 下载功能依赖第三方解析接口，接口失效则下载不可用。

## 四、签名

| 项 | 值 |
|---|---|
| 包版本 | 1.0.0 |
| 文件数 | 见 `manifests/FILES_SHA256.txt` 行数 |
| ZIP SHA-256 | 见 `manifests/PACKAGE_SHA256.txt` |
| 生成方式 | 脚本复制 + PowerShell Compress-Archive |
