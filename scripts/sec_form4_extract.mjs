import fs from "fs";
import path from "path";
import readline from "readline";

/**
 * SEC Form 4 (Form 345) TSV extractor
 *
 * Joins:
 * - SUBMISSION.tsv (issuerName, tradingSymbol, filingDate)
 * - REPORTINGOWNER.tsv (insider name + position)
 * - NONDERIV_TRANS.tsv (Table I - non-derivative, outright equity) — P/S only
 *
 * Output:
 * - JSON array for frontend use
 * - Markdown table for copy/paste
 */

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args.set(key, true);
      } else {
        args.set(key, next);
        i++;
      }
    }
  }
  return args;
}

function mustExist(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .toUpperCase();
}

function splitTsvLine(line) {
  // SEC bulk TSVs are simple tab-separated; fields typically do not contain tabs.
  // We intentionally keep this fast and non-alloc-heavy.
  return line.split("\t");
}

function headerIndexMap(headerLine) {
  const cols = splitTsvLine(headerLine).map(normalizeHeader);
  const map = new Map();
  cols.forEach((c, idx) => map.set(c, idx));
  return map;
}

function pickIdx(hmap, candidates) {
  for (const c of candidates) {
    const key = normalizeHeader(c);
    const idx = hmap.get(key);
    if (typeof idx === "number") return idx;
  }
  return null;
}

function getField(fields, idx) {
  if (idx == null) return "";
  return (fields[idx] ?? "").trim();
}

function truthyFlag(v) {
  const s = String(v || "").trim().toUpperCase();
  return s === "1" || s === "Y" || s === "YES" || s === "TRUE" || s === "T";
}

function safeNumber(v) {
  const n = Number(String(v || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatMdCell(v) {
  return String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function parseIsoDate(d) {
  // Expect YYYY-MM-DD; return Date or null
  const s = String(d || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const dt = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function isExcludedSecurityTitle(title) {
  const t = String(title || "").toLowerCase();
  // Even in NONDERIV table, filter out non-outright equity instruments explicitly
  return (
    t.includes("option") ||
    t.includes("warrant") ||
    t.includes("rsu") ||
    t.includes("restricted stock unit") ||
    t.includes("restricted stock") ||
    t.includes("performance") ||
    t.includes("award") ||
    t.includes("unit")
  );
}

function buildPosition({ director, officer, tenPctOwner, officerTitle, other }) {
  const parts = [];
  if (truthyFlag(director)) parts.push("Director");
  if (truthyFlag(officer)) {
    const title = String(officerTitle || "").trim();
    parts.push(title ? `Officer — ${title}` : "Officer");
  }
  if (truthyFlag(tenPctOwner)) parts.push("10% Owner");
  const otherText = String(other || "").trim();
  if (otherText) parts.push(otherText);
  return parts.join(", ");
}

async function readSubmissionMap(submissionPath, targetTickers) {
  const stream = fs.createReadStream(submissionPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let headerDone = false;
  let hmap;
  let idxAcc, idxIssuerName, idxTicker, idxFilingDate, idxIssuerCik;

  const submissionByAcc = new Map();
  const foundTickers = new Set();

  for await (const line of rl) {
    if (!headerDone) {
      hmap = headerIndexMap(line);
      idxAcc = pickIdx(hmap, ["ACCESSION_NUMBER", "ACCESSIONNUMBER"]);
      idxIssuerName = pickIdx(hmap, ["ISSUER_NAME", "ISSUERNAME"]);
      idxTicker = pickIdx(hmap, ["ISSUER_TRADING_SYMBOL", "TRADING_SYMBOL", "TRADINGSYMBOL", "ISSUERTRADINGSYMBOL"]);
      idxFilingDate = pickIdx(hmap, ["FILING_DATE", "FILINGDATE"]);
      idxIssuerCik = pickIdx(hmap, ["ISSUER_CIK", "ISSUERCIK", "CIK"]);
      headerDone = true;
      continue;
    }
    if (!line) continue;
    const fields = splitTsvLine(line);
    const ticker = getField(fields, idxTicker).toUpperCase();
    if (!ticker || !targetTickers.has(ticker)) continue;
    const acc = getField(fields, idxAcc);
    if (!acc) continue;

    submissionByAcc.set(acc, {
      accessionNumber: acc,
      issuerCik: getField(fields, idxIssuerCik),
      issuerName: getField(fields, idxIssuerName),
      ticker,
      filingDate: getField(fields, idxFilingDate),
    });
    foundTickers.add(ticker);
  }

  return { submissionByAcc, foundTickers };
}

async function readReportingOwners(reportingOwnerPath, submissionByAcc) {
  const stream = fs.createReadStream(reportingOwnerPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let headerDone = false;
  let hmap;
  let idxAcc, idxOwnerCik, idxOwnerName, idxDirector, idxOfficer, idxTenPct, idxOfficerTitle, idxOther;

  // Map: accession -> Map(ownerCik -> {name, position})
  const ownersByAcc = new Map();

  for await (const line of rl) {
    if (!headerDone) {
      hmap = headerIndexMap(line);
      idxAcc = pickIdx(hmap, ["ACCESSION_NUMBER", "ACCESSIONNUMBER"]);
      idxOwnerCik = pickIdx(hmap, ["RPT_OWNER_CIK", "REPORTINGOWNERCIK", "RPTOWNERCIK", "OWNER_CIK"]);
      idxOwnerName = pickIdx(hmap, ["RPT_OWNER_NAME", "REPORTINGOWNERNAME", "RPTOWNERNAME", "OWNER_NAME"]);
      idxDirector = pickIdx(hmap, ["DIRECTOR"]);
      idxOfficer = pickIdx(hmap, ["OFFICER"]);
      idxTenPct = pickIdx(hmap, ["TENPERCENTOWNER", "TEN_PERCENT_OWNER", "TENPCTOWNER"]);
      idxOfficerTitle = pickIdx(hmap, ["OFFICER_TITLE", "OFFICERTITLE", "OFFICER_TITLE_TXT"]);
      idxOther = pickIdx(hmap, ["OTHER_TEXT", "OTHERTEXT", "OTHER"]);
      headerDone = true;
      continue;
    }
    if (!line) continue;
    const fields = splitTsvLine(line);
    const acc = getField(fields, idxAcc);
    if (!acc || !submissionByAcc.has(acc)) continue;

    const ownerCik = getField(fields, idxOwnerCik);
    if (!ownerCik) continue;

    const ownerName = getField(fields, idxOwnerName);
    const position = buildPosition({
      director: getField(fields, idxDirector),
      officer: getField(fields, idxOfficer),
      tenPctOwner: getField(fields, idxTenPct),
      officerTitle: getField(fields, idxOfficerTitle),
      other: getField(fields, idxOther),
    });

    if (!ownersByAcc.has(acc)) ownersByAcc.set(acc, new Map());
    ownersByAcc.get(acc).set(ownerCik, { ownerCik, ownerName, position });
  }

  return ownersByAcc;
}

async function extractTransactions(nonderivPath, submissionByAcc, ownersByAcc) {
  const stream = fs.createReadStream(nonderivPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let headerDone = false;
  let hmap;
  let idxAcc, idxOwnerCik, idxTransCode, idxShares, idxTransDate, idxSecurityTitle;

  const rows = [];
  const dedup = new Set();

  for await (const line of rl) {
    if (!headerDone) {
      hmap = headerIndexMap(line);
      idxAcc = pickIdx(hmap, ["ACCESSION_NUMBER", "ACCESSIONNUMBER"]);
      idxOwnerCik = pickIdx(hmap, ["RPT_OWNER_CIK", "REPORTINGOWNERCIK", "RPTOWNERCIK", "OWNER_CIK"]);
      idxTransCode = pickIdx(hmap, ["TRANS_CODE", "TRANSACTION_CODE", "TRANSCODE"]);
      idxShares = pickIdx(hmap, ["TRANS_SHARES", "TRANSACTION_SHARES", "TRANSShares", "SHARES"]);
      idxTransDate = pickIdx(hmap, ["TRANS_DATE", "TRANSACTION_DATE", "TRANSDATE"]);
      idxSecurityTitle = pickIdx(hmap, ["SECURITY_TITLE", "SECURITYTITLE", "TITLE_OF_SECURITY"]);
      headerDone = true;
      continue;
    }
    if (!line) continue;
    const fields = splitTsvLine(line);
    const acc = getField(fields, idxAcc);
    if (!acc || !submissionByAcc.has(acc)) continue;

    const transCode = getField(fields, idxTransCode).toUpperCase();
    if (transCode !== "P" && transCode !== "S") continue; // rule: P/S only

    const securityTitle = getField(fields, idxSecurityTitle);
    if (isExcludedSecurityTitle(securityTitle)) continue;

    const ownerCik = getField(fields, idxOwnerCik);
    if (!ownerCik) continue;

    const sharesRaw = getField(fields, idxShares);
    const shares = safeNumber(sharesRaw);
    if (shares == null) continue;

    const transDate = getField(fields, idxTransDate);
    if (!transDate) continue;

    const submission = submissionByAcc.get(acc);
    const ownersForAcc = ownersByAcc.get(acc);
    const owner = ownersForAcc?.get(ownerCik);

    const dedupKey = `${submission.issuerCik}|${transDate}|${transCode}|${shares}|${ownerCik}`;
    if (dedup.has(dedupKey)) continue;
    dedup.add(dedupKey);

    rows.push({
      Company: submission.issuerName,
      Ticker: submission.ticker,
      "Insider Name": owner?.ownerName || "",
      Position: owner?.position || "",
      "Buy/Sell": transCode === "P" ? "Buy" : "Sell",
      Shares: shares,
      "Transaction Date": transDate,
      "Filing Date": submission.filingDate,
    });
  }

  // Sort by transaction date descending
  rows.sort((a, b) => {
    const da = parseIsoDate(a["Transaction Date"])?.getTime() ?? 0;
    const db = parseIsoDate(b["Transaction Date"])?.getTime() ?? 0;
    return db - da;
  });

  return rows;
}

function toMarkdownTable(rows) {
  const headers = [
    "Company",
    "Ticker",
    "Insider Name",
    "Position",
    "Buy/Sell",
    "Shares",
    "Transaction Date",
    "Filing Date",
  ];

  const md = [];
  md.push(`| ${headers.join(" | ")} |`);
  md.push(`| ${headers.map(() => "---").join(" | ")} |`);

  for (const r of rows) {
    md.push(
      `| ${headers.map((h) => formatMdCell(r[h])).join(" | ")} |`
    );
  }

  return md.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  const inputDir = args.get("input") || "data/sec_form4";
  const outJson = args.get("out-json") || "data/insider-activity-sec.json";
  const outMd = args.get("out-md") || "data/insider-activity-sec.md";

  const tickersArg = args.get("tickers") || "NVDA,V,JPM,INTC,AMD";
  const targetTickers = new Set(
    String(tickersArg)
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
  );

  const submissionPath = path.join(inputDir, "SUBMISSION.tsv");
  const reportingOwnerPath = path.join(inputDir, "REPORTINGOWNER.tsv");
  const nonderivPath = path.join(inputDir, "NONDERIV_TRANS.tsv");

  mustExist(submissionPath);
  mustExist(reportingOwnerPath);
  mustExist(nonderivPath);

  const { submissionByAcc, foundTickers } = await readSubmissionMap(submissionPath, targetTickers);
  const ownersByAcc = await readReportingOwners(reportingOwnerPath, submissionByAcc);
  const rows = await extractTransactions(nonderivPath, submissionByAcc, ownersByAcc);

  const missing = [...targetTickers].filter((t) => !foundTickers.has(t));

  // Write JSON
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(rows, null, 2), "utf8");

  // Write Markdown
  const mdTable = toMarkdownTable(rows);
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, mdTable + "\n", "utf8");

  // Print summary
  console.log(mdTable);
  console.log("");

  // Per-company missing output requirement
  for (const ticker of [...targetTickers].sort()) {
    const has = rows.some((r) => r.Ticker === ticker);
    if (!has) {
      console.log(`No non-derivative insider transactions found for ${ticker}.`);
    }
  }

  if (missing.length) {
    console.log("");
    console.log(`Note: No SUBMISSION.tsv matches found for tickers: ${missing.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  console.error("");
  console.error("Expected TSVs at: data/sec_form4/{SUBMISSION.tsv,REPORTINGOWNER.tsv,NONDERIV_TRANS.tsv}");
  console.error("Run: node scripts/sec_form4_extract.mjs --input data/sec_form4 --tickers NVDA,V,JPM,INTC,AMD");
  process.exit(1);
});



