(() => {
  const stage = document.getElementById('particle-stage');
  const root = document.documentElement;

  if (!stage || typeof window.ParticleNet !== 'function') return;

  const palettes = {
    light: {
      color: '0, 0, 0',
      lineColor: '0, 0, 0',
      opacity: 0.3,
    },
    dark: {
      color: '255, 255, 255',
      lineColor: '255, 255, 255',
      opacity: 0.27,
    },
  };

  const currentTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');

  let net = null;

  try {
    net = new window.ParticleNet(stage, {
      count: 99,
      linkDistance: 79,
      mouseRadius: 145,
      dotSize: 1,
      fade: false,
      density: true,
      baseArea: 1280 * 800,
      minCount: 22,
      maxCount: 180,
      speed: 0.65,
      interactive: true,
      motion: 'respect',
      ...palettes[currentTheme()],
    });
  } catch (error) {
    stage.hidden = true;
    return;
  }

  const applyPalette = () => {
    if (!net) return;
    net.set(palettes[currentTheme()]);
  };

  new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.attributeName === 'data-theme')) {
      applyPalette();
    }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
