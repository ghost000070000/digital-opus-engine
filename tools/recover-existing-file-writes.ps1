param([Parameter(Mandatory=$true)][string[]]$RelativePaths)
$ErrorActionPreference='Stop'
$workspaceRoot=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$recoveryRoot=Join-Path $workspaceRoot ('qualification\beta-revision-1\write-repair-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $recoveryRoot | Out-Null
$results=@(foreach($relative in $RelativePaths){
  $target=[System.IO.Path]::GetFullPath((Join-Path $workspaceRoot $relative))
  if(-not $target.StartsWith($workspaceRoot+[System.IO.Path]::DirectorySeparatorChar,[System.StringComparison]::OrdinalIgnoreCase)){throw 'Explicit target must stay inside this checkout'}
  $item=Get-Item -LiteralPath $target
  if($item.PSIsContainer){throw 'File targets only'}
  $hash=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
  $backup=Join-Path $recoveryRoot ([System.IO.Path]::GetRelativePath($workspaceRoot,$target))
  New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
  Copy-Item -LiteralPath $target -Destination $backup
  if((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash -ne $hash){throw 'Backup hash mismatch; no probe performed'}
  $stream=$null
  try{
    $stream=[System.IO.File]::Open($target,[System.IO.FileMode]::Open,[System.IO.FileAccess]::ReadWrite,([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
    if($stream.Length -ne $item.Length){throw 'File changed during backup; no probe performed'}
    # No content is written or truncated: current length is preserved exactly.
    # Observed recovery for this environment's existing-file rewrite failures;
    # this does not assert a particular Windows lock/filter root cause.
    $stream.SetLength($stream.Length)
  }finally{if($stream){$stream.Dispose()}}
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $hash){throw 'Unexpected byte change; backup retained, stop immediately'}
  [pscustomobject]@{Path=$relative;SHA256=$hash;Bytes=$item.Length;Backup=$backup;Result='Same-length operation succeeded; source bytes unchanged'}
})
$results | ConvertTo-Json -Depth 3
