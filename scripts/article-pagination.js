/**
 * Article list pagination for TechnoBureau index pages (DevOps, Kubernetes, Linux).
 *
 * Documentation.AI (Atlas template) loads this file once per full page load and then
 * swaps page content on client-side navigation, so this script:
 *   - creates article cards from the generated frontmatter manifest,
 *   - sorts them by Markdown modified date (newest first),
 *   - shows five items per page with Prev / numbered / Next controls,
 *   - fetches Giscus stats for the visible cards,
 *   - re-initialises when the route changes.
 *
 * The three index MDX files contain only their title and intro. To regenerate
 * the manifest after changing article files, run:
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
  var INDEX_SECTIONS = {
    "/devops": { key: "devops", title: "DevOps Tutorials" },
    "/kubernetes": { key: "kubernetes", title: "Kubernetes Tutorials" },
    "/linux": { key: "linux", title: "Linux Tutorials" },
  };
  var ARTICLE_ICON_PATHS = {
    sparkles: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14z"/>',
    "code-xml": '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>',
    "layers-3": '<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
    server: '<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    network: '<circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="m10.5 7.5-4 9M13.5 7.5l4 9M8 19h8"/>',
    terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
    "shield-check": '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/>',
    workflow: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6h4a3 3 0 0 1 3 3v5M17 10l-3-3 3-3"/>',
    boxes: '<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
    "book-open": '<path d="M12 7v14M3 18V5a2 2 0 0 1 2-2h2a5 5 0 0 1 5 5 5 5 0 0 1 5-5h2a2 2 0 0 1 2 2v13h-4a5 5 0 0 0-5 3 5 5 0 0 0-5-3H3z"/>',
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

  function makeArticleIcon(name) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "23");
    svg.setAttribute("height", "23");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.65");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ARTICLE_ICON_PATHS[name] || ARTICLE_ICON_PATHS.sparkles;
    return svg;
  }

  function createArticleItem(article) {
    var item = document.createElement("div");
    item.className = "tb-article-item";
    item.setAttribute("data-tb-article-item", "");
    item.setAttribute("data-date", article.modifiedDate || "");
    item.setAttribute("data-display-date", article.displayDate || article.modifiedDate || "");
    item.setAttribute("data-date-kind", article.dateKind || "Updated");
    item.setAttribute("data-title", article.title || "");
    item.setAttribute("data-href", article.path || "#");

    var link = document.createElement("a");
    link.className = "tb-generated-card";
    link.href = article.path || "#";

    var icon = document.createElement("span");
    icon.className = "tb-generated-card-icon";
    icon.appendChild(makeArticleIcon(article.icon));

    var content = document.createElement("span");
    content.className = "tb-generated-card-content";

    var title = document.createElement("span");
    title.className = "tb-generated-card-title";
    title.textContent = article.title || "Untitled article";

    var summary = document.createElement("span");
    summary.className = "tb-generated-card-description";
    summary.textContent = article.description || "Open this guide to explore the topic.";

    var cta = document.createElement("span");
    cta.className = "tb-generated-card-cta";
    cta.textContent = "Read more →";

    content.appendChild(title);
    content.appendChild(summary);
    content.appendChild(cta);
    link.appendChild(icon);
    link.appendChild(content);
    item.appendChild(link);
    return item;
  }

  function findArticleContent() {
    return document.querySelector(".dai-article") ||
      document.querySelector(".dai-page-main") ||
      document.querySelector("main");
  }

  function ensureIndexPage(path) {
    var config = INDEX_SECTIONS[path];
    var existingFeed = document.querySelector("[data-tb-article-feed]");
    if (!config) {
      if (existingFeed && existingFeed.parentNode) existingFeed.parentNode.removeChild(existingFeed);
      return null;
    }

    if (existingFeed && existingFeed.getAttribute("data-section") === config.key) {
      return existingFeed.querySelector(LIST_SELECTOR);
    }
    if (existingFeed && existingFeed.parentNode) existingFeed.parentNode.removeChild(existingFeed);

    var article = findArticleContent();
    if (!article) return null;
    var pageTitle = article.querySelector("h1");
    if (pageTitle && pageTitle.textContent.trim() !== config.title) return null;

    var data = window.TB_ARTICLE_INDEX_DATA || {};
    var articles = data[config.key];
    if (!Array.isArray(articles) || articles.length === 0) return null;

    var feed = document.createElement("section");
    feed.className = "tb-article-feed";
    feed.setAttribute("data-tb-article-feed", "");
    feed.setAttribute("data-section", config.key);

    var heading = document.createElement("h2");
    heading.className = "tb-article-feed-heading";
    heading.textContent = "Latest articles";

    var list = document.createElement("div");
    list.className = "tb-article-list";
    list.setAttribute("data-tb-article-list", "");
    list.setAttribute("data-page-size", String(DEFAULT_PAGE_SIZE));
    articles.forEach(function (entry) {
      list.appendChild(createArticleItem(entry));
    });

    feed.appendChild(heading);
    feed.appendChild(list);
    article.appendChild(feed);
    return list;
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
    var list = ensureIndexPage(path);

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
    window.addEventListener("tb:article-index-data-ready", handleNavigation);
    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
