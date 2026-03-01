(function () {
  const ROOT = document.documentElement;
  const NAV_CLASS = 'tb-hide-sidebar';
  const TOC_CLASS = 'tb-hide-toc';

  function clearOldState() {
    ROOT.classList.remove(NAV_CLASS, TOC_CLASS);
    localStorage.removeItem('tb-hide-sidebar');
    localStorage.removeItem('tb-hide-toc');
    localStorage.removeItem('tb-v2-hide-sidebar');
    localStorage.removeItem('tb-v2-hide-toc');
  }

  function button(sideClass) {
    return document.querySelector('.' + sideClass);
  }

  function updateIcons() {
    const nav = button('tb-nav-toggle');
    const toc = button('tb-toc-toggle');
    if (nav) nav.textContent = ROOT.classList.contains(NAV_CLASS) ? '\u203A' : '\u2261';
    if (toc) toc.textContent = ROOT.classList.contains(TOC_CLASS) ? '\u2039' : '\u2261';
  }

  function addToggle(sideClass, aria, onClick) {
    if (button(sideClass)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-edge-toggle ' + sideClass;
    btn.setAttribute('aria-label', aria);
    btn.setAttribute('title', aria);
    btn.addEventListener('click', onClick);
    document.body.appendChild(btn);
  }

  function ensureControls() {
    if (!window.matchMedia('(min-width: 1280px)').matches) return;

    addToggle('tb-nav-toggle', 'Toggle navigation', function () {
      ROOT.classList.toggle(NAV_CLASS);
      updateIcons();
    });

    addToggle('tb-toc-toggle', 'Toggle on this page', function () {
      ROOT.classList.toggle(TOC_CLASS);
      updateIcons();
    });

    updateIcons();
  }

  function init() {
    clearOldState();
    ensureControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('resize', ensureControls);
})();
