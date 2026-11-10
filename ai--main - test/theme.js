(() => {
  const root = document.documentElement;
  const button = document.querySelector('[data-theme-toggle]');
  const meta = document.querySelector('meta[name="theme-color"]');
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const THEME_KEY = 'nexus-theme';
  const labels = {
    dark: '切换到浅色模式',
    light: '切换到深色模式',
  };
  const colors = {
    dark: '#07090e',
    light: '#f3ede2',
  };

  const readStoredTheme = () => {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (error) {
      return null;
    }
  };

  const applyTheme = (theme, persist = false) => {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;

    if (meta) meta.setAttribute('content', colors[nextTheme]);
    if (button) {
      button.setAttribute('aria-label', labels[nextTheme]);
      button.setAttribute('title', labels[nextTheme]);
    }

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, nextTheme);
      } catch (error) {
        /* The system preference remains the fallback when storage is unavailable. */
      }
    }
  };

  applyTheme(root.dataset.theme);

  if (button) {
    button.addEventListener('click', () => {
      const nextTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme, true);
    });
  }

  const syncSystemTheme = (event) => {
    if (readStoredTheme()) return;
    applyTheme(event.matches ? 'light' : 'dark');
  };

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', syncSystemTheme);
  } else if (typeof media.addListener === 'function') {
    media.addListener(syncSystemTheme);
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_KEY) return;
    if (event.newValue === 'light' || event.newValue === 'dark') {
      applyTheme(event.newValue);
    }
  });
})();
