'use strict';

// Imports month-end USD/INR (FRED DEXINUS, the final valid observation of each month).
// Usage: npm run time-machine:fx -- [--from YYYY-MM] [--to YYYY-MM]   (default 2007-12 → 2025-12)
const fs = require('fs/promises');
const path = require('path');
const { parseCsv, toCsv } = require('../indian-time-machine/csv');

const SERIES = 'DEXINUS';
const OUTPUT = path.join(__dirname, '..', 'data', 'indian-time-machine', 'usd_inr_month_end.csv');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!/^\d{4}-\d{2}$/.test(value || '')) throw new Error(`--${name} must be YYYY-MM.`);
  return value;
}

function monthsBetween(from, to) {
  const months = [];
  let [year, month] = from.split('-').map(Number);
  const [endYear, endMonth] = to.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month === 13) { month = 1; year += 1; }
  }
  return months;
}

async function main() {
  const from = arg('from', '2007-12');
  const to = arg('to', '2025-12');
  const [toYear, toMonth] = to.split('-').map(Number);
  const lastDay = new Date(Date.UTC(toYear, toMonth, 0)).getUTCDate();
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${SERIES}&cosd=${from}-01&coed=${to}-${lastDay}`;
  const response = await fetch(url, { headers: { 'user-agent': 'DailyDividend-IndianTimeMachine/1.0' } });
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
  const required = monthsBetween(from, to);
  const missing = required.filter(month => !byMonth.has(month));
  if (missing.length) throw new Error(`FRED import is missing months: ${missing.join(', ')}`);
  const outputRows = required.map(month => byMonth.get(month));

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, toCsv(
    ['month', 'inr_per_usd', 'observation_date', 'series', 'source_url'],
    outputRows.map(item => [item.month, item.rate, item.date, SERIES, 'https://fred.stlouisfed.org/series/DEXINUS'])
  ));
  console.log(`Imported ${outputRows.length} month-end USD/INR rates (${from} → ${to}) to ${OUTPUT}`);
  for (const month of [from, '2022-06', '2022-12', '2024-12', to]) {
    const item = byMonth.get(month);
    if (item) console.log(`${month}: ${item.rate} INR/USD (${item.date})`);
  }
}

main().catch(error => {
  console.error(`USD/INR import failed: ${error.message}`);
  process.exitCode = 1;
});
