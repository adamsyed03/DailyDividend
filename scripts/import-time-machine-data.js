'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const initSqlJs = require('sql.js');
const { parseCsv, rowsToObjects, toCsv } = require('../indian-time-machine/csv');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'indian-time-machine');
const WORKBOOK_FILE = path.join(DATA_DIR, 'indian_game_dataset.xlsx');
const PRICE_FILE = path.join(DATA_DIR, 'market_prices_monthly.csv');
const FX_FILE = path.join(DATA_DIR, 'usd_inr_month_end.csv');
const DB_FILE = path.join(DATA_DIR, 'indian-time-machine.sqlite');

function requiredFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
}

function sqlText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizePercent(value) {
  if (typeof value === 'string') return Number(value.replace('%', '').replace(/,/g, '').trim());
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  return Math.abs(number) < 1 ? number * 100 : number;
}

function writeAuditCsv(inflationRows, eventRows) {
  fs.writeFileSync(path.join(DATA_DIR, 'india_inflation_annual.csv'), toCsv(
    ['year', 'india_cpi_inflation_percent', 'region', 'series', 'source'],
    inflationRows.map(row => [row.year, row.percent, row.region, row.series, row.source])
  ));
  fs.writeFileSync(path.join(DATA_DIR, 'corporate_events_from_screenshots.csv'), toCsv(
    ['asset', 'event_date', 'type', 'reported_value', 'units', 'screenshot_source', 'processing_instruction'],
    eventRows.map(row => [row.asset, row.eventDate, row.type, row.value, row.units, row.source, row.instruction])
  ));
}

async function main() {
  [WORKBOOK_FILE, PRICE_FILE, FX_FILE].forEach(requiredFile);
  const workbook = XLSX.readFile(WORKBOOK_FILE, { cellDates: false });
  const inflationSheet = workbook.Sheets['India Inflation'];
  const eventsSheet = workbook.Sheets['Corporate Actions'];
  if (!inflationSheet || !eventsSheet) throw new Error('The supplied workbook is missing a required sheet.');

  const inflationRows = XLSX.utils.sheet_to_json(inflationSheet, { defval: '' }).map(row => ({
    year: Number(row.Year),
    percent: normalizePercent(row['India CPI inflation (%)']),
    region: sqlText(row.Region),
    series: sqlText(row.Series),
    source: sqlText(row.Source)
  })).filter(row => Number.isInteger(row.year) && Number.isFinite(row.percent));

  const eventRows = XLSX.utils.sheet_to_json(eventsSheet, { defval: '' }).map(row => ({
    asset: sqlText(row.Asset),
    eventDate: sqlText(row['Event date']),
    type: sqlText(row.Type),
    value: sqlText(row['Reported value']),
    units: sqlText(row.Units),
    source: sqlText(row['Screenshot source']),
    instruction: sqlText(row['Processing instruction'])
  })).filter(row => row.asset && row.eventDate && row.type);

  const priceRows = rowsToObjects(parseCsv(fs.readFileSync(PRICE_FILE, 'utf8'))).map(row => ({
    asset: sqlText(row.asset),
    month: sqlText(row.month),
    currency: sqlText(row.native_currency),
    price: Number(row.price_native),
    basis: sqlText(row.price_basis),
    partial: /^true$/i.test(sqlText(row.is_partial_month)) ? 1 : 0,
    status: sqlText(row.verification_status),
    provenance: sqlText(row.source)
  })).filter(row => row.asset && /^\d{4}-\d{2}$/.test(row.month) && Number.isFinite(row.price) && row.price > 0);

  const fxRows = rowsToObjects(parseCsv(fs.readFileSync(FX_FILE, 'utf8'))).map(row => ({
    month: sqlText(row.month),
    rate: Number(row.inr_per_usd),
    date: sqlText(row.observation_date),
    series: sqlText(row.series),
    url: sqlText(row.source_url)
  })).filter(row => /^\d{4}-\d{2}$/.test(row.month) && Number.isFinite(row.rate) && row.rate > 0);

  if (priceRows.length !== 250) throw new Error(`Expected 250 supplied price rows; found ${priceRows.length}.`);
  if (inflationRows.length < 60) throw new Error(`Inflation import is unexpectedly short (${inflationRows.length} rows).`);
  if (eventRows.length !== 32) throw new Error(`Expected 32 corporate-action audit rows; found ${eventRows.length}.`);

  writeAuditCsv(inflationRows, eventRows);
  const SQL = await initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) });
  const db = new SQL.Database();
  db.run(fs.readFileSync(path.join(ROOT, 'indian-time-machine', 'schema.sql'), 'utf8'));
  db.run('BEGIN');
  try {
    const priceStatement = db.prepare(`INSERT INTO prices
      (asset_id, month, native_currency, price_native, price_basis, is_partial_month, verification_status, provenance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const row of priceRows) priceStatement.run([row.asset, row.month, row.currency, row.price, row.basis, row.partial, row.status, row.provenance]);
    priceStatement.free();

    const fxStatement = db.prepare(`INSERT INTO fx_month_end
      (month, inr_per_usd, observation_date, series, source_url) VALUES (?, ?, ?, ?, ?)`);
    for (const row of fxRows) fxStatement.run([row.month, row.rate, row.date, row.series, row.url]);
    fxStatement.free();

    const inflationStatement = db.prepare(`INSERT INTO inflation_annual
      (year, inflation_percent, region, series, source) VALUES (?, ?, ?, ?, ?)`);
    for (const row of inflationRows) inflationStatement.run([row.year, row.percent, row.region, row.series, row.source]);
    inflationStatement.free();

    const eventStatement = db.prepare(`INSERT INTO corporate_events
      (asset_id, event_date, event_type, reported_value, units, source, processing_instruction)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const row of eventRows) eventStatement.run([row.asset, row.eventDate, row.type, row.value, row.units, row.source, row.instruction]);
    eventStatement.free();

    const sourceStatement = db.prepare(`INSERT INTO source_files
      (name, source_type, imported_at, row_count, verification_status) VALUES (?, ?, ?, ?, ?)`);
    const importedAt = new Date().toISOString();
    sourceStatement.run(['market_prices_monthly.csv', 'owner screenshot transcription', importedAt, priceRows.length, 'needs final screenshot audit']);
    sourceStatement.run(['usd_inr_month_end.csv', 'FRED DEXINUS', importedAt, fxRows.length, 'official series; month-end selection']);
    sourceStatement.run(['india_inflation_annual.csv', 'World Bank WDI', importedAt, inflationRows.length, 'annual context only']);
    sourceStatement.run(['corporate_events_from_screenshots.csv', 'owner screenshot transcription', importedAt, eventRows.length, 'audit only; do not reapply']);
    sourceStatement.free();
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
  db.close();
  console.log(`Imported ${priceRows.length} prices, ${fxRows.length} FX months, ${inflationRows.length} inflation years and ${eventRows.length} events.`);
  console.log(`Created ${DB_FILE}`);
}

main().catch(error => {
  console.error(`Time Machine data import failed: ${error.message}`);
  process.exitCode = 1;
});

