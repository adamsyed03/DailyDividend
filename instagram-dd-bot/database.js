'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DATABASE_FILE = path.join(__dirname, 'data', 'instagram-dd-bot.db');
const STATUSES = ['DETECTED', 'DRY_RUN', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'];

function postKey(postUrl) {
  try {
    const parsed = new URL(String(postUrl || '').trim());
    const match = parsed.pathname.match(/^\/(?:p|reel|reels|tv)\/([^/]+)/i);
    if (match) return `instagram:${match[1]}`;
  } catch (_) {
    // The admin validator normally guarantees a URL. Retain a stable fallback
    // for older local records instead of making migration destructive.
  }
  return String(postUrl || '').trim();
}

function commentKey(postUrl, comment) {
  const identity = [
    String(postUrl || '').trim(),
    String(comment.username || '').trim().toLowerCase(),
    String(comment.text || '').trim(),
    String(comment.timestamp || '').trim()
  ].join('\u001f');
  return crypto.createHash('sha256').update(identity, 'utf8').digest('hex');
}

class ProcessedCommentDatabase {
  static async open(file = DATABASE_FILE) {
    const wasmFile = require.resolve('sql.js/dist/sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmFile });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const existing = fs.existsSync(file) ? fs.readFileSync(file) : undefined;
    const database = existing ? new SQL.Database(existing) : new SQL.Database();
    const store = new ProcessedCommentDatabase(database, file);
    store.migrate();
    store.persist();
    return store;
  }

  constructor(database, file) {
    this.database = database;
    this.file = file;
  }

  migrate() {
    this.database.run(`
      CREATE TABLE IF NOT EXISTS processed_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_key TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        post_url TEXT NOT NULL,
        post_key TEXT,
        comment_timestamp TEXT,
        detected_at TEXT NOT NULL,
        public_reply_message TEXT,
        public_reply_status TEXT NOT NULL DEFAULT 'DETECTED',
        public_replied_at TEXT,
        dm_message TEXT,
        dm_status TEXT NOT NULL DEFAULT 'DETECTED',
        dm_sent_at TEXT,
        status TEXT NOT NULL CHECK (status IN (${STATUSES.map(value => `'${value}'`).join(', ')})),
        error_message TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_processed_comments_status
      ON processed_comments(status);

      CREATE TABLE IF NOT EXISTS bot_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    const tableInfo = this.database.exec('PRAGMA table_info(processed_comments)');
    const columns = tableInfo.length ? tableInfo[0].values.map(row => row[1]) : [];
    if (!columns.includes('attempt_count')) {
      this.database.run('ALTER TABLE processed_comments ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0');
    }
    if (!columns.includes('post_key')) {
      this.database.run('ALTER TABLE processed_comments ADD COLUMN post_key TEXT');
    }
    const missingPostKeys = this.database.exec('SELECT id, post_url FROM processed_comments WHERE post_key IS NULL');
    if (missingPostKeys.length) {
      for (const [id, postUrl] of missingPostKeys[0].values) {
        this.database.run('UPDATE processed_comments SET post_key = ? WHERE id = ?', [postKey(postUrl), id]);
      }
    }
    this.database.run(`
      CREATE INDEX IF NOT EXISTS idx_processed_comments_post_account
      ON processed_comments(post_key, username)
    `);
  }

  firstRow(sql, parameters = []) {
    const statement = this.database.prepare(sql);
    try {
      statement.bind(parameters);
      return statement.step() ? statement.getAsObject() : null;
    } finally {
      statement.free();
    }
  }

  getRotationIndex() {
    const row = this.firstRow('SELECT value FROM bot_state WHERE key = ?', ['reply_rotation_index']);
    const parsed = row ? Number.parseInt(row.value, 10) : 0;
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  recordDryRun(comment, job, publicReply) {
    const key = commentKey(job.postUrl, comment);
    const now = new Date().toISOString();
    const dmMessage = [job.directMessage.text, job.directMessage.link].filter(Boolean).join('\n');
    this.database.run(`
      INSERT OR IGNORE INTO processed_comments (
        comment_key, username, comment_text, post_url, post_key, comment_timestamp,
        detected_at, public_reply_message, public_reply_status,
        dm_message, dm_status, status, error_message, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRY_RUN', ?, 'DRY_RUN', 'DRY_RUN', NULL, ?)
    `, [
      key,
      comment.username,
      comment.text,
      job.postUrl,
      postKey(job.postUrl),
      comment.timestamp || null,
      now,
      publicReply,
      dmMessage,
      now
    ]);
    const inserted = this.database.getRowsModified() === 1;
    const record = this.firstRow('SELECT * FROM processed_comments WHERE comment_key = ?', [key]);
    if (inserted) this.persist();
    return { inserted, record };
  }

  prepareLive(comment, job, publicReply) {
    const key = commentKey(job.postUrl, comment);
    const now = new Date().toISOString();
    const dmMessage = [job.directMessage.text, job.directMessage.link].filter(Boolean).join('\n');
    const exactRecord = this.firstRow('SELECT * FROM processed_comments WHERE comment_key = ?', [key]);
    if (exactRecord && ['SENT', 'FAILED', 'SKIPPED', 'SENDING'].includes(exactRecord.status)) {
      return { eligible: false, reason: exactRecord.status, record: exactRecord };
    }

    const currentPostKey = postKey(job.postUrl);
    const handledPostAccount = this.firstRow(`
      SELECT * FROM processed_comments
      WHERE post_key = ? AND LOWER(username) = LOWER(?)
        AND (dm_status = 'SENT' OR status = 'SKIPPED')
      ORDER BY id DESC LIMIT 1
    `, [currentPostKey, comment.username]);
    if (handledPostAccount) {
      return { eligible: false, reason: 'POST_ACCOUNT_ALREADY_REPLIED', record: handledPostAccount };
    }

    const partialPostAccount = this.firstRow(`
      SELECT * FROM processed_comments
      WHERE post_key = ? AND LOWER(username) = LOWER(?)
        AND public_reply_status = 'SENT' AND dm_status = 'DETECTED'
      ORDER BY id DESC LIMIT 1
    `, [currentPostKey, comment.username]);
    if (partialPostAccount) {
      return { eligible: true, resumeDmOnly: true, record: partialPostAccount };
    }

    this.database.run(`
      INSERT OR IGNORE INTO processed_comments (
        comment_key, username, comment_text, post_url, post_key, comment_timestamp,
        detected_at, public_reply_message, public_reply_status,
        dm_message, dm_status, status, error_message, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DETECTED', ?, 'DETECTED', 'DETECTED', NULL, ?)
    `, [key, comment.username, comment.text, job.postUrl, currentPostKey, comment.timestamp || null,
      now, publicReply, dmMessage, now]);

    let record = this.firstRow('SELECT * FROM processed_comments WHERE comment_key = ?', [key]);
    if (['SENT', 'FAILED', 'SKIPPED', 'SENDING'].includes(record.status)) {
      this.persist();
      return { eligible: false, reason: record.status, record };
    }

    this.database.run(`
      UPDATE processed_comments
      SET public_reply_message = CASE WHEN public_reply_status = 'SENT' THEN public_reply_message ELSE ? END,
          dm_message = ?,
          public_reply_status = CASE WHEN public_reply_status = 'DRY_RUN' THEN 'DETECTED' ELSE public_reply_status END,
          dm_status = CASE WHEN dm_status = 'DRY_RUN' THEN 'DETECTED' ELSE dm_status END,
          status = 'DETECTED', error_message = NULL, updated_at = ?
      WHERE id = ?
    `, [publicReply, dmMessage, now, record.id]);
    this.persist();
    record = this.firstRow('SELECT * FROM processed_comments WHERE id = ?', [record.id]);
    return { eligible: true, record };
  }

  countSentDmsSince(isoTimestamp) {
    const row = this.firstRow(
      "SELECT COUNT(*) AS count FROM processed_comments WHERE dm_status = 'SENT' AND dm_sent_at >= ?",
      [isoTimestamp]
    );
    return Number(row && row.count) || 0;
  }

  markSending(id) {
    const now = new Date().toISOString();
    this.database.run(`
      UPDATE processed_comments
      SET status = 'SENDING', attempt_count = attempt_count + 1, updated_at = ?
      WHERE id = ?
    `, [now, id]);
    this.persist();
  }

  markPublicReplySent(id) {
    const now = new Date().toISOString();
    this.database.run(`
      UPDATE processed_comments
      SET public_reply_status = 'SENT', public_replied_at = ?, updated_at = ?
      WHERE id = ?
    `, [now, now, id]);
    const nextIndex = this.getRotationIndex() + 1;
    this.database.run(`
      INSERT INTO bot_state (key, value, updated_at) VALUES ('reply_rotation_index', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `, [String(nextIndex), now]);
    this.persist();
  }

  confirmPublicReplySent(id) {
    const record = this.firstRow('SELECT * FROM processed_comments WHERE id = ?', [id]);
    if (!record) throw new Error(`Processed comment ${id} was not found.`);
    const now = new Date().toISOString();
    if (record.public_reply_status !== 'SENT') {
      const nextIndex = this.getRotationIndex() + 1;
      this.database.run(`
        INSERT INTO bot_state (key, value, updated_at) VALUES ('reply_rotation_index', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `, [String(nextIndex), now]);
    }
    this.database.run(`
      UPDATE processed_comments
      SET public_reply_status = 'SENT', public_replied_at = COALESCE(public_replied_at, ?),
          dm_status = CASE WHEN dm_status = 'FAILED' THEN 'DETECTED' ELSE dm_status END,
          status = CASE WHEN dm_status = 'SENT' THEN 'SENT' ELSE 'DETECTED' END,
          error_message = NULL, updated_at = ?
      WHERE id = ?
    `, [now, now, id]);
    this.persist();
  }

  markDmSent(id) {
    const now = new Date().toISOString();
    this.database.run(`
      UPDATE processed_comments
      SET dm_status = 'SENT', dm_sent_at = ?, status = 'SENT', error_message = NULL, updated_at = ?
      WHERE id = ?
    `, [now, now, id]);
    this.persist();
  }

  markFailed(id, stage, error) {
    const now = new Date().toISOString();
    const statusColumn = stage === 'dm' ? 'dm_status' : 'public_reply_status';
    this.database.run(`
      UPDATE processed_comments
      SET ${statusColumn} = 'FAILED', status = 'FAILED', error_message = ?, updated_at = ?
      WHERE id = ?
    `, [String(error || '').slice(0, 2000), now, id]);
    this.persist();
  }

  resetFailedForExplicitRetry(ids) {
    const now = new Date().toISOString();
    for (const id of ids) {
      this.database.run(`
        UPDATE processed_comments
        SET public_reply_status = CASE WHEN public_reply_status = 'FAILED' THEN 'DETECTED' ELSE public_reply_status END,
            dm_status = CASE WHEN dm_status = 'FAILED' THEN 'DETECTED' ELSE dm_status END,
            status = 'DETECTED', error_message = NULL, updated_at = ?
        WHERE id = ? AND status = 'FAILED'
      `, [now, id]);
    }
    this.persist();
  }

  persist() {
    fs.writeFileSync(this.file, Buffer.from(this.database.export()));
  }

  close() {
    this.database.close();
  }
}

module.exports = { DATABASE_FILE, ProcessedCommentDatabase, commentKey, postKey };
