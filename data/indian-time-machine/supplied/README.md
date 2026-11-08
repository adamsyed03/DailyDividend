# Supplied data (read by the game at server start)

Files here use the formats described in `../templates/README.md`:

- `headlines.csv` holds the Market Chronicle (moved here from `news.json`). Rows without an outlet or URL are flagged and never shown.
- `prices_monthly.csv`: monthly adjusted closes you supply (optional; start from the template).
- `nifty50_december.csv`: Nifty 50 closes you supply (optional; start from the template).

Run `npm run game:validate-data` after any change.
