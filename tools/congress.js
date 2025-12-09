// Congress Trade Monitor - Pelosi prototype

/**
 * @typedef {Object} Politician
 * @property {string} id
 * @property {string} name
 * @property {"House"|"Senate"} chamber
 * @property {"D"|"R"|"I"} party
 * @property {string} stateDistrict
 * @property {string} [profileNote]
 */

/**
 * @typedef {Object} Trade
 * @property {string} id
 * @property {string} politicianId
 * @property {string} ticker
 * @property {string} company
 * @property {"Stock"|"Option"|"Fund"} assetType
 * @property {"Buy"|"Sell"} transactionType
 * @property {"Direct"|"Exercise"|"Donation"} mechanism
 * @property {string} tradeDate // ISO YYYY-MM-DD
 * @property {string} notificationDate // ISO
 * @property {string} amountBracket
 * @property {string} [notes]
 * @property {string} filingId
 * @property {number} reportedYear
 * @property {number} tradeYear
 */

/** @type {Politician[]} */
const politicians = [
  {
    id: "pelosi",
    name: "Nancy Pelosi",
    chamber: "House",
    party: "D",
    stateDistrict: "CA11",
     profileNote:
       "Member of the U.S. House of Representatives for California’s 11th congressional district, and former Speaker of the House.",
  },
];

/** @type {Trade[]} */
const trades = [
  {
    id: "pelosi-2025-10-22-aapl-donation",
    politicianId: "pelosi",
    ticker: "AAPL",
    company: "Apple Inc. – Common Stock",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Donation",
    tradeDate: "2025-10-22",
    notificationDate: "2025-10-22",
    amountBracket: "$100,001 – $250,000",
    notes: "",
    filingId: "20033337",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "pelosi-2025-06-20-avgo-exercise",
    politicianId: "pelosi",
    ticker: "AVGO",
    company: "Broadcom Inc. – Common Stock",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Exercise",
    tradeDate: "2025-06-20",
    notificationDate: "2025-06-20",
    amountBracket: "$1,000,001 – $5,000,000",
    notes:
      "Exercised 200 call options purchased 06/24/24 (20,000 shares) at a strike price of $80 with an expiration date of 06/20/25.",
    filingId: "20030630",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "pelosi-2025-06-20-matthews-sale",
    politicianId: "pelosi",
    ticker: "N/A",
    company: "Matthews International Mutual Fund",
    assetType: "Fund",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-20",
    notificationDate: "2025-06-20",
    amountBracket: "$15,001 – $50,000",
    notes: "Sale of 2,822 units. Reported loss of $28,948 on sale.",
    filingId: "20030630",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "pelosi-2025-01-14-googl-calls",
    politicianId: "pelosi",
    ticker: "GOOGL",
    company: "Alphabet Inc. – Class A Common Stock",
    assetType: "Option",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-01-14",
    notificationDate: "2025-01-14",
    amountBracket: "$250,001 – $500,000",
    notes:
      "Purchased 50 call options with a strike price of $150 and an expiration date of 01/16/26.",
    filingId: "20026590",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "pelosi-2025-01-14-amzn-calls",
    politicianId: "pelosi",
    ticker: "AMZN",
    company: "Amazon.com, Inc. – Common Stock",
    assetType: "Option",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-01-14",
    notificationDate: "2025-01-14",
    amountBracket: "$250,001 – $500,000",
    notes:
      "Purchased 50 call options with a strike price of $150 and an expiration date of 01/16/26.",
    filingId: "20026590",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "pelosi-2025-01-14-tem-calls",
    politicianId: "pelosi",
    ticker: "TEM",
    company: "Tempus AI, Inc. – Class A Common Stock",
    assetType: "Option",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-01-14",
    notificationDate: "2025-01-14",
    amountBracket: "$50,001 – $100,000",
    notes:
      "Purchased 50 call options with a strike price of $20 and an expiration date of 01/16/26.",
    filingId: "20026590",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "pelosi-2025-01-14-vst-calls",
    politicianId: "pelosi",
    ticker: "VST",
    company: "Vistra Corp. – Common Stock",
    assetType: "Option",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-01-14",
    notificationDate: "2025-01-14",
    amountBracket: "$500,001 – $1,000,000",
    notes:
      "Purchased 50 call options with a strike price of $50 and an expiration date of 01/16/26.",
    filingId: "20026590",
    reportedYear: 2025,
    tradeYear: 2025,
  },

  // 2024-dated trades reported in 2025
  {
    id: "pelosi-2024-12-31-aapl-sale",
    politicianId: "pelosi",
    ticker: "AAPL",
    company: "Apple Inc. – Common Stock",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2024-12-31",
    notificationDate: "2024-12-31",
    amountBracket: "$5,000,001 – $25,000,000",
    notes: "Sold 31,600 shares.",
    filingId: "20026590",
    reportedYear: 2025,
    tradeYear: 2024,
  },
  {
    id: "pelosi-2024-12-31-nvda-sale",
    politicianId: "pelosi",
    ticker: "NVDA",
    company: "NVIDIA Corporation – Common Stock",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2024-12-31",
    notificationDate: "2024-12-31",
    amountBracket: "$1,000,001 – $5,000,000",
    notes: "Sold 10,000 shares.",
    filingId: "20026590",
    reportedYear: 2025,
    tradeYear: 2024,
  },
  {
    id: "pelosi-2024-12-20-nvda-exercise",
    politicianId: "pelosi",
    ticker: "NVDA",
    company: "NVIDIA Corporation – Common Stock",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Exercise",
    tradeDate: "2024-12-20",
    notificationDate: "2024-12-20",
    amountBracket: "$500,001 – $1,000,000",
    notes:
      "Exercised 500 call options purchased 11/22/23 (50,000 shares) at a strike price of $12 with an expiration date of 12/20/24.",
    filingId: "20026590",
    reportedYear: 2025,
    tradeYear: 2024,
  },
  {
    id: "pelosi-2024-12-20-panw-exercise",
    politicianId: "pelosi",
    ticker: "PANW",
    company: "Palo Alto Networks, Inc.",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Exercise",
    tradeDate: "2024-12-20",
    notificationDate: "2024-12-20",
    amountBracket: "$1,000,001 – $5,000,000",
    notes:
      "Exercised 140 call options purchased 02/12/24 & 02/21/24 (14,000 shares) at a strike price of $100 with an expiration date of 12/20/24.",
    filingId: "20026590",
    reportedYear: 2025,
    tradeYear: 2024,
  },
];

// Basic 2-sentence business model descriptions per ticker
const companyDescriptions = {
  AAPL:
    "Apple designs and sells smartphones, personal computers, tablets, wearables, and accessories, anchored by the iPhone, Mac, iPad, and Apple Watch. It complements its hardware with high‑margin services such as the App Store, iCloud, Apple Music, and Apple TV+, creating a sticky ecosystem that drives recurring revenue.",
  AVGO:
    "Broadcom is a diversified semiconductor and infrastructure software company whose chips power networking, broadband, storage, and wireless devices in data centers and communications equipment. It also owns high‑margin enterprise software franchises that provide subscription-based infrastructure, security, and mainframe solutions.",
  NVDA:
    "NVIDIA develops graphics processing units (GPUs) and accelerated computing platforms used in gaming, data centers, artificial intelligence, and high‑performance computing. Its CUDA software ecosystem and specialized hardware make it a foundational supplier of AI training and inference infrastructure worldwide.",
  PANW:
    "Palo Alto Networks is a leading cybersecurity company that offers next‑generation firewalls, cloud security, and endpoint protection for enterprises and governments. It generates recurring revenue from subscription security services that help organizations prevent, detect, and respond to cyber threats across networks and applications.",
  AMZN:
    "Amazon operates a global e‑commerce and logistics platform, connecting consumers and third‑party sellers across a wide range of product categories and digital content. Its Amazon Web Services (AWS) cloud business and fast‑growing online advertising provide high‑margin, recurring revenue that underpins the broader retail ecosystem.",
  GOOGL:
    "Alphabet’s Google segment runs the world’s dominant search engine, YouTube, and a broad suite of consumer services that monetize primarily through digital advertising. Google Cloud sells infrastructure, data, and AI services to enterprises, while Other Bets invest in long‑duration technologies such as autonomous driving and life sciences.",
  TEM:
    "Tempus AI builds a data and analytics platform for precision medicine, aggregating clinical and molecular data to help physicians personalize cancer and other complex treatments. It partners with healthcare providers and biopharma companies to support diagnostics, drug discovery, and clinical decision support tools.",
  VST:
    "Vistra Corp. is an integrated power company that owns and operates a diversified fleet of generation assets, including natural gas, nuclear, renewable, and battery storage resources. It supplies electricity and related services to residential, commercial, and industrial customers across U.S. markets with a focus on reliability and risk‑managed pricing.",
  "N/A":
    "This entry represents an investment fund whose underlying holdings span multiple securities and sectors rather than a single operating company.",
};

// Mapping from ticker to company-analysis section (data-company value)
const tickerToCompanyPage = {
  AMZN: "amazon",
  NVDA: "nvidia",
  GOOGL: "alphabet",
};

const state = {
  selectedPoliticianId: "pelosi",
  include2024: true,
  searchTerm: "",
  sortDir: "desc",
};

/**
 * @param {string} bracket
 * @returns {{low: number, high: number}|null}
 */
function parseAmountBracket(bracket) {
  const match = bracket && bracket.match(/\$(\d[\d,]*)\s*–\s*\$(\d[\d,]*)/);
  if (!match) return null;
  const low = parseInt(match[1].replace(/,/g, ""), 10);
  const high = parseInt(match[2].replace(/,/g, ""), 10);
  if (Number.isNaN(low) || Number.isNaN(high)) return null;
  return { low, high };
}

/**
 * @param {string} politicianId
 * @returns {Trade[]}
 */
function getTradesForPolitician(politicianId) {
  return trades.filter((t) => t.politicianId === politicianId);
}

/**
 * @param {Trade[]} baseTrades
 * @returns {Trade[]}
 */
function applyFilters(baseTrades) {
  let filtered = [...baseTrades];

  if (!state.include2024) {
    filtered = filtered.filter((t) => t.tradeYear !== 2024);
  }

  const term = state.searchTerm.trim().toLowerCase();
  if (term) {
    filtered = filtered.filter(
      (t) =>
        t.ticker.toLowerCase().includes(term) ||
        t.company.toLowerCase().includes(term)
    );
  }

  filtered.sort((a, b) =>
    state.sortDir === "desc"
      ? b.tradeDate.localeCompare(a.tradeDate)
      : a.tradeDate.localeCompare(b.tradeDate)
  );

  return filtered;
}

/**
 * @param {Trade[]} tradesForStats
 */
function computeStats(tradesForStats) {
  let buys = 0;
  let sells = 0;
  let lowSum = 0;
  let highSum = 0;

  tradesForStats.forEach((t) => {
    if (t.transactionType === "Buy") buys += 1;
    if (t.transactionType === "Sell") sells += 1;

    const range = parseAmountBracket(t.amountBracket);
    if (range) {
      lowSum += range.low;
      highSum += range.high;
    }
  });

  return {
    total: tradesForStats.length,
    buys,
    sells,
    lowSum,
    highSum,
  };
}

/**
 * @param {Trade[]} list
 */
function groupTradesByMonth(list) {
  const sorted = [...list].sort((a, b) =>
    b.tradeDate.localeCompare(a.tradeDate)
  );
  /** @type {{key:string,label:string,trades:Trade[]}[]} */
  const groups = [];

  sorted.forEach((trade) => {
    const [year, month] = trade.tradeDate.split("-");
    const key = `${year}-${month}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const date = new Date(`${trade.tradeDate}T00:00:00Z`);
      const label = date.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
      group = { key, label, trades: [] };
      groups.push(group);
    }
    group.trades.push(trade);
  });

  return groups;
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * @param {Trade} trade
 */
function getTransactionBadgeClass(trade) {
  return trade.transactionType === "Buy" ? "ct-badge ct-badge--buy" : "ct-badge ct-badge--sell";
}

/**
 * @param {Trade} trade
 */
function getAssetBadgeClass(trade) {
  if (trade.assetType === "Option") return "ct-badge ct-badge--option";
  if (trade.assetType === "Fund") return "ct-badge ct-badge--fund";
  return "ct-badge ct-badge--stock";
}

function buildPelosiBadge(p) {
  const partyLabel = p.party === "D" ? "Democrat" : p.party === "R" ? "Republican" : "Independent";
  const district = p.stateDistrict.replace(/(\D+)(\d+)/, "$1-$2");
  return `House • ${partyLabel} • ${district}`;
}

function formatDollarRange(low, high) {
  const fmt = (n) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : `$${(n / 1_000).toFixed(0)}k`;
  return `${fmt(low)} – ${fmt(high)}`;
}

function renderSidebar() {
  // Sidebar no longer used in the new UX; kept for potential future expansion.
}

/**
 * @param {Politician} politician
 * @param {Trade[]} polTrades
 */
function renderProfile(politician, polTrades) {
  const profileEl = document.getElementById("ct-profile");
  if (!profileEl) return;

  const stats = computeStats(polTrades);

  profileEl.innerHTML = `
    <div class="ct-profile-header ct-panel ct-section-card">
      <div class="ct-profile-title-row">
        <div>
          <h2 class="ct-profile-name">${politician.name}</h2>
          <div class="ct-profile-badge">
            ${buildPelosiBadge(politician)}
          </div>
        </div>
      </div>
      <p class="ct-profile-note">${politician.profileNote || ""}</p>
      <div class="ct-stat-grid">
        <div class="ct-stat-card">
          <div class="ct-stat-label">Total trades</div>
          <div class="ct-stat-value">${stats.total}</div>
          <div class="ct-stat-sub">Reported in 2025 PTR filings</div>
        </div>
        <div class="ct-stat-card">
          <div class="ct-stat-label">Buys vs. sells</div>
          <div class="ct-stat-value">${stats.buys} buys · ${stats.sells} sells</div>
          <div class="ct-stat-sub">Based on disclosed transaction type</div>
        </div>
        <div class="ct-stat-card">
          <div class="ct-stat-label">Disclosed volume range</div>
          <div class="ct-stat-value">${formatDollarRange(stats.lowSum, stats.highSum)}</div>
          <div class="ct-stat-sub">Approximate dollar range across all trades</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * @param {Trade[]} tradesForTimeline
 */
function renderTimeline(tradesForTimeline) {
  const container = document.getElementById("ct-timeline");
  if (!container) return;

  if (!tradesForTimeline.length) {
    container.innerHTML =
      '<p style="font-size:0.9rem;color:#6b7280;margin:0;">No trades match the current filters.</p>';
    return;
  }

  const groups = groupTradesByMonth(tradesForTimeline);

  const wrapper = document.createElement("div");
  wrapper.className = "ct-timeline";

  groups.forEach((group) => {
    const groupEl = document.createElement("div");
    groupEl.className = "ct-timeline-group";

    const label = document.createElement("h3");
    label.className = "ct-timeline-group-label";
    label.textContent = group.label;
    groupEl.appendChild(label);

    group.trades.forEach((t) => {
      const item = document.createElement("div");
      item.className = "ct-timeline-item";

      const dot = document.createElement("div");
      dot.className = "ct-timeline-dot";
      item.appendChild(dot);

      const dateEl = document.createElement("div");
      dateEl.className = "ct-timeline-date";
      dateEl.textContent = formatDate(t.tradeDate);
      item.appendChild(dateEl);

      // Company info bubble placeholder (shown when user clicks ticker)
      const infoBubble = document.createElement("div");
      infoBubble.className = "ct-company-info";
      infoBubble.dataset.ticker = t.ticker;
      item.appendChild(infoBubble);

      const header = document.createElement("div");
      header.className = "ct-timeline-header";
      header.innerHTML = `
        <span class="ct-timeline-ticker">${t.ticker}</span>
        <span class="ct-timeline-company">${t.company}</span>
      `;
      item.appendChild(header);

      const badgesRow = document.createElement("div");
      badgesRow.className = "ct-badges";
      badgesRow.innerHTML = `
        <span class="${getTransactionBadgeClass(t)}">${t.transactionType.toUpperCase()}</span>
        <span class="${getAssetBadgeClass(t)}">${t.assetType.toUpperCase()}</span>
        <span class="ct-badge ct-badge--mechanism">${t.mechanism.toUpperCase()}</span>
      `;
      item.appendChild(badgesRow);

      const amount = document.createElement("div");
      amount.className = "ct-amount";
      amount.textContent = t.amountBracket;
      item.appendChild(amount);

      if (t.notes) {
        const notes = document.createElement("div");
        notes.className = "ct-notes";
        notes.textContent = t.notes;
        item.appendChild(notes);
      }

      groupEl.appendChild(item);
    });

    wrapper.appendChild(groupEl);
  });

  container.innerHTML = "";
  container.appendChild(wrapper);
}

/**
 * @param {Trade[]} tradesForTable
 */
function renderTable(tradesForTable) {
  const tbody = document.querySelector("#ct-trades-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  tradesForTable.forEach((t) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${formatDate(t.tradeDate)}</td>
      <td class="ct-ticker-cell" data-ticker="${t.ticker}">${t.ticker}</td>
      <td>${t.company}</td>
      <td>${t.transactionType}</td>
      <td>${t.assetType}</td>
      <td>${t.mechanism}</td>
      <td>${t.amountBracket}</td>
    `;

    tbody.appendChild(tr);
  });
}

function attachTableSort() {
  const dateHeader = document.getElementById("ct-sort-date");
  if (!dateHeader) return;

  dateHeader.addEventListener("click", () => {
    state.sortDir = state.sortDir === "desc" ? "asc" : "desc";
    const indicator = document.getElementById("ct-sort-indicator");
    if (indicator) {
      indicator.textContent = state.sortDir === "desc" ? "▼" : "▲";
    }
    renderAll();
  });
}

function attachControls() {
  const searchInput = document.getElementById("ct-search-input");
  const toggleBtn = document.getElementById("ct-toggle-2024");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchTerm = e.target.value || "";
      renderAll();
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      state.include2024 = !state.include2024;
      toggleBtn.classList.toggle("ct-toggle--active", state.include2024);
      renderAll();
    });
  }

  // Delegate ticker clicks anywhere in the document so this keeps working
  // even if the table/timeline are re-rendered.
  document.addEventListener("click", (event) => {
    const rawTarget = /** @type {HTMLElement|null} */ (event.target);
    if (!rawTarget) return;

    const target = rawTarget.closest(".ct-ticker-cell, .ct-timeline-ticker");
    if (!target) return;

    const ticker =
      (/** @type {HTMLElement} */ (target).dataset.ticker || target.textContent || "").trim();

    if (ticker) {
      const companyKey = tickerToCompanyPage[ticker];
      if (companyKey) {
        // Navigate to company analysis page with pre-selected company tab
        window.location.href = `company-analysis.html?company=${encodeURIComponent(companyKey)}`;
        return;
      }
      showCompanyInfo(ticker, /** @type {HTMLElement} */ (target));
    }
  });

  attachTableSort();
}

function showCompanyInfo(ticker, originEl) {
  // Hide any existing bubbles first
  const allBubbles = document.querySelectorAll(".ct-timeline .ct-company-info");
  allBubbles.forEach((bubble) => {
    bubble.style.display = "none";
    bubble.textContent = "";
  });

  if (!ticker || !originEl) {
    return;
  }

  const item = originEl.closest(".ct-timeline-item");
  if (!item) return;

  const bubble = item.querySelector(".ct-company-info");
  if (!bubble) return;

  const desc = companyDescriptions[ticker] || "No description available yet for this ticker.";
  bubble.innerHTML = `<strong>${ticker}</strong> – ${desc}`;
  bubble.style.display = "inline-flex";
}

function renderAll() {
  const pol = politicians.find((p) => p.id === state.selectedPoliticianId);
  if (!pol) return;

  const baseTrades = getTradesForPolitician(pol.id);
  const filteredTrades = applyFilters(baseTrades);

  renderProfile(pol, filteredTrades);
  renderTimeline(filteredTrades);
  renderTable(filteredTrades);
}

function renderLanding() {
  const grid = document.getElementById("ct-landing-list");
  if (!grid) return;

  grid.innerHTML = "";

  politicians.forEach((p) => {
    const tradesForPol = getTradesForPolitician(p.id);
    const stats = computeStats(tradesForPol);
    const volumeLabel = formatDollarRange(stats.lowSum, stats.highSum).replace(/M/g, "m");

    const card = document.createElement("button");
    card.type = "button";
    card.className = "ct-landing-card";

    card.innerHTML = `
      <div class="ct-landing-card-header">
        <div>
          <div class="ct-landing-name">${p.name}</div>
          <div class="ct-landing-meta">${buildPelosiBadge(p)}</div>
        </div>
      </div>
      <div class="ct-landing-footer">
        <span>Volume: ${volumeLabel}</span>
        <span class="ct-landing-cta">${stats.total} reported trades</span>
      </div>
    `;

    card.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("id", p.id);
      window.location.href = url.toString();
    });

    grid.appendChild(card);
  });
}

function initCongressMonitor() {
  const landingSection = document.getElementById("ct-landing");
  const detailSection = document.getElementById("ct-detail");

  const params = new URLSearchParams(window.location.search);
  const selectedId = params.get("id");
  const defaultId = politicians[0]?.id;

  if (selectedId && politicians.some((p) => p.id === selectedId)) {
    // Detail mode – single member view
    state.selectedPoliticianId = selectedId;
    if (landingSection) landingSection.style.display = "none";
    if (detailSection) detailSection.style.display = "block";

    attachControls();
    renderAll();
  } else {
    // Landing mode – show grid of members
    if (landingSection) landingSection.style.display = "block";
    if (detailSection) detailSection.style.display = "none";

    if (defaultId) {
      state.selectedPoliticianId = defaultId;
    }
    renderLanding();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCongressMonitor);
} else {
  initCongressMonitor();
}


