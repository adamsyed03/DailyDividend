// Centralized company data for company-analysis page
// This file holds all company-specific numbers and labels that are expected to change over time.
// Layout, styling and card structure remain defined in the HTML/CSS.

// NOTE:
// - Monetary values are in billions USD where appropriate.
// - These values mirror the content currently displayed in the HTML page so that future updates
//   can be made by editing this file instead of hunting through inline markup and scripts.

const companiesData = {
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
};


