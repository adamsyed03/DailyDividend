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
 * Parse date from "DAILY DIVIDEND | Tue, Dec 23" format
 * Returns ISO date string (YYYY-MM-DD) or null if parsing fails
 */
function parseDailyDividendDate(text) {
  // Match patterns like "DAILY DIVIDEND | Tue, Dec 23" or "DAILY DIVIDEND | Tue, Dec 23, 2025"
  const match = text.match(/DAILY DIVIDEND\s*\|\s*([A-Za-z]{3}),\s*([A-Za-z]{3})\s+(\d{1,2})(?:,\s*(\d{4}))?/i);
  if (!match) return null;
  
  const [, dayName, monthName, day, year] = match;
  const currentYear = new Date().getFullYear();
  const targetYear = year ? parseInt(year) : currentYear;
  
  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };
  
  const monthIndex = monthMap[monthName.toLowerCase().substring(0, 3)];
  if (monthIndex === undefined) return null;
  
  const dayNum = parseInt(day);
  if (isNaN(dayNum)) return null;
  
  try {
    const date = new Date(targetYear, monthIndex, dayNum);
    // Validate the date is correct (handles invalid dates like Feb 30)
    if (date.getFullYear() !== targetYear || date.getMonth() !== monthIndex || date.getDate() !== dayNum) {
      return null;
    }
    
    // Format as YYYY-MM-DD
    const yearStr = date.getFullYear().toString();
    const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = date.getDate().toString().padStart(2, '0');
    return `${yearStr}-${monthStr}-${dayStr}`;
  } catch (e) {
    return null;
  }
}

/**
 * Extract title from "DAILY DIVIDEND | Tue, Dec 23 Title text here" format
 */
function extractTitleFromDailyDividend(text) {
  // Remove the "DAILY DIVIDEND | Date" part and get the rest as title
  const match = text.match(/DAILY DIVIDEND\s*\|\s*[A-Za-z]{3},\s*[A-Za-z]{3}\s+\d{1,2}(?:,\s*\d{4})?\s*(.+)/i);
  return match ? match[1].trim() : '';
}

/**
 * Get all blocks from a Notion page (handles pagination)
 */
async function getAllBlocks(blockId) {
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
 * Parse entries from blocks (separated by H2 blocks or DAILY DIVIDEND paragraphs)
 */
function parseEntries(blocks) {
  const entries = [];
  let currentEntry = null;
  let currentBlocks = [];
  let inList = false;
  let listType = null;
  let listItems = [];
  let hasH2Blocks = false;
  
  // First pass: check if we have any H2 blocks
  for (const block of blocks) {
    if (block.type === 'heading_2') {
      hasH2Blocks = true;
      break;
    }
  }
  
  for (const block of blocks) {
    const type = block.type;
    let isEntryDelimiter = false;
    let entryDate = null;
    let entryTitle = null;
    
    // Check if this is a heading_2 block (entry separator)
    if (type === 'heading_2') {
      const h2Text = extractPlainText(block.heading_2?.rich_text || []);
      
      // Try format 1: YYYY-MM-DD — Title
      const match1 = h2Text.match(/^(\d{4}-\d{2}-\d{2})\s*—\s*(.+)$/);
      if (match1) {
        isEntryDelimiter = true;
        entryDate = match1[1];
        entryTitle = match1[2];
      } else {
        // Try format 2: DAILY DIVIDEND | Tue, Dec 23 Title
        const parsedDate = parseDailyDividendDate(h2Text);
        if (parsedDate) {
          isEntryDelimiter = true;
          entryDate = parsedDate;
          entryTitle = extractTitleFromDailyDividend(h2Text) || h2Text.replace(/DAILY DIVIDEND\s*\|\s*[A-Za-z]{3},\s*[A-Za-z]{3}\s+\d{1,2}(?:,\s*\d{4})?\s*/i, '').trim();
        }
      }
    } else if (type === 'paragraph' && !hasH2Blocks) {
      // Fallback: treat paragraph lines starting with "DAILY DIVIDEND |" as delimiters
      const paraText = extractPlainText(block.paragraph?.rich_text || []);
      if (paraText.trim().toUpperCase().startsWith('DAILY DIVIDEND |')) {
        const parsedDate = parseDailyDividendDate(paraText);
        if (parsedDate) {
          isEntryDelimiter = true;
          entryDate = parsedDate;
          entryTitle = extractTitleFromDailyDividend(paraText) || paraText.replace(/DAILY DIVIDEND\s*\|\s*[A-Za-z]{3},\s*[A-Za-z]{3}\s+\d{1,2}(?:,\s*\d{4})?\s*/i, '').trim();
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
      console.error('  2. Heading 2: "DAILY DIVIDEND | Tue, Dec 23 Title"');
      console.error('  3. Paragraph (if no H2): "DAILY DIVIDEND | Tue, Dec 23 Title"');
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
    console.error('Error syncing from Notion:', error);
    process.exit(1);
  }
}

sync();

