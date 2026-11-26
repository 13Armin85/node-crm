# IIS exposes the first-request compression policy only at server level.
# Apply it only when the server hosts exactly this CRM site.
$ErrorActionPreference = 'Stop'
Import-Module WebAdministration
$crmWorkspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$crmLive = [System.IO.Path]::GetFullPath((Join-Path $crmWorkspace 'client/build'))
$crmSites = @(Get-Website)
if ($crmSites.Count -ne 1 -or -not ([System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($crmSites[0].PhysicalPath))).Equals($crmLive, [StringComparison]::OrdinalIgnoreCase)) {
    Write-Output 'Global compression policy left unchanged because IIS is shared with another site.'
    return
}
$crmCompressionFilter = 'system.webServer/httpCompression'
$crmPrevious = Get-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter $crmCompressionFilter -Name 'staticCompressionIgnoreHitFrequency'
$crmBackup = Join-Path $crmWorkspace 'layout-artifacts/performance-baseline/iis-compression.json'
if (-not (Test-Path -LiteralPath $crmBackup)) {
    @{ staticCompressionIgnoreHitFrequency = [bool]$crmPrevious.Value } | ConvertTo-Json | Set-Content -LiteralPath $crmBackup -Encoding UTF8
}
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter $crmCompressionFilter -Name 'staticCompressionIgnoreHitFrequency' -Value $true
Write-Output 'Dedicated CRM IIS server configured to compress static files from their first request.'
