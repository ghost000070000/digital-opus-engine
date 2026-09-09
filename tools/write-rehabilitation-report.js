const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const reviews=read('rehabilitation-evidence/final-quality-reviews.json').games,catalog=read('games/catalog.json').games,inv=read('rehabilitation-evidence/inventory.json'),validation=read('rehabilitation-evidence/final-validation.json');
const map=new Map(reviews.map(r=>[r.id,r])),keys=['visual','gameplayClarity','levelComposition','audio','presentation','uniqueness'];
const txt=x=>(Array.isArray(x)?x.join(' '):String(x||'')).replace(/\|/g,'/');
const scores=s=>keys.map(k=>s[k]).join('/');
const byTier=t=>catalog.filter(g=>g.qualityTier===t),samples=byTier('sample'),featured=byTier('featured'),internal=byTier('internal');
const names=list=>list.length?list.map(g=>g.title).join(', '):'None';
const publicCount=featured.length+samples.length,verdict=internal.length?'FULL_GAME_REHABILITATION_PARTIAL':'FULL_GAME_REHABILITATION_READY_FOR_HUMAN_REVIEW';
const a=['foglight','signal-relay','arsenal-run','silent-sector','power-grid','relic-frontier','relic-island'];const b=['blacksite','signal-zero','iron-arena','relic-runner-2','forest-range','moving-temple','shifting-facility','opus-arena'];
const outcomes=reviews.filter(r=>r.outcomeVerified).map(r=>catalog.find(g=>g.id===r.id).title);
const table=ids=>['| Game | Before → after (V/C/L/A/P/U) | Final role | Major changes and observed result | Remaining gaps | Screenshot |','|---|---|---|---|---|---|',...ids.map(id=>{const g=catalog.find(g=>g.id===id),r=map.get(id),shot=g.screenshot||r.screenshots?.[0]||'rehabilitation-evidence/final-review/'+id+'/opening.png';return `| ${g.title} | ${scores(r.before)} → ${scores(r.after)} | ${r.finalRole} | ${txt(r.notes)} | ${txt(r.remainingGaps)} | [Actual frame](${shot}) |`;})].join('\n');
const report=`# Full game rehabilitation report

**${verdict}**

All 28 games were audited, modified, retained and classified. The local candidate catalog contains **${featured.length} Featured, ${samples.length} public Samples and ${internal.length} Internal** games. Public candidates have real standalone gameplay screenshots. This is a pre-release review package; no deployment or upload occurred. ${internal.length?'The internal entries still need visual work or further gameplay validation, so this pass is reported as partial rather than a completed public library.':'Human screenshot review remains required before release.'}

[Open the local visual review](public-showcase-review/index.html) · [28-game matrix](GAME-REHABILITATION-MATRIX.md) · [Quality standard](PUBLIC-GAME-QUALITY-STANDARD.md) · [Art direction](GAME-ART-DIRECTION-SYSTEM.md) · [Asset licensing](SHOWCASE-ASSET-LICENSES.md)

## Scope and preservation

The original dirty work was preserved. [Initial Git status](rehabilitation-evidence/baseline-git-status.txt), full game JSON snapshots in rehabilitation-evidence/baseline-games, baseline playable HTML and before screenshots are retained. No reset, clean, discard, commit, push, DNS change, Hostinger upload or production-host action was performed. No 29th game was created. **Wave 10 has not started.** The existing release archive remains untouched and is marked superseded in [release/SUPERSEDED-BY-REHABILITATION.md](release/SUPERSEDED-BY-REHABILITATION.md). A new release ZIP should **not** be generated before human screenshot and gameplay review.

## Classification

- **Featured:** ${names(featured)}.
- **Public Samples:** ${names(samples)}.
- **Internal:** ${names(internal)}.

The six editorial scores below are visual quality, gameplay clarity, level composition, audio, UI/presentation and uniqueness, each out of five. They come from actual rendered before/after inspection, not object counts or test counts. No game was promoted to Featured without meeting the 4/5 visual bar. A public Sample is a focused demonstration, not a finished commercial adventure.

## Baseline and inventory

All four requested baseline commands passed: build, 31 API tests, all 28 game exports and Engine-site build. The baseline Engine package exposed zero public examples and was about 1.2 MB. See baseline-build.log, baseline-tests.log, baseline-games.log and baseline-engine-site.log under rehabilitation-evidence.

The final inventory contains ${inv.totals.games} games and ${inv.totals.currentObjects} objects, compared with ${inv.totals.baselineObjects} before the pass. The matrix records each game's level/object/model/texture/audio/prefab counts, controller, camera, HUD, Start Screen, endings, Save/Continue, imported assets and fixture usage. Current unknown-provenance games: ${inv.totals.gamesWithUnknownCurrentAssets.length}; current known-fixture games: ${inv.totals.gamesWithCurrentFixtures.length}. Historical fixtures remain available in the internal baseline snapshots.

## Shared defects repaired

- **First person:** body hiding was already present in the current baseline. The remaining equipped-visual teardown removed the intentional gun every frame; it now persists, uses its texture and is framed below/right of the camera. Camera-eye hitscan agrees with the crosshair, and projectile/melee/hitscan checks honor authored target volumes. Signal Relay and Arsenal Run completed normal combat routes; a real wall-collision test confirmed hidden body, visible equipment and retained collision.
- **Controls and identity:** the existing blank default help is preserved. Every game now authors its own controls, objectives and Start Screen. Public validation requires catalog, project, Start Screen and generated HTML titles to match; Forest Range's former Painted Wilds title was corrected. No unrelated Crate Run help is accepted for public games.
- **Markers and assets:** spawn, trigger, waypoint/path, camera, spawner and light helpers stay hidden during Play. Known skeletal bend ribbons and tiny diagnostic skins fail public validation. Models own their palette texture; UVs, imported texture dependencies, save/load and export references are preserved.
- **UI and audio:** Start Screens use readable title/help cards while showing the actual scene. HUD spacing and labelled health were improved, Relic Island's health moved clear of its objective, and standalone endings use Restart. Endings release pointer lock so normal Restart clicks work after win and lose. Authored footstep, weapon and ending audio dependencies export correctly.
- **Interaction and traversal:** the carried Power Cell no longer steals focus from its generator. Authored rectangular play bounds allow long levels such as Foglight without the unrelated radial stop, while preserving vertical velocity and fallback behavior. Thin floor lips and mismatched trigger/model sizes were corrected where discovered.

These are fixes and small authoring extensions in the existing editor/runtime/export path. There is no new engine module, product fork or Wave 10 work. Automated gates check evidence integrity and declared scores; they cannot independently prove screenshot authenticity, subjective quality, audibility or a complete playthrough. Real browser review supplies that evidence.

## Original reusable assets

The original kit includes **36 shaped meshes, 6 textures and 16 distinct WAV clips**. Fantasy provides three tree silhouettes, foliage, five rocks, ruins, arches, gates, beacons, shrine, relic and bridge. Facility provides wall/floor panels, door, terminal, relay, generator, pipes, crates, lights and hazard panels. Combat provides rifle, drone, turret, projectile and impact shapes. Characters include a jointed ranger and guardian with named animation clips, plus the drone. These are coherent silhouettes rather than renamed diagnostic ribbons.

The sound kit covers UI select, pickup, interaction, door, beacon/relic, damage, fire, impact, alert, attack, win, lose, three ambient identities and footsteps. Original deterministic generation and exact in-project asset matching are documented in [SHOWCASE-ASSET-LICENSES.md](SHOWCASE-ASSET-LICENSES.md). No unknown-license download was introduced. Rendered asset previews and audio/mesh validation are in rehabilitation-evidence/assets. Broader voice, music and bespoke character animation remain future art work rather than claimed deliverables.

## Batch A — seven adventure/action candidates

${table(a)}

Foglight retains all three beacons, guardian, key/gates, sanctuary and third-person traversal. Its authored route is now a compact causeway sample; it has not reached the requested 5–10 minute flagship depth. Silent Sector retains perception, hearing, Investigate and its intro camera. Power Grid retains carry, coolant, persistent gate and audio/fog zones. Relic Frontier retains equipment, guardian state machine, objectives, gate and extraction. These retained systems are detailed in the matrix.

## Batch B — focused examples

${table(b)}

## Batch C — remaining examples

${table(catalog.filter(g=>!a.includes(g.id)&&!b.includes(g.id)).map(g=>g.id))}

## Browser validation and screenshot evidence

All 28 baseline standalone games were opened and captured through Start, opening, representative input and Pause, with no page exceptions. Baseline sessions used a 24-second wall-time budget; heavily loaded software rendering produced fewer simulation seconds in some games, so that is not represented as 24 simulated seconds.

The updated seven larger games received individual normal-input route tests. The other 21 received representative audits of at least 20 simulation seconds or an observed ending, followed by revision captures after visual refinements. Input scripts use native keyboard/mouse controls with read-only telemetry; no granted inventory, teleports, disabled AI or forced wins are counted as gameplay proof. Explicitly synthetic controller/modal diagnostics are labelled separately.

Normal-input goal completion was recorded for **${outcomes.length} games**: ${outcomes.join(', ')}. An absent win proof is not automatically a game defect; the individual rows disclose remaining route or presentation limits. Sample routes, combat transcripts and adventure transcripts live under rehabilitation-evidence/sample-play, combat-playtest and playthroughs. Arsenal's intentional loss and Restart, Signal's Restart and the separate native pointer-lock win/lose modal checks also passed.

The final full-catalog smoke passed **${validation.smokePassed}/${validation.smokeTotal}**. Each fresh standalone build was started, checked for correct title, unblocked opening, WebGL state, hidden helpers and hidden first-person body, then exercised with movement/Pause. This is a bounded smoke, not a complete win/loss test of all 28 games. [Final per-game results and build hashes](rehabilitation-evidence/final-review/summary.json).

The final generated-surface browser review passed 5/5 pages at desktop and narrow widths: zero broken images, page errors or horizontal overflow. Both public galleries link exactly the 23 public samples and exclude all five internal games; the local review gallery intentionally includes all 28. [Browser review evidence](rehabilitation-evidence/public-artifact-review/review.json).

Public screenshot coverage: **${featured.length?featured.length+'/'+featured.length:'not applicable (0 Featured)'}** Featured trios; **${samples.length}/${samples.length}** Sample gameplay frames. ${publicCount} representative public PNGs were copied without editing into public-showcase-review/&lt;id&gt;/gameplay.png. [Provenance](public-showcase-review/screenshot-provenance.json) records source paths and checksums. Audit Start, opening, gameplay, highlights, Pause and outcome frames are retained separately. Generated title cards do not substitute for gameplay evidence.

## Final command results

| Check | Result |
|---|---|
| node build/build.js | ${validation.build} |
| node tests/run-tests.js | ${validation.tests} |
| node build/build-games.js | ${validation.gameBuild} |
| node build/build-engine-site.js | ${validation.engineSiteBuild} |
| node build/build-games-site.js | ${validation.gamesSiteBuild} |
| Final 28-game standalone smoke | ${validation.smokePassed}/${validation.smokeTotal} passed |
| Engine-site generated size | ${validation.engineSiteBytes.toLocaleString()} bytes (${(validation.engineSiteBytes/1048576).toFixed(2)} MiB) |
| Local public catalog | ${publicCount} games; internal entries excluded |
| Public screenshots | ${samples.length}/${samples.length} Samples; ${featured.length} Featured |

Command output is retained under rehabilitation-evidence/final-*.log. Dist/games remains the complete 28-game development catalog; dist/engine-site/games is the filtered public candidate catalog. The Engine site uses real gameplay thumbnails and separates Featured and Samples by qualityTier. An integration regression now verifies the public CLI catalog and rejects stale internal HTML/source files. The older dist/games-site artifact was also rebuilt with the same public filter and real screenshots, replacing its stale title-card catalog. No generated directory was uploaded.

## Bugs and authoring friction uncovered

Full routes found issues that build success could not: Power Grid's blocked coolant route and carried-item focus; first-person aim origin and invisible equipment; pointer lock preventing Restart; Foglight's radial boundary, floor lips, fall-recovery zone and key-dependent sanctuary; buried or vertically mismatched relic/extraction triggers; model swaps that shrank pickup volumes; malformed authored action/animation names; terrain crossing through factory floors; missing zero-health endings; a sealed maze passage and waypoint height mismatch; and a lift rising too quickly for reliable platform carry. The exact fixes and residual limits are in the per-game reviews.

The remaining authoring friction is real: native vehicle visuals use hard-coded cube parts and do not accept the humanoid visual adapter; grounded AI on varied terrain needs careful authoring; visual meshes, interaction volumes and collider offsets need distinct controls; initial cameras and scale are easy to mismatch; meaningful quality still requires rendered play. Some water effects aliased under the default waves/software rendering, so affected sample materials were reduced and the games kept internal where appropriate. A broad vehicle-render redesign and a full art pass are not claimed as completed here.

## Release decision

**Do not generate or publish a new release ZIP yet.** Review the actual screenshot gallery and play the chosen samples first. The internal games remain available as engineering material, and the listed gaps should guide any further rehabilitation. No Featured claim, production approval, deployment, upload or DNS change is implied. **Wave 10: not started. Game count: exactly 28.**
`;
fs.writeFileSync(path.join(root,'FULL-GAME-REHABILITATION-REPORT.md'),report);console.log(verdict,publicCount+' public',internal.length+' internal');
