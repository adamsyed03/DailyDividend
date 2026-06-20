const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STATE_ID = process.env.SUPABASE_STATE_ID || 'default';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.');
  process.exit(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

function loadEnv() {
  const envFile = path.join(__dirname, '..', '.env');
  try {
    const lines = require('fs').readFileSync(envFile, 'utf8').split(/\r?\n/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function main() {
  const dbFile = path.join(__dirname, '..', 'data', 'daily-dividend-db.json');
  const raw = await fs.readFile(dbFile, 'utf8');
  const data = JSON.parse(raw);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const { error } = await supabase
    .from('daily_dividend_state')
    .upsert({
      id: SUPABASE_STATE_ID,
      data,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
  console.log(`Pushed local Daily Dividend state to Supabase row "${SUPABASE_STATE_ID}".`);
}
