(() => {
  'use strict';

  const screens = [...document.querySelectorAll('.screen')];
  const state = {
    sessionId: null,
    mode: 'story',
    current: null,
    allocations: {},
    outcome: null,
    gapRevealed: false,
    locking: false
  };

  const $ = selector => document.querySelector(selector);
  const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  const compactMoney = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

  function showScreen(id) {
    screens.forEach(screen => screen.classList.toggle('is-active', screen.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function formatPercent(value, digits = 1) {
    const numeric = Number(value || 0);
    return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(digits)}%`;
  }

  function nativePrice(asset) {
    if (asset.id === 'CASH_INR') return '₹1.00';
    const prefix = asset.currency === 'USD' ? '$' : '₹';
    return `${prefix}${number.format(asset.currentPrice)}`;
  }

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The time machine did not respond.');
    return payload;
  }

  async function startGame(mode) {
    const buttons = document.querySelectorAll('[data-start-mode]');
    buttons.forEach(button => { button.disabled = true; });
    try {
      const payload = await api('/api/time-machine/start', { method: 'POST', body: JSON.stringify({ mode }) });
      state.sessionId = payload.sessionId;
      state.mode = payload.mode;
      renderRound(payload.current);
      showScreen('game-screen');
    } catch (error) {
      toast(error.message);
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  function renderRound(current) {
    state.current = current;
    state.allocations = Object.fromEntries(current.assets.map(asset => [asset.id, 0]));
    state.outcome = null;
    state.gapRevealed = false;
    $('#round-kicker').textContent = state.mode === 'daily' ? 'TODAY’S QUICK PUZZLE' : `YEAR ${current.round} OF ${current.totalRounds}`;
    $('#round-label').textContent = current.label;
    $('#arrival-label').textContent = current.label;
    $('#date-line').textContent = 'THE CALENDAR YEAR IS HIDDEN';
    $('#context-date').textContent = `KNOWN AT THE START OF Y${current.round}`;
    $('#wealth-value').textContent = money.format(current.wealth);
    $('#context-items').innerHTML = current.context.map(item => `<p>${item}</p>`).join('');
    $('#known-inflation').textContent = current.inflationContext
      ? `Latest published India CPI context: ${current.inflationContext.percent.toFixed(2)}%. The calendar label stays hidden.`
      : 'No annual inflation context is available for this checkpoint.';
    $('#progress-dots').innerHTML = Array.from({ length: current.totalRounds }, (_, index) => {
      const roundNumber = index + 1;
      const status = roundNumber < current.round ? 'done' : roundNumber === current.round ? 'current' : '';
      return `<i class="${status}" aria-label="Round ${roundNumber}"></i>`;
    }).join('');
    $('#game-error').textContent = '';
    renderAllocationCards();
    updateAllocationUi();
  }

  function renderAllocationCards() {
    $('#asset-grid').innerHTML = state.current.assets.map(asset => {
      const trailing = asset.trailingReturn === null
        ? '<span>Not available</span>'
        : `<b class="${asset.trailingReturn >= 0 ? 'positive' : 'negative'}">${formatPercent(asset.trailingReturn * 100)}</b>`;
      return `<article class="allocation-card" data-asset-card="${asset.id}" style="--asset-color:${asset.color}">
        <div class="asset-meta"><h4>${asset.shortName}</h4><span class="currency-pill">${asset.currency}${asset.currency === 'USD' ? ' → INR' : ''}</span></div>
        <div class="asset-price"><small>LAST KNOWN MONTHLY CLOSE</small><strong>${nativePrice(asset)}</strong><div class="trailing">Prior 6 months: ${trailing}</div></div>
        <p class="asset-description">${asset.explanation}</p>
        <div class="chip-control">
          <button data-chip-action="minus" data-asset="${asset.id}" aria-label="Remove a chip from ${asset.shortName}">−</button>
          <div class="chip-count"><strong data-chip-count="${asset.id}">0</strong><span>CHIPS</span></div>
          <button data-chip-action="plus" data-asset="${asset.id}" aria-label="Add a chip to ${asset.shortName}">+</button>
        </div>
        <div class="allocation-amount"><small>ALLOCATION</small><strong data-amount="${asset.id}">₹0</strong></div>
      </article>`;
    }).join('');
  }

  function allocationTotal() {
    return Object.values(state.allocations).reduce((sum, chips) => sum + chips, 0);
  }

  function adjustChips(assetId, delta) {
    const next = state.allocations[assetId] + delta;
    if (next < 0 || next > state.current.maxChipsPerAsset) return;
    if (delta > 0 && allocationTotal() >= state.current.chipCount) return;
    state.allocations[assetId] = next;
    updateAllocationUi();
  }

  function updateAllocationUi() {
    const total = allocationTotal();
    const chipValue = state.current.wealth / state.current.chipCount;
    state.current.assets.forEach(asset => {
      const chips = state.allocations[asset.id];
      const card = document.querySelector(`[data-asset-card="${CSS.escape(asset.id)}"]`);
      if (!card) return;
      card.classList.toggle('has-chips', chips > 0);
      card.querySelector(`[data-chip-count="${CSS.escape(asset.id)}"]`).textContent = chips;
      card.querySelector(`[data-amount="${CSS.escape(asset.id)}"]`).textContent = money.format(chips * chipValue);
      card.querySelector('[data-chip-action="minus"]').disabled = chips === 0;
      card.querySelector('[data-chip-action="plus"]').disabled = chips >= state.current.maxChipsPerAsset || total >= state.current.chipCount;
    });
    const assigned = [];
    state.current.assets.forEach(asset => {
      for (let index = 0; index < state.allocations[asset.id]; index += 1) assigned.push(asset.color);
    });
    $('#chip-track').innerHTML = Array.from({ length: state.current.chipCount }, (_, index) =>
      `<i class="${assigned[index] ? 'filled' : ''}" style="--chip-color:${assigned[index] || 'transparent'}"></i>`
    ).join('');
    $('#allocated-total').textContent = `${total} / ${state.current.chipCount}`;
    const remaining = state.current.chipCount - total;
    $('#allocation-status').textContent = remaining ? `${remaining} chip${remaining === 1 ? '' : 's'} left` : 'Ready to lock';
    $('#lock-button').disabled = total !== state.current.chipCount || state.locking;
  }

  async function lockPortfolio() {
    if (state.locking || allocationTotal() !== state.current.chipCount) return;
    state.locking = true;
    $('#game-error').textContent = '';
    $('#lock-button').textContent = 'Travelling through history…';
    updateAllocationUi();
    try {
      const outcome = await api('/api/time-machine/lock', {
        method: 'POST',
        body: JSON.stringify({ sessionId: state.sessionId, allocations: state.allocations })
      });
      state.outcome = outcome;
      renderReveal(outcome);
      showScreen('reveal-screen');
    } catch (error) {
      $('#game-error').textContent = error.message;
    } finally {
      state.locking = false;
      $('#lock-button').innerHTML = 'Lock portfolio & travel <span>→</span>';
      updateAllocationUi();
    }
  }

  function renderReveal(outcome) {
    $('#reveal-screen').classList.remove('gap-visible');
    const reveal = outcome.reveal;
    const change = reveal.endWealth - reveal.startWealth;
    const changePercent = (reveal.endWealth / reveal.startWealth - 1) * 100;
    const winner = reveal.assets.find(asset => asset.id === reveal.winner);
    $('#reveal-period').textContent = reveal.label;
    $('#reveal-wealth').textContent = money.format(reveal.endWealth);
    $('#reveal-change').className = `big-change ${change >= 0 ? 'positive' : 'negative'}`;
    $('#reveal-change').textContent = `${change >= 0 ? 'Gained' : 'Lost'} ${money.format(Math.abs(change))} · ${formatPercent(changePercent)}`;
    $('#winner-name').textContent = winner.name;
    $('#winner-return').textContent = formatPercent(winner.returnPercent);
    renderReturnBars(reveal.assets);
    const usdAssets = reveal.assets.filter(asset => asset.fxStart);
    $('#fx-explainer').innerHTML = usdAssets.map(asset => `<div class="fx-note"><strong>${asset.name}: USD converted to INR</strong><span>${asset.nativeCurrency} price ${number.format(asset.startPrice)} → ${number.format(asset.endPrice)} · USD/INR ${asset.fxStart.toFixed(3)} → ${asset.fxEnd.toFixed(3)}. Both ratios are included once.</span></div>`).join('');
    $('#gap-panel').hidden = true;
    $('#gap-panel').innerHTML = '';
    state.gapRevealed = !outcome.gapHold;
    const button = $('#continue-button');
    button.innerHTML = outcome.gapHold
      ? 'See the automatic hold result <span>→</span>'
      : outcome.completed ? 'See final result <span>→</span>' : `Rebalance for Y${state.current.round + 1} <span>→</span>`;
  }

  function renderReturnBars(assets) {
    const maxMagnitude = Math.max(1, ...assets.map(asset => Math.abs(asset.returnPercent)));
    $('#return-bars').innerHTML = assets.map(asset => {
      const width = Math.max(1.5, Math.abs(asset.returnPercent) / maxMagnitude * 50);
      return `<div class="return-row">
        <div class="return-row-name"><strong>${asset.name}</strong><small>${asset.chips ?? 'HOLD'} ${asset.chips === 1 ? 'chip' : 'chips'}</small></div>
        <div class="bar-axis"><i class="bar ${asset.returnPercent >= 0 ? 'positive-bar' : 'negative-bar'}" style="--bar-width:${width}%;--bar-color:${asset.color}"></i></div>
        <div class="return-value ${asset.returnPercent >= 0 ? 'positive' : 'negative'}">${formatPercent(asset.returnPercent)}</div>
      </div>`;
    }).join('');
  }

  function revealGap() {
    const gap = state.outcome.gapHold;
    if (!gap) return;
    const change = gap.endWealth - gap.startWealth;
    $('#gap-panel').hidden = false;
    $('#reveal-screen').classList.add('gap-visible');
    $('#gap-panel').innerHTML = `<p class="eyebrow">AUTOMATIC FAST-FORWARD</p><h3>${gap.label}</h3><p>${gap.description}</p>
      <div class="gap-result"><div><strong>${money.format(gap.endWealth)}</strong><span>WEALTH AFTER THE HOLD</span></div><div><strong class="${change >= 0 ? 'positive' : 'negative'}">${formatPercent((gap.endWealth / gap.startWealth - 1) * 100)}</strong><span>HOLD-SEGMENT CHANGE</span></div></div>`;
    state.gapRevealed = true;
    $('#continue-button').innerHTML = `Rebalance for Y${state.current.round + 1} <span>→</span>`;
  }

  async function continueJourney() {
    if (state.outcome?.gapHold && !state.gapRevealed) {
      revealGap();
      return;
    }
    if (state.outcome?.completed) {
      renderFinal(state.outcome.final);
      showScreen('final-screen');
      return;
    }
    const button = $('#continue-button');
    button.disabled = true;
    try {
      const payload = await api(`/api/time-machine/session/${state.sessionId}`);
      renderRound(payload.current);
      showScreen('game-screen');
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function renderFinal(final) {
    const positive = final.profitLoss >= 0;
    $('#final-verdict').textContent = positive ? 'You beat cash.' : 'History won this round.';
    $('#final-wealth').textContent = money.format(final.finalWealth);
    $('#final-return').className = positive ? 'positive' : 'negative';
    $('#final-return').textContent = `${formatPercent(final.returnPercent)} nominal return`;
    $('#final-profit').textContent = `${positive ? '+' : '−'}${money.format(Math.abs(final.profitLoss))}`;
    $('#cash-comparison').textContent = `${final.beatCashBy >= 0 ? '+' : '−'}${money.format(Math.abs(final.beatCashBy))}`;
    $('#final-rank').textContent = final.leaderboard?.total ? `#${final.leaderboard.rank} of ${final.leaderboard.total}` : 'First result';
    $('#inflation-years').innerHTML = final.inflationContext.map(item => `<div><strong>${item.percent === null ? 'n.a.' : `${item.percent.toFixed(2)}%`}</strong><span>${item.label}</span></div>`).join('');
    $('#assumption-list').innerHTML = final.assumptions.map(item => `<li>${item}</li>`).join('');
    drawWealthChart(final);
    loadLeaderboard();
  }

  function drawWealthChart(final) {
    const values = [final.initialWealth, ...final.history.map(item => item.endWealth)];
    const labels = ['Start', ...final.history.map(item => item.label)];
    const width = 720;
    const height = 240;
    const padX = 36;
    const padY = 32;
    const min = Math.min(...values) * .96;
    const max = Math.max(...values) * 1.04;
    const span = Math.max(1, max - min);
    const points = values.map((value, index) => ({
      x: padX + index * ((width - padX * 2) / Math.max(1, values.length - 1)),
      y: height - padY - ((value - min) / span) * (height - padY * 2),
      value
    }));
    const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const area = `${line} L ${points.at(-1).x} ${height - padY} L ${points[0].x} ${height - padY} Z`;
    $('#wealth-chart').innerHTML = `
      <line class="chart-grid-line" x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}"></line>
      <line class="chart-grid-line" x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}"></line>
      <path class="wealth-area" d="${area}"></path><path class="wealth-path" d="${line}"></path>
      ${points.map(point => `<circle class="wealth-point" cx="${point.x}" cy="${point.y}" r="6"><title>${money.format(point.value)}</title></circle>`).join('')}`;
    const labelsElement = $('#journey-labels');
    labelsElement.style.setProperty('--label-count', labels.length);
    labelsElement.innerHTML = labels.map(label => `<span>${label}</span>`).join('');
  }

  async function shareResult() {
    const final = state.outcome?.final;
    if (!final) return;
    const text = `I turned ₹10,00,000 into ${money.format(final.finalWealth)} in the Indian Time Machine (${formatPercent(final.returnPercent)}). Can you beat the past?`;
    try {
      if (navigator.share) await navigator.share({ title: 'Indian Time Machine', text, url: location.origin + '/game' });
      else {
        await navigator.clipboard.writeText(`${text} ${location.origin}/game`);
        toast('Result copied to your clipboard.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') toast('Sharing is unavailable in this browser.');
    }
  }

  async function loadLeaderboard() {
    try {
      const payload = await api('/api/time-machine/leaderboard?mode=story');
      $('#leaderboard').innerHTML = payload.entries.length ? payload.entries.map(entry => `<div class="leader-row"><span class="rank">${String(entry.rank).padStart(2, '0')}</span><div><strong>${entry.displayName}</strong><span>Verified story finish</span></div><div class="leader-value"><b>${compactMoney.format(entry.finalWealth)}</b><i>${formatPercent(entry.returnPercent)}</i></div></div>`).join('') : '<p class="loading-line">No completed Story Mode games yet. The first genuine finish will take the top spot.</p>';
    } catch (_) {
      $('#leaderboard').innerHTML = '<p class="loading-line">Leaderboard is unavailable while the local data service starts.</p>';
    }
  }

  document.addEventListener('click', event => {
    const start = event.target.closest('[data-start-mode]');
    if (start) startGame(start.dataset.startMode);
    const action = event.target.closest('[data-chip-action]');
    if (action) adjustChips(action.dataset.asset, action.dataset.chipAction === 'plus' ? 1 : -1);
    if (event.target.closest('[data-go-home]')) showScreen('home-screen');
  });

  $('#equal-split').addEventListener('click', () => {
    state.current.assets.forEach(asset => { state.allocations[asset.id] = 2; });
    updateAllocationUi();
  });
  $('#lock-button').addEventListener('click', lockPortfolio);
  $('#continue-button').addEventListener('click', continueJourney);
  $('#share-button').addEventListener('click', shareResult);
  $('#replay-button').addEventListener('click', () => startGame(state.mode));
  $('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('time-machine-theme', next);
  });
  const storedTheme = localStorage.getItem('time-machine-theme');
  if (storedTheme) document.documentElement.dataset.theme = storedTheme;
  loadLeaderboard();
})();
