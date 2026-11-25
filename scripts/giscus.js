/**
 * giscus comments for the TechnoBureau documentation site.
 *
 * Documentation.AI (Atlas template) loads this file once per full page load and then
 * swaps page content on client-side navigation, so this script:
 *   - mounts the widget at the end of the current article,
 *   - re-mounts it when the route changes,
 *   - syncs the widget theme with the site theme toggle,
 *   - skips pages configured in `excludedPaths`.
 *
 * Finish this one-time setup before comments appear:
 *   1. Enable Discussions for https://github.com/TechnoBureau/docs
 *      (Settings -> General -> Features -> Discussions).
 *   2. Install the giscus app and grant it access to the repository:
 *      https://github.com/apps/giscus
 *   3. Open https://giscus.app, choose TechnoBureau/docs and the "Announcements"
 *      category, then copy the generated `data-category-id` (starts with `DIC_`)
 *      into CONFIG.categoryId below.
 *
 * Until `categoryId` is set, the script stays inert and logs a setup hint in the
 * browser console instead of rendering a broken widget.
 */
(function () {
  "use strict";

  var CONFIG = {
    // Repository that stores the discussions. It must be public.
    repo: "TechnoBureau/docs",
    repoId: "R_kgDORdh4IA",

    // Discussion category used for new threads. "Announcements" keeps creation
    // restricted to maintainers and the giscus bot.
    category: "General",
    // Paste the `data-category-id` value from https://giscus.app here.
    categoryId: "DIC_kwDORdh4IM4DL-RS",

    // Page <-> discussion mapping.
    // "pathname" is the right choice for this site: one discussion per doc URL.
    mapping: "title",
    strict: "0",
    reactionsEnabled: "1",
    emitMetadata: "0",
    inputPosition: "top",
    lang: "en",
    loading: "lazy",

    // giscus theme per site appearance. Any giscus theme name works, or a URL to
    // a custom theme stylesheet (for example a hosted giscus-theme.css).
    themes: {
      light: "light_protanopia",
      dark: "dark_protanopia",
    },

    // Widget copy.
    heading: "Comments",
    intro: "Share questions, corrections, or extra context for this page.",

    // Paths without comments (home page, landing pages). A trailing "/*" matches
    // every path under that prefix.
    excludedPaths: [
      "/",
      "/README",
      "/devops",
      "/kubernetes",
      "/linux",
      "/career",
    ],

    // Mount retry behaviour while the framework renders the article.
    retryDelay: 120,
    maxRetries: 40,
  };

  var SECTION_SELECTOR = "[data-tb-giscus]";
  var ARTICLE_SELECTORS = [".dai-article", ".dai-page-main", "main"];
  var darkQuery = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  var section = null;
  var retries = 0;
  var staleWaits = 0;
  var navGuard = null;
  var syncQueued = false;
  var lastPath = null;
  var warned = false;
  var started = false;

  function normalizePath(pathname) {
    var path = (pathname || "/").replace(/\/index\.html?$/, "/");
    path = path.replace(/\/+$/, "");
    return path === "" ? "/" : path;
  }

  var excluded = (CONFIG.excludedPaths || []).map(function (entry) {
    return normalizePath(entry);
  });

  function isExcluded(path) {
    return excluded.some(function (entry) {
      if (entry.slice(-2) === "/*") {
        var prefix = entry.slice(0, -1); // keep trailing slash
        return path.indexOf(prefix) === 0;
      }
      return path === entry;
    });
  }

  function isConfigured() {
    return Boolean(
      CONFIG.repo &&
      /^[^/\s]+\/[^/\s]+$/.test(CONFIG.repo) &&
      /^R_/.test(CONFIG.repoId || "") &&
      CONFIG.category &&
      /^DIC_/.test(CONFIG.categoryId || ""),
    );
  }

  function warnOnce() {
    if (warned) return;
    warned = true;
    console.warn(
      "[giscus] Comments are not configured yet.\n" +
        "1. Enable Discussions: https://github.com/" +
        CONFIG.repo +
        "/settings\n" +
        "2. Install the giscus app: https://github.com/apps/giscus\n" +
        "3. Copy data-category-id from https://giscus.app into " +
        "CONFIG.categoryId in scripts/giscus.js.",
    );
  }

  function isDark() {
    var root = document.documentElement;
    var body = document.body;
    if (
      root.classList.contains("dark") ||
      (body && body.classList.contains("dark")) ||
      root.getAttribute("data-theme") === "dark" ||
      (body && body.getAttribute("data-theme") === "dark")
    ) {
      return true;
    }
    if (
      root.classList.contains("light") ||
      (body && body.classList.contains("light")) ||
      root.getAttribute("data-theme") === "light"
    ) {
      return false;
    }
    return Boolean(darkQuery && darkQuery.matches);
  }

  function currentTheme() {
    var themes = CONFIG.themes || {};
    return isDark() ? themes.dark || "dark" : themes.light || "light";
  }

  function findArticle() {
    for (var i = 0; i < ARTICLE_SELECTORS.length; i += 1) {
      var el = document.querySelector(ARTICLE_SELECTORS[i]);
      if (el && !el.closest(SECTION_SELECTOR)) return el;
    }
    return null;
  }

  function textHash(node) {
    var text = node.textContent || "";
    var hash = 5381;
    for (var i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    }
    return hash + ":" + text.length;
  }

  // The framework swaps MDX content asynchronously after a route change, so the
  // article may still hold the previous page for a moment. Wait for it to change
  // instead of mounting the next thread into stale content.
  function isStale(article) {
    if (!navGuard) return false;
    return article === navGuard.node && textHash(article) === navGuard.hash;
  }

  function buildSection(path) {
    var node = document.createElement("section");
    node.className = "tb-giscus";
    // Prefer the conventional #comments anchor unless a page heading already
    // owns that id (for example a "## Comments" section in the MDX).
    node.id = document.getElementById("comments") ? "tb-giscus" : "comments";
    node.setAttribute("data-tb-giscus", "");
    node.setAttribute("data-path", path);
    node.setAttribute("aria-labelledby", "tb-giscus-title");

    var header = document.createElement("div");
    header.className = "tb-giscus-header";

    var title = document.createElement("h2");
    title.className = "tb-giscus-title";
    title.id = "tb-giscus-title";
    title.textContent = CONFIG.heading;
    header.appendChild(title);

    if (CONFIG.intro) {
      var intro = document.createElement("p");
      intro.className = "tb-giscus-intro";
      intro.textContent = CONFIG.intro;
      header.appendChild(intro);
    }

    var body = document.createElement("div");
    body.className = "tb-giscus-body";

    // giscus injects its iframe here when an element with this class exists.
    var mount = document.createElement("div");
    mount.className = "giscus";
    body.appendChild(mount);

    var noscript = document.createElement("noscript");
    noscript.textContent =
      "Comments are powered by GitHub Discussions. Enable JavaScript to read or join the thread.";

    node.appendChild(header);
    node.appendChild(body);
    node.appendChild(noscript);
    return node;
  }

  function addAttribute(script, name, value) {
    if (value !== undefined && value !== null && value !== "") {
      script.setAttribute("data-" + name, String(value));
    }
  }

  function loadWidget(mount) {
    var script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";

    addAttribute(script, "repo", CONFIG.repo);
    addAttribute(script, "repo-id", CONFIG.repoId);
    addAttribute(script, "category", CONFIG.category);
    addAttribute(script, "category-id", CONFIG.categoryId);
    addAttribute(script, "mapping", CONFIG.mapping);
    addAttribute(script, "strict", CONFIG.strict);
    addAttribute(script, "reactions-enabled", CONFIG.reactionsEnabled);
    addAttribute(script, "emit-metadata", CONFIG.emitMetadata);
    addAttribute(script, "input-position", CONFIG.inputPosition);
    addAttribute(script, "theme", currentTheme());
    addAttribute(script, "lang", CONFIG.lang);
    addAttribute(script, "loading", CONFIG.loading);

    mount.appendChild(script);
  }

  function pushTheme() {
    if (!section) return;
    var iframe = section.querySelector("iframe.giscus-frame");
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        { giscus: { setConfig: { theme: currentTheme() } } },
        "https://giscus.app",
      );
    } catch (error) {
      /* The iframe may not be ready yet; the next load event retries. */
    }
  }

  function watchIframe() {
    if (!section) return;
    var iframe = section.querySelector("iframe.giscus-frame");
    if (!iframe || iframe.getAttribute("data-tb-watched")) return;
    iframe.setAttribute("data-tb-watched", "1");
    iframe.addEventListener("load", function () {
      if (!section) return;
      section.setAttribute("data-tb-giscus-ready", "");
      pushTheme();
    });
  }

  function mount(path) {
    var target = findArticle();
    if (!target) {
      if (retries < CONFIG.maxRetries) {
        retries += 1;
        window.setTimeout(function () {
          sync();
        }, CONFIG.retryDelay);
      } else {
        console.warn(
          "[giscus] Could not find the article container to mount into.",
        );
      }
      return;
    }

    if (isStale(target) && staleWaits < 12) {
      staleWaits += 1;
      window.setTimeout(function () {
        sync();
      }, CONFIG.retryDelay);
      return;
    }

    retries = 0;
    staleWaits = 0;
    navGuard = null;
    section = buildSection(path);

    // Keep the widget above the previous/next navigation and the page footer.
    var trailing = target.querySelector(
      ":scope > .dai-page-nav, :scope > .dai-footer",
    );
    if (trailing) {
      target.insertBefore(section, trailing);
    } else {
      target.appendChild(section);
    }

    var mountPoint = section.querySelector(".giscus");
    if (mountPoint) loadWidget(mountPoint);

    watchIframe();
  }

  function sync() {
    if (!started) return;
    if (!isConfigured()) {
      warnOnce();
      return;
    }

    var path = normalizePath(window.location.pathname);
    var existing = document.querySelector(SECTION_SELECTOR);

    if (isExcluded(path)) {
      if (existing) existing.parentNode.removeChild(existing);
      section = null;
      return;
    }

    if (existing && existing.getAttribute("data-path") === path) {
      section = existing;
      watchIframe();
      return;
    }

    if (existing) existing.parentNode.removeChild(existing);
    section = null;
    mount(path);
  }

  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    var run = function () {
      syncQueued = false;
      sync();
    };
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(run);
    } else {
      window.setTimeout(run, 16);
    }
  }

  function handleNavigation() {
    var path = normalizePath(window.location.pathname);
    if (path === lastPath) {
      scheduleSync();
      return;
    }
    lastPath = path;

    // Drop the old thread right away, then mount after the new article renders.
    var existing = document.querySelector(SECTION_SELECTOR);
    if (existing && existing.parentNode)
      existing.parentNode.removeChild(existing);
    section = null;
    retries = 0;
    staleWaits = 0;

    // Remember what the outgoing page looked like, so the widget is not mounted
    // into it again while the router is still rendering the destination.
    var article = findArticle();
    navGuard = article ? { node: article, hash: textHash(article) } : null;

    window.setTimeout(scheduleSync, 80);
    window.setTimeout(scheduleSync, 320);
    window.setTimeout(scheduleSync, 800);
  }

  function patchHistory() {
    if (window.__tbGiscusHistoryPatched) return;
    window.__tbGiscusHistoryPatched = true;

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
      // Ignore mutations that only concern the widget itself.
      var external = mutations.some(function (mutation) {
        var node =
          mutation.target.nodeType === 1
            ? mutation.target
            : mutation.target.parentElement;
        return !(node && node.closest(SECTION_SELECTOR));
      });

      if (!external) {
        watchIframe();
        return;
      }

      // Ignore unrelated changes (search modals, table of contents, and so on)
      // while the correct thread is already mounted.
      var current = document.querySelector(SECTION_SELECTOR);
      var path = normalizePath(window.location.pathname);
      if (current && current.getAttribute("data-path") === path) {
        watchIframe();
        return;
      }

      scheduleSync();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function observeTheme() {
    if (!("MutationObserver" in window)) return;
    var observer = new MutationObserver(pushTheme);
    [document.documentElement, document.body].forEach(function (node) {
      if (node) {
        observer.observe(node, {
          attributes: true,
          attributeFilter: ["class", "data-theme", "style"],
        });
      }
    });
    if (darkQuery) {
      if (darkQuery.addEventListener) {
        darkQuery.addEventListener("change", pushTheme);
      } else if (darkQuery.addListener) {
        darkQuery.addListener(pushTheme);
      }
    }
  }

  function start() {
    if (started) return;
    started = true;
    lastPath = normalizePath(window.location.pathname);

    patchHistory();
    observeTheme();
    observePage();

    // giscus reports configuration and discussion errors through postMessage.
    window.addEventListener("message", function (event) {
      if (event.origin !== "https://giscus.app") return;
      var payload = event.data && event.data.giscus;
      if (!payload) return;
      if (payload.error) {
        console.warn("[giscus]", payload.error);
      } else if (section) {
        section.setAttribute("data-tb-giscus-ready", "");
      }
    });

    if (isConfigured()) {
      sync();
    } else {
      warnOnce();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
