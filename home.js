(function () {
  "use strict";

  const grid = document.getElementById("productGrid");
  const brand = document.querySelector(".home__brand");

  const shopSettings = {
    shopTitle: "Dottery",
    showPrice: true,
    showProgress: true,
    hideSoldOut: false,
  };

  function formatPrice(price) {
    const value = Number(price) || 0;
    return `$${value}`;
  }

  function createCard(product) {
    const done = Number(product.remainingDraws) <= 0;
    const card = document.createElement("a");
    card.className = `product-card${done ? " is-done" : ""}`;
    card.href = `/board?product=${encodeURIComponent(product.id)}`;

    if (product.coverImage) {
      const img = document.createElement("img");
      img.className = "product-card__cover";
      img.src = product.coverImage;
      img.alt = "";
      card.appendChild(img);
    } else {
      const empty = document.createElement("div");
      empty.className = "product-card__cover--empty";
      card.appendChild(empty);
    }

    const body = document.createElement("div");
    body.className = "product-card__body";

    const name = document.createElement("div");
    name.className = "product-card__name";
    name.textContent = product.name || product.id;

    body.appendChild(name);

    if (shopSettings.showPrice || shopSettings.showProgress) {
      const meta = document.createElement("div");
      meta.className = "product-card__meta";
      const parts = [];
      if (shopSettings.showPrice) parts.push(formatPrice(product.price));
      if (shopSettings.showProgress) {
        parts.push(`${product.scratchedCount}/${product.totalDraws}`);
      }
      meta.textContent = parts.join(" · ");
      body.appendChild(meta);
    }

    if (shopSettings.showProgress) {
      const bar = document.createElement("div");
      bar.className = "product-card__bar";
      const fill = document.createElement("div");
      fill.className = "product-card__bar-fill";
      const ratio =
        product.totalDraws > 0
          ? Math.min(1, Number(product.scratchedCount) / Number(product.totalDraws))
          : 0;
      fill.style.width = `${ratio * 100}%`;
      bar.appendChild(fill);
      body.appendChild(bar);
    }

    card.appendChild(body);
    return card;
  }

  function renderProducts(products) {
    grid.replaceChildren();
    const visible = shopSettings.hideSoldOut
      ? products.filter((product) => Number(product.remainingDraws) > 0)
      : products;
    if (visible.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "—";
      grid.appendChild(empty);
      return;
    }
    visible.forEach((product) => {
      grid.appendChild(createCard(product));
    });
  }

  function applyBrandTitle() {
    if (brand && shopSettings.shopTitle) {
      brand.textContent = shopSettings.shopTitle;
    }
    if (shopSettings.shopTitle) {
      document.title = shopSettings.shopTitle;
    }
  }

  Promise.all([
    fetch("/api/settings").then((res) => res.json()),
    fetch("/api/products").then((res) => res.json()),
  ])
    .then(([settings, data]) => {
      if (settings) {
        shopSettings.shopTitle = settings.shopTitle || shopSettings.shopTitle;
        shopSettings.showPrice = settings.showPrice !== false;
        shopSettings.showProgress = settings.showProgress !== false;
        shopSettings.hideSoldOut = Boolean(settings.hideSoldOut);
      }
      applyBrandTitle();
      renderProducts(data.products || []);
    })
    .catch(() => {
      applyBrandTitle();
      renderProducts([]);
    });
})();
