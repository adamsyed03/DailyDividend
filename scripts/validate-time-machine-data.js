'use strict';

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'indian-time-machine');
const CONFIG = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scenario_config.json'), 'utf8'));
const DB_FILE = path.join(DATA_DIR, 'indian-time-machine.sqlite');

async function main() {
  if (!fs.existsSync(DB_FILE)) throw new Error('Database is missing. Run npm run time-machine:import.');
  const SQL = await initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) });
  const db = new SQL.Database(fs.readFileSync(DB_FILE));
  const months = [...new Set(CONFIG.rounds.flatMap(round => [
    round.decisionMonth,
    round.revealMonth,
    ...(round.passiveHold ? [round.passiveHold.startMonth, round.passiveHold.endMonth] : [])
  ]))].sort();
  const priceAssets = CONFIG.assets.filter(asset => asset.id !== 'CASH_INR').map(asset => asset.id);
  const missing = [];
  const partial = [];
  for (const asset of priceAssets) {
    for (const month of months) {
      const result = db.exec('SELECT price_native, is_partial_month FROM prices WHERE asset_id = ? AND month = ?', [asset, month]);
      if (!result.length) missing.push(`${asset} ${month}`);
      else if (Number(result[0].values[0][1])) partial.push(`${asset} ${month}`);
    }
  }
  for (const month of months) {
    if (!db.exec('SELECT 1 FROM fx_month_end WHERE month = ?', [month]).length) missing.push(`DEXINUS ${month}`);
  }
  for (const year of [2022, 2023, 2024]) {
    if (!db.exec('SELECT 1 FROM inflation_annual WHERE year = ?', [year]).length) missing.push(`India CPI ${year}`);
  }
  const priceCount = db.exec('SELECT COUNT(*) FROM prices')[0].values[0][0];
  const sourceCount = db.exec('SELECT COUNT(*) FROM source_files')[0].values[0][0];
  db.close();
  if (priceCount !== 250) missing.push(`expected 250 source prices, found ${priceCount}`);
  if (sourceCount < 4) missing.push('source audit records');
  if (partial.length) throw new Error(`Required checkpoints contain partial months: ${partial.join(', ')}`);
  if (missing.length) throw new Error(`Required game data is missing: ${missing.join(', ')}`);
  console.log(`PASS: ${priceCount} supplied prices and all ${months.length} checkpoint months are complete for four assets plus FRED FX.`);
  console.log('PASS: annual India CPI context exists for 2022–2024. Gold remains explicitly instrument-unverified.');
}

main().catch(error => {
  console.error(`Validation failed: ${error.message}`);
  process.exitCode = 1;
});

