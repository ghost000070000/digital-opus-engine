param()
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 (.NET Framework) has no Path.GetRelativePath or Convert.ToHexString.
function Get-RelativePath([string]$base, [string]$full) {
  $prefix = [IO.Path]::GetFullPath($base).TrimEnd('\') + '\'
  $target = [IO.Path]::GetFullPath($full)
  if (-not $target.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Path escapes base: $target" }
  return $target.Substring($prefix.Length)
}
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$siteSource = Join-Path $taskRoot 'dist\engine-site'
$releaseBase = Join-Path $taskRoot 'release'
$releaseName = 'hostinger-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$releaseDir = Join-Path $releaseBase $releaseName
$uploadDir = Join-Path $releaseDir 'public_html'
if (-not (Test-Path -LiteralPath (Join-Path $siteSource 'index.html'))) { throw 'Build dist/engine-site first.' }
if (Test-Path -LiteralPath $releaseDir) { throw 'Release directory already exists; never overwrite a release.' }
if (-not ([IO.Path]::GetFullPath($releaseDir).StartsWith($releaseBase + [IO.Path]::DirectorySeparatorChar))) { throw 'Unsafe release target.' }
[void](New-Item -ItemType Directory -Path $uploadDir)
Get-ChildItem -LiteralPath $siteSource -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $uploadDir -Recurse }
Copy-Item -LiteralPath (Join-Path $taskRoot 'LICENSE') -Destination (Join-Path $uploadDir 'LICENSE')
Copy-Item -LiteralPath (Join-Path $taskRoot 'SHOWCASE-ASSET-LICENSES.md') -Destination (Join-Path $uploadDir 'SHOWCASE-ASSET-LICENSES.md')
$sourceFiles = @(Get-ChildItem -LiteralPath $siteSource -File -Recurse -Force)
foreach ($file in $sourceFiles) {
  $relativeName = (Get-RelativePath $siteSource $file.FullName)
  if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath (Join-Path $uploadDir $relativeName) -Algorithm SHA256).Hash) { throw "Copy mismatch: $relativeName" }
}
$uploadFiles = @(Get-ChildItem -LiteralPath $uploadDir -File -Recurse -Force)
$secretPatterns = @('-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----', '\bsk-[A-Za-z0-9_-]{32,}\b', '\bgh[pousr]_[A-Za-z0-9_]{32,}\b', '\bAKIA[0-9A-Z]{16}\b', 'C:\\Users\\THINKPAD\\')
$textExtensions = @('.html','.js','.json','.css','.svg','.txt','.md','.xml')
foreach ($file in $uploadFiles) {
  $relativeName = (Get-RelativePath $uploadDir $file.FullName).Replace('\','/')
  if ($relativeName -match '(^|/)(\.git|\.env[^/]*|node_modules|qualification|\.codex)(/|$)') { throw "Private/dev file in upload: $relativeName" }
  if ($textExtensions -contains $file.Extension.ToLowerInvariant()) {
    $body = [IO.File]::ReadAllText($file.FullName)
    foreach ($pattern in $secretPatterns) { if ($body -match $pattern) { throw "Sensitive-pattern scan failed (value withheld): $relativeName" } }
  }
}
$catalog = Get-Content -LiteralPath (Join-Path $uploadDir 'games\catalog.json') -Raw | ConvertFrom-Json
if ($catalog.games.Count -ne 28) { throw 'Expected exactly 28 original public examples.' }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Join-Path $releaseDir 'digital-opus-engine-hostinger.zip'
# Explicit '/' entry names: .NET Framework's CreateFromDirectory writes '\' and
# Linux-side extraction (hPanel) would then produce flat files named 'games\x.html'.
$zipStream = [IO.File]::Open($zipPath, [IO.FileMode]::CreateNew)
$zipWriter = New-Object IO.Compression.ZipArchive($zipStream, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $uploadFiles) { [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipWriter, $file.FullName, (Get-RelativePath $uploadDir $file.FullName).Replace('\','/'), [IO.Compression.CompressionLevel]::Optimal) }
} finally { $zipWriter.Dispose(); $zipStream.Dispose() }
$manifest = @($uploadFiles | Sort-Object FullName | ForEach-Object { [ordered]@{ path = (Get-RelativePath $uploadDir $_.FullName).Replace('\','/'); bytes = $_.Length; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() } })
$expected = @{}; foreach ($item in $manifest) { $expected[$item.path] = $item }
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | Where-Object { $_.Name -ne '' })
  if ($entries.Count -ne $manifest.Count) { throw 'Archive file count mismatch.' }
  foreach ($entry in $entries) {
    if (-not $expected.ContainsKey($entry.FullName) -or $entry.FullName.StartsWith('/') -or $entry.FullName.Split('/') -contains '..') { throw 'Unexpected or unsafe ZIP entry.' }
    $stream = $entry.Open(); $hasher = [Security.Cryptography.SHA256]::Create()
    try { $digest = ([BitConverter]::ToString($hasher.ComputeHash($stream)) -replace '-','').ToLowerInvariant() } finally { $stream.Dispose(); $hasher.Dispose() }
    if ($digest -ne $expected[$entry.FullName].sha256) { throw "Archive hash mismatch: $($entry.FullName)" }
  }
} finally { $archive.Dispose() }
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$sourceFingerprint = (& node (Join-Path $taskRoot 'tools\real-demo-program-state.js')).Trim()
$readme = @'
DIGITAL OPUS ENGINE - HOSTINGER UPLOAD

This is a desktop-first beta/early-access static web package. It needs ordinary
Hostinger Web/Cloud hosting with File Manager (not the AI Website Builder).
No npm install, Node/PHP server, database, account backend or API keys are needed.

1. Back up any existing site. Choose a separate site/subdomain or empty directory.
   DO NOT overwrite games.digitalopusadsolutions.com or another existing site.
2. Upload digital-opus-engine-hostinger.zip with hPanel File Manager.
3. Extract so index.html is directly inside the chosen site's document root
   (usually public_html), alongside editor/, docs/, games/, assets/, build/, dist/.
   Do NOT leave an extra public_html or engine-site folder between root and index.
   Alternatively upload the CONTENTS of the supplied public_html folder by SFTP.
4. Keep the complete relative directory structure. Do not upload the repository,
   qualification outputs, private projects, credentials, or the outer release folder.
5. Enable the site's HTTPS certificate and open its HTTPS URL. Root hosting and a
   dedicated subfolder such as /engine/ are supported; no SPA rewrite is needed.
6. Smoke-test Home, Creator Guide, Examples and Launch Editor; create a starter,
   edit/Undo/Redo, Save/reload/Open, export Editable + Playable and open those files.
   Test a second clean browser profile before announcing the launch.

Projects are stored in that browser profile/origin, NOT in Hostinger's filesystem.
Changing domain, HTTP/HTTPS or browser profile does not transfer previous local
projects. Export Project JSON/Editable backups before moving; then import them.
Clearing browser storage can remove local projects/progress. Runtime Game Save
slots are isolated by portable project identity; deliberate copies preserving the
same identity share progress on the same origin. Independent copies have a fresh
identity. Older shared slots require explicit Pause recovery and are kept intact.
Local Project Save uses supported browser Web Locks on HTTPS/localhost. If safe
local saving is unavailable, keep the page open and download/verify Project JSON.

The local package has been integrity-checked; the live Hostinger environment,
HTTPS, cache configuration, compression and real user traffic are not yet tested.
Start with a small desktop Chrome/Edge beta. Broader Safari/Firefox, physical
mobile/assistive technology and novice-user usability require further validation.

LICENSE and SHOWCASE-ASSET-LICENSES.md must remain with distributed copies.
FILE-MANIFEST.json and SHA256SUMS.txt are verification sidecars, not web files.
Hostinger instructions: https://www.hostinger.com/support/1869114-how-to-upload-backups-with-file-manager-in-hostinger/
'@
[IO.File]::WriteAllText((Join-Path $releaseDir 'UPLOAD-INSTRUCTIONS.txt'),$readme,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $releaseDir 'FILE-MANIFEST.json'),($manifest | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $releaseDir 'SHA256SUMS.txt'),($zipHash + '  digital-opus-engine-hostinger.zip' + [Environment]::NewLine),[Text.UTF8Encoding]::new($false))
$result = [ordered]@{ releaseDirectory=$releaseDir; uploadDirectory=$uploadDir; zipPath=$zipPath; zipBytes=(Get-Item -LiteralPath $zipPath).Length; uncompressedBytes=($uploadFiles | Measure-Object Length -Sum).Sum; files=$uploadFiles.Count; originalSiteFiles=$sourceFiles.Count; sourceFingerprint=$sourceFingerprint; exactSourceCopy=$true; allZipEntryHashesVerified=$true; sensitivePatternScan='PASS_BOUNDED_NOT_SECURITY_AUDIT'; examples=28; deployed=$false; createdAt=[DateTime]::UtcNow.ToString('o') }
[IO.File]::WriteAllText((Join-Path $releaseDir 'PACKAGE-REPORT.json'),($result | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Compress
