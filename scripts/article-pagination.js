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
  var discussionCache = Object.create(null);
  var GISCUS = {
    repo: "TechnoBureau/docs",
    category: "General",
    // The site maps each page to a discussion by its page title.
    strict: "false",
  };

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

  function makeIcon(kind) {
    var paths = {
      calendar:
        '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
      comments:
        '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
      reactions:
        '<path d="M7 10v12M15 5.9 14 10h6.1a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 18.8 21H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3.1l4.1-6.2A1.8 1.8 0 0 1 15 5.9z"/>',
    };
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = paths[kind];
    return svg;
  }

  function formattedDate(item) {
    var raw = item.getAttribute("data-display-date") || item.getAttribute("data-date");
    var date = new Date(raw + "T00:00:00");
    if (isNaN(date.getTime())) return raw || "Date unavailable";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function compactCount(value) {
    var count = Number(value);
    if (!isFinite(count) || count < 0) return "—";
    return new Intl.NumberFormat(undefined, {
      notation: count >= 1000 ? "compact" : "standard",
      maximumFractionDigits: 1,
    }).format(count);
  }

  function getDiscussionStats(title) {
    if (discussionCache[title]) return discussionCache[title];
    var params = new URLSearchParams({
      repo: GISCUS.repo,
      term: title,
      category: GISCUS.category,
      number: "0",
      strict: GISCUS.strict,
      first: "1",
    });
    discussionCache[title] = fetch("https://giscus.app/api/discussions?" + params.toString(), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (response.status === 404) return { comments: 0, reactions: 0 };
        if (!response.ok) throw new Error("Giscus metadata request failed");
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.discussion) {
          if (data && /discussion not found/i.test(data.error || "")) {
            return { comments: 0, reactions: 0 };
          }
          return null;
        }
        return {
          comments: data.discussion.totalCommentCount || 0,
          reactions: data.discussion.reactionCount || 0,
        };
      })
      .catch(function () {
        return null;
      });
    return discussionCache[title];
  }

  function createMetaValue(kind, label, value) {
    var node = document.createElement("span");
    node.className = "tb-article-meta-value tb-article-meta-" + kind;
    node.appendChild(makeIcon(kind));
    var text = document.createElement("span");
    text.className = "tb-article-meta-text";
    text.textContent = value;
    node.appendChild(text);
    node.setAttribute("aria-label", label + ": " + value);
    return node;
  }

  function renderArticleMeta(item) {
    var existing = item.querySelector(":scope > .tb-article-meta");
    if (existing) return;

    var dateKind = item.getAttribute("data-date-kind") || "Updated";
    var title = item.getAttribute("data-title") || "";
    var href = item.getAttribute("data-href") || "#";
    var row = document.createElement("div");
    row.className = "tb-article-meta";
    row.setAttribute("aria-label", "Article details");

    row.appendChild(createMetaValue("calendar", dateKind, formattedDate(item)));

    var comments = document.createElement("a");
    comments.className = "tb-article-meta-value tb-article-meta-comments";
    comments.href = href + "#comments";
    comments.appendChild(makeIcon("comments"));
    var commentText = document.createElement("span");
    commentText.className = "tb-article-meta-text";
    commentText.textContent = "Comments …";
    comments.appendChild(commentText);
    row.appendChild(comments);

    row.appendChild(createMetaValue("reactions", "Reactions", "…"));
    item.appendChild(row);

    getDiscussionStats(title).then(function (stats) {
      var commentValue = stats ? compactCount(stats.comments) : "—";
      var reactionValue = stats ? compactCount(stats.reactions) : "—";
      commentText.textContent = "Comments " + commentValue;
      comments.setAttribute("aria-label", "Comments: " + commentValue + ". Open discussion.");
      var reactionNode = row.querySelector(".tb-article-meta-reactions .tb-article-meta-text");
      reactionNode.textContent = reactionValue;
      row.querySelector(".tb-article-meta-reactions").setAttribute("aria-label", "Reactions: " + reactionValue);
    });
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
      var visible = index >= start && index < end;
      item.style.display = visible ? "" : "none";
      if (visible) renderArticleMeta(item);
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
