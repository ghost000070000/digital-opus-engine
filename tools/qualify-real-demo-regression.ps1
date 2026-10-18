# Direct-shell equivalent of the Node gate runner for Windows environments
# where nested captured subprocesses fail generated-artifact writes.
$ErrorActionPreference = 'Stop'
$taskNode = 'C:/Users/THINKPAD/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$taskRun = 'regression-direct-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$taskDir = Join-Path $taskRoot ('qualification/real-demo-collision/' + $taskRun)
New-Item -ItemType Directory -Path $taskDir | Out-Null
function Read-Fingerprint { & $taskNode -e "console.log(require('./tools/real-demo-program-state').fingerprint())" }
$taskFingerprint = Read-Fingerprint
$taskProof = [ordered]@{runId=$taskRun; startedAt=[DateTime]::UtcNow.ToString('o'); fingerprint=$taskFingerprint; status='IN_PROGRESS'; gates=@()}
function Save-Proof { $taskProof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $taskDir 'results.json') -Encoding utf8 }
Save-Proof
try {
  foreach ($taskFile in @('tests/run-tests.js','build/build.js','build/build-games.js','build/build-engine-site.js','build/build-games-site.js')) {
    if ((Read-Fingerprint) -ne $taskFingerprint) { throw 'Source fingerprint changed' }
    $taskStarted = [DateTime]::UtcNow.ToString('o')
    Start-Transcript -LiteralPath (Join-Path $taskDir ($taskFile.Replace('/','-') + '.log')) | Out-Null
    try { & $taskNode $taskFile; $taskCode = $LASTEXITCODE } finally { Stop-Transcript | Out-Null }
    $taskProof.gates += @{file=$taskFile; startedAt=$taskStarted; endedAt=[DateTime]::UtcNow.ToString('o'); exitCode=$taskCode}
    Save-Proof
    Write-Output "$taskFile exit=$taskCode"
    if ($taskCode -ne 0) { throw "$taskFile failed; preserved log" }
  }
  $taskCount = 0
  foreach ($taskFolder in @('engine/src','editor/src','tools','tests','build')) {
    foreach ($taskFile in Get-ChildItem -LiteralPath $taskFolder -File -Filter '*.js') {
      & $taskNode --check $taskFile.FullName
      if ($LASTEXITCODE -ne 0) { throw "Syntax failed: $($taskFile.FullName)" }
      $taskCount++
    }
  }
  $taskProof.gates += @{label='syntax';files=$taskCount;status='PASS'}
  & $taskNode -e "const fs=require('fs');for(const d of ['games','qualification/autonomous-product-program'])for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.json')))JSON.parse(fs.readFileSync(d+'/'+f,'utf8'));for(const f of ['no-code-capabilities.json','authoring-friction.json'])JSON.parse(fs.readFileSync(f,'utf8'));"
  if ($LASTEXITCODE -ne 0) { throw 'JSON failed' }
  $taskProof.gates += @{label='json';status='PASS'}
  git diff --check
  if ($LASTEXITCODE -ne 0) { throw 'Diff check failed' }
  $taskProof.gates += @{label='diff';status='PASS'}
  $taskProof.finalFingerprint = Read-Fingerprint
  if ($taskProof.finalFingerprint -ne $taskFingerprint) { throw 'Final fingerprint drift' }
  $taskProof.status = 'COMMAND_GATES_PASSED_NOT_GAMEPLAY_ACCEPTANCE'
} catch {
  $taskProof.status = 'COMMAND_GATE_FAILURE_NOT_COLLISION_VERDICT'
  $taskProof.failure = $_.ToString()
} finally {
  $taskProof.endedAt = [DateTime]::UtcNow.ToString('o')
  Save-Proof
  Write-Output ($taskProof | ConvertTo-Json -Depth 10 -Compress)
}
if ($taskProof.status -ne 'COMMAND_GATES_PASSED_NOT_GAMEPLAY_ACCEPTANCE') { exit 1 }
