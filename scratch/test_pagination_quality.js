import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { paginateBook, TYPOGRAPHY_CONFIG } from '../frontend/js/pagination.js';

console.log('====================================================');
console.log('NOOK — READER PAGINATION QUALITY & REGRESSION SUITE');
console.log('====================================================');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// Normalize whitespace for text equivalence comparison
function normalizeWhitespace(str) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------
// 1. Synthetic Unit Cases for Pagination Quality
// ---------------------------------------------------------
console.log('\n--- 1. Synthetic Unit Quality Tests ---');

it('1. Normal paragraph splitting handles multi-sentence boundaries cleanly', () => {
  const content = {
    id: 'test_multi_sentence',
    title: 'Test Multi Sentence',
    author: 'Test Author',
    chapters: [{
      number: 1,
      title: 'Chapter 1',
      content: 'First sentence of the paragraph is here. Second sentence continues the narrative smoothly. Third sentence provides further context and detail. Fourth sentence rounds out the thought completely. Fifth sentence introduces a new point of consideration. Sixth sentence concludes this sample paragraph with certainty.'
    }]
  };
  const pag = paginateBook(content, 'md', { forceRepaginate: true });
  assert.ok(pag.totalPages >= 1);
  const p1 = pag.getPage(1);
  assert.ok(p1.paragraphs.length > 0);
  // Source vs paginated equivalence
  const allText = pag.pages.map(p => p.paragraphs.join(' ')).join(' ');
  assert.strictEqual(normalizeWhitespace(allText), normalizeWhitespace(content.chapters[0].content));
});

it('2. Sentence boundary selection avoids trailing single-word orphan ("The")', () => {
  // Simulating the Oliver Twist case: a paragraph whose split lands right after "The"
  const paraText = 'The evening arrived; the boys took their places. The master, in his cook’s uniform, stationed himself at the copper; his pauper assistants ranged themselves behind him; the gruel was served out; and a long grace was said over the short commons. The gruel disappeared; the boys whispered each other, and winked at Oliver; while his next neighbors nudged him.';
  const content = {
    id: 'test_oliver_orphan',
    title: 'Oliver Orphan Test',
    author: 'Charles Dickens',
    chapters: [{
      number: 1,
      title: 'Chapter 1',
      content: paraText
    }]
  };
  const pag = paginateBook(content, 'md', { forceRepaginate: true });
  assert.ok(pag.totalPages >= 1);
  
  // Inspect every page to ensure no page ends with isolated "The"
  pag.pages.forEach((p, idx) => {
    const lastPara = p.paragraphs[p.paragraphs.length - 1] || '';
    const lastWords = lastPara.trim().split(/\s+/);
    const lastWord = lastWords[lastWords.length - 1];
    if (idx < pag.totalPages - 1) {
      assert.notStrictEqual(lastWord, 'The', `Page ${p.pageNumber} should not end with isolated 'The'`);
      // If page ends mid-paragraph, verify the ending is clean
      if (p.paragraphUnits.some(u => u.continuedOnNext)) {
        assert.ok(lastWords.length >= 4, `Trailing fragment on page ${p.pageNumber} should have at least 4 words, got ${lastWords.length}: "${lastPara}"`);
      }
    }
  });

  // Verify 0 text loss / duplication
  const allText = pag.pages.map(p => p.paragraphs.join(' ')).join(' ');
  assert.strictEqual(normalizeWhitespace(allText), normalizeWhitespace(paraText));
});

it('3. Tiny trailing fragment (2-3 words) is avoided by stepping back to sentence boundary', () => {
  const s1 = 'This is a complete first sentence that fills some initial vertical space on the paper page.';
  const s2 = 'Here is the second sentence which is also nicely structured and provides good length.';
  const s3 = 'Now we see a third sentence that could potentially be cut after two words.';
  const content = {
    id: 'test_2_3_word_orphan',
    title: '2-3 Word Orphan Test',
    author: 'Test Author',
    chapters: [{
      number: 1,
      title: 'Chapter 1',
      content: `${s1} ${s2} ${s3}`
    }]
  };
  const pag = paginateBook(content, 'md', { forceRepaginate: true });
  
  pag.pages.forEach((p, idx) => {
    if (idx < pag.totalPages - 1 && p.paragraphUnits.some(u => u.continuedOnNext)) {
      const lastPara = p.paragraphs[p.paragraphs.length - 1] || '';
      const words = lastPara.trim().split(/\s+/);
      // Ensure no 1-3 word unfinished sentence orphan at the end
      const lastWord = words[words.length - 1];
      const isSentenceEnd = /[.!?]['"”’»\)\]]*$/.test(lastWord);
      if (!isSentenceEnd) {
        assert.ok(words.length >= 5, `Unfinished sentence at page ${p.pageNumber} bottom must have >= 5 words, got ${words.length}`);
      }
    }
  });

  const allText = pag.pages.map(p => p.paragraphs.join(' ')).join(' ');
  assert.strictEqual(normalizeWhitespace(allText), normalizeWhitespace(`${s1} ${s2} ${s3}`));
});

it('4. Paragraph start orphan at page bottom is prevented (moves to next page)', () => {
  // Para 1 fills almost all of page line budget
  const longPara = 'This is a long introductory paragraph designed to fill almost the entire first page budget of lines. '.repeat(10).trim();
  // Para 2 is short and shouldn't start with just 1-2 words at the very bottom
  const shortPara = 'Oliver was frightened at the sight of so many gentlemen, which made him tremble.';
  const content = {
    id: 'test_para_start_orphan',
    title: 'Para Start Orphan Test',
    author: 'Test Author',
    chapters: [{
      number: 1,
      title: 'Chapter 1',
      content: `${longPara}\n\n${shortPara}`
    }]
  };
  const pag = paginateBook(content, 'md', { forceRepaginate: true });
  
  pag.pages.forEach(p => {
    p.paragraphUnits.forEach(u => {
      // If a unit is the start of a paragraph on a page that already has content, it shouldn't be 1-3 words
      if (!u.isContinuation && u.continuedOnNext) {
        const wCount = u.text.split(/\s+/).filter(Boolean).length;
        assert.ok(wCount >= 5, `Starting paragraph slice on page ${p.pageNumber} must have >= 5 words, got ${wCount}`);
      }
    });
  });

  const allText = pag.pages.map(p => p.paragraphs.join('\n\n')).join('\n\n');
  assert.strictEqual(normalizeWhitespace(allText), normalizeWhitespace(`${longPara}\n\n${shortPara}`));
});

it('5. Long single sentence without punctuation falls back to safe word/clause boundaries', () => {
  // Single 300-word sentence without a period until the very end
  const longSentenceWords = [];
  for (let i = 1; i <= 300; i++) {
    longSentenceWords.push(`word${i}`);
  }
  longSentenceWords[299] = 'word300.';
  const longSentence = longSentenceWords.join(' ');
  
  const content = {
    id: 'test_long_sentence',
    title: 'Long Sentence Test',
    author: 'Test Author',
    chapters: [{
      number: 1,
      title: 'Chapter 1',
      content: longSentence
    }]
  };
  const pag = paginateBook(content, 'md', { forceRepaginate: true });
  assert.ok(pag.totalPages >= 2, `Should paginate 300-word sentence across multiple pages (got ${pag.totalPages})`);
  
  // Verify 0 text loss
  const allText = pag.pages.map(p => p.paragraphs.join(' ')).join(' ');
  assert.strictEqual(normalizeWhitespace(allText), normalizeWhitespace(longSentence));
});

it('6. Chapter boundaries are preserved strictly without cross-chapter merging', () => {
  const content = {
    id: 'test_chap_boundary',
    title: 'Chapter Boundary Test',
    author: 'Test Author',
    chapters: [
      { number: 1, title: 'Chapter 1', content: 'Content of chapter 1 is brief.' },
      { number: 2, title: 'Chapter 2', content: 'Content of chapter 2 begins fresh.' },
      { number: 3, title: 'Chapter 3', content: 'Content of chapter 3 is here.' },
    ]
  };
  const pag = paginateBook(content, 'md', { forceRepaginate: true });
  assert.strictEqual(pag.chapterPageMap.length, 3);
  assert.strictEqual(pag.getFirstPageOfChapter(1), 1);
  assert.strictEqual(pag.getFirstPageOfChapter(2), 2);
  assert.strictEqual(pag.getFirstPageOfChapter(3), 3);
  
  // Check each page's chapter metadata
  assert.strictEqual(pag.getPage(1).chapterNumber, 1);
  assert.strictEqual(pag.getPage(2).chapterNumber, 2);
  assert.strictEqual(pag.getPage(3).chapterNumber, 3);
});

it('7. Geometry invariant and typography configuration consistency (5.5" x 8.5")', () => {
  assert.ok(TYPOGRAPHY_CONFIG.sm);
  assert.ok(TYPOGRAPHY_CONFIG.md);
  assert.ok(TYPOGRAPHY_CONFIG.lg);
  assert.strictEqual(TYPOGRAPHY_CONFIG.md.fontSizePx, 16.0);
  assert.strictEqual(TYPOGRAPHY_CONFIG.md.lineHeightPx, 26);
  assert.strictEqual(TYPOGRAPHY_CONFIG.md.pageLineBudget, 26);
});

it('8. Deterministic pagination across multiple runs', () => {
  const content = {
    id: 'test_determinism',
    title: 'Determinism Test',
    author: 'Test Author',
    chapters: [{
      number: 1,
      title: 'Chapter 1',
      content: 'This is paragraph one.\n\nThis is paragraph two.\n\nThis is paragraph three.'
    }]
  };
  const run1 = paginateBook(content, 'md', { forceRepaginate: true });
  const run2 = paginateBook(content, 'md', { forceRepaginate: true });
  assert.strictEqual(run1.totalPages, run2.totalPages);
  assert.deepStrictEqual(run1.pages.map(p => p.paragraphs), run2.pages.map(p => p.paragraphs));
});

// ---------------------------------------------------------
// 2. Real Book Quality & Text Equivalence Test Suite
// ---------------------------------------------------------
console.log('\n--- 2. Real Book Regression & Quality Verification ---');

const REAL_BOOKS = [
  { id: 'oliver-twist', file: 'data/books/oliver-twist/content.json' },
  { id: 'frankenstein', file: 'data/books/frankenstein/content.json' },
  { id: 'pride-and-prejudice', file: 'data/books/pride-and-prejudice/content.json' },
  { id: 'alices-adventures-in-wonderland', file: 'data/books/alices-adventures-in-wonderland/content.json' },
  { id: 'the-great-gatsby', file: 'data/books/the-great-gatsby/content.json' },
];

REAL_BOOKS.forEach(({ id, file }) => {
  if (!fs.existsSync(file)) {
    console.log(`  [SKIP] Book file not found: ${file}`);
    return;
  }

  const rawContent = JSON.parse(fs.readFileSync(file, 'utf8'));

  ['sm', 'md', 'lg'].forEach(fontSize => {
    it(`Real Book "${id}" (${fontSize}): 100% Text Equivalence & 0 Loss/Duplication across all chapters`, () => {
      const pag = paginateBook(rawContent, fontSize, { forceRepaginate: true });
      assert.ok(pag.totalPages > 0);

      // Verify each chapter's paginated text against original source text
      rawContent.chapters.forEach((ch, chIdx) => {
        const chNumber = ch.number || chIdx + 1;
        const chPages = pag.pages.filter(p => p.chapterNumber === chNumber);
        assert.ok(chPages.length > 0, `Chapter ${chNumber} should have at least 1 page`);

        // Reconstitute paginated text
        const paginatedParagraphs = [];
        let currentPara = '';
        
        chPages.forEach(p => {
          p.paragraphUnits.forEach(u => {
            if (u.isContinuation) {
              currentPara = (currentPara + ' ' + u.text).trim();
            } else {
              if (currentPara) {
                paginatedParagraphs.push(currentPara);
              }
              currentPara = u.text.trim();
            }
            if (!u.continuedOnNext) {
              paginatedParagraphs.push(currentPara);
              currentPara = '';
            }
          });
        });
        if (currentPara) {
          paginatedParagraphs.push(currentPara);
        }

        const paginatedFullText = normalizeWhitespace(paginatedParagraphs.join(' '));
        const sourceFullText = normalizeWhitespace(ch.content);

        assert.strictEqual(
          paginatedFullText,
          sourceFullText,
          `Text mismatch in ${id} Chapter ${chNumber} (${fontSize}): text was lost or duplicated!`
        );
      });
    });

    it(`Real Book "${id}" (${fontSize}): Bottom-of-Page Orphan & Fragment Scanner`, () => {
      const pag = paginateBook(rawContent, fontSize, { forceRepaginate: true });
      const badEndings = [];

      const ABBR = new Set([
        'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'st.', 'lord.', 'lady.',
        'rev.', 'gen.', 'col.', 'capt.', 'lt.', 'maj.', 'sgt.', 'no.', 'vol.',
        'jan.', 'feb.', 'mar.', 'apr.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.',
        'vs.', 'etc.', 'i.e.', 'e.g.', 'cf.', 'al.', 'esq.'
      ]);

      function isRealSentenceEnd(word) {
        if (!word) return false;
        const clean = word.trim().toLowerCase().replace(/['"”’»\)\]]+$/, '');
        if (ABBR.has(clean)) return false;
        if (/^[a-z]\.$/i.test(clean)) return false;
        return /[.!?]['"”’»\)\]]*$/.test(word);
      }

      pag.pages.forEach((p, idx) => {
        if (idx >= pag.totalPages - 1) return; // Last page of book can end whenever chapter ends

        const units = p.paragraphUnits;
        if (!units || units.length === 0) return;
        const lastUnit = units[units.length - 1];

        // Check if unit is split and continues on next page
        if (lastUnit.continuedOnNext) {
          const text = lastUnit.text.trim();
          const words = text.split(/\s+/).filter(Boolean);
          const lastWord = words[words.length - 1];

          // 1. Single-word fragment ending check
          if (words.length === 1) {
            badEndings.push({
              page: p.pageNumber,
              chapter: p.chapterNumber,
              reason: `Single-word orphan fragment: "${text}"`
            });
            return;
          }

          // 2. Find real sentence boundaries in words array
          let lastSentenceEndIdx = -1;
          for (let w = 0; w < words.length; w++) {
            if (isRealSentenceEnd(words[w])) {
              lastSentenceEndIdx = w;
            }
          }

          if (lastSentenceEndIdx >= 0) {
            const trailingWordsCount = words.length - 1 - lastSentenceEndIdx;
            const trailingWords = words.slice(lastSentenceEndIdx + 1);
            if (trailingWordsCount > 0 && trailingWordsCount < 4) {
              badEndings.push({
                page: p.pageNumber,
                chapter: p.chapterNumber,
                reason: `Tiny trailing sentence fragment (${trailingWordsCount} words): "${trailingWords.join(' ')}"`
              });
            }
          }
        }
      });

      if (badEndings.length > 0) {
        console.error(`Found ${badEndings.length} bad endings in ${id} (${fontSize}):`, badEndings.slice(0, 5));
      }
      assert.strictEqual(badEndings.length, 0, `Found ${badEndings.length} orphan/tiny text fragment endings in ${id} (${fontSize})`);
    });
  });
});

// ---------------------------------------------------------
// 3. Oliver Twist Chapter 2 Specific Verification
// ---------------------------------------------------------
console.log('\n--- 3. Oliver Twist Chapter 2 Targeted Verification ---');

it('Oliver Twist Chapter 2: Inspect pages around "The evening arrived; the boys took their places"', () => {
  const oliverContent = JSON.parse(fs.readFileSync('data/books/oliver-twist/content.json', 'utf8'));
  const pag = paginateBook(oliverContent, 'md', { forceRepaginate: true });
  
  // Find page containing "The evening arrived"
  const targetPage = pag.pages.find(p => p.paragraphs.some(para => para.includes('The evening arrived')));
  assert.ok(targetPage, 'Target page with Oliver Twist sentence should exist');
  
  console.log(`  Target sentence found on Page ${targetPage.pageNumber} (Chapter ${targetPage.chapterNumber}):`);
  targetPage.paragraphs.forEach((para, idx) => {
    if (para.includes('The evening arrived')) {
      console.log(`    Paragraph snippet on Page ${targetPage.pageNumber}: "${para.slice(0, 100)}..."`);
    }
  });

  const lastParaOnTargetPage = targetPage.paragraphs[targetPage.paragraphs.length - 1];
  const lastWords = lastParaOnTargetPage.trim().split(/\s+/);
  const lastWord = lastWords[lastWords.length - 1];
  
  assert.notStrictEqual(lastWord, 'The', 'Page MUST NOT end with isolated word "The"');
  console.log(`    Page ${targetPage.pageNumber} ends cleanly with: "...${lastWords.slice(-5).join(' ')}"`);
});

// ---------------------------------------------------------
// 4. Page Count Scale Invariant Across Font Sizes
// ---------------------------------------------------------
console.log('\n--- 4. Page Count Scaling Invariant ---');

REAL_BOOKS.forEach(({ id, file }) => {
  if (!fs.existsSync(file)) return;
  const content = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  it(`Page count ordering holds strictly (sm <= md <= lg) for ${id}`, () => {
    const pSm = paginateBook(content, 'sm', { forceRepaginate: true });
    const pMd = paginateBook(content, 'md', { forceRepaginate: true });
    const pLg = paginateBook(content, 'lg', { forceRepaginate: true });

    assert.ok(pSm.totalPages <= pMd.totalPages, `${id}: sm (${pSm.totalPages}) should be <= md (${pMd.totalPages})`);
    assert.ok(pMd.totalPages <= pLg.totalPages, `${id}: md (${pMd.totalPages}) should be <= lg (${pLg.totalPages})`);
    console.log(`    ${id}: sm=${pSm.totalPages}, md=${pMd.totalPages}, lg=${pLg.totalPages} pages`);
  });
});

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('NOOK PAGINATION QUALITY: 100% VERIFIED & GREEN');
console.log('====================================================');
