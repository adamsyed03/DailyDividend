#!/usr/bin/env node

import { Client } from '@notionhq/client';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;
const STRICT_SYNC = process.env.STRICT_SYNC === 'true';

if (!NOTION_TOKEN || !NOTION_PAGE_ID) {
  console.error('Error: NOTION_TOKEN and NOTION_PAGE_ID must be set');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const dataDir = join(rootDir, 'data', 'daily');
const DRY_RUN = process.env.DRY_RUN === 'true';

// Ensure data directory exists
await fs.mkdir(dataDir, { recursive: true });

async function writeJsonFileAtomic(filePath, obj) {
  const tmp = `${filePath}.tmp`;
  const json = JSON.stringify(obj, null, 2);
  await fs.writeFile(tmp, json, 'utf-8');
  // Validate immediately so we never commit invalid JSON
  JSON.parse(await fs.readFile(tmp, 'utf-8'));
  await fs.rename(tmp, filePath);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Render rich text annotations (bold, italic, code, link)
 */
function renderRichText(richTextArray) {
  if (!richTextArray || richTextArray.length === 0) return '';
  
  return richTextArray.map(text => {
    let content = escapeHtml(text.plain_text);
    
    if (text.annotations) {
      if (text.annotations.code) {
        content = `<code>${content}</code>`;
      }
      if (text.annotations.bold) {
        content = `<strong>${content}</strong>`;
      }
      if (text.annotations.italic) {
        content = `<em>${content}</em>`;
      }
      if (text.annotations.strikethrough) {
        content = `<s>${content}</s>`;
      }
      if (text.annotations.underline) {
        content = `<u>${content}</u>`;
      }
      if (text.href) {
        content = `<a href="${escapeHtml(text.href)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
      }
    }
    
    return content;
  }).join('');
}

/**
 * Render a single block to HTML
 */
function renderBlock(block) {
  const type = block.type;
  
  switch (type) {
    case 'paragraph':
      const paraText = renderRichText(block.paragraph?.rich_text);
      return paraText ? `<p>${paraText}</p>` : '<p></p>';
    
    case 'heading_1':
      const h1Text = renderRichText(block.heading_1?.rich_text);
      return h1Text ? `<h2>${h1Text}</h2>` : '';
    
    case 'heading_2':
      const h2Text = renderRichText(block.heading_2?.rich_text);
      return h2Text ? `<h2>${h2Text}</h2>` : '';
    
    case 'heading_3':
      const h3Text = renderRichText(block.heading_3?.rich_text);
      return h3Text ? `<h3>${h3Text}</h3>` : '';
    
    case 'bulleted_list_item':
      const bulletText = renderRichText(block.bulleted_list_item?.rich_text);
      return bulletText ? `<li>${bulletText}</li>` : '';
    
    case 'numbered_list_item':
      const numberedText = renderRichText(block.numbered_list_item?.rich_text);
      return numberedText ? `<li>${numberedText}</li>` : '';
    
    case 'quote':
      const quoteText = renderRichText(block.quote?.rich_text);
      return quoteText ? `<blockquote>${quoteText}</blockquote>` : '';
    
    case 'code':
      const codeText = escapeHtml(block.code?.rich_text?.map(t => t.plain_text).join('') || '');
      const codeLang = block.code?.language ? ` class="language-${escapeHtml(block.code.language)}"` : '';
      return codeText ? `<pre><code${codeLang}>${codeText}</code></pre>` : '';
    
    case 'divider':
      return '<hr>';
    
    case 'image':
      const imageUrl = block.image?.file?.url || block.image?.external?.url || '';
      const imageCaption = block.image?.caption ? renderRichText(block.image.caption) : '';
      if (!imageUrl) return '';
      const captionHtml = imageCaption ? `<figcaption>${imageCaption}</figcaption>` : '';
      return `<figure><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageCaption || '')}" />${captionHtml}</figure>`;
    
    default:
      return '';
  }
}

/**
 * Extract plain text from rich text array (for excerpts)
 */
function extractPlainText(richTextArray) {
  if (!richTextArray) return '';
  return richTextArray.map(t => t.plain_text).join('');
}

/**
 * Format as YYYY-MM-DD and validate date parts.
 */
function toIsoDate(yearNum, monthIndex, dayNum) {
  if (!Number.isInteger(yearNum) || !Number.isInteger(monthIndex) || !Number.isInteger(dayNum)) return null;
  if (monthIndex < 0 || monthIndex > 11) return null;
  if (dayNum < 1 || dayNum > 31) return null;

  const date = new Date(yearNum, monthIndex, dayNum);
  // Validate the date is correct (handles invalid dates like Feb 30)
  if (date.getFullYear() !== yearNum || date.getMonth() !== monthIndex || date.getDate() !== dayNum) {
    return null;
  }

  const yearStr = date.getFullYear().toString();
  const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
  const dayStr = date.getDate().toString().padStart(2, '0');
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Universal date parser - tries multiple strategies to extract a date from text
 * Returns { date: 'YYYY-MM-DD', title: string } or null
 */
function parseDateFromText(text) {
  if (!text || typeof text !== 'string') return null;
  
  const raw = text.trim();
  // Normalize common ordinal suffixes so formats like "Jan 2nd" or "2nd Jan" always parse.
  // Keep it conservative: only strip st/nd/rd/th when directly after a 1-2 digit day.
  const rawNorm = raw.replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1');
  const currentYear = new Date().getFullYear();
  
  // Strategy 1: Try JavaScript's Date constructor (handles many formats)
  // IMPORTANT: only do this when the string includes an explicit year.
  // Otherwise, engines can "invent" a year (e.g., "Thu, 1 Jan" -> 2001-01-01),
  // which breaks file naming and the site.
  if (/\b20\d{2}\b/.test(rawNorm)) {
    try {
      const parsedDate = new Date(rawNorm);
      if (!Number.isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2000 && parsedDate.getFullYear() < 2100) {
        const year = parsedDate.getFullYear();
        const month = parsedDate.getMonth();
        const day = parsedDate.getDate();
        const iso = toIsoDate(year, month, day);
        if (iso) {
          // Extract title by removing the date part
          const title = rawNorm.replace(/^\s*(?:[A-Za-z]{3,9}[.,]?\s*)?,?\s*\d{1,2}[\/\-\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2})[\/\-\s]+\d{1,4}[^\w]*/i, '').trim();
          return { date: iso, title: title || 'Untitled' };
        }
      }
    } catch (e) {
      // Continue to other strategies
    }
  }
  
  // Strategy 2: Look for ISO date format (YYYY-MM-DD)
  {
    const m = rawNorm.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const yearNum = parseInt(m[1], 10);
      const monthNum = parseInt(m[2], 10);
      const dayNum = parseInt(m[3], 10);
      const iso = toIsoDate(yearNum, monthNum - 1, dayNum);
      if (iso) {
        const title = rawNorm.replace(/\d{4}-\d{2}-\d{2}\s*[—-]?\s*/, '').trim();
        return { date: iso, title: title || 'Untitled' };
      }
    }
  }
  
  // Strategy 3: Look for date patterns with month names
  const monthMap = {
    jan: 0, january: 0, janv: 0,
    feb: 1, february: 1, févr: 1,
    mar: 2, march: 2, mars: 2,
    apr: 3, april: 3, avril: 3,
    may: 4, mai: 4,
    jun: 5, june: 5, juin: 5,
    jul: 6, july: 6, juillet: 6,
    aug: 7, august: 7, août: 7,
    sep: 8, sept: 8, september: 8, septembre: 8,
    oct: 9, october: 9, octobre: 9,
    nov: 10, november: 10, novembre: 10,
    dec: 11, december: 11, décembre: 11,
  };
  
  // Try "Day Month" format (e.g., "Thu, 1 Jan", "1 Jan", "1st January")
  {
    const m = rawNorm.match(
      /^(?:[A-Za-z]{3,9}[.,]?\s*)?,?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary|v)?|Feb(?:ruary|r)?|Mar(?:ch|s)?|Apr(?:il|il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember|embre)?|Oct(?:ober|obre)?|Nov(?:ember|embre)?|Dec(?:ember|embre)?)\.?(?:,\s*(\d{4}))?\s*(.*)$/i
    );
    if (m) {
      const dayNum = parseInt(m[1], 10);
      const monthKey = m[2].toLowerCase().replace(/\./g, '');
      const monthIndex = monthMap[monthKey];
      if (monthIndex !== undefined) {
        const yearNum = m[3] ? parseInt(m[3], 10) : currentYear;
        const iso = toIsoDate(yearNum, monthIndex, dayNum);
        if (iso) return { date: iso, title: (m[4] || '').trim() || 'Untitled' };
      }
    }
  }
  
  // Try "Month Day" format (e.g., "Dec 23", "December 23, 2025")
  {
    const m = rawNorm.match(
      /^(?:[A-Za-z]{3,9}[.,]?\s*)?,?\s*(Jan(?:uary|v)?|Feb(?:ruary|r)?|Mar(?:ch|s)?|Apr(?:il|il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember|embre)?|Oct(?:ober|obre)?|Nov(?:ember|embre)?|Dec(?:ember|embre)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?\s*(.*)$/i
    );
    if (m) {
      const monthKey = m[1].toLowerCase().replace(/\./g, '');
      const monthIndex = monthMap[monthKey];
      if (monthIndex !== undefined) {
        const dayNum = parseInt(m[2], 10);
        const yearNum = m[3] ? parseInt(m[3], 10) : currentYear;
        const iso = toIsoDate(yearNum, monthIndex, dayNum);
        if (iso) return { date: iso, title: (m[4] || '').trim() || 'Untitled' };
      }
    }
  }
  
  // Strategy 4: Numeric formats (MM/DD/YYYY, DD/MM/YYYY, etc.)
  {
    // YYYY-MM-DD (optionally with title)
    {
      const m = rawNorm.match(/^(?:[A-Za-z]{3,9}[.,]?\s*)?,?\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*(.*)$/);
      if (m) {
        const yearNum = parseInt(m[1], 10);
        const monthNum = parseInt(m[2], 10);
        const dayNum = parseInt(m[3], 10);
        const iso = toIsoDate(yearNum, monthNum - 1, dayNum);
        if (iso) return { date: iso, title: (m[4] || '').trim() || 'Untitled' };
      }
    }

    // MM/DD/YYYY or DD/MM/YYYY (optionally with title)
    {
      const m = rawNorm.match(/^(?:[A-Za-z]{3,9}[.,]?\s*)?,?\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s*(.*)$/);
      if (m) {
        const num1 = parseInt(m[1], 10);
        const num2 = parseInt(m[2], 10);
        let yearNum = m[3] ? parseInt(m[3], 10) : currentYear;
        if (m[3] && m[3].length === 2) yearNum = 2000 + yearNum;

        // Heuristic: if num1 > 12, it's likely DD/MM[/YYYY]
        const isLikelyDMY = num1 > 12;
        const dayNum = isLikelyDMY ? num1 : num2;
        const monthNum = isLikelyDMY ? num2 : num1;

        const iso = toIsoDate(yearNum, monthNum - 1, dayNum);
        if (iso) return { date: iso, title: (m[4] || '').trim() || 'Untitled' };
      }
    }
  }
  
  return null;
}

/**
 * Parse "DAILY DIVIDEND | ..." headings/paragraph delimiters.
 * Now uses universal date parser for maximum flexibility.
 *
 * Returns { date: 'YYYY-MM-DD', title: string } or null.
 */
function parseDailyDividendDelimiter(text) {
  const raw = (text || '').trim();
  
  // Check for known prefixes with a pipe delimiter:
  // - "DAILY DIVIDEND | ..."
  // - "Daily Market Wrap-Up | ..."
  // Parse the text after the "|" as the date/title line.
  const prefixMatch = raw.match(
    /^\s*(?:DAILY\s+DIVIDEND|DAILY\s+MARKET\s+WRAP(?:\s*[-–—]?\s*UP)?)\s*\|\s*(.+)$/i
  );
  if (prefixMatch) {
    const remainder = prefixMatch[1].trim();
    const result = parseDateFromText(remainder);
    if (result) return result;
  }
  
  // Also try parsing the entire text (in case format changed)
  const result = parseDateFromText(raw);
  if (result) return result;
  
  return null;
}

/**
 * Parse pipe-delimited headings like:
 *  - "Daily Market Wrap-Up | Wed, 7 Jan"
 *  - "DAILY DIVIDEND | Thu, 1 Jan"
 *
 * Only accepts recognized left-side prefixes to avoid false positives.
 * Returns { date: 'YYYY-MM-DD', title: string } or null.
 */
function parsePipePrefixedDelimiter(text) {
  const raw = (text || '').trim();
  const m = raw.match(
    /^\s*(DAILY\s+DIVIDEND|DAILY\s+MARKET\s+WRAP(?:\s*[-–—]?\s*UP)?)\s*\|\s*(.+)$/i
  );
  if (!m) return null;

  const rhs = (m[2] || '').trim();
  const parsed = parseDateFromText(rhs);
  if (!parsed?.date) return null;

  // Preserve original heading text as the title fallback when RHS is only a date-like string.
  return {
    date: parsed.date,
    title: (parsed.title && parsed.title !== 'Untitled') ? parsed.title : raw,
  };
}

/**
 * Get all blocks from a Notion page (handles pagination)
 */
async function listChildBlocks(blockId) {
  const blocks = [];
  let cursor = undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    blocks.push(...response.results);
    cursor = response.next_cursor;
  } while (cursor);

  return blocks;
}

/**
 * Recursively fetch blocks so entries inside toggles/columns/synced blocks are included.
 * Avoids traversing sub-pages/databases (child_page/child_database).
 */
async function getAllBlocks(blockId) {
  const rootChildren = await listChildBlocks(blockId);
  const flattened = [];

  for (const block of rootChildren) {
    flattened.push(block);

    if (block?.has_children && block.type !== 'child_page' && block.type !== 'child_database') {
      try {
        const nested = await getAllBlocks(block.id);
        flattened.push(...nested);
      } catch (e) {
        // Non-fatal: keep going even if a nested block can't be fetched
        console.warn(`Warning: failed to fetch nested children for block ${block.id} (${block.type})`);
      }
    }
  }

  return flattened;
}

/**
 * Parse entries from blocks (separated by H2 blocks or DAILY DIVIDEND paragraphs)
 */
function parseEntries(blocks) {
  const entries = [];
  let currentEntry = null;
  let currentBlocks = [];
  let inList = false;
  let listType = null;
  let listItems = [];
  let hasHeadingDelimiters = false;
  let didPromoteTitleFromContent = false;
  let pendingTitleFromHeading = '';

  function normalizeTitle(t) {
    return String(t || '').replace(/\s+/g, ' ').trim();
  }

  function isProbablyJustADateTitle(t) {
    const s = normalizeTitle(t);
    if (!s) return true;
    if (s.toLowerCase() === 'untitled') return true;
    // If the title itself parses as a date, it's likely just a date header (e.g., "Thu, 1 Jan")
    try {
      return !!parseDateFromText(s);
    } catch {
      return false;
    }
  }

  function shouldPromoteTitleFromBlock(blockHeadingText) {
    if (didPromoteTitleFromContent) return false;
    if (!currentEntry) return false;
    if (!isProbablyJustADateTitle(currentEntry.title)) return false;

    const candidate = normalizeTitle(blockHeadingText);
    if (!candidate) return false;

    // Avoid promoting headings that are themselves date headers or generic page headers.
    try {
      if (parseDateFromText(candidate)?.date) return false;
    } catch {}
    if (candidate.toLowerCase() === 'daily market wrap-up') return false;

    // Heuristic: requires some substance
    if (candidate.length < 8) return false;

    return true;
  }

  function setPendingTitleFromHeading(text) {
    const candidate = normalizeTitle(text);
    if (!candidate) return;
    // Ignore headings that are clearly date-like
    try {
      if (parseDateFromText(candidate)?.date) return;
    } catch {}
    if (candidate.toLowerCase() === 'daily market wrap-up') return;
    pendingTitleFromHeading = candidate;
  }
  
  if (!blocks || blocks.length === 0) {
    console.warn('Warning: No blocks provided to parseEntries');
    return entries;
  }
  
  // First pass: check if we have any heading delimiters we can parse
  // Now more flexible - looks for any date-like pattern in headings
  for (const block of blocks) {
    if (block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3') {
      const rich = block[block.type]?.rich_text || [];
      const text = extractPlainText(rich);
      // Check for ISO date format
      const isIso = /^\d{4}-\d{2}-\d{2}\s*[—-]\s*.+$/.test(text);
      // Check for DAILY DIVIDEND prefix
      const isDaily = /^\s*DAILY\s+DIVIDEND\s*\|/i.test(text);
      // Check if text contains any date-like pattern
      const hasDate = parseDateFromText(text) !== null;
      if (isIso || isDaily || hasDate) {
        hasHeadingDelimiters = true;
        break;
      }
    }
  }
  
  for (const block of blocks) {
    const type = block.type;
    let isEntryDelimiter = false;
    let entryDate = null;
    let entryTitle = null;
    
    // Check if this is a heading delimiter (entry separator)
    // Now more flexible - accepts any heading or paragraph with a date-like pattern
    if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
      const headingText = extractPlainText(block[type]?.rich_text || []);

      // If we haven't started an entry yet, remember the latest heading as a potential title.
      // This supports the format where the headline (H2) appears BEFORE the "DAILY DIVIDEND | ..." date line.
      if (!currentEntry) {
        setPendingTitleFromHeading(headingText);
      }
      
      // Try format 1: YYYY-MM-DD — Title
      const match1 = headingText.match(/^(\d{4}-\d{2}-\d{2})\s*[—-]\s*(.+)$/);
      if (match1) {
        isEntryDelimiter = true;
        entryDate = match1[1];
        entryTitle = match1[2];
      } else {
        // Try known pipe-prefixed formats like "Daily Market Wrap-Up | Wed, 7 Jan"
        try {
          const pipeParsed = parsePipePrefixedDelimiter(headingText);
          if (pipeParsed?.date) {
            isEntryDelimiter = true;
            entryDate = pipeParsed.date;
            entryTitle = pipeParsed.title;
          }
        } catch (e) {
          // Continue to other strategies
        }

        if (isEntryDelimiter) {
          // delimiter found by pipe parsing
        } else {
        // Try universal date parser (handles many formats)
        try {
          const parsed = parseDateFromText(headingText);
          if (parsed?.date) {
            isEntryDelimiter = true;
            entryDate = parsed.date;
            // If the delimiter is just a date header like "Thu, 1 Jan", don't label it "Untitled".
            // Use the original heading text as the fallback title so the page never shows "Untitled".
            entryTitle = (parsed.title && parsed.title !== 'Untitled') ? parsed.title : headingText.trim();
          }
        } catch (e) {
          console.warn(`Warning: Error parsing heading delimiter "${headingText.substring(0, 50)}":`, e.message);
        }
        }
      }
    } else if (type === 'paragraph') {
      // Check paragraphs for date-like patterns
      // More flexible - doesn't require "DAILY DIVIDEND |" prefix
      const paraText = extractPlainText(block.paragraph?.rich_text || []);
      
      // Check if it starts with "DAILY DIVIDEND |" or "Daily Market Wrap-Up |"
      if (/^\s*(?:DAILY\s+DIVIDEND|DAILY\s+MARKET\s+WRAP(?:\s*[-–—]?\s*UP)?)\s*\|/i.test(paraText)) {
        try {
          // Reuse the delimiter parser which supports both prefixes.
          const parsed = parseDailyDividendDelimiter(paraText);
          if (parsed?.date) {
            isEntryDelimiter = true;
            entryDate = parsed.date;
            // If this line is ONLY date (common), use the most recent heading above it as the title.
            // Otherwise fall back to the paragraph.
            if (parsed.title && parsed.title !== 'Untitled') {
              entryTitle = parsed.title;
            } else if (pendingTitleFromHeading) {
              entryTitle = pendingTitleFromHeading;
            } else {
              entryTitle = paraText.trim();
            }
          }
        } catch (e) {
          console.warn(`Warning: Error parsing paragraph delimiter "${paraText.substring(0, 50)}":`, e.message);
        }
      } else {
        // Also check if paragraph contains a date pattern (more flexible)
        // Only treat as delimiter if it's short and date-like (to avoid false positives)
        if (paraText.length < 100) {
          try {
            const parsed = parseDateFromText(paraText);
            if (parsed?.date) {
              isEntryDelimiter = true;
              entryDate = parsed.date;
              // Same fallback behavior as headings
              entryTitle = (parsed.title && parsed.title !== 'Untitled') ? parsed.title : paraText.trim();
            }
          } catch (e) {
            // Silently continue - not every paragraph needs to be a delimiter
          }
        }
      }
    }
    
    if (isEntryDelimiter) {
      // Save previous entry if exists
      if (currentEntry) {
        // Close any open list
        if (inList && listItems.length > 0) {
          const listTag = listType === 'numbered_list_item' ? '<ol>' : '<ul>';
          currentBlocks.push(listTag + listItems.join('') + (listType === 'numbered_list_item' ? '</ol>' : '</ul>'));
          listItems = [];
          inList = false;
        }
        
        currentEntry.html = currentBlocks.join('\n');
        entries.push(currentEntry);
      }
      
      // Start new entry
      currentEntry = {
        date: entryDate,
        title: entryTitle || 'Untitled',
        html: '',
      };
      currentBlocks = [];
      inList = false;
      listItems = [];
      didPromoteTitleFromContent = false;
      pendingTitleFromHeading = '';
      
      // Include delimiter block in content if it's a paragraph (not H2)
      if (type === 'paragraph') {
        const html = renderBlock(block);
        if (html) {
          currentBlocks.push(html);
        }
      }
      // For H2 delimiters, skip including them in content
      continue;
    } else if (currentEntry) {
      // If the Notion format uses a separate heading for the real "headline",
      // promote the first non-date heading inside the entry to be the entry title.
      if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
        const headingText = extractPlainText(block[type]?.rich_text || []).trim();
        if (shouldPromoteTitleFromBlock(headingText)) {
          currentEntry.title = headingText;
          didPromoteTitleFromContent = true;
          // Do NOT include this heading in the body to avoid duplicating the headline.
          continue;
        }
      }

      // Handle list items (group consecutive list items)
      if (type === 'bulleted_list_item' || type === 'numbered_list_item') {
        const newListType = type;
        
        if (inList && listType !== newListType) {
          // Different list type, close previous list
          const listTag = listType === 'numbered_list_item' ? '<ol>' : '<ul>';
          currentBlocks.push(listTag + listItems.join('') + (listType === 'numbered_list_item' ? '</ol>' : '</ul>'));
          listItems = [];
        }
        
        inList = true;
        listType = newListType;
        listItems.push(renderBlock(block));
      } else {
        // Close any open list
        if (inList && listItems.length > 0) {
          const listTag = listType === 'numbered_list_item' ? '<ol>' : '<ul>';
          currentBlocks.push(listTag + listItems.join('') + (listType === 'numbered_list_item' ? '</ol>' : '</ul>'));
          listItems = [];
          inList = false;
        }
        
        const html = renderBlock(block);
        if (html) {
          currentBlocks.push(html);
        }
      }
    }
  }
  
  // Save last entry
  if (currentEntry) {
    // Close any open list
    if (inList && listItems.length > 0) {
      const listTag = listType === 'numbered_list_item' ? '<ol>' : '<ul>';
      currentBlocks.push(listTag + listItems.join('') + (listType === 'numbered_list_item' ? '</ol>' : '</ul>'));
    }
    
    currentEntry.html = currentBlocks.join('\n');
    entries.push(currentEntry);
  }
  
  return entries;
}

/**
 * Generate excerpt from HTML (first 180 chars of plain text)
 */
function generateExcerpt(html) {
  // Remove HTML tags and get plain text
  const plainText = html.replace(/<[^>]*>/g, '').trim();
  if (plainText.length <= 180) return plainText;
  return plainText.substring(0, 177) + '...';
}

/**
 * Main sync function
 */
async function sync() {
  try {
    console.log('Fetching blocks from Notion...');
    const blocks = await getAllBlocks(NOTION_PAGE_ID);
    console.log(`Fetched ${blocks.length} blocks`);
    
    console.log('Parsing entries...');
    const entries = parseEntries(blocks);
    console.log(`Found ${entries.length} entries`);
    
    // Debug: Show first few blocks to help diagnose format issues
    if (entries.length === 0 && blocks.length > 0) {
      console.log('\n=== DEBUG: First 5 blocks ===');
      for (let i = 0; i < Math.min(5, blocks.length); i++) {
        const block = blocks[i];
        const type = block.type;
        let text = '';
        if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
          text = extractPlainText(block[type]?.rich_text || []);
        } else if (type === 'paragraph') {
          text = extractPlainText(block.paragraph?.rich_text || []);
        }
        console.log(`${i + 1}. Type: ${type}, Text: "${text.substring(0, 100)}"`);
      }
      console.log('=== End Debug ===\n');
    }
    
    if (DRY_RUN) {
      console.log('\n=== DRY RUN MODE - Parsed Entries ===');
      if (entries.length === 0) {
        console.log('No entries found.');
      } else {
        entries.forEach((entry, idx) => {
          console.log(`${idx + 1}. Date: ${entry.date} | Title: ${entry.title}`);
        });
      }
      console.log('=== End Dry Run ===\n');
      return;
    }
    
    if (entries.length === 0) {
      console.error('No entries parsed from Notion. This is usually a formatting/delimiter mismatch.');
      console.error('The sync will skip updating files to avoid breaking the site.');
      console.error('If you want the workflow to fail hard on this, set STRICT_SYNC=true.');
      if (STRICT_SYNC) {
        process.exit(1);
      }
      return;
    }
    
    // Sort entries by date (newest first)
    entries.sort((a, b) => b.date.localeCompare(a.date));
    
    // Generate individual entry files
    for (const entry of entries) {
      const excerpt = generateExcerpt(entry.html);
      const entryData = {
        date: entry.date,
        title: entry.title,
        html: entry.html,
      };
      
      const filePath = join(dataDir, `${entry.date}.json`);
      await writeJsonFileAtomic(filePath, entryData);
      console.log(`Wrote ${filePath}`);
    }
    
    // Generate index.json
    const latest = entries[0];
    const indexData = {
      latest: {
        date: latest.date,
        title: latest.title,
        excerpt: generateExcerpt(latest.html),
        path: `post.html?date=${latest.date}`,
      },
      entries: entries.map(entry => ({
        date: entry.date,
        title: entry.title,
        excerpt: generateExcerpt(entry.html),
        path: `post.html?date=${entry.date}`,
      })),
    };
    
    const indexPath = join(dataDir, 'index.json');
    await writeJsonFileAtomic(indexPath, indexData);
    console.log(`Wrote ${indexPath}`);
    
    console.log('Sync completed successfully!');
  } catch (error) {
    console.error('Error syncing from Notion:', error.message);
    console.error('Stack:', error.stack);
    if (error.response) {
      console.error('Notion API Response:', JSON.stringify(error.response, null, 2));
    }
    console.error('The sync will skip updating files to avoid breaking the site.');
    console.error('If you want the workflow to fail hard on this, set STRICT_SYNC=true.');
    if (STRICT_SYNC) {
      process.exit(1);
    }
    return;
  }
}

sync();

