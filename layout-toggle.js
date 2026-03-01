(function () {
  const ROOT = document.documentElement;
  const NAV_KEY = 'tb-v2-hide-sidebar';
  const TOC_KEY = 'tb-v2-hide-toc';
  const BUTTONS = {
    nav: null,
    toc: null
  };

  function setState(className, enabled, storageKey) {
    ROOT.classList.toggle(className, enabled);
    localStorage.setItem(storageKey, enabled ? '1' : '0');
  }

  function readState(storageKey) {
    return localStorage.getItem(storageKey) === '1';
  }

  function applySavedState() {
    setState('tb-hide-sidebar', readState(NAV_KEY), NAV_KEY);
    setState('tb-hide-toc', readState(TOC_KEY), TOC_KEY);
    refreshButtonIcons();
  }

  function refreshButtonIcons() {
    if (BUTTONS.nav) {
      BUTTONS.nav.textContent = ROOT.classList.contains('tb-hide-sidebar') ? '\u203A' : '\u2261';
    }
    if (BUTTONS.toc) {
      BUTTONS.toc.textContent = ROOT.classList.contains('tb-hide-toc') ? '\u2039' : '\u2261';
    }
  }

  function addToggle(className, label, storageKey, sideClass) {
    const existing = document.querySelector('.' + sideClass);
    if (existing) return existing;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-edge-toggle ' + sideClass;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.addEventListener('click', function () {
      const next = !ROOT.classList.contains(className);
      setState(className, next, storageKey);
      refreshButtonIcons();
    });

    document.body.appendChild(btn);
    return btn;
  }

  function createControls() {
    if (!window.matchMedia('(min-width: 1280px)').matches) return;
    BUTTONS.nav =
      BUTTONS.nav ||
      addToggle('tb-hide-sidebar', 'Toggle navigation', NAV_KEY, 'tb-nav-toggle');
    BUTTONS.toc =
      BUTTONS.toc ||
      addToggle('tb-hide-toc', 'Toggle on this page', TOC_KEY, 'tb-toc-toggle');
    refreshButtonIcons();
  }

  function init() {
    applySavedState();
    createControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('resize', createControls);
  window.addEventListener('pageshow', function () {
    applySavedState();
    createControls();
  });
})();
