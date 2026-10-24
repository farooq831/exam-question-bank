<#
  Registers the SKANS Question Bank backup tasks in Windows Task Scheduler:

    * "SKANS QB - nightly backup"   every day at 23:00  -> npm run db:backup
    * "SKANS QB - weekly check"     Sundays at 23:30     -> npm run db:verify-backup

  Usage (PowerShell, from the project folder):
    powershell -ExecutionPolicy Bypass -File server\scripts\schedule-backup.ps1            # this user, runs while signed in
    powershell -ExecutionPolicy Bypass -File server\scripts\schedule-backup.ps1 -System    # school server: runs as SYSTEM even
                                                                                         # when nobody is signed in (run as Administrator)
    powershell -ExecutionPolicy Bypass -File server\scripts\schedule-backup.ps1 -Remove    # remove both tasks

  A task that was missed (PC switched off at 23:00) runs as soon as the PC is on again.
  Output is appended to server\logs\backup.log.
#>
param(
  [switch]$System,
  [switch]$Remove,
  [string]$At = '23:00'
)
$ErrorActionPreference = 'Stop'
$names = @('SKANS QB - nightly backup', 'SKANS QB - weekly check')

if ($Remove) {
  foreach ($n in $names) { Unregister-ScheduledTask -TaskName $n -Confirm:$false -ErrorAction SilentlyContinue }
  Write-Host 'Backup tasks removed.'
  return
}

$server = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $server 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
# Node.js runs the scripts directly (through tsx). npm is not used: on some PCs "npm run" is
# terminated when Task Scheduler starts it, while the same script started directly works.
$node = (Get-Command node.exe -ErrorAction Stop).Source
$tsx = Join-Path (Split-Path -Parent $server) 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsx)) { throw "tsx not found at $tsx. Run npm ci in the project folder first." }
$log = Join-Path $logs 'backup.log'

function New-Action([string]$label, [string]$scriptArgs) {
  # cmd.exe appends the output to the log, after a line with the date and time.
  $cmd = "/d /c `"echo ==== %date% %time% $label >> `"$log`" && `"$node`" `"$tsx`" $scriptArgs >> `"$log`" 2>&1`""
  New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $cmd -WorkingDirectory $server
}

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
if ($System) {
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
} else {
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
}

$time = [datetime]::ParseExact($At, 'HH:mm', $null)
$daily = New-ScheduledTaskTrigger -Daily -At $time
$weekly = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $time.AddMinutes(30)

Register-ScheduledTask -TaskName $names[0] -Description 'Backs up the SKANS Question Bank database and logos (keeps 14 daily + 6 monthly).' -Action (New-Action 'db:backup' 'scripts/backup-db.ts') -Trigger $daily -Settings $settings -Principal $principal -Force | Out-Null
Register-ScheduledTask -TaskName $names[1] -Description 'Restores the newest SKANS backup into a temporary database to prove it works.' -Action (New-Action 'db:verify-backup' 'scripts/restore-db.ts --verify') -Trigger $weekly -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Scheduled: '$($names[0])' daily at $At and '$($names[1])' on Sundays."
Write-Host "Log file: $log"
