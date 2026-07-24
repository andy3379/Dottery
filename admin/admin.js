(function () {
  "use strict";

  const app = document.getElementById("app");
  const PAGE_SIZE = 8;
  const THEMES = [
    { value: "light", label: "Light" },
    { value: "warm", label: "Warm" },
    { value: "cool", label: "Cool" },
    { value: "dark", label: "Dark" },
    { value: "rose", label: "Rose" },
  ];
  const FOILS = [
    { value: "silver", label: "Silver" },
    { value: "gold", label: "Gold" },
    { value: "color", label: "Color" },
  ];

  const ICONS = {
    box:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3.3 7.7L12 12.5l8.7-4.8M12 22V12.5"/></svg>',
    logout:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    plus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    back:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    upload:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
    image:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    chevL:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
    chevR:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>',
    grid:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    gear:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    user:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>',
    edit:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
    eye:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    publish:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h11M5 20V8h9v12"/><path d="M5 12h9M5 16h9"/><path d="M19 17V7M16.5 9.5L19 7l2.5 2.5"/></svg>',
    unpublish:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h11M5 20V8h9v12"/><path d="M5 12h9M5 16h9"/><path d="M19 7v10M16.5 14.5L19 17l2.5-2.5"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  };

  const state = {
    authed: false,
    view: "dashboard",
    listPage: 1,
    products: [],
    product: null,
    dashboard: null,
    dashboardPeriodMode: "7",
    dashboardDateFrom: "",
    dashboardDateTo: "",
    settings: null,
    error: "",
    notice: "",
    saving: false,
    productCleanFingerprint: "",
  };

  let noticeTimer = null;

  function showNotice(message) {
    state.notice = String(message || "").trim();
    if (noticeTimer) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }
    if (!state.notice) return;
    noticeTimer = setTimeout(() => {
      if (state.notice === message) {
        state.notice = "";
        const toast = document.getElementById("admin-toast");
        if (toast) toast.remove();
      }
      noticeTimer = null;
    }, 2800);
    mountToast();
  }

  function mountToast() {
    let toast = document.getElementById("admin-toast");
    if (!state.notice) {
      if (toast) toast.remove();
      return;
    }
    if (!toast) {
      toast = el("div", { id: "admin-toast", className: "admin-toast" });
      document.body.appendChild(toast);
    }
    toast.textContent = state.notice;
    toast.classList.remove("is-show");
    void toast.offsetWidth;
    toast.classList.add("is-show");
  }

  function productSaveFingerprint(product) {
    if (!product) return "";
    const prizes = (product.prizes || [])
      .filter((p) => !p.isLastOne)
      .map((p, index) => ({
        id: p.id || "",
        grade: String(p.grade || ""),
        name: String(p.name || ""),
        image: String(p.image || ""),
        quantity: Number(p.quantity) || 0,
        cost: Number(p.cost) || 0,
        sortOrder: index,
      }));
    const lastOneEnabled = Boolean(product.lastOneEnabled);
    const lastOne =
      lastOneEnabled && product.lastOne
        ? {
            id: product.lastOne.id || "",
            grade: String(product.lastOne.grade || ""),
            name: String(product.lastOne.name || ""),
            image: String(product.lastOne.image || ""),
            cost: Number(product.lastOne.cost) || 0,
          }
        : null;
    const prizeNumberSpecs =
      (product.drawMode || "shuffle") === "manual"
        ? Object.fromEntries(
            prizes.map((prize) => [
              prize.id,
              String((product.prizeNumberSpecs && product.prizeNumberSpecs[prize.id]) || ""),
            ])
          )
        : {};
    return JSON.stringify({
      name: String(product.name || ""),
      description: String(product.description || ""),
      coverImage: String(product.coverImage || ""),
      detailImage: String(product.detailImage || ""),
      price: Number(product.price) || 0,
      totalDraws: Number(product.totalDraws) || 0,
      theme: String(product.theme || "light"),
      foilPreset: String(product.foilPreset || "silver"),
      foilImage: String(product.foilImage || ""),
      showRemaining: Boolean(product.showRemaining),
      scheduleEnabled: Boolean(product.scheduleEnabled),
      scheduleStart: product.scheduleStart || null,
      scheduleEnd: product.scheduleEnd || null,
      drawMode: product.drawMode || "shuffle",
      soldoutVisibility: product.soldoutVisibility || "show_soldout",
      lastOneEnabled,
      prizes,
      lastOne,
      prizeNumberSpecs,
    });
  }

  function markProductClean() {
    state.productCleanFingerprint = productSaveFingerprint(state.product);
    syncSaveButton();
  }

  function isProductDirty() {
    if (!state.product) return false;
    return productSaveFingerprint(state.product) !== state.productCleanFingerprint;
  }

  function syncSaveButton() {
    const btn = document.getElementById("product-save-btn");
    if (!btn) return;
    btn.disabled = Boolean(state.saving) || !isProductDirty();
  }

  function notifyProductEdited() {
    syncSaveButton();
  }

  async function api(path, options = {}) {
    const opts = {
      credentials: "same-origin",
      headers: {},
      ...options,
    };
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(`/api/admin${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "請求失敗");
    }
    return data;
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === false || value == null) {
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, String(value));
      }
    });
    (Array.isArray(children) ? children : [children]).forEach((child) => {
      if (child == null || child === false) return;
      if (typeof child === "string" || typeof child === "number") {
        node.appendChild(document.createTextNode(String(child)));
      } else {
        node.appendChild(child);
      }
    });
    return node;
  }

  function icon(name) {
    return el("span", { className: "icon", html: ICONS[name] || "" });
  }

  function statusBadge(status) {
    const map = {
      draft: "草稿",
      published: "上架",
      unpublished: "下架",
    };
    return el("span", {
      className: `badge badge--${status}`,
      text: map[status] || status,
    });
  }

  function linkAction(label, className, onClick, options) {
    const disabled = Boolean(options && options.disabled);
    const iconName = options && options.icon;
    const attrs = {
      type: "button",
      className: `link-action${iconName ? " link-action--icon" : ""}${className ? ` ${className}` : ""}${disabled ? " is-disabled" : ""}`,
      disabled,
      onClick: disabled ? undefined : onClick,
    };
    if (iconName) attrs["aria-label"] = label;
    return el("button", attrs, iconName ? icon(iconName) : label);
  }

  function openProductPreview(product) {
    if (!product || !product.id) return;
    const existing = document.getElementById("product-preview-overlay");
    if (existing) existing.remove();

    const frame = el("iframe", {
      className: "product-preview__frame",
      src: `/board?product=${encodeURIComponent(product.id)}&preview=1`,
      title: product.name || product.id,
    });

    const overlay = el("div", {
      className: "product-preview-overlay",
      id: "product-preview-overlay",
    }, [
      el("div", { className: "product-preview", role: "dialog", "aria-modal": "true" }, [
        el(
          "button",
          {
            type: "button",
            className: "product-preview__close",
            "aria-label": "關閉",
            onClick: () => overlay.remove(),
          },
          icon("close")
        ),
        frame,
      ]),
    ]);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });

    function onKey(event) {
      if (event.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
      }
    }
    document.addEventListener("keydown", onKey);

    document.body.appendChild(overlay);
  }

  function field(label, control) {
    return el("label", { className: "field" }, [
      el("span", { className: "field__label", text: label }),
      control,
    ]);
  }

  async function uploadFile(file) {
    const form = new FormData();
    form.append("file", file);
    const data = await api("/upload", { method: "POST", body: form });
    return data.url;
  }

  function coverPicker(currentUrl, onChange, disabled) {
    const wrap = el("div", { className: "upload-dropzone upload-dropzone--lg" });
    const img = el("img", {
      className: "upload-dropzone__preview",
      src: currentUrl || "",
      alt: "",
    });
    if (!currentUrl) img.style.display = "none";
    wrap.appendChild(img);

    if (!disabled) {
      const input = el("input", { type: "file", accept: "image/*" });
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const url = await uploadFile(file);
          img.src = url;
          img.style.display = "";
          const iconEl = wrap.querySelector(".upload-dropzone__icon");
          if (iconEl) iconEl.remove();
          if (!img.parentElement) wrap.appendChild(img);
          if (!disabled && !wrap.querySelector(".upload-dropzone__clear")) {
            wrap.appendChild(
              el(
                "button",
                {
                  type: "button",
                  className: "chip upload-dropzone__clear",
                  onClick: (e) => {
                    e.stopPropagation();
                    img.removeAttribute("src");
                    img.style.display = "none";
                    onChange("");
                    notifyProductEdited();
                    render();
                  },
                },
                "×"
              )
            );
          }
          onChange(url);
          notifyProductEdited();
          render();
        } catch (error) {
          state.error = error.message;
          render();
        }
      });
      wrap.appendChild(input);
    }

    if (!currentUrl && !disabled) {
      wrap.appendChild(el("span", { className: "upload-dropzone__icon", html: ICONS.upload }));
    }

    if (currentUrl && !disabled) {
      wrap.appendChild(
        el(
          "button",
          {
            type: "button",
            className: "chip upload-dropzone__clear",
            onClick: (e) => {
              e.stopPropagation();
              img.removeAttribute("src");
              img.style.display = "none";
              onChange("");
              notifyProductEdited();
              render();
            },
          },
            "×"
        )
      );
    }

    return wrap;
  }

  function imagePicker(currentUrl, onChange, disabled) {
    const wrap = el("div", { className: "upload-zone" });
    const img = el("img", {
      className: "upload-zone__preview",
      src: currentUrl || "",
      alt: "",
    });

    if (currentUrl) {
      wrap.append(img);
    } else {
      wrap.append(el("div", { className: "upload-zone__empty" }, icon("image")));
    }

    if (!disabled) {
      const input = el("input", { type: "file", accept: "image/*" });
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const url = await uploadFile(file);
          img.src = url;
          const empty = wrap.querySelector(".upload-zone__empty");
          if (empty) empty.remove();
          if (!img.parentElement) wrap.append(img);
          onChange(url);
          notifyProductEdited();
        } catch (error) {
          state.error = error.message;
          render();
        }
      });
      wrap.append(input);
    }

    return wrap;
  }

  function tempId() {
    return `tmp_${Math.random().toString(36).slice(2, 10)}`;
  }

  function blankPrize() {
    return { id: tempId(), grade: "", name: "", image: "", quantity: 1, cost: 0 };
  }

  function blankLastOne() {
    return {
      id: tempId(),
      grade: "",
      name: "",
      image: "",
      quantity: 1,
      cost: 0,
      isLastOne: true,
    };
  }

  function confirmAction(options) {
    return new Promise((resolve) => {
      const target = options.target != null ? String(options.target) : "";
      const action = options.action != null ? String(options.action) : "";
      const title =
        target && action
          ? `確認對"${target}"執行${action}？`
          : options.title || "";
      const overlay = el("div", { className: "confirm-overlay" }, [
        el("div", { className: "confirm-dialog", role: "dialog", "aria-modal": "true" }, [
          el("div", { className: "confirm-dialog__title", text: title }),
          !target && options.message
            ? el("div", { className: "confirm-dialog__message", text: options.message })
            : null,
          el("div", { className: "confirm-dialog__actions" }, [
            el(
              "button",
              {
                type: "button",
                className: "btn btn--ghost",
                onClick: () => {
                  overlay.remove();
                  resolve(false);
                },
              },
              options.cancelLabel || "取消"
            ),
            el(
              "button",
              {
                type: "button",
                className: `btn${options.danger ? " btn--danger" : ""}`,
                onClick: () => {
                  overlay.remove();
                  resolve(true);
                },
              },
              options.confirmLabel || action || "確認"
            ),
          ]),
        ]),
      ]);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });
      document.body.appendChild(overlay);
      const confirmBtn = overlay.querySelector(".confirm-dialog__actions .btn:not(.btn--ghost)");
      if (confirmBtn) confirmBtn.focus();
    });
  }

  function manualBoardError(product) {
    if ((product.drawMode || "shuffle") !== "manual") return null;
    const prizes = (product.prizes || []).filter((p) => !p.isLastOne);
    const total = Number(product.totalDraws) || 0;
    const qtySum = prizes.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    if (qtySum !== total) {
      return `獎項數量加總（${qtySum}）需等於總抽數（${total}）`;
    }
    if (typeof PrizeNumberSpec === "undefined") {
      return "盤面模組未載入";
    }
    const specs = ensurePrizeNumberSpecs(product);
    const built = PrizeNumberSpec.buildSlotDrafts(prizes, specs, total);
    return built.error || null;
  }

  function toLocalDateTimeValue(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function fromLocalDateTimeValue(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  function ensurePrizeNumberSpecs(product) {
    const prizes = (product.prizes || []).filter((p) => !p.isLastOne);
    const totalDraws = Math.max(0, Number(product.totalDraws) || 0);
    if (!product.prizeNumberSpecs) product.prizeNumberSpecs = {};

    const hasSpecInput = Object.values(product.prizeNumberSpecs).some((value) =>
      String(value || "").trim()
    );

    if ((product.slotDrafts || []).length && !hasSpecInput) {
      product.prizeNumberSpecs = PrizeNumberSpec.specsFromSlotDrafts(
        product.slotDrafts,
        prizes
      );
    }

    if (product.drawMode === "manual" && !hasSpecInput && !(product.slotDrafts || []).length) {
      product.prizeNumberSpecs = PrizeNumberSpec.defaultSpecsFromQuantities(prizes, totalDraws);
    }

    prizes.forEach((prize) => {
      if (product.prizeNumberSpecs[prize.id] == null) {
        product.prizeNumberSpecs[prize.id] = "";
      }
    });
    return product.prizeNumberSpecs;
  }

  function prizeLabel(prize) {
    if (prize.grade && prize.name) return `${prize.grade} ${prize.name}`;
    return prize.grade || prize.name || prize.id || "";
  }

  function renderPrizeSpecRows(product, locked) {
    const prizes = (product.prizes || []).filter((p) => !p.isLastOne);
    const totalDraws = Number(product.totalDraws) || 0;
    ensurePrizeNumberSpecs(product);

    if (locked) {
      const drafts = (product.slots || []).map((slot) => ({
        prizeId: slot.prize?.id,
        number: slot.number,
      }));
      const specs =
        drafts.length > 0
          ? PrizeNumberSpec.specsFromSlotDrafts(drafts, prizes)
          : product.prizeNumberSpecs;
      return el(
        "div",
        { className: "prize-spec-list prize-spec-list--readonly" },
        prizes.map((prize) =>
          el("div", { className: "prize-spec-row" }, [
            el("span", { className: "prize-spec__label", text: prizeLabel(prize) }),
            el("span", { className: "prize-spec__value", text: specs[prize.id] || "—" }),
          ])
        )
      );
    }

    return el(
      "div",
      { className: "prize-spec-list" },
      prizes.map((prize) => {
        const qty = Math.max(0, Number(prize.quantity) || 0);
        const countEl = el("span", { className: "prize-spec__count" });
        const input = el("input", { type: "text", className: "prize-spec__input" });
        input.value = product.prizeNumberSpecs[prize.id] || "";

        function syncCount() {
          const parsed = PrizeNumberSpec.parse(input.value, totalDraws);
          const count = parsed.error ? "!" : parsed.numbers.length;
          countEl.textContent = `${count}/${qty}`;
          countEl.className = `prize-spec__count${
            !parsed.error && count === qty ? " is-ok" : ""
          }`;
        }

        input.addEventListener("input", () => {
          product.prizeNumberSpecs[prize.id] = input.value;
          syncCount();
          notifyProductEdited();
        });
        syncCount();

        return el("div", { className: "prize-spec-row" }, [
          el("span", { className: "prize-spec__label", text: prizeLabel(prize) }),
          input,
          countEl,
        ]);
      })
    );
  }

  function movePrize(product, index, delta) {
    const next = index + delta;
    if (next < 0 || next >= product.prizes.length) return;
    const item = product.prizes.splice(index, 1)[0];
    product.prizes.splice(next, 0, item);
    product.prizes.forEach((prize, i) => {
      prize.sortOrder = i;
    });
    render();
  }

  function syncLastOneEnabled(product) {
    if (!product.lastOne) product.lastOne = blankLastOne();
    if (product.lastOneEnabled == null) {
      product.lastOneEnabled = Boolean(
        product.lastOne.id || product.lastOne.name || product.lastOne.image
      );
    }
    return product;
  }

  function formatMoney(value) {
    return `NT$ ${(Number(value) || 0).toLocaleString()}`;
  }

  function formatRate(value) {
    return `${((Number(value) || 0) * 100).toFixed(1)}%`;
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function periodRangeLabel(mode, period) {
    if (mode === "7") return "最近 7 日";
    if (mode === "30") return "最近 30 日";
    if (period && period.from && period.to) return `${period.from} — ${period.to}`;
    if (state.dashboardDateFrom && state.dashboardDateTo) {
      return `${state.dashboardDateFrom} — ${state.dashboardDateTo}`;
    }
    return "自選區間";
  }

  function buildRing(pct) {
    const value = Math.min(100, Math.max(0, Number(pct) || 0));
    return el("div", { className: "dash-ring" }, [
      el("div", {
        className: "dash-ring__chart",
        style: `background: conic-gradient(#171717 ${value * 3.6}deg, #e5e5e5 0)`,
      }),
      el("div", { className: "dash-ring__inner" }, [
        el("div", { className: "dash-ring__value", text: `${Math.round(value)}%` }),
      ]),
    ]);
  }

  function buildHBar(segments) {
    const total = segments.reduce((sum, seg) => sum + (Number(seg.value) || 0), 0);
    if (total <= 0) {
      return el("div", { className: "dash-hbar dash-hbar--empty" });
    }
    return el(
      "div",
      { className: "dash-hbar" },
      segments
        .filter((seg) => Number(seg.value) > 0)
        .map((seg) =>
          el("div", {
            className: `dash-hbar__seg ${seg.className || ""}`,
            style: `width:${(Number(seg.value) / total) * 100}%`,
          })
        )
    );
  }

  function buildMetricCard(label, value, detail, visual) {
    return el("div", { className: "dash-metric" }, [
      el("div", { className: "dash-metric__label", text: label }),
      el("div", { className: "dash-metric__value", text: value }),
      detail ? el("div", { className: "dash-metric__detail", text: detail }) : null,
      visual || null,
    ]);
  }

  function alertTypeLabel(type) {
    if (type === "slow") return "滯銷";
    if (type === "lowStock") return "庫存";
    return "";
  }

  function computeEconomics(product) {
    return DotteryEconomics.computeEconomics(product);
  }

  function profitValueClass(value) {
    const amount = Number(value) || 0;
    if (amount > 0) return " economics-summary__value--profit";
    if (amount < 0) return " economics-summary__value--loss";
    return "";
  }

  function renderEconomicsPanel(econ) {
    const stop = econ.stopModel || {};
    return el(
      "div",
      {
        className: `economics-panel${econ.isLoss ? " economics-panel--loss" : ""}`,
        id: "economics-panel",
      },
      [
        stop.invalidMajorCount
          ? el("div", {
              className: "economics-warning",
              id: "econ-major-warning",
              text: "大獎份數不能超過總張數",
            })
          : el("div", {
              className: "economics-warning is-hidden",
              id: "econ-major-warning",
            }),
        el("div", { className: "economics-summary" }, [
          el("div", { className: "economics-summary__row" }, [
            el("span", {
              className: "economics-summary__label",
              text: "長期期望利潤（理論值）",
            }),
            el("span", {
              className: `economics-summary__value${profitValueClass(econ.expectedProfit)}`,
              id: "econ-expected-profit",
              text: formatMoney(econ.expectedProfit),
            }),
          ]),
          el("div", { className: "economics-summary__row" }, [
            el("span", { className: "economics-summary__label", text: "期望利潤率" }),
            el("span", {
              className: `economics-summary__value${profitValueClass(econ.expectedProfit)}`,
              id: "econ-expected-profit-rate",
              text: formatRate(econ.expectedProfitRate),
            }),
          ]),
        ]),
      ]
    );
  }

  function refreshProductEconomics(product) {
    if (!product) return;
    const next = computeEconomics(product);
    const panel = document.getElementById("economics-panel");
    const profitEl = document.getElementById("econ-expected-profit");
    const rateEl = document.getElementById("econ-expected-profit-rate");
    const warningEl = document.getElementById("econ-major-warning");
    if (!panel || !profitEl || !rateEl) return;
    panel.className = `economics-panel${next.isLoss ? " economics-panel--loss" : ""}`;
    profitEl.textContent = formatMoney(next.expectedProfit);
    profitEl.className = `economics-summary__value${profitValueClass(next.expectedProfit)}`;
    rateEl.textContent = formatRate(next.expectedProfitRate);
    rateEl.className = `economics-summary__value${profitValueClass(next.expectedProfit)}`;
    if (warningEl) {
      const invalid = Boolean(next.stopModel && next.stopModel.invalidMajorCount);
      warningEl.textContent = invalid ? "大獎份數不能超過總張數" : "";
      warningEl.className = `economics-warning${invalid ? "" : " is-hidden"}`;
    }
  }

  function regularPrizeTotal(product) {
    return (product.prizes || [])
      .filter((p) => !p.isLastOne)
      .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  }

  function showPreview(product) {
    return Boolean(product && product.id && product.status !== "draft");
  }

  function formatTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function countTopPrizesRemaining(remaining) {
    if (!remaining || !remaining.length) return { left: 0, total: 0 };
    const top = remaining.slice(0, 2);
    if (!top.length) {
      const all = remaining.reduce(
        (acc, item) => {
          acc.left += Number(item.remaining) || 0;
          acc.total += Number(item.quantity) || 0;
          return acc;
        },
        { left: 0, total: 0 }
      );
      return all;
    }
    return top.reduce(
      (acc, item) => {
        acc.left += Number(item.remaining) || 0;
        acc.total += Number(item.quantity) || 0;
        return acc;
      },
      { left: 0, total: 0 }
    );
  }

  async function checkAuth() {
    const data = await api("/me");
    state.authed = data.authenticated;
  }

  async function loadProducts() {
    const data = await api("/products");
    state.products = data.products;
    const totalPages = Math.max(1, Math.ceil(state.products.length / PAGE_SIZE));
    if (state.listPage > totalPages) state.listPage = totalPages;
  }

  function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function defaultDashboardDateRange() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { from: formatDateInput(from), to: formatDateInput(to) };
  }

  function ensureDashboardDateRange() {
    if (!state.dashboardDateFrom || !state.dashboardDateTo) {
      const range = defaultDashboardDateRange();
      state.dashboardDateFrom = range.from;
      state.dashboardDateTo = range.to;
    }
  }

  async function loadDashboard() {
    let path = "/dashboard";
    if (state.dashboardPeriodMode === "custom") {
      ensureDashboardDateRange();
      path += `?from=${encodeURIComponent(state.dashboardDateFrom)}&to=${encodeURIComponent(state.dashboardDateTo)}`;
    }
    state.dashboard = await api(path);
  }

  async function loadSettings() {
    state.settings = await api("/settings");
  }

  async function loadProduct(id) {
    state.product = await api(`/products/${id}`);
    if (!state.product.lastOne) {
      state.product.lastOne = blankLastOne();
    }
    state.product.prizes = (state.product.prizes || []).filter((p) => !p.isLastOne);
    state.product.lastOneEnabled = Boolean(
      state.product.lastOne.id || state.product.lastOne.name || state.product.lastOne.image
    );
    if (!state.product.drawMode) state.product.drawMode = "shuffle";
    if (!state.product.soldoutVisibility) state.product.soldoutVisibility = "show_soldout";
    ensurePrizeNumberSpecs(state.product);
    markProductClean();
  }

  function newProductDraft() {
    const defaultRemaining = state.settings
      ? Boolean(state.settings.defaultShowRemaining)
      : true;
    state.product = {
      id: null,
      name: "",
      description: "",
      coverImage: "",
      detailImage: "",
      price: 0,
      totalDraws: 12,
      theme: "light",
      foilPreset: "silver",
      foilImage: "",
      showRemaining: defaultRemaining,
      scheduleEnabled: false,
      scheduleStart: null,
      scheduleEnd: null,
      drawMode: "shuffle",
      soldoutVisibility: "show_soldout",
      status: "draft",
      prizes: [blankPrize(), blankPrize(), blankPrize()],
      lastOne: blankLastOne(),
      lastOneEnabled: false,
      slotDrafts: [],
      prizeNumberSpecs: {},
      slots: [],
      winningNumbers: [],
    };
    ensurePrizeNumberSpecs(state.product);
    markProductClean();
  }

  async function goDashboard() {
    state.view = "dashboard";
    state.error = "";
    await loadDashboard();
    render();
  }

  async function goList() {
    state.view = "list";
    state.error = "";
    await loadProducts();
    render();
  }

  async function goEdit(id) {
    if (id) await loadProduct(id);
    state.view = "edit";
    state.error = "";
    render();
  }

  async function goSettings() {
    state.view = "settings";
    state.error = "";
    await loadSettings();
    render();
  }

  function navLink(label, iconName, active, onClick) {
    return el(
      "button",
      {
        type: "button",
        className: `sidebar__link${active ? " is-active" : ""}`,
        onClick,
      },
      [icon(iconName), label]
    );
  }

  function renderSidebar() {
    const productsActive =
      state.view === "list" || state.view === "edit" || state.view === "status";

    return el("aside", { className: "sidebar" }, [
      el("div", { className: "sidebar__scroll" }, [
        el("div", { className: "sidebar__workspace" }, [
          el("div", { className: "sidebar__workspace-icon" }, icon("user")),
          el("div", { className: "sidebar__workspace-text" }, [
            el("div", { className: "sidebar__workspace-name", text: "Dottery Admin" }),
            el("div", { className: "sidebar__workspace-sub", text: "System Controller" }),
          ]),
        ]),
        el("nav", { className: "sidebar__nav" }, [
          navLink("總覽", "grid", state.view === "dashboard", goDashboard),
          navLink("商品", "box", productsActive, () => {
            if (!productsActive) goList();
          }),
          navLink("全域設定", "gear", state.view === "settings", goSettings),
        ]),
      ]),
      el("div", { className: "sidebar__bottom" }, [
        el(
          "button",
          {
            type: "button",
            className: "sidebar__link",
            onClick: async () => {
              try {
                await api("/logout", { method: "POST" });
              } catch (_err) {
              }
              window.location.href = "/shop";
            },
          },
          [icon("logout"), "登出"]
        ),
      ]),
    ]);
  }

  function renderLogin() {
    let digits = "";
    let submitting = false;
    let locked = false;

    const dots = Array.from({ length: 4 }, () => el("span", { className: "pin-dot" }));
    const dotsRow = el("div", { className: "pin-dots" }, dots);
    const panel = el("div", { className: "login-lock__panel" }, [dotsRow]);

    function syncDots() {
      dots.forEach((dot, index) => {
        dot.classList.toggle("is-filled", index < digits.length);
      });
    }

    function shake() {
      dotsRow.classList.remove("is-shake");
      void dotsRow.offsetWidth;
      dotsRow.classList.add("is-shake");
    }

    async function submitPin() {
      if (submitting || locked) return;
      submitting = true;
      locked = true;
      state.error = "";
      try {
        await api("/login", { method: "POST", body: { password: digits } });
        if (state._loginKeyHandler) {
          document.removeEventListener("keydown", state._loginKeyHandler);
          state._loginKeyHandler = null;
        }
        state.authed = true;
        state.view = "dashboard";
        await Promise.all([loadDashboard(), loadSettings(), loadProducts()]);
        render();
      } catch (err) {
        state.error = err.message;
        shake();
        window.setTimeout(() => {
          digits = "";
          syncDots();
          submitting = false;
          locked = false;
        }, 320);
      }
    }

    function pushDigit(digit) {
      if (submitting || locked || digits.length >= 4) return;
      digits += digit;
      syncDots();
      if (digits.length === 4) {
        submitPin();
      }
    }

    function popDigit() {
      if (submitting || locked) return;
      if (!digits.length) {
        window.location.href = "/shop";
        return;
      }
      digits = digits.slice(0, -1);
      syncDots();
    }

    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
    const keypad = el(
      "div",
      { className: "login-keypad" },
      keys.map((key) => {
        if (key === "") {
          return el("div", { className: "login-keypad__spacer" });
        }
        if (key === "del") {
          return el(
            "button",
            {
              type: "button",
              className: "login-keypad__key login-keypad__key--action",
              "aria-label": "刪除",
              onClick: popDigit,
            },
            [
              el("span", {
                className: "login-keypad__icon",
                html:
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H9l-6 6 6 6h12a2 2 0 002-2V8a2 2 0 00-2-2z"/><path d="M16 10l-4 4M12 10l4 4"/></svg>',
              }),
            ]
          );
        }
        return el(
          "button",
          {
            type: "button",
            className: "login-keypad__key",
            onClick: () => pushDigit(key),
          },
          [el("span", { className: "login-keypad__digit", text: key })]
        );
      })
    );

    function onKeyDown(event) {
      if (event.key >= "0" && event.key <= "9") {
        event.preventDefault();
        pushDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        popDigit();
      }
    }

    document.removeEventListener("keydown", state._loginKeyHandler);
    state._loginKeyHandler = onKeyDown;
    document.addEventListener("keydown", onKeyDown);

    app.replaceChildren(
      el("div", { className: "login" }, [
        el("div", { className: "login-lock" }, [panel, keypad]),
      ])
    );
  }

  function renderDashboard() {
    const data = state.dashboard || {
      summary: {},
      periods: { 7: {}, 30: {} },
      products: [],
      recentActivity: [],
      alerts: [],
    };
    const summary = data.summary || {};
    const periodMode = state.dashboardPeriodMode;
    const period =
      periodMode === "custom"
        ? (data.periods && data.periods.custom) || {}
        : (data.periods && data.periods[periodMode]) || {};

    const dateFromInput = el("input", { type: "date" });
    dateFromInput.value = state.dashboardDateFrom || "";
    const dateToInput = el("input", { type: "date" });
    dateToInput.value = state.dashboardDateTo || "";

    async function applyCustomRange() {
      if (!dateFromInput.value || !dateToInput.value) return;
      if (dateFromInput.value > dateToInput.value) return;
      state.dashboardDateFrom = dateFromInput.value;
      state.dashboardDateTo = dateToInput.value;
      state.error = "";
      try {
        await loadDashboard();
        render();
      } catch (err) {
        state.error = err.message;
        render();
      }
    }

    dateFromInput.addEventListener("change", applyCustomRange);
    dateToInput.addEventListener("change", applyCustomRange);

    const periodToggle = el("div", { className: "period-toggle" }, [
      el(
        "button",
        {
          type: "button",
          className: `chip${periodMode === "7" ? " is-active" : ""}`,
          onClick: () => {
            state.dashboardPeriodMode = "7";
            render();
          },
        },
        "7日"
      ),
      el(
        "button",
        {
          type: "button",
          className: `chip${periodMode === "30" ? " is-active" : ""}`,
          onClick: () => {
            state.dashboardPeriodMode = "30";
            render();
          },
        },
        "30日"
      ),
      el(
        "button",
        {
          type: "button",
          className: `chip${periodMode === "custom" ? " is-active" : ""}`,
          onClick: async () => {
            state.dashboardPeriodMode = "custom";
            ensureDashboardDateRange();
            state.error = "";
            try {
              await loadDashboard();
              render();
            } catch (err) {
              state.error = err.message;
              render();
            }
          },
        },
        "自選"
      ),
      periodMode === "custom"
        ? el("div", { className: "period-dates" }, [dateFromInput, dateToInput])
        : null,
    ]);

    const periodRevenue = Number(period.revenue) || 0;
    const periodCost = Number(period.cost) || 0;
    const periodProfit = Number(period.profit) || 0;
    const periodScratches = Number(period.scratches) || 0;
    const periodMargin = periodRevenue > 0 ? periodProfit / periodRevenue : 0;
    const rangeLabel = periodRangeLabel(periodMode, period);

    const pnlHero = el(
      "div",
      { className: `dash-hero${periodProfit < 0 ? " dash-hero--loss" : ""}` },
      [
        el("div", { className: "dash-hero__main" }, [
          el("div", { className: "dash-hero__label", text: "周期盈虧" }),
          el("div", { className: "dash-hero__value", text: formatMoney(periodProfit) }),
          el("div", {
            className: "dash-hero__meta",
            text: `毛利率 ${formatRate(periodMargin)} · 銷量 ${periodScratches}`,
          }),
        ]),
        el("div", { className: "dash-hero__chart" }, [
          el("div", { className: "dash-hero__chart-labels" }, [
            el("span", { text: `成本 ${formatMoney(periodCost)}` }),
            el("span", { text: `營收 ${formatMoney(periodRevenue)}` }),
          ]),
          buildHBar([
            { value: periodCost, className: "dash-hbar__seg--cost" },
            { value: Math.max(0, periodProfit), className: "dash-hbar__seg--profit" },
          ]),
        ]),
      ]
    );

    const siteSellThrough =
      Number(summary.totalDraws) > 0
        ? (Number(summary.totalScratched) / Number(summary.totalDraws)) * 100
        : 0;

    const metricsRow = el("div", { className: "dashboard-metrics" }, [
      buildMetricCard(
        "周期營收",
        formatMoney(periodRevenue),
        `${periodScratches} 次`,
        el("div", { className: "dash-metric__bar" }, [
          el("div", {
            className: "dash-metric__bar-fill",
            style: `width:${periodRevenue > 0 ? 100 : 0}%`,
          }),
        ])
      ),
      buildMetricCard(
        "周期成本",
        formatMoney(periodCost),
        periodRevenue > 0 ? `占營收 ${formatRate(periodCost / periodRevenue)}` : "—",
        el("div", { className: "dash-metric__bar" }, [
          el("div", {
            className: "dash-metric__bar-fill dash-metric__bar-fill--muted",
            style: `width:${periodRevenue > 0 ? (periodCost / periodRevenue) * 100 : 0}%`,
          }),
        ])
      ),
      buildMetricCard(
        "全站完售率",
        formatRate(siteSellThrough / 100),
        `${summary.totalScratched || 0} / ${summary.totalDraws || 0}`,
        buildRing(siteSellThrough)
      ),
      buildMetricCard(
        "累計盈虧",
        formatMoney(summary.totalProfit),
        `營收 ${formatMoney(summary.totalRevenue)}`,
        buildHBar([
          { value: summary.totalCost, className: "dash-hbar__seg--cost" },
          {
            value: Math.max(0, Number(summary.totalProfit) || 0),
            className: "dash-hbar__seg--profit",
          },
        ])
      ),
    ]);

    const statusPanel = el("div", { className: "dash-status panel-card" }, [
      el("div", { className: "panel-head", text: "商品狀態" }),
      buildHBar([
        { value: summary.publishedCount, className: "dash-hbar__seg--pub" },
        { value: summary.draftCount, className: "dash-hbar__seg--draft" },
        { value: summary.unpublishedCount, className: "dash-hbar__seg--off" },
        { value: summary.soldOutCount, className: "dash-hbar__seg--done" },
      ]),
      el("div", { className: "dash-status__legend" }, [
        el("span", { text: `上架 ${summary.publishedCount || 0}` }),
        el("span", { text: `草稿 ${summary.draftCount || 0}` }),
        el("span", { text: `下架 ${summary.unpublishedCount || 0}` }),
        el("span", { text: `完售 ${summary.soldOutCount || 0}` }),
      ]),
    ]);

    const recent = data.recentActivity || [];
    const activityPanel = el("div", { className: "panel-card" }, [
      el("div", { className: "panel-head", text: "近期刮獎" }),
      recent.length
        ? el(
            "div",
            { className: "dash-timeline" },
            recent.map((item) =>
              el("div", { className: "dash-timeline__item" }, [
                el("div", { className: "dash-timeline__dot" }),
                el("div", { className: "dash-timeline__body" }, [
                  el("div", {
                    className: "dash-timeline__time",
                    text: formatDateTime(item.scratchedAt),
                  }),
                  el("div", {
                    className: "dash-timeline__title",
                    text: item.productName || "—",
                  }),
                  el("div", {
                    className: "dash-timeline__meta",
                    text: `#${item.number} · ${item.prize ? item.prize.name : "—"}`,
                  }),
                ]),
              ])
            )
          )
        : el("div", { className: "empty", text: "—" }),
    ]);

    const alerts = data.alerts || [];
    const alertsPanel =
      alerts.length > 0
        ? el("div", { className: "alerts-panel" }, [
            el("div", { className: "panel-head", text: "警示" }),
            el(
              "div",
              { className: "alerts-list" },
              alerts.map((alert) =>
                el(
                  "button",
                  {
                    type: "button",
                    className: "alert-row",
                    onClick: () => goEdit(alert.productId),
                  },
                  [
                    el("span", { className: "alert-row__tag", text: alertTypeLabel(alert.type) }),
                    el("span", { className: "alert-row__name", text: alert.productName }),
                    el("span", { className: "alert-row__value", text: alert.value }),
                  ]
                )
              )
            ),
          ])
        : null;

    app.replaceChildren(
      el("div", { className: "app-shell" }, [
        renderSidebar(),
        el("div", { className: "main" }, [
          el("div", { className: "content content--wide" }, [
            el("div", { className: "page-header" }, [
              el("div", { className: "page-header__left" }, [
                el("h1", { className: "page-header__title", text: "總覽" }),
                el("div", { className: "page-header__sub", text: rangeLabel }),
              ]),
              periodToggle,
            ]),
            state.error ? el("div", { className: "error", text: state.error }) : null,
            pnlHero,
            metricsRow,
            el("div", { className: "dashboard-side" }, [
              statusPanel,
              activityPanel,
              alertsPanel,
            ]),
          ]),
        ]),
      ])
    );
  }

  function renderSettings() {
    const settings = state.settings || {
      shopTitle: "Dottery",
      showPrice: true,
      showProgress: true,
      hideSoldOut: false,
      defaultShowRemaining: true,
    };
    const draft = {
      showPrice: settings.showPrice,
      showProgress: settings.showProgress,
      hideSoldOut: settings.hideSoldOut,
      defaultShowRemaining: settings.defaultShowRemaining,
      adminPin: "",
    };

    function settingsToggle(label, key) {
      const input = el("input", { type: "checkbox" });
      input.checked = Boolean(draft[key]);
      input.addEventListener("change", () => {
        draft[key] = input.checked;
      });
      return el("div", { className: "settings-row" }, [
        el("span", { className: "settings-row__label", text: label }),
        el("label", { className: "toggle" }, [input]),
      ]);
    }

    const pinInput = el("input", {
      type: "password",
      inputmode: "numeric",
      autocomplete: "new-password",
      maxlength: "4",
      pattern: "[0-9]{4}",
    });
    pinInput.value = draft.adminPin || "";
    pinInput.addEventListener("input", () => {
      draft.adminPin = pinInput.value.replace(/\D/g, "").slice(0, 4);
      pinInput.value = draft.adminPin;
      pinSaveBtn.disabled = state.saving || !/^\d{4}$/.test(draft.adminPin);
    });

    const pinSaveBtn = el(
      "button",
      {
        type: "button",
        className: "btn settings-pin-save",
        disabled: true,
        onClick: async () => {
          if (!/^\d{4}$/.test(draft.adminPin)) {
            state.error = "密碼須為4位數字";
            render();
            return;
          }
          const ok = await confirmAction({
            target: "登入密碼",
            action: "變更",
            danger: true,
          });
          if (!ok) return;
          state.error = "";
          state.saving = true;
          pinSaveBtn.disabled = true;
          try {
            state.settings = await api("/settings", {
              method: "PUT",
              body: {
                shopTitle: settings.shopTitle,
                showPrice: draft.showPrice,
                showProgress: draft.showProgress,
                hideSoldOut: draft.hideSoldOut,
                defaultShowRemaining: draft.defaultShowRemaining,
                adminPin: draft.adminPin,
              },
            });
            draft.adminPin = "";
            pinInput.value = "";
            showNotice("已儲存");
          } catch (err) {
            state.error = err.message;
          } finally {
            state.saving = false;
            pinSaveBtn.disabled = !/^\d{4}$/.test(draft.adminPin);
            render();
          }
        },
      },
      "儲存"
    );

    const form = el("div", { className: "settings-card" }, [
      el("div", { className: "settings-row settings-row--pin" }, [
        el("span", { className: "settings-row__label", text: "登入密碼" }),
        el("div", { className: "settings-pin-field" }, [pinInput, pinSaveBtn]),
      ]),
      settingsToggle("商品列表顯示價格", "showPrice"),
      settingsToggle("商品列表顯示進度", "showProgress"),
      settingsToggle("首頁隱藏完售商品", "hideSoldOut"),
      settingsToggle("新商品預設剩餘獎項表", "defaultShowRemaining"),
      el(
        "button",
        {
          type: "button",
          className: "btn settings-save",
          disabled: state.saving,
          onClick: async () => {
            state.error = "";
            state.saving = true;
            render();
            try {
              state.settings = await api("/settings", {
                method: "PUT",
                body: {
                  shopTitle: settings.shopTitle,
                  showPrice: draft.showPrice,
                  showProgress: draft.showProgress,
                  hideSoldOut: draft.hideSoldOut,
                  defaultShowRemaining: draft.defaultShowRemaining,
                },
              });
              showNotice("已儲存");
            } catch (err) {
              state.error = err.message;
            } finally {
              state.saving = false;
              render();
            }
          },
        },
        state.saving ? "…" : "儲存"
      ),
    ]);

    app.replaceChildren(
      el("div", { className: "app-shell" }, [
        renderSidebar(),
        el("div", { className: "main" }, [
          el("div", { className: "content content--wide" }, [
            el("div", { className: "page-header" }, [
              el("h1", { className: "page-header__title", text: "全域設定" }),
            ]),
            state.error ? el("div", { className: "error", text: state.error }) : null,
            form,
          ]),
        ]),
      ])
    );
  }

  function renderPagination(total) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = state.listPage;
    const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);

    const pages = [];
    for (let i = 1; i <= totalPages; i += 1) {
      if (totalPages > 5 && i > 2 && i < totalPages - 1 && Math.abs(i - page) > 1) {
        if (pages[pages.length - 1]?.textContent !== "…") {
          pages.push(el("span", { className: "pagination__btn", text: "…" }));
        }
        continue;
      }
      pages.push(
        el(
          "button",
          {
            type: "button",
            className: `pagination__btn${i === page ? " is-active" : ""}`,
            onClick: () => {
              state.listPage = i;
              render();
            },
          },
          String(i)
        )
      );
    }

    return el("div", { className: "table-footer" }, [
      el("span", { text: `Showing ${start} to ${end} of ${total} entries` }),
      el("div", { className: "pagination" }, [
        el(
          "button",
          {
            type: "button",
            className: "pagination__btn",
            disabled: page <= 1,
            onClick: () => {
              state.listPage = Math.max(1, page - 1);
              render();
            },
          },
          icon("chevL")
        ),
        ...pages,
        el(
          "button",
          {
            type: "button",
            className: "pagination__btn",
            disabled: page >= totalPages,
            onClick: () => {
              state.listPage = Math.min(totalPages, page + 1);
              render();
            },
          },
          icon("chevR")
        ),
      ]),
    ]);
  }

  function renderList() {
    const total = state.products.length;
    const pageItems = state.products.slice(
      (state.listPage - 1) * PAGE_SIZE,
      state.listPage * PAGE_SIZE
    );

    const rows = pageItems.map((product) => {
      const done =
        product.status !== "draft" &&
        Number(product.totalDraws) > 0 &&
        Number(product.scratchedCount) >= Number(product.totalDraws);
      const remaining = Math.max(0, Number(product.totalDraws) - Number(product.scratchedCount));
      const pct = product.totalDraws
        ? (Number(product.scratchedCount) / Number(product.totalDraws)) * 100
        : 0;
      const isDraft = product.status === "draft";
      const paused = product.status === "unpublished";

      const isPublished = product.status === "published";
      const canDelete = !isPublished;

      const actions = el("div", { className: "row-actions" }, [
        linkAction("編輯", "", () => goEdit(product.id), { icon: "edit" }),
        linkAction("查看", "", () => openProductPreview(product), { icon: "eye" }),
        isPublished
          ? linkAction(
              "下架",
              "link-action--danger",
              async () => {
                const ok = await confirmAction({
                  target: product.name || product.id,
                  action: "下架",
                  danger: true,
                });
                if (!ok) return;
                try {
                  await api(`/products/${product.id}/unpublish`, { method: "POST" });
                  showNotice("已下架");
                  await loadProducts();
                  render();
                } catch (err) {
                  state.error = err.message;
                  render();
                }
              },
              { icon: "unpublish" }
            )
          : linkAction(
              "上架",
              "link-action--publish",
              async () => {
                const ok = await confirmAction({
                  target: product.name || product.id,
                  action: "上架",
                });
                if (!ok) return;
                try {
                  await api(`/products/${product.id}/publish`, { method: "POST" });
                  showNotice("已上架");
                  await loadProducts();
                  render();
                } catch (err) {
                  state.error = err.message;
                  render();
                }
              },
              { icon: "publish" }
            ),
        linkAction(
          "刪除",
          "link-action--danger",
          async () => {
            const ok = await confirmAction({
              target: product.name || product.id,
              action: "刪除",
              danger: true,
            });
            if (!ok) return;
            try {
              await api(`/products/${product.id}`, { method: "DELETE" });
              showNotice("已刪除");
              await loadProducts();
              render();
            } catch (err) {
              state.error = err.message;
              render();
            }
          },
          { icon: "trash", disabled: !canDelete }
        ),
      ]);

      const progressCell = isDraft
        ? el("span", { className: "progress-sub", text: "—" })
        : el("div", { className: "progress-cell" }, [
            el("div", {
              className: "progress-text",
              text: `${product.scratchedCount}/${product.totalDraws}`,
            }),
            el("div", {
              className: "progress-sub",
              text: paused ? "Paused" : String(remaining),
            }),
            el("div", { className: "progress-bar" }, [
              el("div", { className: "progress-bar__fill", style: `width:${pct}%` }),
            ]),
          ]);

      return el("tr", { className: done ? "is-done-row" : "" }, [
        el("td", {}, [
          product.coverImage
            ? el("img", { className: "thumb", src: product.coverImage, alt: "" })
            : el("div", { className: "thumb thumb--empty" }, icon("image")),
        ]),
        el("td", { className: "table__name", text: product.name || product.id }),
        el("td", {}, [
          el("div", { className: "inline" }, [
            statusBadge(product.status),
            done ? el("span", { className: "badge badge--done", text: "完" }) : null,
          ]),
        ]),
        el("td", {}, [progressCell]),
        el("td", {}, [actions]),
      ]);
    });

    const tableBody =
      pageItems.length === 0
        ? el("tbody", {}, [
            el("tr", {}, [
              el("td", { colSpan: "5" }, [el("div", { className: "empty", text: "—" })]),
            ]),
          ])
        : el("tbody", {}, rows);

    const tableCard = el("div", { className: "table-card" }, [
      el("div", { className: "table-wrap" }, [
        el("table", { className: "table" }, [
          el("thead", {}, [
            el("tr", {}, [
              el("th", { text: "Thumbnail" }),
              el("th", { text: "名稱" }),
              el("th", { text: "狀態" }),
              el("th", { text: "進度" }),
              el("th", { text: "" }),
            ]),
          ]),
          tableBody,
        ]),
      ]),
      total > 0 ? renderPagination(total) : null,
    ]);

    app.replaceChildren(
      el("div", { className: "app-shell" }, [
        renderSidebar(),
        el("div", { className: "main" }, [
          el("div", { className: "content" }, [
            el("div", { className: "page-header" }, [
              el("h1", { className: "page-header__title", text: "商品" }),
              el(
                "button",
                {
                  type: "button",
                  className: "btn",
                  onClick: () => {
                    newProductDraft();
                    state.view = "edit";
                    state.error = "";
                    render();
                  },
                },
                [icon("plus"), "新增"]
              ),
            ]),
            state.error ? el("div", { className: "error", text: state.error }) : null,
            tableCard,
          ]),
        ]),
      ])
    );
  }

  function bindValue(input, getter, setter) {
    input.value = getter();
    input.addEventListener("input", () => {
      setter(input.value);
      notifyProductEdited();
    });
    input.addEventListener("change", () => {
      notifyProductEdited();
    });
    return input;
  }

  function buildPreviewRail(product) {
    const slots = product.slots || [];
    const remaining = product.remaining || [];
    const scratchLog = product.scratchLog || [];
    const scratched = Number(product.scratchedCount) || 0;
    const total = Number(product.totalDraws) || 0;
    const pct = total ? (scratched / total) * 100 : 0;
    const revenue = scratched * (Number(product.price) || 0);
    const topPrizes = countTopPrizesRemaining(remaining);
    const economics = computeEconomics(product);
    const isLive = product.status === "published";

    const slotGrid = el(
      "div",
      { className: "status-grid" },
      slots.map((slot) =>
        el("div", {
          className: `status-slot ${slot.scratched ? "is-open" : ""}`,
          text: slot.scratched ? `${slot.number}` : String(slot.slotIndex + 1),
          title: slot.scratched && slot.prize ? slot.prize.name : "",
        })
      )
    );

    const recentLog = scratchLog.slice(-6).reverse();
    const logList =
      recentLog.length === 0
        ? el("div", { className: "empty", text: "—" })
        : el(
            "div",
            { className: "log-list" },
            recentLog.map((item) =>
              el("div", { className: "log-item" }, [
                el("div", {
                  className: "log-item__time",
                  text: formatTime(item.scratchedAt),
                }),
                el("div", {}, [
                  el("div", {
                    className: "log-item__body",
                    text: `#${item.number}`,
                  }),
                  el("div", {
                    className: "log-item__meta",
                    text: item.prize ? item.prize.name : "—",
                  }),
                ]),
              ])
            )
          );

    return el("aside", { className: "preview-rail" }, [
      el("div", { className: "preview-rail__head" }, [
        el("div", { className: "preview-rail__title-row" }, [
          el("div", { className: "preview-rail__title", text: product.name || product.id }),
          isLive ? el("span", { className: "badge badge--live", text: "Live" }) : null,
        ]),
      ]),
      el("div", { className: "preview-progress" }, [
        el("div", { className: "preview-progress__row" }, [
          el("span", { className: "preview-progress__label", text: "銷售進度" }),
          el("span", {
            className: "preview-progress__value",
            text: `${scratched} / ${total}`,
          }),
        ]),
        el("div", { className: "progress-bar" }, [
          el("div", { className: "progress-bar__fill", style: `width:${pct}%` }),
        ]),
      ]),
      el("div", { className: "stat-row" }, [
        el("div", { className: "stat-card" }, [
          el("div", { className: "stat-card__label", text: "營收估算" }),
          el("div", {
            className: "stat-card__value",
            text: `NT$ ${revenue.toLocaleString()}`,
          }),
        ]),
        el("div", { className: "stat-card" }, [
          el("div", { className: "stat-card__label", text: "長期期望利潤" }),
          el("div", {
            className: `stat-card__value${economics.expectedProfit < 0 ? " stat-card__value--loss" : economics.expectedProfit > 0 ? " stat-card__value--profit" : ""}`,
            text: formatMoney(economics.expectedProfit),
          }),
        ]),
        el("div", { className: "stat-card" }, [
          el("div", { className: "stat-card__label", text: "剩餘高階賞" }),
          el("div", {
            className: "stat-card__value",
            text: `${topPrizes.left} / ${topPrizes.total}`,
          }),
        ]),
      ]),
      el("div", { className: "preview-tools" }, [
        el(
          "button",
          {
            type: "button",
            className: "chip",
            onClick: async () => {
              await loadProduct(product.id);
              render();
            },
          },
          "重新整理"
        ),
        el(
          "button",
          {
            type: "button",
            className: "chip",
            onClick: async () => {
              const ok = await confirmAction({
                target: product.name || product.id,
                action: "重置",
                danger: true,
              });
              if (!ok) return;
              try {
                state.product = await api(`/products/${product.id}/reset`, { method: "POST" });
                if (!state.product.lastOne) state.product.lastOne = blankLastOne();
                state.product.prizes = (state.product.prizes || []).filter((p) => !p.isLastOne);
                ensurePrizeNumberSpecs(state.product);
                markProductClean();
                showNotice("已重置");
                render();
              } catch (err) {
                state.error = err.message;
                render();
              }
            },
          },
          "重置"
        ),
        el(
          "a",
          {
            className: "chip",
            href: `/board?product=${encodeURIComponent(product.id)}`,
            target: "_blank",
            rel: "noopener",
          },
          "前台"
        ),
      ]),
      el("div", {}, [
        el("div", { className: "preview-rail__section-title", text: "格子狀態" }),
        el("div", { className: "grid-legend" }, [
          el("div", { className: "grid-legend__item" }, [
            el("span", { className: "grid-legend__dot" }),
            "未刮開",
          ]),
          el("div", { className: "grid-legend__item" }, [
            el("span", { className: "grid-legend__dot is-open" }),
            "已刮開",
          ]),
        ]),
        slots.length ? slotGrid : el("div", { className: "empty", text: "—" }),
      ]),
      el("div", {}, [
        el("div", { className: "preview-rail__section-title", text: "刮獎紀錄" }),
        logList,
      ]),
    ]);
  }

  function renderEdit() {
    const product = syncLastOneEnabled(state.product);
    const locked = product.status === "published";
    const total = regularPrizeTotal(product);
    const match = total === Number(product.totalDraws);
    const hasPreview = showPreview(product);
    const econ = computeEconomics(product);

    const prizes = (product.prizes || []).map((prize, index) => {
      const grade = bindValue(
        el("input", { disabled: locked }),
        () => prize.grade || "",
        (v) => {
          prize.grade = v;
        }
      );
      const name = bindValue(
        el("input", { disabled: locked }),
        () => prize.name,
        (v) => {
          prize.name = v;
        }
      );
      const qty = bindValue(
        el("input", { type: "number", min: "1", disabled: locked }),
        () => String(prize.quantity),
        (v) => {
          prize.quantity = Math.max(1, Number(v) || 1);
          renderEditSummary();
        }
      );
      qty.addEventListener("change", () => {
        prize.quantity = Math.max(1, Number(qty.value) || 1);
        renderEditSummary();
      });
      const cost = bindValue(
        el("input", { type: "number", min: "0", step: "1" }),
        () => String(prize.cost ?? 0),
        (v) => {
          prize.cost = Math.max(0, Number(v) || 0);
          refreshProductEconomics(product);
        }
      );
      cost.addEventListener("change", () => {
        prize.cost = Math.max(0, Number(cost.value) || 0);
        refreshProductEconomics(product);
      });

      return el("div", { className: "prize-row" }, [
        locked
          ? prize.image
            ? el("img", { className: "prize-row__img", src: prize.image, alt: "" })
            : el("div", { className: "prize-row__img" })
          : imagePicker(prize.image, (url) => {
              prize.image = url;
            }),
        grade,
        name,
        qty,
        cost,
        locked
          ? el("div")
          : el("div", { className: "prize-row__sort" }, [
              el(
                "button",
                {
                  type: "button",
                  className: "prize-row__sort-btn",
                  disabled: index === 0,
                  onClick: () => movePrize(product, index, -1),
                },
                "↑"
              ),
              el(
                "button",
                {
                  type: "button",
                  className: "prize-row__sort-btn",
                  disabled: index === product.prizes.length - 1,
                  onClick: () => movePrize(product, index, 1),
                },
                "↓"
              ),
            ]),
        el(
          "button",
          {
            type: "button",
            className: "prize-row__del",
            disabled: locked,
            onClick: () => {
              product.prizes.splice(index, 1);
              render();
            },
          },
          "×"
        ),
      ]);
    });

    const summary = el("div", {
      className: `summary-bar ${match ? "is-ok" : ""}`,
      id: "prize-summary",
      text: `目前總數 ${total}/${product.totalDraws}`,
    });

    function renderEditSummary() {
      const next = regularPrizeTotal(product);
      summary.textContent = `目前總數 ${next}/${product.totalDraws}`;
      summary.className = `summary-bar ${next === Number(product.totalDraws) ? "is-ok" : ""}`;
      refreshProductEconomics(product);
    }

    const economicsPanel = renderEconomicsPanel(econ);

    const toolbar = el("div", { className: "editor-toolbar" }, [
      el("div", { className: "editor-toolbar__left" }, [
        el(
          "button",
          { type: "button", className: "btn btn--ghost", onClick: goList },
          [icon("back"), "返回"]
        ),
      ]),
      el("div", { className: "editor-toolbar__right" }, [
        product.id && (product.status === "draft" || product.status === "unpublished")
          ? el(
              "button",
              {
                type: "button",
                className: "btn btn--secondary",
                onClick: async () => {
                  const boardError = manualBoardError(product);
                  if (boardError) {
                    state.error = boardError;
                    render();
                    return;
                  }
                  const ok = await confirmAction({
                    target: product.name || product.id,
                    action: "上架",
                  });
                  if (!ok) return;
                  try {
                    await saveProduct(true);
                    await api(`/products/${product.id}/publish`, { method: "POST" });
                    await loadProduct(product.id);
                    showNotice("已上架");
                    await goList();
                  } catch (err) {
                    state.error = err.message;
                    render();
                  }
                },
              },
              "上架"
            )
          : null,
        product.id && product.status === "published"
          ? el(
              "button",
              {
                type: "button",
                className: "btn btn--secondary",
                onClick: async () => {
                  const ok = await confirmAction({
                    target: product.name || product.id,
                    action: "下架",
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await api(`/products/${product.id}/unpublish`, { method: "POST" });
                    await loadProduct(product.id);
                    showNotice("已下架");
                    await goList();
                  } catch (err) {
                    state.error = err.message;
                    render();
                  }
                },
              },
              "下架"
            )
          : null,
        el(
          "button",
          {
            type: "button",
            id: "product-save-btn",
            className: "btn",
            disabled: state.saving || !isProductDirty(),
            onClick: () => {
              saveProduct(false).catch(() => {});
            },
          },
          "儲存"
        ),
      ]),
    ]);

    const basic = el("div", { className: "panel panel-form stack" }, [
      el("div", { className: "panel__title", text: "基本" }),
      el("div", { className: "form-grid" }, [
        el("div", { className: "full" }, [
          field(
            "名稱",
            bindValue(
              el("input", {}),
              () => product.name,
              (v) => {
                product.name = v;
              }
            )
          ),
        ]),
        el("div", { className: "full" }, [
          field(
            "描述",
            bindValue(
              el("textarea", {}),
              () => product.description,
              (v) => {
                product.description = v;
              }
            )
          ),
        ]),
        el("div", { className: "full" }, [
          field(
            "封面",
            coverPicker(product.coverImage, (url) => {
              product.coverImage = url;
            })
          ),
        ]),
        el("div", { className: "full" }, [
          field(
            "商品頁底部大圖",
            coverPicker(product.detailImage, (url) => {
              product.detailImage = url;
            })
          ),
        ]),
        el("div", { className: "form-grid form-grid--pair full" }, [
          field(
            "價格 (NTD)",
            bindValue(
              el("input", { type: "number", min: "0", step: "1" }),
              () => String(product.price ?? 0),
              (v) => {
                product.price = Number(v) || 0;
                refreshProductEconomics(product);
              }
            )
          ),
          field(
            "總抽數",
            (() => {
              const input = el("input", { type: "number", min: "1", disabled: locked });
              input.value = String(product.totalDraws);
              input.addEventListener("input", () => {
                product.totalDraws = Math.max(1, Number(input.value) || 1);
                if (product.drawMode === "manual") {
                  product.prizeNumberSpecs = PrizeNumberSpec.defaultSpecsFromQuantities(
                    product.prizes || [],
                    product.totalDraws
                  );
                }
                renderEditSummary();
                notifyProductEdited();
              });
              return input;
            })()
          ),
        ]),
      ]),
    ]);

    const schedulePanel = el("div", { className: "panel panel-form stack" }, [
      el("div", { className: "panel__title", text: "檔期" }),
      el("div", { className: "form-grid" }, [
        el("div", { className: "full" }, [
          el("label", { className: "toggle" }, [
            (() => {
              const input = el("input", { type: "checkbox" });
              input.checked = Boolean(product.scheduleEnabled);
              input.addEventListener("change", () => {
                product.scheduleEnabled = input.checked;
                render();
              });
              return input;
            })(),
            el("span", { text: "啟用檔期" }),
          ]),
        ]),
        product.scheduleEnabled
          ? el("div", { className: "form-grid form-grid--pair full" }, [
              field(
                "開始",
                (() => {
                  const input = el("input", { type: "datetime-local" });
                  input.value = toLocalDateTimeValue(product.scheduleStart);
                  input.addEventListener("change", () => {
                    product.scheduleStart = fromLocalDateTimeValue(input.value);
                  });
                  return input;
                })()
              ),
              field(
                "結束",
                (() => {
                  const input = el("input", { type: "datetime-local" });
                  input.value = toLocalDateTimeValue(product.scheduleEnd);
                  input.addEventListener("change", () => {
                    product.scheduleEnd = fromLocalDateTimeValue(input.value);
                  });
                  return input;
                })()
              ),
            ])
          : null,
        field(
          "完售",
          (() => {
            const select = el("select", {}, [
              el("option", { value: "show_soldout", text: "保留" }),
              el("option", { value: "hide", text: "隱藏" }),
              el("option", { value: "auto_unpublish", text: "下架" }),
            ]);
            select.value = product.soldoutVisibility || "show_soldout";
            select.addEventListener("change", () => {
              product.soldoutVisibility = select.value;
            });
            return select;
          })()
        ),
      ]),
    ]);

    const boardPanel = el("div", { className: "panel panel-form stack" }, [
      el("div", { className: "panel__title", text: "盤面" }),
      el("div", { className: "form-grid" }, [
        field(
          "模式",
          (() => {
            const select = el("select", { disabled: locked }, [
              el("option", { value: "shuffle", text: "隨機" }),
              el("option", { value: "manual", text: "手動" }),
            ]);
            select.value = product.drawMode || "shuffle";
            select.addEventListener("change", () => {
              product.drawMode = select.value;
              if (product.drawMode === "manual") {
                ensurePrizeNumberSpecs(product);
              }
              render();
            });
            return select;
          })()
        ),
      ]),
      product.drawMode === "manual" ? renderPrizeSpecRows(product, locked) : null,
    ]);

    const prizePanel = el("div", { className: "panel panel-prize stack" }, [
      el("div", { className: "panel__head" }, [
        el("div", { className: "panel__title", text: "獎項" }),
        el(
          "button",
          {
            type: "button",
            className: "btn btn--secondary",
            disabled: locked,
            onClick: () => {
              product.prizes.push(blankPrize());
              render();
            },
          },
          [icon("plus"), "新增"]
        ),
      ]),
      el("div", { className: "prize-table-head" }, [
        el("span", { text: "圖片" }),
        el("span", { text: "等級" }),
        el("span", { text: "名稱" }),
        el("span", { text: "數量" }),
        el("span", { text: "成本" }),
        el("span", { text: "排序" }),
        el("span", {}),
      ]),
      el("div", { className: "prize-list" }, prizes),
      summary,
      economicsPanel,
      el("div", { className: "prize-divider" }),
      el("div", { className: "last-one-head" }, [
        el("label", { className: "toggle" }, [
          (() => {
            const input = el("input", { type: "checkbox", disabled: locked });
            input.checked = Boolean(product.lastOneEnabled);
            input.addEventListener("change", () => {
              product.lastOneEnabled = input.checked;
              if (product.lastOneEnabled && !product.lastOne) {
                product.lastOne = blankLastOne();
              }
              render();
            });
            return input;
          })(),
          el("span", { text: "最後賞" }),
        ]),
      ]),
      product.lastOneEnabled
        ? el("div", { className: "prize-row" }, [
            locked
              ? product.lastOne.image
                ? el("img", { className: "prize-row__img", src: product.lastOne.image, alt: "" })
                : el("div", { className: "prize-row__img" })
              : imagePicker(product.lastOne.image, (url) => {
                  product.lastOne.image = url;
                }),
            bindValue(
              el("input", { disabled: locked }),
              () => product.lastOne.grade || "",
              (v) => {
                product.lastOne.grade = v;
              }
            ),
            bindValue(
              el("input", { disabled: locked }),
              () => product.lastOne.name,
              (v) => {
                product.lastOne.name = v;
              }
            ),
            el("div"),
            bindValue(
              el("input", { type: "number", min: "0", step: "1" }),
              () => String(product.lastOne.cost ?? 0),
              (v) => {
                product.lastOne.cost = Math.max(0, Number(v) || 0);
                refreshProductEconomics(product);
              }
            ),
            el("div"),
            el("div"),
          ])
        : null,
    ]);

    const appearance = el("div", { className: "panel panel-form stack" }, [
      el("div", { className: "panel__title", text: "外觀" }),
      el("div", { className: "form-grid" }, [
        el("div", { className: "form-grid form-grid--pair full" }, [
          field(
            "主題",
            (() => {
              const select = el(
                "select",
                {},
                THEMES.map((t) =>
                  el("option", {
                    value: t.value,
                    text: t.label,
                    selected: product.theme === t.value,
                  })
                )
              );
              select.value = product.theme || "light";
              select.addEventListener("change", () => {
                product.theme = select.value;
              });
              return select;
            })()
          ),
          field(
            "刮膜",
            (() => {
              const select = el(
                "select",
                {},
                FOILS.map((t) =>
                  el("option", {
                    value: t.value,
                    text: t.label,
                    selected: product.foilPreset === t.value,
                  })
                )
              );
              select.value = product.foilPreset || "silver";
              select.addEventListener("change", () => {
                product.foilPreset = select.value;
              });
              return select;
            })()
          ),
        ]),
        el("div", { className: "full" }, [
          field(
            "自訂刮膜",
            coverPicker(product.foilImage, (url) => {
              product.foilImage = url;
            })
          ),
        ]),
        el("div", { className: "full" }, [
          el("label", { className: "toggle" }, [
            (() => {
              const input = el("input", { type: "checkbox" });
              input.checked = Boolean(product.showRemaining);
              input.addEventListener("change", () => {
                product.showRemaining = input.checked;
              });
              return input;
            })(),
            el("span", { text: "剩餘獎項表" }),
          ]),
        ]),
      ]),
    ]);

    const editorScroll = el("div", { className: "editor-scroll" }, [
      basic,
      schedulePanel,
      prizePanel,
      boardPanel,
      appearance,
    ]);
    editorScroll.addEventListener("input", notifyProductEdited);
    editorScroll.addEventListener("change", notifyProductEdited);

    app.replaceChildren(
      el("div", { className: "app-shell" }, [
        renderSidebar(),
        el("div", { className: "main" }, [
          el("div", { className: "content content--edit" }, [
            toolbar,
            el(
              "div",
              { className: "editor-body-wrapper" },
              [
                state.error ? el("div", { className: "error editor-error", text: state.error }) : null,
                el(
                  "div",
                  { className: `editor-body${hasPreview ? " has-preview" : ""}` },
                  [
                    editorScroll,
                    hasPreview ? buildPreviewRail(product) : null,
                  ]
                ),
              ]
            ),
          ]),
        ]),
      ])
    );
    syncSaveButton();
  }

  async function saveProduct(silent) {
    const quiet = silent === true;
    const product = state.product;
    state.saving = true;
    state.error = "";
    try {
      const payload = {
        name: product.name,
        description: product.description,
        coverImage: product.coverImage,
        detailImage: product.detailImage,
        price: product.price,
        totalDraws: product.totalDraws,
        theme: product.theme,
        foilPreset: product.foilPreset,
        foilImage: product.foilImage,
        showRemaining: product.showRemaining,
        scheduleEnabled: Boolean(product.scheduleEnabled),
        scheduleStart: product.scheduleStart || null,
        scheduleEnd: product.scheduleEnd || null,
        drawMode: product.drawMode || "shuffle",
        soldoutVisibility: product.soldoutVisibility || "show_soldout",
        prizes: (product.prizes || []).map((p, index) => ({
          id: p.id || undefined,
          grade: p.grade || "",
          name: p.name,
          image: p.image,
          quantity: Number(p.quantity) || 1,
          cost: Number(p.cost) || 0,
          sortOrder: index,
        })),
        lastOne:
          product.lastOneEnabled &&
          product.lastOne &&
          (product.lastOne.name || product.lastOne.image)
            ? {
                id: product.lastOne.id || undefined,
                grade: product.lastOne.grade || "",
                name: product.lastOne.name,
                image: product.lastOne.image,
                cost: Number(product.lastOne.cost) || 0,
              }
            : null,
      };

      if (product.drawMode === "manual") {
        const specs = ensurePrizeNumberSpecs(product);
        if (!manualBoardError(product)) {
          payload.prizeNumberSpecs = specs;
        }
      }

      if (product.id) {
        state.product = await api(`/products/${product.id}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        state.product = await api("/products", {
          method: "POST",
          body: payload,
        });
      }

      if (!state.product.lastOne) {
        state.product.lastOne = blankLastOne();
      }
      state.product.prizes = (state.product.prizes || []).filter((p) => !p.isLastOne);
      if (product.prizeNumberSpecs) {
        state.product.prizeNumberSpecs = product.prizeNumberSpecs;
      }
      ensurePrizeNumberSpecs(state.product);
      markProductClean();
      if (!quiet) {
        await goList();
        showNotice("已儲存");
      }
    } catch (err) {
      state.error = err.message;
      render();
      throw err;
    } finally {
      state.saving = false;
      syncSaveButton();
    }
  }

  function render() {
    if (!state.authed) {
      renderLogin();
      return;
    }
    if (state._loginKeyHandler) {
      document.removeEventListener("keydown", state._loginKeyHandler);
      state._loginKeyHandler = null;
    }
    if (state.view === "edit" || state.view === "status") {
      if (state.view === "status" && state.product) {
        state.view = "edit";
      }
      renderEdit();
      return;
    }
    if (state.view === "settings") {
      renderSettings();
      return;
    }
    if (state.view === "dashboard") {
      renderDashboard();
      return;
    }
    renderList();
  }

  checkAuth()
    .then(async () => {
      if (state.authed) {
        await Promise.all([loadDashboard(), loadSettings(), loadProducts()]);
      }
      render();
    })
    .catch(() => {
      state.authed = false;
      render();
    });
})();
