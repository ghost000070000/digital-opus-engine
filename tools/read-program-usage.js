'use strict';
// Read-only documented Codex app-server API; never starts a thread/turn or
// redeems a reset. Run in the authorized host context, not an unauthenticated
// sandbox account. https://learn.chatgpt.com/docs/app-server
const { spawn } = require('child_process');
const executable = process.env.DOE_CODEX_EXECUTABLE || 'C:/Users/THINKPAD/AppData/Local/OpenAI/Codex/bin/2e5e00daee91c61d/codex.exe';
const child = spawn(executable, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
let buffer = '', finished = false;
function finish(value, failed = false) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), ...value }));
  if (failed) process.exitCode = 1;
  child.kill(); // Only this read-only helper, never another qualification process.
}
function send(value) { child.stdin.write(JSON.stringify(value) + '\n'); }
child.on('error', error => finish({ status: 'USAGE_UNAVAILABLE', error: error.message }, true));
child.on('exit', code => { if (!finished) finish({ status: 'USAGE_UNAVAILABLE', exitCode: code }, true); });
child.stderr.on('data', () => {}); // Do not print account diagnostics or credentials.
child.stdout.on('data', data => {
  buffer += data;
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
    let message; try { message = JSON.parse(line); } catch { continue; }
    if (message.id === 1) {
      if (message.error) { finish({ status: 'USAGE_UNAVAILABLE', error: message.error.message }, true); continue; }
      send({ method: 'initialized', params: {} });
      send({ method: 'account/rateLimits/read', id: 2 });
    }
    if (message.id !== 2) continue;
    if (message.error) { finish({ status: 'USAGE_UNAVAILABLE', error: message.error.message }, true); continue; }
    const result = message.result || {}, limits = result.rateLimitsByLimitId?.codex || result.rateLimits;
    const project = value => value ? { usedPercent: value.usedPercent, remainingPercent: 100 - value.usedPercent, windowDurationMins: value.windowDurationMins, resetsAtUnix: value.resetsAt } : null;
    finish({ status: 'FRESH_ACCOUNT_USAGE', ordinaryUsageAllowed: result.ordinaryUsageAllowed,
      coreWindows: [limits?.primary, limits?.secondary].filter(Boolean).map(project),
      availableBankedResets: result.rateLimitResetCredits?.availableCount ?? null,
      missingWindowPolicy: 'UNAVAILABLE_NOT_ZERO' });
  }
});
const timeout = setTimeout(() => finish({ status: 'USAGE_UNAVAILABLE', error: 'Read timed out' }, true), 20000);
send({ method: 'initialize', id: 1, params: { clientInfo: { name: 'digital_opus_usage_guard', title: 'Digital Opus usage guard', version: '1.0.0' } } });
