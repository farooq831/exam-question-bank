<#
  Keeps Windows from going to sleep by itself while the beta runs (started and stopped by beta.ps1).
  The screen may still turn off; closing the lid or choosing Sleep still works as configured.
#>
Add-Type -Namespace SkansQb -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
# ES_CONTINUOUS (0x80000000) + ES_SYSTEM_REQUIRED (0x1): no automatic sleep while this process runs.
[SkansQb.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null
while ($true) { Start-Sleep -Seconds 3600 }
