param([switch]$Login)
$ErrorActionPreference='Stop'
# Keep configuration, cache and logs on the established data disks.
$env:USERPROFILE='D:\Codex'
$env:APPDATA='E:\AppDataRoaming'
$env:LOCALAPPDATA='E:\AppData'
$env:XDG_CONFIG_HOME='D:\Codex\.config'
$env:npm_config_cache='D:\Codex\npm-cache'
$env:WRANGLER_SEND_METRICS='false'
$env:WRANGLER_LOG_PATH=Join-Path $PSScriptRoot '..\.wrangler\console.log'
Set-Location (Join-Path $PSScriptRoot '..')
if($Login){ & node node_modules/wrangler/bin/wrangler.js login --scopes account:read user:read workers:write workers_routes:write workers_scripts:write workers_tail:read d1:write zone:read ssl_certs:write; if($LASTEXITCODE -ne 0){throw 'Cloudflare 登录未完成'} }
Write-Host '项目终端已准备好。管理员凭据请通过 wrangler secret put 交互输入。'
