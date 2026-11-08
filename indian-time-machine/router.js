'use strict';

const crypto = require('crypto');
const express = require('express');
const { TimeMachineStore } = require('./store');
const { CASH_ID, ENGINE_VERSION, createSession, publicRound, lockRound, decisionState, completeGame, finalSummary, grossReturn } = require('./engine');
const {
  istDateKey, puzzleNumber, buildPuzzle, puzzleConfig, publicPuzzle, periodLabel,
  headlineById, hiddenDateHeadline, hindsightMax, niftyPath, titleFor
} = require('./puzzle');
const { shiftMonth, lastDayOfMonth } = require('./dataset');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = month => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

function validSessionId(value) {
  return typeof value === 'string' && /^[a-f0-9]{48}$/.test(value);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function createTimeMachineRouter({ rootDir }) {
  const router = express.Router();
  const store = new TimeMachineStore(rootDir);
  const data = () => store.dataAdapter();
  let lockQueue = Promise.resolve();

  function serializedLock(callback) {
    const operation = lockQueue.then(callback, callback);
    lockQueue = operation.catch(() => {});
    return operation;
  }

  async function sessionOr404(sessionId) {
    if (!validSessionId(sessionId)) throw httpError(404, 'Game session not found.');
    const session = await store.loadSession(sessionId);
    if (!session) throw httpError(404, 'Game session not found.');
    if (session.engineVersion !== ENGINE_VERSION) throw httpError(410, 'This game was started on an older version. Start a new one.');
    return session;
  }

  const pconfigFor = session => puzzleConfig(store.config, session.puzzle);

  function roundView(session, round, wealth) {
    const pconfig = pconfigFor(session);
    const view = publicRound(data(), pconfig, round, wealth);
    const { flags } = session.puzzle;
    view.period = flags.hiddenYears ? null : periodLabel(round.decisionMonth, round.revealMonth);
    view.months = (Number(round.revealMonth.slice(0, 4)) - Number(round.decisionMonth.slice(0, 4))) * 12 + Number(round.revealMonth.slice(5)) - Number(round.decisionMonth.slice(5));
    view.clues = flags.clues ? (round.clueIds || []).map(id => hiddenDateHeadline(headlineById(store.dataset, id))).filter(Boolean) : [];
    return view;
  }

  // Merged "round result + next move" payload.
  function outcomeView(session) {
    const { reveal, isFinal } = session.lastOutcome;
    const pconfig = pconfigFor(session);
    const { flags } = session.puzzle;
    const round = pconfig.rounds[reveal.round - 1];
    const initial = store.config.startingCapitalInr;
    const nifty = flags.roundNifty ? niftyPath(data(), pconfig) : null;
    const view = {
      reveal: {
        round: reveal.round,
        startWealth: reveal.startWealth,
        endWealth: reveal.endWealth,
        returnPercent: (reveal.endWealth / reveal.startWealth - 1) * 100,
        sinceStartPercent: (reveal.endWealth / initial - 1) * 100,
        niftyReturnPercent: flags.roundNifty ? reveal.niftyReturnPercent : null,
        strategy: reveal.strategy,
        period: flags.hiddenYears ? null : periodLabel(round.decisionMonth, round.revealMonth),
        assets: reveal.assets.map(({ id, name, color, chips, startValue, endValue, returnPercent }) => ({ id, name, color, chips, startValue, endValue, returnPercent })),
        holdings: reveal.holdings
      },
      during: hiddenDateHeadline(headlineById(store.dataset, round.duringId)),
      chart: {
        you: [initial, ...session.history.map(item => item.endWealth)],
        nifty: nifty ? nifty.slice(0, session.history.length + 1) : null,
        totalRounds: pconfig.rounds.length
      },
      isFinal
    };
    if (!isFinal) {
      const next = decisionState(data(), pconfig, session);
      view.next = { ...next, current: roundView(session, pconfig.rounds[session.roundIndex], session.wealth) };
    }
    return view;
  }

  function windowHeadlines(session) {
    const rounds = session.puzzle.rounds;
    const windowMonths = store.config.featureFlags?.clues?.windowMonths || 3;
    const opens = lastDayOfMonth(shiftMonth(rounds[0].decisionMonth, -windowMonths));
    const closes = store.dataset.decisionDate(rounds.at(-1).revealMonth);
    return store.dataset.headlines
      .filter(item => item.usable && item.date > opens && item.date <= closes)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ id, date, region, outlet, headline, url, roundRole, summary }) => ({ id, date, region, outlet, headline, url, roundRole, summary }));
  }

  function whyItMoved(session, pconfig) {
    const rounds = pconfig.rounds;
    const risky = pconfig.assets.filter(asset => asset.id !== CASH_ID);
    const ranked = risky
      .map(asset => ({ asset, gross: grossReturn(data(), asset.id, rounds[0].decisionMonth, rounds.at(-1).revealMonth) }))
      .sort((a, b) => b.gross - a.gross);
    const picks = [{ kind: 'winner', ...ranked[0] }];
    if (ranked.length > 1 && ranked.at(-1).gross < 1) picks.push({ kind: 'loser', ...ranked.at(-1) });
    const opens = store.dataset.decisionDate(rounds[0].decisionMonth);
    const closes = store.dataset.decisionDate(rounds.at(-1).revealMonth);
    return picks.map(({ kind, asset, gross }) => {
      // Prefer the tagged headline from the round where this asset moved most.
      const tagged = store.dataset.headlines.filter(item => item.usable && item.roundRole === 'during'
        && item.tags.includes(asset.id) && item.date > opens && item.date <= closes);
      if (!tagged.length) return null;
      const roundMoves = rounds.map(round => ({ round, move: Math.abs(grossReturn(data(), asset.id, round.decisionMonth, round.revealMonth) - 1) }))
        .sort((a, b) => b.move - a.move);
      let story = null;
      for (const { round } of roundMoves) {
        const from = store.dataset.decisionDate(round.decisionMonth);
        const to = store.dataset.decisionDate(round.revealMonth);
        story = tagged.find(item => item.date > from && item.date <= to);
        if (story) break;
      }
      story = story || tagged[0];
      return {
        kind,
        assetId: asset.id,
        assetName: asset.shortName,
        returnPercent: (gross - 1) * 100,
        headline: story.headline,
        summary: story.summary,
        outlet: story.outlet,
        url: story.url,
        date: story.date,
        decoded: asset.decodedSlug ? { href: `/rabbit-holes/${asset.decodedSlug}`, title: asset.decodedTitle || `${asset.shortName}, decoded` } : null
      };
    }).filter(Boolean);
  }

  function finalView(session, leaderboard) {
    const pconfig = pconfigFor(session);
    const { flags } = session.puzzle;
    const summary = finalSummary(data(), pconfig, session);
    const rounds = pconfig.rounds;
    const periods = rounds.map(round => periodLabel(round.decisionMonth, round.revealMonth));
    const nifty = flags.roundNifty ? niftyPath(data(), pconfig) : null;
    const first = rounds[0].decisionMonth;
    const last = rounds.at(-1).revealMonth;
    const windowLabel = session.puzzle.calendar
      ? `${session.puzzle.startYear} → ${session.puzzle.startYear + rounds.length - 1}`
      : `${monthLabel(shiftMonth(first, 1))} → ${monthLabel(last)}`;
    return {
      ...summary,
      puzzle: { ...publicPuzzle(session.puzzle), periods, windowLabel, startYear: session.puzzle.startYear },
      chartLabels: session.puzzle.calendar
        ? [String(session.puzzle.startYear - 1), ...rounds.map(round => round.revealMonth.slice(0, 4))]
        : [rounds[0].decisionMonth, ...rounds.map(round => round.revealMonth)].map(month => `${MONTHS[Number(month.slice(5)) - 1]} ’${month.slice(2, 4)}`),
      niftyPath: nifty,
      hindsight: hindsightMax(data(), pconfig),
      title: flags.niftyTitles ? titleFor(store.config, summary.finalWealth, summary.nifty50Wealth) : null,
      rounds: session.history.map((item, index) => ({
        round: item.round,
        period: periods[index],
        returnPercent: (item.endWealth / item.startWealth - 1) * 100,
        niftyReturnPercent: flags.roundNifty ? item.niftyReturnPercent : null,
        beatNifty: flags.roundNifty && Number.isFinite(item.niftyReturnPercent) ? (item.endWealth / item.startWealth - 1) * 100 > item.niftyReturnPercent : null
      })),
      ledger: pconfig.assets.map(asset => ({
        id: asset.id,
        name: asset.shortName,
        color: asset.color,
        returns: session.history.map(item => item.assets.find(row => row.id === asset.id)?.returnPercent ?? null),
        chips: session.history.map(item => item.chips[asset.id] || 0)
      })),
      whyItMoved: whyItMoved(session, pconfig),
      chronicle: windowHeadlines(session),
      yearGuess: session.yearGuess || null,
      leaderboard
    };
  }

  router.get('/config', (req, res) => res.json({
    startingCapitalInr: store.config.startingCapitalInr,
    chipCount: store.config.chipCount,
    maxChipsPerAsset: store.config.maxChipsPerAsset,
    titles: store.config.titles
  }));

  router.get('/today', (req, res) => {
    const dateKey = istDateKey();
    res.json({ dateKey, number: puzzleNumber(store.config, dateKey) });
  });

  router.post('/start', async (req, res, next) => {
    try {
      await store.ready;
      const mode = req.body?.mode === 'unlimited' ? 'unlimited' : 'daily';
      const dateKey = istDateKey();
      const seed = mode === 'daily' ? `daily:${dateKey}` : `unlimited:${crypto.randomBytes(12).toString('hex')}`;
      const puzzle = buildPuzzle(store.dataset, store.config, { mode, dateKey, seed });
      const session = createSession(store.config, mode, puzzle);
      await store.saveSession(session);
      res.status(201).json({
        sessionId: session.id,
        mode,
        puzzle: publicPuzzle(puzzle),
        stage: 'allocation',
        current: roundView(session, puzzle.rounds[0], session.wealth)
      });
    } catch (error) { next(error); }
  });

  router.get('/session/:sessionId', async (req, res, next) => {
    try {
      const session = await sessionOr404(req.params.sessionId);
      const base = { sessionId: session.id, mode: session.mode, puzzle: publicPuzzle(session.puzzle), stage: session.stage };
      if (session.completed) {
        const final = finalView(session, await store.rankFor(session, Math.round(session.wealth)));
        final.displayName = (await store.resultForSession(session.id))?.displayName || null;
        return res.json({ ...base, final });
      }
      if (session.stage === 'allocation') {
        return res.json({ ...base, current: roundView(session, session.puzzle.rounds[0], session.wealth) });
      }
      res.json({ ...base, outcome: outcomeView(session) });
    } catch (error) { next(error); }
  });

  async function playRound(req, rebalance) {
    return serializedLock(async () => {
      const session = await sessionOr404(req.body?.sessionId);
      lockRound(data(), pconfigFor(session), session, rebalance ? (req.body?.allocations || {}) : null, { rebalance });
      await store.saveSession(session);
      return { sessionId: session.id, stage: session.stage, outcome: outcomeView(session) };
    });
  }

  router.post('/lock', async (req, res, next) => {
    try { res.json(await playRound(req, true)); } catch (error) {
      if (/Chips|Allocate exactly|unknown asset|already|stage/.test(error.message)) error.status = error.status || 400;
      next(error);
    }
  });

  router.post('/advance', async (req, res, next) => {
    try { res.json(await playRound(req, req.body?.action === 'reshuffle')); } catch (error) {
      if (/Chips|Allocate exactly|unknown asset|already|stage/.test(error.message)) error.status = error.status || 400;
      next(error);
    }
  });

  router.post('/finish', async (req, res, next) => {
    try {
      const payload = await serializedLock(async () => {
        const session = await sessionOr404(req.body?.sessionId);
        if (session.puzzle.yearGuess && session.stage === 'final-pending') {
          const guess = Number(req.body?.yearGuess);
          if (!session.puzzle.yearGuess.options.includes(guess)) throw httpError(400, 'Pick one of the four years.');
          session.yearGuess = { guess, correct: guess === session.puzzle.startYear, answer: session.puzzle.startYear };
        }
        const summary = completeGame(data(), pconfigFor(session), session);
        const displayName = await store.saveCompletedSession(session, summary);
        const final = finalView(session, await store.rankFor(session, summary.finalWealth));
        final.displayName = displayName;
        return { sessionId: session.id, stage: 'complete', final };
      });
      res.json(payload);
    } catch (error) {
      if (/not ready/.test(error.message)) error.status = 400;
      next(error);
    }
  });

  router.get('/leaderboard', async (req, res, next) => {
    try {
      const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : istDateKey();
      res.json({ puzzle: `daily-${dateKey}`, entries: await store.leaderboard(`daily-${dateKey}`) });
    } catch (error) { next(error); }
  });

  router.get('/health', async (req, res, next) => {
    try { res.json(await store.health()); } catch (error) { next(error); }
  });

  router.use((error, req, res, next) => {
    console.error('[time-machine]', error.message);
    const status = error.status || (/database is missing|Missing USD\/INR/.test(error.message) ? 503 : 500);
    res.status(status).json({ error: status === 500 ? 'The time machine hit a setup error.' : error.message });
  });

  return router;
}

module.exports = { createTimeMachineRouter, istDateKey };
