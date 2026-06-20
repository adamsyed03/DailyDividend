const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_LOGO_BUCKET || 'company-logos';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.');
  process.exit(1);
}

const uploads = [
  { source: 'DD logo.png', target: 'brand/dd-logo.png' },
  { source: 'netflix logo.png', target: 'netflix.png' },
  { source: 'visalogo.png', target: 'visa.png' }
];

main().catch(error => {
  console.error(error);
  process.exit(1);
});

function loadEnv() {
  const envFile = path.join(__dirname, '..', '.env');
  if (!fsSync.existsSync(envFile)) return;
  fsSync.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  if (!buckets.some(bucket => bucket.id === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    });
    if (error) throw error;
    console.log(`Created public Supabase Storage bucket "${BUCKET}".`);
  }

  for (const item of uploads) {
    const filePath = path.join(__dirname, '..', 'Site Pics', item.source);
    const file = await fs.readFile(filePath);
    const { error } = await supabase.storage.from(BUCKET).upload(item.target, file, {
      contentType: 'image/png',
      cacheControl: '604800',
      upsert: true
    });
    if (error) throw error;
    console.log(`Uploaded ${item.target}.`);
  }
}
