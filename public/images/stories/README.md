# Rabbit Hole card images

One photo per Rabbit Hole, named after its slug (the `k` / `img` value in the `RH` list in `index.html`):

| File | Card |
|---|---|
| `nvidia.jpg` | Nvidia, unravelled (custom name: set in its `img` field) |
| `lenskart-decoded.jpg` | Lenskart, decoded |
| `nykaa-decoded.jpg` | Nykaa now runs Nike India's website |
| `marico-decoded.jpg` | Marico, decoded |
| `reliance-decoded.jpg` | Reliance, decoded |
| `jio-ipo-decoded.jpg` | Jio IPO, decoded |
| `trump-june-trades.jpg` | 1,051 trades in one month |
| `top-10-upcoming-indian-ipos.jpg` | Top 10 upcoming Indian IPOs |
| `temasek-india-portfolio.jpg` | Everyone sold India. Except them. |
| `solar-panels-on-water.jpg` | Solar panels on water |

- Landscape, about **1600 × 1000 px** (16:10), JPG, ideally under 300 KB. Cards crop to fill, so keep the subject near the centre.
- Served at `/images/stories/<file>`. A missing file is fine: the card shows its illustration instead.
- Live after you commit, push and Render redeploys (or after the Cloudflare build, which copies `public/`).
- New Rabbit Hole: add its entry to `RH` with `img:"/images/stories/<slug>.jpg"` and drop the file here.
- Only use photos you have the rights to (your own, licensed, or free-to-use with attribution where required).
