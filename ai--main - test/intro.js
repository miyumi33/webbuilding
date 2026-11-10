/* =========================================================
   NEXUS AI — opening animation controller

   The <head> boot script adds `intro-play` / `intro-armed`
   before first paint, so nothing flashes. This file runs the
   short boot sequence, then dissolves the overlay and lets
   the hero entrance play underneath it.

   Replay: index.html?intro=1   Disable: ?intro=0
   ========================================================= */

(() => {
  const root = document.documentElement;
  const overlay = document.getElementById('nexus-intro');

  if (!overlay) return;

  const api = (window.__NEXUS_INTRO__ = window.__NEXUS_INTRO__ || { done: false });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seenKey = 'nexus-intro-seen';

  // The <head> gate decides whether this load plays the sequence.
  if (!root.classList.contains('intro-play')) {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    api.done = true;
    return;
  }

  const fillEl = overlay.querySelector('[data-intro-fill]');
  const numEl = overlay.querySelector('[data-intro-num]');
  const logEl = overlay.querySelector('[data-intro-console]');
  const skipEl = overlay.querySelector('[data-intro-skip]');

  const BOOT_LOG = [
    { label: 'INIT / NEURAL CORE', value: 'OK' },
    { label: 'LINK / MEMBER NODES', value: '128' },
    { label: 'SCAN / PROJECT TRACKS', value: '14' },
    { label: 'LOCK / CAMPUS SIGNAL', value: 'STABLE' },
    { label: 'READY / INTERFACE', value: 'OK' },
  ];

  /* Timeline (ms). The CSS keyframes follow the same clock. */
  const COUNT_MS = 2000;
  const LOG_START = 330;
  const LOG_STEP = 185;
  const EXIT_AT = 2140;
  const EXIT_MS = 1020;
  const FAST_MS = 280;

  let timers = [];
  let frame = 0;
  let exiting = false;
  let finished = false;

  const after = (ms, fn) => {
    timers.push(window.setTimeout(fn, ms));
  };

  const clearTimers = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  const setProgress = (value) => {
    const percent = Math.max(0, Math.min(100, Math.round(value)));
    if (fillEl) fillEl.style.width = percent + '%';
    if (numEl) numEl.textContent = String(percent).padStart(3, '0');
  };

  const addLogLine = (line, index) => {
    if (!logEl) return;
    const row = document.createElement('div');
    row.className = 'intro__log';

    const idx = document.createElement('span');
    idx.className = 'intro__log-idx';
    idx.textContent = String(index + 1).padStart(2, '0') + '›';

    const label = document.createElement('span');
    label.className = 'intro__log-label';
    label.textContent = line.label;

    const value = document.createElement('span');
    value.className = 'intro__log-val' + (line.value === 'OK' ? ' intro__log-val--ok' : '');
    value.textContent = line.value;

    row.append(idx, label, value);
    logEl.append(row);
  };

  const markSeen = () => {
    try {
      window.sessionStorage.setItem(seenKey, '1');
    } catch (error) {
      /* Private mode or file:// without storage — the splash simply plays again. */
    }
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    api.done = true;
    clearTimers();
    root.classList.remove('intro-play', 'intro-armed');
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    markSeen();
    window.dispatchEvent(new CustomEvent('nexus:intro-done'));
  };

  const exit = (fast) => {
    if (exiting) return;
    exiting = true;
    clearTimers();

    // Let the hero assemble while the overlay dissolves.
    root.classList.remove('intro-armed');

    if (reduceMotion) {
      overlay.classList.add('is-done');
      finish();
      return;
    }

    setProgress(100);
    overlay.classList.add('is-exiting');
    if (fast) overlay.classList.add('is-fast');
    after(fast ? FAST_MS : EXIT_MS, finish);
  };

  const skip = () => exit(true);

  /* ---- sequence ---- */

  if (reduceMotion) {
    setProgress(100);
    after(140, skip);
  } else {
    const start = window.performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased * 100);
      if (t < 1 && !exiting) {
        frame = window.requestAnimationFrame(tick);
      } else if (!exiting) {
        frame = 0;
      }
    };
    frame = window.requestAnimationFrame(tick);

    BOOT_LOG.forEach((line, index) => {
      after(LOG_START + index * LOG_STEP, () => addLogLine(line, index));
    });

    after(EXIT_AT, () => exit(false));
  }

  /* ---- skip affordances ---- */

  overlay.addEventListener('click', skip);
  overlay.addEventListener('wheel', skip, { passive: true });
  overlay.addEventListener('touchmove', skip, { passive: true });

  if (skipEl) {
    skipEl.addEventListener('click', (event) => {
      event.stopPropagation();
      skip();
    });
  }

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab') return;
      skip();
    },
    { passive: true }
  );
})();
