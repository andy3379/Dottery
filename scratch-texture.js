(function () {
  "use strict";

  const PRESETS = {
    silver: {
      stops: ["#bfbfbf", "#a3a3a3", "#8a8a8a"],
      speckLight: "rgba(255,255,255,",
      speckDark: "rgba(55,55,55,",
    },
    gold: {
      stops: ["#e8c872", "#d4a84b", "#b8860b"],
      speckLight: "rgba(255,248,220,",
      speckDark: "rgba(90,60,10,",
    },
    color: {
      stops: ["#c4b5fd", "#a78bfa", "#8b5cf6"],
      speckLight: "rgba(255,255,255,",
      speckDark: "rgba(60,30,90,",
    },
  };
  const MAX_RENDER_DPR = 2;
  const MAX_PREVIEW_PX = 512;
  const PREVIEW_BUCKET_PX = 64;
  const PRESET_CACHE_LIMIT = 8;
  const presetCache = new Map();

  function clamp(value) {
    return Math.max(0, Math.min(255, value));
  }

  function isInsideCircle(x, y, cx, cy, r) {
    return Math.hypot(x - cx, y - cy) <= r;
  }

  function resolveOptions(options) {
    if (!options || typeof options === "string") {
      return {
        preset: options || "silver",
        imageUrl: "",
      };
    }
    return {
      preset: options.preset || "silver",
      imageUrl: options.imageUrl || "",
    };
  }

  function paintPreset(ctx, width, height, presetKey) {
    const preset = PRESETS[presetKey] || PRESETS.silver;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, preset.stops[0]);
    base.addColorStop(0.48, preset.stops[1]);
    base.addColorStop(1, preset.stops[2]);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 42;
      data[i] = clamp(data[i] + noise);
      data[i + 1] = clamp(data[i + 1] + noise);
      data[i + 2] = clamp(data[i + 2] + noise);
    }
    ctx.putImageData(imageData, 0, 0);

    const speckCount = Math.max(400, Math.floor((width * height) / 70));
    for (let i = 0; i < speckCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      if (!isInsideCircle(x, y, cx, cy, r)) continue;

      const roll = Math.random();
      if (roll > 0.68) {
        const size = Math.random() * 1.8 + 0.35;
        ctx.fillStyle = `${preset.speckLight}${0.3 + Math.random() * 0.5})`;
        ctx.fillRect(x, y, size, size);
      } else if (roll < 0.18) {
        const size = Math.random() * 1.2 + 0.25;
        ctx.fillStyle = `${preset.speckDark}${0.12 + Math.random() * 0.22})`;
        ctx.fillRect(x, y, size, size);
      }
    }

    const shine = ctx.createRadialGradient(cx * 0.68, cy * 0.52, 0, cx, cy, r);
    shine.addColorStop(0, "rgba(255,255,255,0.2)");
    shine.addColorStop(0.55, "rgba(255,255,255,0.04)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }

  function getPresetTexture(width, height, presetKey) {
    const key = `${presetKey}:${width}x${height}`;
    const cached = presetCache.get(key);
    if (cached) {
      presetCache.delete(key);
      presetCache.set(key, cached);
      return cached;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    paintPreset(canvas.getContext("2d", { willReadFrequently: true }), width, height, presetKey);
    presetCache.set(key, canvas);

    if (presetCache.size > PRESET_CACHE_LIMIT) {
      presetCache.delete(presetCache.keys().next().value);
    }
    return canvas;
  }

  function paintCachedPreset(ctx, width, height, presetKey) {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(getPresetTexture(width, height, presetKey), 0, 0);
  }

  function getRenderDpr() {
    return Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR);
  }

  function getPreviewPixelSize(visualCssSize) {
    const raw = Math.max(1, Math.ceil((visualCssSize * getRenderDpr()) / PREVIEW_BUCKET_PX) * PREVIEW_BUCKET_PX);
    return Math.min(MAX_PREVIEW_PX, raw);
  }

  function paintImage(ctx, width, height, image) {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const scale = Math.max(width / image.width, height / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);

    ctx.restore();
  }

  const imageCache = new Map();

  function loadImage(url) {
    if (!url) return Promise.resolve(null);
    if (imageCache.has(url)) return imageCache.get(url);
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imageCache.set(url, promise);
    return promise;
  }

  async function paint(ctx, width, height, options) {
    const opts = resolveOptions(options);
    if (opts.imageUrl) {
      const image = await loadImage(opts.imageUrl);
      if (image) {
        paintImage(ctx, width, height, image);
        return;
      }
    }
    paintCachedPreset(ctx, width, height, opts.preset);
  }

  function paintSync(ctx, width, height, options) {
    const opts = resolveOptions(options);
    paintCachedPreset(ctx, width, height, opts.preset);
  }

  function createPreviewCanvas(visualCssSize, options, display) {
    const localSize = (display && display.localSize) || visualCssSize;
    const visual = Math.max(localSize, visualCssSize);
    const canvas = document.createElement("canvas");
    const px = getPreviewPixelSize(visual);
    canvas.width = px;
    canvas.height = px;
    canvas.style.width = `${visual}px`;
    canvas.style.height = `${visual}px`;
    canvas.style.transformOrigin = "0 0";
    canvas.style.transform = `scale(${localSize / visual})`;
    canvas.style.display = "block";
    canvas.style.borderRadius = "50%";
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const opts = resolveOptions(options);
    canvas.dataset.foilPreset = opts.preset;
    canvas.dataset.foilImage = opts.imageUrl || "";
    canvas.dataset.localSize = String(localSize);

    if (opts.imageUrl) {
      paintSync(ctx, px, px, opts);
      paint(ctx, px, px, opts);
    } else {
      paintSync(ctx, px, px, opts);
    }
    return canvas;
  }

  function resizePreviewCanvas(canvas, visualCssSize, display) {
    const localSize =
      (display && display.localSize) ||
      Number(canvas.dataset.localSize) ||
      visualCssSize;
    const visual = Math.max(localSize, visualCssSize);
    const px = getPreviewPixelSize(visual);
    canvas.style.width = `${visual}px`;
    canvas.style.height = `${visual}px`;
    canvas.style.transformOrigin = "0 0";
    canvas.style.transform = `scale(${localSize / visual})`;
    if (canvas.width === px && canvas.height === px) return;
    canvas.width = px;
    canvas.height = px;
    const opts = {
      preset: canvas.dataset.foilPreset || "silver",
      imageUrl: canvas.dataset.foilImage || "",
    };
    if (opts.imageUrl) {
      paintSync(canvas.getContext("2d"), px, px, opts);
      paint(canvas.getContext("2d"), px, px, opts);
    } else {
      paintSync(canvas.getContext("2d"), px, px, opts);
    }
  }

  window.ScratchTexture = {
    paint,
    paintSync,
    createPreviewCanvas,
    resizePreviewCanvas,
    loadImage,
    PRESETS,
  };
})();
