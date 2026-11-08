(() => {
  'use strict';

  // ---------- helpers ----------
  const $ = selector => document.querySelector(selector);
  const API = '/api/time-machine';
  const KEY_SESSION = 'dd-btp-session';
  const KEY_INTRO = 'dd-btp-intro-v1';
  const KEY_DAILY = 'dd-btp-daily-';
  const SITE = 'dailydividend.info/game';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const local = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* private mode */ } },
    del(key) { try { localStorage.removeItem(key); } catch (_) { /* private mode */ } }
  };
  const grouping = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const trimZeros = text => (text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text);
  const money = value => `${value < 0 ? '−' : ''}₹${grouping.format(Math.abs(Math.round(value)))}`;
  function short(value, digits = 1) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '−' : '';
    if (abs >= 1e7) return `${sign}₹${trimZeros((abs / 1e7).toFixed(2))}Cr`;
    if (abs >= 1e5) return `${sign}₹${trimZeros((abs / 1e5).toFixed(digits))}L`;
    return `${sign}₹${grouping.format(Math.round(abs))}`;
  }
  function pct(value, digits = 1) {
    const fixed = Math.abs(value).toFixed(digits);
    const zero = Number(fixed) === 0;
    return `${zero ? '' : value > 0 ? '+' : '−'}${fixed}%`;
  }
  // Colour follows the number as displayed: a value that rounds to 0 is neutral, never red or green.
  const tone = (value, digits = 1) => { const shown = Number(Math.abs(value).toFixed(digits)); return shown === 0 ? 'flat' : value > 0 ? 'up' : 'down'; };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const pad3 = number => String(number).padStart(3, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullDate = iso => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  // "Jul–Dec 2022" → "H2 ’22", "2023" stays.
  const shortPeriod = period => period.replace(/^Jul–Dec (\d{2})(\d{2})$/, 'H2 ’$2').replace(/^Jan–Jun (\d{2})(\d{2})$/, 'H1 ’$2');

  const rabbitHoles = [
    { slug: 'reliance-decoded', category: 'Made in India', readTime: '8 min read', title: 'Reliance, decoded', summary: 'India’s most valuable company in 11 swipes: oil, retail, telecom, media, and the machine connecting all of it.' },
    { slug: 'jio-ipo-decoded', category: 'Made in India', readTime: '8 min read', title: 'Jio IPO, decoded', summary: 'India’s biggest IPO, unpacked in 11 swipes: the business, the valuation, the risks, and the number that decides everything.' },
    { slug: 'marico-decoded', category: 'Made in India', readTime: '8 min read', title: 'Marico, decoded', summary: 'The Parachute company in 11 swipes: coconut oil dominance, Saffola’s second act, the overseas bet, and what could break the story.' },
    { slug: 'trump-june-trades', category: 'Banks & Money', readTime: '7 min read', title: '1,051 trades in one month', summary: 'Every name identified from Donald Trump’s June filing: what was bought, what was sold, and what each company actually does.' }
  ];

  const S = {
    today: null, sessionId: null, puzzle: null, stage: null,
    current: null, allocations: {}, moving: false,
    outcome: null, final: null, busy: false, intro: null
  };
  const hidden = () => Boolean(S.puzzle?.flags?.hiddenYears);
  const unit = () => (hidden() ? 'year' : 'round');

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('show'), 2800);
  }

  async function api(path, options = {}) {
    // Never wait forever: a stalled request becomes a visible, retryable error.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(API + path, { ...options, signal: controller.signal, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    } catch (error) {
      throw new Error(error.name === 'AbortError' ? 'The game server is taking too long to answer.' : 'Couldn’t reach the game server. Check your connection.');
    } finally {
      clearTimeout(timer);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'The game server did not respond.');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('is-active', screen.id === id));
    window.scrollTo(0, 0);
  }

  function setSteps(done, on) {
    const total = S.puzzle?.totalRounds || 4;
    $('#steps').hidden = false;
    $('#puzzlePill').hidden = true;
    $('#steps').innerHTML = Array.from({ length: total }, (_, index) => `<i class="${index < done ? 'done' : index === on ? 'on' : ''}"></i>`).join('');
  }

  function tray(mode) {
    $('#tray').hidden = !mode;
    $('#trayRound').hidden = mode !== 'round';
    $('#trayResult').hidden = mode !== 'result';
  }

  function countUp(element, from, to, format = money, duration = 900) {
    if (reducedMotion || from === to) { element.textContent = format(to); return; }
    const started = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = format(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- boot / restore ----------
  function showLoadError(message, retry) {
    $('#loadingText').textContent = message;
    const button = $('#retryLoad');
    button.hidden = false;
    button.onclick = () => { button.hidden = true; retry(); };
    showScreen('screen-loading');
    tray(null);
  }

  async function boot() {
    try {
      await bootFlow();
    } catch (error) {
      showLoadError(error.message || 'Something went wrong loading the game.', boot);
    }
  }

  async function bootFlow() {
    $('#retryLoad').hidden = true;
    $('#loadingText').textContent = 'Loading today’s puzzle…';
    try { S.today = await api('/today'); } catch (_) { S.today = null; }
    const wanted = new URLSearchParams(location.search).get('mode') === 'unlimited' ? 'unlimited' : 'daily';
    const saved = local.get(KEY_SESSION);
    if (saved && await restore(saved, { allowFinished: false })) return;
    if (wanted === 'daily' && S.today) {
      const done = local.get(KEY_DAILY + S.today.dateKey);
      if (done && await restore(done, { allowFinished: true })) return;
    }
    await start(wanted);
  }

  async function restore(sessionId, { allowFinished }) {
    try {
      const payload = await api(`/session/${sessionId}`);
      const isToday = payload.mode === 'daily' && S.today && payload.puzzle.dateKey === S.today.dateKey;
      if (payload.mode === 'daily' && S.today && !isToday) return false; // yesterday's daily: start today's
      if (payload.final && !allowFinished) return false;
      applyPayload(payload);
      return true;
    } catch (_) {
      if (local.get(KEY_SESSION) === sessionId) local.del(KEY_SESSION);
      return false;
    }
  }

  function applyPayload(payload) {
    S.sessionId = payload.sessionId;
    S.puzzle = payload.puzzle;
    S.stage = payload.stage;
    if (payload.final) return showFinal(payload.final, { animate: false });
    if (payload.stage === 'allocation') return showRound(payload.current, {}, false);
    return showResult(payload.outcome, { animate: false });
  }

  async function start(mode) {
    $('#loadingText').textContent = mode === 'daily' ? 'Loading today’s puzzle…' : 'Shuffling an unlimited puzzle…';
    showScreen('screen-loading');
    tray(null);
    try {
      const payload = await api('/start', { method: 'POST', body: JSON.stringify({ mode }) });
      S.outcome = null;
      S.final = null;
      local.set(KEY_SESSION, payload.sessionId);
      applyPayload(payload);
    } catch (error) {
      showLoadError(error.message, () => start(mode));
    }
  }

  // ---------- round screen ----------
  function periodTitle(period) {
    const match = /^(.*?)(\d{4})$/.exec(period || '');
    return match ? `${esc(match[1])}<span>${match[2]}</span>` : esc(period);
  }

  function showRound(current, prefill, moving) {
    S.current = current;
    S.moving = moving;
    S.allocations = Object.fromEntries(current.assets.map(asset => [asset.id, Number(prefill[asset.id] || 0)]));
    const round = current.round;
    setSteps(round - 1, round - 1);
    $('#howTo').hidden = false;
    const range = S.puzzle.startYearRange;
    if (hidden()) {
      $('#rKicker').textContent = round === 1 && range
        ? `Round ${round} of ${current.totalRounds} · somewhere between ${range.from} and ${range.to}`
        : `Round ${round} of ${current.totalRounds} · still 20??`;
      $('#rTitle').innerHTML = 'Year <span>20??</span>';
    } else {
      $('#rKicker').textContent = `Round ${round} of ${current.totalRounds} · ${current.months} months`;
      $('#rTitle').innerHTML = periodTitle(current.period);
    }
    $('#rWealth').textContent = money(current.wealth);
    $('#rWealthNote').innerHTML = `${current.chipCount} chips · ${short(current.wealth / current.chipCount, 2)} each<br>max ${current.maxChipsPerAsset} on one asset`;
    const clues = current.clues || [];
    $('#rWire').hidden = !clues.length;
    $('#screen-round').classList.toggle('with-wire', clues.length > 0);
    $('#rWireItems').innerHTML = clues.map(clue => `<div class="wire-item"><span class="flag">${esc(clue.region === 'IN' ? 'IN' : clue.region)}</span><p>${esc(clue.headline)}<small>${esc(clue.outlet)}</small></p></div>`).join('');
    $('#rAssets').innerHTML = current.assets.map(asset => {
      let lastYear = '';
      if (asset.isCash) lastYear = '<div class="a-ly flat">0% nominal</div>';
      else if (asset.trailing) {
        const span = asset.trailing.months === 12 ? 'last yr' : `last ${asset.trailing.months} mo`;
        lastYear = `<div class="a-ly ${tone(asset.trailing.percent, 0)}">${pct(asset.trailing.percent, 0)} ${span}</div>`;
      }
      const slots = Array.from({ length: current.maxChipsPerAsset }, (_, index) => `<button class="slot" type="button" data-slot="${index}" data-asset="${esc(asset.id)}"><i></i></button>`).join('');
      return `<article class="asset" data-asset-card="${esc(asset.id)}" style="--c:${esc(asset.color)}">
        <div class="a-name"><span class="dot"></span>${esc(asset.shortName)} <span class="a-tag">${esc(asset.market)}</span></div>${lastYear}
        <div class="a-desc">${esc(asset.oneLiner)}</div>
        <div class="chiprow">
          <button class="btn-sq" type="button" data-act="minus" data-asset="${esc(asset.id)}" aria-label="Remove a chip from ${esc(asset.shortName)}"><span>−</span></button>
          <div class="slots">${slots}</div>
          <span class="amt" data-amt></span>
          <button class="btn-sq" type="button" data-act="plus" data-asset="${esc(asset.id)}" aria-label="Add a chip to ${esc(asset.shortName)}"><span>+</span></button>
        </div>
      </article>`;
    }).join('');
    $('#cancelMove').hidden = !moving;
    $('#rError').textContent = '';
    $('#lockIn').textContent = moving ? 'Lock in move' : 'Lock in';
    tray('round');
    updateAllocation();
    showScreen('screen-round');
    if (round === 1 && !moving && !local.get(KEY_INTRO)) setTimeout(() => startIntro(), 350);
  }

  const placed = () => Object.values(S.allocations).reduce((sum, chips) => sum + chips, 0);

  function setChips(assetId, next) {
    const max = S.current.maxChipsPerAsset;
    const now = S.allocations[assetId];
    if (next < 0 || next > max) return;
    if (next > now && placed() + (next - now) > S.current.chipCount) return;
    S.allocations[assetId] = next;
    updateAllocation();
    if (next > now && S.intro && S.intro.steps[S.intro.index]?.advanceOn === 'chip') nextIntro();
  }

  function updateAllocation() {
    const total = placed();
    const left = S.current.chipCount - total;
    const max = S.current.maxChipsPerAsset;
    const stakes = window.DDRupeeSplit.splitRupees(S.current.wealth, S.allocations, S.current.chipCount);
    S.current.assets.forEach(asset => {
      const card = document.querySelector(`[data-asset-card="${CSS.escape(asset.id)}"]`);
      const chips = S.allocations[asset.id];
      card.classList.toggle('has', chips > 0);
      card.querySelectorAll('.slot').forEach((slot, index) => {
        const filled = index < chips;
        slot.classList.toggle('f', filled);
        slot.setAttribute('aria-label', filled ? `Remove a chip from ${asset.shortName}` : `Add a chip to ${asset.shortName}`);
        slot.disabled = !filled && !left;
      });
      card.querySelector('[data-act="minus"]').disabled = chips === 0;
      card.querySelector('[data-act="plus"]').disabled = chips >= max || !left;
      const amount = card.querySelector('[data-amt]');
      if (chips >= max) { amount.className = 'capnote'; amount.textContent = `Max ${max}`; }
      else if (chips) { amount.className = 'amt'; amount.textContent = money(stakes[asset.id]); }
      else { amount.className = 'amt none'; amount.textContent = '—'; }
    });
    $('#pool').innerHTML = Array.from({ length: S.current.chipCount }, (_, index) => `<i class="${index < total ? 'used' : ''}"></i>`).join('');
    $('#leftCount').textContent = left ? `${left} left` : 'All placed';
    $('#lockIn').disabled = left !== 0 || S.busy;
  }

  function equalSplit() {
    const ids = S.current.assets.map(asset => asset.id);
    const max = S.current.maxChipsPerAsset;
    const result = Object.fromEntries(ids.map(id => [id, 0]));
    let left = S.current.chipCount;
    for (let index = 0; left > 0; index = (index + 1) % ids.length) {
      if (result[ids[index]] < max) { result[ids[index]] += 1; left -= 1; }
      if (ids.every(id => result[id] >= max)) break;
    }
    S.allocations = result;
    updateAllocation();
  }

  async function lockIn() {
    if (S.busy || placed() !== S.current.chipCount) return;
    S.busy = true;
    $('#lockIn').textContent = 'Running the market…';
    updateAllocation();
    endIntro();
    try {
      const first = S.stage === 'allocation';
      const payload = first
        ? await api('/lock', { method: 'POST', body: JSON.stringify({ sessionId: S.sessionId, allocations: S.allocations }) })
        : await api('/advance', { method: 'POST', body: JSON.stringify({ sessionId: S.sessionId, action: 'reshuffle', allocations: S.allocations }) });
      S.stage = payload.stage;
      showResult(payload.outcome, { animate: true });
    } catch (error) {
      $('#rError').textContent = error.message;
      if (error.status === 410) local.del(KEY_SESSION);
    } finally {
      S.busy = false;
      $('#lockIn').textContent = S.moving ? 'Lock in move' : 'Lock in';
      if (S.current) updateAllocation();
    }
  }

  // ---------- result + next move ----------
  function showResult(outcome, { animate }) {
    S.outcome = outcome;
    S.stage = outcome.isFinal ? 'final-pending' : 'decision';
    const reveal = outcome.reveal;
    const round = reveal.round;
    setSteps(round, outcome.isFinal ? -1 : round);
    $('#howTo').hidden = true;
    $('#xKicker').textContent = hidden() ? `After year ${round} · still 20??` : `After round ${round} · ${reveal.period}`;
    countUp($('#xValue'), animate ? reveal.startWealth : reveal.endWealth, reveal.endWealth);
    const chips = [
      `<span class="chip ${tone(reveal.returnPercent)}">${pct(reveal.returnPercent)} this ${unit()}</span>`,
      `<span class="chip ${tone(reveal.sinceStartPercent)}">${pct(reveal.sinceStartPercent)} since start</span>`
    ];
    if (Number.isFinite(reveal.niftyReturnPercent)) chips.push(`<span class="chip n">Nifty ${pct(reveal.niftyReturnPercent)}</span>`);
    $('#xDelta').innerHTML = chips.join('');
    const total = outcome.chart.totalRounds;
    const slotLabel = hidden() ? 'Yr' : 'Rd';
    drawChart($('#xChart'), {
      height: 92,
      total,
      labels: ['Start', ...Array.from({ length: total }, (_, index) => `${slotLabel} ${index + 1}`)],
      series: [
        outcome.chart.nifty ? { points: outcome.chart.nifty, kind: 'nifty' } : null,
        { points: outcome.chart.you, kind: 'you', endLabel: true }
      ].filter(Boolean),
      animate: false
    });
    $('#xLegend').innerHTML = legend(outcome.chart.nifty ? ['you', 'nifty'] : ['you']);
    $('#xChart').setAttribute('aria-label', `Your portfolio: ${outcome.chart.you.map(value => short(value)).join(', ')}`);
    const held = reveal.assets.filter(asset => asset.chips > 0 || asset.endValue > 0);
    const scale = Math.max(1, ...held.map(asset => Math.abs(asset.returnPercent)));
    $('#xRows').innerHTML = held.map(asset => {
      const width = Math.max(1.5, Math.abs(asset.returnPercent) / scale * 48);
      const direction = asset.returnPercent >= 0 ? 'up' : 'down';
      return `<div class="rrow" style="--c:${esc(asset.color)}"><div class="n"><span class="dot"></span><div>${esc(asset.name)}<small>${asset.chips} chip${asset.chips === 1 ? '' : 's'}</small></div></div><div class="bar" aria-hidden="true">${Math.abs(asset.returnPercent) < 0.05 ? '' : `<i class="${direction}" style="width:${width.toFixed(1)}%"></i>`}</div><div class="p ${tone(asset.returnPercent)}">${pct(asset.returnPercent)}</div></div>`;
    }).join('');
    // Market Chronicle for the round: lead headline, tap to open every sourced story.
    // (Older servers sent a single `during` headline; show that rather than nothing.)
    const stories = outcome.chronicle || (outcome.during ? [outcome.during] : []);
    const chronicle = $('#xChronicle');
    chronicle.hidden = !stories.length;
    chronicle.open = false;
    if (stories.length) {
      const [lead] = stories;
      const more = stories.length - 1;
      const count = `${stories.length} ${stories.length === 1 ? 'story' : 'stories'}`;
      const prompt = outcome.isFinal ? `Read ${count} from this ${unit()}` : `Read ${count} before you decide`;
      $('#xChronLead').innerHTML = `<b>The Market Chronicle · this ${unit()}</b><p><span class="hl">${esc(lead.headline)}</span> · ${esc(lead.outlet)}</p><span class="more" data-closed="${esc(prompt)}" data-open="Hide the Chronicle"></span>`;
      $('#xChronLead').setAttribute('aria-label', `${prompt}. Lead story: ${lead.headline}`);
      // The lead's headline is already in the summary row, so its list entry carries only the detail.
      $('#xChronList').innerHTML = stories.map((item, index) => `<li>${index ? `<span class="flag">${esc(item.region)}</span><h4>${esc(item.headline)}</h4>` : ''}${item.summary ? `<p>${esc(item.summary)}</p>` : ''}${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.outlet)} ↗</a>` : `<small>${esc(item.outlet)} · source link in the final reveal</small>`}</li>`).join('');
    }
    const nextClues = outcome.next?.current?.clues || [];
    $('#xNextClue').hidden = !nextClues.length;
    if (nextClues.length) $('#xNextClue').innerHTML = `<b>Next ${unit()}’s wire</b>${nextClues.map(clue => `<p><span class="hl">${esc(clue.headline)}</span> · ${esc(clue.outlet)}</p>`).join('')}`;
    $('#xSeg').hidden = outcome.isFinal;
    $('#moveMaths').textContent = `Sell all, re-split ${short(reveal.endWealth)} into 10 × ${short(reveal.endWealth / 10, 2)}`;
    $('#optHold').classList.add('sel');
    $('#optHold').setAttribute('aria-pressed', 'true');
    $('#optMove').classList.remove('sel');
    $('#optMove').setAttribute('aria-pressed', 'false');
    $('#xError').textContent = '';
    $('#carryText').innerHTML = outcome.isFinal
      ? `Final value<br><b style="display:inline;font-size:14px">${money(reveal.endWealth)}</b>`
      : `Positions carry over<br>at <b style="display:inline;font-size:14px">${money(reveal.endWealth)}</b>`;
    $('#goNext').textContent = outcome.isFinal ? (hidden() ? 'Reveal the years →' : 'See the reveal →') : `Go to ${unit()} ${round + 1} →`;
    tray('result');
    showScreen('screen-result');
  }

  async function goNext() {
    if (S.busy) return;
    if (S.outcome.isFinal) {
      if (S.puzzle.yearGuessOptions) return showGuess();
      return finish(null);
    }
    S.busy = true;
    $('#goNext').disabled = true;
    try {
      const payload = await api('/advance', { method: 'POST', body: JSON.stringify({ sessionId: S.sessionId, action: 'hold' }) });
      showResult(payload.outcome, { animate: true });
    } catch (error) {
      $('#xError').textContent = error.message;
    } finally {
      S.busy = false;
      $('#goNext').disabled = false;
    }
  }

  function openMove() {
    const next = S.outcome?.next;
    if (!next) return;
    const prefill = Object.fromEntries(next.portfolio.map(item => [item.id, item.chips]));
    showRound(next.current, prefill, true);
  }

  // ---------- guess + finish ----------
  function showGuess() {
    tray(null);
    $('#gOptions').innerHTML = S.puzzle.yearGuessOptions.map(year => `<button type="button" data-guess="${year}">${year}</button>`).join('');
    showScreen('screen-guess');
  }

  async function finish(yearGuess) {
    if (S.busy) return;
    S.busy = true;
    $('#loadingText').textContent = hidden() ? 'Revealing the years…' : 'Adding up your four rounds…';
    showScreen('screen-loading');
    tray(null);
    try {
      const payload = await api('/finish', { method: 'POST', body: JSON.stringify({ sessionId: S.sessionId, yearGuess }) });
      S.stage = 'complete';
      if (S.puzzle.mode === 'daily' && S.puzzle.dateKey) local.set(KEY_DAILY + S.puzzle.dateKey, S.sessionId);
      showFinal(payload.final, { animate: true });
    } catch (error) {
      toast(error.message);
      showResult(S.outcome, { animate: false });
    } finally {
      S.busy = false;
    }
  }

  // ---------- final reveal ----------
  function legend(kinds) {
    const items = {
      you: '<span><i style="border-color:var(--ink)"></i>You</span>',
      nifty: '<span><i style="border-color:var(--gold);border-top-style:dashed"></i>Nifty 50</span>',
      best: '<span><i style="border-color:#9aa39b;border-top-style:dotted"></i>Best possible</span>'
    };
    return kinds.map(kind => items[kind]).join('');
  }

  function showFinal(final, { animate }) {
    S.final = final;
    S.puzzle = { ...S.puzzle, ...final.puzzle };
    tray(null);
    $('#steps').hidden = true;
    $('#howTo').hidden = true;
    const pill = $('#puzzlePill');
    pill.hidden = false;
    pill.textContent = final.puzzle.mode === 'daily' ? `#${pad3(final.puzzle.number)} · DAILY` : 'UNLIMITED';

    const revealCard = $('#fReveal');
    $('#fKicker').textContent = final.puzzle.calendar ? 'The years were' : 'The window was';
    $('#fYears').innerHTML = esc(final.puzzle.windowLabel).replace('→', '<span>→</span>');
    $('#fYears').classList.toggle('long', final.puzzle.windowLabel.length > 12);
    countUp($('#fValue'), animate ? final.initialWealth : final.finalWealth, final.finalWealth, money, 1200);
    const chips = [`<span class="chip ${tone(final.returnPercent)}">${pct(final.returnPercent)}</span>`];
    if (Number.isFinite(final.nifty50ReturnPercent)) chips.push(`<span class="chip">Nifty ${pct(final.nifty50ReturnPercent)}</span>`);
    if (Number.isFinite(final.beatNiftyBy)) chips.push(`<span class="chip g">${final.beatNiftyBy >= 0 ? `Beat it by ${money(final.beatNiftyBy)}` : `Behind by ${money(-final.beatNiftyBy)}`}</span>`);
    $('#fDelta').innerHTML = chips.join('');
    $('#fStamp').hidden = !final.title;
    revealCard.classList.toggle('has-stamp', Boolean(final.title));
    if (final.title) $('#fStamp').innerHTML = `TITLE<b>${esc(final.title.name)}</b>`;

    const series = [
      { points: final.hindsight.chartPoints, kind: 'best' },
      final.niftyPath ? { points: final.niftyPath, kind: 'nifty' } : null,
      { points: final.chartPoints, kind: 'you', endLabel: false }
    ].filter(Boolean);
    drawChart($('#fChart'), { height: 104, total: final.history.length, labels: final.chartLabels, series, animate: animate && !reducedMotion });
    $('#fLegend').innerHTML = legend(final.niftyPath ? ['you', 'nifty', 'best'] : ['you', 'best']);
    $('#fChart').setAttribute('aria-label', `You: ${final.chartPoints.map(value => short(value)).join(', ')}. Best possible: ${short(final.hindsight.finalWealth)}.`);

    const stats = [];
    const board = final.leaderboard;
    if (board && board.total) {
      stats.push(board.total === 1
        ? '<div class="stat"><small>vs players</small><b>First in</b><span>1 finisher so far today</span></div>'
        : `<div class="stat"><small>vs players</small><b>Top ${board.percentile}%</b><span>#${board.rank} of ${board.total} today</span></div>`);
    }
    if (final.yearGuess) {
      stats.push(final.yearGuess.correct
        ? `<div class="stat"><small>Year guess</small><b>Spot on ✓</b><span>${final.yearGuess.answer}</span></div>`
        : `<div class="stat"><small>Year guess</small><b>It was ${final.yearGuess.answer}</b><span>You said ${final.yearGuess.guess}</span></div>`);
    }
    stats.push(`<div class="stat"><small>Hindsight max</small><b>${short(final.hindsight.finalWealth)}</b><span>best under the rules</span></div>`);
    $('#fStats').style.setProperty('--n', stats.length);
    $('#fStats').innerHTML = stats.join('');

    const periods = final.puzzle.periods.map(shortPeriod);
    const rows = final.ledger.filter(row => row.chips.some(Boolean));
    $('#fLedger').innerHTML = `<tr><th>Asset</th>${periods.map(period => `<th>${esc(period)}</th>`).join('')}<th>Chips</th></tr>${rows.map(row => `<tr><td>${esc(row.name)}</td>${row.returns.map(value => `<td class="${value === null ? "" : tone(value, 0)}">${value === null ? '' : pct(value, 0)}</td>`).join('')}<td>${row.chips.join('·')}</td></tr>`).join('')}`;

    $('#fWhy').innerHTML = (final.whyItMoved || []).map(item => `<div class="story"><b>Why it moved · biggest ${item.kind === 'winner' ? 'winner' : 'loser'}</b><p><span class="hl">${esc(item.assetName)} ${pct(item.returnPercent, 0)}.</span> ${esc(item.headline)}${item.summary ? `: ${esc(item.summary)}` : ''} <a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.outlet)} ↗</a>${item.decoded ? ` · <a href="${esc(item.decoded.href)}" data-rabbit-hole-link>${esc(item.decoded.title)} →</a>` : ''}</p></div>`).join('');

    $('#fReal').innerHTML = Number.isFinite(final.cashRealWealth)
      ? `${short(final.initialWealth)} kept in cash would be worth <b>${short(final.cashRealWealth)}</b> after inflation.<small>India CPI over ${esc(final.puzzle.windowLabel)}. Cash earns 0% nominal in the game.</small>`
      : '';

    $('#shareWa').href = `https://wa.me/?text=${encodeURIComponent(shareText(final))}`;
    $('#fNote').textContent = final.puzzle.mode === 'daily' ? 'A new daily puzzle drops at midnight IST.' : 'Unlimited games don’t count towards the daily ranking.';
    $('#chronCount').textContent = `· ${final.chronicle.length} ${final.chronicle.length === 1 ? 'story' : 'stories'}, with dates and sources`;
    $('#fChronicle').innerHTML = final.chronicle.map(item => `<li><span class="flag">${esc(item.region)}</span><time datetime="${esc(item.date)}">${fullDate(item.date)}</time><h4>${esc(item.headline)}</h4>${item.summary ? `<p>${esc(item.summary)}</p>` : ''}<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.outlet)} ↗</a></li>`).join('');
    $('#fRabbit').innerHTML = rabbitHoles.map(item => `<a class="rabbit-card" href="/rabbit-holes/${esc(item.slug)}" data-rabbit-hole-link><small>${esc(item.category)} · ${esc(item.readTime)}</small><h4>${esc(item.title)}</h4><p>${esc(item.summary)}</p><span>Go down the rabbit hole ↗</span></a>`).join('');
    $('#fAssumptions').innerHTML = final.assumptions.map(item => `<li>${esc(item)}</li>`).join('');
    showScreen('screen-final');
  }

  // ---------- charts ----------
  let clipCounter = 0;
  function drawChart(svg, { height, total, labels, series, animate }) {
    const width = 330;
    const left = 14;
    const right = 316;
    const top = 10;
    const bottom = height - 22;
    const all = series.flatMap(item => item.points);
    let min = Math.min(...all);
    let max = Math.max(...all);
    const padding = Math.max(1, (max - min) * 0.1);
    min -= padding;
    max += padding;
    const x = index => left + index * ((right - left) / Math.max(1, total));
    const y = value => bottom - ((value - min) / (max - min)) * (bottom - top);
    const styles = {
      you: 'fill="none" stroke="#173a2a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"',
      nifty: 'fill="none" stroke="#c49a3c" stroke-width="2" stroke-dasharray="4 3"',
      best: 'fill="none" stroke="#9aa39b" stroke-width="1.6" stroke-dasharray="1.5 3" stroke-linecap="round"'
    };
    const known = Math.max(...series.map(item => item.points.length)) - 1;
    let markup = `<line x1="8" y1="${bottom}" x2="322" y2="${bottom}" stroke="#e3ddcf"/>`;
    for (let index = known + 1; index <= total; index += 1) markup += `<line x1="${x(index)}" y1="${top}" x2="${x(index)}" y2="${bottom}" stroke="#e3ddcf" stroke-dasharray="2 3"/>`;
    markup += labels.map((label, index) => {
      const anchor = index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle';
      const lx = index === 0 ? 6 : index === labels.length - 1 ? 324 : x(index);
      return `<text x="${lx}" y="${height - 6}" font-size="9" fill="#6f7a70" font-family="JetBrains Mono, monospace" text-anchor="${anchor}">${esc(label)}</text>`;
    }).join('');
    const clipId = `clip${clipCounter += 1}`;
    const lines = series.map(item => {
      const points = item.points.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
      return `<polyline points="${points}" ${styles[item.kind]}/>`;
    }).join('');
    const you = series.find(item => item.kind === 'you');
    let marker = '';
    if (you) {
      const index = you.points.length - 1;
      const cx = x(index);
      const cy = y(you.points[index]);
      marker = `<circle cx="${cx}" cy="${cy}" r="4" fill="#173a2a"/>`;
      if (you.endLabel && index > 0) {
        const anchor = cx > 250 ? 'end' : 'start';
        marker += `<text x="${anchor === 'end' ? cx - 8 : cx + 8}" y="${cy - 6}" font-size="11" font-weight="700" fill="#173a2a" text-anchor="${anchor}">${short(you.points[index])}</text>`;
      }
    }
    markup += `<defs><clipPath id="${clipId}"><rect ${animate ? 'class="draw"' : ''} x="0" y="0" width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#${clipId})">${lines}${marker}</g>`;
    svg.innerHTML = markup;
  }

  // ---------- sharing ----------
  function shareText(final) {
    const parts = [final.puzzle.mode === 'daily' ? `DD Beat the Past #${pad3(final.puzzle.number)}` : 'DD Beat the Past · Unlimited'];
    if (final.title) parts.push(final.title.name);
    parts.push(`₹10L → ${short(final.finalWealth)} (${pct(final.returnPercent, 0)})`);
    if (final.rounds.every(round => round.beatNifty !== null)) parts.push(final.rounds.map(round => (round.beatNifty ? '🟩' : '🟥')).join(''));
    parts.push(SITE);
    return parts.join(' · ');
  }

  async function drawShareCard(final) {
    try { await document.fonts.ready; } catch (_) { /* fonts optional */ }
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    const ink = '#173a2a';
    const paper = '#faf7f0';
    const gold = '#c49a3c';
    const serif = 'Fraunces, Georgia, serif';
    const sans = 'Inter, system-ui, sans-serif';
    const mono = '"JetBrains Mono", monospace';
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, 1080, 1920);
    const X = 96;
    let Y = 150;
    // brand
    ctx.fillStyle = gold;
    roundRect(ctx, X, Y - 70, 96, 96, 22);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = `600 38px ${mono}`;
    ctx.textAlign = 'center';
    ctx.fillText('DD', X + 48, Y - 8);
    ctx.textAlign = 'left';
    ctx.fillStyle = paper;
    ctx.font = `600 58px ${serif}`;
    ctx.fillText('Beat the Past', X + 128, Y);
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.7;
    ctx.font = `500 40px ${mono}`;
    ctx.fillText(final.puzzle.mode === 'daily' ? `#${pad3(final.puzzle.number)}` : 'UNLIMITED', 1080 - X, Y - 8);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    // headline number
    Y += 230;
    ctx.font = `600 128px ${serif}`;
    ctx.fillStyle = paper;
    const lead = '₹10L → ';
    ctx.fillText(lead, X, Y);
    ctx.fillStyle = gold;
    ctx.fillText(short(final.finalWealth), X + ctx.measureText(lead).width, Y);
    // subline
    Y += 100;
    ctx.fillStyle = paper;
    ctx.globalAlpha = 0.85;
    ctx.font = `500 48px ${sans}`;
    const sub = [];
    if (Number.isFinite(final.beatNiftyBy)) sub.push(final.beatNiftyBy >= 0 ? `Beat the Nifty by ${short(final.beatNiftyBy)}` : `Behind the Nifty by ${short(-final.beatNiftyBy)}`);
    else sub.push(`${pct(final.returnPercent)} in four rounds`);
    if (final.leaderboard?.total > 1) sub.push(`Top ${final.leaderboard.percentile}% today`);
    Y = wrapText(ctx, sub.join(' · '), X, Y, 1080 - 2 * X, 64);
    ctx.globalAlpha = 1;
    // round squares (only when each round can be compared with the Nifty)
    if (final.rounds.every(round => round.beatNifty !== null)) {
      Y += 60;
      const gap = 24;
      const size = (1080 - 2 * X - gap * 3) / 4;
      final.rounds.forEach((round, index) => {
        ctx.fillStyle = round.beatNifty ? '#2f7d4f' : '#b9443a';
        roundRect(ctx, X + index * (size + gap), Y, size, 136, 24);
        ctx.fill();
      });
      Y += 136 + 70;
      ctx.fillStyle = paper;
      ctx.globalAlpha = 0.7;
      ctx.font = `500 38px ${mono}`;
      ctx.fillText('ROUNDS VS NIFTY', X, Y);
      ctx.globalAlpha = 1;
    } else {
      Y += 110;
      ctx.fillStyle = paper;
      ctx.globalAlpha = 0.7;
      ctx.font = `500 38px ${mono}`;
      ctx.fillText('YOUR ₹10L, ROUND BY ROUND', X, Y);
      ctx.globalAlpha = 1;
    }
    // mini chart
    Y += 60;
    // Without the round squares, the chart takes their space.
    const chartH = final.rounds.every(round => round.beatNifty !== null) ? 340 : 520;
    const all = [...final.chartPoints, ...(final.niftyPath || [])];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const cx = index => X + 16 + index * ((1080 - 2 * X - 32) / (final.chartPoints.length - 1));
    const cy = value => Y + chartH - 16 - ((value - min) / Math.max(1, max - min)) * (chartH - 32);
    const line = (points, color, widthPx, dash) => {
      ctx.beginPath();
      points.forEach((value, index) => (index ? ctx.lineTo(cx(index), cy(value)) : ctx.moveTo(cx(index), cy(value))));
      ctx.strokeStyle = color;
      ctx.lineWidth = widthPx;
      ctx.lineJoin = 'round';
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (final.niftyPath) line(final.niftyPath, gold, 8, [16, 12]);
    line(final.chartPoints, '#ffffff', 10, []);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx(final.chartPoints.length - 1), cy(final.chartPoints.at(-1)), 16, 0, Math.PI * 2);
    ctx.fill();
    Y += chartH + 40;
    if (final.yearGuess) {
      ctx.fillStyle = paper;
      ctx.globalAlpha = 0.85;
      ctx.font = `500 46px ${sans}`;
      const label = final.yearGuess.correct ? 'Guessed the years: ' : 'The years were ';
      ctx.fillText(label, X, Y + 40);
      ctx.globalAlpha = 1;
      ctx.fillStyle = gold;
      ctx.font = `700 46px ${sans}`;
      const years = `${final.puzzle.startYear}–${String(final.puzzle.startYear + 3).slice(2)} ${final.yearGuess.correct ? '✓' : ''}`.trim();
      ctx.fillText(years, X + ctx.measureText(label).width + 6, Y + 40);
    }
    // title stamp
    if (final.title) {
      ctx.save();
      ctx.translate(540, 1610);
      ctx.rotate(-3 * Math.PI / 180);
      ctx.strokeStyle = gold;
      ctx.lineWidth = 8;
      roundRect(ctx, -444, -90, 888, 170, 40);
      ctx.stroke();
      ctx.fillStyle = gold;
      ctx.font = `500 80px ${serif}`;
      ctx.textAlign = 'center';
      ctx.fillText(final.title.name, 0, 24);
      ctx.restore();
    }
    ctx.fillStyle = paper;
    ctx.globalAlpha = 0.8;
    ctx.font = `500 46px ${sans}`;
    ctx.textAlign = 'left';
    ctx.fillText(final.puzzle.calendar ? 'Can you guess the years?' : 'Can you beat the past?', X, 1790);
    ctx.fillText(SITE, X, 1850);
    ctx.globalAlpha = 1;
    return canvas;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = word;
        y += lineHeight;
      } else line = test;
    }
    ctx.fillText(line, x, y);
    return y;
  }

  async function shareStory() {
    const final = S.final;
    if (!final) return;
    const button = $('#shareStory');
    button.disabled = true;
    try {
      const canvas = await drawShareCard(final);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const name = `beat-the-past-${final.puzzle.mode === 'daily' ? pad3(final.puzzle.number) : 'unlimited'}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText(final) });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast('Story image saved.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') toast('Sharing isn’t available in this browser.');
    } finally {
      button.disabled = false;
    }
  }

  async function openRabbitHole(link) {
    const destination = link.getAttribute('href');
    try {
      await fetch('/api/auth/session').then(response => { if (!response.ok) throw new Error('guest'); });
      window.location.assign(destination);
    } catch (_) {
      window.location.assign(`/login?returnTo=${encodeURIComponent(destination)}`);
    }
  }

  // ---------- coach marks (first visit; "How to play" replays) ----------
  function startIntro() {
    if (!S.current || !$('#screen-round').classList.contains('is-active')) return;
    const steps = [];
    // Step 1: it's all real. Names the real stretch only when the years aren't hidden.
    const names = S.current.assets.filter(asset => !asset.isCash).map(asset => asset.shortName);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names.join('');
    steps.push({
      target: () => $('#rHead'),
      title: 'Real markets. Real headlines.',
      text: hidden()
        ? `Everything here really happened. Every price is real monthly market data for ${list}, converted to rupees, and every headline is a real story with its source. The years stay hidden until the end.`
        : `Everything here really happened${S.puzzle.span ? ` between ${S.puzzle.span.split(' – ').join(' and ')}` : ''}. Every price is real monthly market data for ${list}, converted to rupees, and every headline is a real story with its source.`
    });
    if (!$('#rWire').hidden) {
      steps.push({ target: () => $('#rWire'), title: 'Work out when you are.', text: `These are real headlines from the ${hidden() ? 'year' : 'stretch'} you’ve landed in. Use what you know about the markets to guess what happens next.` });
    }
    steps.push({ target: () => $('.asset'), title: `Tap + to put ${short(S.current.wealth / S.current.chipCount)} on an asset.`, text: `Max ${S.current.maxChipsPerAsset} chips on any one.`, advanceOn: 'chip' });
    steps.push({ target: () => $('#tray'), title: `Place all ${S.current.chipCount}, then lock in.`, text: `You can hold or move your chips after each ${unit()}.` });
    S.intro = { steps, index: 0 };
    $('#coach').hidden = false;
    renderIntro();
  }

  function renderIntro() {
    if (!S.intro) return;
    const { steps, index } = S.intro;
    const step = steps[index];
    const target = step.target();
    if (!target) return endIntro();
    target.scrollIntoView({ block: 'nearest' });
    const rect = target.getBoundingClientRect();
    const spot = $('#coachSpot');
    Object.assign(spot.style, { top: `${rect.top - 3}px`, left: `${rect.left - 3}px`, width: `${rect.width + 6}px`, height: `${rect.height + 6}px`, borderRadius: target.id === 'tray' ? '0' : '14px' });
    $('#coachStep').textContent = `${index + 1} of ${steps.length} · 20 seconds`;
    $('#coachTitle').textContent = step.title;
    $('#coachText').textContent = step.text;
    $('#coachNext').textContent = index === steps.length - 1 ? 'Got it' : 'Next →';
    $('#coachBar').style.width = `${((index + 1) / steps.length) * 100}%`;
    const card = $('#coachCard');
    const cardHeight = card.offsetHeight || 190;
    const below = rect.bottom + 16;
    card.style.top = `${below + cardHeight < window.innerHeight - 8 ? below : Math.max(8, rect.top - cardHeight - 16)}px`;
  }

  function nextIntro() {
    if (!S.intro) return;
    S.intro.index += 1;
    if (S.intro.index >= S.intro.steps.length) return endIntro();
    renderIntro();
  }

  function endIntro() {
    if (!S.intro) return;
    S.intro = null;
    $('#coach').hidden = true;
    local.set(KEY_INTRO, '1');
  }

  // ---------- events ----------
  document.addEventListener('click', event => {
    const rabbit = event.target.closest('[data-rabbit-hole-link]');
    if (rabbit) { event.preventDefault(); openRabbitHole(rabbit); return; }
    const action = event.target.closest('[data-act]');
    if (action && !action.disabled) {
      const id = action.dataset.asset;
      setChips(id, S.allocations[id] + (action.dataset.act === 'plus' ? 1 : -1));
      return;
    }
    const slot = event.target.closest('.slot');
    if (slot && !slot.disabled) {
      const id = slot.dataset.asset;
      setChips(id, S.allocations[id] + (slot.classList.contains('f') ? -1 : 1));
      return;
    }
    const guess = event.target.closest('[data-guess]');
    if (guess) finish(Number(guess.dataset.guess));
  });
  $('#equalSplit').addEventListener('click', equalSplit);
  $('#clearChips').addEventListener('click', () => { S.current.assets.forEach(asset => { S.allocations[asset.id] = 0; }); updateAllocation(); });
  $('#lockIn').addEventListener('click', lockIn);
  $('#goNext').addEventListener('click', goNext);
  $('#optHold').addEventListener('click', () => { $('#optHold').classList.add('sel'); $('#optMove').classList.remove('sel'); });
  $('#optMove').addEventListener('click', openMove);
  $('#cancelMove').addEventListener('click', () => showResult(S.outcome, { animate: false }));
  $('#shareStory').addEventListener('click', shareStory);
  $('#playUnlimited').addEventListener('click', () => start('unlimited'));
  $('#howTo').addEventListener('click', () => { endIntro(); startIntro(); });
  $('#coachNext').addEventListener('click', nextIntro);
  $('#coachSkip').addEventListener('click', endIntro);
  window.addEventListener('resize', () => renderIntro());
  document.addEventListener('keydown', event => { if (event.key === 'Escape') endIntro(); });

  // Test hook for screenshots / QA: lets a script render the share card.
  window.__btp = { drawShareCard: () => (S.final ? drawShareCard(S.final) : null), state: S };
  boot();
})();
