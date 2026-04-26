const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5173;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const REPORT_REQUESTS_FILE = path.join(DATA_DIR, 'report-requests.json');
const NOTIFY_REQUESTS_FILE = path.join(DATA_DIR, 'notify-requests.json');

app.use(express.json());

function normalize(value) {
  return String(value || '').trim();
}

function normalizeLookup(value) {
  return normalize(value).toLowerCase();
}

async function readUsers() {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeUsers(users) {
  await fs.mkdir(DATA_DIR, {recursive: true});
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function readJsonArray(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function appendJsonRecord(file, record) {
  const rows = await readJsonArray(file);
  rows.push(record);
  await fs.mkdir(DATA_DIR, {recursive: true});
  await fs.writeFile(file, JSON.stringify(rows, null, 2));
}

function success(res, extra = {}, status = 200) {
  return res.status(status).json({ok: true, status: 'success', ...extra});
}

async function handleRegister(payload, res) {
  const name = normalize(payload.name);
  const email = normalizeLookup(payload.email);
  const phone = normalize(payload.phone);
  const occupation = normalize(payload.occupation);
  const financeProficiency = Number(payload.financeProficiency || payload.proficiency || payload.profficiency);

  const missing = [];
  if (!name) missing.push('name');
  if (!email) missing.push('email');
  if (!phone) missing.push('phone');
  if (!occupation) missing.push('occupation');
  if (!Number.isInteger(financeProficiency) || financeProficiency < 1 || financeProficiency > 5) missing.push('finance proficiency');

  if (missing.length) {
    return res.status(400).json({error: `Missing or invalid: ${missing.join(', ')}.`});
  }

  if (!email.includes('@')) {
    return res.status(400).json({error: 'Use a valid email address.'});
  }

  const users = await readUsers();
  if (users.some(user => user.email === email || user.phone === phone)) {
    return res.status(409).json({error: 'An account already exists for that email or phone.'});
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    nameLookup: normalizeLookup(name),
    email,
    phone,
    phoneLookup: normalizeLookup(phone),
    occupation,
    financeProficiency,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await writeUsers(users);

  return success(res, {user, token: crypto.randomUUID()}, 201);
}

async function handleLogin(payload, res) {
  const name = normalizeLookup(payload.name);
  const identifier = normalizeLookup(payload.identifier || payload.email);
  const users = await readUsers();
  const user = users.find(item =>
    normalizeLookup(item.name) === name &&
    (item.email === identifier || normalizeLookup(item.phone) === identifier)
  );

  if (!user) {
    return res.status(401).json({error: 'Name and email/phone did not match an account.'});
  }

  return res.json({ok: true, status: 'login_success', user, token: crypto.randomUUID()});
}

app.post('/api/register', async (req, res) => {
  return handleRegister(req.body, res);
});

app.post('/api/login', async (req, res) => {
  return handleLogin(req.body, res);
});

app.post('/api/dd', async (req, res) => {
  const mode = normalizeLookup(req.body.mode);

  if (mode === 'signup') {
    return handleRegister(req.body, res);
  }

  if (mode === 'login') {
    return handleLogin(req.body, res);
  }

  if (mode === 'request_company') {
    const company = normalize(req.body.company);
    const email = normalizeLookup(req.body.email);
    if (!company) return res.status(400).json({error: 'Company is required.'});
    if (!email || !email.includes('@')) return res.status(400).json({error: 'Use a valid email address.'});
    await appendJsonRecord(REPORT_REQUESTS_FILE, {
      id: crypto.randomUUID(),
      company,
      email,
      createdAt: new Date().toISOString()
    });
    return success(res, {message: 'Request saved.'});
  }

  if (mode === 'notify') {
    const company = normalize(req.body.company);
    const email = normalizeLookup(req.body.email);
    if (!company) return res.status(400).json({error: 'Company is required.'});
    if (!email || !email.includes('@')) return res.status(400).json({error: 'Use a valid email address.'});
    await appendJsonRecord(NOTIFY_REQUESTS_FILE, {
      id: crypto.randomUUID(),
      company,
      email,
      createdAt: new Date().toISOString()
    });
    return success(res, {message: 'Notification request saved.'});
  }

  if (mode === 'contact') {
    const about = normalize(req.body.about);
    const message = normalize(req.body.message);
    const email = normalizeLookup(req.body.email);
    const phone = normalize(req.body.phone);
    if (!message) return res.status(400).json({error: 'Message is required.'});
    if (email && !email.includes('@')) return res.status(400).json({error: 'Use a valid email address.'});
    await appendJsonRecord(CONTACTS_FILE, {
      id: crypto.randomUUID(),
      about,
      message,
      email,
      phone,
      createdAt: new Date().toISOString()
    });
    return success(res, {message: 'Message saved.'});
  }

  return res.status(400).json({error: `Unsupported mode: ${mode || 'unknown'}.`});
});

app.use(express.static(__dirname, {
  extensions: ['html'],
  etag: false,
  maxAge: 0
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Daily Dividend dev server running at http://127.0.0.1:${PORT}`);
});
