'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const friction = require('../tools/authoring-friction-report');

const ROOT = path.resolve(__dirname, '..');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const registry = friction.readRegistry();
const byId = new Map(registry.issues.map((issue) => [issue.id, issue]));
const report = friction.metrics(registry);
// Preserve the positive clustering oracle for the pre-disposition findings;
// accepting a documented boundary does not erase its historical impact.
const historical=JSON.parse(JSON.stringify(registry));for(const issue of historical.issues)if(issue.status==='ACCEPTED_LIMITATION')issue.status='CONFIRMED';
const historicalReport=friction.metrics(historical);

test('registry contract validates', () => assert.deepStrictEqual(friction.validateRegistry(registry), []));
test('stable id format is AFR-####', () => assert.strictEqual(registry.identityFormat, 'AFR-####'));
test('every record has a unique stable id', () => assert.strictEqual(byId.size, registry.issues.length));
test('all 20 Phase 001 findings are preserved', () => {
  for (let index = 1; index <= 20; index++) assert(byId.has(`AFR-${String(index).padStart(4, '0')}`));
});
test('lifecycle is bounded to nine documented states', () => assert.strictEqual(registry.lifecycle.length, 9));
test('severity is separate from frequency', () => registry.issues.forEach((issue) => assert(issue.severity && issue.frequency)));
test('severity vocabulary has four impact levels', () => assert.deepStrictEqual(registry.severities, ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']));
test('frequency vocabulary has four bounded values', () => assert.deepStrictEqual(registry.frequencies, ['ONCE', 'OCCASIONAL', 'REPEATED', 'PERVASIVE']));
test('every classified issue declares one primary root cause', () => registry.issues.forEach((issue) => assert(registry.rootCauses.includes(issue.primaryRootCause))));
test('every issue declares one correct fix layer', () => registry.issues.forEach((issue) => assert(registry.fixLayers.includes(issue.fixLayer))));
test('every affected system uses the inventory vocabulary', () => registry.issues.flatMap((issue) => issue.affectedSystems).forEach((system) => assert(registry.affectedSystems ? registry.affectedSystems.includes(system) : registry.systems.includes(system))));
test('every issue declares a creator journey', () => registry.issues.forEach((issue) => assert(registry.creatorJourneys.includes(issue.creatorJourney))));
test('every issue carries reproduction evidence', () => registry.issues.forEach((issue) => assert(issue.reproduction.length && issue.evidence.length)));
test('phase assignment remains optional', () => assert(registry.issues.some((issue) => issue.targetPhase == null)));
test('duplicate records retain identity and canonical linkage', () => report.duplicates.forEach((issue) => assert(byId.has(issue.duplicateOf))));
test('qualified240 dispositions distinguish five resolved, nineteen accepted and two duplicate findings', () => {assert.strictEqual(report.open,0);assert.strictEqual(registry.issues.filter(x=>x.status==='RESOLVED').length,5);assert.strictEqual(registry.issues.filter(x=>x.status==='ACCEPTED_LIMITATION').length,19);assert.strictEqual(report.duplicates.length,2);});
test('historical Critical impact remains visible after accepted scope disposition', () => {assert.strictEqual(historicalReport.severity.CRITICAL,1);assert.strictEqual(report.severity.CRITICAL,0);});
test('historical High impact remains visible after accepted scope disposition', () => {assert.strictEqual(historicalReport.severity.HIGH,12);assert.strictEqual(report.severity.HIGH,0);});
test('historical top creator journey remains Add Gameplay', () => assert.deepStrictEqual(historicalReport.journeys[0], ['Add Gameplay', 8]));
test('historical affected systems retain repeated friction evidence', () => { assert.deepStrictEqual(historicalReport.systems[0], ['Behaviors', 6]); assert(historicalReport.systems.some(([system]) => system === 'Player Controllers')); });
test('historical fix-layer clustering survives terminal disposition', () => assert.deepStrictEqual(historicalReport.fixLayers.slice(0, 4), [['component', 5], ['project model', 3], ['viewport/direct manipulation', 3], ['asset pipeline', 2]]));
test('RESOLVED cannot be asserted without five closure checks', () => {
  const copy = JSON.parse(JSON.stringify(registry));
  copy.issues[0].status = 'RESOLVED';
  copy.issues[0].resolvedInPhase = 4;
  assert(friction.validateRegistry(copy).filter((error) => error.includes('RESOLVED requires')).length >= 5);
});
test('ACCEPTED_LIMITATION cannot hide an undocumented issue', () => {
  const copy = JSON.parse(JSON.stringify(registry));
  copy.issues[0].status = 'ACCEPTED_LIMITATION';
  delete copy.issues[0].acceptance;
  assert(friction.validateRegistry(copy).some((error) => error.includes('ACCEPTED_LIMITATION requires')));
});

test('accepted limits need individual reasons beyond four checkboxes and publish those reasons', () => {
  const copy=JSON.parse(JSON.stringify(registry)),issue=copy.issues[0];issue.status='ACCEPTED_LIMITATION';issue.resolvedInPhase=null;
  issue.acceptance={intentionallyBounded:true,reasonableWorkaround:true,disproportionateCost:true,documented:true};
  assert.strictEqual(friction.validateRegistry(copy).filter(error=>error.includes('acceptance.rationale.')).length,4);
  issue.acceptance.rationale={intentionallyBounded:'Explicit narrow contract',reasonableWorkaround:'Keep manual | names',disproportionateCost:'Avoid a second runtime',documented:'Published supported boundary'};
  assert.deepStrictEqual(friction.validateRegistry(copy),[]);
  const view=friction.generateRegister(copy);assert(view.includes('not a claim that the missing feature was implemented'));assert(view.includes('Code-free common path: Keep manual \\| names'));assert(view.includes('Why expansion is out of scope: Avoid a second runtime'));
  delete issue.acceptance.rationale.documented;assert(friction.validateRegistry(copy).some(error=>error.includes('acceptance.rationale.documented')));
});
test('generated register preserves every stable id', () => {
  const markdown = friction.generateRegister(registry);
  registry.issues.forEach((issue) => assert(markdown.includes(issue.id)));
});
test('generated summary is explicitly not a roadmap', () => assert(friction.generateSummary(registry).includes('not a roadmap')));
test('checked-in human register preserves dogfood duplicates', () => {
  const markdown = fs.readFileSync(path.join(ROOT, 'AUTHORING-FRICTION-REGISTER.md'), 'utf8');
  assert(markdown.includes('AFR-0021') && markdown.includes('AFR-0022') && markdown.includes('AFR-0003'));
});
test('checked-in summary reports required open counts', () => {
  const markdown = fs.readFileSync(path.join(ROOT, 'AUTHORING-FRICTION-SUMMARY.md'), 'utf8');
  assert(markdown.includes('Open Critical: 0') && markdown.includes('Open High: 0') && markdown.includes('Accepted limitations (not implemented features): 19'));
});

let failures = 0;
for (const entry of tests) {
  try { entry.fn(); console.log(`ok ${tests.indexOf(entry) + 1} - ${entry.name}`); }
  catch (error) { failures++; console.error(`not ok ${tests.indexOf(entry) + 1} - ${entry.name}\n  ${error.stack}`); }
}
console.log(`\nPhase 004 authoring friction registry: ${tests.length - failures} passed, ${failures} failed`);
if (failures) process.exitCode = 1;
