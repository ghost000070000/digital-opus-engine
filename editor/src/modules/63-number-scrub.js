// ===== Drag-to-scrub number fields =====
// In the Inspector (and the animation keyframe rows), press on a number field
// and drag left/right to change it; a plain click still places the cursor
// for typing. Shift = 10x faster, Alt = 10x finer. A scrub is one Undo step:
// fields record Undo when focused and apply their value on each input event,
// so the scrub focuses once, sends input while dragging, change on release.

const NUMBER_SCRUB_SCOPE = '#inspector-body, .anim-track-card';
let numberScrub = null; // { input, startX, startValue, step, moved, pointerId }

function numberScrubStep(input) {
  const step = Number(input.step);
  return Number.isFinite(step) && step > 0 ? step : 0.1;
}
function numberScrubDecimals(step) {
  const text = String(step);
  return text.includes('e-') ? Number(text.split('e-')[1]) : (text.split('.')[1] || '').length;
}
// The value after dragging dx pixels (each pixel moves one step).
function numberScrubValue(startValue, dx, step, { fast = false, fine = false, min = -Infinity, max = Infinity } = {}) {
  const factor = fast ? 10 : fine ? 0.1 : 1;
  const raw = startValue + dx * step * factor;
  const decimals = numberScrubDecimals(step * (fine ? 0.1 : 1));
  const rounded = Number((Math.round(raw / (step * (fine ? 0.1 : 1))) * step * (fine ? 0.1 : 1)).toFixed(Math.min(10, decimals)));
  return Math.max(min, Math.min(max, rounded));
}

document.addEventListener('pointerdown', (event) => {
  const input = event.target;
  if (playMode || event.button !== 0 || !(input instanceof HTMLInputElement) || input.type !== 'number' || input.disabled || input.readOnly) return;
  if (!input.closest(NUMBER_SCRUB_SCOPE) || document.activeElement === input) return; // already typing: normal text editing
  const box = input.getBoundingClientRect();
  if (event.clientX > box.right - 18) return; // the spinner arrows keep working
  if (input.value === '') return; // blank = mixed values: type one rather than scrub from zero
  event.preventDefault(); // decide between click (type) and drag (scrub) on release
  const startValue = Number(input.value);
  numberScrub = { input, startX: event.clientX, startValue: Number.isFinite(startValue) ? startValue : 0, step: numberScrubStep(input), moved: false, pointerId: event.pointerId };
}, true);
window.addEventListener('pointermove', (event) => {
  const scrub = numberScrub;
  if (!scrub || event.pointerId !== scrub.pointerId) return;
  const dx = event.clientX - scrub.startX;
  if (!scrub.moved) {
    if (Math.abs(dx) < 3) return;
    scrub.moved = true;
    scrub.input.focus(); // the field's own Undo checkpoint
    document.body.classList.add('number-scrubbing');
  }
  const input = scrub.input;
  const min = input.min === '' ? -Infinity : Number(input.min), max = input.max === '' ? Infinity : Number(input.max);
  const value = numberScrubValue(scrub.startValue, dx, scrub.step, { fast: event.shiftKey, fine: event.altKey, min, max });
  if (String(value) !== input.value) {
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
window.addEventListener('pointerup', (event) => {
  const scrub = numberScrub;
  if (!scrub || event.pointerId !== scrub.pointerId) return;
  numberScrub = null;
  document.body.classList.remove('number-scrubbing');
  if (!scrub.moved) { scrub.input.focus(); scrub.input.select(); return; } // a click: type a value
  scrub.input.dispatchEvent(new Event('change', { bubbles: true }));
  scrub.input.blur();
});
window.addEventListener('blur', () => { numberScrub = null; document.body.classList.remove('number-scrubbing'); });
