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
    saving: false,
  };

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

  function linkAction(label, className, onClick) {
    return el(
      "button",
      {
        type: "button",
        className: `link-action${className ? ` ${className}` : ""}`,
        onClick,
      },
      label
    );
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

    if (!disabled) {
      const input = el("input", { type: "file", accept: "image/*" });
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const url = await uploadFile(file);
          img.src = url;
          img.style.display = "";
          onChange(url);
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
              render();
            },
          },
          "×"
        )
      );
    }

    if (currentUrl) wrap.appendChild(img);
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
        } catch (error) {
          state.error = error.message;
          render();
        }
      });
      wrap.append(input);
    }

    return wrap;
  }

  function blankPrize() {
    return { id: "", grade: "", name: "", image: "", quantity: 1, cost: 0 };
  }

  function blankLastOne() {
    return { id: "", grade: "最後賞", name: "", image: "", quantity: 1, cost: 0, isLastOne: true };
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
    const totalDraws = Math.max(1, Number(product.totalDraws) || 1);
    const price = Number(product.price) || 0;
    const regular = (product.prizes || []).filter((p) => !p.isLastOne);
    const regularCost = regular.reduce(
      (sum, prize) => sum + (Number(prize.cost) || 0) * (Number(prize.quantity) || 0),
      0
    );
    const lastOne = product.lastOne;
    const hasLastOne =
      Boolean(product.lastOneEnabled) &&
      lastOne &&
      (lastOne.name || lastOne.image);
    const lastOneCost = hasLastOne ? Number(lastOne.cost) || 0 : 0;
    const totalCost = regularCost + lastOneCost;
    const evPerDraw = totalCost / totalDraws;
    const marginPerDraw = price - evPerDraw;
    const marginRate = price > 0 ? marginPerDraw / price : 0;
    const totalRevenue = price * totalDraws;
    const totalMargin = totalRevenue - totalCost;

    return {
      totalCost,
      evPerDraw,
      marginPerDraw,
      marginRate,
      totalRevenue,
      totalMargin,
      isLoss: marginPerDraw < 0,
    };
  }

  function economicsRow(label, valueNode) {
    return el("div", { className: "economics-row" }, [
      el("span", { className: "economics-row__label", text: label }),
      valueNode,
    ]);
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
    const top = remaining.filter((item) => {
      const g = String(item.grade || "").toUpperCase();
      return g === "A" || g === "B" || g.startsWith("A") || g.startsWith("B");
    });
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
      price: 0,
      category: "",
      totalDraws: 12,
      cols: 4,
      theme: "light",
      foilPreset: "silver",
      foilImage: "",
      showRemaining: defaultRemaining,
      status: "draft",
      prizes: [blankPrize(), blankPrize(), blankPrize()],
      lastOne: blankLastOne(),
      lastOneEnabled: false,
      slots: [],
      winningNumbers: [],
    };
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
              await api("/logout", { method: "POST" });
              state.authed = false;
              state.view = "dashboard";
              state.error = "";
              render();
            },
          },
          [icon("logout"), "登出"]
        ),
      ]),
    ]);
  }

  function renderLogin() {
    const password = el("input", { type: "password", autocomplete: "current-password" });
    const error = state.error ? el("div", { className: "error", text: state.error }) : null;

    const form = el("form", { className: "login__card" }, [
      el("div", { className: "login__brand" }, [
        el("div", { className: "login__brand-name", text: "Dottery Admin" }),
        el("div", { className: "login__brand-sub", text: "Management Portal" }),
      ]),
      password,
      error,
      el("button", { type: "submit", className: "btn", text: "進入" }),
    ]);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      try {
        await api("/login", { method: "POST", body: { password: password.value } });
        state.authed = true;
        state.view = "dashboard";
        await Promise.all([loadDashboard(), loadSettings(), loadProducts()]);
        render();
      } catch (err) {
        state.error = err.message;
        render();
      }
    });

    app.replaceChildren(el("div", { className: "login" }, [form]));
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

    const productRows = (data.products || []).map((product) => {
      const pct = product.totalDraws
        ? (Number(product.scratchedCount) / Number(product.totalDraws)) * 100
        : 0;
      const isDraft = product.status === "draft";
      const periodData =
        periodMode === "custom"
          ? product.periodCustom
          : periodMode === "30"
            ? product.period30
            : product.period7;
      const rowPeriodProfit = periodData ? Number(periodData.profit) || 0 : 0;
      const rowPeriodRevenue = periodData ? Number(periodData.revenue) || 0 : 0;
      const rowPeriodScratches = periodData ? Number(periodData.scratches) || 0 : 0;
      const topLeft = Number(product.topPrizes.left) || 0;
      const topTotal = Number(product.topPrizes.total) || 0;
      const topPct = topTotal > 0 ? (topLeft / topTotal) * 100 : 0;

      const progressCell = isDraft
        ? el("span", { className: "progress-sub", text: "—" })
        : el("div", { className: "progress-cell" }, [
            el("div", {
              className: "progress-text",
              text: `${Math.round(pct)}%`,
            }),
            el("div", {
              className: "progress-sub",
              text: `${product.scratchedCount}/${product.totalDraws}`,
            }),
            el("div", { className: "progress-bar" }, [
              el("div", { className: "progress-bar__fill", style: `width:${pct}%` }),
            ]),
          ]);

      const topCell = isDraft
        ? el("span", { className: "progress-sub", text: "—" })
        : el("div", { className: "progress-cell" }, [
            el("div", {
              className: "progress-text",
              text: `${topLeft}/${topTotal}`,
            }),
            el("div", { className: "progress-bar" }, [
              el("div", {
                className: "progress-bar__fill progress-bar__fill--muted",
                style: `width:${topPct}%`,
              }),
            ]),
          ]);

      const profitCell = periodData
        ? el("div", { className: "dash-profit-cell" }, [
            el("span", {
              className: rowPeriodProfit < 0 ? "table__loss" : "",
              text: formatMoney(rowPeriodProfit),
            }),
            rowPeriodRevenue > 0
              ? el("span", {
                  className: "dash-profit-cell__sub",
                  text: formatRate(rowPeriodProfit / rowPeriodRevenue),
                })
              : null,
          ])
        : el("span", { className: "progress-sub", text: "—" });

      return el("tr", { className: product.done ? "is-done-row" : "" }, [
        el("td", { className: "table__name", text: product.name || product.id }),
        el("td", {}, [
          el("div", { className: "inline" }, [
            statusBadge(product.status),
            product.done ? el("span", { className: "badge badge--done", text: "完" }) : null,
          ]),
        ]),
        el("td", {}, [progressCell]),
        el("td", { text: periodData ? String(rowPeriodScratches) : "—" }),
        el("td", { text: periodData ? formatMoney(rowPeriodRevenue) : "—" }),
        el("td", {}, [profitCell]),
        el("td", {}, [topCell]),
        el("td", {}, [
          el("div", { className: "row-actions" }, [
            linkAction("編輯", "", () => goEdit(product.id)),
          ]),
        ]),
      ]);
    });

    const productTable = el("div", { className: "table-card" }, [
      el("div", { className: "panel-head", text: "商品數據" }),
      el("div", { className: "table-wrap" }, [
        el("table", { className: "table" }, [
          el("thead", {}, [
            el("tr", {}, [
              el("th", { text: "名稱" }),
              el("th", { text: "狀態" }),
              el("th", { text: "完售率" }),
              el("th", { text: "周期銷量" }),
              el("th", { text: "周期營收" }),
              el("th", { text: "周期盈虧" }),
              el("th", { text: "高階賞" }),
              el("th", { text: "" }),
            ]),
          ]),
          productRows.length
            ? el("tbody", {}, productRows)
            : el("tbody", {}, [
                el("tr", {}, [
                  el("td", { colSpan: "7" }, [el("div", { className: "empty", text: "—" })]),
                ]),
              ]),
        ]),
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
                    text: `#${item.number} · ${item.prize ? item.prize.grade : "—"} · ${item.prize ? item.prize.name : "—"}`,
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
            el("div", { className: "dashboard-grid" }, [
              productTable,
              el("div", { className: "dashboard-side" }, [
                statusPanel,
                activityPanel,
                alertsPanel,
              ]),
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
      shopTitle: settings.shopTitle,
      showPrice: settings.showPrice,
      showProgress: settings.showProgress,
      hideSoldOut: settings.hideSoldOut,
      defaultShowRemaining: settings.defaultShowRemaining,
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

    const titleInput = el("input", { type: "text" });
    titleInput.value = draft.shopTitle || "";
    titleInput.addEventListener("input", () => {
      draft.shopTitle = titleInput.value;
    });

    const form = el("div", { className: "settings-card" }, [
      el("div", { className: "settings-row" }, [
        el("span", { className: "settings-row__label", text: "首頁標題" }),
        titleInput,
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
                body: draft,
              });
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

      const actions = [
        linkAction("編輯", "", () => goEdit(product.id)),
        !isDraft ? linkAction("查看", "", () => goEdit(product.id)) : null,
        product.status !== "published"
          ? linkAction("刪除", "link-action--danger", async () => {
              await api(`/products/${product.id}`, { method: "DELETE" });
              await loadProducts();
              render();
            })
          : null,
      ];

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
        el("td", {}, [el("div", { className: "row-actions" }, actions)]),
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
              el("th", { text: "Actions" }),
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
    input.addEventListener("input", () => setter(input.value));
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
          title: slot.scratched && slot.prize ? `${slot.prize.grade} ${slot.prize.name}` : "",
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
                    text: `#${item.number} (${item.prize ? item.prize.grade : "—"})`,
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
          el("div", { className: "stat-card__label", text: "單抽期望值" }),
          el("div", {
            className: "stat-card__value",
            text: formatMoney(economics.evPerDraw),
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
              state.product = await api(`/products/${product.id}/reset`, { method: "POST" });
              if (!state.product.lastOne) state.product.lastOne = blankLastOne();
              state.product.prizes = (state.product.prizes || []).filter((p) => !p.isLastOne);
              render();
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

    const prizes = (product.prizes || []).map((prize, index) => {
      const grade = bindValue(
        el("input", { disabled: locked }),
        () => prize.grade,
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
          renderEditEconomics();
        }
      );
      cost.addEventListener("change", () => {
        prize.cost = Math.max(0, Number(cost.value) || 0);
        renderEditEconomics();
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
      renderEditEconomics();
    }

    const econ = computeEconomics(product);
    const economicsPanel = el(
      "div",
      {
        className: `economics-panel${econ.isLoss ? " economics-panel--loss" : ""}`,
        id: "economics-panel",
      },
      [
        el("div", { className: "panel__title", text: "期望值" }),
        el("div", { className: "economics-grid" }, [
          economicsRow(
            "單抽售價",
            el("span", { className: "economics-row__value", id: "econ-price", text: formatMoney(product.price) })
          ),
          economicsRow(
            "單抽期望值",
            el("span", { className: "economics-row__value", id: "econ-ev", text: formatMoney(econ.evPerDraw) })
          ),
          economicsRow(
            "單抽毛利",
            el("span", {
              className: "economics-row__value",
              id: "econ-margin",
              text: formatMoney(econ.marginPerDraw),
            })
          ),
          economicsRow(
            "毛利率",
            el("span", {
              className: "economics-row__value",
              id: "econ-rate",
              text: formatRate(econ.marginRate),
            })
          ),
          economicsRow(
            "總成本",
            el("span", {
              className: "economics-row__value",
              id: "econ-total-cost",
              text: formatMoney(econ.totalCost),
            })
          ),
          economicsRow(
            "總售價",
            el("span", {
              className: "economics-row__value",
              id: "econ-total-revenue",
              text: formatMoney(econ.totalRevenue),
            })
          ),
          economicsRow(
            "預估毛利",
            el("span", {
              className: "economics-row__value",
              id: "econ-total-margin",
              text: formatMoney(econ.totalMargin),
            })
          ),
        ]),
      ]
    );

    function renderEditEconomics() {
      const next = computeEconomics(product);
      const panel = document.getElementById("economics-panel");
      const priceEl = document.getElementById("econ-price");
      const evEl = document.getElementById("econ-ev");
      const marginEl = document.getElementById("econ-margin");
      const rateEl = document.getElementById("econ-rate");
      const totalCostEl = document.getElementById("econ-total-cost");
      const totalRevenueEl = document.getElementById("econ-total-revenue");
      const totalMarginEl = document.getElementById("econ-total-margin");
      if (!panel || !priceEl) return;
      panel.className = `economics-panel${next.isLoss ? " economics-panel--loss" : ""}`;
      priceEl.textContent = formatMoney(product.price);
      evEl.textContent = formatMoney(next.evPerDraw);
      marginEl.textContent = formatMoney(next.marginPerDraw);
      rateEl.textContent = formatRate(next.marginRate);
      totalCostEl.textContent = formatMoney(next.totalCost);
      totalRevenueEl.textContent = formatMoney(next.totalRevenue);
      totalMarginEl.textContent = formatMoney(next.totalMargin);
    }

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
                  try {
                    await saveProduct(true);
                    await api(`/products/${product.id}/publish`, { method: "POST" });
                    await loadProduct(product.id);
                    render();
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
                  try {
                    await api(`/products/${product.id}/unpublish`, { method: "POST" });
                    await loadProduct(product.id);
                    render();
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
            className: "btn",
            disabled: state.saving,
            onClick: saveProduct,
          },
          "儲存"
        ),
      ]),
    ]);

    const basic = el("div", { className: "panel stack" }, [
      el("div", { className: "panel__title", text: "基本" }),
      el("div", { className: "form-grid" }, [
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
        field(
          "分類",
          bindValue(
            el("input", {}),
            () => product.category,
            (v) => {
              product.category = v;
            }
          )
        ),
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
        field(
          "價格 (NTD)",
          bindValue(
            el("input", { type: "number", min: "0", step: "1" }),
            () => String(product.price ?? 0),
            (v) => {
              product.price = Number(v) || 0;
              renderEditEconomics();
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
              renderEditSummary();
            });
            return input;
          })()
        ),
        field(
          "欄數",
          (() => {
            const input = el("input", { type: "number", min: "1", disabled: locked });
            input.value = String(product.cols);
            input.addEventListener("input", () => {
              product.cols = Math.max(1, Number(input.value) || 1);
            });
            return input;
          })()
        ),
      ]),
    ]);

    const prizePanel = el("div", { className: "panel stack" }, [
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
              () => product.lastOne.grade,
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
                renderEditEconomics();
              }
            ),
            el("div"),
          ])
        : null,
    ]);

    const appearance = el("div", { className: "panel stack" }, [
      el("div", { className: "panel__title", text: "外觀" }),
      el("div", { className: "form-grid" }, [
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
                    el("div", { className: "editor-scroll" }, [basic, prizePanel, appearance]),
                    hasPreview ? buildPreviewRail(product) : null,
                  ]
                ),
              ]
            ),
          ]),
        ]),
      ])
    );
  }

  async function saveProduct(silent) {
    const product = state.product;
    state.saving = true;
    state.error = "";
    try {
      const payload = {
        name: product.name,
        description: product.description,
        coverImage: product.coverImage,
        price: product.price,
        category: product.category,
        totalDraws: product.totalDraws,
        cols: product.cols,
        theme: product.theme,
        foilPreset: product.foilPreset,
        foilImage: product.foilImage,
        showRemaining: product.showRemaining,
        prizes: (product.prizes || []).map((p) => ({
          id: p.id || undefined,
          grade: p.grade,
          name: p.name,
          image: p.image,
          quantity: Number(p.quantity) || 1,
          cost: Number(p.cost) || 0,
        })),
        lastOne:
          product.lastOneEnabled &&
          product.lastOne &&
          (product.lastOne.name || product.lastOne.image)
            ? {
                id: product.lastOne.id || undefined,
                grade: product.lastOne.grade || "最後賞",
                name: product.lastOne.name,
                image: product.lastOne.image,
                cost: Number(product.lastOne.cost) || 0,
              }
            : null,
      };

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
      if (!silent) render();
    } catch (err) {
      state.error = err.message;
      render();
      throw err;
    } finally {
      state.saving = false;
    }
  }

  function render() {
    if (!state.authed) {
      renderLogin();
      return;
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
