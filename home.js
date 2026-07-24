(function () {
  "use strict";

  if (!document.getElementById("shop")) return;

  const disposers = [];
  let disposed = false;

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (metaSwitchTimer) {
      clearTimeout(metaSwitchTimer);
      metaSwitchTimer = null;
    }
    if (heroAnimClearTimer) {
      clearTimeout(heroAnimClearTimer);
      heroAnimClearTimer = null;
    }
    while (disposers.length) {
      try {
        disposers.pop()();
      } catch (_e) {}
    }
  }

  window.addEventListener("dottery:page-dispose", dispose, { once: true });

  const els = {
    searchInput: document.getElementById("searchInput"),
    heroStage: document.getElementById("heroStage"),
    heroMeta: document.getElementById("heroMeta"),
    heroDots: document.getElementById("heroDots"),
    heroPrev: document.getElementById("heroPrev"),
    heroNext: document.getElementById("heroNext"),
    fullscreenBtn: document.getElementById("shopFullscreenBtn"),
    priceCalcStart: document.getElementById("priceCalcStart"),
    priceCalcSession: document.getElementById("priceCalcSession"),
    priceCalcCode: document.getElementById("priceCalcCode"),
    priceCalcAmount: document.getElementById("priceCalcAmount"),
    priceCalcEnd: document.getElementById("priceCalcEnd"),
    priceCalcConfirm: document.getElementById("priceCalcConfirm"),
    priceCalcConfirmTitle: document.getElementById("priceCalcConfirmTitle"),
    priceCalcConfirmMeta: document.getElementById("priceCalcConfirmMeta"),
    priceCalcConfirmCode: document.getElementById("priceCalcConfirmCode"),
    priceCalcConfirmAmount: document.getElementById("priceCalcConfirmAmount"),
    priceCalcConfirmCancel: document.getElementById("priceCalcConfirmCancel"),
    priceCalcConfirmOk: document.getElementById("priceCalcConfirmOk"),
    priceCalcBill: document.getElementById("priceCalcBill"),
    priceCalcBillCode: document.getElementById("priceCalcBillCode"),
    priceCalcBillAmount: document.getElementById("priceCalcBillAmount"),
    priceCalcBillCount: document.getElementById("priceCalcBillCount"),
    priceCalcBillSummary: document.getElementById("priceCalcBillSummary"),
    priceCalcBillList: document.getElementById("priceCalcBillList"),
    priceCalcBillActions: document.getElementById("priceCalcBillActions"),
    priceCalcBillCancel: document.getElementById("priceCalcBillCancel"),
    priceCalcBillOk: document.getElementById("priceCalcBillOk"),
    priceCalcPin: document.getElementById("priceCalcPin"),
    priceCalcPinDots: document.getElementById("priceCalcPinDots"),
    priceCalcPinPad: document.getElementById("priceCalcPinPad"),
    priceCalcPinBack: document.getElementById("priceCalcPinBack"),
  };

  const state = {
    settings: {
      shopTitle: "Dottery",
      showPrice: true,
      showProgress: true,
      hideSoldOut: false,
    },
    products: [],
    query: "",
    heroIndex: 0,
    heroStep: 0,
    heroReady: false,
    metaProductId: null,
  };

  const heroCardPool = new Map();
  let metaSwitchTimer = null;
  let heroAnimClearTimer = null;

  function isDone(product) {
    return Number(product.remainingDraws) <= 0;
  }

  function formatPrice(price) {
    const value = Number(price) || 0;
    return `$${value.toFixed(2)}`;
  }

  function baseProducts() {
    return state.settings.hideSoldOut
      ? state.products.filter((p) => !isDone(p))
      : state.products;
  }

  function filteredProducts() {
    let list = baseProducts();
    const query = state.query.trim().toLowerCase();
    if (query) {
      list = list.filter((p) => (p.name || "").toLowerCase().includes(query));
    }
    return list;
  }

  function applyBrand() {
    if (state.settings.shopTitle) {
      document.title = state.settings.shopTitle;
    }
  }

  if (els.searchInput) {
    const onSearchInput = (e) => {
      state.query = e.target.value;
      renderHero();
    };
    els.searchInput.addEventListener("input", onSearchInput);
    disposers.push(() => els.searchInput.removeEventListener("input", onSearchInput));
  }

  /* ---------------- Hero coverflow ---------------- */

  function heroList() {
    return filteredProducts();
  }

  function boardHref(product) {
    return `/board?product=${encodeURIComponent(product.id)}`;
  }

  function formatPct(ratio) {
    const pct = ratio * 100;
    if (pct >= 10) return `${Math.round(pct)}%`;
    if (pct >= 1) return `${pct.toFixed(1)}%`;
    if (pct > 0) return `${pct.toFixed(2)}%`;
    return "0%";
  }

  function heroRemaining(product) {
    const total = Number(product.totalDraws) || 0;
    const scratched = Number(product.scratchedCount) || 0;
    const remaining = Math.max(
      0,
      Number(product.remainingDraws) || total - scratched
    );
    return { remaining, total };
  }

  function heroProgressRatio(product) {
    const { remaining, total } = heroRemaining(product);
    return total > 0 ? Math.min(1, remaining / total) : 0;
  }

  function syncHeroMetaProgress(product) {
    if (!els.heroMeta || els.heroMeta.hidden) return;
    const { remaining, total } = heroRemaining(product);
    const ratio = heroProgressRatio(product);
    const done = isDone(product);
    const dash = els.heroMeta.querySelector(".hero__meta-dash");
    const pct = els.heroMeta.querySelector(".hero__meta-dash-pct");
    const frac = els.heroMeta.querySelector(".hero__meta-dash-frac");
    const fill = els.heroMeta.querySelector(".hero__meta-dash-fill");
    if (dash) dash.classList.toggle("is-done", done);
    if (pct) pct.textContent = formatPct(ratio);
    if (frac) frac.textContent = `${remaining}/${total}`;
    if (fill) {
      fill.style.width = `${ratio * 100}%`;
      fill.classList.toggle("is-empty", ratio <= 0);
    }
  }

  function ensureHeroMetaShell(product) {
    let name = els.heroMeta.querySelector(".hero__meta-name");
    if (!name) {
      els.heroMeta.replaceChildren();
      name = document.createElement("div");
      name.className = "hero__meta-name";
      els.heroMeta.appendChild(name);
    }
    name.textContent = product.name || product.id;

    let dash = els.heroMeta.querySelector(".hero__meta-dash");
    if (!state.settings.showProgress) {
      if (dash) dash.remove();
      return;
    }

    if (!dash) {
      dash = document.createElement("div");
      dash.className = "hero__meta-dash";

      const row = document.createElement("div");
      row.className = "hero__meta-dash-row";

      const pctWrap = document.createElement("span");
      pctWrap.className = "hero__meta-dash-pct-wrap";

      const pctLabel = document.createElement("span");
      pctLabel.className = "hero__meta-dash-label";
      pctLabel.textContent = "剩餘:";
      pctWrap.appendChild(pctLabel);

      const pct = document.createElement("span");
      pct.className = "hero__meta-dash-pct";
      pctWrap.appendChild(pct);
      row.appendChild(pctWrap);

      const frac = document.createElement("span");
      frac.className = "hero__meta-dash-frac";
      row.appendChild(frac);
      dash.appendChild(row);

      const track = document.createElement("div");
      track.className = "hero__meta-dash-track";
      const fill = document.createElement("div");
      fill.className = "hero__meta-dash-fill";
      const glow = document.createElement("span");
      glow.className = "hero__meta-dash-glow";
      glow.setAttribute("aria-hidden", "true");
      fill.appendChild(glow);
      track.appendChild(fill);
      dash.appendChild(track);
      els.heroMeta.appendChild(dash);
    }

    syncHeroMetaProgress(product);
  }

  function renderHeroMeta(product) {
    if (!els.heroMeta) return;
    if (!product) {
      if (metaSwitchTimer) {
        clearTimeout(metaSwitchTimer);
        metaSwitchTimer = null;
      }
      state.metaProductId = null;
      els.heroMeta.hidden = true;
      els.heroMeta.replaceChildren();
      els.heroMeta.classList.remove("is-switching");
      return;
    }

    const productId = product.id;
    if (state.metaProductId === productId && !els.heroMeta.hidden) {
      syncHeroMetaProgress(product);
      return;
    }

    const revealMeta = () => {
      ensureHeroMetaShell(product);
      state.metaProductId = productId;
      els.heroMeta.hidden = false;
      requestAnimationFrame(() => {
        els.heroMeta.classList.remove("is-switching");
      });
    };

    if (metaSwitchTimer) {
      clearTimeout(metaSwitchTimer);
      metaSwitchTimer = null;
    }

    if (state.heroReady && !els.heroMeta.hidden && state.metaProductId !== null) {
      els.heroMeta.classList.add("is-switching");
      metaSwitchTimer = setTimeout(() => {
        revealMeta();
        metaSwitchTimer = null;
      }, 160);
      return;
    }

    revealMeta();
  }

  function renderHeroDots(list) {
    if (list.length <= 1) {
      els.heroDots.replaceChildren();
      return;
    }

    const dots = els.heroDots.children;
    if (dots.length !== list.length) {
      els.heroDots.replaceChildren();
      list.forEach((_product, index) => {
        const dot = document.createElement("span");
        dot.className = "hero__dot";
        dot.setAttribute("aria-hidden", "true");
        els.heroDots.appendChild(dot);
      });
    }

    Array.from(els.heroDots.children).forEach((dot, index) => {
      dot.classList.toggle("is-active", index === state.heroIndex);
    });
  }

  function heroRange(count) {
    if (count <= 1) return 0;
    if (count <= 4) return 1;
    return 2;
  }

  function heroOffsetOrder(range) {
    const offsets = [0];
    for (let step = 1; step <= range; step++) {
      offsets.push(-step, step);
    }
    return offsets;
  }

  function moveHero(step) {
    const count = heroList().length;
    if (!count || !step) return;
    state.heroStep = step;
    state.heroIndex = ((state.heroIndex + step) % count + count) % count;
    renderHeroStage();
  }

  function heroCardTransform(offset, count) {
    const clamped = Math.max(-2, Math.min(2, offset));
    const abs = Math.abs(clamped);
    const step = abs <= 1 ? 88 : 150;
    const x = Math.sign(clamped) * (abs <= 1 ? step : 88 + (abs - 1) * 62);
    const scale = 1 - abs * 0.14;
    const opacity = count <= 1 ? 1 : Math.max(0, 1 - abs * 0.38);
    const z = 10 - abs;
    return {
      transform: `translate3d(calc(-50% + ${x}%), 0, 0) scale(${scale})`,
      opacity,
      zIndex: z,
    };
  }

  function getHeroTrack() {
    let track = els.heroStage.querySelector(".hero__track");
    if (!track) {
      track = document.createElement("div");
      track.className = "hero__track";
      els.heroStage.appendChild(track);
    }
    return track;
  }

  function ensureHeroCardClip(card) {
    let clip = card.querySelector(":scope > .hero-card__clip");
    if (!clip) {
      clip = document.createElement("div");
      clip.className = "hero-card__clip";
      const looseMedia = card.querySelector(
        ":scope > .hero-card__img, :scope > .hero-card__img--empty"
      );
      card.insertBefore(clip, card.firstChild);
      if (looseMedia) clip.appendChild(looseMedia);
    }
    return clip;
  }

  function ensureHeroCardMedia(card, product) {
    const clip = ensureHeroCardClip(card);
    let media = clip.querySelector(".hero-card__img, .hero-card__img--empty");
    if (product.coverImage) {
      if (!media || !media.classList.contains("hero-card__img")) {
        if (media) media.remove();
        media = document.createElement("img");
        media.className = "hero-card__img";
        media.alt = "";
        media.draggable = false;
        clip.appendChild(media);
      }
      if (media.getAttribute("src") !== product.coverImage) {
        media.src = product.coverImage;
      }
      return;
    }

    if (!media || !media.classList.contains("hero-card__img--empty")) {
      if (media) media.remove();
      media = document.createElement("div");
      media.className = "hero-card__img--empty";
      clip.appendChild(media);
    }
  }

  function ensureHeroCardPrice(card, product) {
    let price = card.querySelector(".hero-card__price");
    if (!state.settings.showPrice) {
      if (price) price.remove();
      return;
    }
    if (!price) {
      price = document.createElement("div");
      price.className = "hero-card__price";
      card.appendChild(price);
    }
    price.replaceChildren();
    price.append(formatPrice(product.price));
    const unit = document.createElement("span");
    unit.className = "hero-card__price-unit";
    unit.textContent = "/抽";
    price.append(unit);
  }

  function isPlayable(product) {
    return product.playable !== false;
  }

  function bindHeroCardClick(card, product, offset, count) {
    card.onpointerup = null;
    card.onclick = null;
    card.classList.toggle("hero-card--locked", offset === 0 && !isPlayable(product));
    let link = card.querySelector(".hero-card__link");
    if (offset !== 0) {
      if (link) link.remove();
      const targetOffset = offset;
      card.onclick = () => {
        moveHero(targetOffset);
      };
      return;
    }
    if (!isPlayable(product)) {
      if (link) link.remove();
      return;
    }
    if (!link) {
      link = document.createElement("a");
      link.className = "hero-card__link";
      link.draggable = false;
      card.appendChild(link);
    }
    link.href = boardHref(product);
    if (offset === 0 && window.PageTransition?.prefetchRoute) {
      const href = link.href;
      const schedule =
        typeof requestIdleCallback === "function"
          ? (fn) => requestIdleCallback(fn, { timeout: 600 })
          : (fn) => setTimeout(fn, 120);
      schedule(() => window.PageTransition.prefetchRoute(href));
    }
  }

  function applyHeroCardStyle(card, t, offset) {
    card.style.transform = t.transform;
    card.style.opacity = String(t.opacity);
    card.style.zIndex = String(t.zIndex);
    card.style.pointerEvents = Math.abs(offset) > 1 ? "none" : "auto";
    card.dataset.heroOffset = String(offset);
  }

  function applyHeroCardLayout(card, product, offset, count, animate) {
    const t = heroCardTransform(offset, count);
    const isCenter = offset === 0;

    card.classList.toggle("hero-card--center", isCenter);
    card.classList.toggle("hero-card--side", !isCenter);
    card.classList.toggle("is-animating", Boolean(animate));

    if (!animate) {
      card.style.transition = "none";
    }

    applyHeroCardStyle(card, t, offset);
    ensureHeroCardMedia(card, product);
    ensureHeroCardPrice(card, product);
    bindHeroCardClick(card, product, offset, count);

    if (!animate) {
      void card.offsetWidth;
      card.style.transition = "";
    }
  }

  function clearHeroAnimating() {
    for (const card of heroCardPool.values()) {
      card.classList.remove("is-animating");
    }
  }

  function createHeroCard(product) {
    const card = document.createElement("div");
    card.className = "hero-card";
    card.dataset.productId = product.id;
    const clip = document.createElement("div");
    clip.className = "hero-card__clip";
    card.appendChild(clip);
    ensureHeroCardMedia(card, product);
    return card;
  }

  function clearHeroStage(track) {
    heroCardPool.clear();
    track.replaceChildren();
  }

  function renderHeroStage(options = {}) {
    const list = heroList();
    const track = getHeroTrack();
    const animate = state.heroReady && !options.instant;

    if (heroAnimClearTimer) {
      clearTimeout(heroAnimClearTimer);
      heroAnimClearTimer = null;
    }

    if (list.length === 0) {
      clearHeroStage(track);
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.style.position = "absolute";
      empty.style.inset = "0";
      empty.style.display = "flex";
      empty.style.alignItems = "center";
      empty.style.justifyContent = "center";
      empty.textContent = "—";
      track.appendChild(empty);
      els.heroDots.replaceChildren();
      els.heroPrev.hidden = true;
      els.heroNext.hidden = true;
      renderHeroMeta(null);
      state.heroReady = false;
      return;
    }

    const listIds = new Set(list.map((product) => product.id));
    for (const [productId, card] of heroCardPool) {
      if (!listIds.has(productId)) {
        card.remove();
        heroCardPool.delete(productId);
      }
    }

    track.querySelector(".empty")?.remove();

    els.heroPrev.hidden = false;
    els.heroNext.hidden = false;

    if (state.heroIndex >= list.length) state.heroIndex = 0;
    if (state.heroIndex < 0) state.heroIndex = list.length - 1;

    const count = list.length;
    const range = heroRange(count);
    const visibleIds = new Set();
    const placedIds = new Set();
    const step = options.instant ? 0 : state.heroStep;
    const pending = [];

    for (const offset of heroOffsetOrder(range)) {
      const index = ((state.heroIndex + offset) % count + count) % count;
      if (count > 4 && Math.abs(offset) > 2) continue;
      const product = list[index];
      if (placedIds.has(product.id)) continue;
      placedIds.add(product.id);
      visibleIds.add(product.id);

      let card = heroCardPool.get(product.id);
      const isNew = !card;
      if (isNew) {
        card = createHeroCard(product);
        heroCardPool.set(product.id, card);
        track.appendChild(card);
      }

      pending.push({ card, product, offset, isNew });
    }

    for (const [productId, card] of heroCardPool) {
      if (!visibleIds.has(productId)) {
        card.remove();
        heroCardPool.delete(productId);
      }
    }

    if (animate) {
      for (const item of pending) {
        if (!item.isNew) continue;
        const enterBias = step !== 0 ? step * 0.35 : Math.sign(item.offset || 1) * 0.35;
        const enterFrom = heroCardTransform(item.offset + enterBias, count);
        item.card.style.transition = "none";
        item.card.style.transform = enterFrom.transform;
        item.card.style.opacity = "0";
        item.card.classList.add("is-animating");
      }

      void track.offsetWidth;

      for (const item of pending) {
        item.card.style.transition = "";
        applyHeroCardLayout(item.card, item.product, item.offset, count, true);
      }

      heroAnimClearTimer = setTimeout(() => {
        clearHeroAnimating();
        heroAnimClearTimer = null;
      }, 520);
    } else {
      for (const item of pending) {
        applyHeroCardLayout(item.card, item.product, item.offset, count, false);
      }
      clearHeroAnimating();
    }

    const single = count <= 1;
    els.heroPrev.hidden = single;
    els.heroNext.hidden = single;

    renderHeroMeta(list[state.heroIndex]);
    renderHeroDots(list);
    state.heroReady = true;
    state.heroStep = 0;
  }

  function renderHero() {
    renderHeroStage();
  }

  function onHeroPrevClick() {
    moveHero(-1);
  }

  function onHeroNextClick() {
    moveHero(1);
  }

  els.heroPrev.addEventListener("click", onHeroPrevClick);
  els.heroNext.addEventListener("click", onHeroNextClick);
  disposers.push(() => els.heroPrev.removeEventListener("click", onHeroPrevClick));
  disposers.push(() => els.heroNext.removeEventListener("click", onHeroNextClick));

  /* --- Hero drag / swipe (mouse, touch, pen via Pointer Events) --- */

  (function attachHeroDrag() {
    let startX = 0;
    let dragging = false;
    let didSwipe = false;
    let activePointerId = null;

    els.heroStage.addEventListener("dragstart", (e) => {
      e.preventDefault();
    });

    els.heroStage.addEventListener("pointerdown", (e) => {
      if (heroList().length <= 1) return;
      dragging = true;
      didSwipe = false;
      activePointerId = e.pointerId;
      startX = e.clientX;
    });

    els.heroStage.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== activePointerId) return;
      const delta = e.clientX - startX;
      if (Math.abs(delta) > 8 && !els.heroStage.hasPointerCapture(e.pointerId)) {
        els.heroStage.setPointerCapture(e.pointerId);
      }
    });

    function endDrag(e) {
      if (!dragging || e.pointerId !== activePointerId) return;
      dragging = false;
      activePointerId = null;
      if (els.heroStage.hasPointerCapture(e.pointerId)) {
        els.heroStage.releasePointerCapture(e.pointerId);
      }
      const delta = e.clientX - startX;
      const count = heroList().length;
      if (count > 1 && Math.abs(delta) > 55) {
        moveHero(delta < 0 ? 1 : -1);
        didSwipe = true;
      }
      if (didSwipe) {
        setTimeout(() => {
          didSwipe = false;
        }, 0);
      }
    }

    els.heroStage.addEventListener("pointerup", endDrag);
    els.heroStage.addEventListener("pointercancel", endDrag);

    els.heroStage.addEventListener(
      "click",
      (e) => {
        if (didSwipe) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );
  })();

  let resizeRaf = 0;
  let resizeSettleTimer = 0;

  function onShopResize() {
    if (disposed) return;
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (disposed) return;
      renderHeroStage({ instant: true });
    });
  }

  function scheduleShopLayout() {
    if (disposed) return;
    onShopResize();
    window.clearTimeout(resizeSettleTimer);
    resizeSettleTimer = window.setTimeout(() => {
      resizeSettleTimer = 0;
      if (disposed) return;
      renderHeroStage({ instant: true });
    }, 120);
  }

  window.addEventListener("resize", scheduleShopLayout);
  disposers.push(() => {
    window.removeEventListener("resize", scheduleShopLayout);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    window.clearTimeout(resizeSettleTimer);
  });

  function onFullscreenLayout() {
    syncShopFullscreenBtn();
    scheduleShopLayout();
  }

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function canUseFullscreen() {
    const el = document.documentElement;
    return Boolean(
      el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.webkitRequestFullScreen
    );
  }

  function isFullscreen() {
    return Boolean(getFullscreenElement());
  }

  function syncShopFullscreenBtn() {
    if (!els.fullscreenBtn || !canUseFullscreen()) {
      if (els.fullscreenBtn) els.fullscreenBtn.hidden = true;
      return;
    }
    els.fullscreenBtn.hidden = isFullscreen();
  }

  async function enterShopFullscreen() {
    if (!canUseFullscreen() || isFullscreen()) return;
    try {
      sessionStorage.setItem("dottery-fs", "1");
    } catch (_) {}
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.webkitRequestFullScreen) {
        el.webkitRequestFullScreen();
      }
    } catch (_) {}
    syncShopFullscreenBtn();
  }

  if (els.fullscreenBtn && canUseFullscreen()) {
    syncShopFullscreenBtn();
    const onFsClick = (event) => {
      event.preventDefault();
      enterShopFullscreen();
    };
    const onFsTouch = (event) => {
      event.preventDefault();
      enterShopFullscreen();
    };
    els.fullscreenBtn.addEventListener("click", onFsClick);
    els.fullscreenBtn.addEventListener("touchend", onFsTouch);
    document.addEventListener("fullscreenchange", onFullscreenLayout);
    document.addEventListener("webkitfullscreenchange", onFullscreenLayout);
    disposers.push(() => {
      els.fullscreenBtn.removeEventListener("click", onFsClick);
      els.fullscreenBtn.removeEventListener("touchend", onFsTouch);
      document.removeEventListener("fullscreenchange", onFullscreenLayout);
      document.removeEventListener("webkitfullscreenchange", onFullscreenLayout);
    });
  }

  /* ---------------- Bootstrap ---------------- */

  function renderPriceCalc(session) {
    const active = Boolean(session && session.active);
    if (els.priceCalcStart) els.priceCalcStart.hidden = active;
    if (els.priceCalcSession) els.priceCalcSession.hidden = !active;
    if (!active) return;
    if (els.priceCalcCode) els.priceCalcCode.textContent = session.code;
    if (els.priceCalcAmount) {
      els.priceCalcAmount.textContent = window.PriceCalc
        ? PriceCalc.formatAmount(session.total)
        : `$${(Number(session.total) || 0).toFixed(2)}`;
    }
  }

  let priceCalcPending = null;

  function closePriceCalcConfirm() {
    priceCalcPending = null;
    if (els.priceCalcConfirm) els.priceCalcConfirm.hidden = true;
  }

  function closePriceCalcBill() {
    closePriceCalcPin();
    if (els.priceCalcBill) els.priceCalcBill.hidden = true;
    if (els.priceCalcBillSummary) {
      els.priceCalcBillSummary.replaceChildren();
      els.priceCalcBillSummary.hidden = true;
    }
    if (els.priceCalcBillList) els.priceCalcBillList.replaceChildren();
  }

  function buildBillPrizeSummary(items) {
    const totals = new Map();

    function addPrize(prize) {
      if (!prize) return;
      const name = String(prize.name || "").trim() || "—";
      const grade = String(prize.grade || "").trim();
      const key = prize.id ? `id:${prize.id}` : `n:${grade}\0${name}`;
      const existing = totals.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      totals.set(key, { grade, name, count: 1 });
    }

    (Array.isArray(items) ? items : []).forEach((item) => {
      addPrize(item && item.prize);
      if (item && item.lastOne) addPrize(item.lastOne);
    });

    return Array.from(totals.values());
  }

  function formatBillSummaryLine(entry) {
    const label = entry.grade ? `${entry.grade} ${entry.name}` : entry.name;
    return `${label} ×${entry.count}`;
  }

  function createBillPrizeRow(prize, meta) {
    const row = document.createElement("div");
    row.className = "price-calc-bill__item";

    if (prize && prize.image) {
      const img = document.createElement("img");
      img.className = "price-calc-bill__thumb";
      img.src = prize.image;
      img.alt = "";
      row.appendChild(img);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className =
        "price-calc-bill__thumb price-calc-bill__thumb--empty";
      placeholder.setAttribute("aria-hidden", "true");
      row.appendChild(placeholder);
    }

    const body = document.createElement("div");
    body.className = "price-calc-bill__body";

    if (prize && prize.grade) {
      const grade = document.createElement("div");
      grade.className = "price-calc-bill__grade";
      grade.textContent = prize.grade;
      body.appendChild(grade);
    }

    const name = document.createElement("div");
    name.className = "price-calc-bill__name";
    name.textContent = (prize && prize.name) || "—";
    body.appendChild(name);

    if (meta.productName) {
      const product = document.createElement("div");
      product.className = "price-calc-bill__product";
      product.textContent = meta.productName;
      body.appendChild(product);
    }

    if (meta.number != null && meta.number !== "") {
      const number = document.createElement("div");
      number.className = "price-calc-bill__number";
      number.textContent = `#${meta.number}`;
      body.appendChild(number);
    }

    row.appendChild(body);

    const price = document.createElement("div");
    price.className = "price-calc-bill__price";
    price.textContent = meta.priceText || "";
    row.appendChild(price);

    return row;
  }

  const priceCalcPinState = {
    digits: "",
    submitting: false,
    locked: false,
  };

  function syncPriceCalcPinDots() {
    if (!els.priceCalcPinDots) return;
    const dots = els.priceCalcPinDots.querySelectorAll(".price-calc-pin__dot");
    dots.forEach((dot, index) => {
      dot.classList.toggle("is-filled", index < priceCalcPinState.digits.length);
    });
  }

  function shakePriceCalcPin() {
    if (!els.priceCalcPinDots) return;
    els.priceCalcPinDots.classList.remove("is-shake");
    void els.priceCalcPinDots.offsetWidth;
    els.priceCalcPinDots.classList.add("is-shake");
  }

  function closePriceCalcPin() {
    priceCalcPinState.digits = "";
    priceCalcPinState.submitting = false;
    priceCalcPinState.locked = false;
    syncPriceCalcPinDots();
    if (els.priceCalcPinDots) els.priceCalcPinDots.classList.remove("is-shake");
    if (els.priceCalcPin) els.priceCalcPin.hidden = true;
    if (els.priceCalcBillActions) els.priceCalcBillActions.hidden = false;
    if (els.priceCalcBillSummary) els.priceCalcBillSummary.hidden = !els.priceCalcBillSummary.childElementCount;
    if (els.priceCalcBillList) els.priceCalcBillList.hidden = false;
  }

  function openPriceCalcPin() {
    priceCalcPinState.digits = "";
    priceCalcPinState.submitting = false;
    priceCalcPinState.locked = false;
    syncPriceCalcPinDots();
    if (els.priceCalcBillActions) els.priceCalcBillActions.hidden = true;
    if (els.priceCalcBillSummary) els.priceCalcBillSummary.hidden = true;
    if (els.priceCalcBillList) els.priceCalcBillList.hidden = true;
    if (els.priceCalcPin) els.priceCalcPin.hidden = false;
  }

  async function submitPriceCalcPin() {
    if (priceCalcPinState.submitting || priceCalcPinState.locked) return;
    if (priceCalcPinState.digits.length !== 4) return;

    priceCalcPinState.submitting = true;
    priceCalcPinState.locked = true;

    try {
      const res = await fetch("/api/admin/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: priceCalcPinState.digits }),
      });
      if (!res.ok) throw new Error("bad pin");
      if (!window.PriceCalc) return;
      PriceCalc.end();
      closePriceCalcBill();
      renderPriceCalc(null);
    } catch (_) {
      shakePriceCalcPin();
      window.setTimeout(() => {
        priceCalcPinState.digits = "";
        syncPriceCalcPinDots();
        priceCalcPinState.submitting = false;
        priceCalcPinState.locked = false;
      }, 320);
    }
  }

  function pushPriceCalcPinDigit(digit) {
    if (priceCalcPinState.submitting || priceCalcPinState.locked) return;
    if (priceCalcPinState.digits.length >= 4) return;
    priceCalcPinState.digits += digit;
    syncPriceCalcPinDots();
    if (priceCalcPinState.digits.length === 4) {
      submitPriceCalcPin();
    }
  }

  function popPriceCalcPinDigit() {
    if (priceCalcPinState.submitting || priceCalcPinState.locked) return;
    if (!priceCalcPinState.digits.length) {
      closePriceCalcPin();
      return;
    }
    priceCalcPinState.digits = priceCalcPinState.digits.slice(0, -1);
    syncPriceCalcPinDots();
  }

  function isPriceCalcPinOpen() {
    return Boolean(els.priceCalcPin && !els.priceCalcPin.hidden);
  }

  function openPriceCalcBill(receipt) {
    if (!els.priceCalcBill || !receipt) return;
    closePriceCalcPin();

    if (els.priceCalcBillCode) els.priceCalcBillCode.textContent = receipt.code;
    if (els.priceCalcBillAmount) {
      els.priceCalcBillAmount.textContent = PriceCalc.formatAmount(receipt.total);
    }
    if (els.priceCalcBillCount) {
      els.priceCalcBillCount.textContent = `×${Number(receipt.scratchCount) || 0}`;
    }

    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const summary = buildBillPrizeSummary(items);

    if (els.priceCalcBillSummary) {
      els.priceCalcBillSummary.replaceChildren();
      if (summary.length) {
        summary.forEach((entry) => {
          const line = document.createElement("div");
          line.className = "price-calc-bill__summary-line";
          line.textContent = formatBillSummaryLine(entry);
          els.priceCalcBillSummary.appendChild(line);
        });
        els.priceCalcBillSummary.hidden = false;
      } else {
        els.priceCalcBillSummary.hidden = true;
      }
    }

    if (els.priceCalcBillList) {
      els.priceCalcBillList.replaceChildren();

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "price-calc-bill__empty";
        empty.textContent = "—";
        els.priceCalcBillList.appendChild(empty);
      } else {
        items.forEach((item) => {
          const priceText = PriceCalc.formatAmount(item.unitPrice);
          els.priceCalcBillList.appendChild(
            createBillPrizeRow(item.prize, {
              productName: item.productName,
              number: item.number,
              priceText: priceText,
            })
          );
          if (item.lastOne) {
            els.priceCalcBillList.appendChild(
              createBillPrizeRow(item.lastOne, {
                productName: item.productName,
                priceText: "",
              })
            );
          }
        });
      }
    }

    els.priceCalcBill.hidden = false;
    if (els.priceCalcBillOk) els.priceCalcBillOk.focus();
  }

  function openPriceCalcConfirm(action) {
    if (!window.PriceCalc || !els.priceCalcConfirm) return;
    if (action === "end") {
      const session = PriceCalc.get();
      if (!session) return;
      openPriceCalcBill(session);
      return;
    }

    priceCalcPending = action;

    if (els.priceCalcConfirmTitle) {
      els.priceCalcConfirmTitle.textContent = "準備開始計費?";
    }
    if (els.priceCalcConfirmOk) {
      els.priceCalcConfirmOk.textContent = "開始";
    }
    if (els.priceCalcConfirmMeta) {
      els.priceCalcConfirmMeta.hidden = true;
    }

    els.priceCalcConfirm.hidden = false;
    if (els.priceCalcConfirmOk) els.priceCalcConfirmOk.focus();
  }

  function confirmPriceCalcAction() {
    if (!window.PriceCalc || !priceCalcPending) return;
    const action = priceCalcPending;
    closePriceCalcConfirm();
    if (action === "start") {
      renderPriceCalc(PriceCalc.start());
    }
  }

  function confirmPriceCalcBill() {
    openPriceCalcPin();
  }

  if (els.priceCalcStart) {
    const onStart = () => openPriceCalcConfirm("start");
    els.priceCalcStart.addEventListener("click", onStart);
    disposers.push(() => els.priceCalcStart.removeEventListener("click", onStart));
  }

  if (els.priceCalcEnd) {
    const onEnd = () => openPriceCalcConfirm("end");
    els.priceCalcEnd.addEventListener("click", onEnd);
    disposers.push(() => els.priceCalcEnd.removeEventListener("click", onEnd));
  }

  if (els.priceCalcConfirmCancel) {
    els.priceCalcConfirmCancel.addEventListener("click", closePriceCalcConfirm);
    disposers.push(() =>
      els.priceCalcConfirmCancel.removeEventListener("click", closePriceCalcConfirm)
    );
  }

  if (els.priceCalcConfirmOk) {
    els.priceCalcConfirmOk.addEventListener("click", confirmPriceCalcAction);
    disposers.push(() =>
      els.priceCalcConfirmOk.removeEventListener("click", confirmPriceCalcAction)
    );
  }

  if (els.priceCalcConfirm) {
    const onConfirmBg = (event) => {
      if (event.target === els.priceCalcConfirm) closePriceCalcConfirm();
    };
    els.priceCalcConfirm.addEventListener("click", onConfirmBg);
    disposers.push(() => els.priceCalcConfirm.removeEventListener("click", onConfirmBg));
  }

  if (els.priceCalcBillCancel) {
    els.priceCalcBillCancel.addEventListener("click", closePriceCalcBill);
    disposers.push(() =>
      els.priceCalcBillCancel.removeEventListener("click", closePriceCalcBill)
    );
  }

  if (els.priceCalcBillOk) {
    els.priceCalcBillOk.addEventListener("click", confirmPriceCalcBill);
    disposers.push(() =>
      els.priceCalcBillOk.removeEventListener("click", confirmPriceCalcBill)
    );
  }

  if (els.priceCalcBill) {
    const onBillBg = (event) => {
      if (event.target === els.priceCalcBill) closePriceCalcBill();
    };
    els.priceCalcBill.addEventListener("click", onBillBg);
    disposers.push(() => els.priceCalcBill.removeEventListener("click", onBillBg));
  }

  if (els.priceCalcPinPad) {
    const onPinPad = (event) => {
      const key = event.target.closest("[data-pin]");
      if (!key) return;
      const value = key.getAttribute("data-pin");
      if (value === "del") {
        popPriceCalcPinDigit();
        return;
      }
      if (/^\d$/.test(value)) pushPriceCalcPinDigit(value);
    };
    els.priceCalcPinPad.addEventListener("click", onPinPad);
    disposers.push(() => els.priceCalcPinPad.removeEventListener("click", onPinPad));
  }

  if (els.priceCalcPinBack) {
    els.priceCalcPinBack.addEventListener("click", closePriceCalcPin);
    disposers.push(() =>
      els.priceCalcPinBack.removeEventListener("click", closePriceCalcPin)
    );
  }

  function onShopKeydown(event) {
    if (disposed) return;
    if (isPriceCalcPinOpen()) {
      if (event.key >= "0" && event.key <= "9") {
        event.preventDefault();
        pushPriceCalcPinDigit(event.key);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        popPriceCalcPinDigit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePriceCalcPin();
        return;
      }
    }

    if (event.key !== "Escape") return;
    if (els.priceCalcBill && !els.priceCalcBill.hidden) {
      closePriceCalcBill();
      return;
    }
    if (!els.priceCalcConfirm || els.priceCalcConfirm.hidden) return;
    closePriceCalcConfirm();
  }

  document.addEventListener("keydown", onShopKeydown);
  disposers.push(() => document.removeEventListener("keydown", onShopKeydown));

  if (window.PriceCalc) {
    renderPriceCalc(PriceCalc.get());
    disposers.push(PriceCalc.subscribe(renderPriceCalc));
  }

  Promise.all([
    fetch("/api/settings").then((res) => res.json()),
    fetch("/api/products").then((res) => res.json()),
  ])
    .then(([settings, data]) => {
      if (disposed) return;
      if (settings) {
        state.settings.shopTitle = settings.shopTitle || state.settings.shopTitle;
        state.settings.showPrice = settings.showPrice !== false;
        state.settings.showProgress = settings.showProgress !== false;
        state.settings.hideSoldOut = Boolean(settings.hideSoldOut);
      }
      state.products = data.products || [];
      applyBrand();
      renderHero();
    })
    .catch(() => {
      if (disposed) return;
      applyBrand();
      renderHero();
    });
})();
