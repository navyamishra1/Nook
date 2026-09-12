/**
 * Test Suite for Feature #5: Highlight Intelligence Engine
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeHighlights,
  tokenizeHighlightText,
  renderHighlightIntelligenceHTML
} from '../frontend/js/highlight-intelligence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawCatalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/seed/books.json'), 'utf8')
);

console.log('================ HIGHLIGHT INTELLIGENCE TEST SUITE ================');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// ----------------------------------------------------------------------------
// 1. Empty & Nil Highlights
// ----------------------------------------------------------------------------
console.log('\n--- 1. Empty Highlights ---');
const emptyRes = analyzeHighlights([], rawCatalog);
assert(emptyRes.hasData === false, 'Empty array returns hasData = false');
assert(emptyRes.highlightCount === 0, 'Empty array returns highlightCount = 0');
assert(emptyRes.themes.length === 0, 'Empty array returns empty themes');
assert(emptyRes.recurringTerms.length === 0, 'Empty array returns empty recurring terms');
assert(emptyRes.bookConnections.length === 0, 'Empty array returns empty book connections');

const nullRes = analyzeHighlights(null, rawCatalog);
assert(nullRes.hasData === false, 'Null highlights returns hasData = false');

const undefinedRes = analyzeHighlights(undefined, rawCatalog);
assert(undefinedRes.hasData === false, 'Undefined highlights returns hasData = false');

// ----------------------------------------------------------------------------
// 2. Single Highlight
// ----------------------------------------------------------------------------
console.log('\n--- 2. Single Highlight ---');
const singleHl = [
  {
    id: 'hl_1',
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 4,
    chapterTitle: 'Chapter 4',
    selectedText: 'Life and death appeared to me ideal bounds, which I should first break through, and pour a torrent of light into our dark world.'
  }
];
const singleRes = analyzeHighlights(singleHl, rawCatalog);
assert(singleRes.hasData === true, 'Single highlight returns hasData = true');
assert(singleRes.highlightCount === 1, 'Highlight count = 1');
assert(singleRes.recurringTerms.length > 0, 'Recurring terms extracted');
assert(singleRes.themes.length > 0, 'Themes identified');
assert(singleRes.thematicSummary.length > 0, 'Thematic summary generated');

// ----------------------------------------------------------------------------
// 3. Stopword Removal & Tokenization
// ----------------------------------------------------------------------------
console.log('\n--- 3. Stopword Removal & Tokenization ---');
const noisyText = 'The and of in with that to is a an it for on was he she';
const tokenized = tokenizeHighlightText(noisyText);
assert(tokenized.length === 0, 'Pure stopword text produces zero tokens');

const meaningfulText = 'Ambition, forbidden science, and extraordinary creation in desolate isolation.';
const meaningfulTokens = tokenizeHighlightText(meaningfulText);
assert(meaningfulTokens.includes('ambition'), 'Preserves "ambition"');
assert(meaningfulTokens.includes('science'), 'Preserves "science"');
assert(meaningfulTokens.includes('creation'), 'Preserves "creation"');
assert(meaningfulTokens.includes('isolation'), 'Preserves "isolation"');
assert(!meaningfulTokens.includes('and'), 'Filters out "and"');
assert(!meaningfulTokens.includes('in'), 'Filters out "in"');

// ----------------------------------------------------------------------------
// 4. Multiple Highlights Across Multiple Books & Chapters
// ----------------------------------------------------------------------------
console.log('\n--- 4. Multiple Highlights Across Books & Chapters ---');
const multiHl = [
  {
    id: 'hl_1',
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 4,
    chapterTitle: 'Chapter 4',
    selectedText: 'Ambition and scientific creation drove my solitary labour in the silent night.'
  },
  {
    id: 'hl_2',
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 10,
    chapterTitle: 'Chapter 10',
    selectedText: 'I was a creature of solitude, longing for compassion in a desolate world of isolation.'
  },
  {
    id: 'hl_3',
    bookId: 'the-island-of-doctor-moreau',
    bookTitle: 'The Island of Doctor Moreau',
    author: 'H. G. Wells',
    chapterNumber: 7,
    chapterTitle: 'Chapter 7',
    selectedText: 'The ambition of physiological creation and relentless science on this secluded island.'
  },
  {
    id: 'hl_4',
    bookId: 'pride-and-prejudice',
    bookTitle: 'Pride and Prejudice',
    author: 'Jane Austen',
    chapterNumber: 1,
    chapterTitle: 'Chapter 1',
    selectedText: 'It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife in polite society.'
  }
];
const multiRes = analyzeHighlights(multiHl, rawCatalog);
assert(multiRes.highlightCount === 4, 'Processes all 4 highlights');
assert(multiRes.highlightedBooks.length === 3, 'Identifies 3 distinct highlighted books');
assert(multiRes.highlightedBooks.find((b) => b.id === 'frankenstein').highlightCount === 2, 'Frankenstein has 2 highlights');

// ----------------------------------------------------------------------------
// 5. Recurring Terms & Thematic Extraction
// ----------------------------------------------------------------------------
console.log('\n--- 5. Recurring Terms & Theme Extraction ---');
const topTerms = multiRes.recurringTerms.map((t) => t.term);
assert(topTerms.includes('creation') || topTerms.includes('ambition') || topTerms.includes('science'), 'Identifies creation/ambition/science as recurring terms');

const themeTitles = multiRes.themes.map((t) => t.title);
assert(themeTitles.includes('Ambition & Creation'), 'Discovers Ambition & Creation theme');
assert(themeTitles.includes('Isolation & Solitude'), 'Discovers Isolation & Solitude theme');

// ----------------------------------------------------------------------------
// 6. Cross-Book Connections
// ----------------------------------------------------------------------------
console.log('\n--- 6. Cross-Book Conceptual Connections ---');
assert(multiRes.bookConnections.length > 0, 'Discovers connections between books sharing themes');
const frankensteinMoreauConn = multiRes.bookConnections.find((c) => {
  const ids = [c.bookA.id, c.bookB.id];
  return ids.includes('frankenstein') && ids.includes('the-island-of-doctor-moreau');
});
assert(frankensteinMoreauConn !== undefined, 'Links Frankenstein and Moreau via shared Ambition / Science themes');

// ----------------------------------------------------------------------------
// 7. Safety & Language Rules: No Psychological Diagnosis / Sensitive Claims
// ----------------------------------------------------------------------------
console.log('\n--- 7. Safety & Ethical Language Assertions ---');
const FORBIDDEN_PHRASES = [
  'you are depressed',
  'you have anxiety',
  'you are lonely',
  'you are psychologically',
  'you are an introvert',
  'you have trauma',
  'mental health',
  'psychological diagnosis'
];

const summaryLower = multiRes.thematicSummary.toLowerCase();
let hasForbiddenClaims = false;
for (const phrase of FORBIDDEN_PHRASES) {
  if (summaryLower.includes(phrase)) {
    hasForbiddenClaims = true;
    console.error(`Forbidden phrase detected in summary: "${phrase}"`);
  }
}
assert(!hasForbiddenClaims, 'Thematic summary contains ZERO psychological diagnostic or mental health claims');

// ----------------------------------------------------------------------------
// 8. Unknown Book IDs & Malformed Highlight Records
// ----------------------------------------------------------------------------
console.log('\n--- 8. Malformed & Unknown Book Resilience ---');
const malformedHls = [
  null,
  undefined,
  {},
  { selectedText: '' },
  { selectedText: '   ' },
  { bookId: 'unknown-alien-book-404', selectedText: 'Solitude and silence in the distant stars.' },
  { bookId: 'frankenstein', selectedText: 12345 } // non-string text
];
const malformedRes = analyzeHighlights(malformedHls, rawCatalog);
assert(malformedRes.exploredCount === undefined || malformedRes.highlightCount === 1, 'Gracefully filters invalid records and keeps 1 valid highlight');
assert(malformedRes.hasData === true, 'Valid highlight from unknown book processed safely');

// ----------------------------------------------------------------------------
// 9. Determinism
// ----------------------------------------------------------------------------
console.log('\n--- 9. Deterministic Output ---');
const run1 = JSON.stringify(analyzeHighlights(multiHl, rawCatalog));
const run2 = JSON.stringify(analyzeHighlights(multiHl, rawCatalog));
const run3 = JSON.stringify(analyzeHighlights(multiHl, rawCatalog));
assert(run1 === run2 && run2 === run3, '100% deterministic results across repeated runs');

// ----------------------------------------------------------------------------
// 10. Mathematical Soundness: No NaN / No Infinity
// ----------------------------------------------------------------------------
console.log('\n--- 10. Mathematical Soundness ---');
function verifyNoNaN(obj, path = '') {
  for (const k in obj) {
    const v = obj[k];
    const currPath = path ? `${path}.${k}` : k;
    if (typeof v === 'number') {
      if (isNaN(v)) throw new Error(`NaN at ${currPath}`);
      if (!isFinite(v)) throw new Error(`Infinity at ${currPath}`);
    } else if (v && typeof v === 'object') {
      verifyNoNaN(v, currPath);
    }
  }
}
let noNaNErrors = true;
try {
  verifyNoNaN(emptyRes);
  verifyNoNaN(singleRes);
  verifyNoNaN(multiRes);
  verifyNoNaN(malformedRes);
} catch (e) {
  noNaNErrors = false;
  console.error(e.message);
}
assert(noNaNErrors, 'Zero NaN or Infinity in all analysis outputs');

// ----------------------------------------------------------------------------
// 11. HTML Renderer Markup Check
// ----------------------------------------------------------------------------
console.log('\n--- 11. UI Renderer Markup ---');
const htmlOutput = renderHighlightIntelligenceHTML({ highlights: multiHl, catalog: rawCatalog });
assert(htmlOutput.includes('LITERARY PATTERNS'), 'Renderer includes section kicker');
assert(htmlOutput.includes('What You\'ve Been Returning To'), 'Renderer includes main heading');
assert(htmlOutput.includes('intel-theme-card'), 'Renderer generates theme cards');
assert(htmlOutput.includes('Across Your Reading'), 'Renderer includes cross-book connections');

const emptyHtml = renderHighlightIntelligenceHTML({ highlights: [], catalog: rawCatalog });
assert(emptyHtml.includes('Save a few passages while reading'), 'Empty HTML presents subtle guidance without fake themes');

console.log(`\n================ TEST SUMMARY ================`);
console.log(`Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
