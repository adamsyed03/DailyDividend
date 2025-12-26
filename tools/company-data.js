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
      marketCap: '≈ $4.1T',
    },
    kpis: [
      { label: 'REVENUE FY25', value: '$416.2B' },
      { label: 'REVENUE GROWTH (YoY)', value: '+6.4%' },
      { label: 'OPERATING MARGIN FY25', value: '32.0%' },
      { label: 'NET MARGIN FY25', value: '26.9%' },
      { label: 'NET INCOME FY25', value: '$112.0B' },
      { label: 'FREE CASH FLOW FY25', value: '$98.8B' },
    ],
    revenueMix: {
      title: 'Revenue by Product',
      subtitle: 'Apple net sales by major product and Services – FY2025 (USD billions).',
      data: [
        { label: 'iPhone', value: 209.6 },
        { label: 'Mac', value: 33.7 },
        { label: 'iPad', value: 28.0 },
        { label: 'Wearables, Home & Accessories', value: 35.7 },
        { label: 'Services', value: 109.2 },
      ],
    },
    regionalSplit: {
      title: 'Geographic Revenue Split',
      subtitle: 'Net sales by region – Apple FY2025.',
      data: [
        { label: 'Americas', value: 178.4 },
        { label: 'Europe', value: 111.0 },
        { label: 'Greater China', value: 64.4 },
        { label: 'Japan', value: 28.7 },
        { label: 'Rest of Asia Pacific', value: 33.7 },
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
};

// Extended narrative company profiles for AI / tooling usage
// Apple profile in the same style as other large-cap tech (e.g., NVDA, META)
const companyData = {
  AAPL: {
    header: {
      name: "Apple Inc. (AAPL)",
      pillIcon: "fa-mobile-screen-button",
      pillLabel: "Consumer Technology & Services Ecosystem",
      marketCap: "≈ $4.1T",
      headquarters: "Cupertino, California",
    },

    overview: `
Apple designs and markets a premium portfolio of consumer technology products — including the iPhone, Mac, iPad, wearables, home devices, and accessories — powered by tightly integrated operating systems and proprietary Apple Silicon. Complementing its hardware ecosystem, Apple operates a fast-growing Services business spanning the App Store, cloud storage, advertising, digital payments, media subscriptions, enterprise software, and warranty programs, all of which generate high-margin recurring revenue. The company reports across five geographic regions: the Americas, Europe, Greater China, Japan, and Rest of Asia Pacific.
    `,

    financials: {
      revenueFY2025: "$416.2B (+6.4% YoY)",
      operatingIncomeFY2025: "$133.1B (+8%)",
      netIncomeFY2025: "$112.0B (+19.5%)",
      epsFY2025: "$7.46 (+22.7%)",
      grossMarginFY2025: "46.9%",
      operatingMarginFY2025: "32.0%",
      netMarginFY2025: "26.9%",
      note: "Margin expansion driven by higher Services mix.",
    },

    revenueBreakdown: {
      byProduct: [
        { category: "iPhone", revenue: "$209.6B", growth: "+4%" },
        { category: "Mac", revenue: "$33.7B", growth: "+12%" },
        { category: "iPad", revenue: "$28.0B", growth: "+5%" },
        { category: "Wearables, Home & Accessories", revenue: "$35.7B", growth: "-4%" },
        { category: "Services", revenue: "$109.2B", growth: "+14%" },
        { category: "Total", revenue: "$416.2B", growth: "+6%" },
      ],

      byGeography: [
        { region: "Americas", revenue: "$178.4B", growth: "+7%" },
        { region: "Europe", revenue: "$111.0B", growth: "+10%" },
        { region: "Greater China", revenue: "$64.4B", growth: "-4%" },
        { region: "Japan", revenue: "$28.7B", growth: "+15%" },
        { region: "Rest of Asia Pacific", revenue: "$33.7B", growth: "+10%" },
        { region: "Total", revenue: "$416.2B", growth: "+6%" },
      ],
    },

    competitivePositioning: `
• Ecosystem lock-in: Apple’s integrated hardware, software, and services drive customer retention and cross-category purchasing.
• Services growth engine: Double-digit Services growth with high margins enhances profitability.
• Premium brand & pricing power: Differentiated design supports high ASPs in iPhone and Mac.
• Custom silicon advantage: Apple Silicon improves performance and efficiency across devices.
• Geographic headwinds: Weakness in Greater China remains a pressure point.
• Controlled retail & distribution: Direct retail footprint reinforces experience and margins.
    `,

    balanceSheet: `
• Cash & equivalents: $35.9B
• Marketable securities: $96.5B
• Total cash & securities: $132.4B
• Total debt: $98.7B → Net cash positive
• Total assets: $359.2B | Liabilities: $285.5B | Equity: $73.7B
    `,

    cashFlowAndCapital: `
• Operating cash flow: $111.5B
• CapEx: $12.7B
• Free cash flow: $98.8B
• Share repurchases: $90.7B
• Dividends: $15.4B
• Total capital returned: $106.1B
Apple authorized an additional $100B buyback and raised its dividend in FY2025.
    `,

    trend: `
| Year | Revenue ($B) | YoY | Net Income ($B) | YoY |
|------|--------------|-----|------------------|-----|
| 2025 | 416.2 | +6% | 112.0 | +19.5% |
| 2024 | 391.0 | +2% | 93.7 | -3% |
| 2023 | 383.3 | -3% | 97.0 | -3% |
EPS growth has outpaced revenue due to margin expansion and substantial buybacks.
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


