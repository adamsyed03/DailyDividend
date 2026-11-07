'use strict';

const crypto = require('crypto');

const CASH_ID = 'CASH_INR';
const USD_ASSETS = new Set(['AAPL', 'GOLD_UNVERIFIED']);

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

function grossReturn(data, assetId, startMonth, endMonth) {
  if (assetId === CASH_ID) return cashInflationGross(data, startMonth, endMonth);
  const startPrice = data.price(assetId, startMonth);
  const endPrice = data.price(assetId, endMonth);
  if (!startPrice || !endPrice) throw new Error(`Missing ${assetId} price for ${!startPrice ? startMonth : endMonth}.`);
  let gross = endPrice.price / startPrice.price;
  if (USD_ASSETS.has(assetId)) {
    const startFx = data.fx(startMonth);
    const endFx = data.fx(endMonth);
    if (!startFx || !endFx) throw new Error(`Missing USD/INR month-end rate for ${!startFx ? startMonth : endMonth}.`);
    gross *= endFx.rate / startFx.rate;
  }
  return gross;
}

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

function segmentReturns(data, config, startMonth, endMonth) {
  return Object.fromEntries(config.assets.map(asset => [asset.id, grossReturn(data, asset.id, startMonth, endMonth)]));
}

function priceSnapshot(data, asset, month) {
  if (asset.id === CASH_ID) return { price: 1, currency: 'INR', basis: 'cash' };
  const point = data.price(asset.id, month);
  if (!point) throw new Error(`Missing ${asset.id} price for ${month}.`);
  return { price: point.price, currency: point.currency, basis: point.basis };
}

function monthShift(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function displayRoundLabel(roundNumber) {
  return `Year ${roundNumber}`;
}

function publicRound(data, config, round, wealth) {
  const trailingMonth = monthShift(round.decisionMonth, -6);
  const assets = config.assets.map(asset => {
    const snapshot = priceSnapshot(data, asset, round.decisionMonth);
    let trailingReturn = null;
    try {
      trailingReturn = grossReturn(data, asset.id, trailingMonth, round.decisionMonth) - 1;
    } catch (_) {
      trailingReturn = null;
    }
    return {
      id: asset.id,
      name: asset.name,
      shortName: asset.shortName,
      currency: asset.currency,
      color: asset.color,
      explanation: asset.explanation,
      currentPrice: snapshot.price,
      priceBasis: snapshot.basis,
      trailingReturn,
      maxChips: config.maxChipsPerAsset
    };
  });
  const inflation = data.inflation(round.knownInflationYear);
  return {
    round: round.round,
    totalRounds: config.rounds.length,
    label: displayRoundLabel(round.round),
    context: round.context,
    wealth: roundMoney(wealth),
    chipCount: config.chipCount,
    maxChipsPerAsset: config.maxChipsPerAsset,
    assets,
    inflationContext: inflation ? { percent: inflation.percent } : null
  };
}

function applyAllocation(data, config, wealth, allocations, startMonth, endMonth) {
  const returns = segmentReturns(data, config, startMonth, endMonth);
  const holdings = {};
  const assets = config.assets.map(asset => {
    const chips = allocations[asset.id];
    const startValue = wealth * (chips / config.chipCount);
    const endValue = startValue * returns[asset.id];
    holdings[asset.id] = endValue;
    const startPoint = priceSnapshot(data, asset, startMonth);
    const endPoint = priceSnapshot(data, asset, endMonth);
    const fxStart = USD_ASSETS.has(asset.id) ? data.fx(startMonth).rate : null;
    const fxEnd = USD_ASSETS.has(asset.id) ? data.fx(endMonth).rate : null;
    return {
      id: asset.id,
      name: asset.shortName,
      chips,
      startValue: roundMoney(startValue),
      endValue: roundMoney(endValue),
      contribution: roundMoney(endValue - startValue),
      grossReturn: returns[asset.id],
      returnPercent: (returns[asset.id] - 1) * 100,
      startPrice: startPoint.price,
      endPrice: endPoint.price,
      nativeCurrency: asset.currency,
      fxStart,
      fxEnd,
      color: asset.color
    };
  });
  const endWealth = Object.values(holdings).reduce((sum, value) => sum + value, 0);
  return { assets, holdings, startWealth: roundMoney(wealth), endWealth: roundMoney(endWealth) };
}

function applyPassiveHold(data, config, holdings, startMonth, endMonth) {
  const returns = segmentReturns(data, config, startMonth, endMonth);
  const nextHoldings = {};
  const assets = config.assets.map(asset => {
    const startValue = Number(holdings[asset.id] || 0);
    const endValue = startValue * returns[asset.id];
    nextHoldings[asset.id] = endValue;
    const startPoint = priceSnapshot(data, asset, startMonth);
    const endPoint = priceSnapshot(data, asset, endMonth);
    const fxStart = USD_ASSETS.has(asset.id) ? data.fx(startMonth).rate : null;
    const fxEnd = USD_ASSETS.has(asset.id) ? data.fx(endMonth).rate : null;
    return {
      id: asset.id,
      name: asset.shortName,
      startValue: roundMoney(startValue),
      endValue: roundMoney(endValue),
      contribution: roundMoney(endValue - startValue),
      grossReturn: returns[asset.id],
      returnPercent: (returns[asset.id] - 1) * 100,
      startPrice: startPoint.price,
      endPrice: endPoint.price,
      nativeCurrency: asset.currency,
      fxStart,
      fxEnd,
      color: asset.color
    };
  });
  const startWealth = Object.values(holdings).reduce((sum, value) => sum + Number(value || 0), 0);
  const endWealth = Object.values(nextHoldings).reduce((sum, value) => sum + value, 0);
  return { assets, holdings: nextHoldings, startWealth: roundMoney(startWealth), endWealth: roundMoney(endWealth) };
}

function dailyRoundIndex(dateKey, roundCount) {
  const digest = crypto.createHash('sha256').update(String(dateKey)).digest();
  return digest.readUInt32BE(0) % roundCount;
}

function createSession(config, mode, dateKey) {
  const selectedRound = mode === 'daily' ? dailyRoundIndex(dateKey, config.rounds.length) : 0;
  return {
    id: crypto.randomBytes(24).toString('hex'),
    mode,
    dateKey,
    roundIndex: selectedRound,
    selectedRound,
    wealth: config.startingCapitalInr,
    holdings: null,
    lastAllocations: null,
    stage: 'allocation',
    pendingOutcome: null,
    history: [],
    completed: false,
    lockedRoundIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function finalSummary(data, config, session) {
  const initial = config.startingCapitalInr;
  const wealth = roundMoney(session.wealth);
  const annualHistory = [];
  for (const item of session.history) {
    if (/^Year [1-4]$/.test(item.label)) {
      annualHistory.push({
        label: item.label,
        startWealth: item.startWealth,
        endWealth: item.endWealth,
        type: item.type
      });
    }
  }
  const inflationRates = [2022, 2023, 2024]
    .map(year => data.inflation(year)?.percent)
    .filter(Number.isFinite);
  const averageInflation = inflationRates.length
    ? inflationRates.reduce((sum, value) => sum + value, 0) / inflationRates.length
    : null;
  const nifty50Start = Number(config.benchmark?.startLevel);
  const nifty50End = Number(config.benchmark?.endLevel);
  if (!(nifty50Start > 0) || !(nifty50End > 0)) throw new Error('Nifty 50 benchmark levels are missing from the scenario configuration.');
  const nifty50Gross = nifty50End / nifty50Start;
  const nifty50Wealth = Math.round((initial * nifty50Gross) / 10) * 10;
  const cashRealWealth = roundMoney(initial * cashInflationGross(data, config.benchmark.startMonth, config.benchmark.endMonth));
  return {
    finalWealth: wealth,
    initialWealth: initial,
    profitLoss: roundMoney(wealth - initial),
    returnPercent: ((wealth / initial) - 1) * 100,
    nifty50Wealth,
    nifty50ReturnPercent: (nifty50Gross - 1) * 100,
    beatNiftyBy: roundMoney(wealth - nifty50Wealth),
    nifty50StartLevel: nifty50Start,
    nifty50EndLevel: nifty50End,
    cashRealWealth,
    cashPurchasingPowerLoss: roundMoney(initial - cashRealWealth),
    inflationContext: [{ label: 'Average CPI', percent: averageInflation }],
    history: annualHistory,
    assumptions: [
      'No fees, taxes, slippage or FX transaction costs',
      'Cash is reduced by supplied India CPI, compounded monthly from each annual rate',
      'Stock adjusted closes already include corporate actions',
      'Nifty benchmark uses the supplied Nifty 50 price-index levels and excludes dividends'
    ]
  };
}

function currentPortfolio(config, session) {
  const wealth = Math.max(0, Number(session.wealth || 0));
  return config.assets.map(asset => {
    const value = Number(session.holdings?.[asset.id] || 0);
    return {
      id: asset.id,
      name: asset.shortName,
      color: asset.color,
      value: roundMoney(value),
      weightPercent: wealth ? (value / wealth) * 100 : 0
    };
  });
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function roundPeriodLabel(round) {
  if (!round?.decisionMonth || !round?.revealMonth) return null;
  const [startYear, startMonth] = round.decisionMonth.split('-').map(Number);
  const [endYear, endMonth] = round.revealMonth.split('-').map(Number);
  // The window opens the month after the decision checkpoint and closes at the reveal month.
  const firstMonth = startMonth % 12;
  const firstYear = startMonth === 12 ? startYear + 1 : startYear;
  return `${MONTH_NAMES[firstMonth]} ${firstYear} to ${MONTH_NAMES[endMonth - 1]} ${endYear}`;
}

function newspaperForRound(config, roundNumber) {
  const round = (config.rounds || []).find(item => item.round === roundNumber);
  return {
    masthead: 'THE MARKET CHRONICLE',
    label: `What Just Happened in Year ${roundNumber}`,
    period: roundPeriodLabel(round),
    stories: (config.news?.[String(roundNumber)] || []).map(story => ({ ...story }))
  };
}

function lockRound(data, config, session, allocations, options = {}) {
  if (session.completed) throw new Error('This game is already complete. Start a replay.');
  if ((session.stage || 'allocation') !== 'allocation' && session.stage !== 'decision') {
    throw new Error('Finish the current game stage before continuing.');
  }
  const round = config.rounds[session.roundIndex];
  if (!round || session.lockedRoundIds.includes(round.id)) throw new Error('This round has already been locked.');
  const rebalance = options.rebalance !== false || !session.holdings;
  const clean = rebalance ? validateAllocations(allocations, config) : null;
  const reveal = rebalance
    ? applyAllocation(data, config, session.wealth, clean, round.decisionMonth, round.revealMonth)
    : applyPassiveHold(data, config, session.holdings, round.decisionMonth, round.revealMonth);
  reveal.label = displayRoundLabel(round.round);
  reveal.type = rebalance ? 'rebalance' : 'hold';
  reveal.strategy = rebalance ? 'reshuffled' : 'continued';
  reveal.allocations = clean;
  reveal.winner = [...reveal.assets].sort((a, b) => b.returnPercent - a.returnPercent)[0].id;
  reveal.loser = [...reveal.assets].sort((a, b) => a.returnPercent - b.returnPercent)[0].id;
  session.wealth = reveal.endWealth;
  session.holdings = reveal.holdings;
  if (clean) session.lastAllocations = clean;
  session.lockedRoundIds.push(round.id);
  session.history.push({
    type: reveal.type, label: displayRoundLabel(round.round), startWealth: reveal.startWealth, endWealth: reveal.endWealth,
    allocations: clean, assets: reveal.assets
  });

  let gapHold = null;
  if (round.passiveHold) {
    gapHold = applyPassiveHold(data, config, session.holdings, round.passiveHold.startMonth, round.passiveHold.endMonth);
    gapHold.label = 'Automatic hold';
    gapHold.description = round.passiveHold.description;
    gapHold.type = 'hold';
    session.wealth = gapHold.endWealth;
    session.holdings = gapHold.holdings;
    session.history.push({
      type: 'hold', label: gapHold.label, startWealth: gapHold.startWealth, endWealth: gapHold.endWealth,
      assets: gapHold.assets
    });
  }

  const isFinal = session.mode === 'daily' || session.roundIndex === config.rounds.length - 1;
  if (!isFinal) {
    session.roundIndex += 1;
  }
  const outcome = {
    reveal,
    gapHold,
    completed: false,
    isFinal,
    newspaper: newspaperForRound(config, round.round)
  };
  session.stage = 'newspaper';
  session.pendingOutcome = outcome;
  session.updatedAt = new Date().toISOString();
  return outcome;
}

function finishNewspaper(data, config, session) {
  if (session.stage !== 'newspaper' || !session.pendingOutcome) {
    throw new Error('There is no newspaper waiting to be completed.');
  }
  const newspaper = session.pendingOutcome.newspaper;
  session.lastNewspaper = newspaper;
  if (session.pendingOutcome.isFinal) {
    session.completed = true;
    session.stage = 'complete';
    session.pendingOutcome = null;
    session.updatedAt = new Date().toISOString();
    return { completed: true, stage: 'complete', final: finalSummary(data, config, session), newspaper };
  }
  session.stage = 'decision';
  session.pendingOutcome = null;
  session.updatedAt = new Date().toISOString();
  const round = config.rounds[session.roundIndex];
  return {
    completed: false,
    stage: 'decision',
    current: publicRound(data, config, round, session.wealth),
    portfolio: currentPortfolio(config, session),
    prefillAllocations: { ...(session.lastAllocations || {}) },
    newspaper
  };
}

module.exports = {
  CASH_ID,
  USD_ASSETS,
  validateAllocations,
  grossReturn,
  segmentReturns,
  publicRound,
  applyAllocation,
  applyPassiveHold,
  dailyRoundIndex,
  createSession,
  lockRound,
  finishNewspaper,
  currentPortfolio,
  newspaperForRound,
  finalSummary,
  roundMoney
};
