(function () {
  "use strict";

  const LOD_0_MAX = 10;
  const LOD_1_MAX = 36;
  const TILE_SLOT_COLS = 8;
  const TILE_SLOT_ROWS = 8;
  const PAN_CLICK_THRESHOLD = 6;
  const SCRATCH_ENTRY_SCALE_RATIO = 0.39;
  const ZOOM_ASSIST_FACTOR = 3;
  const MIN_SLOT_HIT_SCREEN_PX = 16;
  const MAX_FULL_BOARD_DPR = 2;
  const MAX_FULL_BOARD_EDGE = 4096;
  const MAX_FULL_BOARD_AREA = 16 * 1024 * 1024;

  const FOIL_FILL = {
    silver: "#a3a3a3",
    gold: "#d4a84b",
    color: "#a78bfa",
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createBoardEngine(options) {
    const viewport = options.viewport;
    const world = options.world;
    const board = options.board;
    const boardCanvas = options.boardCanvas;
    const boardTiles = options.boardTiles;
    const boardSlots = options.boardSlots;

    const state = {
      product: null,
      mode: "navigate",
      selectedIndex: null,
      camera: { tx: 0, ty: 0, scale: 1 },
      navigateSnapshot: null,
      lod: 0,
      isAnimating: false,
      slotPool: new Map(),
      tiles: new Map(),
      dirtyTiles: new Set(),
      fullBoardDirty: true,
      rafId: 0,
      pointers: new Map(),
      panStart: null,
      pinchStart: null,
      tapCandidate: null,
      gesturing: false,
      lastPreviewBucket: -1,
      wheelIdleTimer: 0,
      viewportRect: null,
      getFoilOptions: options.getFoilOptions || (() => ({ preset: "silver", imageUrl: "" })),
      getSlotData: options.getSlotData || (() => null),
      getSlotResidueThumb: options.getSlotResidueThumb || null,
      onSlotTap: options.onSlotTap || null,
      onSlotRecycle: options.onSlotRecycle || null,
      onSlotEnsure: options.onSlotEnsure || null,
      displayCols: 4,
      displayRows: 1,
    };

    function getCols() {
      return state.displayCols;
    }

    function getRows() {
      return state.displayRows;
    }

    function computeDisplayCols() {
      const { slotCount } = state.product;
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      return ProductStore.computeOptimalCols(slotCount, vw / Math.max(vh, 1));
    }

    function syncDisplayLayout() {
      const nextCols = computeDisplayCols();
      const changed = state.displayCols !== nextCols;
      state.displayCols = nextCols;
      state.displayRows = Math.ceil(state.product.slotCount / nextCols);
      setupBoardDimensions();
      if (changed) {
        state.slotPool.forEach((handle, index) => {
          if (typeof state.onSlotRecycle === "function") {
            state.onSlotRecycle(index, handle);
          }
          handle.slot.remove();
        });
        state.slotPool.clear();
        state.tiles.forEach((tile) => tile.canvas.remove());
        state.tiles.clear();
        state.dirtyTiles.clear();
        state.fullBoardDirty = true;
        state.lod = -1;
      }
      return changed;
    }

    function getLayout() {
      return state.product.layout;
    }

    function getBoardSize() {
      const cols = getCols();
      const rows = getRows();
      const { slotSize, gap } = getLayout();
      return {
        width: cols * slotSize + (cols - 1) * gap,
        height: rows * slotSize + (rows - 1) * gap,
      };
    }

    function getStep() {
      const { slotSize, gap } = getLayout();
      return slotSize + gap;
    }

    function getSlotCenter(index) {
      const cols = getCols();
      const { slotSize, gap } = getLayout();
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        x: col * (slotSize + gap) + slotSize / 2,
        y: row * (slotSize + gap) + slotSize / 2,
      };
    }

    function getSlotTopLeft(index) {
      const cols = getCols();
      const { slotSize, gap } = getLayout();
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        x: col * (slotSize + gap),
        y: row * (slotSize + gap),
      };
    }

    function getMinScale() {
      const { width, height } = getBoardSize();
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const padding =
        state.product && state.product.slotCount > 36 ? 0.96 : getLayout().zoomPadding || 0.88;
      return Math.min(vw / width, vh / height) * padding * 0.98;
    }

    function getMaxScale() {
      const { slotSize, zoomTargetSize } = getLayout();
      const vw = viewport.clientWidth;
      const targetSize = Math.min(vw * 0.72, zoomTargetSize);
      return targetSize / slotSize;
    }

    function getVisualSlotSize() {
      return getLayout().slotSize * state.camera.scale;
    }

    function canEnterScratch() {
      return state.camera.scale >= getMaxScale() * SCRATCH_ENTRY_SCALE_RATIO;
    }

    function getSlotScreenPoint(index) {
      const center = getSlotCenter(index);
      return {
        x: center.x * state.camera.scale + state.camera.tx,
        y: center.y * state.camera.scale + state.camera.ty,
      };
    }

    function zoomTowardSlot(index, factor, animate) {
      const center = getSlotCenter(index);
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const nextScale = clamp(
        state.camera.scale * (factor || ZOOM_ASSIST_FACTOR),
        getMinScale(),
        getMaxScale()
      );
      return flyTo(
        {
          tx: vw / 2 - center.x * nextScale,
          ty: vh / 2 - center.y * nextScale,
          scale: nextScale,
        },
        animate
      );
    }

    function getFullBoardPixelSize() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_FULL_BOARD_DPR);
      const { width, height } = getBoardSize();
      return {
        dpr,
        width,
        height,
        pxW: Math.max(1, Math.floor(width * dpr)),
        pxH: Math.max(1, Math.floor(height * dpr)),
      };
    }

    function isFullBoardCanvasSafe() {
      const { pxW, pxH } = getFullBoardPixelSize();
      return (
        pxW <= MAX_FULL_BOARD_EDGE &&
        pxH <= MAX_FULL_BOARD_EDGE &&
        pxW * pxH <= MAX_FULL_BOARD_AREA
      );
    }

    function getLodLevel(visualSize) {
      if (state.mode === "scratch") return 3;
      if (visualSize < LOD_0_MAX) {
        return isFullBoardCanvasSafe() ? 0 : 1;
      }
      if (visualSize < LOD_1_MAX) return 1;
      return 2;
    }

    function getFitWidthCamera() {
      const { width, height } = getBoardSize();
      const { zoomPadding } = getLayout();
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const padding = zoomPadding || 0.88;
      const scale = (vw / width) * padding;
      const tx = (vw - width * scale) / 2;
      let ty;
      const scaledHeight = height * scale;
      if (scaledHeight <= vh) {
        ty = (vh - scaledHeight) / 2;
      } else {
        ty = 0;
      }
      return { tx, ty, scale };
    }

    function getFitAllCamera() {
      const { width, height } = getBoardSize();
      const { zoomPadding } = getLayout();
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const padding =
        state.product.slotCount > 36 ? 0.96 : zoomPadding || 0.88;
      const scale = Math.min(vw / width, vh / height) * padding;
      return {
        tx: (vw - width * scale) / 2,
        ty: (vh - height * scale) / 2,
        scale,
      };
    }

    function getInitialCamera() {
      if (state.product.slotCount <= 24) {
        const fitWidth = getFitWidthCamera();
        const fitAll = getFitAllCamera();
        if (fitAll.scale > fitWidth.scale) return fitAll;
        return fitWidth;
      }
      return getFitAllCamera();
    }

    function getDetailCamera(index) {
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const center = getSlotCenter(index);
      const { slotSize, zoomTargetSize } = getLayout();
      const targetSize = Math.min(vw * 0.72, zoomTargetSize);
      const scale = targetSize / slotSize;
      return {
        tx: vw / 2 - center.x * scale,
        ty: vh / 2 - center.y * scale,
        scale,
      };
    }

    function getSlotAlignCamera(index) {
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const center = getSlotCenter(index);
      const { slotSize } = getLayout();
      const alignVisual = LOD_1_MAX + 6;
      const scale = clamp(alignVisual / slotSize, getMinScale(), getMaxScale());
      return {
        tx: vw / 2 - center.x * scale,
        ty: vh / 2 - center.y * scale,
        scale,
      };
    }

    function clampCamera(camera) {
      const { width, height } = getBoardSize();
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const bw = width * camera.scale;
      const bh = height * camera.scale;
      const margin = 40;
      const minTx = Math.min(margin, vw - bw - margin);
      const maxTx = Math.max(margin, vw - margin);
      const minTy = Math.min(margin, vh - bh - margin);
      const maxTy = Math.max(margin, vh - margin);
      return {
        tx: clamp(camera.tx, minTx, maxTx),
        ty: clamp(camera.ty, minTy, maxTy),
        scale: clamp(camera.scale, getMinScale(), getMaxScale()),
      };
    }

    function screenToWorld(sx, sy) {
      return {
        x: (sx - state.camera.tx) / state.camera.scale,
        y: (sy - state.camera.ty) / state.camera.scale,
      };
    }

    function getViewportPoint(clientX, clientY) {
      const rect = state.viewportRect || viewport.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function getVisibleWorldRect() {
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const topLeft = screenToWorld(0, 0);
      const bottomRight = screenToWorld(vw, vh);
      const { slotSize, gap } = getLayout();
      const margin = slotSize + gap;
      return {
        x: topLeft.x - margin,
        y: topLeft.y - margin,
        width: bottomRight.x - topLeft.x + margin * 2,
        height: bottomRight.y - topLeft.y + margin * 2,
      };
    }

    function pickSlotIndex(clientX, clientY) {
      const point = getViewportPoint(clientX, clientY);
      const world = screenToWorld(point.x, point.y);
      const { slotCount } = state.product;
      const cols = getCols();
      const { slotSize, gap } = getLayout();
      const step = slotSize + gap;
      const hitRadius = Math.max(
        slotSize / 2,
        MIN_SLOT_HIT_SCREEN_PX / Math.max(state.camera.scale, 0.0001)
      );
      const searchRadius = hitRadius + step;
      const colStart = Math.max(0, Math.floor((world.x - searchRadius) / step));
      const colEnd = Math.min(cols - 1, Math.floor((world.x + searchRadius) / step));
      const rowStart = Math.max(0, Math.floor((world.y - searchRadius) / step));
      const rowEnd = Math.floor((world.y + searchRadius) / step);

      let bestIndex = null;
      let bestDist = Infinity;
      for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
          const index = row * cols + col;
          if (index < 0 || index >= slotCount) continue;
          const cx = col * step + slotSize / 2;
          const cy = row * step + slotSize / 2;
          const dist = Math.hypot(world.x - cx, world.y - cy);
          if (dist <= hitRadius && dist < bestDist) {
            bestDist = dist;
            bestIndex = index;
          }
        }
      }
      return bestIndex;
    }

    function applyCameraTransform(camera, animate) {
      state.camera = clampCamera(camera);
      world.classList.toggle("is-animating", Boolean(animate));
      world.style.transform = `translate3d(${state.camera.tx}px, ${state.camera.ty}px, 0) scale(${state.camera.scale})`;
      if (state.gesturing && !animate) return;
      scheduleRender();
    }

    function setGesturing(active) {
      if (state.gesturing === active) return;
      state.gesturing = active;
      viewport.classList.toggle("is-gesturing", active);
      if (!active) {
        state.lastPreviewBucket = -1;
        scheduleRender();
      }
    }

    function waitForTransition() {
      return new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          world.removeEventListener("transitionend", onEnd);
          world.classList.remove("is-animating");
          scheduleRender();
          resolve();
        };
        const onEnd = (event) => {
          if (event.propertyName !== "transform") return;
          finish();
        };
        world.addEventListener("transitionend", onEnd);
        setTimeout(finish, 720);
      });
    }

    function flyTo(camera, animate) {
      if (animate) {
        state.isAnimating = true;
        applyCameraTransform(camera, true);
        return waitForTransition().then(() => {
          state.isAnimating = false;
        });
      }
      applyCameraTransform(camera, false);
      return Promise.resolve();
    }

    function flyToSlot(index, targetScale, animate) {
      const center = getSlotCenter(index);
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const scale = clamp(targetScale, getMinScale(), getMaxScale());
      return flyTo(
        {
          tx: vw / 2 - center.x * scale,
          ty: vh / 2 - center.y * scale,
          scale,
        },
        animate
      );
    }

    async function flyToSlotDetail(index) {
      state.isAnimating = true;
      try {
        await flyTo(getSlotAlignCamera(index), true);
        await flyTo(getDetailCamera(index), true);
      } finally {
        state.isAnimating = false;
      }
    }

    function getOpenedFill() {
      const theme = state.product.theme || "light";
      if (theme === "dark") return "#404040";
      return "#e5e5e5";
    }

    function getVisitedFill() {
      const theme = state.product.theme || "light";
      if (theme === "dark") return "#4f4f4f";
      return "#cfcfcf";
    }

    function getFoilFill() {
      const foil = state.getFoilOptions();
      return FOIL_FILL[foil.preset] || FOIL_FILL.silver;
    }

    function drawSlotCircle(ctx, slotData, x, y, radius, index) {
      const scratched = slotData && slotData.scratched;
      const visited = slotData && slotData.visited;
      const thumb =
        typeof state.getSlotResidueThumb === "function"
          ? state.getSlotResidueThumb(index)
          : null;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (scratched) {
        ctx.fillStyle = getOpenedFill();
      } else if (visited) {
        ctx.fillStyle = getVisitedFill();
      } else {
        ctx.fillStyle = getFoilFill();
      }
      ctx.fill();

      if (thumb) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.clip();
        const size = radius * 2;
        ctx.drawImage(thumb, x - radius, y - radius, size, size);
        ctx.restore();
      }
    }

    function drawFullBoard() {
      const ctx = boardCanvas.getContext("2d");
      const { dpr, width, height } = getFullBoardPixelSize();
      let pxW = Math.max(1, Math.floor(width * dpr));
      let pxH = Math.max(1, Math.floor(height * dpr));
      let scale = dpr;
      const edgeScale = Math.min(1, MAX_FULL_BOARD_EDGE / pxW, MAX_FULL_BOARD_EDGE / pxH);
      const areaScale =
        pxW * pxH > MAX_FULL_BOARD_AREA
          ? Math.sqrt(MAX_FULL_BOARD_AREA / (pxW * pxH))
          : 1;
      const budgetScale = Math.min(edgeScale, areaScale);
      if (budgetScale < 1) {
        pxW = Math.max(1, Math.floor(pxW * budgetScale));
        pxH = Math.max(1, Math.floor(pxH * budgetScale));
        scale = dpr * budgetScale;
      }
      if (boardCanvas.width !== pxW || boardCanvas.height !== pxH) {
        boardCanvas.width = pxW;
        boardCanvas.height = pxH;
        boardCanvas.style.width = `${width}px`;
        boardCanvas.style.height = `${height}px`;
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const { slotSize } = getLayout();
      const radius = slotSize / 2;
      for (let index = 0; index < state.product.slotCount; index++) {
        const center = getSlotCenter(index);
        drawSlotCircle(ctx, state.getSlotData(index), center.x, center.y, radius, index);
      }
      state.fullBoardDirty = false;
    }

    function getTileKey(tileCol, tileRow) {
      return `${tileCol}_${tileRow}`;
    }

    function getTileBounds(tileCol, tileRow) {
      const cols = getCols();
      const rows = getRows();
      const { slotSize, gap } = getLayout();
      const step = slotSize + gap;
      const startCol = tileCol * TILE_SLOT_COLS;
      const startRow = tileRow * TILE_SLOT_ROWS;
      const endCol = Math.min(cols, startCol + TILE_SLOT_COLS);
      const endRow = Math.min(rows, startRow + TILE_SLOT_ROWS);
      const width = (endCol - startCol) * step - (endCol > startCol ? 0 : 0);
      const height = (endRow - startRow) * step - (endRow > startRow ? 0 : 0);
      const w =
        endCol > startCol
          ? (endCol - startCol) * slotSize + (endCol - startCol - 1) * gap
          : 0;
      const h =
        endRow > startRow
          ? (endRow - startRow) * slotSize + (endRow - startRow - 1) * gap
          : 0;
      return {
        startCol,
        startRow,
        endCol,
        endRow,
        x: startCol * step,
        y: startRow * step,
        width: w,
        height: h,
      };
    }

    function drawTile(tileCol, tileRow) {
      const bounds = getTileBounds(tileCol, tileRow);
      if (bounds.width <= 0 || bounds.height <= 0) return null;

      const key = getTileKey(tileCol, tileRow);
      let tile = state.tiles.get(key);
      if (!tile) {
        const canvas = document.createElement("canvas");
        canvas.className = "board-tile";
        boardTiles.appendChild(canvas);
        tile = { canvas, tileCol, tileRow };
        state.tiles.set(key, tile);
      }

      const cols = getCols();
      const { slotSize, gap } = getLayout();
      const step = slotSize + gap;
      const dpr = window.devicePixelRatio || 1;
      const pxW = Math.max(1, Math.floor(bounds.width * dpr));
      const pxH = Math.max(1, Math.floor(bounds.height * dpr));

      tile.canvas.width = pxW;
      tile.canvas.height = pxH;
      tile.canvas.style.left = `${bounds.x}px`;
      tile.canvas.style.top = `${bounds.y}px`;
      tile.canvas.style.width = `${bounds.width}px`;
      tile.canvas.style.height = `${bounds.height}px`;

      const ctx = tile.canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, bounds.width, bounds.height);
      const radius = slotSize / 2;

      for (let row = bounds.startRow; row < bounds.endRow; row++) {
        for (let col = bounds.startCol; col < bounds.endCol; col++) {
          const index = row * cols + col;
          if (index >= state.product.slotCount) continue;
          const localX = col * step - bounds.x + slotSize / 2;
          const localY = row * step - bounds.y + slotSize / 2;
          drawSlotCircle(ctx, state.getSlotData(index), localX, localY, radius, index);
        }
      }

      state.dirtyTiles.delete(key);
      return tile;
    }

    function getVisibleTileRange() {
      const rect = getVisibleWorldRect();
      const cols = getCols();
      const rows = getRows();
      const { slotSize, gap } = getLayout();
      const step = slotSize + gap;
      const startCol = clamp(Math.floor(rect.x / step), 0, cols - 1);
      const startRow = clamp(Math.floor(rect.y / step), 0, rows - 1);
      const endCol = clamp(Math.ceil((rect.x + rect.width) / step), 0, cols);
      const endRow = clamp(Math.ceil((rect.y + rect.height) / step), 0, rows);
      const tileColStart = Math.floor(startCol / TILE_SLOT_COLS);
      const tileRowStart = Math.floor(startRow / TILE_SLOT_ROWS);
      const tileColEnd = Math.floor((endCol - 1) / TILE_SLOT_COLS);
      const tileRowEnd = Math.floor((endRow - 1) / TILE_SLOT_ROWS);
      return { tileColStart, tileRowStart, tileColEnd, tileRowEnd };
    }

    function syncTileLayer() {
      const range = getVisibleTileRange();
      const needed = new Set();

      for (let tr = range.tileRowStart; tr <= range.tileRowEnd; tr++) {
        for (let tc = range.tileColStart; tc <= range.tileColEnd; tc++) {
          const key = getTileKey(tc, tr);
          needed.add(key);
          const tile = state.tiles.get(key);
          if (!tile || state.dirtyTiles.has(key)) {
            drawTile(tc, tr);
          }
        }
      }

      state.tiles.forEach((tile, key) => {
        if (!needed.has(key)) {
          tile.canvas.remove();
          state.tiles.delete(key);
        }
      });
    }

    function ensureSlotDom(index) {
      if (state.slotPool.has(index)) {
        return state.slotPool.get(index);
      }

      const { slotSize, gap } = getLayout();
      const pos = getSlotTopLeft(index);
      const slotData = state.getSlotData(index);

      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "slot";
      slot.dataset.index = String(index);
      slot.style.width = `${slotSize}px`;
      slot.style.height = `${slotSize}px`;
      slot.style.left = `${pos.x}px`;
      slot.style.top = `${pos.y}px`;

      const preview = document.createElement("div");
      preview.className = "slot__preview";
      const foil = state.getFoilOptions();
      const previewCanvas = ScratchTexture.createPreviewCanvas(
        getVisualSlotSize(),
        foil,
        { localSize: slotSize }
      );
      previewCanvas.className = "slot__preview-canvas";
      preview.appendChild(previewCanvas);

      const numberEl = document.createElement("div");
      numberEl.className = "slot__number";
      numberEl.hidden = true;

      const scratchHost = document.createElement("div");
      scratchHost.className = "slot__scratch";

      slot.append(preview, numberEl, scratchHost);

      if (slotData && slotData.scratched) {
        slot.classList.add("is-opened", "is-visited");
        preview.hidden = true;
      }

      boardSlots.appendChild(slot);
      const handle = { slot, preview, scratchHost, numberEl };
      state.slotPool.set(index, handle);
      if (typeof state.onSlotEnsure === "function") {
        state.onSlotEnsure(index, handle);
      }
      return handle;
    }

    function getVisibleSlotIndices() {
      const rect = getVisibleWorldRect();
      const { slotCount } = state.product;
      const cols = getCols();
      const rows = getRows();
      const { slotSize, gap } = getLayout();
      const step = slotSize + gap;
      const startCol = clamp(Math.floor(rect.x / step), 0, cols - 1);
      const startRow = clamp(Math.floor(rect.y / step), 0, rows - 1);
      const endCol = clamp(Math.ceil((rect.x + rect.width) / step), 0, cols);
      const endRow = clamp(Math.ceil((rect.y + rect.height) / step), 0, rows);
      const indices = [];
      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          const index = row * cols + col;
          if (index < slotCount) indices.push(index);
        }
      }
      return indices;
    }

    function syncSlotLayer() {
      const needed = new Set(getVisibleSlotIndices());
      if (state.mode === "scratch" && state.selectedIndex !== null) {
        needed.add(state.selectedIndex);
      }

      needed.forEach((index) => {
        ensureSlotDom(index);
      });

      state.slotPool.forEach((handle, index) => {
        if (!needed.has(index)) {
          if (typeof state.onSlotRecycle === "function") {
            state.onSlotRecycle(index, handle);
          }
          handle.slot.remove();
          state.slotPool.delete(index);
        }
      });
    }

    function syncSlotPreviewSizes() {
      const visualSize = getVisualSlotSize();
      const localSize = getLayout().slotSize;
      const bucket = ScratchTexture.getPreviewPixelSize(visualSize);
      if (bucket === state.lastPreviewBucket) return;
      state.lastPreviewBucket = bucket;
      state.slotPool.forEach((handle) => {
        if (handle.slot.classList.contains("is-visited")) return;
        const previewCanvas = handle.preview.querySelector(".slot__preview-canvas");
        if (previewCanvas) {
          ScratchTexture.resizePreviewCanvas(previewCanvas, visualSize, { localSize });
        }
      });
    }

    function setLayerVisibility(lod) {
      const showCanvas = lod === 0;
      const showTiles = lod === 1;
      const showSlots = lod >= 2;

      boardCanvas.classList.toggle("is-active", showCanvas);
      boardTiles.classList.toggle("is-active", showTiles);
      boardSlots.classList.toggle("is-active", showSlots);

      if (!showCanvas) boardCanvas.getContext("2d").clearRect(0, 0, boardCanvas.width, boardCanvas.height);
      if (!showTiles) {
        state.tiles.forEach((tile) => tile.canvas.remove());
        state.tiles.clear();
      }
      if (!showSlots && state.mode !== "scratch") {
        state.slotPool.forEach((handle, index) => {
          if (typeof state.onSlotRecycle === "function") {
            state.onSlotRecycle(index, handle);
          }
          handle.slot.remove();
        });
        state.slotPool.clear();
      }
    }

    function render() {
      state.rafId = 0;
      if (!state.product || state.gesturing) return;

      const visualSize = getVisualSlotSize();
      const lod = getLodLevel(visualSize);
      if (lod !== state.lod) {
        state.lod = lod;
        setLayerVisibility(lod);
        if (lod === 0) state.fullBoardDirty = true;
        if (lod === 1) {
          state.tiles.forEach((_tile, key) => state.dirtyTiles.add(key));
        }
      }

      if (lod === 0) {
        if (state.fullBoardDirty) drawFullBoard();
      } else if (lod === 1) {
        syncTileLayer();
      } else {
        syncSlotLayer();
        syncSlotPreviewSizes();
      }
    }

    function scheduleRender() {
      if (state.rafId) return;
      state.rafId = requestAnimationFrame(render);
    }

    function markSlotDirty(index) {
      state.fullBoardDirty = true;
      const cols = getCols();
      const col = index % cols;
      const row = Math.floor(index / cols);
      const tileCol = Math.floor(col / TILE_SLOT_COLS);
      const tileRow = Math.floor(row / TILE_SLOT_ROWS);
      state.dirtyTiles.add(getTileKey(tileCol, tileRow));
      scheduleRender();
    }

    function setupBoardDimensions() {
      const { width, height } = getBoardSize();
      board.style.width = `${width}px`;
      board.style.height = `${height}px`;
    }

    function loadProduct(product) {
      state.product = ProductStore.normalizeProduct(product);
      state.mode = "navigate";
      state.selectedIndex = null;
      state.navigateSnapshot = null;
      state.slotPool.clear();
      state.tiles.clear();
      state.dirtyTiles.clear();
      state.fullBoardDirty = true;
      state.lod = -1;
      boardSlots.replaceChildren();
      boardTiles.replaceChildren();
      syncDisplayLayout();
      applyCameraTransform(getInitialCamera(), false);
    }

    function setScratchMode(index) {
      state.mode = "scratch";
      state.selectedIndex = index;
      board.classList.add("is-detail");
      board.dataset.activeIndex = String(index);
      viewport.classList.add("is-scratch");
      setLayerVisibility(2);
      syncSlotLayer();
    }

    function setNavigateMode() {
      state.mode = "navigate";
      state.selectedIndex = null;
      board.classList.remove("is-detail");
      delete board.dataset.activeIndex;
      viewport.classList.remove("is-scratch");
      scheduleRender();
    }

    function saveNavigateSnapshot() {
      state.navigateSnapshot = { ...state.camera };
    }

    function getNavigateSnapshot() {
      return state.navigateSnapshot ? { ...state.navigateSnapshot } : getInitialCamera();
    }

    async function handleSlotTap(index) {
      if (state.isAnimating || state.mode === "scratch") return;
      if (typeof state.onSlotTap === "function") {
        state.onSlotTap(index);
      }
    }

    function zoomAt(clientX, clientY, factor) {
      const { x: screenX, y: screenY } = getViewportPoint(clientX, clientY);
      const before = screenToWorld(screenX, screenY);
      const nextScale = clamp(state.camera.scale * factor, getMinScale(), getMaxScale());
      const tx = screenX - before.x * nextScale;
      const ty = screenY - before.y * nextScale;
      applyCameraTransform({ tx, ty, scale: nextScale }, false);
    }

    function onWheel(event) {
      if (state.mode === "scratch" || state.isAnimating) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setGesturing(true);
      zoomAt(event.clientX, event.clientY, factor);
      window.clearTimeout(state.wheelIdleTimer);
      state.wheelIdleTimer = window.setTimeout(() => {
        if (state.pointers.size === 0) setGesturing(false);
      }, 140);
    }

    function onPointerDown(event) {
      if (state.mode === "scratch" || state.isAnimating) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      window.clearTimeout(state.wheelIdleTimer);
      viewport.setPointerCapture(event.pointerId);
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      setGesturing(true);

      if (state.pointers.size === 1) {
        state.panStart = {
          x: event.clientX,
          y: event.clientY,
          tx: state.camera.tx,
          ty: state.camera.ty,
        };
        state.tapCandidate = { x: event.clientX, y: event.clientY };
      } else if (state.pointers.size === 2) {
        const pts = Array.from(state.pointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const cx = (pts[0].x + pts[1].x) / 2;
        const cy = (pts[0].y + pts[1].y) / 2;
        state.pinchStart = { dist, scale: state.camera.scale, cx, cy };
        state.tapCandidate = null;
      }
    }

    function onPointerMove(event) {
      if (!state.pointers.has(event.pointerId)) return;
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (state.pointers.size === 2 && state.pinchStart) {
        const pts = Array.from(state.pointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mid = getViewportPoint(
          (pts[0].x + pts[1].x) / 2,
          (pts[0].y + pts[1].y) / 2
        );
        const cx = mid.x;
        const cy = mid.y;
        const factor = dist / state.pinchStart.dist;
        const before = screenToWorld(cx, cy);
        const nextScale = clamp(
          state.pinchStart.scale * factor,
          getMinScale(),
          getMaxScale()
        );
        applyCameraTransform(
          {
            tx: cx - before.x * nextScale,
            ty: cy - before.y * nextScale,
            scale: nextScale,
          },
          false
        );
        state.tapCandidate = null;
        return;
      }

      if (state.pointers.size === 1 && state.panStart) {
        const dx = event.clientX - state.panStart.x;
        const dy = event.clientY - state.panStart.y;
        if (
          state.tapCandidate &&
          Math.hypot(dx, dy) > PAN_CLICK_THRESHOLD
        ) {
          state.tapCandidate = null;
        }
        applyCameraTransform(
          {
            tx: state.panStart.tx + dx,
            ty: state.panStart.ty + dy,
            scale: state.camera.scale,
          },
          false
        );
      }
    }

    function onPointerUp(event) {
      if (!state.pointers.has(event.pointerId)) return;

      if (state.tapCandidate && state.pointers.size === 1) {
        const dx = event.clientX - state.tapCandidate.x;
        const dy = event.clientY - state.tapCandidate.y;
        if (Math.hypot(dx, dy) <= PAN_CLICK_THRESHOLD) {
          const index = pickSlotIndex(event.clientX, event.clientY);
          if (index !== null) handleSlotTap(index);
        }
      }

      state.pointers.delete(event.pointerId);
      if (state.pointers.size < 2) state.pinchStart = null;
      if (state.pointers.size === 0) {
        state.panStart = null;
        state.tapCandidate = null;
        setGesturing(false);
      }
      try {
        viewport.releasePointerCapture(event.pointerId);
      } catch (_error) {}
    }

    function bindInput() {
      viewport.addEventListener("wheel", onWheel, { passive: false });
      viewport.addEventListener("pointerdown", onPointerDown);
      viewport.addEventListener("pointermove", onPointerMove);
      viewport.addEventListener("pointerup", onPointerUp);
      viewport.addEventListener("pointercancel", onPointerUp);
    }

    function handleResize() {
      world.classList.remove("is-animating");
      state.viewportRect = viewport.getBoundingClientRect();
      const layoutChanged = syncDisplayLayout();
      if (state.mode === "scratch" && state.selectedIndex !== null) {
        applyCameraTransform(getDetailCamera(state.selectedIndex), false);
      } else if (layoutChanged || !state.navigateSnapshot) {
        applyCameraTransform(getInitialCamera(), false);
        state.navigateSnapshot = null;
      } else {
        applyCameraTransform(state.navigateSnapshot, false);
      }
      state.fullBoardDirty = true;
      state.tiles.forEach((_tile, key) => state.dirtyTiles.add(key));
      scheduleRender();
    }

    function mount(product) {
      loadProduct(product);
      state.viewportRect = viewport.getBoundingClientRect();
      bindInput();
      scheduleRender();
    }

    function getSlotHandle(index) {
      return state.slotPool.get(index) || ensureSlotDom(index);
    }

    return {
      mount,
      loadProduct,
      handleResize,
      getVisualSlotSize,
      canEnterScratch,
      getSlotScreenPoint,
      zoomTowardSlot,
      getSlotHandle,
      getDetailCamera,
      getSlotAlignCamera,
      getFitAllCamera,
      flyTo,
      flyToSlot,
      flyToSlotDetail,
      saveNavigateSnapshot,
      getNavigateSnapshot,
      setScratchMode,
      setNavigateMode,
      markSlotDirty,
      scheduleRender,
      getCamera: () => ({ ...state.camera }),
      pickSlotIndex,
    };
  }

  window.BoardEngine = {
    create: createBoardEngine,
  };
})();
