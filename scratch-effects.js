(function () {
  "use strict";

  function createScratchAudio() {
    let ctx = null;
    let noiseSource = null;
    let filter = null;
    let gritFilter = null;
    let gain = null;
    let gritGain = null;
    let lastGrit = 0;

    function ensureContext() {
      if (ctx) return ctx;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;

      ctx = new AudioContext();

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.96 + white * 0.04;
        data[i] = last * 2.5;
      }

      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 500;

      filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1600;
      filter.Q.value = 1.2;

      gain = ctx.createGain();
      gain.gain.value = 0;

      noiseSource.connect(highpass);
      highpass.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noiseSource.start();

      gritFilter = ctx.createBiquadFilter();
      gritFilter.type = "bandpass";
      gritFilter.frequency.value = 3200;
      gritFilter.Q.value = 2.5;

      gritGain = ctx.createGain();
      gritGain.gain.value = 0;
      gritFilter.connect(gritGain);
      gritGain.connect(ctx.destination);

      return ctx;
    }

    async function resume() {
      const context = ensureContext();
      if (context && context.state === "suspended") {
        await context.resume();
      }
    }

    function playGrit(velocity) {
      if (!ctx || velocity < 2) return;
      const now = ctx.currentTime;
      if (now - lastGrit < 0.04) return;
      lastGrit = now;

      const burstLength = Math.floor(ctx.sampleRate * 0.018);
      const burst = ctx.createBuffer(1, burstLength, ctx.sampleRate);
      const samples = burst.getChannelData(0);
      for (let i = 0; i < burstLength; i++) {
        const env = 1 - i / burstLength;
        samples[i] = (Math.random() * 2 - 1) * env * env;
      }

      const source = ctx.createBufferSource();
      source.buffer = burst;

      const localFilter = gritFilter;
      const localGain = gritGain;
      source.connect(localFilter);
      localFilter.connect(localGain);

      const peak = Math.min(0.22, 0.06 + velocity * 0.012);
      localGain.gain.setValueAtTime(peak, now);
      localGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      localFilter.frequency.setValueAtTime(1800 + velocity * 120, now);

      source.start(now);
      source.stop(now + 0.025);
    }

    return {
      async start() {
        await resume();
        if (gain && ctx) {
          gain.gain.setTargetAtTime(0.08, ctx.currentTime, 0.02);
        }
      },

      update(velocity) {
        if (!gain || !filter || !ctx) return;
        const speed = Math.min(velocity / 10, 1);
        const volume = 0.06 + speed * 0.28;
        const frequency = 900 + speed * 2800;

        gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.015);
        filter.frequency.setTargetAtTime(frequency, ctx.currentTime, 0.02);
        filter.Q.setTargetAtTime(0.8 + speed * 1.4, ctx.currentTime, 0.03);

        if (speed > 0.25 && Math.random() < 0.35) {
          playGrit(velocity);
        }
      },

      stop() {
        if (!gain || !ctx) return;
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
      },
    };
  }

  function createParticleSystem(canvas) {
    const ctx = canvas.getContext("2d");
    const particles = [];
    let rafId = null;
    const colors = ["#d4d4d4", "#b8b8b8", "#a3a3a3", "#8f8f8f", "#c9c9c9"];

    function resize(displayWidth, displayHeight) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(x, y, vx, vy, intensity) {
      const count = Math.min(6, 2 + Math.floor(intensity / 3));
      const speed = Math.hypot(vx, vy) || 1;
      const nx = -vy / speed;
      const ny = vx / speed;

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 2.2;
        const push = 1.5 + Math.random() * 3.5;
        particles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: vx * 0.15 + nx * spread * push + (Math.random() - 0.5) * 2,
          vy: vy * 0.15 + ny * spread * push - Math.random() * 2.5,
          w: 1.5 + Math.random() * 3.5,
          h: 0.8 + Math.random() * 2,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.35,
          life: 1,
          decay: 0.018 + Math.random() * 0.028,
          gravity: 0.12 + Math.random() * 0.08,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      startLoop();
    }

    function drawFlake(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);

      if (p.w > 2.5) {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(-p.w / 4, -p.h / 2, p.w / 3, p.h);
      }
      ctx.restore();
    }

    function tick() {
      const { width, height } = canvas;
      const dpr = window.devicePixelRatio || 1;
      const displayW = width / dpr;
      const displayH = height / dpr;

      ctx.clearRect(0, 0, displayW, displayH);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.96;
        p.vy *= 0.98;
        p.rotation += p.spin;
        p.life -= p.decay;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        drawFlake(p);
      }

      if (particles.length > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    }

    function startLoop() {
      if (!rafId) {
        rafId = requestAnimationFrame(tick);
      }
    }

    function clear() {
      particles.length = 0;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }

    return { resize, spawn, clear };
  }

  function createScratchHaptics() {
    const enabled = typeof navigator !== "undefined" && "vibrate" in navigator;
    let lastPulse = 0;

    return {
      enabled,

      tick(velocity) {
        if (!enabled || velocity < 0.8) return;

        const now = performance.now();
        const interval = Math.max(18, 55 - velocity * 3);
        if (now - lastPulse < interval) return;
        lastPulse = now;

        const duration = Math.min(14, Math.round(5 + velocity * 0.6));
        navigator.vibrate(duration);
      },

      stop() {
        if (enabled) {
          navigator.vibrate(0);
        }
      },
    };
  }

  function celebrate(container, level) {
    if (!container) return;
    const layer = document.createElement("div");
    layer.className = "celebrate-layer";
    container.appendChild(layer);

    const count = level >= 2 ? 48 : level >= 1 ? 28 : 12;
    const colors =
      level >= 2
        ? ["#facc15", "#ffffff", "#fb7185", "#38bdf8", "#a3e635"]
        : level >= 1
          ? ["#ffffff", "#d4d4d4", "#facc15"]
          : ["#ffffff", "#d4d4d4"];

    for (let i = 0; i < count; i++) {
      const piece = document.createElement("span");
      piece.className = "celebrate-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.2}s`;
      piece.style.animationDuration = `${0.8 + Math.random() * 0.8}s`;
      piece.style.width = `${4 + Math.random() * 6}px`;
      piece.style.height = `${8 + Math.random() * 10}px`;
      layer.appendChild(piece);
    }

    if (level >= 2) {
      layer.classList.add("is-grand");
    }

    setTimeout(() => {
      if (layer.parentElement) {
        layer.parentElement.removeChild(layer);
      }
    }, 1800);
  }

  function prizeLevel(prize) {
    if (!prize) return 0;
    if (prize.isLastOne) return 2;
    return 0;
  }

  window.ScratchEffects = {
    createScratchAudio,
    createParticleSystem,
    createScratchHaptics,
    celebrate,
    prizeLevel,
  };
})();
