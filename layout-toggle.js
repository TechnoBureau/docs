(function () {
  const ROOT = document.documentElement;
  const NAV_KEY = 'tb-hide-sidebar';
  const TOC_KEY = 'tb-hide-toc';

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

  function createControls() {
    const desktop = window.matchMedia('(min-width: 1280px)').matches;
    if (!desktop || document.querySelector('.tb-layout-controls')) {
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'tb-layout-controls';

    const navBtn = document.createElement('button');
    navBtn.type = 'button';
    navBtn.textContent = 'Toggle Nav';
    navBtn.addEventListener('click', function () {
      const next = !ROOT.classList.contains('tb-hide-sidebar');
      setState('tb-hide-sidebar', next, NAV_KEY);
    });

    const tocBtn = document.createElement('button');
    tocBtn.type = 'button';
    tocBtn.textContent = 'Toggle On This Page';
    tocBtn.addEventListener('click', function () {
      const next = !ROOT.classList.contains('tb-hide-toc');
      setState('tb-hide-toc', next, TOC_KEY);
    });

    wrap.appendChild(navBtn);
    wrap.appendChild(tocBtn);
    document.body.appendChild(wrap);
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
