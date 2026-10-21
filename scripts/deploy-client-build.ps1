# Publish a validated staged build without deleting assets still used by open tabs.
$ErrorActionPreference = 'Stop'
$crmWorkspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$crmRelease = [System.IO.Path]::GetFullPath((Join-Path $crmWorkspace 'layout-artifacts/mobile-pwa/release'))
$crmLive = [System.IO.Path]::GetFullPath((Join-Path $crmWorkspace 'client/build'))
foreach ($crmDirectory in @($crmRelease, $crmLive)) {
    if (-not $crmDirectory.StartsWith($crmWorkspace + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Build path is outside the workspace.' }
    if (-not (Test-Path -LiteralPath $crmDirectory -PathType Container)) { throw "Build directory missing: $crmDirectory" }
}
$crmManifest = Get-Content -LiteralPath (Join-Path $crmRelease 'asset-manifest.json') -Raw | ConvertFrom-Json
foreach ($crmAsset in $crmManifest.entrypoints) {
    $crmAssetFile = [System.IO.Path]::GetFullPath((Join-Path $crmRelease $crmAsset))
    if (-not $crmAssetFile.StartsWith($crmRelease + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid manifest entry.' }
    if (-not (Test-Path -LiteralPath $crmAssetFile -PathType Leaf)) { throw "Missing release asset: $crmAsset" }
}
$crmWorker = Get-Content -LiteralPath (Join-Path $crmRelease 'service-worker.js') -Raw
if ($crmWorker.Contains('__CRM_BUILD_VERSION__')) { throw 'Run the PWA postbuild step before deployment.' }
$crmLastFiles = @('index.html','asset-manifest.json','service-worker.js','web.config')
Get-ChildItem -LiteralPath $crmRelease | Where-Object { $_.Name -notin $crmLastFiles } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $crmLive -Recurse -Force
}
foreach ($crmName in @('web.config','asset-manifest.json','index.html','service-worker.js')) {
    Copy-Item -LiteralPath (Join-Path $crmRelease $crmName) -Destination (Join-Path $crmLive $crmName) -Force
}
Write-Output 'Published staged client and PWA; existing hashed assets retained for active tabs.'
