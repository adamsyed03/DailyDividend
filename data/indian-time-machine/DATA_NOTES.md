# Indian Time Machine data notes

- `market_prices_monthly.csv` is the project owner's screenshot-transcribed source. Stock rows use monthly adjusted close. Gold rows use the quoted monthly price.
- `indian_game_dataset.xlsx` is the supplied audit workbook. The import script reads its India Inflation and Corporate Actions sheets into the local SQLite database.
- `usd_inr_month_end.csv` is produced from the Federal Reserve FRED `DEXINUS` daily series by taking the final valid observation in each month (Dec 2007 → Dec 2025; `npm run time-machine:fx -- --from YYYY-MM --to YYYY-MM`).
- Apple and gold returns are converted to INR with the month-end FX ratio. Cash is 0% nominal during play; CPI is only used for the final "after inflation" line.
- Corporate actions are metadata only. The equity prices are already adjusted, so dividends and splits must not be applied again.
- The gold instrument is not identified by the source screenshots. The private prototype keeps those values and labels the instrument unverified.
- World Bank inflation is annual CPI growth. It is context only and must not be treated as a half-year CPI index.
- Screenshot transcription still needs a final visual audit before public claims or redistribution.

- The game reads market data straight from these CSVs (and `supplied/`) via `indian-time-machine/dataset.js`; the SQLite file now only holds game sessions and results. Old results are kept in `game_results_v1_archive`.
- Headlines live in `supplied/headlines.csv` (see `templates/README.md`). `npm run game:validate-data` reports gaps and flagged rows.
