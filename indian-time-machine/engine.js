'use strict';

// Money maths for the game. Everything here works on an "effective config": the
// scenario config narrowed to one puzzle's asset subset and round window
// (see puzzle.js → puzzleConfig).

const crypto = require('crypto');
const { splitRupees } = require('../public/time-machine/rupee-split');

const CASH_ID = 'CASH_INR';
const ENGINE_VERSION = 3;

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function validateAllocations(allocations, config) {
  const ids = config.assets.map(asset => asset.id);
  const clean = {};
  for (const id of ids) {
    const value = Number(allocations && allocations[id]);
    if (!Number.isInteger(value) || value < 0) throw new Error(`Chips for ${id} must be a non-negative integer.`);
    if (value > config.maxChipsPerAsset) throw new Error(`${id} cannot receive more than ${config.maxChipsPerAsset} chips.`);
    clean[id] = value;
  }
  const unknown = Object.keys(allocations || {}).filter(id => !ids.includes(id));
  if (unknown.length) throw new Error('Allocation contains an unknown asset.');
  const total = Object.values(clean).reduce((sum, value) => sum + value, 0);
  if (total !== config.chipCount) throw new Error(`Allocate exactly ${config.chipCount} chips.`);
  return clean;
}

// Rounds must form one continuous timeline: each round closes on the exact month
// the next one opens. A gap lets unseen market drift change the portfolio between
// "round result" and "next round", which is what caused the ₹48k jump.
function validateRounds(config) {
  const rounds = config.rounds || [];
  if (!rounds.length) throw new Error('Scenario has no rounds.');
  rounds.forEach((round, index) => {
    if (round.round !== index + 1) throw new Error(`Round ${index + 1} is out of order.`);
    if (!(round.decisionMonth < round.revealMonth)) throw new Error(`Round ${round.round} must end after it starts.`);
    if (round.passiveHold) throw new Error(`Round ${round.round} has a passive hold; rounds must be continuous instead.`);
    const next = rounds[index + 1];
    if (next && next.decisionMonth !== round.revealMonth) {
      throw new Error(`Round ${round.round} ends ${round.revealMonth} but round ${next.round} starts ${next.decisionMonth}. Rounds must be continuous.`);
    }
  });
  return true;
}

// Rupee value of one unit of an asset at a month-end. Cash is held at 0% nominal;
// inflation only appears in the final real-value line (see cashInflationGross).
function priceInr(data, assetId, month) {
  if (assetId === CASH_ID) return 1;
  const point = data.price(assetId, month);
  if (!point) throw new Error(`Missing ${assetId} price for ${month}.`);
  if (point.currency !== 'USD') return point.price;
  const fx = data.fx(month);
  if (!fx) throw new Error(`Missing USD/INR month-end rate for ${month}.`);
  return point.price * fx.rate;
}

function grossReturn(data, assetId, startMonth, endMonth) {
  return priceInr(data, assetId, endMonth) / priceInr(data, assetId, startMonth);
}

// Real (after-CPI) value multiplier for rupees held between two month-ends.
function cashInflationGross(data, startMonth, endMonth) {
  const [startYear, startNumber] = startMonth.split('-').map(Number);
  const [endYear, endNumber] = endMonth.split('-').map(Number);
  const startIndex = startYear * 12 + startNumber - 1;
  const endIndex = endYear * 12 + endNumber - 1;
  if (endIndex < startIndex) throw new Error('Cash return period ends before it starts.');
  let gross = 1;
  for (let monthIndex = startIndex + 1; monthIndex <= endIndex; monthIndex += 1) {
    const year = Math.floor(monthIndex / 12);
    const inflation = data.inflation(year);
    if (!inflation || !Number.isFinite(inflation.percent)) throw new Error(`Missing India CPI inflation for ${year}.`);
    gross /= Math.pow(1 + inflation.percent / 100, 1 / 12);
  }
  return gross;
}

// Buy positions as units. Stakes are whole rupees that sum exactly to `total`.
function buyPositions(data, config, total, allocations, month) {
  const stakes = splitRupees(total, allocations, config.chipCount);
  return Object.fromEntries(config.assets.map(asset => [asset.id, {
    chips: allocations[asset.id],
    units: stakes[asset.id] / priceInr(data, asset.id, month)
  }]));
}

// THE single source of truth for portfolio value. The round result, the next
// round's opening value, the chart, the hindsight path and the final score all
// come from this. Each position is rounded to the rupee and the total is the sum
// of those rounded positions, so the parts always add up to the displayed total.
function valueAt(data, config, positions, month) {
  const values = Object.fromEntries(config.assets.map(asset => {
    const units = Number(positions?.[asset.id]?.units || 0);
    return [asset.id, units ? Math.round(units * priceInr(data, asset.id, month)) : 0];
  }));
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return { values, total };
}

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// "% over the last year" in rupees; falls back to the last six months when the
// data does not reach back a full year, and says so.
function trailingReturn(data, assetId, month) {
  for (const months of [12, 6]) {
    try {
      return { percent: (grossReturn(data, assetId, shiftMonth(month, -months), month) - 1) * 100, months };
    } catch (_) { /* try the shorter span */ }
  }
  return null;
}

function publicRound(data, config, round, wealth) {
  return {
    round: round.round,
    totalRounds: config.rounds.length,
    wealth: Math.round(wealth),
    chipCount: config.chipCount,
    maxChipsPerAsset: config.maxChipsPerAsset,
    assets: config.assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      shortName: asset.shortName,
      market: asset.market,
      color: asset.color,
      oneLiner: asset.oneLiner,
      isCash: asset.id === CASH_ID,
      trailing: asset.id === CASH_ID ? { percent: 0, months: 12 } : trailingReturn(data, asset.id, round.decisionMonth)
    }))
  };
}

// Value one set of positions across one round window. No raw prices leave here.
function runRound(data, config, positions, startMonth, endMonth) {
  const opening = valueAt(data, config, positions, startMonth);
  const closing = valueAt(data, config, positions, endMonth);
  const assets = config.assets.map(asset => {
    const gross = grossReturn(data, asset.id, startMonth, endMonth);
    return {
      id: asset.id,
      name: asset.shortName,
      color: asset.color,
      chips: Number(positions[asset.id]?.chips || 0),
      startValue: opening.values[asset.id],
      endValue: closing.values[asset.id],
      contribution: closing.values[asset.id] - opening.values[asset.id],
      returnPercent: (gross - 1) * 100
    };
  });
  return { assets, startWealth: opening.total, endWealth: closing.total, holdings: closing.values };
}

function niftyLevel(data, config, month) {
  if (typeof data.nifty === 'function') return data.nifty(month)?.level || null;
  const benchmark = config.benchmark || {};
  if (month === benchmark.startMonth) return Number(benchmark.startLevel) || null;
  if (month === benchmark.endMonth) return Number(benchmark.endLevel) || null;
  return null;
}

function createSession(config, mode, puzzle) {
  return {
    id: crypto.randomBytes(24).toString('hex'),
    engineVersion: ENGINE_VERSION,
    mode,
    puzzle,
    roundIndex: 0,
    wealth: config.startingCapitalInr,
    positions: null,
    lastAllocations: null,
    stage: 'allocation',
    lastOutcome: null,
    history: [],
    completed: false,
    lockedRoundIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function finalSummary(data, config, session) {
  const initial = config.startingCapitalInr;
  const wealth = Math.round(session.wealth);
  const history = session.history.map(item => ({
    label: item.label,
    round: item.round,
    startMonth: item.startMonth,
    endMonth: item.endMonth,
    startWealth: item.startWealth,
    endWealth: item.endWealth,
    type: item.type,
    allocations: item.chips,
    assets: item.assets.map(({ id, name, color, chips, returnPercent, contribution }) => ({ id, name, color, chips, returnPercent, contribution }))
  }));
  const startMonth = history[0]?.startMonth;
  const endMonth = history.at(-1)?.endMonth;
  const years = [];
  if (startMonth && endMonth) {
    for (let year = Number(startMonth.slice(0, 4)) + (startMonth.endsWith('-12') ? 1 : 0); year <= Number(endMonth.slice(0, 4)); year += 1) years.push(year);
  }
  const inflationRates = years.map(year => data.inflation(year)?.percent).filter(Number.isFinite);
  const averageInflation = inflationRates.length
    ? inflationRates.reduce((sum, value) => sum + value, 0) / inflationRates.length
    : null;
  // The Nifty comparison is only shown when levels exist for both ends of the window played.
  const niftyStart = startMonth && niftyLevel(data, config, startMonth);
  const niftyEnd = endMonth && niftyLevel(data, config, endMonth);
  const hasNifty = Boolean(niftyStart && niftyEnd);
  const nifty50Gross = hasNifty ? niftyEnd / niftyStart : null;
  const nifty50Wealth = hasNifty ? Math.round(initial * nifty50Gross) : null;
  const cashRealWealth = startMonth && endMonth ? Math.round(initial * cashInflationGross(data, startMonth, endMonth)) : null;
  return {
    finalWealth: wealth,
    initialWealth: initial,
    profitLoss: wealth - initial,
    returnPercent: ((wealth / initial) - 1) * 100,
    nifty50Wealth,
    nifty50ReturnPercent: hasNifty ? (nifty50Gross - 1) * 100 : null,
    beatNiftyBy: hasNifty ? wealth - nifty50Wealth : null,
    nifty50StartLevel: hasNifty ? niftyStart : null,
    nifty50EndLevel: hasNifty ? niftyEnd : null,
    cashRealWealth,
    cashPurchasingPowerLoss: cashRealWealth === null ? null : initial - cashRealWealth,
    inflationContext: [{ label: 'Average CPI', percent: averageInflation }],
    history,
    // Chart points: the starting capital, then each round's closing value.
    chartPoints: [initial, ...history.map(item => item.endWealth)],
    assumptions: [
      'No fees, taxes, slippage or FX transaction costs',
      'Cash is held at 0% nominal. Its after-inflation value uses India CPI, compounded monthly from each annual rate',
      'Stock adjusted closes already include corporate actions',
      'Nifty benchmark uses Nifty 50 price-index levels and excludes dividends'
    ]
  };
}

// Positions going into the current round, valued at that round's opening month,
// which by continuity is the previous round's closing month.
function currentPortfolio(data, config, session) {
  const round = config.rounds[session.roundIndex];
  const { values, total } = valueAt(data, config, session.positions, round.decisionMonth);
  return config.assets.map(asset => ({
    id: asset.id,
    name: asset.shortName,
    color: asset.color,
    chips: Number(session.positions?.[asset.id]?.chips || 0),
    value: values[asset.id],
    weightPercent: total ? (values[asset.id] / total) * 100 : 0
  }));
}

function lockRound(data, config, session, allocations, options = {}) {
  if (session.completed) throw new Error('This game is already complete. Start a new one.');
  if (session.stage !== 'allocation' && session.stage !== 'decision') {
    throw new Error('Finish the current game stage before continuing.');
  }
  const round = config.rounds[session.roundIndex];
  if (!round || session.lockedRoundIds.includes(round.id)) throw new Error('This round has already been locked.');
  const rebalance = options.rebalance !== false || !session.positions;
  const clean = rebalance ? validateAllocations(allocations, config) : null;
  // The opening value must equal what the player was just shown: the previous close.
  const opening = session.positions
    ? valueAt(data, config, session.positions, round.decisionMonth).total
    : Math.round(session.wealth);
  if (opening !== Math.round(session.wealth)) {
    throw new Error(`Portfolio continuity broken: opening ${opening} differs from previous close ${session.wealth}.`);
  }
  // Reshuffle = sell everything at the closing value, then buy 10 chips of closing / 10.
  const positions = rebalance ? buyPositions(data, config, opening, clean, round.decisionMonth) : session.positions;
  const reveal = runRound(data, config, positions, round.decisionMonth, round.revealMonth);
  reveal.round = round.round;
  reveal.label = `Round ${round.round}`;
  reveal.type = rebalance ? 'rebalance' : 'hold';
  reveal.strategy = rebalance ? 'reshuffled' : 'continued';
  reveal.allocations = clean;
  reveal.winner = [...reveal.assets].sort((a, b) => b.returnPercent - a.returnPercent)[0].id;
  reveal.loser = [...reveal.assets].sort((a, b) => a.returnPercent - b.returnPercent)[0].id;
  const niftyStart = niftyLevel(data, config, round.decisionMonth);
  const niftyEnd = niftyLevel(data, config, round.revealMonth);
  reveal.niftyReturnPercent = niftyStart && niftyEnd ? (niftyEnd / niftyStart - 1) * 100 : null;
  session.wealth = reveal.endWealth;
  session.positions = positions;
  if (clean) session.lastAllocations = clean;
  session.lockedRoundIds.push(round.id);
  session.history.push({
    type: reveal.type,
    round: round.round,
    label: reveal.label,
    startMonth: round.decisionMonth,
    endMonth: round.revealMonth,
    startWealth: reveal.startWealth,
    endWealth: reveal.endWealth,
    chips: Object.fromEntries(config.assets.map(asset => [asset.id, Number(positions[asset.id]?.chips || 0)])),
    niftyReturnPercent: reveal.niftyReturnPercent,
    assets: reveal.assets
  });
  const isFinal = session.roundIndex === config.rounds.length - 1;
  if (!isFinal) session.roundIndex += 1;
  session.stage = isFinal ? 'final-pending' : 'decision';
  session.lastOutcome = { reveal, isFinal };
  session.updatedAt = new Date().toISOString();
  return session.lastOutcome;
}

// What the merged "round result + next move" screen needs for the coming round.
function decisionState(data, config, session) {
  if (session.stage !== 'decision') return null;
  const round = config.rounds[session.roundIndex];
  return {
    current: publicRound(data, config, round, session.wealth),
    portfolio: currentPortfolio(data, config, session),
    prefillAllocations: { ...(session.lastAllocations || {}) }
  };
}

function completeGame(data, config, session) {
  if (session.stage !== 'final-pending') throw new Error('The game is not ready to finish yet.');
  session.completed = true;
  session.stage = 'complete';
  session.updatedAt = new Date().toISOString();
  return finalSummary(data, config, session);
}

module.exports = {
  CASH_ID,
  ENGINE_VERSION,
  validateAllocations,
  validateRounds,
  priceInr,
  grossReturn,
  cashInflationGross,
  buyPositions,
  valueAt,
  runRound,
  trailingReturn,
  publicRound,
  niftyLevel,
  createSession,
  lockRound,
  decisionState,
  completeGame,
  currentPortfolio,
  finalSummary,
  roundMoney,
  shiftMonth
};
