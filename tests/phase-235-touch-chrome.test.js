'use strict';
const fs=require('fs'),assert=require('assert'),html=fs.readFileSync(require.resolve('../editor/index.html'),'utf8');
const block=html.match(/@media \(pointer: coarse\) \{([\s\S]*?)\n  \}/);assert(block,'Coarse-only authoring chrome sizing must exist');for(const selector of ['#top-bar button','.tab-btn','.gizmo-mode-btn','.surface-help','#narrow-left-toggle','#narrow-right-toggle'])assert(block[1].includes(selector));assert.match(block[1],/min-width: 44px; min-height: 44px/);assert(!block[1].includes('#game'));assert(!block[1].includes('.touch-mapped-btn'));console.log('Phase235 coarse-pointer-only core editor chrome sizing; canvas/gameplay/fine-pointer policy unchanged PASS');

