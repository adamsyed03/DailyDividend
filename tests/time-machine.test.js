'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  validateAllocations, validateRounds, grossReturn, buyPositions, valueAt, publicRound,
  createSession, lockRound, decisionState, completeGame, finalSummary
} = require('../indian-time-machine/engine');
const { splitRupees } = require('../public/time-machine/rupee-split');
const { parseCsv, rowsToObjects, toCsv } = require('../indian-time-machine/csv');
const { loadDataset, startYearReports, legacyReport, assignClues, duringFor } = require('../indian-time-machine/dataset');
const {
  istDateKey, puzzleNumber, buildPuzzle, puzzleConfig, publicPuzzle, legalSplits, hindsightMax, titleFor
} = require('../indian-time-machine/puzzle');

const DATA_DIR = path.join(__dirname, '..', 'data', 'indian-time-machine');
const config = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scenario_config.json'), 'utf8'));
const dataset = loadDataset(DATA_DIR, config);
const realData = dataset.adapter;

// Fixture data: every asset grows 10% per checkpoint, USD/INR moves.
const points = new Map();
for (const asset of config.assets) {
  if (asset.id === 'CASH_INR') continue;
  for (const [month, price] of Object.entries({
    '2021-12': 100, '2022-06': 100, '2022-12': 110, '2023-06': 121, '2023-12': 133.1, '2024-06': 146.41, '2024-12': 161.051
  })) points.set(`${asset.id}:${month}`, { price, currency: asset.currency });
}
const fx = new Map(Object.entries({ '2021-12': 74, '2022-06': 80, '2022-12': 84, '2023-06': 82, '2023-12': 83, '2024-06': 84, '2024-12': 86 })
  .map(([month, rate]) => [month, { rate }]));
const fixtureData = {
  price: (asset, month) => points.get(`${asset}:${month}`),
  fx: month => fx.get(month),
  inflation: year => ({ year, percent: 5 })
};

const sum = values => values.reduce((total, value) => total + value, 0);
const chips = (rel, hdfc, aapl, gold, cash) => ({ 'RELIANCE.NS': rel, 'HDFCBANK.NS': hdfc, AAPL: aapl, GOLD_UNVERIFIED: gold, CASH_INR: cash });
const dailyPuzzle = buildPuzzle(dataset, config, { mode: 'daily', dateKey: '2026-11-08', seed: 'daily:2026-11-08' });
const pconfig = puzzleConfig(config, dailyPuzzle);

// Plays a full game. moves[i] is null to hold, or an allocation to reshuffle.
function playStory(data, cfg, opening, moves) {
  const session = createSession(cfg, 'daily', dailyPuzzle);
  const screens = [];
  let outcome = lockRound(data, cfg, session, opening);
  for (let round = 1; round <= cfg.rounds.length; round += 1) {
    const next = decisionState(data, cfg, session);
    screens.push({ round, outcome, next });
    if (outcome.isFinal) break;
    const move = moves[round - 1];
    outcome = move ? lockRound(data, cfg, session, move, { rebalance: true }) : lockRound(data, cfg, session, null, { rebalance: false });
  }
  return { session, screens, final: completeGame(data, cfg, session) };
}

test('requires exactly ten integer chips and caps each asset at four', () => {
  const valid = chips(2, 2, 2, 2, 2);
  assert.deepEqual(validateAllocations(valid, config), valid);
  assert.throws(() => validateAllocations({ ...valid, AAPL: 5, CASH_INR: -1 }, config), /more than 4|non-negative/);
  assert.throws(() => validateAllocations({ ...valid, AAPL: 1 }, config), /exactly 10/);
});

test('converts a USD asset return into INR with both price and FX ratios; cash is 0% nominal', () => {
  assert.equal(grossReturn(fixtureData, 'AAPL', '2022-06', '2022-12'), (110 * 84) / (100 * 80));
  assert.equal(grossReturn(fixtureData, 'RELIANCE.NS', '2022-06', '2022-12'), 1.1);
  assert.equal(grossReturn(fixtureData, 'CASH_INR', '2022-06', '2022-12'), 1);
});

test('the shipped rounds are continuous and a gap or passive hold is rejected', () => {
  assert.equal(validateRounds(config), true);
  const gapped = structuredClone(config);
  gapped.rounds[2].decisionMonth = '2024-01';
  assert.throws(() => validateRounds(gapped), /continuous/);
  const passive = structuredClone(config);
  passive.rounds[1].passiveHold = { startMonth: '2023-06', endMonth: '2023-12' };
  assert.throws(() => validateRounds(passive), /passive hold/);
});

test('rupee split: stakes are whole rupees that sum exactly to the total', () => {
  for (const total of [1_000_000, 1_046_489, 1_229_227, 999_999, 1_337_938]) {
    for (const allocation of [chips(4, 2, 2, 2, 0), chips(2, 4, 2, 2, 0), chips(3, 3, 3, 1, 0), chips(1, 2, 3, 4, 0), chips(2, 2, 2, 2, 2)]) {
      const stakes = splitRupees(total, allocation, 10);
      assert.equal(sum(Object.values(stakes)), total);
      Object.entries(stakes).forEach(([id, stake]) => {
        assert.ok(Number.isInteger(stake));
        assert.ok(Math.abs(stake - total * allocation[id] / 10) < 1);
      });
    }
  }
});

test('valueAt: positions bought at a month are worth exactly the stake that month', () => {
  const positions = buyPositions(realData, config, 1_046_489, chips(2, 4, 2, 2, 0), '2022-12');
  const atBuy = valueAt(realData, config, positions, '2022-12');
  assert.equal(atBuy.total, 1_046_489);
  assert.equal(sum(Object.values(atBuy.values)), atBuy.total);
});

for (const [name, opening, moves] of [
  ['hold every round', chips(2, 2, 2, 2, 2), [null, null, null]],
  ['reshuffle every round', chips(4, 2, 2, 2, 0), [chips(2, 4, 2, 2, 0), chips(1, 1, 4, 4, 0), chips(0, 3, 3, 4, 0)]],
  ['mixed hold and reshuffle', chips(4, 4, 1, 1, 0), [null, chips(2, 2, 2, 2, 2), null]]
]) {
  test(`continuity with real data (${name}): close of round N = open of round N+1, positions sum to totals`, () => {
    const { screens, final } = playStory(realData, pconfig, opening, moves);
    assert.equal(screens.length, 4);
    screens.forEach(({ outcome, next }, index) => {
      const { reveal } = outcome;
      assert.equal(sum(reveal.assets.map(asset => asset.endValue)), reveal.endWealth);
      assert.equal(sum(reveal.assets.map(asset => asset.startValue)), reveal.startWealth);
      if (index === 0) assert.equal(reveal.startWealth, 1_000_000);
      if (next) {
        assert.equal(next.current.wealth, reveal.endWealth);
        assert.equal(sum(next.portfolio.map(asset => asset.value)), reveal.endWealth);
        next.portfolio.forEach(asset => assert.equal(asset.value, reveal.holdings[asset.id]));
        assert.equal(screens[index + 1].outcome.reveal.startWealth, reveal.endWealth);
      }
    });
    assert.equal(final.finalWealth, screens.at(-1).outcome.reveal.endWealth);
    assert.deepEqual(final.chartPoints, [1_000_000, ...screens.map(screen => screen.outcome.reveal.endWealth)]);
  });
}

test('reshuffle sells at the closing value and buys 10 equal chips of close / 10', () => {
  const { screens } = playStory(realData, pconfig, chips(4, 2, 2, 2, 0), [chips(2, 4, 2, 2, 0), null, null]);
  const close1 = screens[0].outcome.reveal.endWealth;
  const round2 = screens[1].outcome.reveal;
  assert.equal(round2.strategy, 'reshuffled');
  round2.assets.forEach(asset => assert.ok(Math.abs(asset.startValue - close1 * asset.chips / 10) < 1));
});

test('replaying the same puzzle with the same choices gives an identical result', () => {
  const moves = [chips(2, 4, 2, 2, 0), null, chips(3, 3, 2, 2, 0)];
  const strip = run => ({ reveals: run.screens.map(screen => screen.outcome.reveal), final: run.final });
  assert.deepEqual(strip(playStory(realData, pconfig, chips(4, 2, 2, 2, 0), moves)), strip(playStory(realData, pconfig, chips(4, 2, 2, 2, 0), moves)));
  const again = buildPuzzle(dataset, config, { mode: 'daily', dateKey: '2026-11-08', seed: 'daily:2026-11-08' });
  assert.deepEqual(again, dailyPuzzle);
});

test('REGRESSION: the reported ₹48k jump between round 2 result and round 3 start is gone', () => {
  const { screens, final } = playStory(realData, pconfig, chips(4, 2, 2, 2, 0), [chips(2, 4, 2, 2, 0), null, null]);
  const [round1, round2, round3] = screens;
  assert.equal(round1.outcome.reveal.endWealth, 1_046_489);
  assert.equal(round1.next.current.wealth, 1_046_489);
  // Before the fix: result screen ₹11,80,930, next screen ₹12,29,227 (Jun→Dec 2023 applied silently).
  assert.equal(round2.outcome.reveal.endWealth, 1_229_227);
  assert.equal(round2.next.current.wealth, 1_229_227);
  assert.deepEqual(
    Object.fromEntries(round2.next.portfolio.filter(asset => asset.value).map(asset => [asset.name, asset.value])),
    { Reliance: 230_930, 'HDFC Bank': 444_482, Apple: 313_645, Gold: 240_170 }
  );
  assert.equal(round3.outcome.reveal.startWealth, 1_229_227);
  assert.equal(round3.outcome.reveal.endWealth, 1_337_938);
  assert.deepEqual(final.chartPoints.slice(0, 4), [1_000_000, 1_046_489, 1_229_227, 1_337_938]);
});

test('cash is held at 0% nominal during rounds; inflation only shows in the final real-value line', () => {
  const { screens, final } = playStory(realData, pconfig, chips(2, 2, 2, 2, 2), [null, null, null]);
  for (const { outcome } of screens) {
    const cash = outcome.reveal.assets.find(asset => asset.id === 'CASH_INR');
    assert.equal(cash.returnPercent, 0);
    assert.equal(cash.endValue, 200_000);
  }
  assert.ok(final.cashRealWealth < 1_000_000);
  assert.equal(final.cashPurchasingPowerLoss, 1_000_000 - final.cashRealWealth);
});

test('the round view never carries dates or raw prices', () => {
  const view = publicRound(realData, pconfig, pconfig.rounds[1], 1_000_000);
  const serialized = JSON.stringify(view);
  assert.ok(!/20[0-2]\d/.test(serialized));
  assert.ok(!/"\w*(price|Price|Month)"\s*:/.test(serialized));
  assert.ok(/"\w*(price|Price|Month)"\s*:/.test('{"startPrice":1}'), 'guard: the key pattern really matches price keys');
  assert.equal(view.assets.find(asset => asset.id === 'CASH_INR').trailing.percent, 0);
  assert.equal(view.assets.find(asset => asset.id === 'RELIANCE.NS').trailing.months, 12);
  // Round 1 (Jun 2022) has no stock price a year earlier, so it falls back to six months and says so.
  assert.equal(publicRound(realData, pconfig, pconfig.rounds[0], 1_000_000).assets.find(asset => asset.id === 'RELIANCE.NS').trailing.months, 6);
});

test('stages: a round locks once, and the game finishes only after the last round', () => {
  const session = createSession(pconfig, 'daily', dailyPuzzle);
  lockRound(realData, pconfig, session, chips(2, 2, 2, 2, 2));
  assert.equal(session.stage, 'decision');
  assert.throws(() => completeGame(realData, pconfig, session), /not ready/);
  for (let round = 2; round <= 4; round += 1) lockRound(realData, pconfig, session, null, { rebalance: false });
  assert.equal(session.stage, 'final-pending');
  assert.throws(() => lockRound(realData, pconfig, session, null, { rebalance: false }), /stage/);
  completeGame(realData, pconfig, session);
  assert.equal(session.completed, true);
});

test('Nifty comparison covers the window played; the per-round Nifty is withheld when boundaries are missing', () => {
  const { screens, final } = playStory(realData, pconfig, chips(2, 2, 2, 2, 2), [null, null, null]);
  assert.equal(final.nifty50StartLevel, 15780.25);
  assert.equal(final.nifty50EndLevel, 23644.8);
  assert.equal(final.nifty50Wealth, 1_498_379);
  assert.equal(screens[0].outcome.reveal.niftyReturnPercent, null);
  const summary = finalSummary(fixtureData, { ...pconfig, benchmark: {} }, playStory(fixtureData, pconfig, chips(2, 2, 2, 2, 2), [null, null, null]).session);
  assert.equal(summary.nifty50Wealth, null);
});

test('daily puzzles: IST date key, numbering, seeded asset subset plus cash', () => {
  assert.equal(istDateKey(new Date('2026-11-08T18:29:00Z')), '2026-11-08');
  assert.equal(istDateKey(new Date('2026-11-08T18:31:00Z')), '2026-11-09');
  assert.equal(puzzleNumber(config, config.puzzleEpochIst), 1);
  assert.equal(puzzleNumber(config, '2026-11-20'), 13);
  assert.equal(dailyPuzzle.number, 1);
  assert.equal(dailyPuzzle.assetIds.at(-1), 'CASH_INR');
  assert.ok(dailyPuzzle.assetIds.length - 1 >= 4 && dailyPuzzle.assetIds.length - 1 <= 5);
  const unlimited = buildPuzzle(dataset, config, { mode: 'unlimited', dateKey: '2026-11-08', seed: 'unlimited:abc' });
  assert.equal(unlimited.number, null);
});

test('asset pool of N: puzzles draw 4–5 assets with full data, seeded by date', () => {
  const bigPool = structuredClone(config);
  const extras = ['X1', 'X2', 'X3'].map(id => ({ ...config.assets[0], id, shortName: id, name: id }));
  bigPool.assets = [...config.assets.slice(0, -1), ...extras, config.assets.at(-1)];
  const prices = new Map(dataset.prices);
  for (const id of ['X1', 'X2']) for (const [key, value] of dataset.prices) if (key.startsWith('RELIANCE.NS:')) prices.set(`${id}:${key.split(':')[1]}`, value);
  const big = { ...dataset, prices };
  const seen = new Set();
  for (let day = 1; day <= 20; day += 1) {
    const dateKey = `2026-12-${String(day).padStart(2, '0')}`;
    const puzzle = buildPuzzle(big, bigPool, { mode: 'daily', dateKey, seed: `daily:${dateKey}` });
    const risky = puzzle.assetIds.filter(id => id !== 'CASH_INR');
    assert.ok(risky.length >= 4 && risky.length <= 5);
    assert.ok(!risky.includes('X3'), 'X3 has no prices, so it must never be drawn');
    seen.add(risky.join(','));
  }
  assert.ok(seen.size > 1, 'different days should draw different subsets');
});

test('feature flags with the current data: no hidden years, no clues, no per-round Nifty; titles on', () => {
  assert.deepEqual(dailyPuzzle.flags, { hiddenYears: false, clues: false, roundNifty: false, niftyTitles: true });
  const shown = publicPuzzle(dailyPuzzle);
  assert.deepEqual(shown.periods, ['Jul–Dec 2022', '2023', 'Jan–Jun 2024', 'Jul–Dec 2024']);
  assert.equal(shown.yearGuessOptions, null);
  const off = structuredClone(config);
  off.featureFlags.niftyTitles.enabled = false;
  assert.equal(buildPuzzle(dataset, off, { mode: 'daily', dateKey: '2026-11-08', seed: 'x' }).flags.niftyTitles, false);
});

test('every shipped headline is sourced, and flagged headlines are never used', () => {
  assert.deepEqual(dataset.headlines.filter(item => !item.usable).map(item => item.id), []);
  for (const item of dataset.headlines) {
    assert.ok(item.outlet && /^https:\/\//.test(item.url), `${item.id} needs an outlet and https url`);
  }
  // The two unsourced rows were removed / replaced by the owner.
  assert.ok(!dataset.headlines.some(item => /^(Gold Hits Record High|Indian Inflation Falls to 4\.25%)$/.test(item.headline)));
  // Every round in the current window has a Chronicle.
  for (const round of config.rounds) assert.ok(duringFor(dataset, round).length >= 4, `round ${round.round} Chronicle`);
  // An unsourced row is excluded from play.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-headlines-'));
  for (const file of ['market_prices_monthly.csv', 'usd_inr_month_end.csv', 'india_inflation_annual.csv']) fs.copyFileSync(path.join(DATA_DIR, file), path.join(dir, file));
  fs.mkdirSync(path.join(dir, 'supplied'));
  fs.writeFileSync(path.join(dir, 'supplied', 'headlines.csv'), toCsv(['id', 'date', 'region', 'outlet', 'headline', 'url', 'round_role', 'asset_tags', 'summary'], [['x', '2022-09-01', 'IN', '', 'Unsourced test row', '', 'during', '', '']]));
  const test = loadDataset(dir, config);
  assert.equal(test.headlines[0].usable, false);
  assert.deepEqual(duringFor(test, config.rounds[0]), []);
  for (const id of dailyPuzzle.rounds.map(round => round.duringId).filter(Boolean)) assert.ok(dataset.headlines.find(item => item.id === id).usable);
});

test('hindsight max is the true optimum under the rules and replays through valueAt', () => {
  const best = hindsightMax(realData, pconfig);
  assert.equal(best.chartPoints[0], 1_000_000);
  assert.equal(best.chartPoints.at(-1), best.finalWealth);
  assert.equal(legalSplits(5, 10, 4).length, legalSplits(5, 10, 4).filter(split => sum(split) === 10 && Math.max(...split) <= 4).length);
  // No sampled strategy may beat it.
  const ids = pconfig.assets.map(asset => asset.id);
  const splits = legalSplits(ids.length, 10, 4).map(split => Object.fromEntries(ids.map((id, index) => [id, split[index]])));
  for (let index = 0; index < splits.length; index += 7) {
    const moves = [splits[(index * 3) % splits.length], null, splits[(index * 5) % splits.length]];
    assert.ok(playStory(realData, pconfig, splits[index], moves).final.finalWealth <= best.finalWealth);
  }
});

test('titles follow the configured tiers relative to the Nifty', () => {
  const nifty = 1_000_000;
  assert.equal(titleFor(config, 750_000, nifty).name, 'Paper Hands');
  assert.equal(titleFor(config, 900_000, nifty).name, 'FD Loyalist');
  assert.equal(titleFor(config, 1_000_000, nifty).name, 'Index Hugger');
  assert.equal(titleFor(config, 1_100_000, nifty).name, 'Smart Money');
  assert.equal(titleFor(config, 1_300_000, nifty).name, 'Dalal Street Sher');
  assert.equal(titleFor(config, 1_400_000, nifty).name, 'Market Wizard');
  assert.equal(titleFor(config, 1_399_999, nifty).name, 'Dalal Street Sher');
  assert.equal(titleFor(config, 1_000_000, null), null);
});

test('validator: supplied data turns on hidden years and clues, and catches a clue dated after its decision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-game-'));
  for (const file of ['market_prices_monthly.csv', 'usd_inr_month_end.csv', 'india_inflation_annual.csv']) fs.copyFileSync(path.join(DATA_DIR, file), path.join(dir, file));
  fs.mkdirSync(path.join(dir, 'supplied'));
  // Synthetic test-only rows (never shipped): flat prices for 2007-12 → 2021-11.
  const rows = [];
  for (const asset of config.assets.filter(item => item.id !== 'CASH_INR')) {
    for (let year = 2007; year <= 2021; year += 1) for (let month = year === 2007 ? 12 : 1; month <= 12; month += 1) {
      if (year === 2021 && month === 12) continue;
      rows.push([asset.id, `${year}-${String(month).padStart(2, '0')}`, 100, asset.currency, 'test fixture']);
    }
  }
  fs.writeFileSync(path.join(dir, 'supplied', 'prices_monthly.csv'), toCsv(['asset_id', 'date', 'adj_close', 'currency', 'source'], rows));
  fs.writeFileSync(path.join(dir, 'supplied', 'nifty50_december.csv'), toCsv(['date', 'close', 'source'], [2008, 2009, 2010, 2011, 2012, 2013].map(year => [`${year}-12-31`, 100, 'test fixture'])));
  const clue = (id, date, region) => [id, date, region, 'Test Wire', `Test ${id}`, 'https://example.test', 'clue', '', ''];
  const headlines = [];
  for (const year of [2008, 2009, 2010, 2011]) headlines.push(clue(`in-${year}`, `${year}-11-10`, 'IN'), clue(`us-${year}`, `${year}-11-12`, 'US'));
  headlines.push(clue('late', '2011-12-31', 'GLOBAL'));
  fs.writeFileSync(path.join(dir, 'supplied', 'headlines.csv'), toCsv(['id', 'date', 'region', 'outlet', 'headline', 'url', 'round_role', 'asset_tags', 'summary'], headlines));
  const test = loadDataset(dir, config);
  const reports = startYearReports(test, config);
  const playable = reports.filter(report => report.playable).map(report => report.startYear);
  assert.deepEqual(playable, [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022]);
  const y2009 = reports.find(report => report.startYear === 2009);
  assert.equal(y2009.cluesReady, true);
  assert.equal(y2009.roundNiftyReady, true);
  assert.equal(reports.find(report => report.startYear === 2010).cluesReady, false);
  assert.ok(assignClues(test, config).issues.some(issue => issue.startsWith('late:') && /AFTER its decision point/.test(issue)));
  const puzzle = buildPuzzle(test, config, { mode: 'daily', dateKey: '2026-11-08', seed: 'daily:2026-11-08' });
  assert.equal(puzzle.flags.hiddenYears, true);
  assert.equal(publicPuzzle(puzzle).periods, null);
  assert.ok(puzzle.yearGuess.options.includes(puzzle.startYear));
  assert.equal(puzzle.yearGuess.options.length, 4);
  // Gap detection: drop one month and the year that needs it stops being playable.
  fs.writeFileSync(path.join(dir, 'supplied', 'prices_monthly.csv'), toCsv(['asset_id', 'date', 'adj_close', 'currency', 'source'], rows.filter(row => !(row[0] === 'AAPL' && row[1] === '2015-06'))));
  const gapped = startYearReports(loadDataset(dir, config), config).find(report => report.startYear === 2015);
  assert.deepEqual(gapped.assets.find(asset => asset.id === 'AAPL').missingPrices, ['2015-06']);
  assert.equal(legacyReport(test, config).pricesReady, true);
});

test('the source CSV contains the real supplied checkpoint values', () => {
  const rows = rowsToObjects(parseCsv(fs.readFileSync(path.join(DATA_DIR, 'market_prices_monthly.csv'), 'utf8')));
  assert.equal(rows.length, 250);
  assert.equal(Number(rows.find(row => row.asset === 'RELIANCE.NS' && row.month === '2022-06').price_native), 1175.62);
  assert.equal(Number(rows.find(row => row.asset === 'AAPL' && row.month === '2024-12').price_native), 248.62);
});

test('two real checkpoint calculations match independent arithmetic', () => {
  assert.ok(Math.abs(grossReturn(realData, 'RELIANCE.NS', '2022-06', '2022-12') - (1157.44 / 1175.62)) < 1e-12);
  assert.ok(Math.abs(grossReturn(realData, 'AAPL', '2022-06', '2022-12') - ((127.65 / 133.91) * (82.72 / 79.02))) < 1e-12);
});

test('FRED import covers every month Dec 2007 → Dec 2025 with the final trading-day observation', () => {
  const fxRows = rowsToObjects(parseCsv(fs.readFileSync(path.join(DATA_DIR, 'usd_inr_month_end.csv'), 'utf8')));
  assert.equal(fxRows[0].month, '2007-12');
  assert.equal(fxRows.at(-1).month, '2025-12');
  assert.equal(fxRows.length, 217);
  for (const [month, expectedDate] of Object.entries({ '2022-06': '2022-06-30', '2022-12': '2022-12-30', '2023-12': '2023-12-29', '2024-06': '2024-06-28', '2024-12': '2024-12-31' })) {
    const row = fxRows.find(item => item.month === month);
    assert.equal(row.observation_date, expectedDate);
    assert.equal(row.series, 'DEXINUS');
  }
});
