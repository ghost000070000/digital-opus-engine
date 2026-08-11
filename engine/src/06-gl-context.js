function initGL(canvas, settings = { dprCap: 2 }) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL2 is not supported on this device/browser.');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, settings.dprCap);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    // clientWidth/Height can legitimately read 0 (hidden tab, mid-layout,
    // detached iframe) — skip rather than collapsing the drawing buffer.
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  const onVisibility = () => {
    if (!document.hidden) resize();
  };
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  resize();

  return {
    gl,
    resize,
    destroy() {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

// Must be called synchronously right after a draw call, in the same task,
// before the browser has a chance to swap/clear the (non-preserved) backbuffer.
function captureScreenshot(canvas, filename = `screenshot-${Date.now()}.png`) {
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
