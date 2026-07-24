(function () {
  "use strict";

  const STORAGE_KEY = "dottery-page-x";
  const DURATION_MS = 320;
  const PREFETCH_MAX_WAIT_MS = 80;

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
  const prefetched = new Map();

  function canAnimate() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isNavigationBlocked() {
    return document.body.classList.contains("is-scratch-locked");
  }

  function getStage() {
    return document.getElementById("pageStage");
  }

  function getTransitionLink(target) {
    return target.closest('a[href^="/board"], a[href="/shop"], a[href^="/shop?"]');
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
    const path = href.split("?")[0].split("#")[0];
    if (path === "/board" || path.startsWith("/board/")) return "to-board";
    if (path === "/shop" || path.startsWith("/shop/")) return "to-shop";
    return null;
  }

  function getProductId(href) {
    try {
      return new URL(href, window.location.origin).searchParams.get("product");
    } catch (_e) {
      return null;
    }
  }

  function warmFetch(url) {
    return fetch(url, { credentials: "same-origin", cache: "force-cache" }).catch(() => {});
  }

  function prefetchRoute(href) {
    if (!href) return Promise.resolve();
    const existing = prefetched.get(href);
    if (existing) return existing;

    const direction = getDirection(href);
    if (!direction) return Promise.resolve();

    const tasks = [warmFetch(href)];
    const assets = direction === "to-board" ? BOARD_ASSETS : SHOP_ASSETS;
    assets.forEach((asset) => tasks.push(warmFetch("/" + asset)));

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
    document.querySelectorAll('a[href^="/board"], a[href="/shop"], a[href^="/shop?"]').forEach((link, index) => {
      if (index > 2) return;
      prefetchRoute(link.getAttribute("href"));
    });
  }

  function dispatchBeforeLeave() {
    window.dispatchEvent(new CustomEvent("dottery:before-page-leave"));
  }

  function isFullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function wantsFullscreenPersist() {
    try {
      return sessionStorage.getItem("dottery-fs") === "1";
    } catch (_e) {
      return false;
    }
  }

  function shouldKeepFullscreen() {
    return isFullscreenActive() || wantsFullscreenPersist();
  }

  async function navigate(url, direction) {
    if (!url || navigating || isNavigationBlocked()) return;

    navigating = true;
    if (direction) sessionStorage.setItem(STORAGE_KEY, direction);
    dispatchBeforeLeave();

    if (!canAnimate()) {
      window.location.assign(url);
      return;
    }

    const keepFs = shouldKeepFullscreen();
    if (!keepFs) {
      await Promise.race([prefetchRoute(url), delay(PREFETCH_MAX_WAIT_MS)]);
      await nextFrames(1);
    }
    window.location.assign(url);
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

  function onPointerDownNavigate(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!shouldKeepFullscreen()) return;
    const link = getTransitionLink(event.target);
    if (!link || link.target === "_blank") return;
    beginLinkNavigation(event, link);
  }

  function onDocumentClick(event) {
    if (event.button !== 0) return;
    const link = getTransitionLink(event.target);
    if (!link || link.target === "_blank") return;
    beginLinkNavigation(event, link);
  }

  function boot() {
    document.addEventListener("pointerdown", onPointerIntent, true);
    document.addEventListener("pointerdown", onPointerDownNavigate, true);
    document.addEventListener("mouseover", onPointerIntent, true);
    document.addEventListener("click", onDocumentClick, true);
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
