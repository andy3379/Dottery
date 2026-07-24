(function () {
  "use strict";

  const STORAGE_KEY = "dottery-page-x";
  const DURATION_MS = 320;
  const PREFETCH_MAX_WAIT_MS = 80;

  const SHARED_SCRIPT_NAMES = new Set([
    "page-transition.js",
    "page-transition-prep.js",
    "fullscreen-auto.js",
    "price-calc.js",
    "api-shim.js",
    "firebase-store.js",
  ]);

  const ENTRY_SCRIPT_NAMES = new Set(["home.js", "app.js"]);

  const BOARD_ASSETS = [
    "styles.css",
    "app.js",
    "board-info.js",
    "product-config.js",
    "board-engine.js",
    "map-view.js",
    "scratch-card.js",
    "scratch-persist.js",
    "scratch-texture.js",
    "scratch-effects.js",
  ];

  const SHOP_ASSETS = ["home.css", "home.js"];

  let navigating = false;
  let bootstrapped = false;
  let navGeneration = 0;
  const prefetched = new Map();
  const loadedLibs = new Set();

  function canAnimate() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isNavigationBlocked() {
    return document.body.classList.contains("is-scratch-locked");
  }

  function getStage() {
    return document.getElementById("pageStage");
  }

  function scriptName(src) {
    if (!src) return "";
    return src.split("?")[0].split("/").pop();
  }

  function resolveUrl(href) {
    return new URL(href, window.location.href).href;
  }

  function getTransitionLink(target) {
    return target.closest(
      'a[href^="/board"], a[href="/shop"], a[href^="/shop?"], a[href^="board.html"], a[href^="index.html"]'
    );
  }

  function nextFrames(count) {
    return new Promise((resolve) => {
      let left = count;
      const step = () => {
        left -= 1;
        if (left <= 0) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function waitTransition(el, timeout) {
    return new Promise((resolve) => {
      if (!el) {
        resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.removeEventListener("transitionend", onEnd);
        el.removeEventListener("animationend", onEnd);
        resolve();
      };
      const onEnd = (event) => {
        if (event.target !== el) return;
        if (
          event.propertyName !== "transform" &&
          event.propertyName !== "opacity" &&
          event.type !== "animationend"
        ) {
          return;
        }
        finish();
      };
      el.addEventListener("transitionend", onEnd);
      el.addEventListener("animationend", onEnd);
      window.setTimeout(finish, timeout || DURATION_MS + 50);
    });
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function getDirection(href) {
    if (!href) return null;
    let path;
    try {
      path = new URL(href, window.location.href).pathname;
    } catch (_e) {
      path = href.split("?")[0].split("#")[0];
    }
    const file = path.split("/").pop() || "";
    if (path === "/board" || path.startsWith("/board/") || file === "board.html") {
      return "to-board";
    }
    if (path === "/shop" || path.startsWith("/shop/") || file === "index.html") {
      return "to-shop";
    }
    return null;
  }

  function getProductId(href) {
    try {
      return new URL(href, window.location.href).searchParams.get("product");
    } catch (_e) {
      return null;
    }
  }

  function warmFetch(url) {
    return fetch(url, { credentials: "same-origin", cache: "force-cache" }).catch(() => {});
  }

  function assetUrl(name) {
    try {
      return new URL(name, window.location.href).href;
    } catch (_e) {
      return "/" + name;
    }
  }

  function prefetchRoute(href) {
    if (!href) return Promise.resolve();
    const existing = prefetched.get(href);
    if (existing) return existing;

    const direction = getDirection(href);
    if (!direction) return Promise.resolve();

    const tasks = [warmFetch(resolveUrl(href))];
    const assets = direction === "to-board" ? BOARD_ASSETS : SHOP_ASSETS;
    assets.forEach((asset) => tasks.push(warmFetch(assetUrl(asset))));

    if (direction === "to-board") {
      const productId = getProductId(href);
      if (productId) tasks.push(warmFetch("/api/products/" + productId));
    } else {
      tasks.push(warmFetch("/api/products"));
      tasks.push(warmFetch("/api/settings"));
    }

    const promise = Promise.all(tasks);
    prefetched.set(href, promise);
    return promise;
  }

  function prefetchVisibleLinks() {
    document
      .querySelectorAll(
        'a[href^="/board"], a[href="/shop"], a[href^="/shop?"], a[href^="board.html"], a[href^="index.html"]'
      )
      .forEach((link, index) => {
        if (index > 2) return;
        prefetchRoute(link.getAttribute("href"));
      });
  }

  function dispatchBeforeLeave() {
    window.dispatchEvent(new CustomEvent("dottery:before-page-leave"));
  }

  function dispatchDispose() {
    window.dispatchEvent(new CustomEvent("dottery:page-dispose"));
  }

  function clearPageChrome() {
    document.body.classList.remove("is-scratch-locked", "has-board-prize");
    delete document.body.dataset.theme;
    delete document.documentElement.dataset.boardTheme;
    document.documentElement.classList.remove("is-preview");
  }

  function waitStylesheet(link) {
    return new Promise((resolve) => {
      if (link.sheet) {
        resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      link.addEventListener("load", finish, { once: true });
      link.addEventListener("error", finish, { once: true });
      window.setTimeout(finish, 250);
    });
  }

  async function syncStylesheets(doc) {
    const keepNames = new Set(["page-transition.css"]);
    const wanted = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => ({
      href: link.getAttribute("href"),
      name: scriptName(link.getAttribute("href")),
    }));

    const pending = [];
    wanted.forEach((item) => {
      if (!item.href) return;
      if (keepNames.has(item.name)) return;
      const exists = [...document.querySelectorAll('link[rel="stylesheet"]')].some(
        (link) => scriptName(link.getAttribute("href")) === item.name
      );
      if (exists) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = item.href;
      document.head.appendChild(link);
      pending.push(waitStylesheet(link));
    });

    if (pending.length) {
      await Promise.all(pending);
    }

    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const name = scriptName(link.getAttribute("href"));
      if (keepNames.has(name)) return;
      if (name.includes("fonts.googleapis") || link.href.includes("fonts.googleapis")) return;
      if (wanted.some((item) => item.name === name)) return;
      link.remove();
    });
  }

  function replacePageExtras(doc) {
    [...document.body.children].forEach((el) => {
      if (el.tagName === "SCRIPT") return;
      if (el.id === "pageSheet" || el.id === "pageStage") return;
      el.remove();
    });

    const extras = [...doc.body.children].filter((el) => {
      if (el.tagName === "SCRIPT") return false;
      if (el.id === "pageSheet" || el.id === "pageStage") return false;
      return true;
    });

    const stage = getStage();
    extras.forEach((el) => {
      const node = document.importNode(el, true);
      if (stage && stage.nextSibling) {
        document.body.insertBefore(node, stage.nextSibling);
      } else {
        document.body.appendChild(node);
      }
    });
  }

  function replaceStage(doc) {
    const next = doc.getElementById("pageStage");
    const stage = getStage();
    if (!next || !stage) return;
    stage.innerHTML = next.innerHTML;
    stage.style.animation = "";
  }

  function markExistingLibs() {
    document.querySelectorAll("script[src]").forEach((script) => {
      const name = scriptName(script.getAttribute("src"));
      if (!name || ENTRY_SCRIPT_NAMES.has(name) || SHARED_SCRIPT_NAMES.has(name)) return;
      loadedLibs.add(name);
    });
  }

  function loadScriptOnce(src) {
    const name = scriptName(src);
    if (!name || loadedLibs.has(name)) return Promise.resolve();

    const existing = [...document.querySelectorAll("script[src]")].find(
      (script) => scriptName(script.getAttribute("src")) === name
    );
    if (existing) {
      loadedLibs.add(name);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        loadedLibs.add(name);
        resolve();
      };
      script.onerror = () => reject(new Error("script " + src));
      document.body.appendChild(script);
    });
  }

  async function runEntryScript(src) {
    const response = await fetch(src, { credentials: "same-origin", cache: "force-cache" });
    if (!response.ok) throw new Error("entry " + src);
    const code = await response.text();
    const script = document.createElement("script");
    script.textContent = code;
    document.body.appendChild(script);
    script.remove();
  }

  async function runPageScripts(doc) {
    const scripts = [...doc.querySelectorAll("body script[src]")].map((script) =>
      script.getAttribute("src")
    );
    const libs = [];
    const entries = [];

    scripts.forEach((src) => {
      const name = scriptName(src);
      if (!name || SHARED_SCRIPT_NAMES.has(name)) return;
      if (ENTRY_SCRIPT_NAMES.has(name)) entries.push(src);
      else libs.push(src);
    });

    for (const src of libs) {
      await loadScriptOnce(src);
    }
    for (const src of entries) {
      await runEntryScript(src);
    }
  }

  async function playEnter(direction) {
    const root = document.documentElement;
    const stage = getStage();

    if (!direction || !canAnimate()) {
      root.classList.remove("page-x-prep", "page-x-prep--to-board", "page-x-prep--to-shop");
      if (stage) stage.style.animation = "none";
      return;
    }

    root.classList.add("page-x-prep", "page-x-prep--" + direction);
    if (stage) stage.style.animation = "";
    await nextFrames(2);
    await waitTransition(stage);
    root.classList.remove("page-x-prep", "page-x-prep--to-board", "page-x-prep--to-shop");
    if (stage) stage.style.animation = "none";
  }

  async function applyDocument(doc, direction) {
    clearPageChrome();
    await syncStylesheets(doc);
    replaceStage(doc);
    replacePageExtras(doc);
    await runPageScripts(doc);
    prefetchVisibleLinks();
  }

  async function softNavigate(url, direction, options) {
    const opts = options || {};
    const absolute = resolveUrl(url);
    const response = await fetch(absolute, {
      credentials: "same-origin",
      headers: { Accept: "text/html" },
    });
    if (!response.ok) throw new Error("navigate " + absolute);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc.getElementById("pageStage")) throw new Error("missing stage");

    if (opts.history === "replace") {
      history.replaceState({ soft: true }, "", absolute);
    } else if (opts.history !== "none") {
      history.pushState({ soft: true }, "", absolute);
    }

    await applyDocument(doc, direction || getDirection(absolute));
    return direction || getDirection(absolute);
  }

  async function navigate(url, direction, options) {
    if (!url || navigating || isNavigationBlocked()) return;

    const opts = options || {};
    const gen = ++navGeneration;
    navigating = true;
    const dir = direction || getDirection(url);
    if (dir) sessionStorage.setItem(STORAGE_KEY, dir);
    if (!opts.skipDispose) {
      dispatchBeforeLeave();
      dispatchDispose();
    }

    let enterDir = dir;
    try {
      await Promise.race([prefetchRoute(url), delay(PREFETCH_MAX_WAIT_MS)]);
      enterDir = (await softNavigate(url, dir, opts)) || dir;
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      window.location.assign(url);
      return;
    } finally {
      navigating = false;
    }

    if (gen === navGeneration) {
      await playEnter(enterDir);
    }
  }

  async function onEnter() {
    const direction = sessionStorage.getItem(STORAGE_KEY);
    const root = document.documentElement;

    if (!direction || !canAnimate()) {
      sessionStorage.removeItem(STORAGE_KEY);
      root.classList.remove("page-x-prep", "page-x-prep--to-board", "page-x-prep--to-shop");
      return;
    }

    sessionStorage.removeItem(STORAGE_KEY);

    const stage = getStage();
    await waitTransition(stage);

    root.classList.remove("page-x-prep", "page-x-prep--to-board", "page-x-prep--to-shop");
    if (stage) stage.style.animation = "none";
  }

  function onPointerIntent(event) {
    if (isNavigationBlocked()) return;
    const link = getTransitionLink(event.target);
    if (!link || link.target === "_blank") return;
    const href = link.getAttribute("href");
    if (!getDirection(href)) return;
    prefetchRoute(href);
  }

  function beginLinkNavigation(event, link) {
    if (
      navigating ||
      isNavigationBlocked() ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return false;
    }

    const href = link.getAttribute("href");
    const direction = getDirection(href);
    if (!direction) return false;

    event.preventDefault();
    event.stopPropagation();
    void navigate(href, direction);
    return true;
  }

  function onDocumentClick(event) {
    if (event.button !== 0) return;
    const link = getTransitionLink(event.target);
    if (!link || link.target === "_blank") return;
    beginLinkNavigation(event, link);
  }

  function onPopState() {
    if (navigating || isNavigationBlocked()) return;
    const href = window.location.pathname + window.location.search + window.location.hash;
    const direction = getDirection(href);
    if (!direction) {
      window.location.reload();
      return;
    }
    dispatchBeforeLeave();
    dispatchDispose();
    void navigate(href, direction, { history: "none", skipDispose: true });
  }

  function boot() {
    if (bootstrapped) return;
    bootstrapped = true;
    markExistingLibs();
    try {
      history.replaceState(
        Object.assign({}, history.state || {}, { soft: true }),
        "",
        window.location.href
      );
    } catch (_e) {}
    document.addEventListener("pointerdown", onPointerIntent, true);
    document.addEventListener("mouseover", onPointerIntent, true);
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState);
    prefetchVisibleLinks();
    void onEnter();
  }

  window.PageTransition = {
    navigate,
    onEnter,
    prefetchRoute,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
