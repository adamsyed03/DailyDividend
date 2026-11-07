# Indian Time Machine data notes

- `market_prices_monthly.csv` is the project owner's screenshot-transcribed source. Stock rows use monthly adjusted close. Gold rows use the quoted monthly price.
- `indian_game_dataset.xlsx` is the supplied audit workbook. The import script reads its India Inflation and Corporate Actions sheets into the local SQLite database.
- `usd_inr_month_end.csv` is produced from the Federal Reserve FRED `DEXINUS` daily series by taking the final valid observation in each month.
- Apple and gold returns are converted to INR with the month-end FX ratio. Cash earns 0% nominal interest.
- Corporate actions are metadata only. The equity prices are already adjusted, so dividends and splits must not be applied again.
- The gold instrument is not identified by the source screenshots. The private prototype keeps those values and labels the instrument unverified.
- World Bank inflation is annual CPI growth. It is context only and must not be treated as a half-year CPI index.
- Screenshot transcription still needs a final visual audit before public claims or redistribution.

