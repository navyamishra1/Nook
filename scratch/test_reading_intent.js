/**
 * Comprehensive Test Suite for Reading Intent Feature (Phase 1)
 */

const fs = require('fs');
const path = require('path');

const catalogPath = path.resolve(__dirname, '../data/seed/books.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const {
  tokenize,
  buildCatalogVectors,
  buildQueryVector,
  extractLengthIntent,
  searchByReadingIntent,
  computeCosineSimilarity,
  calculateLengthPreferenceScore
} = require('../frontend/js/recommender.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n================ NOOK READING INTENT TEST SUITE (PHASE 1) ================\n');

// 1. Vectorizer & Length Intent Functions
console.log('--- 1. Query Vectorization & Length Intent Helper Tests ---');
const qVec = buildQueryVector('dark and mysterious gothic', catalog);
assert(qVec instanceof Map && qVec.size > 0, 'buildQueryVector returns non-empty Map for valid query');

let normSq = 0;
for (const val of qVec.values()) normSq += val * val;
assert(Math.abs(normSq - 1.0) < 0.0001, 'Query vector is strictly unit-normalized (length = 1.0)');

const emptyVec = buildQueryVector('', catalog);
assert(emptyVec.size === 0, 'buildQueryVector returns empty Map for empty string');

const whitespaceVec = buildQueryVector('   \n  \t ', catalog);
assert(whitespaceVec.size === 0, 'buildQueryVector returns empty Map for whitespace');

const lengthShort1 = extractLengthIntent('a short romantic story');
assert(lengthShort1.hasLengthIntent === true && lengthShort1.modifier === 'short', 'extractLengthIntent detects "short"');

const lengthShort2 = extractLengthIntent('something atmospheric but not too long');
assert(lengthShort2.hasLengthIntent === true && lengthShort2.modifier === 'short', 'extractLengthIntent detects "not too long" as short');

const lengthShort3 = extractLengthIntent('quick novella to read before sleep');
assert(lengthShort3.hasLengthIntent === true && lengthShort3.modifier === 'short', 'extractLengthIntent detects "novella" and "quick"');

const lengthLong = extractLengthIntent('a long epic classic tome');
assert(lengthLong.hasLengthIntent === true && lengthLong.modifier === 'long', 'extractLengthIntent detects "long" and "epic"');

const lengthNone = extractLengthIntent('something dark and mysterious');
assert(lengthNone.hasLengthIntent === false && lengthNone.targetMinutes === null, 'extractLengthIntent returns false when no length keyword is present');

// 2. Query 1: "something dark and mysterious"
console.log('\n--- 2. Query 1: "something dark and mysterious" ---');
const res1 = searchByReadingIntent('something dark and mysterious', catalog, { limit: 5 });
assert(res1.results.length === 5, 'Returns exactly 5 results');
assert(res1.intentTags.some(t => t === 'dark' || t === 'mysterious'), 'Identifies intent tags (dark / mysterious)');
assert(res1.lengthConstraint === null, 'No length constraint applied');

const topIds1 = res1.results.map(b => b.id);
console.log('  Top results for "something dark and mysterious":');
res1.results.forEach((b, i) => {
  console.log(`    ${i + 1}. ${b.title} (${b.id}) [Score: ${b.intentScore}] - Reason: "${b.recommendationReason}"`);
});
assert(
  topIds1.some(id => ['frankenstein', 'dracula', 'the-strange-case-of-dr-jekyll-and-mr-hyde', 'the-turn-of-the-screw', 'the-picture-of-dorian-gray', 'the-sign-of-the-four', 'the-phantom-of-the-opera'].includes(id)),
  'Top results contain quintessential gothic / mystery classics'
);
assert(res1.results[0].intentScore > 0, 'Top result has positive intent score');
assert(typeof res1.results[0].contentSimilarity === 'number', 'Contains contentSimilarity');
assert(typeof res1.results[0].categoryMatchScore === 'number', 'Contains categoryMatchScore');
assert(typeof res1.results[0].lengthScore === 'number', 'Contains lengthScore');
assert(typeof res1.results[0].recommendationReason === 'string', 'Contains recommendationReason');

// 3. Query 2: "a short romantic story"
console.log('\n--- 3. Query 2: "a short romantic story" ---');
const res2 = searchByReadingIntent('a short romantic story', catalog, { limit: 5 });
assert(res2.results.length === 5, 'Returns 5 results');
assert(res2.lengthConstraint && res2.lengthConstraint.includes('Short'), 'Length constraint indicates Short');
console.log('  Top results for "a short romantic story":');
res2.results.forEach((b, i) => {
  const hrs = Math.round((b.estimated_reading_time || 300) / 60);
  console.log(`    ${i + 1}. ${b.title} (${b.id}) [~${hrs} hrs, Score: ${b.intentScore}] - Reason: "${b.recommendationReason}"`);
});
assert(
  res2.results.some(b => (b.categories && b.categories.includes('Romance')) || (b.categories && b.categories.includes('Classics'))),
  'Results contain romantic titles'
);

// 4. Query 3: "I want an adventure"
console.log('\n--- 4. Query 3: "I want an adventure" ---');
const res3 = searchByReadingIntent('I want an adventure', catalog, { limit: 5 });
assert(res3.results.length === 5, 'Returns 5 results');
console.log('  Top results for "I want an adventure":');
res3.results.forEach((b, i) => {
  console.log(`    ${i + 1}. ${b.title} (${b.id}) [Score: ${b.intentScore}] - Reason: "${b.recommendationReason}"`);
});
assert(
  res3.results.some(b => b.categories && b.categories.includes('Adventure')),
  'Results contain Adventure category books'
);

// 5. Query 4: "something atmospheric but not too long"
console.log('\n--- 5. Query 4: "something atmospheric but not too long" ---');
const res4 = searchByReadingIntent('something atmospheric but not too long', catalog, { limit: 5 });
assert(res4.results.length === 5, 'Returns 5 results');
assert(res4.lengthConstraint && res4.lengthConstraint.includes('Short'), 'Identifies "not too long" as short');
console.log('  Top results for "something atmospheric but not too long":');
res4.results.forEach((b, i) => {
  const hrs = Math.round((b.estimated_reading_time || 300) / 60);
  console.log(`    ${i + 1}. ${b.title} (${b.id}) [~${hrs} hrs, Score: ${b.intentScore}] - Reason: "${b.recommendationReason}"`);
});
const avgTime4 = res4.results.reduce((acc, b) => acc + (b.estimated_reading_time || 300), 0) / res4.results.length;
assert(avgTime4 <= 300, `Average reading time for short query (${Math.round(avgTime4)} min) is concise`);

// 6. Query 5: "a funny classic"
console.log('\n--- 6. Query 5: "a funny classic" ---');
const res5 = searchByReadingIntent('a funny classic', catalog, { limit: 5 });
assert(res5.results.length === 5, 'Returns 5 results');
console.log('  Top results for "a funny classic":');
res5.results.forEach((b, i) => {
  console.log(`    ${i + 1}. ${b.title} (${b.id}) [Score: ${b.intentScore}] - Reason: "${b.recommendationReason}"`);
});
assert(
  res5.results.some(b => (b.categories && (b.categories.includes('Satire') || b.categories.includes('Comedy') || b.categories.includes('Classics')))),
  'Results match satire, comedy, or witty classics'
);

// 7. Query 6: "something about love and society"
console.log('\n--- 7. Query 6: "something about love and society" ---');
const res6 = searchByReadingIntent('something about love and society', catalog, { limit: 5 });
assert(res6.results.length === 5, 'Returns 5 results');
console.log('  Top results for "something about love and society":');
res6.results.forEach((b, i) => {
  console.log(`    ${i + 1}. ${b.title} (${b.id}) [Score: ${b.intentScore}] - Reason: "${b.recommendationReason}"`);
});
assert(
  res6.results.some(b => b.id.includes('pride-and-prejudice') || b.id.includes('persuasion') || b.id.includes('age-of-innocence') || b.id.includes('emma') || (b.categories && (b.categories.includes('Romance') || b.categories.includes('Victorian Literature')))),
  'Results feature romance / society classics'
);

// 8. Empty and whitespace queries
console.log('\n--- 8. Empty & Whitespace Queries ---');
const resEmpty = searchByReadingIntent('', catalog);
assert(resEmpty.results.length === 0, 'Empty query returns empty results array');
assert(resEmpty.totalMatches === 0, 'Empty query totalMatches is 0');

const resSpaces = searchByReadingIntent('     ', catalog);
assert(resSpaces.results.length === 0, 'Whitespace query returns empty results array');

const resNull = searchByReadingIntent(null, catalog);
assert(resNull.results.length === 0, 'Null query returns empty results array');

// 9. Unknown / Unmatched query
console.log('\n--- 9. Unknown Vocabulary Query ---');
const resUnknown = searchByReadingIntent('xyzqwerty123456789 nonexistentsingularity', catalog);
assert(resUnknown.results.length === 0, 'Query with zero vocabulary matches returns 0 results');

// 10. Deterministic Repeated Queries
console.log('\n--- 10. Deterministic Stability ---');
const runA = searchByReadingIntent('something dark and mysterious', catalog, { limit: 5 });
const runB = searchByReadingIntent('something dark and mysterious', catalog, { limit: 5 });
assert(runA.results.length === runB.results.length, 'Repeated executions return same result count');
let isExactMatch = true;
for (let i = 0; i < runA.results.length; i++) {
  if (runA.results[i].id !== runB.results[i].id || runA.results[i].intentScore !== runB.results[i].intentScore) {
    isExactMatch = false;
  }
}
assert(isExactMatch, '100% deterministic ranking and scores across runs');

// 11. Excluded Book IDs
console.log('\n--- 11. Excluded Book IDs ---');
const initialTop = searchByReadingIntent('something dark and mysterious', catalog, { limit: 5 });
const topIdToExclude = initialTop.results[0].id;
const resExcluded = searchByReadingIntent('something dark and mysterious', catalog, {
  limit: 5,
  excludedBookIds: [topIdToExclude]
});
assert(!resExcluded.results.some(b => b.id === topIdToExclude), `Excluded book "${topIdToExclude}" is not in results`);
assert(resExcluded.results.length === 5, 'Still returns 5 diverse candidates when available');

// 12. Short vs Long Query Behavior
console.log('\n--- 12. Short vs Long Query Behavior ---');
const shortRes = searchByReadingIntent('short mystery', catalog, { limit: 4 });
const longRes = searchByReadingIntent('long epic mystery', catalog, { limit: 4 });
const avgShortTime = shortRes.results.reduce((a, b) => a + (b.estimated_reading_time || 300), 0) / shortRes.results.length;
const avgLongTime = longRes.results.reduce((a, b) => a + (b.estimated_reading_time || 300), 0) / longRes.results.length;
assert(avgShortTime < avgLongTime, `Short query avg time (${Math.round(avgShortTime)}m) is less than Long query avg time (${Math.round(avgLongTime)}m)`);

// 13. Custom Limit Option
console.log('\n--- 13. Result Limits ---');
const resLimit3 = searchByReadingIntent('adventure', catalog, { limit: 3 });
assert(resLimit3.results.length === 3, 'Respects custom limit of 3');
const resLimit8 = searchByReadingIntent('gothic', catalog, { limit: 8 });
assert(resLimit8.results.length === 8, 'Respects custom limit of 8');

// 14. Edge Cases: Malformed catalog entries
console.log('\n--- 14. Malformed Catalog Resilience ---');
const dirtyCatalog = [
  null,
  undefined,
  {},
  { id: 'broken-1' },
  { id: 'broken-2', title: 'No Author' },
  { id: 'valid-test', title: 'Dark Gothic Castle', author: 'Ghost Writer', categories: ['Gothic Fiction'], description: 'A dark and mysterious tale.' },
  { id: 'valid-test-2', title: 'Funny Comedy Tales', author: 'Joker', categories: ['Comedy', 'Satire'], description: 'A funny classic humor story.' }
];
const dirtyRes = searchByReadingIntent('dark gothic', dirtyCatalog, { limit: 5 });
assert(dirtyRes.results.length === 1 && dirtyRes.results[0].id === 'valid-test', 'Safely ignores malformed catalog records');

console.log('\n================ READING INTENT TEST RESULTS ================');
console.log(`Passed: ${passed} | Failed: ${failed}\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
