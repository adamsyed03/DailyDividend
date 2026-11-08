'use strict';

// Loads every market-data and headline file the game uses, and answers coverage
// questions about it. The server's feature flags and `npm run game:validate-data`
// both use this module, so "validation passes" means the same thing in both.

const fs = require('fs');
const path = require('path');
const { parseCsv, rowsToObjects } = require('./csv');

const CASH_ID = 'CASH_INR';
const REGIONS = new Set(['IN', 'US', 'GLOBAL']);
const ROLES = new Set(['clue', 'during']);

function readCsv(file) {
  if (!fs.existsSync(file)) return [];
  return rowsToObjects(parseCsv(fs.readFileSync(file, 'utf8')));
}

function monthOf(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 7);
  return null;
}

function lastDayOfMonth(month) {
  const [year, number] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, '0')}`;
}

function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRange(from, to) {
  const months = [];
  for (let month = from; month <= to; month = shiftMonth(month, 1)) months.push(month);
  return months;
}

// "2006-12, 2007-01 … 2011-12" → "2006-12 → 2011-12 (61 months)"
function describeMonths(months) {
  if (!months.length) return '';
  const runs = [];
  let start = months[0];
  let previous = months[0];
  for (const month of months.slice(1)) {
    if (month === shiftMonth(previous, 1)) { previous = month; continue; }
    runs.push([start, previous]);
    start = previous = month;
  }
  runs.push([start, previous]);
  return runs.map(([a, b]) => (a === b ? a : `${a} → ${b} (${monthRange(a, b).length} months)`)).join(', ');
}

function loadDataset(dataDir, config) {
  const suppliedDir = path.join(dataDir, 'supplied');
  const prices = new Map();
  const conflicts = [];
  const assetIds = new Set(config.assets.map(asset => asset.id));

  // Existing screenshot-transcribed file (legacy schema).
  for (const row of readCsv(path.join(dataDir, 'market_prices_monthly.csv'))) {
    const month = monthOf(row.month);
    const price = Number(row.price_native);
    if (!row.asset || !month || !(price > 0)) continue;
    prices.set(`${row.asset}:${month}`, {
      price, currency: row.native_currency, date: null, partial: /^true$/i.test(row.is_partial_month || ''),
      source: row.source, file: 'market_prices_monthly.csv'
    });
  }
  // Owner-supplied monthly adjusted closes (new schema). Existing rows win; disagreements are reported.
  for (const row of readCsv(path.join(suppliedDir, 'prices_monthly.csv'))) {
    const month = monthOf(row.date);
    const price = Number(row.adj_close);
    if (!row.asset_id || !month || !(price > 0)) continue;
    const key = `${row.asset_id}:${month}`;
    const existing = prices.get(key);
    if (existing) {
      if (Math.abs(existing.price / price - 1) > 0.005) {
        conflicts.push(`${row.asset_id} ${month}: supplied ${price} vs existing ${existing.price}`);
      }
      continue;
    }
    prices.set(key, {
      price, currency: String(row.currency || '').toUpperCase(), date: /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : null,
      partial: false, source: row.source, file: 'supplied/prices_monthly.csv'
    });
  }

  const fx = new Map(readCsv(path.join(dataDir, 'usd_inr_month_end.csv'))
    .filter(row => monthOf(row.month) && Number(row.inr_per_usd) > 0)
    .map(row => [row.month, { rate: Number(row.inr_per_usd), date: row.observation_date }]));

  const inflation = new Map(readCsv(path.join(dataDir, 'india_inflation_annual.csv'))
    .filter(row => Number.isFinite(Number(row.india_cpi_inflation_percent)))
    .map(row => [Number(row.year), { year: Number(row.year), percent: Number(row.india_cpi_inflation_percent) }]));

  // Nifty 50 levels: supplied December closes, plus the two levels already in the scenario config.
  const nifty = new Map();
  for (const row of readCsv(path.join(suppliedDir, 'nifty50_december.csv'))) {
    const month = monthOf(row.date);
    if (month && Number(row.close) > 0) nifty.set(month, { level: Number(row.close), date: row.date, source: row.source });
  }
  const benchmark = config.benchmark || {};
  for (const [month, level] of [[benchmark.startMonth, benchmark.startLevel], [benchmark.endMonth, benchmark.endLevel]]) {
    if (month && Number(level) > 0 && !nifty.has(month)) nifty.set(month, { level: Number(level), date: null, source: 'scenario_config.json benchmark' });
  }

  const headlines = readCsv(path.join(suppliedDir, 'headlines.csv')).map(row => {
    const issues = [];
    const date = String(row.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) issues.push('date must be YYYY-MM-DD');
    if (!REGIONS.has(row.region)) issues.push(`region must be IN, US or GLOBAL (got "${row.region || ''}")`);
    if (!ROLES.has(row.round_role)) issues.push(`round_role must be clue or during (got "${row.round_role || ''}")`);
    if (!String(row.outlet || '').trim()) issues.push('missing outlet');
    if (!String(row.url || '').trim()) issues.push('missing url');
    if (!String(row.headline || '').trim()) issues.push('missing headline');
    const tags = String(row.asset_tags || '').split('|').map(tag => tag.trim()).filter(Boolean);
    const unknownTags = tags.filter(tag => !assetIds.has(tag));
    if (unknownTags.length) issues.push(`unknown asset_tags: ${unknownTags.join(', ')}`);
    return {
      id: row.id, date, region: row.region, outlet: String(row.outlet || '').trim(), headline: String(row.headline || '').trim(),
      url: String(row.url || '').trim(), roundRole: row.round_role, tags, summary: String(row.summary || '').trim(),
      issues, usable: issues.length === 0
    };
  });

  const adapter = {
    price: (asset, month) => prices.get(`${asset}:${month}`) || null,
    fx: month => fx.get(month) || null,
    inflation: year => inflation.get(Number(year)) || null,
    nifty: month => nifty.get(month) || null
  };

  // The close a decision is made at: the latest observation date we hold for that month.
  function decisionDate(month) {
    const dates = [fx.get(month)?.date];
    for (const asset of assetIds) dates.push(prices.get(`${asset}:${month}`)?.date);
    const known = dates.filter(Boolean).sort();
    return known.at(-1) || lastDayOfMonth(month);
  }

  return { prices, fx, inflation, nifty, headlines, conflicts, adapter, decisionDate };
}

function calendarRounds(startYear) {
  return [0, 1, 2, 3].map(index => ({
    id: `${startYear + index}`,
    round: index + 1,
    decisionMonth: `${startYear + index - 1}-12`,
    revealMonth: `${startYear + index}-12`,
    knownInflationYear: startYear + index - 2
  }));
}

function needsFx(dataset, assetId, months) {
  return months.some(month => dataset.prices.get(`${assetId}:${month}`)?.currency === 'USD');
}

// Which months an asset needs for a window, and which of them are missing.
function assetWindowCoverage(dataset, asset, rounds, { contiguous, priorYear }) {
  const first = rounds[0].decisionMonth;
  const last = rounds.at(-1).revealMonth;
  const boundaries = [first, ...rounds.map(round => round.revealMonth)];
  const needed = contiguous ? monthRange(priorYear ? shiftMonth(first, -12) : first, last) : boundaries;
  const missingPrices = needed.filter(month => !dataset.prices.has(`${asset.id}:${month}`));
  const partial = needed.filter(month => dataset.prices.get(`${asset.id}:${month}`)?.partial);
  const priorMissing = priorYear && !dataset.prices.has(`${asset.id}:${shiftMonth(first, -12)}`);
  const isUsd = asset.currency === 'USD' || needsFx(dataset, asset.id, needed);
  const missingFx = isUsd ? needed.filter(month => !dataset.fx.has(month)) : [];
  return { needed, missingPrices, partial, priorMissing, missingFx, ready: !missingPrices.length && !partial.length && !missingFx.length };
}

function decisionPoints(config) {
  const months = new Set(config.rounds.map(round => round.decisionMonth));
  const range = config.puzzle?.calendarStartYears;
  if (range) for (let year = range.from - 1; year <= range.to + 2; year += 1) months.add(`${year}-12`);
  return [...months].sort();
}

// Assign each clue to the decision point it was written for. A clue belongs to the
// decision point whose ~3-month lead-up window contains its date.
function assignClues(dataset, config) {
  const windowMonths = config.featureFlags?.clues?.windowMonths || 3;
  const points = decisionPoints(config).map(month => ({
    month,
    date: dataset.decisionDate(month),
    opensAfter: lastDayOfMonth(shiftMonth(month, -windowMonths))
  }));
  const byPoint = new Map(points.map(point => [point.month, []]));
  const issues = [];
  for (const headline of dataset.headlines.filter(item => item.roundRole === 'clue')) {
    if (!headline.usable) continue;
    const point = points.find(item => headline.date > item.opensAfter && headline.date.slice(0, 7) <= item.month);
    if (!point) {
      issues.push(`${headline.id}: clue dated ${headline.date} is not within ${windowMonths} months before any decision point`);
      continue;
    }
    if (headline.date > point.date) {
      issues.push(`${headline.id}: clue dated ${headline.date} is AFTER its decision point (${point.month} close on ${point.date})`);
      continue;
    }
    byPoint.get(point.month).push(headline);
  }
  return { byPoint, issues };
}

function cluesFor(clueIndex, month) {
  const list = clueIndex.byPoint.get(month) || [];
  return {
    india: list.filter(item => item.region === 'IN'),
    world: list.filter(item => item.region === 'US' || item.region === 'GLOBAL')
  };
}

function duringFor(dataset, round) {
  const opens = dataset.decisionDate(round.decisionMonth);
  const closes = dataset.decisionDate(round.revealMonth);
  return dataset.headlines.filter(item => item.usable && item.roundRole === 'during' && item.date > opens && item.date <= closes);
}

// Full readiness report for one window (a list of continuous rounds).
function windowReport(dataset, config, rounds, { contiguous, priorYear }) {
  const pool = config.assets.filter(asset => asset.id !== CASH_ID);
  const assets = pool.map(asset => ({ id: asset.id, ...assetWindowCoverage(dataset, asset, rounds, { contiguous, priorYear }) }));
  const boundaries = [rounds[0].decisionMonth, ...rounds.map(round => round.revealMonth)];
  const missingNifty = boundaries.filter(month => !dataset.nifty.has(month));
  const years = [];
  for (let year = Number(rounds[0].decisionMonth.slice(0, 4)) + 1; year <= Number(rounds.at(-1).revealMonth.slice(0, 4)); year += 1) years.push(year);
  const missingCpi = years.filter(year => !dataset.inflation.has(year));
  const clueIndex = assignClues(dataset, config);
  const clues = rounds.map(round => {
    const { india, world } = cluesFor(clueIndex, round.decisionMonth);
    return { round: round.round, month: round.decisionMonth, india: india.length, world: world.length, ready: india.length >= 1 && world.length >= 1 };
  });
  const during = rounds.map(round => ({ round: round.round, count: duringFor(dataset, round).length }));
  const readyAssets = assets.filter(asset => asset.ready).map(asset => asset.id);
  const minAssets = config.puzzle?.assetsPerPuzzle?.min || 4;
  return {
    rounds,
    assets,
    readyAssets,
    pricesReady: readyAssets.length >= Math.min(minAssets, pool.length),
    missingNifty,
    roundNiftyReady: !missingNifty.length,
    overallNiftyReady: dataset.nifty.has(boundaries[0]) && dataset.nifty.has(boundaries.at(-1)),
    missingCpi,
    clues,
    cluesReady: clues.every(item => item.ready),
    during
  };
}

function startYearReports(dataset, config) {
  const range = config.puzzle?.calendarStartYears;
  if (!range) return [];
  const reports = [];
  for (let year = range.from; year <= range.to; year += 1) {
    const report = windowReport(dataset, config, calendarRounds(year), { contiguous: true, priorYear: true });
    report.startYear = year;
    report.playable = report.pricesReady && !report.missingCpi.length;
    reports.push(report);
  }
  return reports;
}

function legacyReport(dataset, config) {
  return windowReport(dataset, config, config.rounds, { contiguous: false, priorYear: false });
}

// Gaps inside each asset's own price history (first → last month on file).
function priceGaps(dataset, config) {
  return config.assets.filter(asset => asset.id !== CASH_ID).map(asset => {
    const months = [...dataset.prices.keys()].filter(key => key.startsWith(`${asset.id}:`)).map(key => key.split(':')[1]).sort();
    if (!months.length) return { id: asset.id, first: null, last: null, gaps: [] };
    const held = new Set(months);
    return { id: asset.id, first: months[0], last: months.at(-1), gaps: monthRange(months[0], months.at(-1)).filter(month => !held.has(month)) };
  });
}

module.exports = {
  CASH_ID,
  loadDataset,
  calendarRounds,
  windowReport,
  startYearReports,
  legacyReport,
  assignClues,
  cluesFor,
  duringFor,
  priceGaps,
  describeMonths,
  monthRange,
  shiftMonth,
  lastDayOfMonth
};
