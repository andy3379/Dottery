(function () {
  "use strict";

  const els = {
    searchInput: document.getElementById("searchInput"),
    heroStage: document.getElementById("heroStage"),
    heroMeta: document.getElementById("heroMeta"),
    heroDots: document.getElementById("heroDots"),
    heroPrev: document.getElementById("heroPrev"),
    heroNext: document.getElementById("heroNext"),
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
    els.searchInput.addEventListener("input", (e) => {
      state.query = e.target.value;
      renderHero();
    });
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

  function heroProgressRatio(product) {
    const scratched = Number(product.scratchedCount) || 0;
    const total = Number(product.totalDraws) || 0;
    return total > 0 ? Math.min(1, scratched / total) : 0;
  }

  function syncHeroMetaProgress(product) {
    if (!els.heroMeta || els.heroMeta.hidden) return;
    const ratio = heroProgressRatio(product);
    const done = isDone(product);
    const dash = els.heroMeta.querySelector(".hero__meta-dash");
    const pct = els.heroMeta.querySelector(".hero__meta-dash-pct");
    const frac = els.heroMeta.querySelector(".hero__meta-dash-frac");
    const fill = els.heroMeta.querySelector(".hero__meta-dash-fill");
    if (dash) dash.classList.toggle("is-done", done);
    if (pct) pct.textContent = formatPct(ratio);
    if (frac) {
      const scratched = Number(product.scratchedCount) || 0;
      const total = Number(product.totalDraws) || 0;
      frac.textContent = `${scratched}/${total}`;
    }
    if (fill) fill.style.width = `${ratio * 100}%`;
  }

  function buildHeroMeta(product) {
    els.heroMeta.replaceChildren();

    const name = document.createElement("div");
    name.className = "hero__meta-name";
    name.textContent = product.name || product.id;
    els.heroMeta.appendChild(name);

    if (state.settings.showProgress) {
      const ratio = heroProgressRatio(product);
      const done = isDone(product);
      const scratched = Number(product.scratchedCount) || 0;
      const total = Number(product.totalDraws) || 0;

      const dash = document.createElement("div");
      dash.className = `hero__meta-dash${done ? " is-done" : ""}`;

      const row = document.createElement("div");
      row.className = "hero__meta-dash-row";

      const pct = document.createElement("span");
      pct.className = "hero__meta-dash-pct";
      pct.textContent = formatPct(ratio);
      row.appendChild(pct);

      const frac = document.createElement("span");
      frac.className = "hero__meta-dash-frac";
      frac.textContent = `${scratched}/${total}`;
      row.appendChild(frac);

      dash.appendChild(row);

      const track = document.createElement("div");
      track.className = "hero__meta-dash-track";
      const fill = document.createElement("div");
      fill.className = "hero__meta-dash-fill";
      fill.style.width = `${ratio * 100}%`;
      const glow = document.createElement("span");
      glow.className = "hero__meta-dash-glow";
      glow.setAttribute("aria-hidden", "true");
      fill.appendChild(glow);
      track.appendChild(fill);
      dash.appendChild(track);

      els.heroMeta.appendChild(dash);
    }
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
      buildHeroMeta(product);
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
      }, 200);
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
    const rotate = clamped * -3;
    const opacity = count <= 1 ? 1 : Math.max(0, 1 - abs * 0.38);
    const z = 10 - abs;
    return {
      transform: `translateX(-50%) translateX(${x}%) scale(${scale}) rotateY(${rotate}deg)`,
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
    price.textContent = formatPrice(product.price);
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
      card.appendChild(link);
    }
    link.href = boardHref(product);
    if (window.PageTransition?.prefetchRoute) {
      window.PageTransition.prefetchRoute(link.href);
    }
  }

  function heroClipTransform(isCenter) {
    const scale = isCenter ? 1 : 1.03;
    return `translateZ(0) scale(${scale})`;
  }

  function applyHeroCardLayout(card, product, offset, count, animate) {
    const t = heroCardTransform(offset, count);
    const isCenter = offset === 0;
    const hadCenter = card.classList.contains("hero-card--center");
    const hadSide = card.classList.contains("hero-card--side");
    const roleChanged =
      (isCenter && hadSide) || (!isCenter && hadCenter);
    const clip = card.querySelector(":scope > .hero-card__clip");

    if (!animate) {
      card.style.transition = "none";
      if (clip) clip.style.transition = "none";
    } else if (roleChanged && clip) {
      clip.style.transition = "none";
      clip.style.transform = heroClipTransform(hadCenter);
    }

    card.classList.toggle("hero-card--center", isCenter);
    card.classList.toggle("hero-card--side", !isCenter);

    if (animate) {
      void card.offsetWidth;
      card.style.transition = "";
      if (clip && roleChanged) {
        clip.style.transition = "";
        clip.style.transform = "";
      }
    }

    card.style.transform = t.transform;
    card.style.opacity = String(t.opacity);
    card.style.zIndex = String(t.zIndex);
    card.style.pointerEvents = Math.abs(offset) > 1 ? "none" : "auto";

    ensureHeroCardMedia(card, product);
    ensureHeroCardPrice(card, product);
    bindHeroCardClick(card, product, offset, count);

    if (!animate) {
      void card.offsetWidth;
      card.style.transition = "";
      if (clip) {
        clip.style.transition = "";
        clip.style.transform = "";
      }
    }

    card.dataset.heroOffset = String(offset);
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
        if (animate) {
          const enterBias = step !== 0 ? step * 0.35 : Math.sign(offset || 1) * 0.35;
          const enterFrom = heroCardTransform(offset + enterBias, count);
          card.style.transition = "none";
          card.style.transform = enterFrom.transform;
          card.style.opacity = "0";
        }
        track.appendChild(card);
        if (animate) {
          void card.offsetWidth;
          card.style.transition = "";
          requestAnimationFrame(() => {
            applyHeroCardLayout(card, product, offset, count, true);
          });
        } else {
          applyHeroCardLayout(card, product, offset, count, false);
        }
        continue;
      }

      applyHeroCardLayout(card, product, offset, count, animate);
    }

    for (const [productId, card] of heroCardPool) {
      if (!visibleIds.has(productId)) {
        card.remove();
        heroCardPool.delete(productId);
      }
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

  els.heroPrev.addEventListener("click", () => {
    moveHero(-1);
  });

  els.heroNext.addEventListener("click", () => {
    moveHero(1);
  });

  /* --- Hero drag / swipe (mouse, touch, pen via Pointer Events) --- */

  (function attachHeroDrag() {
    let startX = 0;
    let dragging = false;
    let didSwipe = false;
    let activePointerId = null;

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

  window.addEventListener("resize", () => {
    renderHeroStage({ instant: true });
  });

  /* ---------------- Bootstrap ---------------- */

  Promise.all([
    fetch("/api/settings").then((res) => res.json()),
    fetch("/api/products").then((res) => res.json()),
  ])
    .then(([settings, data]) => {
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
      applyBrand();
      renderHero();
    });
})();
