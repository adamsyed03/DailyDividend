PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS source_files (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prices (
  asset_id TEXT NOT NULL,
  month TEXT NOT NULL,
  native_currency TEXT NOT NULL,
  price_native REAL NOT NULL CHECK (price_native > 0),
  price_basis TEXT NOT NULL,
  is_partial_month INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL,
  provenance TEXT,
  PRIMARY KEY (asset_id, month)
);

CREATE TABLE IF NOT EXISTS fx_month_end (
  month TEXT PRIMARY KEY,
  inr_per_usd REAL NOT NULL CHECK (inr_per_usd > 0),
  observation_date TEXT NOT NULL,
  series TEXT NOT NULL DEFAULT 'DEXINUS',
  source_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inflation_annual (
  year INTEGER PRIMARY KEY,
  inflation_percent REAL NOT NULL,
  region TEXT NOT NULL,
  series TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS corporate_events (
  id INTEGER PRIMARY KEY,
  asset_id TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reported_value TEXT,
  units TEXT,
  source TEXT,
  processing_instruction TEXT
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  state_json TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS game_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  display_name TEXT NOT NULL,
  final_wealth REAL NOT NULL,
  return_percent REAL NOT NULL,
  completed_at TEXT NOT NULL,
  history_json TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES game_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_results_mode_wealth
  ON game_results(mode, final_wealth DESC);

