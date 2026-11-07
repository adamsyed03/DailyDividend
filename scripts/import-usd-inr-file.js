'use strict';

const fs = require('fs/promises');
const path = require('path');
const { parseCsv, rowsToObjects, toCsv } = require('../indian-time-machine/csv');

const OUTPUT = path.join(__dirname, '..', 'data', 'indian-time-machine', 'usd_inr_month_end.csv');
const REQUIRED = ['2022-06', '2022-12', '2023-06', '2023-12', '2024-06', '2024-12'];

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: npm run time-machine:fx-file -- C:\\path\\to\\validated_fx.csv');
  const rows = rowsToObjects(parseCsv(await fs.readFile(path.resolve(input), 'utf8')));
  const normalized = rows.map(row => ({
    month: String(row.month || '').trim(),
    rate: Number(row.inr_per_usd),
    date: String(row.observation_date || '').trim(),
    series: String(row.series || 'DEXINUS').trim(),
    url: String(row.source_url || 'User-supplied validated month-end FX').trim()
  })).filter(row => /^\d{4}-\d{2}$/.test(row.month) && Number.isFinite(row.rate) && row.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.date));
  const byMonth = new Map(normalized.map(row => [row.month, row]));
  const missing = REQUIRED.filter(month => !byMonth.has(month));
  if (missing.length) throw new Error(`Validated FX file is missing: ${missing.join(', ')}`);
  for (const row of normalized) {
    if (!row.date.startsWith(row.month)) throw new Error(`Observation date ${row.date} does not belong to ${row.month}.`);
  }
  await fs.writeFile(OUTPUT, toCsv(
    ['month', 'inr_per_usd', 'observation_date', 'series', 'source_url'],
    [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).map(row => [row.month, row.rate, row.date, row.series, row.url])
  ));
  console.log(`Imported ${byMonth.size} validated month-end FX rows to ${OUTPUT}`);
}

main().catch(error => {
  console.error(`Validated FX import failed: ${error.message}`);
  process.exitCode = 1;
});

