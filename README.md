# Dottery

## 啟動

```bash
npm install
npm start
```

- 前台：http://localhost:3000 （商品列表）
- 刮板：http://localhost:3000/board?product=<id>
- 後台：http://localhost:3000/admin
- 預設密碼：`dottery`（可用環境變數 `ADMIN_PASSWORD` 覆寫）

## GitHub Pages

```bash
npm run build:pages
```

- 產出 `docs/` 靜態版，push 到 `main` 後由 GitHub Actions 自動部署
- 靜態版以 `localStorage` 取代伺服器資料庫，資料只存在瀏覽器本機

## 架構

```
商品 (Product)
 ├── 獎項 (Prizes) + Last One
 └── 刮格 (Slots) × N
      └── 號碼 / 獎項對應（上架時洗牌鎖定）
```

- `server/` — Express + SQLite（`node:sqlite`）
- `admin/` — 商品上架後台
- `home.html` — 商品列表（`/shop`）
- `board.html` — 全螢幕鏡頭放大刮板
