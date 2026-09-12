/**
 * Nook Recommendation Evaluation Module
 * 
 * Provides:
 * - Deterministic offline evaluation metrics (Precision@K, Recall@K, Hit Rate@K, Catalog Coverage, Intra-List Diversity)
 * - Chronological Leave-One-Out holdout protocol (zero data leakage)
 * - Simple, independent baseline recommender (Category-Frequency baseline)
 * - Recommender benchmarking and comparative statistical summaries
 * 
 * Invariants:
 * - Pure functions with zero DOM dependencies.
 * - 100% deterministic (no Math.random(), no external APIs, stable tie-breaking).
 * - Never mutates input catalogs, profiles, or histories.
 */

/**
 * Computes Precision@K.
 * 
 * @param {Array<string|Object>} recommended - List of recommended book IDs or book objects
 * @param {Array<string|Object>} groundTruth - List of relevant held-out book IDs or book objects
 * @param {number} k - Cutoff rank (e.g. 1, 3, 5, 10)
 * @returns {number} Precision score in [0.0, 1.0]
 */
export function precisionAtK(recommended = [], groundTruth = [], k = 5) {
  if (typeof k !== 'number' || isNaN(k) || k <= 0) return 0.0;
  const safeRecs = Array.isArray(recommended) ? recommended : [];
  const safeTruth = Array.isArray(groundTruth) ? groundTruth : [];
  if (safeRecs.length === 0 || safeTruth.length === 0) return 0.0;

  const truthSet = new Set(safeTruth.map(item => (typeof item === 'object' && item ? item.id || item.bookId : item)));
  const topK = safeRecs.slice(0, k);
  
  let hits = 0;
  for (const item of topK) {
    const id = typeof item === 'object' && item ? item.id || item.bookId : item;
    if (truthSet.has(id)) {
      hits++;
    }
  }

  return hits / k;
}

/**
 * Computes Recall@K.
 * 
 * @param {Array<string|Object>} recommended - List of recommended book IDs or book objects
 * @param {Array<string|Object>} groundTruth - List of relevant held-out book IDs or book objects
 * @param {number} k - Cutoff rank
 * @returns {number} Recall score in [0.0, 1.0]
 */
export function recallAtK(recommended = [], groundTruth = [], k = 5) {
  if (typeof k !== 'number' || isNaN(k) || k <= 0) return 0.0;
  const safeRecs = Array.isArray(recommended) ? recommended : [];
  const safeTruth = Array.isArray(groundTruth) ? groundTruth : [];
  if (safeRecs.length === 0 || safeTruth.length === 0) return 0.0;

  const truthSet = new Set(safeTruth.map(item => (typeof item === 'object' && item ? item.id || item.bookId : item)));
  if (truthSet.size === 0) return 0.0;

  const topK = safeRecs.slice(0, k);
  let hits = 0;
  for (const item of topK) {
    const id = typeof item === 'object' && item ? item.id || item.bookId : item;
    if (truthSet.has(id)) {
      hits++;
    }
  }

  return hits / truthSet.size;
}

/**
 * Computes Hit Rate@K (1 if at least one ground-truth item in Top-K, else 0).
 * 
 * @param {Array<string|Object>} recommended
 * @param {Array<string|Object>} groundTruth
 * @param {number} k
 * @returns {number} 1.0 or 0.0
 */
export function hitRateAtK(recommended = [], groundTruth = [], k = 5) {
  if (typeof k !== 'number' || isNaN(k) || k <= 0) return 0.0;
  const safeRecs = Array.isArray(recommended) ? recommended : [];
  const safeTruth = Array.isArray(groundTruth) ? groundTruth : [];
  if (safeRecs.length === 0 || safeTruth.length === 0) return 0.0;

  const truthSet = new Set(safeTruth.map(item => (typeof item === 'object' && item ? item.id || item.bookId : item)));
  const topK = safeRecs.slice(0, k);

  for (const item of topK) {
    const id = typeof item === 'object' && item ? item.id || item.bookId : item;
    if (truthSet.has(id)) {
      return 1.0;
    }
  }

  return 0.0;
}

/**
 * Computes Catalog Coverage ratio.
 * 
 * @param {Array<Array<string|Object>>} allRecommendationLists - Collection of recommendation runs
 * @param {number} eligibleCatalogSize - Total count of eligible candidate books in catalog
 * @returns {number} Coverage in [0.0, 1.0]
 */
export function catalogCoverage(allRecommendationLists = [], eligibleCatalogSize = 1) {
  if (typeof eligibleCatalogSize !== 'number' || isNaN(eligibleCatalogSize) || eligibleCatalogSize <= 0) {
    return 0.0;
  }
  const safeLists = Array.isArray(allRecommendationLists) ? allRecommendationLists : [];
  const uniqueRecommended = new Set();

  for (const list of safeLists) {
    if (Array.isArray(list)) {
      for (const item of list) {
        const id = typeof item === 'object' && item ? item.id || item.bookId : item;
        if (id) uniqueRecommended.add(id);
      }
    }
  }

  return Math.min(1.0, uniqueRecommended.size / eligibleCatalogSize);
}

/**
 * Computes Intra-List Diversity using pairwise Jaccard category dissimilarity.
 * 
 * @param {Array<string|Object>} recommended - List of recommended books
 * @param {Array<Object>} catalog - Full verified catalog
 * @param {number} k - Cutoff rank
 * @returns {number} Diversity score in [0.0, 1.0] (1.0 = completely disjoint categories)
 */
export function intraListDiversity(recommended = [], catalog = [], k = 5) {
  const safeRecs = Array.isArray(recommended) ? recommended : [];
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const topK = safeRecs.slice(0, k);

  if (topK.length <= 1) return 1.0;

  const catalogMap = new Map();
  for (const b of safeCatalog) {
    if (b && b.id) catalogMap.set(b.id, b);
  }

  const bookCategories = topK.map(item => {
    const id = typeof item === 'object' && item ? item.id || item.bookId : item;
    const book = catalogMap.get(id) || (typeof item === 'object' ? item : null);
    const cats = book && Array.isArray(book.categories) ? book.categories : [];
    return new Set(cats.map(c => String(c).toLowerCase().trim()));
  });

  let totalPairwiseDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < bookCategories.length; i++) {
    for (let j = i + 1; j < bookCategories.length; j++) {
      const setA = bookCategories[i];
      const setB = bookCategories[j];

      let intersection = 0;
      for (const cat of setA) {
        if (setB.has(cat)) intersection++;
      }
      const union = new Set([...setA, ...setB]).size;
      const similarity = union > 0 ? intersection / union : 0.0;
      const distance = 1.0 - similarity;

      totalPairwiseDistance += distance;
      pairCount++;
    }
  }

  return pairCount > 0 ? totalPairwiseDistance / pairCount : 1.0;
}

/**
 * Builds chronological evaluation cases using Leave-One-Out (or Leave-Last-K-Out).
 * 
 * Strictly preserves chronological order and prevents future test data from leaking into training profile.
 * 
 * @param {Array<Object>} readingHistory - Array of reading progress records
 * @param {number} minHistoryCount - Minimum total books required to form an evaluation case
 * @param {number} holdoutCount - Number of most recent books to hold out for evaluation (default: 1)
 * @returns {Array<Object>} List of evaluation cases { id, trainHistory, groundTruthIds, totalHistoryCount }
 */
export function buildChronologicalHoldoutCases(readingHistory = [], minHistoryCount = 3, holdoutCount = 1) {
  const safeHistory = (Array.isArray(readingHistory) ? readingHistory : [])
    .filter(r => r && (r.bookId || (r.book && r.book.id)))
    .map(r => ({
      bookId: r.bookId || (r.book && r.book.id),
      progressPercent: typeof r.progressPercent === 'number' ? r.progressPercent : 0,
      lastAccessedAt: typeof r.lastAccessedAt === 'number' ? r.lastAccessedAt : 0
    }))
    .sort((a, b) => (a.lastAccessedAt || 0) - (b.lastAccessedAt || 0));

  // Deduplicate history preserving latest chronological position
  const dedupedMap = new Map();
  for (const record of safeHistory) {
    dedupedMap.set(record.bookId, record);
  }
  const dedupedHistory = Array.from(dedupedMap.values())
    .sort((a, b) => (a.lastAccessedAt || 0) - (b.lastAccessedAt || 0));

  if (dedupedHistory.length < minHistoryCount) {
    return [];
  }

  const splitIdx = dedupedHistory.length - holdoutCount;
  if (splitIdx < 1) return [];

  const trainHistory = dedupedHistory.slice(0, splitIdx);
  const testRecords = dedupedHistory.slice(splitIdx);
  const groundTruthIds = testRecords.map(r => r.bookId);

  return [
    {
      id: `case_loo_${dedupedHistory.length}_books`,
      trainHistory,
      groundTruthIds,
      testRecords,
      totalHistoryCount: dedupedHistory.length,
      trainCount: trainHistory.length,
      heldoutCount: groundTruthIds.length
    }
  ];
}

/**
 * Independent Simple Baseline Recommender (Category-Frequency Popularity Baseline).
 * 
 * Ranks candidates by frequency of matching categories in the user's training history.
 * Tie-breaking: Earlier publication year, then title asc.
 * Excludes finished books and active book in train history.
 * 
 * @param {Array<Object>} catalog - Full verified book catalog
 * @param {Array<Object>} trainHistory - User's historical reading events
 * @param {Object} options - Options including k
 * @returns {Array<Object>} Top-K recommended books
 */
export function runBaselineRecommender(catalog = [], trainHistory = [], options = {}) {
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const safeHistory = Array.isArray(trainHistory) ? trainHistory : [];
  const k = options.k || options.recommendedCount || 5;

  if (safeCatalog.length === 0) return [];

  const catalogMap = new Map();
  for (const b of safeCatalog) {
    if (b && b.id) catalogMap.set(b.id, b);
  }

  // Count category frequency in training history
  const catFreq = new Map();
  const historyBookIds = new Set();
  const completedIds = new Set();

  for (const record of safeHistory) {
    if (!record || !record.bookId) continue;
    historyBookIds.add(record.bookId);
    if ((record.progressPercent || 0) >= 90) {
      completedIds.add(record.bookId);
    }
    const book = catalogMap.get(record.bookId);
    if (book && Array.isArray(book.categories)) {
      for (const cat of book.categories) {
        if (cat) catFreq.set(cat, (catFreq.get(cat) || 0) + 1);
      }
    }
  }

  const activeBookId = safeHistory.length > 0 ? safeHistory[safeHistory.length - 1].bookId : null;

  // Score candidate books (excluding completed books and current active read)
  const candidatePool = safeCatalog.filter(b => {
    if (!b || !b.id) return false;
    if (b.reading_availability === 'unavailable') return false;
    if (b.id === activeBookId) return false;
    if (completedIds.has(b.id)) return false;
    return true;
  });

  const scored = candidatePool.map(book => {
    let score = 0;
    if (Array.isArray(book.categories)) {
      for (const cat of book.categories) {
        score += (catFreq.get(cat) || 0);
      }
    }
    return {
      book,
      score,
      pubYear: typeof book.publication_year === 'number' ? book.publication_year : 2000,
      title: book.title || ''
    };
  });

  // Sort deterministically: score desc, pubYear asc, title asc
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.pubYear !== b.pubYear) return a.pubYear - b.pubYear;
    return a.title.localeCompare(b.title);
  });

  return scored.slice(0, k).map(s => ({
    ...s.book,
    baselineScore: s.score
  }));
}

/**
 * Evaluates a recommendation system across a set of evaluation cases for multiple values of K.
 * 
 * @param {Function} recommenderFn - Function (catalog, history, options) => { recommended: [...] } or [...]
 * @param {Array<Object>} catalog - Full verified catalog
 * @param {Array<Object>} evalCases - List of evaluation cases
 * @param {Object} options - Options including kValues
 * @returns {Object} Comprehensive evaluation metrics
 */
export function evaluateRecommender(recommenderFn, catalog = [], evalCases = [], options = {}) {
  const kValues = Array.isArray(options.kValues) ? options.kValues : [1, 3, 5, 10];
  const maxK = Math.max(...kValues, 10);
  const safeCases = Array.isArray(evalCases) ? evalCases : [];
  const safeCatalog = Array.isArray(catalog) ? catalog : [];

  const eligibleCatalogSize = safeCatalog.filter(b => b && b.reading_availability !== 'unavailable').length;

  const resultsByK = {};
  for (const k of kValues) {
    resultsByK[k] = {
      k,
      precision: 0.0,
      recall: 0.0,
      hitRate: 0.0,
      intraListDiversity: 0.0,
      catalogCoverage: 0.0
    };
  }

  if (safeCases.length === 0) {
    return {
      systemName: options.systemName || 'Recommender System',
      caseCount: 0,
      totalGroundTruthCount: 0,
      eligibleCatalogSize,
      metricsByK: resultsByK,
      rawRecommendations: []
    };
  }

  const allRecListsByK = {};
  for (const k of kValues) {
    allRecListsByK[k] = [];
  }

  let totalGroundTruthCount = 0;
  const rawRecommendations = [];

  for (const testCase of safeCases) {
    totalGroundTruthCount += testCase.groundTruthIds.length;

    // Run recommendation engine on training history only (zero test item leakage)
    const rawOutput = recommenderFn(safeCatalog, testCase.trainHistory, {
      recommendedCount: maxK,
      k: maxK
    });

    const recs = Array.isArray(rawOutput)
      ? rawOutput
      : (rawOutput && Array.isArray(rawOutput.recommended) ? rawOutput.recommended : []);

    const recIds = recs.map(item => (typeof item === 'object' && item ? item.id || item.bookId : item));

    rawRecommendations.push({
      caseId: testCase.id,
      trainCount: testCase.trainCount,
      groundTruthIds: testCase.groundTruthIds,
      recommendedIds: recIds
    });

    for (const k of kValues) {
      const p = precisionAtK(recIds, testCase.groundTruthIds, k);
      const r = recallAtK(recIds, testCase.groundTruthIds, k);
      const h = hitRateAtK(recIds, testCase.groundTruthIds, k);
      const d = intraListDiversity(recIds, safeCatalog, k);

      resultsByK[k].precision += p;
      resultsByK[k].recall += r;
      resultsByK[k].hitRate += h;
      resultsByK[k].intraListDiversity += d;

      allRecListsByK[k].push(recIds.slice(0, k));
    }
  }

  // Aggregate averages across evaluation cases
  const n = safeCases.length;
  for (const k of kValues) {
    resultsByK[k].precision = Number((resultsByK[k].precision / n).toFixed(4));
    resultsByK[k].recall = Number((resultsByK[k].recall / n).toFixed(4));
    resultsByK[k].hitRate = Number((resultsByK[k].hitRate / n).toFixed(4));
    resultsByK[k].intraListDiversity = Number((resultsByK[k].intraListDiversity / n).toFixed(4));
    resultsByK[k].catalogCoverage = Number(catalogCoverage(allRecListsByK[k], eligibleCatalogSize).toFixed(4));
  }

  return {
    systemName: options.systemName || 'Recommender System',
    caseCount: n,
    totalGroundTruthCount,
    eligibleCatalogSize,
    metricsByK: resultsByK,
    rawRecommendations
  };
}

/**
 * Computes difference and relative lift between two evaluated recommendation systems.
 * 
 * @param {Object} baselineResults - Results from evaluateRecommender for baseline
 * @param {Object} hybridResults - Results from evaluateRecommender for hybrid
 * @returns {Object} Comparative table and summary analysis
 */
export function compareRecommenderSystems(baselineResults, hybridResults) {
  const comparisonTable = [];
  const kValues = Object.keys(hybridResults.metricsByK || {}).map(Number).sort((a, b) => a - b);

  for (const k of kValues) {
    const baseK = baselineResults.metricsByK?.[k] || {};
    const hybK = hybridResults.metricsByK?.[k] || {};

    const metrics = ['precision', 'recall', 'hitRate', 'catalogCoverage', 'intraListDiversity'];
    for (const metric of metrics) {
      const bVal = typeof baseK[metric] === 'number' ? baseK[metric] : 0.0;
      const hVal = typeof hybK[metric] === 'number' ? hybK[metric] : 0.0;
      const diff = Number((hVal - bVal).toFixed(4));
      const liftPercent = bVal > 0 ? Number((((hVal - bVal) / bVal) * 100).toFixed(2)) : (hVal > 0 ? 100.0 : 0.0);

      comparisonTable.push({
        metric,
        k,
        baseline: bVal,
        hybrid: hVal,
        difference: diff,
        liftPercent
      });
    }
  }

  return {
    comparisonTable,
    baselineName: baselineResults.systemName,
    hybridName: hybridResults.systemName,
    caseCount: hybridResults.caseCount
  };
}
