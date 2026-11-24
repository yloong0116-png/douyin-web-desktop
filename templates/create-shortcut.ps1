# 在桌面创建「抖音」快捷方式（无黑框启动）
$root = Split-Path -Parent $PSScriptRoot
$lnk  = Join-Path $env:USERPROFILE 'Desktop\抖音.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath       = Join-Path $root 'node-launch.vbs'
$s.WorkingDirectory = $root
$s.IconLocation     = Join-Path $root 'app\assets\douyin.ico'
$s.Save()
Write-Host "已创建: $lnk"
