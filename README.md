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
