(function () {
  'use strict';

  var ROOT      = document.documentElement;
  var NAV_CLS   = 'tb-hide-sidebar';
  var TOC_CLS   = 'tb-hide-toc';
  var NAV_KEY   = 'tb-sidebar-hidden';
  var TOC_KEY   = 'tb-toc-hidden';
  var DESKTOP   = window.matchMedia('(min-width: 1280px)');

  /* ── SVG chevron arrows (lightweight, no external deps) ── */
  var CHEVRON_R = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  var CHEVRON_L = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

  /* ── Helpers ── */
  function hasEl(id) { return !!document.getElementById(id); }
  function btn(cls)  { return document.querySelector('.' + cls); }

  function toggle(cls, storageKey) {
    ROOT.classList.toggle(cls);
    var hidden = ROOT.classList.contains(cls);
    try { localStorage.setItem(storageKey, hidden ? '1' : '0'); } catch (_) {}
    syncIcons();
  }

  /* ── Restore persisted state ── */
  function restoreState() {
    try {
      if (localStorage.getItem(NAV_KEY) === '1') ROOT.classList.add(NAV_CLS);
      if (localStorage.getItem(TOC_KEY) === '1') ROOT.classList.add(TOC_CLS);
    } catch (_) {}
  }

  /* ── Icon sync ── */
  function syncIcons() {
    var nav = btn('tb-nav-toggle');
    var toc = btn('tb-toc-toggle');
    if (nav) nav.innerHTML = ROOT.classList.contains(NAV_CLS) ? CHEVRON_R : CHEVRON_L;
    if (toc) toc.innerHTML = ROOT.classList.contains(TOC_CLS) ? CHEVRON_L : CHEVRON_R;
  }

  /* ── Create a toggle button ── */
  function addBtn(cls, label, onClick) {
    if (btn(cls)) return;
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'tb-toggle-btn ' + cls;
    el.setAttribute('aria-label', label);
    el.setAttribute('title', label);
    el.addEventListener('click', onClick);
    document.body.appendChild(el);
  }

  /* ── Build / tear-down controls based on viewport + DOM ── */
  function ensureControls() {
    var isDesktop = DESKTOP.matches;
    var navExists = hasEl('sidebar');
    var tocExists = hasEl('table-of-contents-layout');

    /* Navigation toggle */
    if (isDesktop && navExists) {
      addBtn('tb-nav-toggle', 'Toggle sidebar', function () {
        toggle(NAV_CLS, NAV_KEY);
      });
    }

    /* ToC toggle */
    if (isDesktop && tocExists) {
      addBtn('tb-toc-toggle', 'Toggle table of contents', function () {
        toggle(TOC_CLS, TOC_KEY);
      });
    }

    /* Remove buttons that no longer apply */
    if (!isDesktop || !navExists) {
      var nb = btn('tb-nav-toggle');
      if (nb) nb.remove();
      ROOT.classList.remove(NAV_CLS);
    }
    if (!isDesktop || !tocExists) {
      var tb = btn('tb-toc-toggle');
      if (tb) tb.remove();
      ROOT.classList.remove(TOC_CLS);
    }

    syncIcons();
  }

  /* ── Initialise ── */
  function init() {
    restoreState();
    ensureControls();

    /* Re-check after Mintlify SPA navigations */
    new MutationObserver(function () {
      ensureControls();
    }).observe(document.getElementById('content-area') || document.body, {
      childList: true, subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Respond to viewport changes */
  DESKTOP.addEventListener('change', ensureControls);
})();
