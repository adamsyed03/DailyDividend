'use strict';

const express = require('express');
const { TimeMachineStore } = require('./store');
const { createSession, publicRound, lockRound, finishNewspaper, currentPortfolio, finalSummary, ENGINE_VERSION } = require('./engine');

function budapestDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function validSessionId(value) {
  return typeof value === 'string' && /^[a-f0-9]{48}$/.test(value);
}

function publicConfig(config) {
  return {
    startingCapitalInr: config.startingCapitalInr,
    chipCount: config.chipCount,
    maxChipsPerAsset: config.maxChipsPerAsset,
    assets: config.assets.map(({ id, name, shortName, currency, color, explanation }) => ({ id, name, shortName, currency, color, explanation })),
    rounds: config.rounds.map(({ round }) => ({ round, label: `Round ${round}` }))
  };
}

function createTimeMachineRouter({ rootDir }) {
  const router = express.Router();
  const store = new TimeMachineStore(rootDir);
  let lockQueue = Promise.resolve();

  function serializedLock(callback) {
    const operation = lockQueue.then(callback, callback);
    lockQueue = operation.catch(() => {});
    return operation;
  }

  router.get('/config', (req, res) => res.json(publicConfig(store.config)));

  router.post('/start', async (req, res, next) => {
    try {
      await store.ready;
      const mode = req.body?.mode === 'daily' ? 'daily' : 'story';
      const session = createSession(store.config, mode, budapestDateKey());
      await store.saveSession(session);
      const round = store.config.rounds[session.roundIndex];
      res.status(201).json({
        sessionId: session.id,
        mode,
        current: publicRound(store.dataAdapter(), store.config, round, session.wealth)
      });
    } catch (error) { next(error); }
  });

  router.get('/session/:sessionId', async (req, res, next) => {
    try {
      if (!validSessionId(req.params.sessionId)) return res.status(404).json({ error: 'Game session not found.' });
      const session = await store.loadSession(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Game session not found.' });
      if (session.engineVersion !== ENGINE_VERSION) return res.status(410).json({ error: 'This game was started on an older version. Start a new one.' });
      if (session.completed) {
        const final = finalSummary(store.dataAdapter(), store.config, session);
        const storedResult = await store.resultForSession(session.id);
        final.displayName = storedResult?.displayName || null;
        final.leaderboard = await store.rankFor(session.id, session.mode, final.finalWealth);
        return res.json({ sessionId: session.id, mode: session.mode, completed: true, final, newspaper: session.lastNewspaper || null });
      }
      if (session.stage === 'newspaper' && session.pendingOutcome) {
        return res.json({
          sessionId: session.id,
          mode: session.mode,
          completed: false,
          stage: 'newspaper',
          outcome: session.pendingOutcome
        });
      }
      const round = store.config.rounds[session.roundIndex];
      res.json({
        sessionId: session.id,
        mode: session.mode,
        completed: false,
        stage: session.stage || 'allocation',
        current: publicRound(store.dataAdapter(), store.config, round, session.wealth),
        portfolio: session.positions ? currentPortfolio(store.dataAdapter(), store.config, session) : null,
        prefillAllocations: { ...(session.lastAllocations || {}) },
        newspaper: session.lastNewspaper || null
      });
    } catch (error) { next(error); }
  });

  router.post('/lock', async (req, res, next) => {
    try {
      const sessionId = req.body?.sessionId;
      if (!validSessionId(sessionId)) return res.status(404).json({ error: 'Game session not found.' });
      const payload = await serializedLock(async () => {
        const session = await store.loadSession(sessionId);
        if (!session) {
          const error = new Error('Game session not found.');
          error.status = 404;
          throw error;
        }
        if (session.engineVersion !== ENGINE_VERSION) {
          const error = new Error('This game was started on an older version. Start a new one.');
          error.status = 410;
          throw error;
        }
        const outcome = lockRound(store.dataAdapter(), store.config, session, req.body?.allocations || {}, { rebalance: true });
        await store.saveSession(session);
        return { sessionId, mode: session.mode, ...outcome };
      });
      res.json(payload);
    } catch (error) {
      if (/Chips|Allocate exactly|unknown asset|already/.test(error.message)) error.status = 400;
      next(error);
    }
  });

  router.post('/advance', async (req, res, next) => {
    try {
      const sessionId = req.body?.sessionId;
      if (!validSessionId(sessionId)) return res.status(404).json({ error: 'Game session not found.' });
      const payload = await serializedLock(async () => {
        const session = await store.loadSession(sessionId);
        if (!session) {
          const error = new Error('Game session not found.');
          error.status = 404;
          throw error;
        }
        if (session.engineVersion !== ENGINE_VERSION) {
          const error = new Error('This game was started on an older version. Start a new one.');
          error.status = 410;
          throw error;
        }
        const rebalance = req.body?.action === 'reshuffle';
        const outcome = lockRound(
          store.dataAdapter(),
          store.config,
          session,
          rebalance ? (req.body?.allocations || {}) : null,
          { rebalance }
        );
        await store.saveSession(session);
        return { sessionId, mode: session.mode, ...outcome };
      });
      res.json(payload);
    } catch (error) {
      if (/Chips|Allocate exactly|unknown asset|already|stage/.test(error.message)) error.status = 400;
      next(error);
    }
  });

  router.post('/newspaper/continue', async (req, res, next) => {
    try {
      const sessionId = req.body?.sessionId;
      if (!validSessionId(sessionId)) return res.status(404).json({ error: 'Game session not found.' });
      const payload = await serializedLock(async () => {
        const session = await store.loadSession(sessionId);
        if (!session) {
          const error = new Error('Game session not found.');
          error.status = 404;
          throw error;
        }
        if (session.engineVersion !== ENGINE_VERSION) {
          const error = new Error('This game was started on an older version. Start a new one.');
          error.status = 410;
          throw error;
        }
        const result = finishNewspaper(store.dataAdapter(), store.config, session);
        if (result.completed) {
          const displayName = await store.saveCompletedSession(session, result.final);
          result.final.displayName = displayName;
          result.final.leaderboard = await store.rankFor(session.id, session.mode, result.final.finalWealth);
        } else {
          await store.saveSession(session);
        }
        return { sessionId, mode: session.mode, ...result };
      });
      res.json(payload);
    } catch (error) {
      if (/newspaper|stage/.test(error.message)) error.status = 400;
      next(error);
    }
  });

  router.get('/leaderboard', async (req, res, next) => {
    try {
      const mode = req.query.mode === 'daily' ? 'daily' : 'story';
      res.json({ mode, entries: await store.leaderboard(mode) });
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

module.exports = { createTimeMachineRouter, budapestDateKey };
