'use strict';

// Phase 010: one machine-readable capability catalog generates both audited
// Markdown views. --init is a one-time migration from the Phase 009 inventory;
// ordinary use is --write or --check and never reads grades from Markdown.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(ROOT, 'no-code-capabilities.json');
const INVENTORY = path.join(ROOT, 'CURRENT-AUTHORING-SURFACE-INVENTORY.md');
const DASHBOARD = path.join(ROOT, 'NO-CODE-CAPABILITY-DASHBOARD.md');
const GRADES = ['A', 'B', 'C', 'D', 'N/A'];
const SUPPORT = ['yes', 'partial', 'no', 'not_applicable'];

const categorySets = {
  Foundation: ['Scene/Object Creation', 'Transform', 'Hierarchy', 'Components', 'Gameplay Presets', 'Onboarding', 'Templates'],
  Assets: ['Prefabs', 'Mesh Assets', 'Texture Assets', 'Audio Assets', 'Materials', 'Import'],
  'World and Rendering': ['Sprites / 2D', 'Tilemaps', 'Terrain', 'Lighting', 'Cameras', 'Particles', 'Scatter', 'Paths', 'World-building tools', 'Fog Zones', 'Audio Zones'],
  Gameplay: ['Colliders', 'Trigger Volumes', 'Player Controllers', 'Health', 'Damage', 'Weapons', 'Projectiles', 'Items', 'Inventory', 'Equipment', 'Objectives'],
  Logic: ['Input Actions', 'Rebinding', 'AI', 'AI State Machine', 'Navigation', 'Behaviors', 'Variables', 'Signals / Events', 'Node Graph'],
  Presentation: ['Dialogue', 'HUD', 'Menus', 'Animation', 'Animation Events', 'Sequences', 'Transitions'],
  Project: ['Save Game', 'Levels', 'Export', 'Debugging', 'Validation', 'Custom Script'],
};
function categoryFor(name) { return Object.entries(categorySets).find(([, names]) => names.includes(name))?.[0] || 'Other'; }
function idFor(name) { return name.toLowerCase().replace(/\//g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function support(value) { return value === 'Y' ? 'yes' : value === 'P' ? 'partial' : value === 'N' ? 'no' : 'not_applicable'; }
function yn(value) { return value === 'yes' ? 'Y' : value === 'partial' ? 'P' : value === 'no' ? 'N' : '—'; }
function validationFor(name, grade) {
  if (['Components', 'Gameplay Presets', 'Scene/Object Creation', 'Transform', 'Levels', 'Export'].includes(name)) return 'yes';
  if (['Sprites / 2D', 'Tilemaps', 'Custom Script', 'Onboarding'].includes(name)) return 'not_applicable';
  return grade === 'D' ? 'no' : 'partial';
}
function phaseFor(name) {
  if (name === 'Components') return { owningPhase: 2, lastImprovedPhase: 7, evidence: ['PHASE-002-REPORT.md', 'docs/PHASE_007_CHARACTERIZATION.md', 'tests/phase-007-add-component.test.js'] };
  if (name === 'Gameplay Presets') return { owningPhase: 8, lastImprovedPhase: 8, evidence: ['PHASE-008-REPORT.md', 'tests/phase-008-gameplay-presets.test.js'] };
  if (name === 'Onboarding') return { owningPhase: 9, lastImprovedPhase: 9, evidence: ['PHASE-009-REPORT.md', 'tests/phase-009-onboarding.test.js', 'phase-009-dogfood.json'] };
  if (name === 'Validation') return { owningPhase: 3, lastImprovedPhase: 6, evidence: ['PHASE-003-REPORT.md', 'PHASE-006-REPORT.md'] };
  if (name === 'Templates') return { owningPhase: 1, lastImprovedPhase: 9, evidence: ['PHASE-008-REPORT.md', 'PHASE-009-REPORT.md'] };
  if (['Behaviors', 'Node Graph', 'Variables', 'Signals / Events'].includes(name)) return { owningPhase: 1, lastImprovedPhase: 5, evidence: ['PHASE-005-REPORT.md'] };
  return { owningPhase: 1, lastImprovedPhase: 1, evidence: ['PHASE-001-REPORT.md'] };
}
function splitFact(text) {
  const match = text.match(/^(.*?)(?:;|, but|\. No |\. There is no | but )(.*)$/);
  if (!match) return { explanation: text, limitations: gradeNeutralLimit(text) };
  return { explanation: match[1].trim().replace(/\.$/, '') + '.', limitations: match[2].trim().replace(/^but\s+/i, '') };
}
function gradeNeutralLimit(text) { return /\b(no |lack|limited|missing|partial|awkward|buried|weak|manual|free-typed)/i.test(text) ? text : 'No material common-path limitation recorded.'; }

function init() {
  if (fs.existsSync(CATALOG)) throw new Error('Catalog already exists; --init is intentionally one-time.');
  const markdown = fs.readFileSync(INVENTORY, 'utf8');
  const friction = JSON.parse(fs.readFileSync(path.join(ROOT, 'authoring-friction.json'), 'utf8'));
  const lines = markdown.split(/\r?\n/).filter((line) => /^\| [^|-].* \|$/.test(line) && !line.startsWith('| System '));
  const capabilities = lines.map((line) => {
    const c = line.split('|').slice(1, -1).map((v) => v.trim());
    const name = c[0]; const grade = c[11]; const fact = splitFact(c[12]); const phase = phaseFor(name);
    return { id: idFor(name), displayName: name, category: categoryFor(name), grade, runtimeSupport: support(c[1]), creatorUI: support(c[3]), saveLoad: support(c[8]), export: support(c[9]), validation: validationFor(name, grade), discoverability: support(c[2]), status: grade === 'D' ? 'missing_common_path' : grade === 'N/A' ? 'advanced' : grade === 'C' ? 'partial' : 'available', explanation: fact.explanation, limitations: fact.limitations, evidence: phase.evidence, knownFrictionIds: friction.issues.filter((issue) => issue.affectedSystems.includes(name)).map((issue) => issue.id), owningPhase: phase.owningPhase, lastImprovedPhase: phase.lastImprovedPhase, legacy: { rawIds: support(c[4]), names: support(c[5]), json: support(c[6]), script: support(c[7]), pleasant: c[10] } };
  });
  capabilities.push(
    { id: 'components', displayName: 'Components', category: 'Foundation', grade: 'B', runtimeSupport: 'yes', creatorUI: 'yes', saveLoad: 'yes', export: 'yes', validation: 'yes', discoverability: 'yes', status: 'available', explanation: 'Searchable Add Component discovers eligible schema-backed data and adds it with one Undo transaction.', limitations: 'The registry currently proves a bounded component set; broader component conversion remains future work.', evidence: phaseFor('Components').evidence, knownFrictionIds: ['AFR-0003'], owningPhase: 2, lastImprovedPhase: 7, legacy: { rawIds: 'no', names: 'no', json: 'no', script: 'no', pleasant: 'Good' } },
    { id: 'gameplay-presets', displayName: 'Gameplay Presets', category: 'Foundation', grade: 'B', runtimeSupport: 'yes', creatorUI: 'yes', saveLoad: 'yes', export: 'yes', validation: 'yes', discoverability: 'yes', status: 'available', explanation: 'Seven searchable one-click roles create ordinary editable components, behaviors, and animation data.', limitations: 'This is a bounded common-role catalog, not a genre-template system.', evidence: phaseFor('Gameplay Presets').evidence, knownFrictionIds: [], owningPhase: 8, lastImprovedPhase: 8, legacy: { rawIds: 'no', names: 'partial', json: 'no', script: 'no', pleasant: 'Good' } }
  );
  const templates = capabilities.find((c) => c.id === 'templates');
  templates.grade = 'B'; templates.status = 'available'; templates.creatorUI = 'yes'; templates.discoverability = 'yes'; templates.validation = 'partial'; templates.explanation = 'Examples, palette presets, Gameplay Presets, and the first-run chooser cover common starting paths.'; templates.limitations = 'No broad genre-template catalog or guided customization system yet.';
  capabilities.sort((a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName));
  const catalog = { schemaVersion: 1, generatedFrom: 'Epoch 01 repository evidence', gradeDefinitions: { A: 'Fully no-code authorable', B: 'No-code common path', C: 'Partial/awkward', D: 'Runtime-only/missing common path', 'N/A': 'intentionally code/advanced' }, baselinePhase001: { A: 4, B: 28, C: 19, D: 3, 'N/A': 1, total: 55, note: 'Original Phase 001 inventory. Components and Gameplay Presets were not separate rows.' }, normalizedPhase001: { A: 4, B: 28, C: 19, D: 5, 'N/A': 1, total: 57, note: 'Adds Components and Gameplay Presets as D baseline rows for like-for-like comparison.' }, capabilities };
  fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
}

function validate(catalog) {
  const friction = JSON.parse(fs.readFileSync(path.join(ROOT, 'authoring-friction.json'), 'utf8'));
  const frictionIds = new Set(friction.issues.map((i) => i.id)); const ids = new Set(); const errors = [];
  if (catalog.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  for (const c of catalog.capabilities || []) {
    for (const key of ['id', 'displayName', 'category', 'grade', 'runtimeSupport', 'creatorUI', 'saveLoad', 'export', 'validation', 'discoverability', 'evidence', 'knownFrictionIds', 'owningPhase', 'lastImprovedPhase', 'explanation', 'limitations']) if (c[key] == null) errors.push(`${c.id || '?'} missing ${key}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id)) errors.push(`${c.id} invalid stable id`);
    if (ids.has(c.id)) errors.push(`${c.id} duplicate stable id`); ids.add(c.id);
    if (!GRADES.includes(c.grade)) errors.push(`${c.id} invalid grade`);
    for (const key of ['runtimeSupport', 'creatorUI', 'saveLoad', 'export', 'validation', 'discoverability']) if (!SUPPORT.includes(c[key])) errors.push(`${c.id} invalid ${key}`);
    if (!Array.isArray(c.evidence) || !c.evidence.length) errors.push(`${c.id} missing evidence`);
    else c.evidence.forEach((ref) => { if (!fs.existsSync(path.join(ROOT, ref))) errors.push(`${c.id} missing evidence file ${ref}`); });
    (c.knownFrictionIds || []).forEach((id) => { if (!frictionIds.has(id)) errors.push(`${c.id} unknown friction ${id}`); });
  }
  return errors;
}
function counts(catalog) { return Object.fromEntries(GRADES.map((g) => [g, catalog.capabilities.filter((c) => c.grade === g).length])); }
function generateInventory(catalog) {
  const tally = counts(catalog);
  const rows = catalog.capabilities.map((c) => `| ${c.displayName} | ${yn(c.runtimeSupport)} | ${yn(c.discoverability)} | ${yn(c.creatorUI)} | ${yn(c.saveLoad)} | ${yn(c.export)} | ${yn(c.validation)} | ${c.legacy.pleasant} | ${c.grade} | ${c.explanation} ${c.limitations} | ${c.knownFrictionIds.join(', ') || '—'} |`).join('\n');
  return `# Current Authoring Surface Inventory\n\n> Generated from \`no-code-capabilities.json\` by \`node tools/build-capability-dashboard.js --write\`. Edit the catalog, not this table.\n\n## Audit basis\n\nEpoch 01 reassessment after Phases 004–009, grounded in checked-in tests, phase reports, browser dogfood, editor implementation, and the 28 public projects. The lowest grade supported by the complete creator journey wins.\n\nLegend: **Y** yes, **P** partial, **N** no, **—** not applicable.\n\n| System | Runtime | Discoverable | UI complete | Save/load | Export | Validation | Pleasant | Grade | Current evidence and limiting fact | Friction |\n|---|---:|---:|---:|---:|---:|---:|---|:---:|---|---|\n${rows}\n\n## Coverage totals\n\n- **A:** ${tally.A} systems\n- **B:** ${tally.B} systems\n- **C:** ${tally.C} systems\n- **D:** ${tally.D} systems\n- **N/A:** ${tally['N/A']} systems\n- **Total inventoried:** ${catalog.capabilities.length} systems\n\n## Honest creator qualification\n\nA beginner can now discover and complete a small 3D no-code game through the Guided First Game. A broader blank-project gauntlet proves Player, environment, Components, multiple Presets, interaction, state, HUD, win, Save/Load, and Playable Export. C-grade systems still require hidden naming, cross-panel coordination, or weak validation. Sprites/2D and Tilemaps remain D and are the leading Epoch 02 gap.\n`;
}
function generateDashboard(catalog) {
  const tally = counts(catalog); const friction = JSON.parse(fs.readFileSync(path.join(ROOT, 'authoring-friction.json'), 'utf8'));
  const open = friction.issues.filter((i) => !['RESOLVED', 'DUPLICATE', 'INVALID', 'ACCEPTED_LIMITATION'].includes(i.status));
  const resolved = friction.issues.filter((i) => i.status === 'RESOLVED' && i.resolvedInPhase >= 4 && i.resolvedInPhase <= 9);
  const pressure = [...new Set(open.filter((i) => ['CRITICAL', 'HIGH'].includes(i.severity)).flatMap((i) => i.affectedSystems))].map((system) => [system, open.filter((i) => ['CRITICAL', 'HIGH'].includes(i.severity) && i.affectedSystems.includes(system)).length]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const rows = catalog.capabilities.map((c) => `| ${c.displayName} | ${c.category} | ${c.grade} | ${c.status.replace(/_/g, ' ')} | ${c.explanation} | ${c.limitations} | ${c.knownFrictionIds.join(', ') || '—'} | ${c.evidence.map((e) => `\`${e}\``).join(', ')} | ${c.lastImprovedPhase} |`).join('\n');
  return `# No-Code Capability Dashboard\n\n> Authoritative data: \`no-code-capabilities.json\`. This Markdown and the editor Dashboard are generated/rendered views, not separate scoring sources.\n\n## Canonical grades\n\n- **A — Fully no-code authorable**\n- **B — No-code common path**\n- **C — Partial/awkward**\n- **D — Runtime-only/missing common path**\n- **N/A — intentionally code/advanced**\n\n## Epoch 01 totals\n\nA ${tally.A} · B ${tally.B} · C ${tally.C} · D ${tally.D} · N/A ${tally['N/A']} · Total ${catalog.capabilities.length}. Original Phase 001: A 4 · B 28 · C 19 · D 3 · N/A 1 (55 rows). Like-for-like normalized Phase 001: A 4 · B 28 · C 19 · D 5 · N/A 1 (57 rows).\n\n## Friction trend\n\n- Accepted limitations (not implemented features): ${friction.issues.filter(i => i.status === 'ACCEPTED_LIMITATION').length}\n- Open Critical: ${open.filter((i) => i.severity === 'CRITICAL').length}\n- Open High: ${open.filter((i) => i.severity === 'HIGH').length}\n- Most pressured systems: ${pressure.slice(0, 8).map(([s, n]) => `${s} (${n})`).join(', ')}\n- Resolved in Phases 004–009: ${resolved.map((i) => `${i.id} (${i.title})`).join(', ') || 'none'}\n\n## Catalog\n\nUse the editor's searchable/filterable **Help → No-Code Capabilities** view for interactive filtering.\n\n| Capability | Category | Grade | Status | What works | Limitations | Friction | Evidence | Last improved |\n|---|---|:---:|---|---|---|---|---|---:|\n${rows}\n`;
}
function main() {
  if (process.argv.includes('--init')) init();
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8')); const errors = validate(catalog);
  if (errors.length) { errors.forEach((e) => console.error(`ERROR ${e}`)); process.exit(1); }
  const inventory = generateInventory(catalog).replace(
    'Sprites/2D and Tilemaps remain D and are the leading Epoch 02 gap.',
    'Sprite, ordered Tilemap Layers, eligible Character collision, modern XY Platformer/Topdown controllers and named input have discoverable no-code paths. General Dynamic rigid-body physics, drop-through controls and pixel-perfect Camera projection remain unsupported. Existing read-only diagnostics, persistent starter discovery and the local Creator Guide complement those workflows. Current catalog grades, cited phase evidence and explicit limitations above are authoritative; subsystem grades alone do not establish integrated product readiness.',
  );
  const dashboard = generateDashboard(catalog);
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(INVENTORY, 'utf8') !== inventory) throw new Error('CURRENT-AUTHORING-SURFACE-INVENTORY.md is stale');
    if (fs.readFileSync(DASHBOARD, 'utf8') !== dashboard) throw new Error('NO-CODE-CAPABILITY-DASHBOARD.md is stale');
  } else { fs.writeFileSync(INVENTORY, inventory); fs.writeFileSync(DASHBOARD, dashboard); }
  console.log(`Capability catalog valid: ${catalog.capabilities.length} capabilities; ${GRADES.map((g) => `${g}=${counts(catalog)[g]}`).join(', ')}`);
}
main();
