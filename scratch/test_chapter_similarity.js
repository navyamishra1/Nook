/**
 * Test Suite for Feature #6: Chapter-Level Similarity Engine
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  tokenizeChapterText,
  buildChapterVector,
  computeVectorSimilarity,
  indexBookChapters,
  findSimilarChapters,
  clearChapterCache
} from '../frontend/js/chapter-similarity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawCatalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/seed/books.json'), 'utf8')
);

// Helper to load content.json from disk for test environment
function loadTestContent(bookId) {
  const filePath = path.join(__dirname, `../data/books/${bookId}/content.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

console.log('================ CHAPTER-LEVEL SIMILARITY TEST SUITE ================');

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

async function runTests() {
  clearChapterCache();

  // Pre-load a small set of contents for fast, deterministic unit testing
  const frankensteinContent = loadTestContent('frankenstein');
  const moreauContent = loadTestContent('the-island-of-doctor-moreau');
  const jekyllContent = loadTestContent('the-strange-case-of-dr-jekyll-and-mr-hyde');
  const prideContent = loadTestContent('pride-and-prejudice');

  const candidateContents = [
    frankensteinContent,
    moreauContent,
    jekyllContent,
    prideContent
  ].filter(Boolean);

  // ----------------------------------------------------------------------------
  // 1. Vector Building & Similarity
  // ----------------------------------------------------------------------------
  console.log('\n--- 1. Vector Representation & Similarity Math ---');
  const tokensA = ['science', 'creation', 'ambition', 'experiment'];
  const tokensB = ['science', 'experiment', 'creation', 'monsters'];
  const tokensC = ['marriage', 'fortune', 'society', 'estate'];

  const vecA = buildChapterVector(tokensA);
  const vecB = buildChapterVector(tokensB);
  const vecC = buildChapterVector(tokensC);

  const simAB = computeVectorSimilarity(vecA, vecB);
  const simAC = computeVectorSimilarity(vecA, vecC);

  assert(simAB > 0.5, `High similarity between science chapters: ${simAB.toFixed(4)}`);
  assert(simAC === 0, 'Zero similarity between orthogonal science and romance vectors');

  // ----------------------------------------------------------------------------
  // 2. Valid Chapter Search
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Valid Chapter Similarity Search ---');
  // Frankenstein Chapter 4 (creation of monster)
  const frankResult = await findSimilarChapters('frankenstein', 4, {
    catalog: rawCatalog,
    contentData: frankensteinContent,
    candidateContents,
    limit: 3,
    minSimilarity: 0.02,
    excludeSameBook: true
  });

  assert(frankResult.sourceChapter !== null, 'Source chapter resolved');
  assert(frankResult.sourceChapter.bookId === 'frankenstein', 'Source bookId is frankenstein');
  assert(frankResult.sourceChapter.chapterNumber === 4, 'Source chapter number is 4');
  assert(frankResult.results.length > 0, `Returns ${frankResult.results.length} related chapters`);
  assert(frankResult.results[0].bookId !== 'frankenstein', 'Top result is from a different book (e.g. Moreau or Jekyll)');

  // ----------------------------------------------------------------------------
  // 3. Invalid Book & Invalid Chapter Handling
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Invalid Book & Invalid Chapter Resilience ---');
  const invalidBookRes = await findSimilarChapters('non-existent-book-999', 1, {
    catalog: rawCatalog,
    candidateContents
  });
  assert(invalidBookRes.sourceChapter === null, 'Invalid book returns sourceChapter = null');
  assert(invalidBookRes.results.length === 0, 'Invalid book returns empty results');

  const invalidChapRes = await findSimilarChapters('frankenstein', 9999, {
    catalog: rawCatalog,
    contentData: frankensteinContent,
    candidateContents
  });
  assert(invalidChapRes.results.length === 0, 'Invalid chapter number returns empty results');

  // ----------------------------------------------------------------------------
  // 4. Current Chapter Excluded
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Current Chapter Excluded ---');
  const selfExcludedRes = await findSimilarChapters('frankenstein', 4, {
    catalog: rawCatalog,
    contentData: frankensteinContent,
    candidateContents,
    excludeSameBook: false
  });
  const hasExactSelf = selfExcludedRes.results.some((r) => r.bookId === 'frankenstein' && r.chapterNumber === 4);
  assert(!hasExactSelf, 'Current chapter is never returned as similar to itself');

  // ----------------------------------------------------------------------------
  // 5. Same-Book Exclusion Toggle
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Same-Book Exclusion Toggle ---');
  const excludeSameBookTrue = await findSimilarChapters('frankenstein', 4, {
    catalog: rawCatalog,
    contentData: frankensteinContent,
    candidateContents,
    excludeSameBook: true
  });
  const anyFrankensteinInTrue = excludeSameBookTrue.results.some((r) => r.bookId === 'frankenstein');
  assert(!anyFrankensteinInTrue, 'excludeSameBook: true filters out all Frankenstein chapters');

  const excludeSameBookFalse = await findSimilarChapters('frankenstein', 4, {
    catalog: rawCatalog,
    contentData: frankensteinContent,
    candidateContents,
    excludeSameBook: false
  });
  const anyFrankensteinInFalse = excludeSameBookFalse.results.some((r) => r.bookId === 'frankenstein');
  assert(anyFrankensteinInFalse, 'excludeSameBook: false allows other chapters from same book');

  // ----------------------------------------------------------------------------
  // 6. Similarity Ordering & Deterministic Ranking
  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Similarity Ordering & Determinism ---');
  let isSorted = true;
  for (let i = 1; i < frankResult.results.length; i++) {
    if (frankResult.results[i].similarity > frankResult.results[i - 1].similarity) {
      isSorted = false;
    }
  }
  assert(isSorted, 'Results are strictly sorted by similarity descending');

  const runA = JSON.stringify(await findSimilarChapters('frankenstein', 4, {
    catalog: rawCatalog,
    contentData: frankensteinContent,
    candidateContents
  }));
  const runB = JSON.stringify(await findSimilarChapters('frankenstein', 4, {
    catalog: rawCatalog,
    contentData: frankensteinContent,
    candidateContents
  }));
  assert(runA === runB, '100% deterministic ranking across repeated executions');

  // ----------------------------------------------------------------------------
  // 7. Empty Chapter Resilience
  // ----------------------------------------------------------------------------
  console.log('\n--- 7. Empty Chapter Resilience ---');
  const dummyEmptyContent = {
    id: 'empty-book',
    title: 'Empty Book',
    chapters: [
      { number: 1, title: 'Blank Chapter', content: '    ' }
    ]
  };
  const emptyChapRes = await findSimilarChapters('empty-book', 1, {
    catalog: rawCatalog,
    contentData: dummyEmptyContent,
    candidateContents
  });
  assert(emptyChapRes.results.length === 0, 'Empty chapter content safely produces zero matches without throwing');

  // ----------------------------------------------------------------------------
  // 8. Result Limits
  // ----------------------------------------------------------------------------
  console.log('\n--- 8. Result Limit Parameter ---');
  const limit1Res = await findSimilarChapters('frankenstein', 4, {
    catalog: rawCatalog,
    contentData: frankensteinContent,
    candidateContents,
    limit: 1,
    minSimilarity: 0.01
  });
  assert(limit1Res.results.length <= 1, 'Respects limit = 1');

  const limit2Res = await findSimilarChapters('frankenstein', 4, {
    catalog: rawCatalog,
    contentData: frankensteinContent,
    candidateContents,
    limit: 2,
    minSimilarity: 0.01
  });
  assert(limit2Res.results.length <= 2, 'Respects limit = 2');

  // ----------------------------------------------------------------------------
  // 9. No Duplicate Results
  // ----------------------------------------------------------------------------
  console.log('\n--- 9. No Duplicate Results ---');
  const keys = new Set();
  let hasDuplicates = false;
  for (const r of frankResult.results) {
    const k = `${r.bookId}_${r.chapterNumber}`;
    if (keys.has(k)) hasDuplicates = true;
    keys.add(k);
  }
  assert(!hasDuplicates, 'Zero duplicate chapter results returned');

  // ----------------------------------------------------------------------------
  // 10. Performance & Indexing Sanity Check
  // ----------------------------------------------------------------------------
  console.log('\n--- 10. Performance Sanity Check ---');
  const start = performance.now();
  for (let i = 0; i < 20; i++) {
    await findSimilarChapters('frankenstein', 4, {
      catalog: rawCatalog,
      contentData: frankensteinContent,
      candidateContents,
      limit: 3
    });
  }
  const duration = performance.now() - start;
  const avgMs = duration / 20;
  console.log(`  Cached chapter query average: ${avgMs.toFixed(3)} ms`);
  assert(avgMs < 5.0, `Blazing fast in-memory similarity lookup (< 5ms avg, actual: ${avgMs.toFixed(3)} ms)`);

  console.log(`\n================ TEST SUMMARY ================`);
  console.log(`Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
