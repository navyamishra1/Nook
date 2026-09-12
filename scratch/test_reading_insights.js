/**
 * Test Suite for Feature #4: Reading Insights Data Layer
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeReadingInsights,
  formatDuration,
  formatWordCount,
  formatEditorialDate
} from '../frontend/js/reading-insights.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawCatalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/seed/books.json'), 'utf8')
);

console.log('================ READING INSIGHTS TEST SUITE ================');

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
// 1. Empty History & Edge Inputs
// ----------------------------------------------------------------------------
console.log('\n--- 1. Empty & Nil History Handling ---');
const emptyEmpty = computeReadingInsights(rawCatalog, []);
assert(emptyEmpty.hasData === false, 'Empty array returns hasData = false');
assert(emptyEmpty.exploredCount === 0, 'Empty array returns exploredCount = 0');
assert(emptyEmpty.completionRate === null, 'Empty array returns completionRate = null (no fake 0%)');
assert(emptyEmpty.categoryDistribution.length === 0, 'Empty array returns empty categoryDistribution');
assert(emptyEmpty.shortestBook === null, 'Empty array returns shortestBook = null');
assert(emptyEmpty.longestBook === null, 'Empty array returns longestBook = null');
assert(emptyEmpty.averageBookLength === null, 'Empty array returns averageBookLength = null');

const nullHistory = computeReadingInsights(rawCatalog, null);
assert(nullHistory.hasData === false, 'Null history returns hasData = false');
assert(nullHistory.completionRate === null, 'Null history returns completionRate = null');

const undefinedHistory = computeReadingInsights(rawCatalog, undefined);
assert(undefinedHistory.hasData === false, 'Undefined history returns hasData = false');

const nullCatalog = computeReadingInsights(null, [{ bookId: 'frankenstein', progressPercent: 50 }]);
assert(nullCatalog.hasData === false, 'Null catalog handled safely without crash');

// ----------------------------------------------------------------------------
// 2. One Active Book
// ----------------------------------------------------------------------------
console.log('\n--- 2. Single Active Book ---');
const singleActiveHistory = [
  {
    bookId: 'pride-and-prejudice',
    progressPercent: 35,
    chapterNumber: 2,
    chapterTitle: 'Chapter 2',
    lastAccessedAt: 1789056000000
  }
];
const singleActive = computeReadingInsights(rawCatalog, singleActiveHistory);
assert(singleActive.hasData === true, 'Single active book hasData = true');
assert(singleActive.exploredCount === 1, 'Explored count = 1');
assert(singleActive.currentlyReadingCount === 1, 'Currently reading count = 1');
assert(singleActive.completedCount === 0, 'Completed count = 0');
assert(singleActive.completionRate === 0, 'Completion rate = 0.0');
assert(singleActive.shortestBook.id === 'pride-and-prejudice', 'Shortest book is the active book');
assert(singleActive.longestBook.id === 'pride-and-prejudice', 'Longest book is the active book');
assert(singleActive.averageBookLength.averageWordCount === 121497, 'Average word count matches book');
assert(singleActive.averageBookLength.averageReadingTimeMinutes === 540, 'Average reading time matches book (540 mins)');
assert(singleActive.recentBooks.length === 1, 'Recent books has 1 entry');
assert(singleActive.recentBooks[0].progressPercent === 35, 'Recent book records correct progress');
assert(singleActive.recentBooks[0].isCompleted === false, 'Recent book is not completed');

// ----------------------------------------------------------------------------
// 3. One Completed Book (>= 90%)
// ----------------------------------------------------------------------------
console.log('\n--- 3. Single Completed Book ---');
const singleCompletedHistory = [
  {
    bookId: 'frankenstein',
    progressPercent: 95,
    chapterNumber: 24,
    chapterTitle: 'Chapter 24',
    lastAccessedAt: 1789057000000
  }
];
const singleCompleted = computeReadingInsights(rawCatalog, singleCompletedHistory);
assert(singleCompleted.exploredCount === 1, 'Explored count = 1');
assert(singleCompleted.currentlyReadingCount === 0, 'Currently reading count = 0');
assert(singleCompleted.completedCount === 1, 'Completed count = 1');
assert(singleCompleted.completionRate === 1.0, 'Completion rate = 1.0 (100%)');
assert(singleCompleted.recentBooks[0].isCompleted === true, 'isCompleted is true for 95% progress');

// ----------------------------------------------------------------------------
// 4. Multiple Books (Active & Completed)
// ----------------------------------------------------------------------------
console.log('\n--- 4. Multiple Books (Active & Completed) ---');
const multiHistory = [
  {
    bookId: 'pride-and-prejudice', // wc: 121497, ert: 540
    progressPercent: 100,
    lastAccessedAt: 1789056000000
  },
  {
    bookId: 'frankenstein', // wc: 77682, ert: 346
    progressPercent: 92,
    lastAccessedAt: 1789057000000
  },
  {
    bookId: 'the-metamorphosis', // wc: 21810, ert: 97
    progressPercent: 40,
    lastAccessedAt: 1789058000000
  },
  {
    bookId: 'dracula', // wc: 161603, ert: 719
    progressPercent: 15,
    lastAccessedAt: 1789059000000
  }
];
const multi = computeReadingInsights(rawCatalog, multiHistory);
assert(multi.exploredCount === 4, 'Explored count = 4');
assert(multi.completedCount === 2, 'Completed count = 2 (Pride & Prejudice, Frankenstein)');
assert(multi.currentlyReadingCount === 2, 'Currently reading count = 2 (Metamorphosis, Dracula)');
assert(multi.completionRate === 0.5, 'Completion rate = 0.5 (50%)');

// ----------------------------------------------------------------------------
// 5. Category Distribution & Deterministic Sorting
// ----------------------------------------------------------------------------
console.log('\n--- 5. Category Distribution ---');
assert(multi.categoryDistribution.length > 0, 'Category distribution is populated');
// Verify categories are sorted count desc, then name asc
let isCatSorted = true;
for (let i = 1; i < multi.categoryDistribution.length; i++) {
  const prev = multi.categoryDistribution[i - 1];
  const curr = multi.categoryDistribution[i];
  if (prev.count < curr.count) {
    isCatSorted = false;
  } else if (prev.count === curr.count && prev.category.localeCompare(curr.category) > 0) {
    isCatSorted = false;
  }
}
assert(isCatSorted, 'Category distribution is deterministically sorted by count desc, then name asc');
// Classics is in Pride & Prejudice, Frankenstein, Metamorphosis, Dracula
const classicsItem = multi.categoryDistribution.find((c) => c.category === 'Classics');
assert(classicsItem && classicsItem.count === 4, 'Classics count = 4 across all 4 explored books');
assert(typeof classicsItem.percentage === 'number' && classicsItem.percentage > 0, 'Category percentage is a valid positive number');

// ----------------------------------------------------------------------------
// 6. Duplicate History Records Deduplication
// ----------------------------------------------------------------------------
console.log('\n--- 6. Duplicate History Deduplication ---');
const duplicateHistory = [
  {
    bookId: 'frankenstein',
    progressPercent: 20,
    lastAccessedAt: 1789051000000
  },
  {
    bookId: 'frankenstein',
    progressPercent: 95,
    lastAccessedAt: 1789059000000
  }
];
const deduplicated = computeReadingInsights(rawCatalog, duplicateHistory);
assert(deduplicated.exploredCount === 1, 'Duplicate records for same book collapsed to 1 explored book');
assert(deduplicated.completedCount === 1, 'Duplicate uses latest progress (95% -> completed)');
assert(deduplicated.recentBooks[0].progressPercent === 95, 'Latest progress preserved');

// ----------------------------------------------------------------------------
// 7. Unknown Book IDs & Malformed Records
// ----------------------------------------------------------------------------
console.log('\n--- 7. Unknown Books & Malformed Records ---');
const malformedHistory = [
  null,
  undefined,
  {},
  { bookId: 'non-existent-alien-book-9999', progressPercent: 50 },
  { bookId: 'frankenstein', progressPercent: 'invalid', lastAccessedAt: 'not-a-number' },
  { bookId: 'dracula', progressPercent: 120 } // clamps to 100
];
const malformedResult = computeReadingInsights(rawCatalog, malformedHistory);
assert(malformedResult.exploredCount === 2, 'Filters out nulls and unknown book IDs (keeps frankenstein and dracula)');
assert(malformedResult.recentBooks.find((b) => b.id === 'dracula').progressPercent === 100, 'Progress clamps to max 100%');
assert(malformedResult.recentBooks.find((b) => b.id === 'frankenstein').progressPercent === 0, 'Malformed progress safely defaults to 0%');

// ----------------------------------------------------------------------------
// 8. Shortest, Longest, and Average Book Length
// ----------------------------------------------------------------------------
console.log('\n--- 8. Shortest, Longest & Average Length ---');
// In multiHistory:
// the-metamorphosis: wc 21932, ert 98
// frankenstein: wc 77682, ert 346
// pride-and-prejudice: wc 121497, ert 540
// dracula: wc 160188, ert 712
assert(multi.shortestBook.id === 'the-metamorphosis', 'Shortest book is The Metamorphosis (21,932 words)');
assert(multi.longestBook.id === 'dracula', 'Longest book is Dracula (160,188 words)');
const expectedAvgWords = Math.round((21932 + 77682 + 121497 + 160188) / 4); // 95325
assert(multi.averageBookLength.averageWordCount === expectedAvgWords, `Average word count = ${expectedAvgWords}`);
const expectedAvgMins = Math.round((98 + 346 + 540 + 712) / 4); // 424
assert(multi.averageBookLength.averageReadingTimeMinutes === expectedAvgMins, `Average reading duration = ${expectedAvgMins} mins`);

// ----------------------------------------------------------------------------
// 9. Recent Reading Ordering (Timestamp Descending)
// ----------------------------------------------------------------------------
console.log('\n--- 9. Recent Reading Ordering ---');
// Timestamps in multiHistory:
// dracula: 1789059000000 (newest)
// the-metamorphosis: 1789058000000
// frankenstein: 1789057000000
// pride-and-prejudice: 1789056000000 (oldest)
assert(multi.recentBooks[0].id === 'dracula', 'Recent book #1 is newest (Dracula)');
assert(multi.recentBooks[1].id === 'the-metamorphosis', 'Recent book #2 is The Metamorphosis');
assert(multi.recentBooks[2].id === 'frankenstein', 'Recent book #3 is Frankenstein');
assert(multi.recentBooks[3].id === 'pride-and-prejudice', 'Recent book #4 is oldest (Pride and Prejudice)');

// ----------------------------------------------------------------------------
// 10. Chronological Activity Grouping
// ----------------------------------------------------------------------------
console.log('\n--- 10. Chronological Activity Grouping ---');
assert(Array.isArray(multi.activity), 'Activity is an array');
assert(multi.activity.length > 0, 'Activity contains at least 1 period group');
assert(multi.activity[0].books.length === 4, 'All 4 books grouped in period');

// ----------------------------------------------------------------------------
// 11. Missing Timestamps Graceful Handling
// ----------------------------------------------------------------------------
console.log('\n--- 11. Missing Timestamps ---');
const noTimestampHistory = [
  { bookId: 'frankenstein', progressPercent: 50 },
  { bookId: 'dracula', progressPercent: 30 }
];
const noTimestampResult = computeReadingInsights(rawCatalog, noTimestampHistory);
assert(noTimestampResult.exploredCount === 2, 'Explored count is 2 even without timestamps');
assert(noTimestampResult.recentBooks.length === 2, 'Recent books has 2 entries');
assert(noTimestampResult.activity.length === 0, 'Activity is cleanly empty without fabricating timestamps');

// ----------------------------------------------------------------------------
// 12. Missing Metadata Resilience
// ----------------------------------------------------------------------------
console.log('\n--- 12. Missing Book Metadata ---');
const customCatalog = [
  { id: 'minimal-book-1', title: 'Minimal Book 1' },
  { id: 'minimal-book-2', title: 'Minimal Book 2' }
];
const minimalResult = computeReadingInsights(customCatalog, [
  { bookId: 'minimal-book-1', progressPercent: 100 },
  { bookId: 'minimal-book-2', progressPercent: 20 }
]);
assert(minimalResult.exploredCount === 2, 'Custom minimal catalog processes 2 books');
assert(minimalResult.categoryDistribution.length === 0, 'Empty categories returns empty distribution');
assert(minimalResult.shortestBook === null, 'No length metadata returns shortestBook = null');
assert(minimalResult.longestBook === null, 'No length metadata returns longestBook = null');
assert(minimalResult.averageBookLength === null, 'No length metadata returns averageBookLength = null');

// ----------------------------------------------------------------------------
// 13. Mathematical Soundness: No NaN / No Infinity
// ----------------------------------------------------------------------------
console.log('\n--- 13. Mathematical Soundness (No NaN, No Infinity) ---');
function checkNoNaN(obj, path = '') {
  for (const key in obj) {
    const val = obj[key];
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof val === 'number') {
      if (isNaN(val)) throw new Error(`NaN found at ${currentPath}`);
      if (!isFinite(val)) throw new Error(`Infinity found at ${currentPath}`);
    } else if (val && typeof val === 'object') {
      checkNoNaN(val, currentPath);
    }
  }
}
let hasMathErrors = false;
try {
  checkNoNaN(emptyEmpty);
  checkNoNaN(singleActive);
  checkNoNaN(singleCompleted);
  checkNoNaN(multi);
  checkNoNaN(malformedResult);
  checkNoNaN(minimalResult);
} catch (err) {
  hasMathErrors = true;
  console.error(err.message);
}
assert(!hasMathErrors, 'All insight calculation outputs are free from NaN and Infinity');

// ----------------------------------------------------------------------------
// 14. Determinism
// ----------------------------------------------------------------------------
console.log('\n--- 14. Deterministic Calculations ---');
const run1 = JSON.stringify(computeReadingInsights(rawCatalog, multiHistory));
const run2 = JSON.stringify(computeReadingInsights(rawCatalog, multiHistory));
const run3 = JSON.stringify(computeReadingInsights(rawCatalog, multiHistory));
assert(run1 === run2 && run2 === run3, 'Identical inputs produce 100% byte-for-byte identical output');

// ----------------------------------------------------------------------------
// 15. Formatters Verification
// ----------------------------------------------------------------------------
console.log('\n--- 15. Formatting Utilities ---');
assert(formatDuration(0) === '0 mins', 'formatDuration(0) = "0 mins"');
assert(formatDuration(45) === '45 mins', 'formatDuration(45) = "45 mins"');
assert(formatDuration(60) === '1 hr', 'formatDuration(60) = "1 hr"');
assert(formatDuration(120) === '2 hrs', 'formatDuration(120) = "2 hrs"');
assert(formatDuration(125) === '2 hrs 5 mins', 'formatDuration(125) = "2 hrs 5 mins"');
assert(formatWordCount(121497) === '121,497 words', 'formatWordCount(121497) = "121,497 words"');
assert(formatWordCount(0) === '0 words', 'formatWordCount(0) = "0 words"');

console.log(`\n================ TEST SUMMARY ================`);
console.log(`Passed: ${passed} | Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
