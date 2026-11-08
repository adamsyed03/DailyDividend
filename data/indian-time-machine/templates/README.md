# Beat the Past: data templates

These are blank, header-only templates. Fill one in and save it, with the same file name, in `../supplied/`. The game reads `supplied/` when the server starts. Then run:

```
npm run game:validate-data
```

The validator prints exactly what's still missing for the current window and for each hidden-year start year. It also shows which feature flags the server will switch on. Restart the server after changing data.

Never type in a number or headline that you haven't taken from a source. Every row has a `source` (prices) or an `outlet` and `url` (headlines).

## 1. `prices_monthly.csv`: monthly adjusted closes, one row per asset per month

| column | example | notes |
|---|---|---|
| `asset_id` | `RELIANCE.NS` | must match an `id` in `scenario_config.json` → `assets` |
| `date` | `2008-12-31` | the trading date of the month's last close (`YYYY-MM-DD`). `YYYY-MM` is accepted, but then clue timing falls back to the FX date. |
| `adj_close` | `<number from source>` | adjusted for splits, bonuses and dividends, in the asset's native currency |
| `currency` | `INR` or `USD` | `USD` assets are converted with month-end USD/INR |
| `source` | `Yahoo Finance RELIANCE.NS monthly, downloaded 2026-11-10` | where the number came from |

- **Monthly, with no gaps.** A start year *S* needs every month from Dec *S−2* (for the round-1 "last year %") to Dec *S+3*. For start years 2009–2022 that means Dec 2007 → Dec 2025.
- Rows that already exist in `../market_prices_monthly.csv` (Dec 2021 onward) keep their existing value. If a supplied value differs by more than 0.5%, the validator lists it under conflicts.
- A new asset for the pool also needs an entry in `scenario_config.json` → `assets`, with `id`, `shortName`, `name`, `currency`, `market`, `color` and `oneLiner`. Puzzles only draw assets whose data covers their whole window.

## 2. `nifty50_december.csv`: Nifty 50 closing levels

| column | example | notes |
|---|---|---|
| `date` | `2008-12-31` | last trading day of December (`YYYY-MM-DD`) |
| `close` | `<number from source>` | Nifty 50 price index close |
| `source` | `NSE historical index data` | |

- You need one row per December from the year before the first start year to the last round's end: Dec 2008 → Dec 2025 for start years 2009–2022.
- Other month-ends are accepted too. The current Jun 2022 → Dec 2024 window would need Dec 2022, Dec 2023 and Jun 2024 to switch on the per-round Nifty.

## 3. `headlines.csv`: real headlines only

| column | example | notes |
|---|---|---|
| `id` | `2018-09-24-short-slug` | unique, any format |
| `date` | `2018-09-24` | publication date, `YYYY-MM-DD` |
| `region` | `IN`, `US` or `GLOBAL` | |
| `outlet` | `Mint` | required |
| `headline` | `<exact published headline>` | as published |
| `url` | `https://…` | required |
| `round_role` | `clue` or `during` | see below |
| `asset_tags` | `RELIANCE.NS\|HDFCBANK.NS` | optional, pipe-separated asset ids |
| `summary` | one sentence | optional; used in the "Why it moved" card and the Chronicle |

- **`clue`** headlines are shown before a decision, with the date hidden. A clue belongs to the decision point whose three-month lead-up contains its date: Oct–Dec *Y* for the Dec *Y* close. It must not be dated after that month's last close, or the validator flags it and it's never shown. Each decision needs at least one `IN` clue and one `US`/`GLOBAL` clue.
- **`during`** headlines are dated inside a round. One is shown after the round, with the date still hidden. Its `summary` can feed "Why it moved" when it's tagged with the asset.
- Any row missing an outlet or URL is flagged and kept out of play. It's never shown to players.
- `../supplied/headlines.csv` holds the Market Chronicle: 16 owner-supplied outlet headlines (Nov 2026) plus 7 earlier entries credited to the company or regulator that published them. The two old unsourced rows ("Indian Inflation Falls to 4.25%" and "Gold Hits Record High") have been removed; the gold one is replaced by the Reuters/Kitco story of 12 Apr 2024.

## Feature flags

`scenario_config.json` → `featureFlags`. Each flag switches itself on when the validator's check for it passes. You can set `"enabled": false` to force one off.

| flag | turns on when |
|---|---|
| `hiddenYears` | at least `minStartYears` (4) start years are playable, meaning every month of prices and FX for at least four pool assets, plus CPI |
| `clues` | the puzzle's every decision point has an `IN` clue and a `US`/`GLOBAL` clue |
| `roundNifty` | there's a Nifty close at every round boundary (chips, chart line, round squares) |
| `niftyTitles` | there's a Nifty level at the start and end of the window |
