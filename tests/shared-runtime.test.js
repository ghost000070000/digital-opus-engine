'use strict';
// Hosted Playable pages share one engine/editor runtime file; exports stay single-file.
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const { composeExportHTML } = require('../build/export-template.js');
const htmlTemplate = fs.readFileSync(path.join(root, 'editor/index.html'), 'utf8');
const base = { htmlTemplate, engineJS: '/*ENGINE*/', editorJS: '/*EDITOR*/', templateJS: '/*COMPOSER*/', embeddedProjectJSON: '{"levels":[]}', title: 'T' };
const tagsOnly = (html) => html.replace(/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/g, '');

const standalone = composeExportHTML({ ...base, playableOnly: true });
assert(standalone.includes('/*ENGINE*/') && standalone.includes('/*EDITOR*/'), 'default Playable export inlines the runtime');
assert.strictEqual([...tagsOnly(standalone).matchAll(/<script[^>]+src=/g)].length, 0, 'default export has no external scripts');

const hosted = composeExportHTML({ ...base, playableOnly: true, sharedRuntime: { engineSrc: 'opus-engine-runtime.abc.js', editorSrc: 'opus-editor-runtime.def.js' } });
assert(!hosted.includes('/*ENGINE*/') && !hosted.includes('/*EDITOR*/'), 'hosted page does not inline the runtime');
const srcs = [...tagsOnly(hosted).matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
assert.deepStrictEqual(srcs, ['opus-engine-runtime.abc.js', 'opus-editor-runtime.def.js'], 'engine loads before editor, in place of the inline scripts');
assert(hosted.indexOf('__OPUS_EMBEDDED_PROJECT__') < hosted.indexOf('opus-engine-runtime.abc.js'), 'embedded project flags run first');
assert(hosted.includes('/*COMPOSER*/'), 'composer stays inline');

assert.throws(() => composeExportHTML({ ...base, playableOnly: false, sharedRuntime: { engineSrc: 'a.js', editorSrc: 'b.js' } }), /only valid for Playable/, 'Editable exports must stay self-contained');
const sanitized = composeExportHTML({ ...base, playableOnly: true, sharedRuntime: { engineSrc: 'x.js" onload="alert(1)', editorSrc: 'y.js' } });
assert(!/onload=/.test(tagsOnly(sanitized)), 'runtime paths cannot inject attributes');
console.log('Shared runtime: hosted Playable pages reference one cached runtime; exports stay single-file PASS');
