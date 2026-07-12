(function () {
  "use strict";

  const MIN_USER_CLEAR_RATIO = 0.012;

  const DEFAULT_CONFIG = {
    brushSizeRatio: 0.1,
    layoutSize: 88,
    revealThreshold: 0.65,
    foilPreset: "silver",
    foilImage: "",
    onReveal: null,
    onScratchStart: null,
    getVisualSize: null,
  };

  function createScratchCard(container, options) {
    const config = { ...DEFAULT_CONFIG, ...options };
    const card = document.createElement("div");
    card.className = "scratch-card";

    const reveal = document.createElement("div");
    reveal.className = "scratch-card__reveal";

    const revealNumber = document.createElement("div");
    revealNumber.className = "scratch-card__number";
    reveal.appendChild(revealNumber);

    const particleCanvas = document.createElement("canvas");
    particleCanvas.className = "scratch-card__particles";

    const canvas = document.createElement("canvas");
    canvas.className = "scratch-card__canvas";

    card.append(reveal, particleCanvas, canvas);
    if (container) {
      container.appendChild(card);
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let audio = null;
    const particles = ScratchEffects.createParticleSystem(particleCanvas);
    let haptics = null;

    const state = {
      isDrawing: false,
      enabled: false,
      coated: false,
      sealed: false,
      sealedNumber: null,
      prizeTriggered: false,
      lastX: 0,
      lastY: 0,
      lastCssX: 0,
      lastCssY: 0,
      lastMoveTime: 0,
      circle: { cx: 0, cy: 0, r: 0 },
      visualSize: 0,
      checkCounter: 0,
      sealedSnapshot: null,
      lastPx: 0,
      scratchNotified: false,
    };

    function getDpr() {
      return window.devicePixelRatio || 1;
    }

    function getLocalSize() {
      return card.clientWidth || config.layoutSize;
    }

    function resolveVisualSize() {
      if (typeof config.getVisualSize === "function") {
        const value = Number(config.getVisualSize());
        if (value > 0) return value;
      }
      const rect = card.getBoundingClientRect();
      return rect.width > 0 ? rect.width : config.layoutSize;
    }

    function fitCanvasBuffer(targetCanvas, visualSize) {
      const dpr = getDpr();
      const local = getLocalSize();
      const visual = Math.max(local, visualSize);
      const px = Math.max(1, Math.floor(visual * dpr));
      targetCanvas.width = px;
      targetCanvas.height = px;
      targetCanvas.style.width = `${visual}px`;
      targetCanvas.style.height = `${visual}px`;
      targetCanvas.style.transformOrigin = "0 0";
      targetCanvas.style.transform = `scale(${local / visual})`;
      return { px, visual, local };
    }

    function ensureEffects() {
      if (!audio) {
        audio = ScratchEffects.createScratchAudio();
        haptics = ScratchEffects.createScratchHaptics();
      }
    }

    function updateCircleMetrics() {
      state.circle = {
        cx: canvas.width / 2,
        cy: canvas.height / 2,
        r: Math.min(canvas.width, canvas.height) / 2,
      };
    }

    function isInsideCircle(x, y) {
      const { cx, cy, r } = state.circle;
      return Math.hypot(x - cx, y - cy) <= r;
    }

    async function drawCoating() {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      await ScratchTexture.paint(ctx, width, height, {
        preset: config.foilPreset,
        imageUrl: config.foilImage,
      });
    }

    function applyDefaultResidue() {
      updateCircleMetrics();
      const { cx, cy, r } = state.circle;
      const brush = Math.max(getBrushRadius(), r * 0.1);
      const strokes = 16;

      for (let i = 0; i < strokes; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * r * 0.82;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;

        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(x, y, brush * (0.7 + Math.random() * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
    }

    function captureSnapshot() {
      if (!canvas.width || !canvas.height) return null;
      return {
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        width: canvas.width,
        height: canvas.height,
      };
    }
    function clearCircleFully() {
      const { cx, cy, r } = state.circle;
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    async function resize() {
      const visual = resolveVisualSize();
      const dpr = getDpr();
      const local = getLocalSize();
      const px = Math.max(1, Math.floor(Math.max(local, visual) * dpr));

      if (px === state.lastPx && state.coated) {
        state.visualSize = visual;
        canvas.style.width = `${Math.max(local, visual)}px`;
        canvas.style.height = `${Math.max(local, visual)}px`;
        canvas.style.transform = `scale(${local / Math.max(local, visual)})`;
        particleCanvas.style.width = canvas.style.width;
        particleCanvas.style.height = canvas.style.height;
        particleCanvas.style.transform = canvas.style.transform;
        requestAnimationFrame(() => {
          fitNumberSize();
        });
        return;
      }

      const prevW = canvas.width;
      const prevH = canvas.height;
      const hadContent = state.coated && prevW > 0 && prevH > 0;
      let snapshot = null;
      if (hadContent) {
        snapshot = document.createElement("canvas");
        snapshot.width = prevW;
        snapshot.height = prevH;
        snapshot.getContext("2d").drawImage(canvas, 0, 0);
      }

      state.lastPx = px;
      state.visualSize = visual;
      fitCanvasBuffer(canvas, visual);
      fitCanvasBuffer(particleCanvas, visual);
      particles.resize(visual, visual);
      requestAnimationFrame(() => {
        fitNumberSize();
      });

      if (snapshot) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(snapshot, 0, 0, canvas.width, canvas.height);
        state.coated = true;
        updateCircleMetrics();
      } else if (state.sealed) {
        await drawCoating();
        state.coated = true;
        updateCircleMetrics();
        if (state.sealedSnapshot) {
          await importScratchState(state.sealedSnapshot);
        } else {
          applyDefaultResidue();
          state.sealedSnapshot = captureSnapshot();
        }
      } else {
        let preserved = null;
        if (state.coated && prevW > 0 && prevH > 0 && measureClearedRatio() > 0) {
          preserved = captureSnapshot();
        }
        await drawCoating();
        state.coated = true;
        updateCircleMetrics();
        if (preserved) {
          await importScratchState(preserved);
        }
      }
    }

    function getPointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      const cssX = clientX - rect.left;
      const cssY = clientY - rect.top;

      return {
        x: (cssX / Math.max(rect.width, 1)) * canvas.width,
        y: (cssY / Math.max(rect.height, 1)) * canvas.height,
        cssX: (cssX / Math.max(rect.width, 1)) * state.visualSize,
        cssY: (cssY / Math.max(rect.height, 1)) * state.visualSize,
      };
    }

    function getBrushRadius() {
      const visual = state.visualSize || config.layoutSize;
      return visual * config.brushSizeRatio * getDpr();
    }

    function scratchAt(x, y) {
      if (!state.enabled || state.sealed || !isInsideCircle(x, y)) return false;

      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, getBrushRadius(), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      notifyScratchStart();
      return true;
    }

    function notifyScratchStart() {
      if (state.scratchNotified || state.sealed) return;
      state.scratchNotified = true;
      if (typeof config.onScratchStart === "function") {
        config.onScratchStart();
      }
    }

    function emitScratchFeedback(cssX, cssY, cssVx, cssVy, velocity) {
      ensureEffects();
      particles.spawn(cssX, cssY, cssVx, cssVy, velocity);
      audio.update(velocity);
      haptics.tick(velocity);
    }

    function scratchLine(x1, y1, x2, y2, cssX1, cssY1, cssX2, cssY2, velocity) {
      const radius = getBrushRadius();
      const distance = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.floor(distance / (radius * 0.4)));
      const cssVx = cssX2 - cssX1;
      const cssVy = cssY2 - cssY1;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        const cssX = cssX1 + (cssX2 - cssX1) * t;
        const cssY = cssY1 + (cssY2 - cssY1) * t;

        scratchAt(x, y);

        if (i % 2 === 0 && isInsideCircle(x, y)) {
          emitScratchFeedback(cssX, cssY, cssVx, cssVy, velocity);
        }
      }
    }

    function stopScratchEffects() {
      if (audio) audio.stop();
      if (haptics) haptics.stop();
    }

    function computeVelocity(cssX, cssY) {
      const now = performance.now();
      const dt = Math.max(now - state.lastMoveTime, 1);
      const distance = Math.hypot(cssX - state.lastCssX, cssY - state.lastCssY);
      state.lastMoveTime = now;
      return (distance / dt) * 16;
    }

    function measureClearedRatio() {
      if (!canvas.width || !canvas.height) return 0;
      const { cx, cy, r } = state.circle;
      const sampleStep = Math.max(2, Math.floor(r / 24));
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let total = 0;
      let clear = 0;

      for (let y = cy - r; y <= cy + r; y += sampleStep) {
        for (let x = cx - r; x <= cx + r; x += sampleStep) {
          if (Math.hypot(x - cx, y - cy) > r) continue;
          total += 1;
          const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(x)));
          const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(y)));
          const alpha = data[(py * canvas.width + px) * 4 + 3];
          if (alpha < 24) clear += 1;
        }
      }

      return total === 0 ? 0 : clear / total;
    }

    function hasAnyClearing() {
      return state.coated && measureClearedRatio() >= MIN_USER_CLEAR_RATIO;
    }

    function hasUserEngaged() {
      return state.scratchNotified;
    }

    async function triggerPrize() {
      if (state.prizeTriggered) return;
      state.prizeTriggered = true;

      try {
        if (typeof config.onReveal === "function") {
          await config.onReveal();
        }
      } catch (_error) {
        state.prizeTriggered = false;
      }
    }

    function maybeReveal() {
      if (state.prizeTriggered || state.sealed) return;
      state.checkCounter += 1;
      if (state.checkCounter % 4 !== 0) return;
      if (measureClearedRatio() >= config.revealThreshold) {
        triggerPrize();
      }
    }

    async function onPointerDown(event) {
      if (!state.enabled || state.sealed) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const pos = getPointerPosition(event);
      if (!isInsideCircle(pos.x, pos.y)) return;

      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-pressed");

      ensureEffects();
      await audio.start();

      state.isDrawing = true;
      state.lastMoveTime = performance.now();
      state.lastX = pos.x;
      state.lastY = pos.y;
      state.lastCssX = pos.cssX;
      state.lastCssY = pos.cssY;

      scratchAt(pos.x, pos.y);
      emitScratchFeedback(pos.cssX, pos.cssY, 0, -1, 4);
      haptics.tick(4);
      maybeReveal();
    }

    function onPointerMove(event) {
      if (!state.enabled || state.sealed) return;

      if (event.pointerType === "mouse" && !(event.buttons & 1)) {
        if (state.isDrawing) {
          endPress();
        }
        return;
      }

      if (!state.isDrawing) return;

      event.preventDefault();
      event.stopPropagation();

      const pos = getPointerPosition(event);
      const velocity = computeVelocity(pos.cssX, pos.cssY);

      scratchLine(
        state.lastX,
        state.lastY,
        pos.x,
        pos.y,
        state.lastCssX,
        state.lastCssY,
        pos.cssX,
        pos.cssY,
        velocity
      );

      state.lastX = pos.x;
      state.lastY = pos.y;
      state.lastCssX = pos.cssX;
      state.lastCssY = pos.cssY;
      maybeReveal();
    }

    function endPress() {
      state.isDrawing = false;
      canvas.classList.remove("is-pressed");
      stopScratchEffects();
    }

    function onPointerUp(event) {
      if (event) {
        event.stopPropagation();
      }
      if (!state.isDrawing) return;

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      endPress();
      maybeReveal();
    }

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("lostpointercapture", endPress);

    function disableScratch() {
      state.enabled = false;
      endPress();
    }

    function fitNumberSize() {
      const text = revealNumber.textContent;
      if (!text) return;

      const local = getLocalSize();
      const maxWidth = local * 0.68;
      let size = Math.floor(local * 0.46);
      revealNumber.style.fontSize = `${size}px`;

      while (revealNumber.scrollWidth > maxWidth && size > 8) {
        size -= 1;
        revealNumber.style.fontSize = `${size}px`;
      }
    }

    function setNumber(number) {
      revealNumber.textContent = number == null ? "" : String(number);
      requestAnimationFrame(() => {
        fitNumberSize();
      });
    }

    async function sealWithResidue(number) {
      setNumber(number);
      if (!state.coated) {
        await resize();
      }
      if (measureClearedRatio() <= 0) {
        applyDefaultResidue();
      }

      state.sealed = true;
      state.sealedNumber = number;
      state.prizeTriggered = true;
      state.enabled = false;
      canvas.style.opacity = "1";
      canvas.style.pointerEvents = "none";
      state.sealedSnapshot = captureSnapshot();
    }

    function exportScratchState() {
      if (!state.coated || !canvas.width) return null;
      if (state.sealed) {
        return state.sealedSnapshot || captureSnapshot();
      }
      if (measureClearedRatio() < MIN_USER_CLEAR_RATIO) return null;
      return captureSnapshot();
    }

    async function importSealedState(snapshot, number) {
      setNumber(number);
      state.sealed = true;
      state.sealedNumber = number;
      state.prizeTriggered = true;
      state.enabled = false;
      canvas.style.opacity = "1";
      canvas.style.pointerEvents = "none";

      if (!state.coated) {
        await drawCoating();
        state.coated = true;
        updateCircleMetrics();
      }

      if (snapshot) {
        await importScratchState(snapshot);
      } else {
        applyDefaultResidue();
      }

      state.sealedSnapshot = captureSnapshot();
    }

    async function importScratchState(snapshot) {
      if (!snapshot) return;
      if (!state.coated) {
        await drawCoating();
        state.coated = true;
        updateCircleMetrics();
      }
      if (snapshot.width === canvas.width && snapshot.height === canvas.height) {
        ctx.putImageData(snapshot.imageData, 0, 0);
      } else {
        const tmp = document.createElement("canvas");
        tmp.width = snapshot.width;
        tmp.height = snapshot.height;
        tmp.getContext("2d").putImageData(snapshot.imageData, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
      }
    }

    return {
      element: card,
      resize,
      setNumber,
      sealWithResidue,
      exportScratchState,
      importScratchState,
      importSealedState,
      isSealed: () => state.sealed,
      isPrizeTriggered: () => state.prizeTriggered,
      hasAnyClearing,
      hasUserEngaged,
      async enable() {
        if (state.sealed) return;
        state.enabled = true;
        await resize();
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
      },
      disable: disableScratch,
      detach() {
        disableScratch();
        if (card.parentElement) {
          card.parentElement.removeChild(card);
        }
      },
      destroy() {
        disableScratch();
        if (card.parentElement) {
          card.parentElement.removeChild(card);
        }
      },
    };
  }

  function hasMeaningfulClearing(snapshot) {
    if (!snapshot || !snapshot.imageData) return false;
    return (
      measureClearingFromSnapshot(snapshot.imageData, snapshot.width, snapshot.height) >=
      MIN_USER_CLEAR_RATIO
    );
  }

  function measureClearingFromSnapshot(imageData, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) / 2;
    const sampleStep = Math.max(2, Math.floor(r / 24));
    const data = imageData.data;
    let total = 0;
    let clear = 0;

    for (let y = cy - r; y <= cy + r; y += sampleStep) {
      for (let x = cx - r; x <= cx + r; x += sampleStep) {
        if (Math.hypot(x - cx, y - cy) > r) continue;
        total += 1;
        const px = Math.max(0, Math.min(width - 1, Math.floor(x)));
        const py = Math.max(0, Math.min(height - 1, Math.floor(y)));
        const alpha = data[(py * width + px) * 4 + 3];
        if (alpha < 24) clear += 1;
      }
    }

    return total === 0 ? 0 : clear / total;
  }

  window.ScratchCard = {
    create: createScratchCard,
    hasMeaningfulClearing,
    MIN_USER_CLEAR_RATIO,
  };
})();
