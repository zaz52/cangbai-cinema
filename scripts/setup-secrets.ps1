$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'console.ps1')
Write-Host '设置苍柏 CINEMA 线上管理员和版权投诉邮箱。输入值通过标准输入传给 Cloudflare。'
$securePassword=Read-Host '请输入管理员密码（至少12位）' -AsSecureString
$passwordPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
 $adminPassword=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
 if($adminPassword.Length -lt 12){throw '管理员密码需要至少12位'}
 $contactEmail=Read-Host '请输入公开的版权投诉接收邮箱'
 if($contactEmail -notmatch '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$'){throw '邮箱格式无效'}
 $sessionSecret=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
 $secretJson=@{ADMIN_PASSWORD=$adminPassword;ADMIN_SESSION_SECRET=$sessionSecret;COPYRIGHT_CONTACT_EMAIL=$contactEmail}|ConvertTo-Json -Compress
 $secretJson | & node node_modules/wrangler/bin/wrangler.js secret bulk
 if($LASTEXITCODE -ne 0){throw 'Cloudflare 密钥设置失败'}
 Write-Host '密钥已写入 Cloudflare。请用刚设置的密码登录 https://weiyi.indevs.in/admin.html'
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
 $adminPassword=$null;$secretJson=$null;$sessionSecret=$null
}
