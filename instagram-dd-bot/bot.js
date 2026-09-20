'use strict';

const { loadConfig } = require('./config');
const { InstagramBrowser, InstagramSafetyStop } = require('./instagram');

function log(level, message) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const output = `[${time}] ${level}: ${message}`;
  if (level === 'ERROR' || level === 'CRITICAL') console.error(output);
  else console.log(output);
}

async function main() {
  const allowed = new Set(['--login-only', '--dry-run', '--live']);
  const unknown = process.argv.slice(2).filter(argument => !allowed.has(argument));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(', ')}`);

  if (process.argv.includes('--live')) log('WARNING', 'LIVE MODE REQUESTED, but Phase 1 cannot send Instagram replies or DMs.');
  else log('INFO', 'LOGIN-ONLY MODE: no Instagram replies or DMs can be sent.');

  const browser = new InstagramBrowser(loadConfig(), log);
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    log('INFO', 'Closing the Instagram browser safely.');
    await browser.close();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);

  try {
    await browser.start();
    await browser.openForManualLogin();
  } catch (error) {
    if (error instanceof InstagramSafetyStop) {
      log('CRITICAL', `SAFETY STOP: ${error.message}`);
      process.exitCode = 3;
    } else {
      throw error;
    }
  } finally {
    await close();
  }
}

main().catch(error => {
  log('ERROR', error.stack || error.message);
  process.exitCode = 1;
});
