'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  validateAllocations,
  validateRounds,
  grossReturn,
  buyPositions,
  valueAt,
  publicRound,
  createSession,
  lockRound,
  finishNewspaper,
  finalSummary
} = require('../indian-time-machine/engine');
const { splitRupees } = require('../public/time-machine/rupee-split');
const { parseCsv, rowsToObjects } = require('../indian-time-machine/csv');

const DATA_DIR = path.join(__dirname, '..', 'data', 'indian-time-machine');
const config = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scenario_config.json'), 'utf8'));
config.news = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'news.json'), 'utf8'));

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

// The real supplied data, read straight from the CSVs (same source the SQLite import uses).
function loadRealData() {
  const read = file => rowsToObjects(parseCsv(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')));
  const prices = new Map(read('market_prices_monthly.csv').map(row => [`${row.asset}:${row.month}`, {
    price: Number(row.price_native), currency: row.native_currency, basis: row.price_basis
  }]));
  const rates = new Map(read('usd_inr_month_end.csv').map(row => [row.month, { rate: Number(row.inr_per_usd), date: row.observation_date }]));
  const cpi = new Map(read('india_inflation_annual.csv').map(row => [Number(row.year), { year: Number(row.year), percent: Number(row.india_cpi_inflation_percent) }]));
  return {
    price: (asset, month) => prices.get(`${asset}:${month}`) || null,
    fx: month => rates.get(month) || null,
    inflation: year => cpi.get(Number(year)) || null
  };
}
const realData = loadRealData();

const sum = values => values.reduce((total, value) => total + value, 0);
const chips = (rel, hdfc, aapl, gold, cash) => ({ 'RELIANCE.NS': rel, 'HDFCBANK.NS': hdfc, AAPL: aapl, GOLD_UNVERIFIED: gold, CASH_INR: cash });

// Plays a full story game. `moves[i]` is null to hold, or an allocation to reshuffle.
// Returns every payload the UI renders, in order.
function playStory(data, opening, moves) {
  const session = createSession(config, 'story', '2026-11-08');
  const screens = [];
  let outcome = lockRound(data, config, session, opening);
  for (let round = 1; round <= config.rounds.length; round += 1) {
    const next = finishNewspaper(data, config, session);
    screens.push({ round, outcome, next });
    if (next.completed) break;
    const move = moves[round - 1];
    outcome = move ? lockRound(data, config, session, move, { rebalance: true }) : lockRound(data, config, session, null, { rebalance: false });
  }
  return { session, screens, final: screens.at(-1).next.final };
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

test('the shipped rounds are continuous: each round ends on the month the next one starts', () => {
  assert.equal(validateRounds(config), true);
  for (let index = 1; index < config.rounds.length; index += 1) {
    assert.equal(config.rounds[index].decisionMonth, config.rounds[index - 1].revealMonth);
  }
  assert.equal(config.rounds[0].decisionMonth, config.benchmark.startMonth);
  assert.equal(config.rounds.at(-1).revealMonth, config.benchmark.endMonth);
});

test('a gap or a passive hold between rounds is rejected at load time', () => {
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

test('valueAt is consistent: positions bought at a month are worth exactly the stake that month', () => {
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
    const { screens, final } = playStory(realData, opening, moves);
    assert.equal(screens.length, 4);
    screens.forEach(({ outcome, next }, index) => {
      const reveal = outcome.reveal;
      // Round result screen: positions sum to the displayed totals, to the rupee.
      assert.equal(sum(reveal.assets.map(asset => asset.endValue)), reveal.endWealth);
      assert.equal(sum(reveal.assets.map(asset => asset.startValue)), reveal.startWealth);
      if (index === 0) assert.equal(reveal.startWealth, 1_000_000);
      if (!next.completed) {
        // Next-round screen shows exactly the round's closing value and positions.
        assert.equal(next.current.wealth, reveal.endWealth);
        assert.equal(sum(next.portfolio.map(asset => asset.value)), reveal.endWealth);
        next.portfolio.forEach(asset => assert.equal(asset.value, reveal.holdings[asset.id]));
        // And the next round opens at that same value, held or reshuffled.
        assert.equal(screens[index + 1].outcome.reveal.startWealth, reveal.endWealth);
      }
    });
    assert.equal(final.finalWealth, screens.at(-1).outcome.reveal.endWealth);
    // Chart points: ₹10L, then each round's closing value.
    assert.deepEqual(final.chartPoints, [1_000_000, ...screens.map(screen => screen.outcome.reveal.endWealth)]);
    assert.deepEqual(final.history.map(item => item.endWealth), screens.map(screen => screen.outcome.reveal.endWealth));
  });
}

test('reshuffle sells at the closing value and buys 10 equal chips of close / 10', () => {
  const { screens } = playStory(realData, chips(4, 2, 2, 2, 0), [chips(2, 4, 2, 2, 0), null, null]);
  const close1 = screens[0].outcome.reveal.endWealth;
  const round2 = screens[1].outcome.reveal;
  assert.equal(round2.strategy, 'reshuffled');
  round2.assets.forEach(asset => assert.ok(Math.abs(asset.startValue - close1 * asset.chips / 10) < 1));
});

test('replaying the same puzzle with the same choices gives an identical result', () => {
  const moves = [chips(2, 4, 2, 2, 0), null, chips(3, 3, 2, 2, 0)];
  const strip = run => run.screens.map(({ outcome, next }) => ({ reveal: outcome.reveal, wealth: next.current?.wealth, final: next.final && { ...next.final } }));
  const first = playStory(realData, chips(4, 2, 2, 2, 0), moves);
  const second = playStory(realData, chips(4, 2, 2, 2, 0), moves);
  assert.deepEqual(strip(second), strip(first));
});

test('REGRESSION: the reported ₹48k jump between round 2 result and round 3 start is gone', () => {
  // Reported play: R1 Reliance 4 / HDFC 2 / Apple 2 / Gold 2, then R2 reshuffle to 2 / 4 / 2 / 2, then hold.
  const { screens, final } = playStory(realData, chips(4, 2, 2, 2, 0), [chips(2, 4, 2, 2, 0), null, null]);
  const [round1, round2, round3] = screens;
  assert.equal(round1.outcome.reveal.endWealth, 1_046_489);
  assert.equal(round1.next.current.wealth, 1_046_489);
  assert.equal(round2.outcome.reveal.startWealth, 1_046_489);
  // Before the fix: result screen ₹11,80,930, next screen ₹12,29,227 (Jun→Dec 2023 was applied silently).
  // Round 2 now runs Dec 2022 → Dec 2023, so the result and the next screen agree.
  assert.equal(round2.outcome.reveal.endWealth, 1_229_227);
  assert.equal(round2.next.current.wealth, 1_229_227);
  assert.deepEqual(
    Object.fromEntries(round2.next.portfolio.filter(asset => asset.value).map(asset => [asset.name, asset.value])),
    { Reliance: 230_930, 'HDFC Bank': 444_482, Apple: 313_645, Gold: 240_170 }
  );
  assert.equal(round3.outcome.reveal.startWealth, 1_229_227);
  assert.equal(round3.outcome.reveal.endWealth, 1_337_938);
  assert.equal(final.chartPoints[2], 1_229_227);
  assert.equal(final.chartPoints[3], 1_337_938);
});

test('cash is held at 0% nominal during rounds; inflation only shows in the final real-value line', () => {
  const { screens, final } = playStory(realData, chips(2, 2, 2, 2, 2), [null, null, null]);
  for (const { outcome } of screens) {
    const cash = outcome.reveal.assets.find(asset => asset.id === 'CASH_INR');
    assert.equal(cash.returnPercent, 0);
    assert.equal(cash.endValue, cash.startValue);
  }
  assert.equal(screens[0].outcome.reveal.assets.find(asset => asset.id === 'CASH_INR').endValue, 200_000);
  assert.ok(final.cashRealWealth < 1_000_000);
  assert.equal(final.cashPurchasingPowerLoss, 1_000_000 - final.cashRealWealth);
});

test('public pre-lock state contains only the decision price and trailing return', () => {
  const state = publicRound(fixtureData, config, config.rounds[0], 1_000_000);
  const serialized = JSON.stringify(state);
  assert.equal(state.label, 'Round 1');
  assert.ok(!/20(1|2)\d/.test(serialized));
  assert.ok(!serialized.includes('decisionMonth'));
  assert.ok(!serialized.includes('dateLine'));
  assert.ok(!serialized.includes('endPrice'));
  assert.ok(!serialized.includes('returnPercent'));
  assert.equal(state.assets.length, 5);
  assert.equal(state.assets.find(asset => asset.id === 'CASH_INR').trailingReturn, 0);
});

test('locks a round once and prevents replay tampering', () => {
  const session = createSession(config, 'daily', '2026-11-07');
  const allocations = chips(2, 2, 2, 2, 2);
  const result = lockRound(fixtureData, config, session, allocations);
  assert.equal(result.isFinal, true);
  assert.equal(session.stage, 'newspaper');
  assert.equal(result.newspaper.stories.length >= 3, true);
  assert.throws(() => lockRound(fixtureData, config, session, allocations), /stage/);
});

test('continuing unchanged keeps the same units, so drifted values carry over exactly', () => {
  const session = createSession(config, 'story', '2026-11-07');
  lockRound(fixtureData, config, session, chips(2, 2, 2, 2, 2));
  const close = { ...session.pendingOutcome.reveal.holdings };
  finishNewspaper(fixtureData, config, session);
  const outcome = lockRound(fixtureData, config, session, null, { rebalance: false });
  for (const asset of outcome.reveal.assets) assert.equal(asset.startValue, close[asset.id]);
  assert.equal(outcome.reveal.strategy, 'continued');
  assert.equal(session.history.at(-1).type, 'hold');
});

test('every round has a newspaper and round 4 completes only after its newspaper', () => {
  for (const round of ['1', '2', '3', '4']) assert.ok(config.news[round].length >= 3);
  const session = createSession(config, 'story', '2026-11-07');
  let outcome = lockRound(fixtureData, config, session, chips(2, 2, 2, 2, 2));
  for (let round = 1; round <= 4; round += 1) {
    assert.equal(session.stage, 'newspaper');
    assert.equal(outcome.newspaper.label, `What Just Happened in Round ${round}`);
    const next = finishNewspaper(fixtureData, config, session);
    if (round === 4) {
      assert.equal(next.completed, true);
      assert.equal(session.completed, true);
    } else {
      assert.equal(next.stage, 'decision');
      outcome = lockRound(fixtureData, config, session, null, { rebalance: false });
    }
  }
  const summary = finalSummary(fixtureData, config, session);
  assert.deepEqual(summary.history.map(item => item.label), ['Round 1', 'Round 2', 'Round 3', 'Round 4']);
  assert.deepEqual(summary.inflationContext, [{ label: 'Average CPI', percent: 5 }]);
  assert.equal(summary.nifty50StartLevel, 15780.25);
  assert.equal(summary.nifty50EndLevel, 23644.8);
  assert.equal(summary.nifty50Wealth, 1_498_379);
  assert.ok(Math.abs(summary.nifty50ReturnPercent - 49.838) < 0.01);
  assert.ok(summary.cashRealWealth < 1_000_000);
});

test('the Nifty comparison is withheld when its levels do not cover the window played', () => {
  const session = createSession(config, 'daily', '2026-11-07');
  lockRound(fixtureData, config, session, chips(2, 2, 2, 2, 2));
  const { final } = finishNewspaper(fixtureData, config, session);
  const covers = final.history[0].startMonth === config.benchmark.startMonth && final.history[0].endMonth === config.benchmark.endMonth;
  if (!covers) {
    assert.equal(final.nifty50Wealth, null);
    assert.equal(final.beatNiftyBy, null);
  }
});

test('the source CSV contains the real supplied checkpoint values', () => {
  const rows = rowsToObjects(parseCsv(fs.readFileSync(path.join(DATA_DIR, 'market_prices_monthly.csv'), 'utf8')));
  assert.equal(rows.length, 250);
  assert.equal(Number(rows.find(row => row.asset === 'RELIANCE.NS' && row.month === '2022-06').price_native), 1175.62);
  assert.equal(Number(rows.find(row => row.asset === 'AAPL' && row.month === '2024-12').price_native), 248.62);
});

test('two real checkpoint calculations match independent arithmetic', () => {
  const reliance = grossReturn(realData, 'RELIANCE.NS', '2022-06', '2022-12');
  const apple = grossReturn(realData, 'AAPL', '2022-06', '2022-12');
  assert.ok(Math.abs(reliance - (1157.44 / 1175.62)) < 1e-12);
  assert.ok(Math.abs(apple - ((127.65 / 133.91) * (82.72 / 79.02))) < 1e-12);
});

test('FRED import selects the final valid trading-day observation in each required month', () => {
  const fxRows = rowsToObjects(parseCsv(fs.readFileSync(path.join(DATA_DIR, 'usd_inr_month_end.csv'), 'utf8')));
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
