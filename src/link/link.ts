// ─────────────────────────────────────────────────────────────────────────────
// ingest/link.ts  —  Scrape a URL and ingest it into a user's knowledge base
// ─────────────────────────────────────────────────────────────────────────────
//
// FLOW:
//   URL (string)
//     → fetch the HTML with axios
//     → parse HTML and extract clean text with Cheerio
//     → split into chunks
//     → embed and store in Pinecone
//     → save metadata in PostgreSQL
//
// WHY CHEERIO?
// ────────────
// Raw HTML is full of noise: nav bars, footers, ads, script tags, CSS.
// Cheerio lets us parse the HTML like jQuery and pull out just the meaningful
// content (headings, paragraphs, article text).
//
// Cheerio is a server-side HTML parser — no browser needed.
// It's much lighter than Puppeteer (which launches a real browser).
// Good for: blogs, docs, news articles, Wikipedia.
// Not good for: JavaScript-rendered SPAs (use Puppeteer for those).

import axios from 'axios';
import * as cheerio from 'cheerio';
import db from '../db';
import { chunkText } from '../chunker';
import { addDocumentsForUser } from '../vector-store';

// ── Extract clean text from HTML ─────────────────────────────────────────────
// This is the core of the scraper. We use Cheerio's jQuery-like API
// to navigate the HTML and pull out only the meaningful text.
function extractTextFromHTML(
  html: string,
  url: string
): { text: string; title: string } {
  // Load the HTML into Cheerio (like document.querySelector but in Node.js)
  const $ = cheerio.load(html);

  // ── Remove elements that are never useful ────────────────────────────────
  // This dramatically reduces noise in the extracted text.
  $(
    'script, style, nav, footer, header, aside, ' + // structural noise
      '.advertisement, .ads, .cookie-banner, ' // marketing noise
  ).remove();

  // ── Get the page title ───────────────────────────────────────────────────
  // Try <title>, then <h1>, then fall back to the URL
  const title =
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    new URL(url).hostname;

  // ── Extract main content ─────────────────────────────────────────────────
  // Try to find the main content area in order of preference:
  // article > main > .content > .post > body
  let contentElement = $(
    "article, main, [role='main'], .content, .post-content, .entry-content"
  ).first();

  // Fall back to body if none of the above match
  if (!contentElement.length) {
    contentElement = $('body');
  }

  // Extract text from all headings and paragraphs inside the content element
  // .contents() gets all child nodes (text nodes + elements)
  const textParts: string[] = [];

  contentElement
    .find('h1, h2, h3, h4, h5, h6, p, li, td, blockquote')
    .each((_, el) => {
      const text = $(el).text().trim();

      // Skip very short strings (likely decorative or nav items)
      if (text.length > 20) {
        // Add a newline before headings for better chunk boundaries
        const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(
          el.tagName
        );
        if (isHeading) textParts.push('\n\n' + text + '\n');
        else textParts.push(text);
      }
    });

  const text = textParts
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, title };
}

// ── Main function ─────────────────────────────────────────────────────────────
export async function ingestLink(
  userId: string,
  url: string
): Promise<{ resourceId: string; chunkCount: number }> {
  console.log(`\n🔗 Ingesting URL: "${url}" for user ${userId}`);

  // ── Step 1: Validate the URL ──────────────────────────────────────────────
  // This throws if the URL is malformed
  new URL(url);

  // ── Step 2: Fetch the page ────────────────────────────────────────────────
  let html: string;
  try {
    const response = await axios.get(url, {
      headers: {
        // Pretend to be a browser so sites don't block us
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 15000, // 15 seconds max
      maxContentLength: 5 * 1024 * 1024, // 5 MB max
    });
    html = response.data;
  } catch (error: any) {
    throw new Error(`Failed to fetch URL: ${error.message}`);
  }

  // ── Step 3: Extract clean text ────────────────────────────────────────────
  const { text, title } = extractTextFromHTML(html, url);

  if (!text || text.length < 100) {
    throw new Error(
      'Could not extract enough text from this page. ' +
        'It may be a JavaScript-heavy SPA or behind a login wall.'
    );
  }

  console.log(`  Extracted ${text.length} characters. Title: "${title}"`);

  // ── Step 4: Save to Postgres ──────────────────────────────────────────────
  const resource = await db.resource.create({
    data: {
      userId: userId,
      title: title,
      type: 'LINK',
      sourceUrl: url,
      chunkCount: 0,
    },
  });

  // ── Step 5: Chunk, embed, store in Pinecone ───────────────────────────────
  const chunks = await chunkText(text, {
    resourceId: resource.id,
    userId: userId,
    source: url,
    title: title,
    type: 'LINK',
  });

  await addDocumentsForUser(userId, chunks);

  await db.resource.update({
    where: { id: resource.id },
    data: { chunkCount: chunks.length },
  });

  console.log(`  ✅ Link ingested: "${title}" → ${chunks.length} chunks`);

  return { resourceId: resource.id, chunkCount: chunks.length };
}
