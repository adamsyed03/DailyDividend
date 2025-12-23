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
 * @property {"Stock"|"Option"|"Fund"|"Bond"|"RealEstate"} assetType
 * @property {"Buy"|"Sell"} transactionType
 * @property {"Direct"|"Exercise"|"Donation"|"Redemption"} mechanism
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
  {
    id: "beyer",
    name: "Donald S. Beyer Jr.",
    chamber: "House",
    party: "D",
    stateDistrict: "VA08",
    profileNote:
      "Member of the U.S. House of Representatives serving Virginia’s 8th congressional district, representing Northern Virginia in Congress.",
  },
  {
    id: "rose",
    name: "Hon. John W. Rose",
    chamber: "House",
    party: "R",
    stateDistrict: "TN06",
    profileNote:
      "Member of the U.S. House of Representatives for Tennessee's 6th congressional district.",
  },
  {
    id: "wyden",
    name: "Ron Wyden",
    chamber: "Senate",
    party: "D",
    stateDistrict: "OR",
    profileNote:
      "United States Senator from Oregon, serving since 1996.",
  },
  {
    id: "mcconnell",
    name: "Mitch McConnell",
    chamber: "Senate",
    party: "R",
    stateDistrict: "KY",
    profileNote:
      "United States Senator from Kentucky, serving since 1985. Former Senate Majority Leader.",
  },
  {
    id: "wassermanschultz",
    name: "Debbie Wasserman Schultz",
    chamber: "House",
    party: "D",
    stateDistrict: "FL23",
    profileNote:
      "Member of the U.S. House of Representatives for Florida's 23rd congressional district.",
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
  // --- Beyer 2025 PTR trades (including 2024 trades reported in 2025) ---
  // Filing ID 20033325 – 2025-10 trades (municipal bonds)
  {
    id: "beyer-2025-10-22-ct-bond",
    politicianId: "beyer",
    ticker: "CT_MUNI",
    company: "Connecticut State Special Tax 5.00% 01/01/2037",
    assetType: "Bond",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-10-22",
    notificationDate: "2025-11-02",
    amountBracket: "$15,001 – $50,000",
    notes:
      "Purchase of 40,000 units of Connecticut St SPL Tax 5.00% 01/01/2037 municipal bond.",
    filingId: "20033325",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "beyer-2025-10-31-king-bond",
    politicianId: "beyer",
    ticker: "KING_WA_MUNI",
    company: "King County, Washington 4.00% 12/01/2032",
    assetType: "Bond",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-10-31",
    notificationDate: "2025-11-02",
    amountBracket: "$15,001 – $50,000",
    notes:
      "Purchase of 35,000 units of King Cnty Wash 4.00% 12/01/2032 municipal bond.",
    filingId: "20033325",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "beyer-2025-10-14-north-allegheny-redemption",
    politicianId: "beyer",
    ticker: "NALLEGHENY_PA_MUNI",
    company: "North Allegheny, Pennsylvania School District 5.00% 05/01/2030",
    assetType: "Bond",
    transactionType: "Sell",
    mechanism: "Redemption",
    tradeDate: "2025-10-14",
    notificationDate: "2025-10-22",
    amountBracket: "$15,001 – $50,000",
    notes:
      "Redemption of North Allegheny PA Sch 5.00% 05/01/2030 municipal bond.",
    filingId: "20033325",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "beyer-2025-10-23-st-john-baptist-bond",
    politicianId: "beyer",
    ticker: "STJOHN_LA_MUNI",
    company: "St John the Baptist Parish Variable Rate 06/01/2037",
    assetType: "Bond",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-10-23",
    notificationDate: "2025-11-02",
    amountBracket: "$50,001 – $100,000",
    notes:
      "Purchase of 55,000 units of St John Baptist Parish Var 06/01/2037 municipal bond.",
    filingId: "20033325",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  // Filing ID 20032200 – 2025-09 municipal redemption
  {
    id: "beyer-2025-09-18-mass-sch-bld-redemption",
    politicianId: "beyer",
    ticker: "MASS_SCH_MUNI",
    company: "Massachusetts State School Building Authority 5.00%",
    assetType: "Bond",
    transactionType: "Sell",
    mechanism: "Redemption",
    tradeDate: "2025-09-18",
    notificationDate: "2025-10-02",
    amountBracket: "$50,001 – $100,000",
    notes: "Redemption of Massachusetts St Sch Bld 5.00% municipal bond.",
    filingId: "20032200",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  // Filing ID 20030746 – 2025-07 municipal maturity
  {
    id: "beyer-2025-07-01-oklahoma-maturity",
    politicianId: "beyer",
    ticker: "OK_OKLA_MUNI",
    company: "Oklahoma County, OK Independent 3.00% 07/01/2025",
    assetType: "Bond",
    transactionType: "Sell",
    mechanism: "Redemption",
    tradeDate: "2025-07-01",
    notificationDate: "2025-07-27",
    amountBracket: "$15,001 – $50,000",
    notes:
      "Bond reached maturity; redemption of Oklahoma Cnty OK Indep 3.00% 07/01/2025 municipal bond.",
    filingId: "20030746",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  // Filing ID 20030262 – 2025-04 municipal purchase
  {
    id: "beyer-2025-04-08-uw-bond",
    politicianId: "beyer",
    ticker: "UW_MUNI",
    company: "University of Washington 4.00% 12/01/2033",
    assetType: "Bond",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-04-08",
    notificationDate: "2025-05-02",
    amountBracket: "$15,001 – $50,000",
    notes:
      "Purchase of 30,000 units University of Washington 4.00% maturing 12/01/2033 municipal bond.",
    filingId: "20030262",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  // Filing ID 20027932 – 2025-02 municipal purchase
  {
    id: "beyer-2025-02-12-maryland-health-bond",
    politicianId: "beyer",
    ticker: "MD_HEALTH_MUNI",
    company: "Maryland State Health Variable Rate 07/01/2045",
    assetType: "Bond",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-02-12",
    notificationDate: "2025-03-08",
    amountBracket: "$50,001 – $100,000",
    notes:
      "Purchase of 50,000 units Maryland State Health Var 07/01/2045 municipal bond.",
    filingId: "20027932",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  // Filing ID 20026517 – late-2024 trades reported in 2025
  {
    id: "beyer-2024-12-02-dallas-rapid-maturity",
    politicianId: "beyer",
    ticker: "DALLAS_TX_MUNI",
    company: "Dallas, Texas Area Rapid Transit 5.00% 12/01/2025",
    assetType: "Bond",
    transactionType: "Sell",
    mechanism: "Redemption",
    tradeDate: "2024-12-02",
    notificationDate: "2025-01-06",
    amountBracket: "$1,001 – $15,000",
    notes:
      "Called security; maturity/redemption of Dallas Tex Area Rapid 5.00% 12/01/2025 bond.",
    filingId: "20026517",
    reportedYear: 2025,
    tradeYear: 2024,
  },
  {
    id: "beyer-2024-12-23-duke-street-sale",
    politicianId: "beyer",
    ticker: "DUKE_ST_LLCOI",
    company: "Duke Street LLC – 50% interest in 2712 Duke Street, Alexandria, VA",
    assetType: "RealEstate",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2024-12-23",
    notificationDate: "2024-12-26",
    amountBracket: "$5,000,001 – $25,000,000",
    notes:
      "Sale of 2712 Duke Street, Alexandria, Virginia (50% interest via Duke Street LLC).",
    filingId: "20026517",
    reportedYear: 2025,
    tradeYear: 2024,
  },
  {
    id: "beyer-2024-12-04-oklahoma-15000-bond",
    politicianId: "beyer",
    ticker: "OK_OKLA_MUNI",
    company: "Oklahoma County, OK Independent 3.00% 07/01/2025",
    assetType: "Bond",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2024-12-04",
    notificationDate: "2025-01-06",
    amountBracket: "$1,001 – $15,000",
    notes:
      "Purchase of 15,000 units Oklahoma County, OK Indep 3.00% 07/01/2025 municipal bond.",
    filingId: "20026517",
    reportedYear: 2025,
    tradeYear: 2024,
  },
  {
    id: "beyer-2024-12-04-oklahoma-5000-bond",
    politicianId: "beyer",
    ticker: "OK_OKLA_MUNI",
    company: "Oklahoma County, OK Independent 3.00% 07/01/2025",
    assetType: "Bond",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2024-12-04",
    notificationDate: "2025-01-06",
    amountBracket: "$1,001 – $15,000",
    notes:
      "Purchase of 5,000 units Oklahoma County, OK Indep 3.00% 07/01/2025 municipal bond.",
    filingId: "20026517",
    reportedYear: 2025,
    tradeYear: 2024,
  },
  // --- Hon. John W. Rose (TN-06) 2025 trades ---
  // Filing 20030611
  {
    id: "rose-2025-20030611-fnsxx-1",
    politicianId: "rose",
    ticker: "FNSXX",
    company: "FIMM Money Market Port Fund Instl Cl M/M",
    assetType: "Fund",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-23",
    notificationDate: "2025-06-24",
    amountBracket: "$15,001 – $50,000",
    notes: "",
    filingId: "20030611",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "rose-2025-20030611-ogvxx-1",
    politicianId: "rose",
    ticker: "OGVXX",
    company: "JPMorgan U.S. Government Money Market Fund Capital Cl M/M",
    assetType: "Fund",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-23",
    notificationDate: "2025-06-24",
    amountBracket: "$1,000,001 – $5,000,000",
    notes: "",
    filingId: "20030611",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  // Filing 20030610
  {
    id: "rose-2025-20030610-googl-1",
    politicianId: "rose",
    ticker: "GOOGL",
    company: "Alphabet Inc. Class A",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-06-04",
    amountBracket: "$1,000,001 – $5,000,000",
    notes: "",
    filingId: "20030610",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "rose-2025-20030610-goog-1",
    politicianId: "rose",
    ticker: "GOOG",
    company: "Alphabet Inc. Class C",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-06-04",
    amountBracket: "$250,001 – $500,000",
    notes: "",
    filingId: "20030610",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "rose-2025-20030610-cwgix-1",
    politicianId: "rose",
    ticker: "CWGIX",
    company: "American Funds Capital World Growth & Income Fund (Class A)",
    assetType: "Fund",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-07-04",
    amountBracket: "$250,001 – $500,000",
    notes: "",
    filingId: "20030610",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "rose-2025-20030610-aepgx-1",
    politicianId: "rose",
    ticker: "AEPGX",
    company: "American Funds EuroPacific Fund (Class A)",
    assetType: "Fund",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-06-04",
    amountBracket: "$250,001 – $500,000",
    notes: "",
    filingId: "20030610",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "rose-2025-20030610-agthx-1",
    politicianId: "rose",
    ticker: "AGTHX",
    company: "American Funds Growth Fund of America (Class A)",
    assetType: "Fund",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-06-04",
    amountBracket: "$500,001 – $1,000,000",
    notes: "",
    filingId: "20030610",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "rose-2025-20030610-aivsx-1",
    politicianId: "rose",
    ticker: "AIVSX",
    company: "American Funds Investment Co. of America (Class A)",
    assetType: "Fund",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-06-04",
    amountBracket: "$250,001 – $500,000",
    notes: "",
    filingId: "20030610",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "rose-2025-20030610-smcwx-1",
    politicianId: "rose",
    ticker: "SMCWX",
    company: "American Funds SmallCap World Fund (Class A)",
    assetType: "Fund",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-06-04",
    amountBracket: "$500,001 – $1,000,000",
    notes: "",
    filingId: "20030610",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "rose-2025-20030610-ogvxx-2",
    politicianId: "rose",
    ticker: "OGVXX",
    company: "JPMorgan U.S. Government Money Market Fund Capital Cl M/M",
    assetType: "Fund",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-06-04",
    amountBracket: "$1,000,001 – $5,000,000",
    notes: "",
    filingId: "20030610",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "rose-2025-20030610-msft-1",
    politicianId: "rose",
    ticker: "MSFT",
    company: "Microsoft Corporation",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-06-04",
    amountBracket: "$250,001 – $500,000",
    notes: "",
    filingId: "20030610",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  // --- Ron Wyden (OR) 2025 trades ---
  {
    id: "wyden-2025-07-03-pfe-sell",
    politicianId: "wyden",
    ticker: "PFE",
    company: "Pfizer Inc",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-03",
    notificationDate: "2025-07-03",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Spouse. Price: $23.35",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wyden-2025-02-21-irbt-sell",
    politicianId: "wyden",
    ticker: "IRBT",
    company: "iRobot Corp",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-02-06",
    notificationDate: "2025-02-21",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Spouse. Price: $7.79",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wyden-2025-02-21-solv-sell",
    politicianId: "wyden",
    ticker: "SOLV",
    company: "Solventum Corp",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-02-06",
    notificationDate: "2025-02-21",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Spouse. Price: $74.78",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wyden-2025-02-21-lly-sell-1",
    politicianId: "wyden",
    ticker: "LLY",
    company: "Eli Lilly and Company",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-02-10",
    notificationDate: "2025-02-21",
    amountBracket: "$50,001 – $100,000",
    notes: "Owner: Spouse. Price: $868.88",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wyden-2025-02-21-lly-buy",
    politicianId: "wyden",
    ticker: "LLY",
    company: "Eli Lilly and Company",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-01-22",
    notificationDate: "2025-02-21",
    amountBracket: "$50,001 – $100,000",
    notes: "Owner: Spouse. Price: $753.98",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  // --- Mitch McConnell (KY) 2025 trades ---
  {
    id: "mcconnell-2025-12-19-wfc-buy-1",
    politicianId: "mcconnell",
    ticker: "WFC",
    company: "Wells Fargo & Company",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-12-01",
    notificationDate: "2025-12-19",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Spouse. Price: $85.40",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "mcconnell-2025-09-12-wfc-buy-2",
    politicianId: "mcconnell",
    ticker: "WFC",
    company: "Wells Fargo & Company",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-09-01",
    notificationDate: "2025-09-12",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Spouse. Price: N/A",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "mcconnell-2025-07-07-lazr-sell",
    politicianId: "mcconnell",
    ticker: "LAZR",
    company: "Luminar Technologies, Inc.",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-06-26",
    notificationDate: "2025-07-07",
    amountBracket: "$15,001 – $50,000",
    notes: "Owner: Spouse. Price: $2.95",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "mcconnell-2025-06-19-wfc-buy-3",
    politicianId: "mcconnell",
    ticker: "WFC",
    company: "Wells Fargo & Company",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-06-01",
    notificationDate: "2025-06-19",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Spouse. Price: N/A",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "mcconnell-2025-03-12-wfc-buy-4",
    politicianId: "mcconnell",
    ticker: "WFC",
    company: "Wells Fargo & Company",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-03-03",
    notificationDate: "2025-03-12",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Spouse. Price: $77.03",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  // --- Debbie Wasserman Schultz (FL23) 2025 trades ---
  {
    id: "wassermanschultz-2025-12-09-drq-sell",
    politicianId: "wassermanschultz",
    ticker: "DRQ",
    company: "Dril-Quip, Inc.",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-11-25",
    notificationDate: "2025-12-09",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Child. Price: $22.51",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-10-27-ango-sell-1",
    politicianId: "wassermanschultz",
    ticker: "ANGO",
    company: "AngioDynamics, Inc.",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-10-20",
    notificationDate: "2025-10-27",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Child. Price: $11.82",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-10-07-volaris-sell",
    politicianId: "wassermanschultz",
    ticker: "N/A",
    company: "Controladora Vuela Compañía de Aviación, S.A.B. de C.V.",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-09-29",
    notificationDate: "2025-10-07",
    amountBracket: "< $1,000",
    notes: "Owner: Child. Price: N/A",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-10-07-bry-sell-1",
    politicianId: "wassermanschultz",
    ticker: "BRY",
    company: "Berry Corp",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-09-15",
    notificationDate: "2025-10-07",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Child. Price: N/A",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-10-07-bry-sell-2",
    politicianId: "wassermanschultz",
    ticker: "BRY",
    company: "Berry Corp",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-09-15",
    notificationDate: "2025-10-07",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Undisclosed. Price: N/A",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-08-19-ssys-buy",
    politicianId: "wassermanschultz",
    ticker: "SSYS",
    company: "Stratasys Ltd.",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-08-15",
    notificationDate: "2025-08-19",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Child. Price: $9.40",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-08-07-ichr-buy",
    politicianId: "wassermanschultz",
    ticker: "ICHR",
    company: "Ichor Holdings, Ltd.",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-08-05",
    notificationDate: "2025-08-07",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Child. Price: $14.06",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-07-28-vsat-sell",
    politicianId: "wassermanschultz",
    ticker: "VSAT",
    company: "ViaSat, Inc.",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-07-18",
    notificationDate: "2025-07-28",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Child. Price: $15.72",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-07-28-ango-sell-2",
    politicianId: "wassermanschultz",
    ticker: "ANGO",
    company: "AngioDynamics, Inc.",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-07-16",
    notificationDate: "2025-07-28",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Undisclosed. Price: $8.60",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-07-28-ango-buy",
    politicianId: "wassermanschultz",
    ticker: "ANGO",
    company: "AngioDynamics, Inc.",
    assetType: "Stock",
    transactionType: "Buy",
    mechanism: "Direct",
    tradeDate: "2025-06-27",
    notificationDate: "2025-07-28",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Child. Price: $9.78",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
  },
  {
    id: "wassermanschultz-2025-03-07-hurco-sell",
    politicianId: "wassermanschultz",
    ticker: "N/A",
    company: "Hurco Companies, Inc.",
    assetType: "Stock",
    transactionType: "Sell",
    mechanism: "Direct",
    tradeDate: "2025-02-06",
    notificationDate: "2025-03-07",
    amountBracket: "$1,001 – $15,000",
    notes: "Owner: Child. Price: $22.40",
    filingId: "N/A",
    reportedYear: 2025,
    tradeYear: 2025,
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
  NVDA:
    "NVIDIA designs GPUs and accelerated computing platforms used in gaming, data centers, and AI workloads. Its chips and CUDA software stack are key infrastructure for modern machine learning and high‑performance computing.",
  PANW:
    "Palo Alto Networks provides next‑generation firewalls, cloud security, and endpoint protection to enterprises and governments. It generates recurring revenue from subscription security services that protect networks and applications.",
  CT_MUNI:
    "Connecticut State Special Tax 5.00% 2037 is a municipal bond backed by pledged state tax revenues, typically used to finance public projects. Investors receive tax‑advantaged interest payments tied to Connecticut’s credit quality.",
  KING_WA_MUNI:
    "King County, Washington 4.00% 2032 is a municipal bond issued by King County to fund local projects and infrastructure. The bond’s payments depend on the county’s tax base and fiscal health.",
  NALLEGHENY_PA_MUNI:
    "North Allegheny, Pennsylvania School District 5.00% 2030 is a school district municipal bond used to finance education facilities. Debt service is funded from local property taxes and school revenues.",
  STJOHN_LA_MUNI:
    "St. John the Baptist Parish Variable Rate 2037 is a Louisiana municipal revenue bond with variable interest, typically tied to specific parish projects. Investors bear both credit and interest‑rate risk in exchange for tax‑favored income.",
  MASS_SCH_MUNI:
    "Massachusetts School Building Authority 5.00% is a municipal bond financing school construction and renovation across the state. Payments are supported by dedicated state revenues and appropriations.",
  OK_OKLA_MUNI:
    "Oklahoma County Independent School District 3.00% 2025 is a local municipal bond funding school operations and capital projects. It is backed by the tax base of the Oklahoma County school district.",
  UW_MUNI:
    "University of Washington 4.00% 2033 is a higher‑education revenue bond backed by the university system. Proceeds support campus facilities and infrastructure, with payments tied to tuition and other revenues.",
  MD_HEALTH_MUNI:
    "Maryland State Health Variable Rate 2045 is a healthcare‑related municipal bond used to finance medical facilities and health projects. It offers tax‑advantaged income backed by healthcare system and state‑related revenues.",
  DALLAS_TX_MUNI:
    "Dallas, Texas Area Rapid Transit 5.00% 2025 is a transit revenue bond supporting the Dallas public transportation system. Debt service comes from dedicated transit revenues and sales taxes.",
  DUKE_ST_LLCOI:
    "Duke Street LLC – 2712 Duke Street is an interest in a commercial real‑estate property in Alexandria, Virginia. Returns depend on property income and sale proceeds rather than traditional bond coupons.",
  FNSXX:
    "FNSXX is a Fidelity institutional money‑market fund that invests in short‑term, high‑quality instruments. It is designed to preserve capital and provide daily liquidity with modest interest income.",
  OGVXX:
    "OGVXX is a JPMorgan U.S. government money‑market fund that holds Treasury and agency securities. It functions as a cash‑equivalent vehicle focused on safety and liquidity rather than growth.",
  GOOG:
    "Alphabet Inc. Class C shares represent non‑voting equity in the parent company of Google, YouTube, and other services. They track the same economic exposure as Class A shares but without shareholder voting rights.",
  CWGIX:
    "American Funds Capital World Growth & Income (Class A) is a global mutual fund investing in dividend‑paying stocks across developed and emerging markets. It targets a mix of growth and current income.",
  AEPGX:
    "American Funds EuroPacific Growth (Class A) is an international equity mutual fund focused on companies outside the U.S., especially in Europe and the Pacific region. It aims for long‑term capital appreciation.",
  AGTHX:
    "American Funds Growth Fund of America (Class A) is a large‑cap growth mutual fund that invests primarily in U.S. and global equities with above‑average earnings prospects.",
  AIVSX:
    "American Funds Investment Company of America (Class A) is a diversified equity mutual fund emphasizing established, dividend‑paying companies with long operating histories.",
  SMCWX:
    "American Funds SmallCap World (Class A) is a global small‑cap mutual fund investing in smaller companies across both developed and emerging markets.",
  MSFT:
    "Microsoft develops and sells software, cloud infrastructure (Azure), productivity tools (Office, Teams), and gaming content (Xbox). It is one of the world’s largest technology platforms with recurring cloud and subscription revenue.",
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
  /** @type {Record<string, {count:number,lowSum:number,highSum:number}>} */
  const byAssetType = {};

  tradesForStats.forEach((t) => {
    if (t.transactionType === "Buy") buys += 1;
    if (t.transactionType === "Sell") sells += 1;

    const range = parseAmountBracket(t.amountBracket);
    if (range) {
      lowSum += range.low;
      highSum += range.high;

      const key = t.assetType || "Other";
      if (!byAssetType[key]) {
        byAssetType[key] = { count: 0, lowSum: 0, highSum: 0 };
      }
      byAssetType[key].count += 1;
      byAssetType[key].lowSum += range.low;
      byAssetType[key].highSum += range.high;
    }
  });

  return {
    total: tradesForStats.length,
    buys,
    sells,
    lowSum,
    highSum,
    byAssetType,
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
  const volumeLabel = formatDollarRange(stats.lowSum, stats.highSum);

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
        </div>
        <div class="ct-stat-card">
          <div class="ct-stat-label">Buys vs. sells</div>
          <div class="ct-stat-value">${stats.buys} buys · ${stats.sells} sells</div>
        </div>
        <div class="ct-stat-card">
          <div class="ct-stat-label">Disclosed volume range</div>
          <div class="ct-stat-value">${volumeLabel}</div>
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


