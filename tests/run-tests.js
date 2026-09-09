// Builds the distributable artifacts, then runs the dependency-free Node tests
// against the exact public bundle that engine users receive.
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function run(script) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script)], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(path.join('build', 'build.js'));
run(path.join('tests', 'public-api.test.js'));
run(path.join('tests', 'showcase-quality.test.js'));
run(path.join('tests', 'public-site-build.test.js'));
