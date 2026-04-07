# Pier Master 🎣

A handcrafted browser fishing game. Built for GitHub Pages — no build step, no framework, no server.

## Play

Live at: `https://dollaralchemy.github.io/pier-master`

## Stack

| Layer | Tech |
|---|---|
| Game world | HTML5 Canvas 2D |
| UI (shop, quests, panels) | HTML + CSS |
| Rope & hook physics | Matter.js 0.19 |
| Persistence | localStorage |
| Hosting | GitHub Pages (static) |

## File structure

```
pier-master/
├── index.html          # Shell, layout, script tags
├── css/
│   └── style.css       # All styles — tokens, screens, UI
└── js/
    ├── data.js         # Fish, rods, quests — pure data
    ├── save.js         # localStorage read/write
    ├── physics.js      # Matter.js rope, hook, splash
    ├── game.js         # Canvas loop, player, fish, casting
    └── ui.js           # DOM events, shop, quests, QTE, panels
```

## Deploy

```bash
git init
git remote add origin git@github.com:DollarAlchemy/pier-master.git
git add .
git commit -m "init: pier master foundation"
git push -u origin main
```

Then in GitHub repo Settings → Pages → Source: `main` branch, `/ (root)`.

## Rods

| Rod | Price | Special |
|---|---|---|
| Starter Rod | Free | Balanced |
| Swift Cast | 80g | Fast QTE marker |
| Steady Hand | 130g | Wider catch zone |
| Deep Diver | 220g | Pulls rare fish |
| Lucky Lure | 260g | 40% double catch |
| Rainbow Rod | 450g | Catches anything |

## Fish

| Fish | Rarity | Value |
|---|---|---|
| Goldfish | ★☆☆☆ | 5g |
| Bluegill | ★☆☆☆ | 8g |
| Clownfish | ★★☆☆ | 18g |
| Pufferfish | ★★☆☆ | 24g |
| Swordfish | ★★★☆ | 45g |
| Anglerfish | ★★★★ | 80g |
