'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'authoring-friction.json');
const REGISTER_PATH = path.join(ROOT, 'AUTHORING-FRICTION-REGISTER.md');
const SUMMARY_PATH = path.join(ROOT, 'AUTHORING-FRICTION-SUMMARY.md');
const TERMINAL_STATES = new Set(['RESOLVED', 'ACCEPTED_LIMITATION', 'DUPLICATE', 'INVALID']);

function readRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function validateRegistry(registry) {
  const errors = [];
  const issues = Array.isArray(registry.issues) ? registry.issues : [];
  const byId = new Map();
  const systems = new Set(registry.systems || []);
  const vocabularies = {
    status: new Set(registry.lifecycle || []),
    severity: new Set(registry.severities || []),
    frequency: new Set(registry.frequencies || []),
    primaryRootCause: new Set(registry.rootCauses || []),
    creatorJourney: new Set(registry.creatorJourneys || []),
    fixLayer: new Set(registry.fixLayers || []),
  };

  if (registry.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (registry.identityFormat !== 'AFR-####') errors.push('identityFormat must be AFR-####');
  for (const issue of issues) {
    if (!/^AFR-\d{4}$/.test(issue.id || '')) errors.push(`${issue.id || '<missing>'}: invalid stable id`);
    if (byId.has(issue.id)) errors.push(`${issue.id}: duplicate stable id`);
    byId.set(issue.id, issue);
    for (const [field, vocabulary] of Object.entries(vocabularies)) {
      if (!vocabulary.has(issue[field])) errors.push(`${issue.id}: invalid ${field} ${issue[field]}`);
    }
    if (!Array.isArray(issue.affectedSystems) || issue.affectedSystems.length === 0) errors.push(`${issue.id}: affectedSystems is required`);
    else for (const system of issue.affectedSystems) if (!systems.has(system)) errors.push(`${issue.id}: unknown affected system ${system}`);
    if (!Array.isArray(issue.reproduction) || issue.reproduction.length === 0) errors.push(`${issue.id}: reproduction is required`);
    if (!Array.isArray(issue.evidence) || issue.evidence.length === 0) errors.push(`${issue.id}: evidence is required`);
    if (['REPRODUCED', 'CONFIRMED', 'PLANNED', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_LIMITATION'].includes(issue.status) && !issue.primaryRootCause) {
      errors.push(`${issue.id}: classified issue requires a primary root cause`);
    }
    if (issue.status === 'DUPLICATE' && !issue.duplicateOf) errors.push(`${issue.id}: duplicateOf is required`);
    if (issue.status !== 'DUPLICATE' && issue.duplicateOf) errors.push(`${issue.id}: duplicateOf is only valid for DUPLICATE`);
    if (issue.status === 'RESOLVED') {
      const resolution = issue.resolution || {};
      for (const key of ['rootCauseAddressed', 'workflowRerun', 'regressionCovered', 'workaroundRemoved', 'gradeReconsidered']) {
        if (resolution[key] !== true) errors.push(`${issue.id}: RESOLVED requires resolution.${key}=true`);
      }
      if (!Number.isInteger(issue.resolvedInPhase)) errors.push(`${issue.id}: RESOLVED requires resolvedInPhase`);
    } else if (issue.resolvedInPhase != null) {
      errors.push(`${issue.id}: resolvedInPhase requires RESOLVED status`);
    }
    if (issue.status === 'ACCEPTED_LIMITATION') {
      const acceptance = issue.acceptance || {};
      for (const key of ['intentionallyBounded', 'reasonableWorkaround', 'disproportionateCost', 'documented']) {
        if (acceptance[key] !== true) errors.push(`${issue.id}: ACCEPTED_LIMITATION requires acceptance.${key}=true`);
        if (typeof acceptance.rationale?.[key] !== 'string' || !acceptance.rationale[key].trim()) errors.push(`${issue.id}: ACCEPTED_LIMITATION requires acceptance.rationale.${key}`);
      }
    }
  }

  for (const issue of issues.filter((entry) => entry.status === 'DUPLICATE')) {
    const canonical = byId.get(issue.duplicateOf);
    if (!canonical) errors.push(`${issue.id}: canonical issue ${issue.duplicateOf} does not exist`);
    else if (canonical.status === 'DUPLICATE') errors.push(`${issue.id}: canonical issue may not itself be a duplicate`);
  }
  return errors;
}

function openCanonicalIssues(registry) {
  return registry.issues.filter((issue) => !TERMINAL_STATES.has(issue.status));
}

function rankCounts(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function metrics(registry) {
  const open = openCanonicalIssues(registry);
  const severity = Object.fromEntries(registry.severities.map((name) => [name, open.filter((issue) => issue.severity === name).length]));
  return {
    total: registry.issues.length,
    open: open.length,
    severity,
    systems: rankCounts(open.flatMap((issue) => issue.affectedSystems)),
    journeys: rankCounts(open.map((issue) => issue.creatorJourney)),
    rootCauses: rankCounts(open.map((issue) => issue.primaryRootCause)),
    fixLayers: rankCounts(open.map((issue) => issue.fixLayer)),
    duplicates: registry.issues.filter((issue) => issue.status === 'DUPLICATE'),
  };
}

function md(value) {
  return String(value == null ? '—' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function generateRegister(registry) {
  const rows = registry.issues.map((issue) => {
    const phase = [`D${String(issue.discoveredInPhase).padStart(3, '0')}`];
    if (issue.targetPhase != null) phase.push(`T${String(issue.targetPhase).padStart(3, '0')}`);
    if (issue.resolvedInPhase != null) phase.push(`R${String(issue.resolvedInPhase).padStart(3, '0')}`);
    const duplicate = issue.duplicateOf ? ` → ${issue.duplicateOf}` : '';
    return `| ${issue.id} | ${md(issue.title)} | ${issue.status}${duplicate} | ${issue.severity} | ${issue.frequency} | ${issue.primaryRootCause} | ${md(issue.creatorJourney)} | ${md(issue.fixLayer)} | ${md(issue.affectedSystems.join(', '))} | ${phase.join(' / ')} |`;
  }).join('\n');

  const details = registry.issues.map((issue) => {
    const evidence = issue.evidence.map((entry) => `  - ${entry.type}: \`${entry.path}\`${entry.note ? ` — ${entry.note}` : ''}`).join('\n');
    const steps = issue.reproduction.map((step, index) => `  ${index + 1}. ${step}`).join('\n');
    const accepted=issue.status==='ACCEPTED_LIMITATION'?`\n\nAccepted limitation (not a claim that the missing feature was implemented):\n\n${[['intentionallyBounded','Supported boundary'],['reasonableWorkaround','Code-free common path'],['disproportionateCost','Why expansion is out of scope'],['documented','Documentation']].map(([key,label])=>`- ${label}: ${md(issue.acceptance?.rationale?.[key])}`).join('\n')}`:'';
    return `### ${issue.id} — ${issue.title}\n\n${issue.observation}\n\nCurrent workaround: ${issue.currentWorkaround}${accepted}\n\nReproduction:\n\n${steps}\n\nEvidence:\n\n${evidence}`;
  }).join('\n\n');

  return `# Authoring Friction Register\n\nThis is the human-readable view of \`authoring-friction.json\`, the machine-readable source of truth. Generate both registry views with \`node tools/authoring-friction-report.js --write\` and validate without writing with \`--check\`. Stable IDs never change when titles, severity, phase linkage, or resolution state changes.\n\n## Operational workflow\n\nOBSERVE → RECORD → REPRODUCE → CLASSIFY → ROOT CAUSE → ASSIGN CORRECT LAYER → FIX → RE-DOGFOOD → VERIFY → CLOSE\n\n## Bounded contract\n\n- States: ${registry.lifecycle.join(', ')}.\n- Severity measures creator impact, never engineering difficulty: CRITICAL blocks a major common capability class; HIGH makes a common workflow inaccessible, error-prone, hidden, or excessively manual; MEDIUM is repeated avoidable but usable friction; LOW is practical polish friction with a workaround.\n- Frequency is separate from severity: ${registry.frequencies.join(', ')}.\n- Every classified issue has one primary root cause, optional contributing causes, one correct fix layer, one creator journey, stable affected-system names, reproducible evidence, and optional phase linkage.\n- RESOLVED requires all five checks: ${registry.resolutionStandard.join('; ')}. Code changed alone is not resolution.\n- ACCEPTED_LIMITATION requires an intentional bound, reasonable workaround, disproportionate engineering cost, and clear documentation.\n- DUPLICATE records keep their own identity and evidence and point to a non-duplicate canonical issue. Historical records are never deleted.\n\n## Registry\n\n| ID | Finding | State | Severity | Frequency | Primary root cause | Creator journey | Correct fix layer | Affected systems | Phase linkage |\n|---|---|---|---|---|---|---|---|---|---|\n${rows}\n\nPhase linkage uses D = discovered, T = target, and R = resolved. A blank target is backlog evidence, not an implicit roadmap commitment.\n\n## Evidence and reproduction\n\n${details}\n`;
}

function rankSection(title, entries, limit = 7) {
  const rows = entries.slice(0, limit).map(([name, count]) => `| ${md(name)} | ${count} |`).join('\n');
  return `## ${title}\n\n| Value | Open issues |\n|---|---:|\n${rows || '| — | 0 |'}`;
}

function generateSummary(registry) {
  const report = metrics(registry);
  const candidates = report.fixLayers.filter(([, count]) => count >= 2).slice(0, 6);
  const candidateRows = candidates.map(([layer, count]) => `- **${layer}** — ${count} open canonical issues share this layer; investigate a reusable layer-level fix before issue-specific runtime additions.`).join('\n');
  return `# Authoring Friction Summary\n\nGenerated deterministically from \`authoring-friction.json\`. This is an evidence summary, not a roadmap.\n\n## Open impact\n\n- Open canonical issues: ${report.open}\n- Open Critical: ${report.severity.CRITICAL}\n- Open High: ${report.severity.HIGH}\n- Open Medium: ${report.severity.MEDIUM}\n- Open Low: ${report.severity.LOW}\n- Accepted limitations (not implemented features): ${registry.issues.filter(issue => issue.status === 'ACCEPTED_LIMITATION').length}\n- Preserved duplicate observations: ${report.duplicates.length}\n\n${rankSection('Top affected systems', report.systems)}\n\n${rankSection('Top creator journeys', report.journeys)}\n\n${rankSection('Top root causes', report.rootCauses)}\n\n${rankSection('Issues by correct fix layer', report.fixLayers)}\n\n## Candidate shared fixes\n\n${candidateRows || '- No fix layer currently has repeated open evidence.'}\n\n## Interpretation rule\n\nCounts prioritize investigation; they do not automatically assign a target phase. Severity, frequency, evidence quality, dependencies, and shared-fix leverage must be reviewed together.\n`;
}

function main() {
  const registry = readRegistry();
  const errors = validateRegistry(registry);
  if (errors.length) {
    console.error(errors.map((error) => `ERROR ${error}`).join('\n'));
    process.exitCode = 1;
    return;
  }
  const register = generateRegister(registry);
  const summary = generateSummary(registry);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(REGISTER_PATH, register);
    fs.writeFileSync(SUMMARY_PATH, summary);
  }
  const report = metrics(registry);
  console.log(`Authoring friction registry valid: ${report.total} records, ${report.open} open canonical, ${report.severity.CRITICAL} Critical, ${report.severity.HIGH} High, ${report.duplicates.length} duplicate observations.`);
}

if (require.main === module) main();

module.exports = { readRegistry, validateRegistry, openCanonicalIssues, rankCounts, metrics, generateRegister, generateSummary };
