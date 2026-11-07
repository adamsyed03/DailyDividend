'use strict';

const fs = require('fs/promises');
const path = require('path');
const { parseCsv, toCsv } = require('../indian-time-machine/csv');

const SERIES = 'DEXINUS';
const SOURCE_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXINUS&cosd=2021-01-01&coed=2024-12-31';
const OUTPUT = path.join(__dirname, '..', 'data', 'indian-time-machine', 'usd_inr_month_end.csv');

async function main() {
  const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'DailyDividend-IndianTimeMachine/1.0' } });
  if (!response.ok) throw new Error(`FRED returned HTTP ${response.status}.`);
  const rows = parseCsv(await response.text());
  if (rows.length < 2) throw new Error('FRED returned no DEXINUS observations.');
  const header = rows[0].map(value => value.trim());
  const dateIndex = header.findIndex(value => /date/i.test(value));
  const valueIndex = header.indexOf(SERIES);
  if (dateIndex < 0 || valueIndex < 0) throw new Error(`Unexpected FRED columns: ${header.join(', ')}`);

  const byMonth = new Map();
  for (const row of rows.slice(1)) {
    const date = String(row[dateIndex] || '').trim();
    const rate = Number(row[valueIndex]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(rate) || rate <= 0) continue;
    byMonth.set(date.slice(0, 7), { month: date.slice(0, 7), rate, date });
  }
  const outputRows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  const required = ['2022-06', '2022-12', '2023-06', '2023-12', '2024-06', '2024-12'];
  const missing = required.filter(month => !byMonth.has(month));
  if (missing.length) throw new Error(`FRED import is missing required months: ${missing.join(', ')}`);

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, toCsv(
    ['month', 'inr_per_usd', 'observation_date', 'series', 'source_url'],
    outputRows.map(item => [item.month, item.rate, item.date, SERIES, 'https://fred.stlouisfed.org/series/DEXINUS'])
  ));
  console.log(`Imported ${outputRows.length} month-end USD/INR rates to ${OUTPUT}`);
  for (const month of required) {
    const item = byMonth.get(month);
    console.log(`${month}: ${item.rate} INR/USD (${item.date})`);
  }
}

main().catch(error => {
  console.error(`USD/INR import failed: ${error.message}`);
  process.exitCode = 1;
});

