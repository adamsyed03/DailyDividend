'use strict';

// Builds a puzzle: which window, which assets, which headlines, and which
// data-gated features are on. Daily puzzles are seeded by the IST date so every
// player gets the same one; unlimited puzzles use a random seed.

const crypto = require('crypto');
const { CASH_ID, buyPositions, valueAt, grossReturn, niftyLevel } = require('./engine');
const { calendarRounds, startYearReports, legacyReport, assignClues, cluesFor, duringFor } = require('./dataset');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function istDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function puzzleNumber(config, dateKey) {
  const epoch = Date.parse(`${config.puzzleEpochIst || dateKey}T00:00:00Z`);
  return Math.max(1, Math.round((Date.parse(`${dateKey}T00:00:00Z`) - epoch) / 86_400_000) + 1);
}

// Small seeded PRNG (sfc32) keyed off sha256(seed).
function seededRandom(seed) {
  const digest = crypto.createHash('sha256').update(String(seed)).digest();
  let a = digest.readUInt32BE(0), b = digest.readUInt32BE(4), c = digest.readUInt32BE(8), d = digest.readUInt32BE(12);
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const result = (t + d) | 0;
    c = (c + result) | 0;
    return (result >>> 0) / 4294967296;
  };
}

function shuffled(list, random) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function periodLabel(startMonth, endMonth) {
  const [startYear, startNumber] = startMonth.split('-').map(Number);
  const [endYear, endNumber] = endMonth.split('-').map(Number);
  // A window opens the month after its decision close.
  const firstNumber = startNumber % 12 + 1;
  const firstYear = startNumber === 12 ? startYear + 1 : startYear;
  if (firstNumber === 1 && endNumber === 12 && firstYear === endYear) return String(endYear);
  if (firstYear === endYear) return `${MONTHS[firstNumber - 1]}–${MONTHS[endNumber - 1]} ${endYear}`;
  return `${MONTHS[firstNumber - 1]} ${firstYear} – ${MONTHS[endNumber - 1]} ${endYear}`;
}

// Reports depend only on the data files, so compute them once per dataset load.
const reportCache = new WeakMap();
function reportsFor(dataset, config) {
  if (!reportCache.has(dataset)) {
    reportCache.set(dataset, {
      startYears: startYearReports(dataset, config),
      legacy: legacyReport(dataset, config),
      clueIndex: assignClues(dataset, config)
    });
  }
  return reportCache.get(dataset);
}

function flagOn(config, name) {
  return config.featureFlags?.[name]?.enabled !== false;
}

function buildPuzzle(dataset, config, { mode, dateKey, seed }) {
  const random = seededRandom(seed);
  const reports = reportsFor(dataset, config);
  const playableYears = reports.startYears.filter(report => report.playable).map(report => report.startYear);
  const hiddenYears = flagOn(config, 'hiddenYears') && playableYears.length >= (config.featureFlags?.hiddenYears?.minStartYears || 4);
  let report;
  let startYear = null;
  if (hiddenYears) {
    startYear = playableYears[Math.floor(random() * playableYears.length)];
    report = reports.startYears.find(item => item.startYear === startYear);
  } else {
    report = reports.legacy;
  }
  const rounds = report.rounds.map(({ id, round, decisionMonth, revealMonth, knownInflationYear }) => ({ id, round, decisionMonth, revealMonth, knownInflationYear }));

  // Asset subset: seeded draw from the pool members that have full data for this window.
  const pool = config.assets.filter(asset => asset.id !== CASH_ID);
  const eligible = pool.filter(asset => report.readyAssets.includes(asset.id));
  const { min = 4, max = 5 } = config.puzzle?.assetsPerPuzzle || {};
  const floor = Math.min(min, pool.length);
  if (eligible.length < floor) throw new Error(`Only ${eligible.length} assets have full data for this window; need ${floor}.`);
  const target = Math.min(eligible.length, min + Math.floor(random() * (max - min + 1)));
  const picked = new Set(shuffled(eligible, random).slice(0, target).map(asset => asset.id));
  const assetIds = [...pool.filter(asset => picked.has(asset.id)).map(asset => asset.id), CASH_ID];

  const flags = {
    hiddenYears,
    clues: flagOn(config, 'clues') && report.cluesReady,
    roundNifty: flagOn(config, 'roundNifty') && report.roundNiftyReady,
    niftyTitles: flagOn(config, 'niftyTitles') && report.overallNiftyReady
  };

  // Headlines: two clues per decision (one Indian, one US/global) and one from inside each round.
  for (const round of rounds) {
    if (flags.clues) {
      const { india, world } = cluesFor(reports.clueIndex, round.decisionMonth);
      round.clueIds = [shuffled(india, random)[0].id, shuffled(world, random)[0].id];
    }
    const during = duringFor(dataset, round);
    const tagged = during.filter(item => item.tags.some(tag => picked.has(tag)));
    const choice = shuffled(tagged.length ? tagged : during, random)[0];
    round.duringId = choice ? choice.id : null;
  }

  let yearGuess = null;
  if (hiddenYears) {
    const range = config.puzzle.calendarStartYears;
    const others = [];
    for (let year = range.from; year <= range.to; year += 1) if (year !== startYear) others.push(year);
    yearGuess = { options: [startYear, ...shuffled(others, random).slice(0, 3)].sort((a, b) => a - b) };
  }

  return {
    id: mode === 'daily' ? `daily-${dateKey}` : `unlimited-${String(seed).slice(-12)}`,
    mode,
    dateKey,
    number: mode === 'daily' ? puzzleNumber(config, dateKey) : null,
    seed: String(seed),
    calendar: hiddenYears,
    startYear,
    startYearRange: hiddenYears ? { from: Math.min(...playableYears), to: Math.max(...playableYears) } : null,
    rounds,
    assetIds,
    flags,
    yearGuess
  };
}

// The scenario config narrowed to one puzzle.
function puzzleConfig(config, puzzle) {
  const ids = new Set(puzzle.assetIds);
  return { ...config, assets: config.assets.filter(asset => ids.has(asset.id)), rounds: puzzle.rounds };
}

function headlineById(dataset, id) {
  return id ? dataset.headlines.find(item => item.id === id && item.usable) || null : null;
}

// Headline as shown during play: never a date.
function hiddenDateHeadline(headline) {
  return headline ? { id: headline.id, region: headline.region, outlet: headline.outlet, headline: headline.headline } : null;
}

// What the player may see about the puzzle while playing.
function publicPuzzle(puzzle) {
  return {
    mode: puzzle.mode,
    number: puzzle.number,
    calendar: puzzle.calendar,
    flags: puzzle.flags,
    totalRounds: puzzle.rounds.length,
    startYearRange: puzzle.startYearRange,
    // When years are hidden, round windows are never sent until the reveal.
    periods: puzzle.flags.hiddenYears ? null : puzzle.rounds.map(round => periodLabel(round.decisionMonth, round.revealMonth)),
    yearGuessOptions: puzzle.yearGuess ? puzzle.yearGuess.options : null
  };
}

// Every legal split of `chips` chips over `count` assets with at most `max` on one.
function legalSplits(count, chips, max) {
  const out = [];
  const walk = (index, left, current) => {
    if (index === count - 1) {
      if (left <= max) out.push([...current, left]);
      return;
    }
    for (let take = Math.min(max, left); take >= 0; take -= 1) walk(index + 1, left - take, [...current, take]);
  };
  walk(0, chips, []);
  return out;
}

// Best possible result under the game's rules, by exhaustive search: every
// hold/re-split pattern across the decisions × every legal chip split per segment.
// The winning path is then replayed through valueAt so its rupees match the game.
function hindsightMax(data, pconfig) {
  const ids = pconfig.assets.map(asset => asset.id);
  const rounds = pconfig.rounds;
  const splits = legalSplits(ids.length, pconfig.chipCount, pconfig.maxChipsPerAsset);
  let best = null;
  for (let mask = 0; mask < 1 << (rounds.length - 1); mask += 1) {
    const starts = [0, ...rounds.slice(1).map((_, index) => index + 1).filter(index => mask & (1 << (index - 1)))];
    let gross = 1;
    const plan = [];
    starts.forEach((start, segment) => {
      const end = segment + 1 < starts.length ? starts[segment + 1] - 1 : rounds.length - 1;
      const growth = ids.map(id => grossReturn(data, id, rounds[start].decisionMonth, rounds[end].revealMonth));
      let top = null;
      for (const split of splits) {
        const value = split.reduce((sum, chips, index) => sum + chips * growth[index], 0) / pconfig.chipCount;
        if (!top || value > top.value) top = { value, split };
      }
      gross *= top.value;
      plan.push({ start, split: Object.fromEntries(ids.map((id, index) => [id, top.split[index]])) });
    });
    if (!best || gross > best.gross) best = { gross, plan };
  }
  let wealth = pconfig.startingCapitalInr;
  let positions = null;
  const chartPoints = [wealth];
  const path = rounds.map((round, index) => {
    const step = best.plan.find(item => item.start === index);
    if (step) positions = buyPositions(data, pconfig, wealth, step.split, round.decisionMonth);
    wealth = valueAt(data, pconfig, positions, round.revealMonth).total;
    chartPoints.push(wealth);
    return { round: round.round, action: step ? 'split' : 'hold', chips: step ? step.split : null };
  });
  return { finalWealth: wealth, chartPoints, path };
}

function niftyPath(data, pconfig) {
  const levels = [pconfig.rounds[0].decisionMonth, ...pconfig.rounds.map(round => round.revealMonth)].map(month => niftyLevel(data, pconfig, month));
  if (levels.some(level => !level)) return null;
  return levels.map(level => Math.round(pconfig.startingCapitalInr * level / levels[0]));
}

function titleFor(config, finalWealth, niftyWealth) {
  if (!(niftyWealth > 0)) return null;
  // Rounded so tier boundaries (e.g. exactly +40%) don't wobble on floating point.
  const relative = Math.round((finalWealth / niftyWealth - 1) * 1e8) / 1e6;
  const tier = (config.titles?.tiers || []).find(item => item.below === undefined || relative < item.below);
  return tier ? { name: tier.name, relativePercent: relative } : null;
}

module.exports = {
  istDateKey,
  puzzleNumber,
  seededRandom,
  buildPuzzle,
  puzzleConfig,
  publicPuzzle,
  periodLabel,
  headlineById,
  hiddenDateHeadline,
  legalSplits,
  hindsightMax,
  niftyPath,
  titleFor,
  reportsFor
};
