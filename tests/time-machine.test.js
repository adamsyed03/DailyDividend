'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  validateAllocations,
  grossReturn,
  applyAllocation,
  applyPassiveHold,
  publicRound,
  createSession,
  lockRound,
  finishNewspaper,
  finalSummary
} = require('../indian-time-machine/engine');
const { parseCsv, rowsToObjects } = require('../indian-time-machine/csv');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'indian-time-machine', 'scenario_config.json'), 'utf8'));
config.news = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'indian-time-machine', 'news.json'), 'utf8'));
const points = new Map();
for (const asset of config.assets) {
  if (asset.id === 'CASH_INR') continue;
  for (const [month, price] of Object.entries({
    '2021-12': 100, '2022-06': 100, '2022-12': 110, '2023-06': 121,
    '2023-12': 133.1, '2024-06': 146.41, '2024-12': 161.051
  })) points.set(`${asset.id}:${month}`, { price, currency: asset.currency, basis: 'fixture' });
}
const fx = new Map(Object.entries({
  '2021-12': 74, '2022-06': 80, '2022-12': 84, '2023-06': 82,
  '2023-12': 83, '2024-06': 84, '2024-12': 86
}).map(([month, rate]) => [month, { rate }]));
const fixtureData = {
  price: (asset, month) => points.get(`${asset}:${month}`),
  fx: month => fx.get(month),
  inflation: year => ({ year, percent: 5 })
};

test('requires exactly ten integer chips and caps each asset at four', () => {
  const valid = { 'RELIANCE.NS': 2, 'HDFCBANK.NS': 2, AAPL: 2, GOLD_UNVERIFIED: 2, CASH_INR: 2 };
  assert.deepEqual(validateAllocations(valid, config), valid);
  assert.throws(() => validateAllocations({ ...valid, AAPL: 5, CASH_INR: -1 }, config), /more than 4|non-negative/);
  assert.throws(() => validateAllocations({ ...valid, AAPL: 1 }, config), /exactly 10/);
});

test('converts a USD asset return into INR with both price and FX ratios', () => {
  const actual = grossReturn(fixtureData, 'AAPL', '2022-06', '2022-12');
  assert.equal(actual, (110 / 100) * (84 / 80));
  assert.equal(grossReturn(fixtureData, 'RELIANCE.NS', '2022-06', '2022-12'), 1.1);
  assert.ok(Math.abs(grossReturn(fixtureData, 'CASH_INR', '2022-06', '2022-12') - (1 / Math.sqrt(1.05))) < 1e-12);
});

test('allocates by portfolio value and conserves wealth at rebalance', () => {
  const allocations = { 'RELIANCE.NS': 2, 'HDFCBANK.NS': 2, AAPL: 2, GOLD_UNVERIFIED: 2, CASH_INR: 2 };
  const result = applyAllocation(fixtureData, config, 1_000_000, allocations, '2022-06', '2022-12');
  assert.equal(result.assets.reduce((sum, asset) => sum + asset.startValue, 0), 1_000_000);
  assert.equal(result.assets.find(asset => asset.id === 'CASH_INR').endValue, 195_180.01);
});

test('passive 2023 H2 hold preserves positions instead of resetting chip weights', () => {
  const holdings = { 'RELIANCE.NS': 400_000, 'HDFCBANK.NS': 100_000, AAPL: 300_000, GOLD_UNVERIFIED: 0, CASH_INR: 200_000 };
  const result = applyPassiveHold(fixtureData, config, holdings, '2023-06', '2023-12');
  assert.equal(result.assets.find(asset => asset.id === 'GOLD_UNVERIFIED').startValue, 0);
  assert.equal(result.assets.find(asset => asset.id === 'RELIANCE.NS').startValue, 400_000);
  assert.equal(result.assets.find(asset => asset.id === 'CASH_INR').endValue, 195_180.01);
});

test('public pre-lock state contains only the decision price and trailing return', () => {
  const state = publicRound(fixtureData, config, config.rounds[0], 1_000_000);
  const serialized = JSON.stringify(state);
  assert.equal(state.label, 'Year 1');
  assert.ok(!/20(1|2)\d/.test(serialized));
  assert.ok(!serialized.includes('decisionMonth'));
  assert.ok(!serialized.includes('dateLine'));
  assert.ok(!serialized.includes('endPrice'));
  assert.ok(!serialized.includes('returnPercent'));
  assert.equal(state.assets.length, 5);
  assert.ok(!state.assets.some(asset => asset.id === 'INFLATION'));
});

test('locks a round once and prevents replay tampering', () => {
  const session = createSession(config, 'daily', '2026-11-07');
  const allocations = { 'RELIANCE.NS': 2, 'HDFCBANK.NS': 2, AAPL: 2, GOLD_UNVERIFIED: 2, CASH_INR: 2 };
  const result = lockRound(fixtureData, config, session, allocations);
  assert.equal(result.isFinal, true);
  assert.equal(session.stage, 'newspaper');
  assert.equal(result.newspaper.stories.length >= 3, true);
  assert.throws(() => lockRound(fixtureData, config, session, allocations), /stage/);
});

test('continuing unchanged preserves drifted holdings without a rebalance', () => {
  const session = createSession(config, 'story', '2026-11-07');
  const allocations = { 'RELIANCE.NS': 2, 'HDFCBANK.NS': 2, AAPL: 2, GOLD_UNVERIFIED: 2, CASH_INR: 2 };
  lockRound(fixtureData, config, session, allocations);
  finishNewspaper(fixtureData, config, session);
  const holdingsBefore = { ...session.holdings };
  const outcome = lockRound(fixtureData, config, session, null, { rebalance: false });
  for (const asset of outcome.reveal.assets) {
    assert.equal(asset.startValue, Math.round(holdingsBefore[asset.id] * 100) / 100);
  }
  assert.equal(outcome.reveal.strategy, 'continued');
  assert.equal(session.history.at(-2).type, 'hold');
});

test('optional reshuffle preserves total wealth while applying new chip targets', () => {
  const session = createSession(config, 'story', '2026-11-07');
  const equal = { 'RELIANCE.NS': 2, 'HDFCBANK.NS': 2, AAPL: 2, GOLD_UNVERIFIED: 2, CASH_INR: 2 };
  lockRound(fixtureData, config, session, equal);
  finishNewspaper(fixtureData, config, session);
  const wealthBefore = session.wealth;
  const reshuffle = { 'RELIANCE.NS': 4, 'HDFCBANK.NS': 3, AAPL: 1, GOLD_UNVERIFIED: 1, CASH_INR: 1 };
  const outcome = lockRound(fixtureData, config, session, reshuffle, { rebalance: true });
  assert.ok(Math.abs(outcome.reveal.assets.reduce((sum, asset) => sum + asset.startValue, 0) - wealthBefore) <= 0.02);
  assert.equal(outcome.reveal.assets.find(asset => asset.id === 'RELIANCE.NS').startValue, Math.round(wealthBefore * 0.4 * 100) / 100);
  assert.equal(outcome.reveal.strategy, 'reshuffled');
});

test('every year has a newspaper and Year 4 completes only after its newspaper', () => {
  for (const year of ['1', '2', '3', '4']) assert.ok(config.news[year].length >= 3);
  const session = createSession(config, 'story', '2026-11-07');
  const equal = { 'RELIANCE.NS': 2, 'HDFCBANK.NS': 2, AAPL: 2, GOLD_UNVERIFIED: 2, CASH_INR: 2 };
  let outcome = lockRound(fixtureData, config, session, equal);
  for (let year = 1; year <= 4; year += 1) {
    assert.equal(session.stage, 'newspaper');
    assert.equal(outcome.newspaper.label, `What Just Happened in Year ${year}`);
    assert.ok(outcome.newspaper.stories.length >= 3);
    const next = finishNewspaper(fixtureData, config, session);
    if (year === 4) {
      assert.equal(next.completed, true);
      assert.equal(session.completed, true);
    } else {
      assert.equal(next.stage, 'decision');
      outcome = lockRound(fixtureData, config, session, null, { rebalance: false });
    }
  }
  const summary = finalSummary(fixtureData, config, session);
  assert.deepEqual(summary.history.map(item => item.label), ['Year 1', 'Year 2', 'Year 3', 'Year 4']);
  assert.equal(summary.history[1].endWealth, session.history.find(item => item.label === 'Year 2').endWealth);
  assert.deepEqual(summary.inflationContext, [{ label: 'Average CPI', percent: 5 }]);
  assert.equal(summary.nifty50StartLevel, 15780.25);
  assert.equal(summary.nifty50EndLevel, 23644.8);
  assert.equal(summary.nifty50Wealth, 1_498_380);
  assert.ok(Math.abs(summary.nifty50ReturnPercent - 49.838) < 0.01);
  assert.ok(summary.cashRealWealth < 1_000_000);
});

test('the source CSV contains the real supplied checkpoint values', () => {
  const file = fs.readFileSync(path.join(__dirname, '..', 'data', 'indian-time-machine', 'market_prices_monthly.csv'), 'utf8');
  const rows = rowsToObjects(parseCsv(file));
  assert.equal(rows.length, 250);
  const relianceJune2022 = rows.find(row => row.asset === 'RELIANCE.NS' && row.month === '2022-06');
  const appleDecember2024 = rows.find(row => row.asset === 'AAPL' && row.month === '2024-12');
  assert.equal(Number(relianceJune2022.price_native), 1175.62);
  assert.equal(Number(appleDecember2024.price_native), 248.62);
});

test('two real checkpoint calculations match independent arithmetic', () => {
  const priceRows = rowsToObjects(parseCsv(fs.readFileSync(path.join(__dirname, '..', 'data', 'indian-time-machine', 'market_prices_monthly.csv'), 'utf8')));
  const fxRows = rowsToObjects(parseCsv(fs.readFileSync(path.join(__dirname, '..', 'data', 'indian-time-machine', 'usd_inr_month_end.csv'), 'utf8')));
  const realData = {
    price(asset, month) {
      const row = priceRows.find(item => item.asset === asset && item.month === month);
      return row ? { price: Number(row.price_native), currency: row.native_currency, basis: row.price_basis } : null;
    },
    fx(month) {
      const row = fxRows.find(item => item.month === month);
      return row ? { rate: Number(row.inr_per_usd), date: row.observation_date } : null;
    },
    inflation: () => null
  };
  const reliance = grossReturn(realData, 'RELIANCE.NS', '2022-06', '2022-12');
  const apple = grossReturn(realData, 'AAPL', '2022-06', '2022-12');
  assert.ok(Math.abs(reliance - (1157.44 / 1175.62)) < 1e-12);
  assert.ok(Math.abs(apple - ((127.65 / 133.91) * (82.72 / 79.02))) < 1e-12);
});

test('FRED import selects the final valid trading-day observation in each required month', () => {
  const fxRows = rowsToObjects(parseCsv(fs.readFileSync(path.join(__dirname, '..', 'data', 'indian-time-machine', 'usd_inr_month_end.csv'), 'utf8')));
  const required = {
    '2022-06': '2022-06-30',
    '2022-12': '2022-12-30',
    '2023-06': '2023-06-30',
    '2023-12': '2023-12-29',
    '2024-06': '2024-06-28',
    '2024-12': '2024-12-31'
  };
  for (const [month, expectedDate] of Object.entries(required)) {
    const row = fxRows.find(item => item.month === month);
    assert.equal(row.observation_date, expectedDate);
    assert.equal(row.series, 'DEXINUS');
  }
});
