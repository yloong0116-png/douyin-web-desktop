
# tools

本目录留空。可放自用脚本（哈希校验、批量改名、日志分析等）。
现有可用命令：

```powershell
# 校验交付文件完整性
Get-Content manifests\FILES_SHA256.txt | ForEach-Object {
  $h,$p = $_ -split '  ',2
  if ((Get-FileHash $p -Algorithm SHA256).Hash.ToLower() -ne $h) { Write-Host "MISMATCH $p" }
}
```
