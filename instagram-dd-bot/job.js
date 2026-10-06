'use strict';

const fs = require('fs/promises');
const path = require('path');

const JOB_FILE = path.join(__dirname, 'data', 'current-job.json');

async function loadJob() {
  let raw;
  try {
    raw = await fs.readFile(JOB_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('No saved Instagram job. Save the settings in the admin dashboard first.');
    }
    throw error;
  }
  const job = JSON.parse(raw);
  if (!job.postUrl || !job.triggerComment) throw new Error('The saved Instagram job is incomplete.');
  return job;
}

module.exports = { JOB_FILE, loadJob };
