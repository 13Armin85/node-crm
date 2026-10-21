param([switch]$Staging)
$ErrorActionPreference = 'Stop'
$crmStateRoot = 'C:\ProgramData\NodeCRM\Acme'
$crmResultPath = Join-Path $crmStateRoot $(if ($Staging) { 'staging-result.json' } else { 'production-result.json' })
try {
    $env:POSHACME_HOME = $crmStateRoot
    Import-Module 'C:\ProgramData\NodeCRM\Modules\Posh-ACME-4.35.0\Posh-ACME.psd1'
    Import-Module WebAdministration
    $crmServer = if ($Staging) { 'https://acme-staging-v02.api.letsencrypt.org/directory' } else { 'https://acme-v02.api.letsencrypt.org/directory' }
    Set-PAServer -DirectoryUrl $crmServer
    $crmAccount = Get-PAAccount
    if (-not $crmAccount) { New-PAAccount -AcceptTOS | Out-Null }
    $crmOrder = Get-PAOrder -MainDomain '37.148.206.74' -Name 'node-crm-ip'
    if (-not $crmOrder) {
        $crmOptions = @{
            Domain = '37.148.206.74'
            Name = 'node-crm-ip'
            Profile = 'shortlived'
            Plugin = 'WebRoot'
            PluginArgs = @{ WRPath = 'C:\ProgramData\NodeCRM\AcmeChallenges'; WRExactPath = $true }
            AcceptTOS = $true
            Install = (-not $Staging)
            FriendlyName = 'NodeCRM IP HTTPS'
            ValidationTimeout = 120
        }
        $crmCertificate = New-PACertificate @crmOptions
    } else {
        Set-PAOrder -MainDomain '37.148.206.74' -Name 'node-crm-ip'
        Submit-Renewal -MainDomain '37.148.206.74' -Name 'node-crm-ip' | Out-Null
        $crmCertificate = Get-PACertificate -MainDomain '37.148.206.74' -Name 'node-crm-ip'
    }
    if (-not $crmCertificate.Thumbprint) { throw 'Certificate issuance did not return a certificate.' }
    if (-not $Staging) {
        $crmBinding = Get-WebBinding -Name 'crm' -Protocol 'https' | Where-Object { $_.bindingInformation -eq '*:443:' }
        if (-not $crmBinding) {
            New-WebBinding -Name 'crm' -Protocol 'https' -Port 443 -IPAddress '*' -HostHeader '' -SslFlags 0
            $crmBinding = Get-WebBinding -Name 'crm' -Protocol 'https' | Where-Object { $_.bindingInformation -eq '*:443:' }
        }
        if (-not (Test-Path -LiteralPath ('Cert:\LocalMachine\My\' + $crmCertificate.Thumbprint))) {
            throw 'The HTTPS certificate was not installed into the machine certificate store.'
        }
        $crmBinding.AddSslCertificate($crmCertificate.Thumbprint, 'My')
    }
    @{ success = $true; staging = [bool]$Staging; ip = '37.148.206.74'; thumbprint = $crmCertificate.Thumbprint; expires = $crmCertificate.NotAfter; checkedAt = (Get-Date).ToUniversalTime().ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath $crmResultPath -Encoding UTF8
} catch {
    @{ success = $false; staging = [bool]$Staging; error = $_.Exception.Message; checkedAt = (Get-Date).ToUniversalTime().ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath $crmResultPath -Encoding UTF8
    exit 1
}
