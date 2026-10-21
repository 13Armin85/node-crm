# Run elevated. Public ACME challenges are separate from private keys and survive client builds.
param([switch]$Staging)
$ErrorActionPreference = 'Stop'
Import-Module WebAdministration
$crmStateRoot = 'C:\ProgramData\NodeCRM\Acme'
$crmScriptRoot = 'C:\ProgramData\NodeCRM\Https'
$crmChallengeRoot = 'C:\ProgramData\NodeCRM\AcmeChallenges'
foreach ($crmDirectory in @($crmStateRoot, $crmScriptRoot, $crmChallengeRoot, 'C:\ProgramData\NodeCRM\Modules')) {
    New-Item -ItemType Directory -Path $crmDirectory -Force | Out-Null
    & icacls.exe $crmDirectory /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Unable to protect $crmDirectory" }
}
& icacls.exe $crmChallengeRoot /grant '*S-1-5-32-568:(OI)(CI)RX' '*S-1-5-17:(OI)(CI)RX' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Unable to grant IIS access to public challenges.' }
$crmChallengeConfig = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration><system.webServer>
  <staticContent><remove fileExtension="."/><mimeMap fileExtension="." mimeType="text/plain"/></staticContent>
  <rewrite><rules><clear/></rules></rewrite>
</system.webServer></configuration>
'@
[System.IO.File]::WriteAllText((Join-Path $crmChallengeRoot 'web.config'), $crmChallengeConfig)
$crmVirtualPath = '/.well-known/acme-challenge'
Add-Type -Path "$env:SystemRoot\System32\inetsrv\Microsoft.Web.Administration.dll"
$crmManager = New-Object Microsoft.Web.Administration.ServerManager
try {
    $crmApp = $crmManager.Sites['crm'].Applications['/']
    if (-not $crmApp) { throw 'CRM site application not found.' }
    $crmVirtual = $crmApp.VirtualDirectories[$crmVirtualPath]
    if (-not $crmVirtual) {
        $crmApp.VirtualDirectories.Add($crmVirtualPath, $crmChallengeRoot) | Out-Null
        $crmManager.CommitChanges()
    } elseif ($crmVirtual.PhysicalPath -ne $crmChallengeRoot) {
        throw 'The existing ACME virtual directory belongs to a different location.'
    }
} finally { $crmManager.Dispose() }
$crmProbeName = 'crm-probe-' + [Guid]::NewGuid().ToString('N')
$crmProbeFile = Join-Path $crmChallengeRoot $crmProbeName
try {
    [System.IO.File]::WriteAllText($crmProbeFile, $crmProbeName)
    $crmProbe = Invoke-WebRequest -UseBasicParsing -Uri ("http://37.148.206.74/.well-known/acme-challenge/" + $crmProbeName) -TimeoutSec 20
    if ($crmProbe.StatusCode -ne 200 -or $crmProbe.Content.Trim() -ne $crmProbeName) { throw 'The public IP does not serve the ACME validation file.' }
} finally {
    if (Test-Path -LiteralPath $crmProbeFile) { Remove-Item -LiteralPath $crmProbeFile }
}
$crmRenewSource = Join-Path $PSScriptRoot 'renew-crm-https.ps1'
$crmRenewTarget = Join-Path $crmScriptRoot 'renew-crm-https.ps1'
Copy-Item -LiteralPath $crmRenewSource -Destination $crmRenewTarget -Force
$crmTaskName = if ($Staging) { 'NodeCRMHTTPS-Staging' } else { 'NodeCRMHTTPS-Renewal' }
$crmArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $crmRenewTarget + '"'
if ($Staging) { $crmArguments += ' -Staging' }
$crmAction = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $crmArguments
$crmPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$crmSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$crmTaskOptions = @{ TaskName = $crmTaskName; Action = $crmAction; Principal = $crmPrincipal; Settings = $crmSettings; Force = $true }
if (-not $Staging) {
    $crmTaskOptions.Trigger = @('00:15','06:15','12:15','18:15' | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ })
    if (-not (Get-NetFirewallRule -Name 'NodeCRM-HTTPS' -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name 'NodeCRM-HTTPS' -DisplayName 'NodeCRM HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 | Out-Null
    }
}
Register-ScheduledTask @crmTaskOptions | Out-Null
Start-ScheduledTask -TaskName $crmTaskName
Write-Output ("Started " + $crmTaskName + ". Read the result under " + $crmStateRoot + ".")
