const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5173;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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

app.post('/api/register', async (req, res) => {
  const name = normalize(req.body.name);
  const email = normalizeLookup(req.body.email);
  const phone = normalize(req.body.phone);
  const occupation = normalize(req.body.occupation);
  const financeProficiency = Number(req.body.financeProficiency || req.body.proficiency || req.body.profficiency);

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

  res.status(201).json({user, token: crypto.randomUUID()});
});

app.post('/api/login', async (req, res) => {
  const name = normalizeLookup(req.body.name);
  const identifier = normalizeLookup(req.body.identifier);
  const users = await readUsers();
  const user = users.find(item =>
    normalizeLookup(item.name) === name &&
    (item.email === identifier || normalizeLookup(item.phone) === identifier)
  );

  if (!user) {
    return res.status(401).json({error: 'Name and email/phone did not match an account.'});
  }

  res.json({user, token: crypto.randomUUID()});
});

app.use(express.static(__dirname, {
  extensions: ['html'],
  etag: false,
  maxAge: 0
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Daily Dividend dev server running at http://127.0.0.1:${PORT}`);
});
