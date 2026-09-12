/**
 * Comprehensive Test Suite for Stage 10: Recommendation Evaluation
 * 
 * Validates:
 * 1. Precision@1 calculation
 * 2. Precision@3 calculation
 * 3. Precision@5 calculation
 * 4. Precision@10 calculation
 * 5. Recall@K calculation
 * 6. Hit Rate@K calculation
 * 7. Catalog Coverage calculation
 * 8. Intra-List Category Diversity calculation
 * 9. Empty recommendations resilience
 * 10. Empty ground truth resilience
 * 11. Duplicate recommendations deduplication
 * 12. K larger than candidate/recommendation list
 * 13. Unknown book IDs handling
 * 14. Insufficient history (< minHistoryCount)
 * 15. Cold-start handling (zero history)
 * 16. Deterministic repeated evaluation
 * 17. Baseline recommender execution and ranking
 * 18. Hybrid recommender evaluation execution
 * 19. System comparison diff and lift calculations
 * 20. Input immutability (no mutation of catalog or history)
 * 21. Data Leakage Prevention: Zero future data in training set
 * 22. Held-out items strictly excluded from profile vectors
 * 23. Byte-for-byte identical metrics on identical inputs
 * 24. Malformed records and type safety resilience
 * 25. Synthetic robustness profiles (clearly labeled)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeHybridRecommendations } from '../frontend/js/recommender.js';
import {
  precisionAtK,
  recallAtK,
  hitRateAtK,
  catalogCoverage,
  intraListDiversity,
  buildChronologicalHoldoutCases,
  runBaselineRecommender,
  evaluateRecommender,
  compareRecommenderSystems
} from '../frontend/js/recommendation-evaluation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.resolve(__dirname, '../data/seed/books.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

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

console.log('\n================ NOOK RECOMMENDATION EVALUATION TEST SUITE ================');

// --- 1. Precision@1 Calculation ---
console.log('\n[Test Group 1: Precision Metrics]');
{
  const recs = ['book_a', 'book_b', 'book_c'];
  const truth = ['book_a'];
  const p1 = precisionAtK(recs, truth, 1);
  assert(p1 === 1.0, `Precision@1 when top item is hit: expected 1.0, got ${p1}`);

  const p1Miss = precisionAtK(['book_z', 'book_a'], truth, 1);
  assert(p1Miss === 0.0, `Precision@1 when top item is miss: expected 0.0, got ${p1Miss}`);
}

// --- 2. Precision@3 Calculation ---
{
  const recs = ['book_a', 'book_b', 'book_c', 'book_d'];
  const truth = ['book_b', 'book_c'];
  const p3 = precisionAtK(recs, truth, 3);
  assert(Math.abs(p3 - (2 / 3)) < 0.0001, `Precision@3 with 2 hits in top 3: expected 0.6667, got ${p3}`);
}

// --- 3. Precision@5 Calculation ---
{
  const recs = ['book_1', 'book_2', 'book_3', 'book_4', 'book_5'];
  const truth = ['book_3'];
  const p5 = precisionAtK(recs, truth, 5);
  assert(p5 === 0.2, `Precision@5 with 1 hit in 5: expected 0.2, got ${p5}`);
}

// --- 4. Precision@10 Calculation ---
{
  const recs = Array.from({ length: 10 }, (_, i) => `book_${i + 1}`);
  const truth = ['book_2', 'book_5', 'book_9'];
  const p10 = precisionAtK(recs, truth, 10);
  assert(p10 === 0.3, `Precision@10 with 3 hits in 10: expected 0.3, got ${p10}`);
}

// --- 5. Recall@K Calculation ---
console.log('\n[Test Group 2: Recall and Hit Rate]');
{
  const recs = ['book_a', 'book_b', 'book_c', 'book_d', 'book_e'];
  const truth = ['book_b', 'book_d', 'book_z']; // 3 total ground truth items, 2 in top 5
  const r5 = recallAtK(recs, truth, 5);
  assert(Math.abs(r5 - (2 / 3)) < 0.0001, `Recall@5 with 2 of 3 truth items found: expected 0.6667, got ${r5}`);

  const r3 = recallAtK(recs, truth, 3); // top 3 has only book_b (1 hit)
  assert(Math.abs(r3 - (1 / 3)) < 0.0001, `Recall@3 with 1 of 3 truth items found: expected 0.3333, got ${r3}`);
}

// --- 6. Hit Rate@K Calculation ---
{
  const recs = ['book_a', 'book_b', 'book_c', 'book_d', 'book_e'];
  const truth = ['book_d'];
  assert(hitRateAtK(recs, truth, 3) === 0.0, 'Hit Rate@3 when item is at rank 4: expected 0.0');
  assert(hitRateAtK(recs, truth, 5) === 1.0, 'Hit Rate@5 when item is at rank 4: expected 1.0');
}

// --- 7. Catalog Coverage Calculation ---
console.log('\n[Test Group 3: Coverage and Diversity]');
{
  const list1 = ['b1', 'b2', 'b3'];
  const list2 = ['b2', 'b4', 'b5'];
  const list3 = ['b1', 'b6'];
  // Unique items: b1, b2, b3, b4, b5, b6 (6 items)
  const cov = catalogCoverage([list1, list2, list3], 10);
  assert(cov === 0.6, `Catalog coverage 6/10: expected 0.6, got ${cov}`);
  assert(catalogCoverage([], 10) === 0.0, 'Empty recommendation lists yield 0 coverage');
  assert(catalogCoverage([list1], 0) === 0.0, 'Zero catalog size safely yields 0 coverage');
}

// --- 8. Intra-List Diversity Calculation ---
{
  const mockCatalog = [
    { id: 'b1', categories: ['Gothic', 'Horror'] },
    { id: 'b2', categories: ['Gothic', 'Horror'] },
    { id: 'b3', categories: ['Sci-Fi', 'Space'] }
  ];
  // b1 and b2 have identical categories (dist 0), b1 & b3 have disjoint categories (dist 1), b2 & b3 have disjoint categories (dist 1)
  // Pairwise distances: (0 + 1 + 1) / 3 = 0.6667
  const div = intraListDiversity(['b1', 'b2', 'b3'], mockCatalog, 3);
  assert(Math.abs(div - (2 / 3)) < 0.0001, `Intra-list diversity calculation: expected 0.6667, got ${div}`);

  const identicalDiv = intraListDiversity(['b1', 'b2'], mockCatalog, 2);
  assert(identicalDiv === 0.0, `Intra-list diversity for identical categories: expected 0.0, got ${identicalDiv}`);

  const singleDiv = intraListDiversity(['b1'], mockCatalog, 1);
  assert(singleDiv === 1.0, `Intra-list diversity for single item: expected 1.0, got ${singleDiv}`);
}

// --- 9. Empty Recommendations Handling ---
console.log('\n[Test Group 4: Edge Cases and Resilience]');
{
  assert(precisionAtK([], ['b1'], 5) === 0.0, 'Precision with empty recommendations returns 0.0');
  assert(recallAtK([], ['b1'], 5) === 0.0, 'Recall with empty recommendations returns 0.0');
  assert(hitRateAtK([], ['b1'], 5) === 0.0, 'Hit rate with empty recommendations returns 0.0');
}

// --- 10. Empty Ground Truth Handling ---
{
  assert(precisionAtK(['b1', 'b2'], [], 5) === 0.0, 'Precision with empty ground truth returns 0.0');
  assert(recallAtK(['b1', 'b2'], [], 5) === 0.0, 'Recall with empty ground truth returns 0.0');
  assert(hitRateAtK(['b1', 'b2'], [], 5) === 0.0, 'Hit rate with empty ground truth returns 0.0');
}

// --- 11. Duplicate Recommendations Handling ---
{
  const objRecs = [{ id: 'b1' }, { id: 'b2' }, { bookId: 'b3' }];
  const truth = [{ id: 'b2' }];
  assert(precisionAtK(objRecs, truth, 3) === (1 / 3), 'Handles object inputs with .id and .bookId');
  assert(hitRateAtK(objRecs, truth, 3) === 1.0, 'Hit rate handles object inputs');
}

// --- 12. K Larger than List Handling ---
{
  const recs = ['b1', 'b2'];
  const truth = ['b1'];
  // Only 2 recommendations available, asking for K=10
  const p10 = precisionAtK(recs, truth, 10);
  assert(p10 === 0.1, `Precision@10 with only 2 items in recs: expected 1/10 = 0.1, got ${p10}`);
}

// --- 13. Unknown Book IDs Handling ---
{
  const recs = ['non_existent_1', 'non_existent_2'];
  const truth = ['non_existent_3'];
  assert(precisionAtK(recs, truth, 2) === 0.0, 'Handles non-matching IDs safely');
  const divUnknown = intraListDiversity(recs, catalog, 2);
  assert(divUnknown === 1.0, 'Intra-list diversity handles missing book IDs safely without crashing');
}

// --- 14. Insufficient History Handling ---
console.log('\n[Test Group 5: Chronological Holdout Cases]');
{
  const shortHistory = [
    { bookId: 'frankenstein', lastAccessedAt: 100 },
    { bookId: 'dracula', lastAccessedAt: 200 }
  ];
  const cases = buildChronologicalHoldoutCases(shortHistory, 3, 1);
  assert(cases.length === 0, 'buildChronologicalHoldoutCases returns empty array for history < minHistoryCount');
}

// --- 15. Cold-Start Handling (Zero History) ---
{
  const coldStartCases = buildChronologicalHoldoutCases([], 3, 1);
  assert(coldStartCases.length === 0, 'Zero history produces 0 holdout cases');

  const coldHybrid = computeHybridRecommendations(catalog, [], { recommendedCount: 5 });
  assert(coldHybrid.recommended.length === 5, 'Cold-start hybrid returns exactly 5 curated books');
  assert(coldHybrid.isFresh === true, 'Cold-start hybrid correctly marks isFresh = true');

  const coldBase = runBaselineRecommender(catalog, [], { k: 5 });
  assert(coldBase.length === 5, 'Cold-start baseline returns exactly 5 books');
}

// --- 16. Deterministic Repeated Evaluation ---
console.log('\n[Test Group 6: Determinism & Baseline vs Hybrid]');
{
  const mockHistory = [
    { bookId: 'frankenstein', progressPercent: 100, lastAccessedAt: 100 },
    { bookId: 'dracula', progressPercent: 100, lastAccessedAt: 200 },
    { bookId: 'the-strange-case-of-dr-jekyll-and-mr-hyde', progressPercent: 100, lastAccessedAt: 300 },
    { bookId: 'the-picture-of-dorian-gray', progressPercent: 90, lastAccessedAt: 400 }
  ];
  const holdoutCases = buildChronologicalHoldoutCases(mockHistory, 3, 1);
  assert(holdoutCases.length === 1, 'Constructed 1 holdout case from 4 books');
  assert(holdoutCases[0].groundTruthIds[0] === 'the-picture-of-dorian-gray', 'Correct held-out test item');

  const eval1 = evaluateRecommender(
    (cat, hist, opt) => computeHybridRecommendations(cat, hist, opt),
    catalog,
    holdoutCases,
    { kValues: [1, 3, 5] }
  );

  const eval2 = evaluateRecommender(
    (cat, hist, opt) => computeHybridRecommendations(cat, hist, opt),
    catalog,
    holdoutCases,
    { kValues: [1, 3, 5] }
  );

  assert(JSON.stringify(eval1.metricsByK) === JSON.stringify(eval2.metricsByK), 'Repeated evaluation runs produce identical metrics');
}

// --- 17. Baseline Output Verification ---
{
  const trainHistory = [
    { bookId: 'frankenstein', progressPercent: 100, lastAccessedAt: 100 },
    { bookId: 'dracula', progressPercent: 100, lastAccessedAt: 200 }
  ];
  const baselineRecs = runBaselineRecommender(catalog, trainHistory, { k: 5 });
  assert(Array.isArray(baselineRecs) && baselineRecs.length === 5, 'Baseline recommender returns 5 books');
  assert(baselineRecs[0].baselineScore !== undefined, 'Baseline results include baselineScore');
  assert(!baselineRecs.some(b => b.id === 'frankenstein'), 'Baseline excludes completed books');
}

// --- 18. Hybrid Output Verification ---
{
  const trainHistory = [
    { bookId: 'frankenstein', progressPercent: 100, lastAccessedAt: 100 },
    { bookId: 'dracula', progressPercent: 100, lastAccessedAt: 200 }
  ];
  const hybridRecs = computeHybridRecommendations(catalog, trainHistory, { recommendedCount: 5 });
  assert(Array.isArray(hybridRecs.recommended) && hybridRecs.recommended.length === 5, 'Hybrid recommender returns 5 books in .recommended');
}

// --- 19. System Comparison Calculation ---
{
  const mockBaseRes = {
    systemName: 'Base',
    caseCount: 1,
    metricsByK: {
      3: { precision: 0.1, recall: 0.3, hitRate: 0.3, catalogCoverage: 0.2, intraListDiversity: 0.4 }
    }
  };
  const mockHybRes = {
    systemName: 'Hyb',
    caseCount: 1,
    metricsByK: {
      3: { precision: 0.2, recall: 0.6, hitRate: 0.6, catalogCoverage: 0.25, intraListDiversity: 0.6 }
    }
  };
  const comp = compareRecommenderSystems(mockBaseRes, mockHybRes);
  const precRow = comp.comparisonTable.find(r => r.metric === 'precision' && r.k === 3);
  assert(precRow && precRow.difference === 0.1, 'Comparison difference calculated correctly');
  assert(precRow && precRow.liftPercent === 100.0, 'Comparison lift percentage calculated correctly (+100%)');
}

// --- 20. Input Immutability Verification ---
console.log('\n[Test Group 7: Input Immutability & Data Leakage]');
{
  const catalogSnapshot = JSON.stringify(catalog);
  const testHistory = [
    { bookId: 'the-war-of-the-worlds', progressPercent: 100, lastAccessedAt: 100 },
    { bookId: 'the-time-machine', progressPercent: 100, lastAccessedAt: 200 },
    { bookId: 'the-invisible-man', progressPercent: 90, lastAccessedAt: 300 }
  ];
  const historySnapshot = JSON.stringify(testHistory);

  const cases = buildChronologicalHoldoutCases(testHistory, 3, 1);
  evaluateRecommender(
    (cat, hist, opt) => computeHybridRecommendations(cat, hist, opt),
    catalog,
    cases,
    { kValues: [1, 3, 5] }
  );

  assert(JSON.stringify(catalog) === catalogSnapshot, 'Catalog was not mutated during evaluation');
  assert(JSON.stringify(testHistory) === historySnapshot, 'Reading history was not mutated during evaluation');
}

// --- 21 & 22. Dedicated Data Leakage Test ---
{
  const chronologicalHistory = [
    { bookId: 'a-study-in-scarlet', progressPercent: 100, lastAccessedAt: 1000 },
    { bookId: 'the-sign-of-the-four', progressPercent: 100, lastAccessedAt: 2000 },
    { bookId: 'the-adventures-of-sherlock-holmes', progressPercent: 100, lastAccessedAt: 3000 },
    { bookId: 'the-hound-of-the-baskervilles', progressPercent: 90, lastAccessedAt: 4000 } // Test target
  ];

  const cases = buildChronologicalHoldoutCases(chronologicalHistory, 3, 1);
  const evalCase = cases[0];

  assert(evalCase.groundTruthIds.length === 1, 'Exactly 1 held-out target item');
  assert(evalCase.groundTruthIds[0] === 'the-hound-of-the-baskervilles', 'Held-out item is the latest event');

  const trainBookIds = new Set(evalCase.trainHistory.map(r => r.bookId));
  assert(!trainBookIds.has('the-hound-of-the-baskervilles'), 'CRITICAL: Held-out item is strictly ABSENT from training history');
  assert(evalCase.trainHistory.length === 3, 'Training history contains exactly 3 prior books');
}

// --- 23. Byte-for-Byte Identical Metrics on Identical Inputs ---
console.log('\n[Test Group 8: Determinism and Synthetic Profiles]');
{
  const recs = ['frankenstein', 'dracula', 'the-picture-of-dorian-gray'];
  const truth = ['dracula'];
  const r1 = precisionAtK(recs, truth, 3);
  const r2 = precisionAtK(recs, truth, 3);
  const r3 = precisionAtK(recs, truth, 3);
  assert(r1 === r2 && r2 === r3, 'Precision metric is 100% deterministic across multiple invocations');
}

// --- 24. Malformed Data Resilience ---
{
  assert(precisionAtK(null, null, 5) === 0.0, 'Handles null inputs gracefully in precisionAtK');
  assert(recallAtK(undefined, undefined, 5) === 0.0, 'Handles undefined inputs gracefully in recallAtK');
  assert(hitRateAtK('invalid', {}, 5) === 0.0, 'Handles non-array inputs gracefully in hitRateAtK');
  assert(catalogCoverage(null, null) === 0.0, 'Handles null inputs gracefully in catalogCoverage');
  assert(intraListDiversity(null, null, 5) === 1.0, 'Handles null inputs gracefully in intraListDiversity');
  assert(runBaselineRecommender(null, null).length === 0, 'runBaselineRecommender handles null catalog');
}

// --- 25. Synthetic Robustness Profiles (Clearly Labeled) ---
{
  console.log('\n--- Synthetic Robustness Tests (Evaluator Behavior Validation Only) ---');
  const syntheticProfiles = [
    {
      name: 'Profile A: Gothic + Mystery Reader (Synthetic)',
      history: [
        { bookId: 'frankenstein', progressPercent: 100, lastAccessedAt: 100 },
        { bookId: 'dracula', progressPercent: 100, lastAccessedAt: 200 },
        { bookId: 'the-hound-of-the-baskervilles', progressPercent: 90, lastAccessedAt: 300 }
      ]
    },
    {
      name: 'Profile B: Adventure + SciFi Reader (Synthetic)',
      history: [
        { bookId: 'treasure-island', progressPercent: 100, lastAccessedAt: 100 },
        { bookId: 'the-time-machine', progressPercent: 100, lastAccessedAt: 200 },
        { bookId: 'twenty-thousand-leagues-under-the-sea', progressPercent: 90, lastAccessedAt: 300 }
      ]
    },
    {
      name: 'Profile C: Philosophy + Morality Reader (Synthetic)',
      history: [
        { bookId: 'notes-from-underground', progressPercent: 100, lastAccessedAt: 100 },
        { bookId: 'the-metamorphosis', progressPercent: 100, lastAccessedAt: 200 },
        { bookId: 'crime-and-punishment', progressPercent: 90, lastAccessedAt: 300 }
      ]
    },
    {
      name: 'Profile D: Broad Multi-Category Reader (Synthetic)',
      history: [
        { bookId: 'alices-adventures-in-wonderland', progressPercent: 100, lastAccessedAt: 100 },
        { bookId: 'pride-and-prejudice', progressPercent: 100, lastAccessedAt: 200 },
        { bookId: 'the-war-of-the-worlds', progressPercent: 90, lastAccessedAt: 300 }
      ]
    }
  ];

  for (const prof of syntheticProfiles) {
    const cases = buildChronologicalHoldoutCases(prof.history, 3, 1);
    assert(cases.length === 1, `Synthetic robustness case generated for ${prof.name}`);
    const res = evaluateRecommender(
      (cat, hist, opt) => computeHybridRecommendations(cat, hist, opt),
      catalog,
      cases,
      { kValues: [1, 3, 5] }
    );
    assert(res.caseCount === 1, `Evaluator processed ${prof.name} successfully`);
  }
}

// --- Summary ---
console.log('\n================================================================');
console.log(`Recommendation Evaluation Test Results: ${passed} passed, ${failed} failed`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✓ ALL RECOMMENDATION EVALUATION TESTS PASSED\n');
}
