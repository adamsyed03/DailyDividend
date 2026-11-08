'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const initSqlJs = require('sql.js');
const { validateRounds } = require('./engine');

class TimeMachineStore {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.dataDir = path.join(rootDir, 'data', 'indian-time-machine');
    this.dbFile = path.join(this.dataDir, 'indian-time-machine.sqlite');
    this.config = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'scenario_config.json'), 'utf8'));
    this.config.news = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'news.json'), 'utf8'));
    validateRounds(this.config);
    this.db = null;
    this.priceMap = new Map();
    this.fxMap = new Map();
    this.inflationMap = new Map();
    this.writeQueue = Promise.resolve();
    this.ready = this.initialize();
  }

  async initialize() {
    if (!fs.existsSync(this.dbFile)) {
      throw new Error('Indian Time Machine database is missing. Run npm run time-machine:fx and npm run time-machine:import.');
    }
    const SQL = await initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) });
    this.db = new SQL.Database(fs.readFileSync(this.dbFile));
    this.loadMarketCaches();
  }

  rows(sql, params = []) {
    const statement = this.db.prepare(sql);
    try {
      statement.bind(params);
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }

  row(sql, params = []) {
    return this.rows(sql, params)[0] || null;
  }

  loadMarketCaches() {
    for (const row of this.rows('SELECT * FROM prices')) {
      this.priceMap.set(`${row.asset_id}:${row.month}`, {
        price: Number(row.price_native),
        currency: row.native_currency,
        basis: row.price_basis,
        partial: Boolean(row.is_partial_month),
        status: row.verification_status
      });
    }
    for (const row of this.rows('SELECT * FROM fx_month_end')) {
      this.fxMap.set(row.month, { rate: Number(row.inr_per_usd), date: row.observation_date, series: row.series });
    }
    for (const row of this.rows('SELECT * FROM inflation_annual')) {
      this.inflationMap.set(Number(row.year), { year: Number(row.year), percent: Number(row.inflation_percent), series: row.series });
    }
  }

  dataAdapter() {
    return {
      price: (asset, month) => this.priceMap.get(`${asset}:${month}`) || null,
      fx: month => this.fxMap.get(month) || null,
      inflation: year => this.inflationMap.get(Number(year)) || null
    };
  }

  async mutate(callback) {
    const run = this.writeQueue.then(async () => {
      await this.ready;
      const result = await callback();
      const bytes = Buffer.from(this.db.export());
      const tempFile = `${this.dbFile}.tmp`;
      await fsp.writeFile(tempFile, bytes);
      await fsp.rename(tempFile, this.dbFile);
      return result;
    });
    this.writeQueue = run.catch(() => {});
    return run;
  }

  async saveSession(session) {
    return this.mutate(() => {
      this.db.run(`INSERT INTO game_sessions (id, mode, state_json, completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json,
          completed = excluded.completed, updated_at = excluded.updated_at`, [
        session.id,
        session.mode,
        JSON.stringify(session),
        session.completed ? 1 : 0,
        session.createdAt,
        session.updatedAt
      ]);
    });
  }

  async loadSession(id) {
    await this.ready;
    const row = this.row('SELECT state_json FROM game_sessions WHERE id = ?', [id]);
    if (!row) return null;
    try { return JSON.parse(row.state_json); } catch (_) { return null; }
  }

  async saveCompletedSession(session, summary) {
    return this.mutate(() => {
      this.db.run(`UPDATE game_sessions SET state_json = ?, completed = 1, updated_at = ? WHERE id = ?`, [
        JSON.stringify(session), session.updatedAt, session.id
      ]);
      const displayName = `Traveller ${session.id.slice(0, 5).toUpperCase()}`;
      this.db.run(`INSERT OR IGNORE INTO game_results
        (session_id, mode, display_name, final_wealth, return_percent, completed_at, history_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        session.id,
        session.mode,
        displayName,
        summary.finalWealth,
        summary.returnPercent,
        new Date().toISOString(),
        JSON.stringify(summary.history)
      ]);
      return displayName;
    });
  }

  async leaderboard(mode = 'story', limit = 10) {
    await this.ready;
    return this.rows(`SELECT display_name, final_wealth, return_percent, completed_at
      FROM game_results WHERE mode = ? ORDER BY final_wealth DESC, completed_at ASC LIMIT ?`, [mode, limit])
      .map((row, index) => ({
        rank: index + 1,
        displayName: row.display_name,
        finalWealth: Number(row.final_wealth),
        returnPercent: Number(row.return_percent),
        completedAt: row.completed_at
      }));
  }

  async rankFor(sessionId, mode, wealth) {
    await this.ready;
    const row = this.row('SELECT COUNT(*) AS better FROM game_results WHERE mode = ? AND final_wealth > ?', [mode, wealth]);
    const result = this.row('SELECT COUNT(*) AS total FROM game_results WHERE mode = ?', [mode]);
    const exists = this.row('SELECT 1 AS found FROM game_results WHERE session_id = ?', [sessionId]);
    return { rank: Number(row?.better || 0) + (exists ? 1 : 0), total: Number(result?.total || 0) };
  }

  async resultForSession(sessionId) {
    await this.ready;
    const row = this.row(`SELECT display_name, final_wealth, return_percent, completed_at
      FROM game_results WHERE session_id = ?`, [sessionId]);
    return row ? {
      displayName: row.display_name,
      finalWealth: Number(row.final_wealth),
      returnPercent: Number(row.return_percent),
      completedAt: row.completed_at
    } : null;
  }

  async health() {
    await this.ready;
    const requiredMonths = [...new Set(this.config.rounds.flatMap(round => [round.decisionMonth, round.revealMonth]))].sort();
    const requiredAssets = this.config.assets.filter(asset => asset.id !== 'CASH_INR').map(asset => asset.id);
    const missingPrices = [];
    for (const asset of requiredAssets) {
      for (const month of requiredMonths) if (!this.priceMap.has(`${asset}:${month}`)) missingPrices.push(`${asset} · ${month}`);
    }
    const missingFxMonths = requiredMonths.filter(month => !this.fxMap.has(month));
    const missingInflationYears = [2022, 2023, 2024].filter(year => !this.inflationMap.has(year));
    const sources = this.rows('SELECT name, source_type, row_count, verification_status, imported_at FROM source_files ORDER BY id');
    return {
      ready: !missingPrices.length && !missingFxMonths.length && !missingInflationYears.length,
      priceRows: Number(this.row('SELECT COUNT(*) AS count FROM prices')?.count || 0),
      fxMonths: Number(this.row('SELECT COUNT(*) AS count FROM fx_month_end')?.count || 0),
      inflationYears: Number(this.row('SELECT COUNT(*) AS count FROM inflation_annual')?.count || 0),
      corporateEvents: Number(this.row('SELECT COUNT(*) AS count FROM corporate_events')?.count || 0),
      availableMonths: requiredMonths,
      missingPrices,
      missingFxMonths,
      missingInflationYears,
      goldInstrumentVerified: false,
      screenshotAuditComplete: false,
      sources
    };
  }
}

module.exports = { TimeMachineStore };
