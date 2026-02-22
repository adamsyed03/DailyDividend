// Centralized company data for company-analysis page
// This file holds all company-specific numbers and labels that are expected to change over time.
// Layout, styling and card structure remain defined in the HTML/CSS.

// NOTE:
// - Monetary values are in billions USD where appropriate.
// - These values mirror the content currently displayed in the HTML page so that future updates
//   can be made by editing this file instead of hunting through inline markup and scripts.

const companiesData = {
  AVGO: {
    header: {
      name: 'Broadcom Inc. (AVGO)',
      pillIcon: 'fa-microchip',
      pillLabel: 'Semiconductors & infrastructure software',
      marketCap: '≈ $1.7T',
    },
    kpis: [
      { label: 'REVENUE FY24', value: '$51.6B' },
      { label: 'REVENUE FY25 YTD', value: '$45.9B (Q1–Q3)' },
      { label: 'OPERATING MARGIN FY25 YTD', value: '39.2%' },
      { label: 'NET MARGIN FY25 YTD', value: '31.9%' },
      { label: 'FREE CASH FLOW FY25 YTD', value: '$19.4B' },
      { label: 'FCF MARGIN FY25 YTD', value: '≈ 42%' },
    ],
    revenueMix: {
      title: 'Revenue Mix',
      subtitle: 'Segment contribution – Broadcom FY2025 YTD vs FY2024 YTD.',
      data: [
        { label: 'Semiconductor Solutions', value: 25.8 },
        { label: 'Infrastructure Software', value: 20.1 },
      ],
    },
    regionalSplit: {
      title: 'Regional Revenue Split',
      subtitle: 'Revenue by country of shipment – Broadcom FY2024.',
      data: [
        { label: 'United States', value: 12.9 },
        { label: 'China & Hong Kong', value: 10.5 },
        { label: 'Singapore', value: 9.6 },
        { label: 'Other countries', value: 18.6 },
      ],
    },
  },

  META: {
    header: {
      name: 'Meta Platforms, Inc. (META)',
      pillIcon: 'fa-network-wired',
      pillLabel: 'Social platforms & AI infrastructure',
      marketCap: '≈ $1.8T',
    },
    kpis: [
      { label: 'Revenue (QoQ)', value: '$51.2B' },
      { label: 'Net Income (QoQ)', value: '≈ $18.6B', sub: 'GAAP: $2.7B' },
      { label: 'Trailing P/E', value: '≈ 32×' },
      { label: 'EPS (TTM)', value: '≈ $22.6' },
      { label: 'Net Margin (adj)', value: '~36%' },
      { label: 'Rev Growth (YoY)', value: '+26%' },
    ],
    revenueMix: {
      title: 'Revenue Mix',
      subtitle: 'Business line contribution in billions – Meta Platforms Q3 2025.',
      data: [
        { label: 'Advertising', value: 50.082 },
        { label: 'Messaging & Subscriptions', value: 0.69 },
        { label: 'Reality Labs & Devices', value: 0.47 },
      ],
    },
    regionalSplit: {
      title: 'Regional Revenue Split',
      subtitle: 'Geographic contribution in billions – Meta Platforms Q3 2025.',
      data: [
        { label: 'US & Canada', value: 19.708 },
        { label: 'Europe', value: 11.566 },
        { label: 'Asia-Pacific', value: 14.304 },
        { label: 'Rest of World', value: 5.664 },
      ],
    },
  },

  DIS: {
    header: {
      name: 'The Walt Disney Company (DIS)',
      pillIcon: 'fa-film',
      pillLabel: 'Media, entertainment & experiences',
      marketCap: '≈ $190B',
    },
    kpis: [
      { label: 'REVENUE (QoQ)', value: '$22.5B' },
      { label: 'NET INCOME (QoQ)', value: '≈ $1.3B' },
      { label: 'TRAILING P/E', value: '≈ 21×' },
      { label: 'EPS (TTM)', value: '≈ $6.85' },
      { label: 'NET MARGIN (FY25)', value: '≈ 13%' },
      { label: 'REV GROWTH (YoY)', value: '+3%' },
    ],
    revenueMix: {
      title: 'Revenue Mix',
      subtitle: 'Segment contribution – Disney FY25.',
      data: [
        { label: 'Entertainment', value: 10.21 },
        { label: 'Sports (ESPN)', value: 3.98 },
        { label: 'Experiences', value: 8.77 },
      ],
    },
    regionalSplit: {
      title: 'Regional Revenue Split',
      subtitle: 'Regional contribution – Disney FY25.',
      data: [
        { label: 'US & Canada', value: 52.5 },
        { label: 'Europe', value: 10.3 },
        { label: 'Asia-Pacific', value: 7.0 },
        { label: 'Rest of World', value: 5.8 },
      ],
    },
  },

  AMZN: {
    header: {
      name: 'Amazon.com, Inc. (AMZN)',
      pillIcon: 'fa-box-open',
      pillLabel: 'AI infrastructure, global retail & ads',
      marketCap: '≈ $2.45T (at $229.53/share)',
    },
    kpis: [
      { label: 'REVENUE (QoQ)', value: '$180.2B' },
      { label: 'NET INCOME (QoQ)', value: '$21.2B' },
      { label: 'TRAILING P/E', value: '≈ 33×' },
      { label: 'EPS (TTM)', value: '≈ $7.08' },
      { label: 'NET MARGIN (TTM)', value: '≈ 11%' },
      { label: 'REV GROWTH (YoY)', value: '+13%' },
    ],
    revenueMix: {
      title: 'Revenue Mix',
      subtitle: 'Net sales by major product & service categories – Amazon FY 2024.',
      data: [
        { label: 'Online stores', value: 247.0 },
        { label: 'Physical stores', value: 21.2 },
        { label: 'Third-party seller services', value: 156.1 },
        { label: 'Advertising services', value: 56.2 },
        { label: 'Subscription services', value: 44.4 },
        { label: 'AWS', value: 107.6 },
        { label: 'Other', value: 5.4 },
      ],
    },
    regionalSplit: {
      title: 'Regional Revenue Split',
      subtitle: 'Geographic contribution in billions – Amazon 2024.',
      data: [
        { label: 'United States', value: 438.015 },
        { label: 'Germany', value: 40.856 },
        { label: 'United Kingdom', value: 37.855 },
        { label: 'Japan', value: 27.401 },
        { label: 'Rest of World', value: 93.832 },
      ],
    },
  },

  NFLX: {
    header: {
      name: 'Netflix, Inc. (NFLX)',
      pillIcon: 'fa-film',
      pillLabel: 'Streaming media & entertainment',
      marketCap: '≈ $43B',
    },
    kpis: [
      { label: 'REVENUE (QOQ)', value: '≈ $11.5B' },
      { label: 'NET INCOME (QOQ)', value: '≈ $2.6B' },
      { label: 'P/E', value: 'x42' },
      { label: 'EPS (TTM)', value: '≈ $19.8' },
      { label: 'NET MARGIN (FY24)', value: '≈ 22%' },
      { label: 'REV GROWTH (YOY)', value: '+16%' },
    ],
    // Netflix currently displays only a regional revenue split chart on the analysis page.
    regionalSplit: {
      title: 'Regional Revenue Split',
      subtitle: 'Geographic contribution – Netflix Q3 2025.',
      data: [
        { label: 'UCAN', value: 5.07 },
        { label: 'EMEA', value: 3.7 },
        { label: 'LATAM', value: 1.37 },
        { label: 'APAC', value: 1.37 },
      ],
    },
  },

  GOOGL: {
    header: {
      name: 'Alphabet Inc. (GOOGL)',
      pillIcon: 'fa-globe',
      pillLabel: 'Search, ads & AI infrastructure',
      marketCap: '≈ $3.8T',
    },
    kpis: [
      { label: 'REVENUE (QoQ)', value: '$102.3B' },
      { label: 'NET INCOME (QoQ)', value: '$35.0B' },
      { label: 'TRAILING P/E', value: '≈ 40×' },
      { label: 'EPS (TTM)', value: '≈ $9.60' },
      { label: 'NET MARGIN (Q3 2025)', value: '34%' },
      { label: 'REV GROWTH (YOY)', value: '+16%' },
    ],
    revenueMix: {
      title: 'Revenue Mix',
      subtitle: 'Alphabet Revenue Mix — Q3 2025.',
      data: [
        { label: 'Google Services', value: 87.052 },
        { label: 'Google Cloud', value: 15.157 },
        { label: 'Other Bets', value: 0.344 },
      ],
      legendPosition: 'right',
    },
    regionalSplit: {
      title: 'Regional Revenue Split',
      subtitle: 'Regional revenue split – Alphabet FY2024.',
      data: [
        { label: 'United States', value: 170.447 },
        { label: 'EMEA', value: 102.127 },
        { label: 'APAC', value: 56.815 },
        { label: 'Other Americas', value: 20.418 },
      ],
      legendPosition: 'right',
    },
  },

  AAPL: {
    header: {
      name: 'Apple Inc. (AAPL)',
      pillIcon: 'fa-mobile-screen-button',
      pillLabel: 'Consumer Technology & Services Ecosystem',
      marketCap: '≈ $3.86T',
    },
    kpis: [
      { label: 'REVENUE (Q1 FY26)', value: '$143.8B' },
      { label: 'REVENUE GROWTH (YoY)', value: '+15.7%' },
      { label: 'OPERATING MARGIN', value: '35.4%' },
      { label: 'NET MARGIN', value: '29.3%' },
      { label: 'NET INCOME (Q1)', value: '$42.1B' },
      { label: 'OPERATING CASH FLOW (Q1)', value: '$53.9B' },
    ],
    revenueMix: {
      title: 'Revenue by Product',
      subtitle: 'Apple net sales by major product and Services – Q1 FY2026 (USD billions).',
      data: [
        { label: 'iPhone', value: 85.3 },
        { label: 'Services', value: 30.0 },
        { label: 'Mac', value: 8.4 },
        { label: 'iPad', value: 8.6 },
        { label: 'Wearables & Accessories', value: 11.5 },
      ],
    },
    regionalSplit: {
      title: 'Geographic Revenue Split',
      subtitle: 'Net sales by region – Apple Q1 FY2026.',
      data: [
        { label: 'Americas', value: 58.5 },
        { label: 'Europe', value: 38.1 },
        { label: 'Greater China', value: 25.6 },
        { label: 'Japan', value: 9.3 },
        { label: 'Rest of Asia Pacific', value: 12.1 },
      ],
    },
  },

  LULU: {
    header: {
      name: 'Lululemon Athletica Inc. (LULU)',
      pillIcon: 'fa-shirt',
      pillLabel: 'Athletic apparel & footwear',
      marketCap: '≈ $24.951B',
    },
    kpis: [
      { label: 'REVENUE (QoQ)', value: '$2.6B' },
      { label: 'NET INCOME (QoQ)', value: '$306.8M' },
      { label: 'TRAILING P/E', value: '14.64×' },
      { label: 'EPS (TTM)', value: '$14.34' },
      { label: 'GROSS MARGIN', value: '55.6%' },
      { label: 'REV GROWTH (YoY)', value: '+7%' },
    ],
    revenueMix: {
      title: 'Revenue Mix',
      subtitle: 'Product category contribution – Lululemon FY2024.',
      data: [
        { label: "Women's products", value: 5.7 },
        { label: "Men's products", value: 2.4 },
        { label: 'Other categories', value: 2.8 },
      ],
    },
    regionalSplit: {
      title: 'Regional Revenue Split',
      subtitle: 'Geographic contribution – Lululemon FY2024.',
      data: [
        { label: 'Americas', value: 7.9 },
        { label: 'China Mainland', value: 1.6 },
        { label: 'Rest of World', value: 1.3 },
      ],
    },
  },

  UBER: {
    header: {
      name: 'Uber Technologies, Inc. (UBER)',
      pillIcon: 'fa-car-side',
      pillLabel: 'Transport, delivery & logistics technology',
      marketCap: '≈ $169.461B',
    },
    kpis: [
      { label: 'REVENUE (Q3 FY2025)', value: '$13.47B', sub: '+20% YoY' },
      { label: 'GROSS BOOKINGS (Q3 FY2025)', value: '$49.7B', sub: '+21% YoY' },
      { label: 'ADJ. EBITDA (Q3 FY2025)', value: '$2.26B', sub: '+33% YoY' },
      { label: 'INCOME FROM OPS (Q3 FY2025)', value: '$1.1B', sub: '+5% YoY' },
      { label: 'FREE CASH FLOW (Q3 FY2025)', value: '$2.2B' },
      { label: 'MAPCs (Q3 FY2025)', value: '189M', sub: '+17% YoY' },
    ],
    revenueMix: {
      title: 'Revenue by Segment',
      subtitle: 'Revenue mix in USD billions – Uber Q3 FY2025.',
      data: [
        { label: 'Mobility', value: 7.68 },
        { label: 'Delivery', value: 4.48 },
        { label: 'Freight', value: 1.31 },
      ],
    },
    bookingsMix: {
      title: 'Gross Bookings by Segment',
      subtitle: 'Gross bookings in USD billions – Uber Q3 FY2025.',
      data: [
        { label: 'Mobility', value: 25.11 },
        { label: 'Delivery', value: 23.32 },
        { label: 'Freight', value: 1.3 },
      ],
    },
  },

  V: {
    header: {
      name: 'Visa Inc. (V)',
      pillIcon: 'fa-credit-card',
      pillLabel: 'Global payments network',
      marketCap: '≈ $676.21B',
    },
    kpis: [
      { label: 'REVENUE FY25', value: '$40.0B' },
      { label: 'NET INCOME FY25', value: '$20.1B' },
      { label: 'OPERATING MARGIN FY25', value: '60.0%' },
      { label: 'NET MARGIN FY25', value: '50.1%' },
      { label: 'FREE CASH FLOW FY25', value: '$21.2B' },
      { label: 'EPS FY25', value: '$9.60' },
    ],
    revenueMix: {
      title: 'Revenue Mix',
      subtitle: 'Revenue by category – Visa FY2025 (USD billions).',
      data: [
        { label: 'Service revenues', value: 18.2 },
        { label: 'Data processing revenues', value: 15.0 },
        { label: 'International transactions', value: 6.8 },
      ],
    },
  },

  JPM: {
    header: {
      name: 'JPMorgan Chase & Co. (JPM)',
      pillIcon: 'fa-building-columns',
      pillLabel: 'Global Banking & Financial Services',
      marketCap: '≈ $870B',
    },
    kpis: [
      { label: 'REVENUE (Q4)', value: '$46.8B' },
      { label: 'ADJ EPS (Q4)', value: '$5.23', sub: 'Reported: $4.63' },
      { label: 'NET INCOME (Q4)', value: '$13.0B', sub: 'Adj: $14.7B' },
      { label: 'CET1 (Q4)', value: '14.5%', sub: 'Standardized' },
      { label: 'FY25 REVENUE', value: '$185.6B' },
      { label: 'FY25 NET INCOME', value: '$57.0B' },
    ],
    revenueBySegment: {
      title: 'Net Revenue by Segment',
      subtitle: 'Q4 2025',
      data: [
        { label: 'Consumer & Community Banking', value: 19.396 },
        { label: 'Corporate & Investment Bank', value: 19.375 },
        { label: 'Asset & Wealth Management', value: 6.516 },
        { label: 'Corporate', value: 1.480 },
      ],
    },
    incomeBySegment: {
      title: 'Net Income by Segment',
      subtitle: 'Q4 2025',
      data: [
        { label: 'Consumer & Community Banking', value: 3.642 },
        { label: 'Corporate & Investment Bank', value: 7.268 },
        { label: 'Asset & Wealth Management', value: 1.808 },
        { label: 'Corporate', value: 0.307 },
      ],
    },
  },
};

// Extended narrative company profiles for AI / tooling usage
// Apple profile in the same style as other large-cap tech (e.g., NVDA, META)
const companyData = {
  JPM: {
    header: {
      name: "JPMorgan Chase & Co. (JPM)",
      pillIcon: "fa-building-columns",
      pillLabel: "Global Banking & Financial Services",
      marketCap: "≈ $870B",
    },
    overview: `
JPMorgan Chase & Co. is the largest U.S. bank, operating a highly diversified business model across consumer and community banking (CCB), corporate and investment banking (CIB), asset and wealth management (AWM), and commercial banking. The firm maintains a "fortress balance sheet" and generates earnings from a wide array of sources including net interest income, investment banking fees, market making, asset management, and payments services.
    `,
    financials: {
      revenueFY2025: "$185.6B (+3% YoY)",
      marketsRevenueFY2025: "$35.8B (+19% YoY)",
      netInterestIncomeFY2025: "$95.9B (+3%)",
      netIncomeFY2025: "$57.0B",
      roeFY2025: "17%",
      rotceFY2025: "20%",
      netMarginFY2025: "~31%",
      efficiencyRatioFY2025: "~52%",
    },
    profitability: `
• ROE (FY25): 17%
• ROTCE (FY25): 20%
• Net margin (FY25): ~31%
• Efficiency ratio (FY25): ~52%
    `,
    growth: `
• Revenue YoY (FY25): +3% to $185.6B
• Markets revenue YoY (FY25): +19% to $35.8B
• Net interest income YoY (FY25): +3% to $95.9B
• Average loans YoY (Q4): +9%
• Average deposits YoY (Q4): +6%
    `,
    competitivePositioning: `
• #1 global investment bank by fees; ~8.4% wallet share (FY25).
• Dominant U.S. deposits & payments franchise; record Payments revenue $5.1B in Q4.
• Prime brokerage strength: Equity Markets revenue +40% YoY in Q4.
• Scale advantage across CCB/CIB/AWM and ability to deploy capital through cycle.
    `,
    balanceSheet: `
• CET1 ratio (Std., Q4): 14.5% (Key banking risk metric)
• Standardized RWA (Q4): ~$2.0T
• Liquidity sources: ~$1.5T
• Total assets (Q4): ~$4.4T
• LCR (Firm): 111%
    `,
    riskWatchlist: `
• Credit risk: normalization in card + selective wholesale charge-offs.
• Capital/RWA: RWA growth absorbs excess capital and can limit buybacks.
• Regulatory: potential U.S. cap on credit card interest rates could hurt economics.
    `,
    growthDrivers: `
• Markets & client financing demand remains strong (Equity Markets +40% YoY).
• Payments strength (Q4 Payments revenue record $5.1B).
• Loan growth tailwind (avg loans +9% YoY in Q4).
• Apple Card acquisition expands credit card franchise.
    `,
    analystRecommendations: `
| Rating | Count |
|---------|--------|
| Bullish | 15 |
| Neutral | 8 |
| Bearish | 1 |
    `,
  },

  V: {
    header: {
      name: "Visa Inc. (V)",
      pillIcon: "fa-credit-card",
      pillLabel: "Global payments network",
      marketCap: "≈ $676.21B",
    },

    overview: `
Visa Inc. operates one of the world’s largest digital payments networks, enabling secure electronic payments and money movement across more than 200 countries and territories. Visa connects consumers, merchants, financial institutions, governments, and fintech platforms through its global processing network, VisaNet, which supports authorisation, clearing, and settlement of transactions. Visa does not issue cards or extend credit. Instead, it generates revenue primarily from payment volume, cross-border transactions, and value-added services, making it a highly scalable, capital-light business with minimal credit risk exposure.
    `,

    financials: {
      netRevenueFY2025: "$40.0B (+11.4% YoY)",
      operatingIncomeFY2025: "$24.0B (+12%)",
      netIncomeFY2025: "$20.1B (+2%)",
      dilutedEPSFY2025: "$9.60 (+3%)",
      operatingMarginFY2025: "60.0%",
      netMarginFY2025: "50.1%",
    },

    revenueBreakdown: {
      byCategory: [
        { category: "Service revenues", revenue: "$18.2B", growth: "+12%" },
        { category: "Data processing revenues", revenue: "$15.0B", growth: "+11%" },
        { category: "International transaction revenues", revenue: "$6.8B", growth: "+15%" },
        { category: "Total", revenue: "$40.0B", growth: "+11%" },
      ],
    },

    competitivePositioning: `
• Network Effects: Visa benefits from powerful two-sided network effects connecting consumers, merchants, and financial institutions globally.
• Pricing Power: High switching costs and scale support durable pricing leverage.
• Capital-Light Model: Minimal balance-sheet risk and strong cash generation.
• Technology & Security: Significant investment in AI-driven fraud prevention and tokenization.
    `,

    balanceSheet: `
• Cash & equivalents: $17.1B
• Investment securities: $3.3B
• Total liquid assets: $20.4B
• Long-term debt: $19.6B
• Total assets: $100.0B | Total equity: $38.7B
Visa maintains a strong balance sheet with net cash flexibility.
    `,

    cashFlowAndCapital: `
• Operating cash flow: $22.5B
• Capital expenditures: $1.3B
• Free cash flow: $21.2B
• Share repurchases: $15B+
• Dividends paid: $4B
Visa consistently returns a substantial portion of its cash flow to shareholders.
    `,

    trend: `
| Year | Net Revenue ($B) | YoY | Net Income ($B) | YoY |
|------|-----------------|-----|-----------------|-----|
| 2025 | 40.0 | +11% | 20.1 | +2% |
| 2024 | 35.9 | +10% | 19.7 | +14% |
| 2023 | 32.7 | — | 17.3 | — |
    `,

    analystRecommendations: `
| Rating | Count |
|---------|--------|
| Buy | 11 |
| Outperform | 25 |
| Hold | 5 |
| Sell | 0 |
    `,

    riskWatchlist: `
• Regulatory & Antitrust Risk: Ongoing scrutiny of network fees and market power.
• Cross-Border Sensitivity: Revenue exposed to global travel and macro cycles.
• Competitive Pressure: Competition from Mastercard, fintechs, and alternative payment rails.
• Cybersecurity Risk: Operational resilience is mission-critical.
    `,

    growthDrivers: `
• Global Shift to Digital Payments: Long runway as cash usage declines.
• Cross-Border Recovery: Higher-margin international transaction growth.
• Value-Added Services Expansion: Fraud prevention, analytics, and advisory services.
• Tokenization & AI: Improved security and authorization rates.
• Commercial & Money Movement: Expansion in B2B, real-time, and account-to-account payments.
    `,
  },

  AAPL: {
    header: {
      name: "Apple Inc. (AAPL)",
      pillIcon: "fa-mobile-screen-button",
      pillLabel: "Consumer Technology & Services Ecosystem",
      marketCap: "≈ $3.86T",
      headquarters: "Cupertino, California",
    },

    overview: `
Apple designs and markets a premium portfolio of consumer technology products — including the iPhone, Mac, iPad, wearables, home devices, and accessories — powered by tightly integrated operating systems and proprietary Apple Silicon. Complementing its hardware ecosystem, Apple operates a fast-growing Services business spanning the App Store, cloud storage, advertising, digital payments, media subscriptions, enterprise software, and warranty programs, all of which generate high-margin recurring revenue. The company reports across five geographic regions: the Americas, Europe, Greater China, Japan, and Rest of Asia Pacific.
    `,

    financials: {
      revenueFY2025: "$143.8B (Q1 FY26, +15.7% YoY)",
      operatingIncomeFY2025: "$50.9B (Q1 FY26)",
      netIncomeFY2025: "$42.1B (Q1 FY26, +15.9% YoY)",
      epsFY2025: "$2.8 (quarter)",
      grossMarginFY2025: "48.1%",
      operatingMarginFY2025: "35.4%",
      netMarginFY2025: "29.3%",
      note: "Margins remain structurally high; Trailing P/E ~30.0.",
    },

    revenueBreakdown: {
      byProduct: [
        { category: "iPhone", revenue: "$85.3B (59.3%)", growth: "+23.3% YoY" },
        { category: "Services", revenue: "$30.0B (20.9%)", growth: "+14.0% YoY" },
        { category: "Mac", revenue: "$8.4B (5.8%)", growth: "−6.7% YoY" },
        { category: "iPad", revenue: "$8.6B (6.0%)", growth: "+6.3% YoY" },
        { category: "Wearables & Accessories", revenue: "$11.5B (8.0%)", growth: "−2.2% YoY" },
        { category: "Total", revenue: "$143.8B", growth: "+15.7% YoY" },
      ],

      byGeography: [
        { region: "Americas", revenue: "40.7%", growth: "" },
        { region: "Europe", revenue: "26.5%", growth: "" },
        { region: "Greater China", revenue: "17.8%", growth: "" },
        { region: "Japan", revenue: "6.5%", growth: "" },
        { region: "Rest of Asia Pacific", revenue: "8.4%", growth: "" },
        { region: "Total", revenue: "100%", growth: "" },
      ],
    },

    competitivePositioning: `
• Ecosystem lock-in: Apple’s integrated hardware, software, and services drive customer retention and cross-category purchasing.
• Services growth engine: Double-digit Services growth with high margins enhances profitability.
• Premium brand & pricing power: Differentiated design supports high ASPs in iPhone and Mac.
• Custom silicon advantage: Apple Silicon improves performance and efficiency across devices.
• Large installed base (2.5B+ active devices) supporting recurring revenue.
• Leading position in premium smartphone segment.
    `,

    balanceSheet: `
• Cash & cash equivalents: $45.3B
• Total marketable securities: $99.5B
• Total assets: $379.3B
• Total debt: $88.5B
Apple maintains one of the strongest balance sheets globally, with substantial liquidity and consistent free cash flow.
    `,

    cashFlowAndCapital: `
• Operating cash flow (Q1 FY26): $53.9B
• Share repurchases (quarter): $24.7B
• Dividends paid (quarter): $3.9B
Apple prioritises shareholder returns alongside innovation investment.
    `,

    trend: `
| Period | Revenue ($B) | YoY | Net Income ($B) | YoY |
|--------|--------------|-----|------------------|-----|
| Q1 FY26 | 143.8 | +15.7% | 42.1 | +15.9% |
Record total revenue and EPS; iPhone remains primary growth engine; strong operating leverage from ecosystem scale.
    `,

    analystRecommendations: `
| Rating | Count |
|---------|--------|
| Strong Buy | 5 |
| Buy | 24 |
| Hold | 15 |
| Sell | 5 |
Consensus leans positive, with most analysts maintaining Buy or Strong Buy ratings.
    `,

    riskWatchlist: `
• China exposure: Sales and manufacturing concentrated in Greater China.
• Tariffs & trade policy volatility: Vulnerable to U.S./foreign trade measures.
• Hardware cyclicality: iPhone upgrade cycles remain a key risk.
• Regulatory pressure: App Store and digital market scrutiny could impact margins.
• Supply chain dependency: Reliance on a small number of suppliers and assemblers.
• FX volatility: Strong USD and weaker global demand affect growth.
    `,

    growthDrivers: `
• Services expansion: Subscription-led, high-margin growth engine.
• Premium iPhone mix: Sustains ASP and margin resilience.
• Apple Silicon leadership: Custom chips enhance competitiveness in Macs and iPads.
• Installed base expansion: Growing global device base strengthens ecosystem.
• International diversification: Double-digit growth in Europe, Japan, and APAC.
• New platforms: Spatial computing and emerging devices open long-term opportunities.
    `,
  },
};


