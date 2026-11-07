(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);

  async function load() {
    try {
      const response = await fetch('/api/time-machine/health');
      const health = await response.json();
      if (!response.ok) throw new Error(health.error || 'Health endpoint failed.');
      const status = $('#health-status');
      status.textContent = health.ready ? 'READY TO SCORE' : 'BLOCKED';
      status.classList.toggle('ready', health.ready);
      $('#metric-grid').innerHTML = [
        [health.priceRows, 'SUPPLIED PRICE ROWS'],
        [health.fxMonths, 'MONTH-END FX RATES'],
        [health.inflationYears, 'CPI YEARS'],
        [health.corporateEvents, 'AUDIT-ONLY EVENTS']
      ].map(([value, label]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('');
      const warnings = [];
      if (health.missingPrices.length) warnings.push(`Missing checkpoint prices: ${health.missingPrices.join(', ')}`);
      if (health.missingFxMonths.length) warnings.push(`Missing FRED month-end FX: ${health.missingFxMonths.join(', ')}`);
      if (health.missingInflationYears.length) warnings.push(`Missing annual India CPI context: ${health.missingInflationYears.join(', ')}`);
      if (!health.goldInstrumentVerified) warnings.push('Gold source instrument is unverified. Keep the prototype label and do not claim exact spot, futures or ETF ownership.');
      if (!health.screenshotAuditComplete) warnings.push('The 250 screenshot-transcribed prices still need a final visual numerical audit before public claims.');
      $('#warnings').innerHTML = `${health.ready ? '<div class="warning ok">All six month-end checkpoints exist for the four priced assets and FRED USD/INR. Server scoring is enabled.</div>' : ''}${warnings.map(item => `<div class="warning">${item}</div>`).join('')}`;
      $('#sources').innerHTML = health.sources.map(source => `<div class="source-row"><strong>${source.name}</strong><span>${source.source_type}</span><span>${source.row_count} rows</span><span>${source.verification_status}</span></div>`).join('');
    } catch (error) {
      $('#health-status').textContent = 'SETUP ERROR';
      $('#warnings').innerHTML = `<div class="warning">${error.message}</div>`;
    }
  }
  load();
})();

