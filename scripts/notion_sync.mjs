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

if (!NOTION_TOKEN || !NOTION_PAGE_ID) {
  console.error('Error: NOTION_TOKEN and NOTION_PAGE_ID must be set');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const dataDir = join(rootDir, 'data', 'daily');
const DRY_RUN = process.env.DRY_RUN === 'true';

// Ensure data directory exists
await fs.mkdir(dataDir, { recursive: true });

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
 * Parse "DAILY DIVIDEND | ..." headings/paragraph delimiters.
 *
 * Supports common variants:
 * - DAILY DIVIDEND | Tue, Dec 23 Title
 * - DAILY DIVIDEND | Tue Dec 23 Title
 * - DAILY DIVIDEND | Tuesday, December 23, 2025 Title
 * - DAILY DIVIDEND | 12/23/2025 Title
 *
 * Returns { date: 'YYYY-MM-DD', title: string } or null.
 */
function parseDailyDividendDelimiter(text) {
  const raw = (text || '').trim();
  const prefixMatch = raw.match(/^\s*DAILY\s+DIVIDEND\s*\|\s*(.+)$/i);
  if (!prefixMatch) return null;

  const remainder = prefixMatch[1].trim();
  const currentYear = new Date().getFullYear();

  // Also allow ISO date anywhere after the prefix: "DAILY DIVIDEND | 2025-12-23 — Title"
  {
    const m = remainder.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s*[—-]\s*(.*))?$/);
    if (m) {
      const yearNum = parseInt(m[1], 10);
      const monthNum = parseInt(m[2], 10);
      const dayNum = parseInt(m[3], 10);
      const iso = toIsoDate(yearNum, monthNum - 1, dayNum);
      if (iso) return { date: iso, title: (m[4] || '').trim() };
    }
  }

  const monthMap = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  // Month-name format (optionally preceded by day-of-week, with flexible commas/periods)
  // Examples:
  // "Tue, Dec 23 Title"
  // "Tue Dec 23 Title"
  // "Tuesday, December 23, 2025 Title"
  // "Thu, 1 Jan Title" (day before month format)
  {
    // Try "Day Month" format first (e.g., "Thu, 1 Jan")
    const m1 = remainder.match(
      /^(?:[A-Za-z]{3,9}[.,]?\s*)?,?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?(?:,\s*(\d{4}))?\s*(.*)$/i
    );
    if (m1) {
      const monthKey = m1[2].toLowerCase().replace('.', '');
      const monthIndex = monthMap[monthKey];
      const dayNum = parseInt(m1[1], 10);
      const yearNum = m1[3] ? parseInt(m1[3], 10) : currentYear;
      const iso = toIsoDate(yearNum, monthIndex, dayNum);
      if (iso) return { date: iso, title: (m1[4] || '').trim() };
    }
    
    // Try "Month Day" format (e.g., "Tue, Dec 23 Title")
    const m2 = remainder.match(
      /^(?:[A-Za-z]{3,9}[.,]?\s*)?,?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?\s*(.*)$/i
    );
    if (m2) {
      const monthKey = m2[1].toLowerCase().replace('.', '');
      const monthIndex = monthMap[monthKey];
      const dayNum = parseInt(m2[2], 10);
      const yearNum = m2[3] ? parseInt(m2[3], 10) : currentYear;
      const iso = toIsoDate(yearNum, monthIndex, dayNum);
      if (iso) return { date: iso, title: (m2[4] || '').trim() };
    }
  }

  // Numeric format (assume MM/DD[/YYYY] or MM-DD[-YYYY]), optionally preceded by day-of-week
  // Example: "12/23/2025 Title"
  {
    const m = remainder.match(/^(?:[A-Za-z]{3,9}[.,]?\s*)?,?\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\s*(.*)$/);
    if (m) {
      const monthNum = parseInt(m[1], 10);
      const dayNum = parseInt(m[2], 10);
      let yearNum = m[3] ? parseInt(m[3], 10) : currentYear;
      if (m[3] && m[3].length === 2) yearNum = 2000 + yearNum;
      const iso = toIsoDate(yearNum, monthNum - 1, dayNum);
      if (iso) return { date: iso, title: (m[4] || '').trim() };
    }
  }

  return null;
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
  
  // First pass: check if we have any heading delimiters we can parse
  for (const block of blocks) {
    if (block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3') {
      const rich = block[block.type]?.rich_text || [];
      const text = extractPlainText(rich);
      const isIso = /^\d{4}-\d{2}-\d{2}\s*—\s*.+$/.test(text);
      const isDaily = /^\s*DAILY\s+DIVIDEND\s*\|/i.test(text) && !!parseDailyDividendDelimiter(text);
      if (isIso || isDaily) {
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
    if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
      const headingText = extractPlainText(block[type]?.rich_text || []);
      
      // Try format 1: YYYY-MM-DD — Title
      const match1 = headingText.match(/^(\d{4}-\d{2}-\d{2})\s*—\s*(.+)$/);
      if (match1) {
        isEntryDelimiter = true;
        entryDate = match1[1];
        entryTitle = match1[2];
      } else {
        // Try format 2: DAILY DIVIDEND | ... (many variants)
        const parsed = parseDailyDividendDelimiter(headingText);
        if (parsed?.date) {
          isEntryDelimiter = true;
          entryDate = parsed.date;
          entryTitle = parsed.title || 'Untitled';
        }
      }
    } else if (type === 'paragraph') {
      // Check paragraphs for "DAILY DIVIDEND |" delimiters
      // This works both as fallback (when no heading delimiters) and as primary (when in paragraph format)
      const paraText = extractPlainText(block.paragraph?.rich_text || []);
      if (/^\s*DAILY\s+DIVIDEND\s*\|/i.test(paraText)) {
        const parsed = parseDailyDividendDelimiter(paraText);
        if (parsed?.date) {
          isEntryDelimiter = true;
          entryDate = parsed.date;
          entryTitle = parsed.title || 'Untitled';
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
      console.error('No entries parsed from Notion. Check heading format or delimiter rules.');
      console.error('Expected formats:');
      console.error('  1. Heading 2: "YYYY-MM-DD — Title"');
      console.error('  2. Heading 2: "DAILY DIVIDEND | Tue, Dec 23 Title" or "DAILY DIVIDEND | Thu, 1 Jan Title"');
      console.error('  3. Paragraph: "DAILY DIVIDEND | Tue, Dec 23 Title" or "DAILY DIVIDEND | Thu, 1 Jan Title"');
      process.exit(1);
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
      await fs.writeFile(filePath, JSON.stringify(entryData, null, 2), 'utf-8');
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
    await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
    console.log(`Wrote ${indexPath}`);
    
    console.log('Sync completed successfully!');
  } catch (error) {
    console.error('Error syncing from Notion:', error.message);
    console.error('Stack:', error.stack);
    if (error.response) {
      console.error('Notion API Response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

sync();

