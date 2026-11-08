(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

  async function load() {
    try {
      const response = await fetch('/api/time-machine/health');
      const health = await response.json();
      if (!response.ok) throw new Error(health.error || 'Health endpoint failed.');
      const status = $('#health-status');
      status.textContent = health.ready ? 'READY TO SCORE' : 'BLOCKED';
      status.classList.toggle('ready', health.ready);
      $('#metric-grid').innerHTML = [
        [health.priceRows, 'MONTHLY PRICE ROWS'],
        [health.fxMonths, 'MONTH-END FX RATES'],
        [health.inflationYears, 'CPI YEARS'],
        [health.playableStartYears.length, 'HIDDEN-YEAR START YEARS READY']
      ].map(([value, label]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('');
      const legacy = health.legacyWindow;
      const warnings = [];
      if (!legacy.roundNifty) warnings.push('Per-round Nifty is off: Nifty closes are missing for some round boundaries.');
      if (!legacy.clues) warnings.push('Pre-decision clues are off: no sourced clue headlines for the current window.');
      if (!health.playableStartYears.length) warnings.push('Hidden years are off: no start year has full monthly prices yet.');
      health.flaggedHeadlines.forEach(item => warnings.push(`Flagged headline ${item.id}: ${item.issues.join('; ')}`));
      if (!health.goldInstrumentVerified) warnings.push('Gold source instrument is unverified. Keep the prototype label and do not claim exact spot, futures or ETF ownership.');
      $('#warnings').innerHTML = `${health.ready ? `<div class="warning ok">Current window (${escape(legacy.rounds.join(', '))}) has prices and FX for ${escape(legacy.readyAssets.join(', '))}. Server scoring is enabled.</div>` : ''}${warnings.map(item => `<div class="warning">${escape(item)}</div>`).join('')}`;
      $('#sources').innerHTML = `<div class="source-row"><strong>Full gap report</strong><span>Run npm run game:validate-data</span><span>${health.headlines} headlines</span><span>${health.archivedV1Results} archived v1 results</span></div>`;
    } catch (error) {
      $('#health-status').textContent = 'SETUP ERROR';
      $('#warnings').innerHTML = `<div class="warning">${escape(error.message)}</div>`;
    }
  }
  load();
})();
