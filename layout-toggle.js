(function () {
  const ROOT = document.documentElement;
  const NAV_KEY = 'tb-v2-hide-sidebar';
  const TOC_KEY = 'tb-v2-hide-toc';

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
  }

  function addToggle(className, label, storageKey, sideClass) {
    if (document.querySelector('.' + sideClass)) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-edge-toggle ' + sideClass;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.textContent = '\u2261';

    btn.addEventListener('click', function () {
      const next = !ROOT.classList.contains(className);
      setState(className, next, storageKey);
    });

    document.body.appendChild(btn);
  }

  function createControls() {
    if (!window.matchMedia('(min-width: 1280px)').matches) return;
    addToggle('tb-hide-sidebar', 'Toggle navigation', NAV_KEY, 'tb-nav-toggle');
    addToggle('tb-hide-toc', 'Toggle on this page', TOC_KEY, 'tb-toc-toggle');
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
})();
