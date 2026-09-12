/**
 * Offline Recommendation Evaluation Runner for Nook
 * 
 * Evaluates the Frozen Hybrid Recommendation Engine vs Independent Baseline
 * across full 105-book catalog and benchmark multi-book evaluation cases.
 * 
 * Outputs:
 * - docs/recommendation-evaluation-results.json
 * - Detailed ASCII console comparison report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeHybridRecommendations } from '../frontend/js/recommender.js';
import {
  evaluateRecommender,
  runBaselineRecommender,
  compareRecommenderSystems,
  buildChronologicalHoldoutCases,
  intraListDiversity,
  precisionAtK,
  recallAtK,
  hitRateAtK,
  catalogCoverage
} from '../frontend/js/recommendation-evaluation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.resolve(__dirname, '../data/seed/books.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Curated benchmark evaluation profiles (each with >= 4 chronological books for leave-one-out holdout)
const BENCHMARK_READER_HISTORIES = [
  // Session 1: Gothic & Dark Suspense Reader
  {
    sessionId: 'session_gothic_suspense',
    genreIntent: 'Gothic & Horror Classics',
    history: [
      { bookId: 'frankenstein', progressPercent: 100, lastAccessedAt: 1700000000000 },
      { bookId: 'dracula', progressPercent: 100, lastAccessedAt: 1700001000000 },
      { bookId: 'the-strange-case-of-dr-jekyll-and-mr-hyde', progressPercent: 100, lastAccessedAt: 1700002000000 },
      { bookId: 'the-picture-of-dorian-gray', progressPercent: 90, lastAccessedAt: 1700003000000 } // Held-out ground truth
    ]
  },
  // Session 2: Science Fiction & Speculative Horizons
  {
    sessionId: 'session_scifi_speculative',
    genreIntent: 'Science Fiction & Future Realms',
    history: [
      { bookId: 'the-war-of-the-worlds', progressPercent: 100, lastAccessedAt: 1700000000000 },
      { bookId: 'the-time-machine', progressPercent: 100, lastAccessedAt: 1700001000000 },
      { bookId: 'twenty-thousand-leagues-under-the-sea', progressPercent: 95, lastAccessedAt: 1700002000000 },
      { bookId: 'the-invisible-man', progressPercent: 85, lastAccessedAt: 1700003000000 } // Held-out ground truth
    ]
  },
  // Session 3: Classic Mystery & Analytical Detective
  {
    sessionId: 'session_detective_mystery',
    genreIntent: 'Detective & Investigation',
    history: [
      { bookId: 'a-study-in-scarlet', progressPercent: 100, lastAccessedAt: 1700000000000 },
      { bookId: 'the-sign-of-the-four', progressPercent: 100, lastAccessedAt: 1700001000000 },
      { bookId: 'the-adventures-of-sherlock-holmes', progressPercent: 95, lastAccessedAt: 1700002000000 },
      { bookId: 'the-hound-of-the-baskervilles', progressPercent: 90, lastAccessedAt: 1700003000000 } // Held-out ground truth
    ]
  },
  // Session 4: Regency Romance & Domestic Manners
  {
    sessionId: 'session_romance_manners',
    genreIntent: 'Romance & Society',
    history: [
      { bookId: 'pride-and-prejudice', progressPercent: 100, lastAccessedAt: 1700000000000 },
      { bookId: 'sense-and-sensibility', progressPercent: 100, lastAccessedAt: 1700001000000 },
      { bookId: 'persuasion', progressPercent: 95, lastAccessedAt: 1700002000000 },
      { bookId: 'emma', progressPercent: 90, lastAccessedAt: 1700003000000 } // Held-out ground truth
    ]
  },
  // Session 5: Philosophical Fiction & Moral Contemplation
  {
    sessionId: 'session_philosophy_morality',
    genreIntent: 'Philosophy & Psychology',
    history: [
      { bookId: 'notes-from-underground', progressPercent: 100, lastAccessedAt: 1700000000000 },
      { bookId: 'the-metamorphosis', progressPercent: 100, lastAccessedAt: 1700001000000 },
      { bookId: 'the-trial', progressPercent: 90, lastAccessedAt: 1700002000000 },
      { bookId: 'crime-and-punishment', progressPercent: 85, lastAccessedAt: 1700003000000 } // Held-out ground truth
    ]
  },
  // Session 6: Perilous Adventure & Expeditions
  {
    sessionId: 'session_adventure_voyages',
    genreIntent: 'Adventure & Perilous Journeys',
    history: [
      { bookId: 'treasure-island', progressPercent: 100, lastAccessedAt: 1700000000000 },
      { bookId: 'the-call-of-the-wild', progressPercent: 100, lastAccessedAt: 1700001000000 },
      { bookId: 'white-fang', progressPercent: 95, lastAccessedAt: 1700002000000 },
      { bookId: 'king-solomons-mines', progressPercent: 90, lastAccessedAt: 1700003000000 } // Held-out ground truth
    ]
  },
  // Session 7: Victorian Masterworks & Deep Immersion
  {
    sessionId: 'session_victorian_epic',
    genreIntent: 'Victorian Epics',
    history: [
      { bookId: 'great-expectations', progressPercent: 100, lastAccessedAt: 1700000000000 },
      { bookId: 'oliver-twist', progressPercent: 100, lastAccessedAt: 1700001000000 },
      { bookId: 'a-tale-of-two-cities', progressPercent: 95, lastAccessedAt: 1700002000000 },
      { bookId: 'david-copperfield', progressPercent: 90, lastAccessedAt: 1700003000000 } // Held-out ground truth
    ]
  },
  // Session 8: Broad Multi-Category Explorer
  {
    sessionId: 'session_broad_explorer',
    genreIntent: 'Broad Exploration Across Shelves',
    history: [
      { bookId: 'alices-adventures-in-wonderland', progressPercent: 100, lastAccessedAt: 1700000000000 },
      { bookId: 'the-turn-of-the-screw', progressPercent: 100, lastAccessedAt: 1700001000000 },
      { bookId: 'the-adventures-of-tom-sawyer', progressPercent: 90, lastAccessedAt: 1700002000000 },
      { bookId: 'the-importance-of-being-earnest', progressPercent: 90, lastAccessedAt: 1700003000000 } // Held-out ground truth
    ]
  }
];

// Build Chronological Holdout Evaluation Cases
const evaluationCases = [];
for (const session of BENCHMARK_READER_HISTORIES) {
  const cases = buildChronologicalHoldoutCases(session.history, 3, 1);
  for (const c of cases) {
    evaluationCases.push({
      ...c,
      id: `${session.sessionId}_loo`,
      genreIntent: session.genreIntent
    });
  }
}

console.log('================ NOOK OFFLINE RECOMMENDATION EVALUATION ================');
console.log(`Catalog Size: ${catalog.length} books`);
console.log(`Evaluation Cases: ${evaluationCases.length} chronological holdout sessions`);

const kValues = [1, 3, 5, 10];

// 1. Run Baseline Evaluation (Category-Frequency Popularity Baseline)
const baselineResults = evaluateRecommender(
  (cat, hist, opt) => runBaselineRecommender(cat, hist, opt),
  catalog,
  evaluationCases,
  { systemName: 'Category-Frequency Baseline', kValues }
);

// 2. Run Frozen Hybrid Recommender Evaluation
const hybridResults = evaluateRecommender(
  (cat, hist, opt) => computeHybridRecommendations(cat, hist, opt),
  catalog,
  evaluationCases,
  { systemName: 'Nook Hybrid Recommender', kValues }
);

// 3. Compute Direct Comparative Metrics
const comparison = compareRecommenderSystems(baselineResults, hybridResults);

// 4. Evaluate Cold-Start System
const coldStartBaseline = runBaselineRecommender(catalog, [], { k: 5 });
const coldStartHybrid = computeHybridRecommendations(catalog, [], { recommendedCount: 5 });
const coldStartHybridDiversity = intraListDiversity(coldStartHybrid.recommended, catalog, 5);
const coldStartBaselineDiversity = intraListDiversity(coldStartBaseline, catalog, 5);

// 5. Data Leakage Verification
let leakageDetected = false;
for (const testCase of evaluationCases) {
  const trainIds = new Set(testCase.trainHistory.map(r => r.bookId));
  for (const heldOutId of testCase.groundTruthIds) {
    if (trainIds.has(heldOutId)) {
      leakageDetected = true;
      console.error(`DATA LEAKAGE DETECTED in case ${testCase.id}: ${heldOutId} is in training history!`);
    }
  }
}

// Print Comparative Summary Table
console.log('\n--------------------------------------------------------------------------------');
console.log('                 OFFLINE EVALUATION RESULTS: HYBRID VS BASELINE                 ');
console.log('--------------------------------------------------------------------------------');
console.log('Metric                |  K  | Baseline |  Hybrid  | Difference | Rel. Lift (%)');
console.log('----------------------|----:|---------:|---------:|-----------:|-------------:');

for (const row of comparison.comparisonTable) {
  const metricLabel = row.metric.padEnd(20, ' ');
  const kStr = String(row.k).padStart(2, ' ');
  const baseStr = row.baseline.toFixed(4).padStart(8, ' ');
  const hybStr = row.hybrid.toFixed(4).padStart(8, ' ');
  const diffStr = (row.difference >= 0 ? `+${row.difference.toFixed(4)}` : row.difference.toFixed(4)).padStart(10, ' ');
  const liftStr = (row.liftPercent >= 0 ? `+${row.liftPercent.toFixed(2)}%` : `${row.liftPercent.toFixed(2)}%`).padStart(13, ' ');

  console.log(`${metricLabel} | ${kStr} | ${baseStr} | ${hybStr} | ${diffStr} | ${liftStr}`);
}
console.log('--------------------------------------------------------------------------------');

console.log('\n--- Cold-Start Analysis (Zero Reading History) ---');
console.log(`  Hybrid Starter Count:     ${coldStartHybrid.recommended.length} books`);
console.log(`  Hybrid Starter Diversity: ${coldStartHybridDiversity.toFixed(4)}`);
console.log(`  Baseline Starter Count:   ${coldStartBaseline.length} books`);
console.log(`  Baseline Diversity:       ${coldStartBaselineDiversity.toFixed(4)}`);

console.log('\n--- Data Leakage Verification ---');
console.log(`  Leakage Detected: ${leakageDetected ? 'YES (CRITICAL BUG)' : 'NO (100% CLEAN HOLDOUT)'}`);

// Prepare output JSON
const outputReport = {
  timestamp: new Date().toISOString(),
  protocol: {
    methodology: 'Chronological Leave-One-Out Holdout',
    dataset: 'Nook 105-Book Seed Catalog',
    evaluationUnits: evaluationCases.length,
    minHistoryCount: 3,
    holdoutCount: 1,
    kCutoffs: kValues,
    dataLeakageFree: !leakageDetected
  },
  baseline: {
    name: 'Category-Frequency Popularity Baseline',
    metricsByK: baselineResults.metricsByK
  },
  hybrid: {
    name: 'Nook Hybrid Recommender (Frozen)',
    metricsByK: hybridResults.metricsByK
  },
  comparison: comparison.comparisonTable,
  coldStart: {
    hybridDiversity: Number(coldStartHybridDiversity.toFixed(4)),
    baselineDiversity: Number(coldStartBaselineDiversity.toFixed(4)),
    hybridStarters: coldStartHybrid.recommended.map(b => ({ id: b.id, title: b.title, categories: b.categories }))
  },
  rawCases: evaluationCases.map(c => ({
    caseId: c.id,
    genreIntent: c.genreIntent,
    trainBooks: c.trainHistory.map(r => r.bookId),
    groundTruthBooks: c.groundTruthIds
  }))
};

const outputJsonPath = path.resolve(__dirname, '../docs/recommendation-evaluation-results.json');
fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
fs.writeFileSync(outputJsonPath, JSON.stringify(outputReport, null, 2), 'utf8');
console.log(`\n✓ Results successfully saved to: ${outputJsonPath}\n`);
