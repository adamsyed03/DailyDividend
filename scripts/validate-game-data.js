'use strict';

// npm run game:validate-data
// Prints exactly what data is missing for the current window and for each
// hidden-year start year, and which feature flags the server will switch on.
// Uses the same loader and checks the server uses (indian-time-machine/dataset.js).

const fs = require('fs');
const path = require('path');
const { validateRounds } = require('../indian-time-machine/engine');
const { loadDataset, priceGaps, describeMonths } = require('../indian-time-machine/dataset');
const { reportsFor } = require('../indian-time-machine/puzzle');

const DATA_DIR = path.join(__dirname, '..', 'data', 'indian-time-machine');
const config = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scenario_config.json'), 'utf8'));
validateRounds(config);
const dataset = loadDataset(DATA_DIR, config);
const reports = reportsFor(dataset, config);
const flagsConfig = config.featureFlags || {};
const ok = value => (value ? '✓' : '✗');
const monthName = month => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
const lines = [];
const out = (text = '') => lines.push(text);

function windowProblems(report, { priorYear }) {
  const problems = [];
  for (const asset of report.assets) {
    if (asset.missingPrices.length) problems.push(`prices: ${asset.id} missing ${describeMonths(asset.missingPrices)}`);
    if (asset.partial.length) problems.push(`prices: ${asset.id} has partial months ${describeMonths(asset.partial)}`);
    if (priorYear && asset.priorMissing) problems.push(`last-year %: ${asset.id} needs a ${asset.needed[0]} price`);
    if (asset.missingFx.length) problems.push(`FX: USD/INR missing for ${asset.id} in ${describeMonths(asset.missingFx)}`);
  }
  if (report.missingNifty.length) problems.push(`Nifty 50: missing closes for ${report.missingNifty.join(', ')}`);
  if (report.missingCpi.length) problems.push(`CPI: missing India CPI for ${report.missingCpi.join(', ')}`);
  for (const clue of report.clues) {
    if (!clue.ready) {
      const need = [clue.india ? null : '1 IN', clue.world ? null : '1 US/GLOBAL'].filter(Boolean).join(' + ');
      problems.push(`clues: decision at ${monthName(clue.month)} close needs ${need} clue (have IN ${clue.india}, US/GLOBAL ${clue.world})`);
    }
  }
  for (const during of report.during) {
    if (!during.count) {
      const round = report.rounds[during.round - 1];
      problems.push(`during: no sourced headline inside round ${during.round} (${monthName(round.decisionMonth)} → ${monthName(round.revealMonth)} closes)`);
    }
  }
  return problems;
}

out('DD Beat the Past · data validation');
out(`Data folder: ${path.relative(process.cwd(), DATA_DIR)}`);
out();
const fxMonths = [...dataset.fx.keys()].sort();
const cpiYears = [...dataset.inflation.keys()].sort((a, b) => a - b);
out('FILES');
out(`  prices      ${dataset.prices.size} monthly rows (market_prices_monthly.csv + supplied/prices_monthly.csv)`);
out(`  USD/INR     ${fxMonths.length} months, ${fxMonths[0]} → ${fxMonths.at(-1)} (FRED DEXINUS)`);
out(`  India CPI   ${cpiYears.length} years, ${cpiYears[0]} → ${cpiYears.at(-1)}`);
out(`  Nifty 50    ${dataset.nifty.size} levels: ${[...dataset.nifty.keys()].sort().join(', ') || 'none'}`);
out(`  headlines   ${dataset.headlines.length} (${dataset.headlines.filter(item => item.usable).length} usable, ${dataset.headlines.filter(item => !item.usable).length} flagged)`);
out();
out('PRICE HISTORY PER ASSET');
for (const item of priceGaps(dataset, config)) {
  out(`  ${item.id.padEnd(16)} ${item.first ? `${item.first} → ${item.last}` : 'no prices'}${item.gaps.length ? `  ✗ gaps: ${describeMonths(item.gaps)}` : '  ✓ no gaps'}`);
}
if (dataset.conflicts.length) {
  out('  ✗ supplied prices that disagree with existing rows by >0.5%:');
  dataset.conflicts.forEach(item => out(`    ${item}`));
}
out();
out('HEADLINES');
const flagged = dataset.headlines.filter(item => !item.usable);
if (!flagged.length && !reports.clueIndex.issues.length) out('  ✓ no issues');
flagged.forEach(item => out(`  ✗ FLAGGED ${item.id}: ${item.issues.join('; ')} — kept out of play until fixed`));
reports.clueIndex.issues.forEach(issue => out(`  ✗ ${issue}`));
out();

const legacy = reports.legacy;
out(`CURRENT WINDOW (${legacy.rounds.map(round => `${round.decisionMonth}→${round.revealMonth}`).join(', ')})`);
out(`  ${ok(legacy.pricesReady)} prices + FX for ${legacy.readyAssets.length} of ${legacy.assets.length} pool assets: ${legacy.readyAssets.join(', ')}`);
out(`  ${ok(legacy.overallNiftyReady)} Nifty at start and end (final comparison, titles)`);
const legacyProblems = windowProblems(legacy, { priorYear: false });
legacyProblems.forEach(problem => out(`  ✗ ${problem}`));
out();

const range = config.puzzle?.calendarStartYears;
out(`HIDDEN-YEAR START YEARS ${range.from}–${range.to} (4 calendar-year rounds each; needs monthly prices from Dec of start−2 to Dec of start+3)`);
for (const report of reports.startYears) {
  const problems = windowProblems(report, { priorYear: true });
  const status = report.playable ? (problems.length ? 'PLAYABLE (prices ready; extras missing)' : 'READY') : 'NOT PLAYABLE';
  out(`  ${report.startYear} → ${report.startYear + 3}  ${ok(report.playable)} ${status}`);
  problems.forEach(problem => out(`      ✗ ${problem}`));
}
out();

const playable = reports.startYears.filter(report => report.playable);
const minYears = flagsConfig.hiddenYears?.minStartYears || 4;
const hiddenOn = flagsConfig.hiddenYears?.enabled !== false && playable.length >= minYears;
const active = hiddenOn ? playable : [legacy];
const share = test => `${active.filter(test).length} of ${active.length} ${hiddenOn ? 'start years' : 'window'}`;
out('FEATURE FLAGS (what the server switches on for puzzles built from this data)');
out(`  hiddenYears  ${hiddenOn ? 'ON ' : 'OFF'}  ${playable.length} of ${reports.startYears.length} start years playable; needs ${minYears}`);
out(`  clues        ${share(report => report.cluesReady)} ready — on only for puzzles where every decision has an IN and a US/GLOBAL clue`);
out(`  roundNifty   ${share(report => report.roundNiftyReady)} ready — needs a Nifty close at every round boundary`);
out(`  niftyTitles  ${share(report => report.overallNiftyReady)} ready — needs Nifty at the start and end of the window`);

console.log(lines.join('\n'));
if (!legacy.pricesReady && !hiddenOn) process.exitCode = 1;
