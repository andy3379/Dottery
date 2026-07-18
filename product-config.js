(function () {
  "use strict";

  const LAYOUT_DEFAULTS = {
    slotSize: 88,
    gap: 24,
    zoomTargetSize: 300,
    zoomPadding: 0.88,
  };

  const DEMO_STORAGE_KEY = "dottery-demo-board";

  function shuffle(array) {
    const items = array.slice();
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }

  function buildDemoBoard() {
    const prizes = [
      { id: "a", name: "Grand", image: "", quantity: 1, isLastOne: false },
      { id: "b", name: "Mid", image: "", quantity: 2, isLastOne: false },
      { id: "c", name: "Small", image: "", quantity: 3, isLastOne: false },
      { id: "d", name: "Extra", image: "", quantity: 6, isLastOne: false },
    ];
    const lastOne = {
      id: "last",
      name: "Finale",
      image: "",
      quantity: 1,
      isLastOne: true,
    };

    const bag = [];
    prizes.forEach((prize) => {
      for (let i = 0; i < prize.quantity; i++) bag.push(prize.id);
    });
    const prizeIds = shuffle(bag);
    const numbers = shuffle(Array.from({ length: 12 }, (_, i) => i + 1));
    const prizeMap = Object.fromEntries(prizes.map((p) => [p.id, p]));

    const slots = numbers.map((number, slotIndex) => {
      const prize = prizeMap[prizeIds[slotIndex]];
      return {
        slotIndex,
        number,
        scratched: false,
        prize: {
          id: prize.id,
          name: prize.name,
          image: prize.image,
          isLastOne: false,
        },
      };
    });

    return {
      id: "demo",
      name: "Demo",
      description: "",
      coverImage: "",
      price: 0,
      category: "",
      slotCount: 12,
      totalDraws: 12,
      cols: 4,
      theme: "light",
      foilPreset: "silver",
      foilImage: "",
      showRemaining: true,
      isDemo: true,
      prizes,
      lastOne,
      slots,
      scratchedCount: 0,
      remainingDraws: 12,
      remaining: prizes.map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image,
        quantity: p.quantity,
        remaining: p.quantity,
        numbers: slots
          .filter((slot) => slot.prize.id === p.id)
          .map((slot) => slot.number)
          .sort((a, b) => a - b),
      })),
      winningNumbers: slots
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((slot) => ({
          number: slot.number,
          scratched: false,
          prizeId: slot.prize.id,
          name: slot.prize.name,
          image: slot.prize.image,
        })),
      layout: { ...LAYOUT_DEFAULTS },
    };
  }

  function loadDemoBoard() {
    try {
      const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id === "demo" && Array.isArray(parsed.slots)) {
          return normalizeProduct(parsed);
        }
      }
    } catch (_error) {}
    const demo = buildDemoBoard();
    saveDemoBoard(demo);
    return normalizeProduct(demo);
  }

  function saveDemoBoard(product) {
    try {
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(product));
    } catch (_error) {}
  }

  function normalizeLayout(layout) {
    return {
      slotSize: layout.slotSize ?? LAYOUT_DEFAULTS.slotSize,
      gap: layout.gap ?? LAYOUT_DEFAULTS.gap,
      zoomTargetSize: layout.zoomTargetSize ?? LAYOUT_DEFAULTS.zoomTargetSize,
      zoomPadding: layout.zoomPadding ?? LAYOUT_DEFAULTS.zoomPadding,
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function computeOptimalCols(slotCount, aspect) {
    if (slotCount <= 1) return 1;
    const ratio = aspect > 0 ? aspect : 1;
    let minCols = 2;
    if (slotCount > 12) minCols = 4;
    if (slotCount > 36) minCols = 8;
    const maxCols = slotCount;

    let targetCols = Math.round(Math.sqrt(slotCount * ratio));
    targetCols = clamp(targetCols, minCols, maxCols);

    for (let i = 0; i < 12; i++) {
      const rows = Math.ceil(slotCount / targetCols);
      const gridAspect = targetCols / Math.max(rows, 1);
      if (gridAspect < ratio * 0.92 && targetCols < maxCols) {
        targetCols += 1;
      } else if (gridAspect > ratio * 1.08 && targetCols > minCols) {
        targetCols -= 1;
      } else {
        break;
      }
    }

    return targetCols;
  }

  function normalizeProduct(raw) {
    const slotCount = Math.max(
      1,
      Number(raw.slotCount ?? raw.totalDraws) || 1
    );
    const cols = computeOptimalCols(slotCount);
    const rows = Math.ceil(slotCount / cols);

    return {
      id: String(raw.id || "product"),
      name: String(raw.name || ""),
      description: String(raw.description || ""),
      coverImage: String(raw.coverImage || ""),
      detailImage: String(raw.detailImage || ""),
      price: Number(raw.price) || 0,
      category: String(raw.category || ""),
      slotCount,
      totalDraws: Number(raw.totalDraws ?? slotCount) || slotCount,
      cols,
      rows,
      theme: String(raw.theme || "light"),
      foilPreset: String(raw.foilPreset || "silver"),
      foilImage: String(raw.foilImage || ""),
      showRemaining: Boolean(raw.showRemaining),
      isDemo: Boolean(raw.isDemo || raw.id === "demo"),
      prizes: Array.isArray(raw.prizes) ? raw.prizes : [],
      remaining: Array.isArray(raw.remaining) ? raw.remaining : [],
      winningNumbers: Array.isArray(raw.winningNumbers) ? raw.winningNumbers : [],
      slots: Array.isArray(raw.slots) ? raw.slots : [],
      lastOne: raw.lastOne || null,
      scratchedCount: Number(raw.scratchedCount) || 0,
      remainingDraws:
        raw.remainingDraws != null
          ? Number(raw.remainingDraws)
          : Math.max(0, slotCount - (Number(raw.scratchedCount) || 0)),
      layout: normalizeLayout(raw.layout || {}),
    };
  }

  async function fetchProduct(productId) {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get("preview") === "1";
    const url = preview
      ? `/api/products/${encodeURIComponent(productId)}?preview=1`
      : `/api/products/${encodeURIComponent(productId)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`product ${productId} not found`);
    }
    return normalizeProduct(await response.json());
  }

  function scratchDemoSlot(productId, slotIndex) {
    const product = loadDemoBoard();
    const slot = product.slots.find((item) => item.slotIndex === slotIndex);
    if (!slot) {
      throw new Error("找不到格子");
    }

    const wasLast =
      !slot.scratched && product.scratchedCount === product.totalDraws - 1;

    if (!slot.scratched) {
      slot.scratched = true;
      product.scratchedCount += 1;
      product.remainingDraws = Math.max(0, product.totalDraws - product.scratchedCount);
      product.remaining = product.remaining.map((item) => {
        if (item.id === slot.prize.id) {
          return { ...item, remaining: Math.max(0, item.remaining - 1) };
        }
        return item;
      });
      product.winningNumbers = product.winningNumbers.map((item) => {
        if (item.number === slot.number) {
          return { ...item, scratched: true };
        }
        return item;
      });
      saveDemoBoard(product);
    }

    return {
      slotIndex: slot.slotIndex,
      number: slot.number,
      scratched: true,
      prize: slot.prize,
      lastOneAwarded: wasLast ? product.lastOne : null,
      remaining: product.remaining,
      scratchedCount: product.scratchedCount,
      remainingDraws: product.remainingDraws,
      product,
    };
  }

  async function claimSlot(productId, slotIndex) {
    if (productId === "demo") {
      const product = loadDemoBoard();
      const slot = product.slots.find((item) => item.slotIndex === slotIndex);
      if (!slot) throw new Error("slot missing");
      return {
        slotIndex,
        number: slot.number,
        scratched: Boolean(slot.scratched),
        prize: slot.prize,
        lastOneAwarded: null,
        remaining: product.remaining,
        scratchedCount: product.scratchedCount,
        remainingDraws: product.remainingDraws,
      };
    }

    const response = await fetch(
      `/api/products/${productId}/slots/${slotIndex}/claim`,
      { method: "POST" }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "claim failed");
    }
    return response.json();
  }

  async function scratchSlot(productId, slotIndex) {
    if (productId === "demo") {
      return scratchDemoSlot(productId, slotIndex);
    }

    const response = await fetch(
      `/api/products/${productId}/slots/${slotIndex}/scratch`,
      { method: "POST" }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "scratch failed");
    }
    return response.json();
  }

  async function loadCurrent() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("product");

    if (!productId || productId === "demo") {
      if (window.PageTransition) {
        PageTransition.navigate("/shop", "to-shop");
      } else {
        window.location.replace("/shop");
      }
      return null;
    }

    return fetchProduct(productId);
  }

  window.ProductStore = {
    loadCurrent,
    fetchProduct,
    claimSlot,
    scratchSlot,
    normalizeProduct,
    computeOptimalCols,
    loadDemoBoard,
    DEMO_PRODUCT: buildDemoBoard(),
  };
})();
