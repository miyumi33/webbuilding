/* =========================================================
   NEXUS AI — mobile navigation behaviour
   The menu is a native <details>; this keeps it usable on
   touch: it closes after a jump, on outside tap, on Escape,
   and when the layout switches back to desktop navigation.
   ========================================================= */

(() => {
  const menu = document.querySelector('.mobile-menu');
  if (!menu) return;

  const summary = menu.querySelector('summary');
  const links = menu.querySelectorAll('nav a');

  const closeMenu = () => {
    if (menu.open) menu.open = false;
  };

  links.forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('click', (event) => {
    if (!menu.open) return;
    if (menu.contains(event.target)) return;
    closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu.open) return;
    closeMenu();
    if (summary) summary.focus();
  });

  const desktop = window.matchMedia('(min-width: 1025px)');
  const syncLayout = () => {
    if (desktop.matches) closeMenu();
  };

  if (typeof desktop.addEventListener === 'function') {
    desktop.addEventListener('change', syncLayout);
  } else if (typeof desktop.addListener === 'function') {
    desktop.addListener(syncLayout);
  }
})();
