/**
 * Stage 8 — Table of Contents Unit & Invariant Test Suite
 */

import assert from 'assert';
import {
  buildTableOfContentsData,
  renderTableOfContentsHTML
} from '../frontend/js/table-of-contents.js';
import { paginateBook } from '../frontend/js/pagination.js';

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

const mockBookContent = {
  id: 'frankenstein',
  title: 'Frankenstein',
  author: 'Mary Wollstonecraft Shelley',
  chapters: [
    {
      number: 1,
      title: 'Letter I',
      content: 'To Mrs. Saville, England. St. Petersburgh, Dec. 11th, 17—.\n\nYou will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings.'
    },
    {
      number: 2,
      title: 'Letter II',
      content: 'To Mrs. Saville, England. Archangel, 28th March, 17—.\n\nHow slowly the time passes here, encompassed as I am by frost and snow!'
    },
    {
      number: 3,
      title: 'Chapter I',
      content: 'I am by birth a Genevese, and my family is one of the most distinguished of that republic. My ancestors had been for many years counsellors and syndics.'
    },
    {
      number: 4,
      title: 'Chapter II',
      content: 'We were brought up together; there was not quite a year difference between our ages. I need not say that we were strangers to any species of disunion or dispute.'
    }
  ]
};

console.log('================ TABLE OF CONTENTS TEST SUITE ================');

// -------------------------------------------------------------
// 1. Book with Chapters Structure
// -------------------------------------------------------------
console.log('\n--- 1. Book with Chapters ---');
it('Extracts all chapters with title, author, and book metadata', () => {
  const pagination = paginateBook(mockBookContent, 'md');
  const toc = buildTableOfContentsData(mockBookContent, pagination, 1);

  assert.strictEqual(toc.bookId, 'frankenstein');
  assert.strictEqual(toc.bookTitle, 'Frankenstein');
  assert.strictEqual(toc.author, 'Mary Wollstonecraft Shelley');
  assert.strictEqual(toc.chapters.length, 4);
});

// -------------------------------------------------------------
// 2. Chapter Ordering
// -------------------------------------------------------------
console.log('\n--- 2. Chapter Ordering ---');
it('Maintains strict chapter order identical to source book content', () => {
  const pagination = paginateBook(mockBookContent, 'md');
  const toc = buildTableOfContentsData(mockBookContent, pagination, 1);

  assert.strictEqual(toc.chapters[0].chapterNumber, 1);
  assert.strictEqual(toc.chapters[1].chapterNumber, 2);
  assert.strictEqual(toc.chapters[2].chapterNumber, 3);
  assert.strictEqual(toc.chapters[3].chapterNumber, 4);
});

// -------------------------------------------------------------
// 3. Chapter Titles
// -------------------------------------------------------------
console.log('\n--- 3. Chapter Titles ---');
it('Preserves chapter titles and formats chapter numbers', () => {
  const pagination = paginateBook(mockBookContent, 'md');
  const toc = buildTableOfContentsData(mockBookContent, pagination, 1);

  assert.strictEqual(toc.chapters[0].chapterTitle, 'Letter I');
  assert.strictEqual(toc.chapters[0].formattedNumber, '01');
  assert.strictEqual(toc.chapters[2].chapterTitle, 'Chapter I');
  assert.strictEqual(toc.chapters[2].formattedNumber, '03');
});

// -------------------------------------------------------------
// 4. First-Page Mapping & Pagination Consistency
// -------------------------------------------------------------
console.log('\n--- 4. First-Page Mapping & Pagination Consistency ---');
it('Maps first page of each chapter strictly to pagination.getFirstPageOfChapter', () => {
  const pagination = paginateBook(mockBookContent, 'md');
  const toc = buildTableOfContentsData(mockBookContent, pagination, 1);

  for (const ch of toc.chapters) {
    const expectedFirstPage = pagination.getFirstPageOfChapter(ch.chapterNumber);
    assert.strictEqual(ch.firstPageNumber, expectedFirstPage);
    assert.ok(ch.firstPageNumber >= 1);
    assert.ok(ch.firstPageNumber <= pagination.totalPages);
  }
});

// -------------------------------------------------------------
// 5. Current Chapter Indicator
// -------------------------------------------------------------
console.log('\n--- 5. Current Chapter Indicator ---');
it('Sets isCurrent = true exclusively on the active reading chapter', () => {
  const pagination = paginateBook(mockBookContent, 'md');
  const toc = buildTableOfContentsData(mockBookContent, pagination, 3);

  assert.strictEqual(toc.chapters[0].isCurrent, false);
  assert.strictEqual(toc.chapters[1].isCurrent, false);
  assert.strictEqual(toc.chapters[2].isCurrent, true); // Chapter 3
  assert.strictEqual(toc.chapters[3].isCurrent, false);
});

// -------------------------------------------------------------
// 6. Navigation Targets Validity
// -------------------------------------------------------------
console.log('\n--- 6. Navigation Targets ---');
it('Provides valid numeric page numbers for each chapter button', () => {
  const pagination = paginateBook(mockBookContent, 'md');
  const toc = buildTableOfContentsData(mockBookContent, pagination, 2);

  for (const ch of toc.chapters) {
    assert.strictEqual(typeof ch.firstPageNumber, 'number');
    assert.ok(Number.isInteger(ch.firstPageNumber));
  }
});

// -------------------------------------------------------------
// 7. Invalid Chapter Handling
// -------------------------------------------------------------
console.log('\n--- 7. Invalid Chapter Handling ---');
it('Gracefully handles non-existent current chapter number without error', () => {
  const pagination = paginateBook(mockBookContent, 'md');
  const toc = buildTableOfContentsData(mockBookContent, pagination, 999);

  assert.strictEqual(toc.chapters.length, 4);
  const activeCount = toc.chapters.filter((c) => c.isCurrent).length;
  assert.strictEqual(activeCount, 0);
});

// -------------------------------------------------------------
// 8. Empty & Nil Content Handling
// -------------------------------------------------------------
console.log('\n--- 8. Empty Content Handling ---');
it('Returns empty chapters list for empty or null content safely', () => {
  const emptyToc1 = buildTableOfContentsData(null, null, 1);
  assert.strictEqual(emptyToc1.chapters.length, 0);

  const emptyToc2 = buildTableOfContentsData({ id: 'empty', chapters: [] }, null, 1);
  assert.strictEqual(emptyToc2.chapters.length, 0);
});

// -------------------------------------------------------------
// 9. Duplicate Chapters Deduplication
// -------------------------------------------------------------
console.log('\n--- 9. Duplicate Chapters Deduplication ---');
it('Safely ignores duplicate chapter numbers in malformed book content', () => {
  const malformed = {
    id: 'test',
    title: 'Test',
    chapters: [
      { number: 1, title: 'Chapter 1', content: 'Text 1' },
      { number: 1, title: 'Chapter 1 Dupe', content: 'Text 1 dupe' },
      { number: 2, title: 'Chapter 2', content: 'Text 2' }
    ]
  };

  const pagination = paginateBook(malformed, 'md');
  const toc = buildTableOfContentsData(malformed, pagination, 1);
  assert.strictEqual(toc.chapters.length, 2);
  assert.strictEqual(toc.chapters[0].chapterNumber, 1);
  assert.strictEqual(toc.chapters[1].chapterNumber, 2);
});

// -------------------------------------------------------------
// 10. UI Renderer Markup
// -------------------------------------------------------------
console.log('\n--- 10. UI Renderer Markup ---');
it('Renders typeset book furniture markup with dotted leaders and folios', () => {
  const pagination = paginateBook(mockBookContent, 'md');
  const toc = buildTableOfContentsData(mockBookContent, pagination, 3);
  const html = renderTableOfContentsHTML(toc);

  assert.ok(html.includes('toc-modal-backdrop'));
  assert.ok(html.includes('toc-modal-paper'));
  assert.ok(html.includes('toc-main-heading'));
  assert.ok(html.includes('Contents'));
  assert.ok(html.includes('toc-leader-dots'));
  assert.ok(html.includes('data-action="jump-chapter"'));
  assert.ok(html.includes('data-chapter-number="3"'));
  assert.ok(html.includes('toc-current-marker'));
  assert.ok(html.includes('← current'));
});

// -------------------------------------------------------------
// 11. Deterministic Output
// -------------------------------------------------------------
console.log('\n--- 11. Deterministic Output ---');
it('Produces 100% byte-for-byte identical output across repeated runs', () => {
  const pagination = paginateBook(mockBookContent, 'md');
  const run1 = JSON.stringify(buildTableOfContentsData(mockBookContent, pagination, 2));
  const run2 = JSON.stringify(buildTableOfContentsData(mockBookContent, pagination, 2));
  assert.strictEqual(run1, run2);
});

console.log('\n================ TEST SUMMARY ================');
console.log(`Passed: ${passedTests} | Failed: ${failedTests}`);

if (failedTests > 0) {
  process.exit(1);
}
