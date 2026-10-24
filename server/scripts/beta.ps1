<#
  Public BETA of the SKANS Question Bank from this PC, through a free Cloudflare quick tunnel.

    powershell -ExecutionPolicy Bypass -File server\scripts\beta.ps1 -Start     start app + tunnel, print the public link
    powershell -ExecutionPolicy Bypass -File server\scripts\beta.ps1 -Status    is it running? which link?
    powershell -ExecutionPolicy Bypass -File server\scripts\beta.ps1 -Stop      stop app + tunnel
    powershell -ExecutionPolicy Bypass -File server\scripts\beta.ps1 -Install   start automatically at sign-in + nightly beta backup
    powershell -ExecutionPolicy Bypass -File server\scripts\beta.ps1 -Uninstall remove those scheduled tasks

  Uses server\.env.beta (production mode, its own database skans_beta, port 4300). The quick-tunnel
  link (https://<random>.trycloudflare.com) changes every time the tunnel starts; the current
  link is always in server\logs\beta-url.txt. This PC must stay on while testers use the beta.
#>
param([switch]$Start, [switch]$Stop, [switch]$Status, [switch]$Install, [switch]$Uninstall, [switch]$Rebuild)
$ErrorActionPreference = 'Stop'

$server = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $server
$logs = Join-Path $server 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$pidFile = Join-Path $logs 'beta.pids'
$urlFile = Join-Path $logs 'beta-url.txt'
$envFile = Join-Path $server '.env.beta'
$port = 4300
$taskStart = 'SKANS QB - beta start'
$taskBackup = 'SKANS QB - beta nightly backup'

function Find-Cloudflared {
  foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe")) { if (Test-Path $p) { return $p } }
  $c = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  throw 'cloudflared is not installed. Run: winget install --id Cloudflare.cloudflared'
}

function Test-Health([string]$base) {
  try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Uri "$base/api/health").StatusCode -eq 200 } catch { return $false }
}

# Stops a process and its children. Processes that no longer exist (e.g. after sleep or a restart)
# are skipped: in Windows PowerShell 5 a taskkill error message would otherwise abort the script.
function Stop-Tree([int]$id) {
  if (Get-Process -Id $id -ErrorAction SilentlyContinue) {
    Start-Process -FilePath 'taskkill.exe' -ArgumentList "/PID $id /T /F" -WindowStyle Hidden -Wait
  }
}

function Stop-Beta {
  if (Test-Path $pidFile) {
    foreach ($id in Get-Content $pidFile) { if ($id -match '^\d+$') { Stop-Tree ([int]$id) } }
    Remove-Item $pidFile -Force
  }
  $left = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($c in $left) { Stop-Tree ([int]$c.OwningProcess) }
  Write-Host 'Beta stopped.'
}

function Show-Status {
  $local = Test-Health "http://localhost:$port"
  $url = if (Test-Path $urlFile) { (Get-Content $urlFile -Raw).Trim() } else { '' }
  $public = if ($url) { Test-Health $url } else { $false }
  Write-Host ("App on this PC : " + $(if ($local) { 'running' } else { 'NOT running' }))
  Write-Host ("Public link    : " + $(if ($url) { $url } else { '(none)' }) + $(if ($url) { if ($public) { '  (reachable)' } else { '  (NOT reachable)' } }))
}

if ($Stop) { Stop-Beta; return }
if ($Status) { Show-Status; return }

if ($Uninstall) {
  foreach ($n in $taskStart, $taskBackup) { Unregister-ScheduledTask -TaskName $n -Confirm:$false -ErrorAction SilentlyContinue }
  Write-Host 'Beta tasks removed.'
  return
}

if ($Install) {
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
  $startAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Start" -WorkingDirectory $server
  Register-ScheduledTask -TaskName $taskStart -Description 'Starts the SKANS Question Bank beta and its Cloudflare tunnel at sign-in.' -Action $startAction -Trigger (New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME") -Settings $settings -Principal $principal -Force | Out-Null
  $log = Join-Path $logs 'backup.log'
  $backupCmd = "/d /c `"echo ==== %date% %time% beta:backup >> `"$log`" && npx tsx --env-file=.env.beta scripts/backup-db.ts >> `"$log`" 2>&1`""
  Register-ScheduledTask -TaskName $taskBackup -Description 'Backs up the beta database (skans_beta) every night.' -Action (New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $backupCmd -WorkingDirectory $server) -Trigger (New-ScheduledTaskTrigger -Daily -At '23:15') -Settings $settings -Principal $principal -Force | Out-Null
  Write-Host "Installed: '$taskStart' (at sign-in) and '$taskBackup' (23:15 daily)."
  return
}

if (-not $Start) { Get-Help $PSCommandPath; return }

# ---------------------------------------------------------------- start
if (-not (Test-Path $envFile)) { throw "Missing $envFile (beta settings)." }
Stop-Beta | Out-Null
$cloudflared = Find-Cloudflared

$dist = Join-Path $root 'client\dist\index.html'
if ($Rebuild -or -not (Test-Path $dist)) {
  Write-Host 'Building the web app...'
  Push-Location $root; & npm.cmd run build -w client | Out-Null; Pop-Location
}

$serverLog = Join-Path $logs 'beta-server.log'
$tunnelLog = Join-Path $logs 'beta-tunnel.log'
Remove-Item $tunnelLog -ErrorAction SilentlyContinue
$app = Start-Process -FilePath 'cmd.exe' -ArgumentList "/d /c `"npx tsx --env-file=.env.beta src/index.ts > `"$serverLog`" 2>&1`"" -WorkingDirectory $server -WindowStyle Hidden -PassThru
for ($i = 0; $i -lt 60 -and -not (Test-Health "http://localhost:$port"); $i++) { Start-Sleep -Seconds 1 }
if (-not (Test-Health "http://localhost:$port")) { Stop-Tree $app.Id; throw "The app did not start. See $serverLog" }

$tunnel = Start-Process -FilePath $cloudflared -ArgumentList "tunnel --no-autoupdate --url http://localhost:$port --logfile `"$tunnelLog`"" -WindowStyle Hidden -PassThru
$awake = Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSScriptRoot\keep-awake.ps1`"" -WindowStyle Hidden -PassThru
Set-Content -Path $pidFile -Value @($app.Id, $tunnel.Id, $awake.Id)

$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $tunnelLog) {
    $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}
if (-not $url) { throw "The tunnel did not give a link. See $tunnelLog" }
Set-Content -Path $urlFile -Value $url
for ($i = 0; $i -lt 30 -and -not (Test-Health $url); $i++) { Start-Sleep -Seconds 2 }

Write-Host ''
Write-Host "  SKANS Question Bank BETA is live:  $url"
Write-Host ''
Show-Status
