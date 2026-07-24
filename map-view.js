(function () {
  "use strict";

  function createMapView(options) {
    const viewport = document.getElementById("viewport");
    const world = document.getElementById("world");
    const board = document.getElementById("board");
    const backBtn = document.getElementById("backBtn");
    const fullscreenBtn = document.getElementById("fullscreenBtn");
    const product = ProductStore.normalizeProduct(options.product);

    const state = {
      product,
      slotByIndex: new Map((product.slots || []).map((slot) => [slot.slotIndex, slot])),
      mode: "navigate",
      selectedIndex: null,
      isAnimating: false,
      revealing: false,
      scratchCommitRequired: false,
      scratchCards: new Map(),
      scratchSnapshots: new Map(),
      residueThumbs: new Map(),
      claims: new Map(),
      zoomCueTimer: 0,
      lastFlushTime: 0,
      onSlotRevealed: options.onSlotRevealed || null,
      onSlotClaimed: options.onSlotClaimed || null,
    };

    const engine = BoardEngine.create({
      viewport,
      world,
      board,
      boardCanvas: document.getElementById("boardCanvas"),
      boardTiles: document.getElementById("boardTiles"),
      boardSlots: document.getElementById("boardSlots"),
      getFoilOptions: foilOptions,
      getSlotData: getSlotDataForEngine,
      getSlotResidueThumb,
      onSlotTap: (index) => enterScratch(index),
      onSlotRecycle: (index) => releaseScratchCard(index),
      onSlotEnsure: (index, handle) => {
        restoreSlotVisual(index, handle);
      },
    });

    async function finalizeOpenedSlot(index) {
      const claim = state.claims.get(index);
      const slotData = getSlotData(index);
      const isOpened = Boolean(
        (claim && claim.scratched) || (slotData && slotData.scratched)
      );
      if (!isOpened) return;

      const handle = engine.getSlotHandle(index);
      const number = claim?.number ?? slotData?.number;
      handle.slot.classList.add("is-opened", "is-visited");
      handle.preview.hidden = true;
      handle.numberEl.textContent = number == null ? "" : String(number);

      const snap = state.scratchSnapshots.get(index);
      const scratchCard = state.scratchCards.get(index);
      if (!scratchCard) {
        handle.numberEl.hidden = false;
        return;
      }
      handle.numberEl.hidden = true;
      await scratchCard.resize();

      if (scratchCard.isSealed()) {
        if (number != null) scratchCard.setNumber(number);
        await scratchCard.resize();
        return;
      }
      if (snap) {
        await scratchCard.importSealedState(snap, number);
      } else {
        await scratchCard.sealWithResidue(number);
      }
      const sealed = scratchCard.exportScratchState?.();
      if (sealed) {
        persistSnapshot(index, sealed, snapshotMeta(index, true));
      }
    }

    function parkScratchResidue(index) {
      const scratchCard = state.scratchCards.get(index);
      if (!scratchCard) return null;

      const snap = scratchCard.exportScratchState?.();
      if (snap) {
        persistSnapshot(index, snap, snapshotMeta(index));
      }

      const handle = engine.getSlotHandle(index);
      if (handle) {
        handle.slot.classList.add("is-visited");
        if (!isSlotOpened(index)) {
          handle.slot.classList.remove("is-opened");
        }
        const baked = snap || state.scratchSnapshots.get(index);
        if (baked) {
          void bakeResidueToPreview(handle, baked);
        }
        handle.preview.hidden = Boolean(isSlotOpened(index));
      }

      scratchCard.disable();
      return snap;
    }

    async function sealScratchResidue(index) {
      const scratchCard = state.scratchCards.get(index);
      if (!scratchCard) return;

      const claim = state.claims.get(index);
      const snap = state.scratchSnapshots.get(index) || scratchCard.exportScratchState?.();

      if (claim && claim.scratched) {
        await scratchCard.sealWithResidue(claim.number);
      } else if (snap) {
        const number = claim?.number ?? null;
        if (number != null) scratchCard.setNumber(number);
        await scratchCard.importScratchState(snap);
        scratchCard.disable();
      }

      const sealed = scratchCard.exportScratchState?.();
      if (sealed) {
        persistSnapshot(index, sealed, snapshotMeta(index, true));
      }

      const handle = engine.getSlotHandle(index);
      if (handle) {
        handle.slot.classList.add("is-visited");
        if (!isSlotOpened(index)) {
          handle.slot.classList.remove("is-opened");
        }
        const baked = sealed || state.scratchSnapshots.get(index);
        if (baked) {
          await bakeResidueToPreview(handle, baked);
        }
        handle.preview.hidden = Boolean(isSlotOpened(index));
        if (isSlotOpened(index)) {
          const number = claim?.number ?? getSlotData(index)?.number;
          handle.numberEl.textContent = number == null ? "" : String(number);
          handle.numberEl.hidden = Boolean(state.scratchCards.get(index));
        }
      }
    }

    function releaseScratchCard(index) {
      parkScratchResidue(index);
      const scratchCard = state.scratchCards.get(index);
      if (!scratchCard) return;
      scratchCard.destroy();
      state.scratchCards.delete(index);
    }

    async function bakeResidueToPreview(handle, snap) {
      const previewCanvas = handle.preview.querySelector(".slot__preview-canvas");
      if (!previewCanvas || !snap || !window.ScratchPersist) return;
      const px = previewCanvas.width;
      if (!px) return;
      const thumb = ScratchPersist.bakeResidueThumb(snap, px);
      if (!thumb) return;
      const ctx = previewCanvas.getContext("2d");
      ctx.clearRect(0, 0, px, px);
      ctx.drawImage(thumb, 0, 0, px, px);
    }

    async function restoreSlotVisual(index, handle) {
      const slotData = getSlotData(index);
      const claim = state.claims.get(index);
      const isOpened = Boolean(
        (slotData && slotData.scratched) || (claim && claim.scratched)
      );
      const snap = state.scratchSnapshots.get(index);
      const number = claim?.number ?? slotData?.number;

      if (isOpened) {
        await finalizeOpenedSlot(index);
        return;
      }

      handle.slot.classList.remove("is-opened");
      if (!snap) return;

      handle.slot.classList.add("is-visited");
      await bakeResidueToPreview(handle, snap);
      handle.preview.hidden = false;
      handle.numberEl.hidden = true;
      if (number != null) {
        handle.numberEl.textContent = String(number);
      }
    }

    function invalidateResidueThumb(index) {
      state.residueThumbs.delete(index);
    }

    function getSlotResidueThumb(index) {
      const snap = state.scratchSnapshots.get(index);
      if (!snap || !window.ScratchPersist) return null;
      if (state.residueThumbs.has(index)) {
        return state.residueThumbs.get(index);
      }
      const thumb = ScratchPersist.bakeResidueThumb(snap, 48);
      if (thumb) state.residueThumbs.set(index, thumb);
      return thumb || null;
    }

    function getReturnCamera(_index) {
      return engine.getFitAllCamera();
    }

    let popstateHandler = null;

    function isSlotOpened(index) {
      const slotData = getSlotData(index);
      const claim = state.claims.get(index);
      return Boolean((slotData && slotData.scratched) || (claim && claim.scratched));
    }

    function canLeaveScratch() {
      return !state.scratchCommitRequired;
    }

    function syncScratchLockUI() {
      const locked = state.scratchCommitRequired;
      document.body.classList.toggle("is-scratch-locked", locked);
      viewport.classList.toggle("is-scratch-locked", locked);
      if (state.mode === "scratch") {
        backBtn.hidden = false;
        backBtn.disabled = locked;
        backBtn.classList.toggle("is-locked", locked);
      } else {
        backBtn.disabled = false;
        backBtn.classList.remove("is-locked");
      }
    }

    function requireScratchCommit() {
      if (state.scratchCommitRequired) return;
      state.scratchCommitRequired = true;
      syncScratchLockUI();
      if (!popstateHandler) {
        history.pushState({ scratchCommit: true }, "", location.href);
        popstateHandler = () => {
          if (!state.scratchCommitRequired) return;
          history.pushState({ scratchCommit: true }, "", location.href);
        };
        window.addEventListener("popstate", popstateHandler);
      }
    }

    function releaseScratchCommit() {
      if (!state.scratchCommitRequired) return;
      state.scratchCommitRequired = false;
      syncScratchLockUI();
      if (popstateHandler) {
        window.removeEventListener("popstate", popstateHandler);
        popstateHandler = null;
      }
    }

    function evaluateScratchCommit(index) {
      if (index == null || isSlotOpened(index)) return;
      const snap = state.scratchSnapshots.get(index);
      if (snap && ScratchCard.hasMeaningfulClearing(snap)) {
        requireScratchCommit();
        return;
      }
      const scratchCard = state.scratchCards.get(index);
      if (scratchCard?.hasUserEngaged?.()) {
        requireScratchCommit();
      }
    }

    function foilOptions() {
      return {
        preset: state.product.foilPreset || "silver",
        imageUrl: state.product.foilImage || "",
      };
    }

    function getSlotData(index) {
      return state.slotByIndex.get(index);
    }

    function getSlotDataForEngine(index) {
      const slotData = getSlotData(index);
      if (slotData && slotData.scratched) {
        if (state.scratchSnapshots.has(index)) {
          return { ...slotData, visited: true };
        }
        return slotData;
      }
      if (state.scratchSnapshots.has(index)) {
        return {
          ...(slotData || { slotIndex: index }),
          visited: true,
        };
      }
      return slotData || null;
    }

    function snapshotMeta(index, sealed) {
      const claim = state.claims.get(index);
      const slotData = getSlotData(index);
      return {
        number: claim?.number ?? slotData?.number ?? null,
        sealed: Boolean(sealed),
      };
    }

    function persistSnapshot(index, snap, meta) {
      if (!snap) return;
      state.scratchSnapshots.set(index, snap);
      invalidateResidueThumb(index);
      engine.markSlotDirty(index);
      if (isSlotOpened(index)) return;
      if (window.ScratchPersist) {
        ScratchPersist.saveSlot(
          state.product.id,
          index,
          snap,
          meta || snapshotMeta(index)
        );
      }
    }

    async function hydratePersistedSnapshots() {
      if (!window.ScratchPersist) return;
      const loaded = await ScratchPersist.loadAll(state.product.id);
      loaded.forEach((entry, index) => {
        state.scratchSnapshots.set(index, entry.snap);
        engine.markSlotDirty(index);
        if (entry.number != null && !state.claims.has(index)) {
          state.claims.set(index, {
            slotIndex: index,
            number: entry.number,
            scratched: false,
            prize: getSlotData(index)?.prize || null,
            lastOneAwarded: null,
            remaining: state.product.remaining,
            scratchedCount: state.product.scratchedCount,
            remainingDraws: state.product.remainingDraws,
          });
        }
      });
    }

    function flushAllSnapshots() {
      const now = performance.now();
      if (now - state.lastFlushTime < 250) return;
      state.lastFlushTime = now;
      state.scratchCards.forEach((scratchCard, index) => {
        const snap = scratchCard.exportScratchState?.();
        if (snap) {
          persistSnapshot(index, snap, snapshotMeta(index, scratchCard.isSealed?.()));
        }
      });
      if (window.ScratchPersist) {
        ScratchPersist.flushPending(state.product.id);
      }
    }

    function getVisualSlotSize() {
      return engine.getVisualSlotSize();
    }

    function syncScratchSizes() {
      state.scratchCards.forEach((scratchCard) => {
        scratchCard.resize();
      });
      engine.scheduleRender();
    }

    function markSlotOpened(index, number) {
      engine.markSlotDirty(index);
      const item = engine.getSlotHandle(index);
      if (!item) return;
      item.slot.classList.add("is-opened", "is-visited");
      item.preview.hidden = true;
      item.numberEl.hidden = true;
      if (number != null) {
        item.numberEl.textContent = String(number);
      }
    }

    function ensureScratchCard(index) {
      const handle = engine.getSlotHandle(index);
      let scratchCard = state.scratchCards.get(index);

      if (scratchCard && scratchCard.element.parentElement !== handle.scratchHost) {
        const snap = scratchCard.exportScratchState?.();
        if (snap) {
          persistSnapshot(index, snap, snapshotMeta(index));
        }
        scratchCard.destroy();
        state.scratchCards.delete(index);
        scratchCard = null;
      }

      if (scratchCard) {
        return scratchCard;
      }

      const { layout } = state.product;
      const foil = foilOptions();
      scratchCard = ScratchCard.create(handle.scratchHost, {
        layoutSize: layout.slotSize,
        foilPreset: foil.preset,
        foilImage: foil.imageUrl,
        getVisualSize: () => getVisualSlotSize(),
        onReveal: () => commitScratch(index),
        onScratchStart: () => {
          requireScratchCommit();
          if (window.PriceCalc) PriceCalc.ensureStarted();
        },
      });
      state.scratchCards.set(index, scratchCard);
      return scratchCard;
    }

    function applyScratchResult(index, result) {
      const scratchCard = state.scratchCards.get(index);
      if (scratchCard) {
        scratchCard.setNumber(result.number);
      }

      markSlotOpened(index, result.number);

      const prevScratchedCount = Number(state.product.scratchedCount) || 0;
      const nextScratchedCount = Number(result.scratchedCount);
      const wasNewScratch =
        Number.isFinite(nextScratchedCount) &&
        nextScratchedCount > prevScratchedCount;

      const slots = state.product.slots.slice();
      const existing = slots.find((s) => s.slotIndex === index);
      if (existing) {
        existing.scratched = true;
        existing.number = result.number;
        existing.prize = result.prize;
      } else {
        slots.push({
          slotIndex: index,
          scratched: true,
          number: result.number,
          prize: result.prize,
        });
      }
      state.product.slots = slots;
      state.slotByIndex.set(index, existing || slots[slots.length - 1]);
      state.product.remaining = result.remaining || state.product.remaining;
      state.product.scratchedCount = result.scratchedCount;
      state.product.remainingDraws = result.remainingDraws;

      state.product.winningNumbers = (state.product.winningNumbers || []).map(
        (item) => {
          if (item.number === result.number) {
            return { ...item, scratched: true };
          }
          return item;
        }
      );

      state.claims.set(index, result);

      if (wasNewScratch && window.PriceCalc) {
        PriceCalc.recordScratch(
          state.product.id,
          index,
          state.product.price,
          {
            productName: state.product.name,
            number: result.number,
            prize: result.prize,
            lastOneAwarded: result.lastOneAwarded,
          }
        );
      }

      if (window.ScratchPersist) {
        ScratchPersist.removeSlot(state.product.id, index);
      }
      invalidateResidueThumb(index);
      state.scratchSnapshots.delete(index);

      releaseScratchCommit();

      if (typeof state.onSlotClaimed === "function") {
        state.onSlotClaimed(result, state.product);
      }
      if (typeof state.onSlotRevealed === "function") {
        state.onSlotRevealed(result, state.product);
      }
      requestAnimationFrame(() => {
        finalizeOpenedSlot(index);
      });
    }

    async function claimSlot(index) {
      if (state.claims.has(index)) {
        const cached = state.claims.get(index);
        const scratchCard = state.scratchCards.get(index);
        if (scratchCard) scratchCard.setNumber(cached.number);
        return cached;
      }

      const existing = getSlotData(index);
      if (existing && existing.scratched && existing.number != null) {
        const result = {
          slotIndex: index,
          number: existing.number,
          scratched: true,
          prize: existing.prize,
          lastOneAwarded: null,
          remaining: state.product.remaining,
          scratchedCount: state.product.scratchedCount,
          remainingDraws: state.product.remainingDraws,
        };
        state.claims.set(index, result);
        const scratchCard = state.scratchCards.get(index);
        if (scratchCard) scratchCard.setNumber(result.number);
        return result;
      }

      const result = await ProductStore.claimSlot(state.product.id, index);
      state.claims.set(index, result);
      const scratchCard = state.scratchCards.get(index);
      if (scratchCard) scratchCard.setNumber(result.number);
      return result;
    }

    async function commitScratch(index) {
      const cached = state.claims.get(index);
      if (cached && cached.scratched) {
        releaseScratchCommit();
        if (typeof state.onSlotRevealed === "function") {
          state.onSlotRevealed(cached, state.product);
        }
        return cached;
      }

      const result = await ProductStore.scratchSlot(state.product.id, index);
      applyScratchResult(index, result);
      return result;
    }

    function setSlotVisual(index, isActive) {
      const handle = engine.getSlotHandle(index);
      const scratchCard = state.scratchCards.get(index);

      handle.slot.classList.toggle("is-active", isActive);
      handle.slot.classList.toggle(
        "is-visited",
        Boolean(scratchCard) ||
          state.scratchSnapshots.has(index) ||
          handle.slot.classList.contains("is-opened")
      );
      handle.preview.hidden = Boolean(
        isActive || handle.slot.classList.contains("is-opened")
      );
    }

    async function activateScratch(index) {
      const scratchCard = ensureScratchCard(index);
      setSlotVisual(index, true);

      try {
        await claimSlot(index);
      } catch (_error) {
        return;
      }

      const snap = state.scratchSnapshots.get(index);
      if (snap && !scratchCard.isSealed()) {
        await scratchCard.importScratchState(snap);
      }

      if (!scratchCard.isSealed()) {
        await scratchCard.enable();
      }

      evaluateScratchCommit(index);
    }

    function deactivateScratch(index) {
      const scratchCard = state.scratchCards.get(index);
      if (scratchCard) {
        scratchCard.disable();
      }
      setSlotVisual(index, false);
      const handle = engine.getSlotHandle(index);
      const snap = state.scratchSnapshots.get(index);
      if (handle && snap && !handle.slot.classList.contains("is-opened")) {
        void bakeResidueToPreview(handle, snap);
        handle.preview.hidden = false;
      }
    }

    function showZoomCue(index) {
      const point = engine.getSlotScreenPoint(index);
      const x = clamp(point.x, 24, Math.max(24, viewport.clientWidth - 24));
      const y = clamp(point.y, 24, Math.max(24, viewport.clientHeight - 24));

      clearTimeout(state.zoomCueTimer);
      viewport.classList.remove("is-zoom-required");
      viewport.style.setProperty("--zoom-cue-x", `${x}px`);
      viewport.style.setProperty("--zoom-cue-y", `${y}px`);
      void viewport.offsetWidth;
      viewport.classList.add("is-zoom-required");
      state.zoomCueTimer = window.setTimeout(() => {
        viewport.classList.remove("is-zoom-required");
      }, 1100);
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    async function enterScratch(index) {
      if (state.isAnimating || state.mode === "scratch" || state.revealing) return;
      if (!engine.canEnterScratch()) {
        state.isAnimating = true;
        showZoomCue(index);
        try {
          await engine.zoomTowardSlot(index, 3, true);
        } finally {
          state.isAnimating = false;
        }
        return;
      }

      clearTimeout(state.zoomCueTimer);
      viewport.classList.remove("is-zoom-required");
      state.scratchCommitRequired = false;
      state.isAnimating = true;
      state.selectedIndex = index;
      engine.saveNavigateSnapshot();

      engine.getSlotHandle(index);
      engine.setScratchMode(index);
      state.mode = "scratch";
      backBtn.hidden = false;
      syncScratchLockUI();
      engine.handleResize();
      await engine.flyTo(engine.getDetailCamera(index), false);

      await activateScratch(index);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      syncScratchSizes();
      state.isAnimating = false;
    }

    async function goBack(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (state.isAnimating || state.mode !== "scratch") return;
      if (!canLeaveScratch()) return;

      state.isAnimating = true;
      const index = state.selectedIndex;

      try {
        if (index !== null) {
          await sealScratchResidue(index);
          deactivateScratch(index);
        }

        engine.setNavigateMode();
        await engine.flyTo(getReturnCamera(index), true);

        state.mode = "navigate";
        state.selectedIndex = null;
        state.scratchCommitRequired = false;
        releaseScratchCommit();
        backBtn.hidden = true;
        backBtn.disabled = false;
        backBtn.classList.remove("is-locked");
        document.body.classList.remove("is-scratch-locked");
        viewport.classList.remove("is-scratch-locked");

        if (index !== null) {
          await finalizeOpenedSlot(index);
          const snap = state.scratchSnapshots.get(index);
          if (snap) {
            const handle = engine.getSlotHandle(index);
            if (handle) {
              await restoreSlotVisual(index, handle);
            }
          }
        }
        syncScratchSizes();
      } finally {
        state.isAnimating = false;
        engine.scheduleRender();
      }
    }

    function getOpenableSlotIndices() {
      const indices = [];
      const count = Number(state.product.slotCount) || 0;
      for (let index = 0; index < count; index++) {
        if (!isSlotOpened(index)) indices.push(index);
      }
      return indices;
    }

    function hasOpenableSlots() {
      return getOpenableSlotIndices().length > 0;
    }

    async function transitionToScratch(nextIndex) {
      if (state.isAnimating || state.revealing) return;
      if (nextIndex == null || nextIndex < 0) return;
      if (isSlotOpened(nextIndex)) return;

      if (state.mode !== "scratch") {
        await enterScratch(nextIndex);
        return;
      }
      if (nextIndex === state.selectedIndex) return;
      if (!canLeaveScratch() && !isSlotOpened(state.selectedIndex)) return;

      state.isAnimating = true;
      const prev = state.selectedIndex;

      try {
        if (prev !== null) {
          await sealScratchResidue(prev);
          deactivateScratch(prev);
          await finalizeOpenedSlot(prev);
        }

        state.selectedIndex = nextIndex;
        engine.getSlotHandle(nextIndex);
        engine.setScratchMode(nextIndex);
        state.mode = "scratch";
        backBtn.hidden = false;
        syncScratchLockUI();
        engine.handleResize();
        await engine.flyToSlotDetail(nextIndex);
        await activateScratch(nextIndex);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        syncScratchSizes();
      } finally {
        state.isAnimating = false;
        engine.scheduleRender();
      }
    }

    async function enterRandomScratch() {
      const candidates = getOpenableSlotIndices().filter(
        (index) => index !== state.selectedIndex
      );
      if (!candidates.length) {
        await goBack();
        return false;
      }
      const index = candidates[Math.floor(Math.random() * candidates.length)];
      await transitionToScratch(index);
      return true;
    }

    function getFullscreenElement() {
      return (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        null
      );
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

    function syncFullscreenButton() {
      if (!fullscreenBtn) return;
      const active = isFullscreen();
      fullscreenBtn.hidden = active;
      fullscreenBtn.classList.toggle("is-active", active);
      fullscreenBtn.setAttribute("aria-label", active ? "exit" : "fullscreen");
    }

    async function toggleFullscreen() {
      if (!canUseFullscreen()) return;
      try {
        if (isFullscreen()) {
          try {
            sessionStorage.removeItem("dottery-fs");
          } catch (_) {}
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        } else {
          try {
            sessionStorage.setItem("dottery-fs", "1");
          } catch (_) {}
          const el = document.documentElement;
          if (el.requestFullscreen) {
            await el.requestFullscreen();
          } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
          } else if (el.webkitRequestFullScreen) {
            el.webkitRequestFullScreen();
          }
        }
      } catch (_) {}
      syncFullscreenButton();
    }

    function bindEvents() {
      backBtn.addEventListener("click", goBack);
      if (fullscreenBtn && canUseFullscreen()) {
        fullscreenBtn.hidden = false;
        syncFullscreenButton();
        fullscreenBtn.addEventListener("click", onFullscreenClick);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        document.addEventListener("webkitfullscreenchange", onFullscreenChange);
      }
      window.addEventListener("resize", onWindowResize);
      window.addEventListener("pagehide", flushAllSnapshots);
      window.addEventListener("beforeunload", onBeforeUnload);
      window.addEventListener("dottery:before-page-leave", flushAllSnapshots);
      document.addEventListener("click", onShopLinkBlock, true);
    }

    function onFullscreenClick(event) {
      event.preventDefault();
      toggleFullscreen();
    }

    function onFullscreenChange() {
      syncFullscreenButton();
      scheduleBoardLayout();
    }

    function onWindowResize() {
      scheduleBoardLayout();
    }

    let layoutRaf = 0;
    let layoutSettleTimer = 0;

    function scheduleBoardLayout() {
      if (layoutRaf) return;
      layoutRaf = requestAnimationFrame(() => {
        layoutRaf = 0;
        engine.handleResize();
        syncScratchSizes();
      });
      window.clearTimeout(layoutSettleTimer);
      layoutSettleTimer = window.setTimeout(() => {
        layoutSettleTimer = 0;
        engine.handleResize();
        syncScratchSizes();
      }, 140);
    }

    function onBeforeUnload(event) {
      flushAllSnapshots();
      if (state.scratchCommitRequired) {
        event.preventDefault();
        event.returnValue = "";
      }
    }

    function onShopLinkBlock(event) {
      if (!state.scratchCommitRequired) return;
      const link = event.target.closest('a[href="/shop"], a[href="index.html"], a[href^="index.html?"]');
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
    }

    function destroy() {
      flushAllSnapshots();
      releaseScratchCommit();
      if (layoutRaf) cancelAnimationFrame(layoutRaf);
      layoutRaf = 0;
      window.clearTimeout(layoutSettleTimer);
      layoutSettleTimer = 0;
      if (state.zoomCueTimer) {
        window.clearTimeout(state.zoomCueTimer);
        state.zoomCueTimer = 0;
      }
      state.scratchCards.forEach((card) => {
        try {
          card.destroy();
        } catch (_e) {}
      });
      state.scratchCards.clear();
      if (fullscreenBtn && canUseFullscreen()) {
        fullscreenBtn.removeEventListener("click", onFullscreenClick);
        document.removeEventListener("fullscreenchange", onFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      }
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("pagehide", flushAllSnapshots);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("dottery:before-page-leave", flushAllSnapshots);
      document.removeEventListener("click", onShopLinkBlock, true);
      if (backBtn) backBtn.removeEventListener("click", goBack);
      document.body.classList.remove("is-scratch-locked", "has-board-prize");
      delete document.body.dataset.theme;
      delete document.documentElement.dataset.boardTheme;
    }

    function applyTheme() {
      const theme = state.product.theme || "light";
      document.body.dataset.theme = theme;
      document.documentElement.dataset.boardTheme = theme;
    }

    function primeClaims() {
      state.claims = new Map();
      state.scratchCards.clear();
      state.scratchSnapshots.clear();
      state.residueThumbs.clear();
      state.slotByIndex.forEach((slotData) => {
        if (!slotData.scratched) return;
        state.claims.set(slotData.slotIndex, {
          slotIndex: slotData.slotIndex,
          number: slotData.number,
          scratched: true,
          prize: slotData.prize,
          lastOneAwarded: null,
          remaining: state.product.remaining,
          scratchedCount: state.product.scratchedCount,
          remainingDraws: state.product.remainingDraws,
        });
      });
    }

    async function bootstrapVisualState() {
      await hydratePersistedSnapshots();
      syncScratchSizes();
      engine.scheduleRender();
    }

    function mount() {
      applyTheme();
      engine.mount(state.product);
      primeClaims();
      bindEvents();
      void bootstrapVisualState();
    }

    function loadProduct(rawProduct) {
      if (state.isAnimating) return;

      flushAllSnapshots();

      if (state.mode === "scratch" && state.selectedIndex !== null) {
        deactivateScratch(state.selectedIndex);
      }

      state.product = ProductStore.normalizeProduct(rawProduct);
      state.slotByIndex = new Map(
        (state.product.slots || []).map((slot) => [slot.slotIndex, slot])
      );
      state.mode = "navigate";
      state.selectedIndex = null;
      state.scratchCards.clear();
      state.scratchSnapshots.clear();
      state.residueThumbs.clear();
      state.scratchCommitRequired = false;
      releaseScratchCommit();
      backBtn.hidden = true;
      applyTheme();
      engine.loadProduct(state.product);
      primeClaims();
      void bootstrapVisualState();
    }

    return {
      mount,
      loadProduct,
      destroy,
      getProduct: () => ({ ...state.product }),
      exitScratch: goBack,
      enterRandomScratch,
      hasOpenableSlots,
    };
  }

  window.MapView = {
    create: createMapView,
  };
})();
