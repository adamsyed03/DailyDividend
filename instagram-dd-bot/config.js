'use strict';

const fs = require('fs');
const path = require('path');

const BOT_DIR = __dirname;
const DEFAULTS = Object.freeze({
  browser_profile_dir: 'browser-profile',
  browser_channel: 'chrome',
  browser_locale: 'en-US',
  navigation_timeout_seconds: 60,
  manual_login_timeout_seconds: 600,
  session_check_interval_seconds: 3,
  log_level: 'INFO'
});

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function loadConfig() {
  const configPath = path.join(BOT_DIR, 'config.json');
  let values = { ...DEFAULTS };
  if (fs.existsSync(configPath)) {
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
      throw new Error('config.json must contain a JSON object.');
    }
    const unknown = Object.keys(loaded).filter(key => !(key in DEFAULTS));
    if (unknown.length) throw new Error(`Unknown config keys: ${unknown.join(', ')}`);
    values = { ...values, ...loaded };
  }

  if (typeof values.browser_profile_dir !== 'string' || !values.browser_profile_dir.trim()) {
    throw new Error('browser_profile_dir must be a non-empty string.');
  }
  if (typeof values.browser_channel !== 'string') throw new Error('browser_channel must be a string.');
  if (typeof values.browser_locale !== 'string' || !values.browser_locale.trim()) {
    throw new Error('browser_locale must be a non-empty string.');
  }

  const profile = path.isAbsolute(values.browser_profile_dir)
    ? values.browser_profile_dir
    : path.join(BOT_DIR, values.browser_profile_dir);

  return {
    browserProfileDir: path.resolve(profile),
    browserChannel: values.browser_channel.trim(),
    browserLocale: values.browser_locale.trim(),
    navigationTimeoutMs: positiveInteger(values.navigation_timeout_seconds, 'navigation_timeout_seconds') * 1000,
    manualLoginTimeoutMs: positiveInteger(values.manual_login_timeout_seconds, 'manual_login_timeout_seconds') * 1000,
    sessionCheckIntervalMs: positiveInteger(values.session_check_interval_seconds, 'session_check_interval_seconds') * 1000,
    logLevel: String(values.log_level || 'INFO').toUpperCase()
  };
}

module.exports = { loadConfig };
