(function () {
  "use strict";

  function createMapView(options) {
    const viewport = document.getElementById("viewport");
    const world = document.getElementById("world");
    const board = document.getElementById("board");
    const backBtn = document.getElementById("backBtn");

    const state = {
      product: ProductStore.normalizeProduct(options.product),
      mode: "navigate",
      selectedIndex: null,
      isAnimating: false,
      revealing: false,
      scratchCards: new Map(),
      claims: new Map(),
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
      getSlotData,
      onSlotTap: (index) => enterScratch(index),
    });

    function foilOptions() {
      return {
        preset: state.product.foilPreset || "silver",
        imageUrl: state.product.foilImage || "",
      };
    }

    function getSlotData(index) {
      return (state.product.slots || []).find((slot) => slot.slotIndex === index);
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
      if (state.scratchCards.has(index)) {
        return state.scratchCards.get(index);
      }

      const handle = engine.getSlotHandle(index);
      const { layout } = state.product;
      const foil = foilOptions();
      const scratchCard = ScratchCard.create(handle.scratchHost, {
        layoutSize: layout.slotSize,
        foilPreset: foil.preset,
        foilImage: foil.imageUrl,
        getVisualSize: () => getVisualSlotSize(),
        onReveal: () => commitScratch(index),
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

      if (typeof state.onSlotClaimed === "function") {
        state.onSlotClaimed(result, state.product);
      }
      if (typeof state.onSlotRevealed === "function") {
        state.onSlotRevealed(result, state.product);
      }
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
        Boolean(scratchCard) || handle.slot.classList.contains("is-opened")
      );
      handle.preview.hidden = Boolean(
        isActive || scratchCard || handle.slot.classList.contains("is-opened")
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

      requestAnimationFrame(() => {
        if (scratchCard.isSealed()) return;
        scratchCard.enable();
      });
    }

    function deactivateScratch(index) {
      const scratchCard = state.scratchCards.get(index);
      if (scratchCard) {
        scratchCard.disable();
      }
      setSlotVisual(index, false);
    }

    async function enterScratch(index) {
      if (state.isAnimating || state.mode === "scratch" || state.revealing) return;

      state.isAnimating = true;
      state.selectedIndex = index;
      engine.saveNavigateSnapshot();

      engine.getSlotHandle(index);
      await engine.flyTo(engine.getDetailCamera(index), true);

      engine.setScratchMode(index);
      state.mode = "scratch";
      await activateScratch(index);

      state.isAnimating = false;
      backBtn.hidden = false;
      syncScratchSizes();
    }

    async function goBack(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (state.isAnimating || state.mode !== "scratch") return;

      state.isAnimating = true;
      const index = state.selectedIndex;

      try {
        if (index !== null) {
          const scratchCard = state.scratchCards.get(index);
          const claim = state.claims.get(index);
          if (
            scratchCard &&
            claim &&
            claim.scratched &&
            scratchCard.isPrizeTriggered()
          ) {
            await scratchCard.sealWithResidue(claim.number);
          }
          deactivateScratch(index);
        }

        engine.setNavigateMode();
        await engine.flyTo(engine.getNavigateSnapshot(), true);

        state.mode = "navigate";
        state.selectedIndex = null;
        backBtn.hidden = true;
      } finally {
        state.isAnimating = false;
        engine.scheduleRender();
      }
    }

    function bindEvents() {
      backBtn.addEventListener("click", goBack);
      backBtn.addEventListener("touchend", (event) => {
        event.preventDefault();
        goBack(event);
      });
      window.addEventListener("resize", () => {
        engine.handleResize();
        syncScratchSizes();
      });
    }

    function applyTheme() {
      document.body.dataset.theme = state.product.theme || "light";
    }

    async function sealOpenedSlots() {
      const tasks = [];
      (state.product.slots || []).forEach((slotData) => {
        if (!slotData.scratched) return;
        engine.getSlotHandle(slotData.slotIndex);
        const scratchCard = state.scratchCards.get(slotData.slotIndex);
        if (scratchCard) {
          tasks.push(scratchCard.sealWithResidue(slotData.number));
        }
      });
      await Promise.all(tasks);
      syncScratchSizes();
    }

    function primeClaims() {
      state.claims = new Map();
      state.scratchCards.clear();
      (state.product.slots || []).forEach((slotData) => {
        if (!slotData.scratched) return;
        engine.markSlotDirty(slotData.slotIndex);
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

    function mount() {
      applyTheme();
      engine.mount(state.product);
      primeClaims();
      bindEvents();
      requestAnimationFrame(() => {
        syncScratchSizes();
        sealOpenedSlots();
      });
    }

    function loadProduct(rawProduct) {
      if (state.isAnimating) return;

      if (state.mode === "scratch" && state.selectedIndex !== null) {
        deactivateScratch(state.selectedIndex);
      }

      state.product = ProductStore.normalizeProduct(rawProduct);
      state.mode = "navigate";
      state.selectedIndex = null;
      state.scratchCards.clear();
      backBtn.hidden = true;
      applyTheme();
      engine.loadProduct(state.product);
      primeClaims();
      requestAnimationFrame(() => {
        syncScratchSizes();
        sealOpenedSlots();
      });
    }

    return {
      mount,
      loadProduct,
      getProduct: () => ({ ...state.product }),
    };
  }

  window.MapView = {
    create: createMapView,
  };
})();
