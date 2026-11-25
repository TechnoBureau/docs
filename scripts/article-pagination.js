/**
 * Article list pagination for TechnoBureau index pages (DevOps, Kubernetes, Linux).
 *
 * Documentation.AI (Atlas template) loads this file once per full page load and then
 * swaps page content on client-side navigation, so this script:
 *   - finds the article list on the current index page ([data-tb-article-list]),
 *   - sorts items by data-date descending (newest modified first),
 *   - shows PAGE_SIZE items per page with Prev / numbered / Next controls,
 *   - re-initialises when the route changes.
 *
 * Index pages opt in by wrapping their article cards like this:
 *
 *   <div className="tb-article-list" data-tb-article-list data-page-size="5">
 *     <div className="tb-article-item" data-tb-article-item data-date="2026-11-26">
 *       <Card ... horizontal={true} cta="Read more">Summary…</Card>
 *     </div>
 *     …
 *   </div>
 *
 * Without JavaScript every article stays visible (progressive enhancement).
 * To regenerate index pages sorted by git modified date, run:
 *   python3 scripts/generate-index-pages.py
 */
(function () {
  "use strict";

  var LIST_SELECTOR = "[data-tb-article-list]";
  var ITEM_SELECTOR = "[data-tb-article-item]";
  var PAGINATION_CLASS = "tb-pagination";
  var DEFAULT_PAGE_SIZE = 5;

  var started = false;
  var lastPath = "";
  var currentList = null;
  var currentPage = 1;

  function normalizePath(pathname) {
    return (pathname || "").replace(/\/+$/, "") || "/";
  }

  function getPageSize(list) {
    var raw = list.getAttribute("data-page-size");
    var size = parseInt(raw, 10);
    return size > 0 ? size : DEFAULT_PAGE_SIZE;
  }

  function getDateValue(item) {
    var raw = item.getAttribute("data-date") || "";
    var time = Date.parse(raw);
    return isNaN(time) ? 0 : time;
  }

  function sortByModifiedDate(items) {
    // Newest first. Items without a parseable date keep their relative order
    // (Array.prototype.sort is stable in modern browsers).
    return items.slice().sort(function (a, b) {
      return getDateValue(b) - getDateValue(a);
    });
  }

  function removePagination(list) {
    var existing = list.parentNode
      ? list.parentNode.querySelector("." + PAGINATION_CLASS)
      : null;
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  }

  function createButton(label, page, options) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tb-pagination-btn";
    btn.textContent = label;
    btn.setAttribute("data-page", String(page));
    if (options && options.disabled) btn.disabled = true;
    if (options && options.current) {
      btn.classList.add("tb-pagination-btn-current");
      btn.setAttribute("aria-current", "page");
    }
    if (options && options.label) btn.setAttribute("aria-label", options.label);
    return btn;
  }

  function renderPagination(list, totalPages, page) {
    removePagination(list);
    if (totalPages <= 1) return;

    var nav = document.createElement("nav");
    nav.className = PAGINATION_CLASS;
    nav.setAttribute("aria-label", "Articles pagination");

    var prev = createButton("← Prev", page - 1, {
      disabled: page <= 1,
      label: "Previous page",
    });
    nav.appendChild(prev);

    for (var i = 1; i <= totalPages; i++) {
      nav.appendChild(
        createButton(String(i), i, {
          current: i === page,
          label: "Page " + i,
        })
      );
    }

    var next = createButton("Next →", page + 1, {
      disabled: page >= totalPages,
      label: "Next page",
    });
    nav.appendChild(next);

    nav.addEventListener("click", function (event) {
      var target = event.target.closest("button[data-page]");
      if (!target || target.disabled) return;
      var nextPage = parseInt(target.getAttribute("data-page"), 10);
      if (nextPage >= 1 && nextPage <= totalPages && nextPage !== currentPage) {
        showPage(list, nextPage, true);
      }
    });

    list.parentNode.insertBefore(nav, list.nextSibling);
  }

  function showPage(list, page, scrollToList) {
    var items = Array.prototype.slice.call(list.querySelectorAll(ITEM_SELECTOR));
    var pageSize = getPageSize(list);
    var totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    page = Math.min(Math.max(1, page), totalPages);
    currentPage = page;

    var start = (page - 1) * pageSize;
    var end = start + pageSize;

    items.forEach(function (item, index) {
      item.style.display = index >= start && index < end ? "" : "none";
    });

    renderPagination(list, totalPages, page);

    if (scrollToList && list.scrollIntoView) {
      list.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function initList(list) {
    if (!list) return;

    // Atlas may preserve a rendered node while changing routes. Reuse it but
    // reset the visible slice when it becomes the active index again.
    if (list.getAttribute("data-tb-pagination-ready")) {
      currentList = list;
      showPage(list, 1, false);
      return;
    }

    var items = Array.prototype.slice.call(list.querySelectorAll(ITEM_SELECTOR));
    if (items.length === 0) return;

    // Enforce modified-date order (newest first) in the DOM.
    sortByModifiedDate(items).forEach(function (item) {
      list.appendChild(item);
    });

    list.setAttribute("data-tb-pagination-ready", "");
    currentList = list;
    showPage(list, 1, false);
  }

  function sync() {
    var path = normalizePath(window.location.pathname);
    var list = document.querySelector(LIST_SELECTOR);

    if (list) {
      if (list !== currentList || path !== lastPath) {
        // New list (route changed): reset and initialise.
        currentList = null;
        currentPage = 1;
        initList(list);
      }
    } else {
      currentList = null;
      currentPage = 1;
    }
    lastPath = path;
  }

  function scheduleSync() {
    window.setTimeout(sync, 80);
    window.setTimeout(sync, 320);
    window.setTimeout(sync, 800);
  }

  function handleNavigation() {
    scheduleSync();
  }

  function patchHistory() {
    if (window.__tbPaginationHistoryPatched) return;
    window.__tbPaginationHistoryPatched = true;

    ["pushState", "replaceState"].forEach(function (method) {
      var original = window.history[method];
      window.history[method] = function () {
        var result = original.apply(this, arguments);
        handleNavigation();
        return result;
      };
    });

    window.addEventListener("popstate", handleNavigation);
  }

  function observePage() {
    if (!("MutationObserver" in window) || !document.body) return;
    var observer = new MutationObserver(function (mutations) {
      var external = mutations.some(function (mutation) {
        var node =
          mutation.target.nodeType === 1
            ? mutation.target
            : mutation.target.parentElement;
        // Ignore mutations caused by our own pagination controls.
        return !(node && node.closest("." + PAGINATION_CLASS));
      });
      if (external) scheduleSync();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    if (started) return;
    started = true;
    lastPath = normalizePath(window.location.pathname);
    patchHistory();
    observePage();
    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
