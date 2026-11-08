'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const initSqlJs = require('sql.js');
const { validateRounds, ENGINE_VERSION } = require('./engine');
const { loadDataset } = require('./dataset');
const { reportsFor } = require('./puzzle');

// Market data comes from the CSV files via dataset.js (the same loader the
// validator uses). SQLite holds game sessions and results.
class TimeMachineStore {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.dataDir = path.join(rootDir, 'data', 'indian-time-machine');
    this.dbFile = path.join(this.dataDir, 'indian-time-machine.sqlite');
    this.config = JSON.parse(fs.readFileSync(path.join(this.dataDir, 'scenario_config.json'), 'utf8'));
    validateRounds(this.config);
    this.dataset = loadDataset(this.dataDir, this.config);
    this.db = null;
    this.writeQueue = Promise.resolve();
    this.ready = this.initialize();
  }

  async initialize() {
    if (!fs.existsSync(this.dbFile)) {
      throw new Error('Indian Time Machine database is missing. Run npm run time-machine:import.');
    }
    const SQL = await initSqlJs({ locateFile: file => require.resolve(`sql.js/dist/${file}`) });
    this.db = new SQL.Database(fs.readFileSync(this.dbFile));
    await this.migrate();
  }

  // v3 results are scored with 0%-nominal cash and continuous rounds. Rows scored
  // under the old rules are moved (not deleted) to game_results_v1_archive.
  async migrate() {
    const columns = this.rows('PRAGMA table_info(game_results)').map(row => row.name);
    if (columns.includes('engine_version')) return;
    await this.mutate(() => {
      this.db.run(`CREATE TABLE IF NOT EXISTS game_results_v1_archive (
        id INTEGER PRIMARY KEY, session_id TEXT NOT NULL, mode TEXT NOT NULL, display_name TEXT NOT NULL,
        final_wealth REAL NOT NULL, return_percent REAL NOT NULL, completed_at TEXT NOT NULL,
        history_json TEXT NOT NULL, archived_at TEXT NOT NULL, archive_reason TEXT NOT NULL)`);
      this.db.run(`INSERT INTO game_results_v1_archive
        (id, session_id, mode, display_name, final_wealth, return_percent, completed_at, history_json, archived_at, archive_reason)
        SELECT id, session_id, mode, display_name, final_wealth, return_percent, completed_at, history_json, ?, ?
        FROM game_results`, [new Date().toISOString(), 'Scored before engine v3 (cash deflated by CPI; hidden Jun–Dec 2023 hold)']);
      this.db.run('DELETE FROM game_results');
      this.db.run('ALTER TABLE game_results ADD COLUMN engine_version INTEGER');
      this.db.run('ALTER TABLE game_results ADD COLUMN puzzle_id TEXT');
      this.db.run('ALTER TABLE game_results ADD COLUMN date_key TEXT');
      this.db.run('ALTER TABLE game_results ADD COLUMN puzzle_no INTEGER');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_results_puzzle_wealth ON game_results(puzzle_id, final_wealth DESC)');
    }, { skipReady: true });
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

  dataAdapter() {
    return this.dataset.adapter;
  }

  async mutate(callback, { skipReady = false } = {}) {
    const run = this.writeQueue.then(async () => {
      if (!skipReady) await this.ready;
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
        session.id, session.mode, JSON.stringify(session), session.completed ? 1 : 0, session.createdAt, session.updatedAt
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
      this.db.run('UPDATE game_sessions SET state_json = ?, completed = 1, updated_at = ? WHERE id = ?', [
        JSON.stringify(session), session.updatedAt, session.id
      ]);
      const displayName = `Traveller ${session.id.slice(0, 5).toUpperCase()}`;
      this.db.run(`INSERT OR IGNORE INTO game_results
        (session_id, mode, display_name, final_wealth, return_percent, completed_at, history_json, engine_version, puzzle_id, date_key, puzzle_no)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        session.id, session.mode, displayName, summary.finalWealth, summary.returnPercent, new Date().toISOString(),
        JSON.stringify(summary.history.map(({ round, startWealth, endWealth, allocations }) => ({ round, startWealth, endWealth, allocations }))),
        ENGINE_VERSION, session.puzzle.id, session.puzzle.dateKey, session.puzzle.number
      ]);
      return displayName;
    });
  }

  // Daily puzzles only: unlimited games never count towards a ranking.
  async rankFor(session, wealth) {
    await this.ready;
    if (session.mode !== 'daily') return null;
    const puzzleId = session.puzzle.id;
    const better = Number(this.row('SELECT COUNT(*) AS n FROM game_results WHERE puzzle_id = ? AND final_wealth > ?', [puzzleId, wealth])?.n || 0);
    const total = Number(this.row('SELECT COUNT(*) AS n FROM game_results WHERE puzzle_id = ?', [puzzleId])?.n || 0);
    const rank = better + 1;
    return { rank, total, percentile: total ? Math.max(1, Math.ceil((rank / total) * 100)) : null };
  }

  async leaderboard(puzzleId, limit = 10) {
    await this.ready;
    return this.rows(`SELECT display_name, final_wealth, return_percent, completed_at
      FROM game_results WHERE puzzle_id = ? ORDER BY final_wealth DESC, completed_at ASC LIMIT ?`, [puzzleId, limit])
      .map((row, index) => ({
        rank: index + 1,
        displayName: row.display_name,
        finalWealth: Number(row.final_wealth),
        returnPercent: Number(row.return_percent),
        completedAt: row.completed_at
      }));
  }

  async resultForSession(sessionId) {
    await this.ready;
    const row = this.row('SELECT display_name, final_wealth FROM game_results WHERE session_id = ?', [sessionId]);
    return row ? { displayName: row.display_name, finalWealth: Number(row.final_wealth) } : null;
  }

  async health() {
    await this.ready;
    const reports = reportsFor(this.dataset, this.config);
    const legacy = reports.legacy;
    const playable = reports.startYears.filter(report => report.playable).map(report => report.startYear);
    return {
      ready: legacy.pricesReady,
      priceRows: this.dataset.prices.size,
      fxMonths: this.dataset.fx.size,
      inflationYears: this.dataset.inflation.size,
      headlines: this.dataset.headlines.length,
      flaggedHeadlines: this.dataset.headlines.filter(item => !item.usable).map(item => ({ id: item.id, issues: item.issues })),
      legacyWindow: {
        rounds: legacy.rounds.map(round => `${round.decisionMonth} → ${round.revealMonth}`),
        readyAssets: legacy.readyAssets,
        roundNifty: legacy.roundNiftyReady,
        overallNifty: legacy.overallNiftyReady,
        clues: legacy.cluesReady
      },
      playableStartYears: playable,
      archivedV1Results: Number(this.row("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'game_results_v1_archive'")?.n)
        ? Number(this.row('SELECT COUNT(*) AS n FROM game_results_v1_archive')?.n || 0)
        : 0,
      goldInstrumentVerified: false
    };
  }
}

module.exports = { TimeMachineStore };
