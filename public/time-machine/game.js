(() => {
  'use strict';

  const screens = [...document.querySelectorAll('.screen')];
  const sessionKey = 'indian-time-machine-session';
  const chronicleKey = 'indian-time-machine-chronicle';
  const finalRabbitHoles = [
    {
      slug: 'marico-decoded',
      category: 'Made in India',
      readTime: '8 min read',
      title: 'Marico, decoded',
      summary: 'The Parachute company in 11 swipes: coconut oil dominance, Saffola’s second act, the overseas bet, and what could break the story.'
    },
    {
      slug: 'reliance-decoded',
      category: 'Made in India',
      readTime: '8 min read',
      title: 'Reliance, decoded',
      summary: 'India’s most valuable company in 11 swipes: oil, retail, telecom, media, and the machine connecting all of it.'
    },
    {
      slug: 'jio-ipo-decoded',
      category: 'Made in India',
      readTime: '8 min read',
      title: 'Jio IPO, decoded',
      summary: 'India’s biggest IPO, unpacked in 11 swipes: the business, the valuation, the risks, and the number that decides everything.'
    },
    {
      slug: 'trump-june-trades',
      category: 'Banks & Money',
      readTime: '7 min read',
      title: '1,051 trades in one month',
      summary: 'Every name identified from Donald Trump’s June filing: what was bought, what was sold, and what each company actually does.'
    }
  ];
  const state = {
    sessionId: null,
    mode: 'story',
    current: null,
    allocations: {},
    outcome: null,
    decision: null,
    final: null,
    isReshuffling: false,
    locking: false,
    revealAnimationFrame: null,
    revealAnimationTimer: null
  };

  const $ = selector => document.querySelector(selector);
  const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  const compactMoney = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

  function showScreen(id) {
    screens.forEach(screen => screen.classList.toggle('is-active', screen.id === id));
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
      state.decision = null;
      state.final = null;
      localStorage.setItem(sessionKey, state.sessionId);
      renderRound(payload.current);
      showScreen('game-screen');
    } catch (error) {
      toast(error.message);
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  function renderRound(current, prefill = {}, reshuffling = false) {
    state.current = current;
    state.isReshuffling = reshuffling;
    state.allocations = Object.fromEntries(current.assets.map(asset => [asset.id, Number(prefill[asset.id] || 0)]));
    $('#round-kicker').textContent = state.mode === 'daily' ? 'TODAY’S QUICK PUZZLE' : `YEAR ${current.round} OF ${current.totalRounds}`;
    $('#round-label').textContent = current.label;
    $('#arrival-label').textContent = current.label;
    $('#date-line').textContent = reshuffling ? 'OPTIONAL PORTFOLIO RESHUFFLE' : 'BUILD YOUR OPENING PORTFOLIO';
    $('#wealth-value').textContent = money.format(current.wealth);
    $('#progress-dots').innerHTML = Array.from({ length: current.totalRounds }, (_, index) => {
      const roundNumber = index + 1;
      const status = roundNumber < current.round ? 'done' : roundNumber === current.round ? 'current' : '';
      return `<i class="${status}" aria-label="Year ${roundNumber}"></i>`;
    }).join('');
    $('#game-error').textContent = '';
    $('#cancel-reshuffle').hidden = !reshuffling;
    $('#lock-button').innerHTML = reshuffling
      ? `Confirm reshuffle for Year ${current.round} <span>→</span>`
      : `Lock Year ${current.round} portfolio <span>→</span>`;
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
        <div class="asset-price"><small>LAST KNOWN MONTHLY CLOSE</small><strong>${nativePrice(asset)}</strong><div class="trailing">Prior movement: ${trailing}</div></div>
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
    $('#allocation-status').textContent = remaining ? `${remaining} chip${remaining === 1 ? '' : 's'} left` : 'Ready to confirm';
    $('#lock-button').disabled = total !== state.current.chipCount || state.locking;
  }

  async function lockPortfolio() {
    if (state.locking || allocationTotal() !== state.current.chipCount) return;
    state.locking = true;
    $('#game-error').textContent = '';
    $('#lock-button').textContent = 'Calculating the year…';
    updateAllocationUi();
    try {
      const endpoint = state.isReshuffling ? '/api/time-machine/advance' : '/api/time-machine/lock';
      const body = state.isReshuffling
        ? { sessionId: state.sessionId, action: 'reshuffle', allocations: state.allocations }
        : { sessionId: state.sessionId, allocations: state.allocations };
      const outcome = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
      state.outcome = outcome;
      renderReveal(outcome);
      showScreen('reveal-screen');
    } catch (error) {
      $('#game-error').textContent = error.message;
    } finally {
      state.locking = false;
      if (state.current) {
        $('#lock-button').innerHTML = state.isReshuffling
          ? `Confirm reshuffle for Year ${state.current.round} <span>→</span>`
          : `Lock Year ${state.current.round} portfolio <span>→</span>`;
        updateAllocationUi();
      }
    }
  }

  function renderReveal(outcome) {
    const reveal = outcome.reveal;
    const change = reveal.endWealth - reveal.startWealth;
    const changePercent = (reveal.endWealth / reveal.startWealth - 1) * 100;
    const winner = reveal.assets.find(asset => asset.id === reveal.winner);
    $('#reveal-period').textContent = reveal.label;
    $('#reveal-wealth').textContent = money.format(reveal.startWealth);
    $('#reveal-change').className = `big-change ${change >= 0 ? 'positive' : 'negative'}`;
    $('#reveal-change').textContent = `${change >= 0 ? 'Gained' : 'Lost'} ${money.format(Math.abs(change))} · ${formatPercent(changePercent)}`;
    $('#winner-name').textContent = winner.name;
    $('#winner-return').textContent = formatPercent(winner.returnPercent);
    renderReturnBars(reveal.assets);
    $('#gap-panel').hidden = true;
    renderNewspaper(outcome);
    $('#continue-button').innerHTML = outcome.isFinal ? 'See final results <span>→</span>' : 'Continue <span>→</span>';
    animateReveal(reveal.startWealth, reveal.endWealth);
  }

  function renderReturnBars(assets) {
    const maxMagnitude = Math.max(1, ...assets.map(asset => Math.abs(asset.returnPercent)));
    $('#return-bars').innerHTML = assets.map((asset, index) => {
      const width = Math.max(1.5, Math.abs(asset.returnPercent) / maxMagnitude * 50);
      const position = Number.isInteger(asset.chips) ? `${asset.chips} ${asset.chips === 1 ? 'chip' : 'chips'}` : 'Held unchanged';
      return `<div class="return-row" style="--row-index:${index}"><div class="return-row-name"><strong>${asset.name}</strong><small>${position}</small></div><div class="bar-axis"><span class="bar ${asset.returnPercent >= 0 ? 'positive-bar' : 'negative-bar'}" style="--bar-width:${width}%;--bar-color:${asset.color}"></span></div><div class="return-value ${asset.returnPercent >= 0 ? 'positive' : 'negative'}">${formatPercent(asset.returnPercent)}</div></div>`;
    }).join('');
  }

  function animateReveal(startWealth, endWealth) {
    const wrap = document.querySelector('.reveal-wrap');
    const wealth = $('#reveal-wealth');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (state.revealAnimationFrame) cancelAnimationFrame(state.revealAnimationFrame);
    if (state.revealAnimationTimer) clearTimeout(state.revealAnimationTimer);
    wrap.classList.remove('is-animating');
    void wrap.offsetWidth;
    if (reducedMotion) {
      wealth.textContent = money.format(endWealth);
      return;
    }
    wrap.classList.add('is-animating');
    const startedAt = performance.now();
    const duration = 950;
    const tick = now => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      wealth.textContent = money.format(startWealth + (endWealth - startWealth) * eased);
      if (progress < 1) state.revealAnimationFrame = requestAnimationFrame(tick);
      else {
        wealth.textContent = money.format(endWealth);
        state.revealAnimationFrame = null;
      }
    };
    state.revealAnimationFrame = requestAnimationFrame(tick);
    state.revealAnimationTimer = setTimeout(() => {
      wrap.classList.remove('is-animating');
      state.revealAnimationTimer = null;
    }, 1750);
  }

  function renderNewspaper(outcome) {
    const newspaper = outcome.newspaper;
    const stories = newspaper.stories || [];
    if (state.sessionId) localStorage.setItem(chronicleKey, JSON.stringify({ sessionId: state.sessionId, newspaper }));
    $('#chronicle-panel').hidden = false;
    $('#chronicle-panel').classList.remove('rabbit-hole-edition');
    $('#newspaper-edition').textContent = newspaper.period ? `${newspaper.period.toUpperCase()} EDITION` : 'HISTORICAL MARKET EDITION';
    $('#newspaper-masthead').textContent = newspaper.masthead;
    $('#newspaper-year').textContent = (newspaper.label || '').replace(/^Year (\d+) \S+ What Happened$/, 'What Just Happened in Year $1');
    $('.newspaper-footer p').textContent = 'These stories are revealed only after the year’s market result.';
    $('#newspaper-stories').className = `newspaper-stories story-count-${stories.length}`;
    $('#newspaper-stories').innerHTML = stories.map((story, index) => {
      const source = story.sourceUrl
        ? `<a href="${story.sourceUrl}" target="_blank" rel="noreferrer">${story.sourceName || 'Verified source'} ↗</a>`
        : '<span class="source-pending">Editorial archive</span>';
      return `<article class="news-story ${index === 0 ? 'lead-story' : ''}"><div class="news-meta"><span>${story.category}</span><time>${story.date}</time></div><h3>${story.headline}</h3><p>${story.summary}</p>${source}</article>`;
    }).join('');
  }

  function renderRabbitHoleChronicle() {
    const panel = $('#chronicle-panel');
    panel.hidden = false;
    panel.classList.add('rabbit-hole-edition');
    $('#newspaper-edition').textContent = 'FOUR STORIES TO KEEP EXPLORING';
    $('#newspaper-masthead').textContent = 'THE MARKET CHRONICLE';
    $('#newspaper-year').textContent = 'What’s Happening Now?';
    $('.newspaper-footer p').textContent = 'Choose a rabbit hole. Members go straight in; guests will be asked to log in.';
    $('#newspaper-stories').className = 'newspaper-stories story-count-4 rabbit-hole-stories';
    $('#newspaper-stories').innerHTML = finalRabbitHoles.map((story, index) => {
      const destination = `/rabbit-holes/${story.slug}`;
      return `<article class="news-story ${index === 0 ? 'lead-story' : ''}"><a class="rabbit-hole-card-link" data-rabbit-hole-link href="${destination}"><div class="news-meta"><span>${story.category}</span><time>${story.readTime}</time></div><h3>${story.title}</h3><p>${story.summary}</p><span class="rabbit-hole-cta">Go down the rabbit hole <span aria-hidden="true">↗</span></span></a></article>`;
    }).join('');
  }

  async function openRabbitHoleFromChronicle(link) {
    const destination = link.getAttribute('href');
    try {
      await api('/api/auth/session');
      window.location.assign(destination);
    } catch (_) {
      window.location.assign(`/login?returnTo=${encodeURIComponent(destination)}`);
    }
  }

  async function finishNewspaper() {
    const button = $('#continue-button');
    button.disabled = true;
    try {
      const payload = await api('/api/time-machine/newspaper/continue', { method: 'POST', body: JSON.stringify({ sessionId: state.sessionId }) });
      if (payload.completed) {
        state.final = payload.final;
        state.outcome = { final: payload.final };
        if (payload.newspaper) renderNewspaper({ newspaper: payload.newspaper });
        renderFinal(payload.final);
        showScreen('final-screen');
      } else {
        renderDecision(payload);
        showScreen('decision-screen');
      }
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function renderDecision(payload) {
    state.decision = payload;
    const newspaper = payload.newspaper || cachedChronicle();
    if (newspaper) {
      renderNewspaper({ newspaper });
      placeChronicle('decision');
    } else {
      $('#chronicle-panel').hidden = true;
    }
    const nextYear = payload.current.round;
    $('#decision-title').textContent = `Ready for Year ${nextYear}?`;
    $('#decision-wealth').textContent = money.format(payload.current.wealth);
    $('#decision-holdings').innerHTML = payload.portfolio.map(asset => `<article style="--asset-color:${asset.color}"><div><strong>${asset.name}</strong><span>${asset.weightPercent.toFixed(1)}% of portfolio</span></div><b>${money.format(asset.value)}</b></article>`).join('');
    $('#hold-portfolio').innerHTML = `Continue unchanged into Year ${nextYear} <span>→</span>`;
  }

  async function continueSamePortfolio() {
    const button = $('#hold-portfolio');
    button.disabled = true;
    try {
      const outcome = await api('/api/time-machine/advance', { method: 'POST', body: JSON.stringify({ sessionId: state.sessionId, action: 'hold' }) });
      state.outcome = outcome;
      renderReveal(outcome);
      showScreen('reveal-screen');
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  function openReshuffle() {
    if (!state.decision) return;
    renderRound(state.decision.current, state.decision.prefillAllocations, true);
    showScreen('game-screen');
  }

  function cancelReshuffle() {
    if (!state.decision) return;
    renderDecision(state.decision);
    showScreen('decision-screen');
  }

  function renderFinal(final) {
    state.final = final;
    const positive = final.profitLoss >= 0;
    const initialWealth = final.initialWealth || 1_000_000;
    const nifty50Wealth = Number.isFinite(final.nifty50Wealth)
      ? final.nifty50Wealth
      : Math.round((initialWealth * (23644.80 / 15780.25)) / 10) * 10;
    const nifty50ReturnPercent = Number.isFinite(final.nifty50ReturnPercent)
      ? final.nifty50ReturnPercent
      : (nifty50Wealth / initialWealth - 1) * 100;
    const beatNiftyBy = Number.isFinite(final.beatNiftyBy) ? final.beatNiftyBy : final.finalWealth - nifty50Wealth;
    const beatNifty = beatNiftyBy >= 0;
    $('#final-verdict').textContent = beatNifty ? 'You beat the Nifty.' : 'The Nifty beat you.';
    $('#final-wealth').textContent = money.format(final.finalWealth);
    $('#final-return').className = positive ? 'positive' : 'negative';
    $('#final-return').textContent = `${formatPercent(final.returnPercent)} portfolio return`;
    $('#final-profit').textContent = `${positive ? '+' : '−'}${money.format(Math.abs(final.profitLoss))}`;
    $('#nifty-comparison').className = beatNifty ? 'positive' : 'negative';
    $('#nifty-comparison').textContent = `${beatNifty ? '+' : '−'}${money.format(Math.abs(beatNiftyBy))}`;
    $('#nifty-benchmark-copy').textContent = `${money.format(nifty50Wealth)} benchmark value · ${formatPercent(nifty50ReturnPercent, 2)} price return`;
    $('#final-rank').textContent = final.leaderboard?.total ? `#${final.leaderboard.rank} of ${final.leaderboard.total}` : 'First result';
    const inflationValues = (final.inflationContext || []).map(item => item.percent).filter(Number.isFinite);
    const averageInflation = inflationValues.length
      ? inflationValues.reduce((sum, value) => sum + value, 0) / inflationValues.length
      : null;
    const inflationFactor = inflationValues.reduce((factor, value) => factor * (1 + value / 100), 1);
    const realCashValue = Number.isFinite(final.cashRealWealth)
      ? final.cashRealWealth
      : (inflationValues.length ? 1_000_000 / inflationFactor : null);
    const purchasingPowerLoss = Number.isFinite(final.cashPurchasingPowerLoss)
      ? final.cashPurchasingPowerLoss
      : (realCashValue === null ? null : 1_000_000 - realCashValue);
    $('#inflation-years').innerHTML = `
      <div><strong>${averageInflation === null ? 'n.a.' : `${averageInflation.toFixed(2)}%`}</strong><span>Average CPI</span></div>
      <div class="cash-real-value"><strong>${realCashValue === null ? 'n.a.' : money.format(realCashValue)}</strong><span>₹10 lakh cash after CPI adjustment</span><small>${purchasingPowerLoss === null ? 'Inflation data unavailable' : `${money.format(purchasingPowerLoss)} lost to inflation`}</small></div>`;
    $('#assumption-list').innerHTML = final.assumptions.map(item => `<li>${item}</li>`).join('');
    drawWealthChart(final);
    renderRabbitHoleChronicle();
    placeChronicle('final');
    loadLeaderboard();
  }

  function placeChronicle(destination) {
    const panel = $('#chronicle-panel');
    const parent = destination === 'final' ? document.querySelector('.final-wrap') : document.querySelector('.decision-wrap');
    if (panel.parentElement !== parent) parent.append(panel);
    panel.hidden = false;
  }

  function cachedChronicle() {
    try {
      const cached = JSON.parse(localStorage.getItem(chronicleKey) || 'null');
      return cached?.sessionId === state.sessionId ? cached.newspaper : null;
    } catch (_) {
      return null;
    }
  }

  function drawWealthChart(final) {
    const periods = (final.history || []).filter(item => /^Year [1-4]$/.test(item.label));
    const values = periods.map(item => item.endWealth);
    const labels = periods.map(item => item.label);
    const width = 720;
    const height = 220;
    const padX = 72;
    const padY = 44;
    const min = Math.min(...values) * .96;
    const max = Math.max(...values) * 1.04;
    const span = Math.max(1, max - min);
    const points = values.map((value, index) => ({ x: padX + index * ((width - padX * 2) / Math.max(1, values.length - 1)), y: height - padY - ((value - min) / span) * (height - padY * 2), value }));
    const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const area = `${line} L ${points.at(-1).x} ${height - padY} L ${points[0].x} ${height - padY} Z`;
    $('#wealth-chart').innerHTML = `<line class="chart-grid-line" x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}"></line><line class="chart-grid-line" x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}"></line><path class="wealth-area" d="${area}"></path><path class="wealth-path" d="${line}"></path>${points.map(point => `<g><circle class="wealth-point" cx="${point.x}" cy="${point.y}" r="6"><title>${money.format(point.value)}</title></circle><text class="wealth-value-label" x="${point.x}" y="${point.y < 70 ? point.y + 25 : point.y - 15}" text-anchor="middle">${compactMoney.format(point.value)}</text></g>`).join('')}`;
    const labelsElement = $('#journey-labels');
    labelsElement.style.setProperty('--label-count', labels.length);
    labelsElement.innerHTML = labels.map((label, index) => `<span><b>${label}</b><strong>${money.format(values[index])}</strong></span>`).join('');
  }

  async function shareResult() {
    const final = state.final;
    if (!final) return;
    const benchmarkDifference = Number.isFinite(final.beatNiftyBy) ? final.beatNiftyBy : final.finalWealth - 1_498_380;
    const benchmarkResult = benchmarkDifference >= 0 ? 'beat' : 'trailed';
    const text = `I turned ₹10,00,000 into ${money.format(final.finalWealth)} in the Indian Time Machine (${formatPercent(final.returnPercent)}) and ${benchmarkResult} the Nifty 50 benchmark. Can you beat the past?`;
    try {
      if (navigator.share) await navigator.share({ title: 'Indian Time Machine', text, url: location.origin + '/game' });
      else { await navigator.clipboard.writeText(`${text} ${location.origin}/game`); toast('Result copied to your clipboard.'); }
    } catch (error) {
      if (error.name !== 'AbortError') toast('Sharing is unavailable in this browser.');
    }
  }

  async function loadLeaderboard() {
    try {
      const payload = await api('/api/time-machine/leaderboard?mode=story');
      $('#leaderboard').innerHTML = payload.entries.length ? payload.entries.map(entry => `<div class="leader-row"><span class="rank">${String(entry.rank).padStart(2, '0')}</span><div><strong>${entry.displayName}</strong><span>Verified story finish</span></div><div class="leader-value"><b>${compactMoney.format(entry.finalWealth)}</b><span class="leader-return">${formatPercent(entry.returnPercent)}</span></div></div>`).join('') : '<p class="loading-line">No completed Story Mode games yet. The first genuine finish will take the top spot.</p>';
    } catch (_) {
      $('#leaderboard').innerHTML = '<p class="loading-line">Leaderboard is unavailable while the local data service starts.</p>';
    }
  }

  async function restoreSession() {
    const sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) return;
    try {
      const payload = await api(`/api/time-machine/session/${sessionId}`);
      state.sessionId = sessionId;
      state.mode = payload.mode;
      if (payload.completed) {
        state.outcome = { final: payload.final };
        const newspaper = payload.newspaper || cachedChronicle();
        if (newspaper) renderNewspaper({ newspaper });
        renderFinal(payload.final);
        showScreen('final-screen');
      } else if (payload.stage === 'newspaper') {
        renderReveal(payload.outcome);
        showScreen('reveal-screen');
      } else if (payload.stage === 'decision') {
        renderDecision(payload);
        showScreen('decision-screen');
      } else {
        renderRound(payload.current, payload.prefillAllocations || {}, false);
        showScreen('game-screen');
      }
    } catch (_) {
      localStorage.removeItem(sessionKey);
    }
  }

  document.addEventListener('click', event => {
    const rabbitHoleLink = event.target.closest('[data-rabbit-hole-link]');
    if (rabbitHoleLink) {
      event.preventDefault();
      openRabbitHoleFromChronicle(rabbitHoleLink);
      return;
    }
    const start = event.target.closest('[data-start-mode]');
    if (start) startGame(start.dataset.startMode);
    const action = event.target.closest('[data-chip-action]');
    if (action) adjustChips(action.dataset.asset, action.dataset.chipAction === 'plus' ? 1 : -1);
    if (event.target.closest('[data-go-home]')) showScreen('home-screen');
  });
  $('#equal-split').addEventListener('click', () => { state.current.assets.forEach(asset => { state.allocations[asset.id] = 2; }); updateAllocationUi(); });
  $('#lock-button').addEventListener('click', lockPortfolio);
  $('#cancel-reshuffle').addEventListener('click', cancelReshuffle);
  $('#continue-button').addEventListener('click', finishNewspaper);
  $('#hold-portfolio').addEventListener('click', continueSamePortfolio);
  $('#reshuffle-portfolio').addEventListener('click', openReshuffle);
  $('#share-button').addEventListener('click', shareResult);
  $('#replay-button').addEventListener('click', () => startGame(state.mode));
  loadLeaderboard();
  restoreSession();
})();
