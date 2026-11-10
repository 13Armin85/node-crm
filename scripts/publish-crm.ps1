# Publish the API and client together, and verify the actual IIS endpoint.
param(
    [Parameter(Mandatory=$true)][string]$ReleaseDirectory,
    [string]$Origin = 'https://37.148.206.74'
)
$ErrorActionPreference = 'Stop'
$crmRelease = [System.IO.Path]::GetFullPath($ReleaseDirectory)
$crmVerify = Join-Path $PSScriptRoot 'check-published-crm.cjs'
& (Join-Path $PSScriptRoot 'deploy-client-build.ps1') -ReleaseDirectory $crmRelease -ValidateOnly
$crmService = Get-Service -Name 'NodeCRMBackend'
Restart-Service -InputObject $crmService
$crmService.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(30))
& node $crmVerify --backend-only
if ($LASTEXITCODE -ne 0) { throw 'Backend verification failed; client publication was stopped.' }
& (Join-Path $PSScriptRoot 'deploy-client-build.ps1') -ReleaseDirectory $crmRelease
& node $crmVerify --origin $Origin --release-dir $crmRelease
if ($LASTEXITCODE -ne 0) { throw 'Published release verification failed.' }
Write-Output 'Published and verified both NodeCRMBackend and the complete client release.'
