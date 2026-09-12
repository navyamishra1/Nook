/**
 * Nook Intelligent Hybrid Recommendation Engine
 * 
 * Architecture:
 * Hybrid content-based recommendation engine combining:
 * 1. Deterministic TF-IDF document vectors & cosine similarity (title, author, categories, description)
 * 2. User category affinity profile (recency & progress depth weighted, square-root dampened)
 * 3. Semantic & categorical similarity to currently active read
 * 4. Reading behavior signals (author affinity, interaction history)
 * 5. Book length preference (target reading time & word count proximity)
 * 6. Maximal Marginal Relevance (MMR) deterministic diversity reranking
 * 
 * Strict invariants:
 * - Deterministic and reproducible (no Math.random(), stable tie-breaking).
 * - 100% local calculation (zero external AI / LLM / API calls).
 * - Excludes completed books and current active read from general recommendations.
 * - Always delivers diverse, high-craft starter recommendations for cold-start users.
 * - Produces rich structured explainability metadata for every candidate.
 */

export const RECOMMENDER_CONFIG = {
  weightsWithCurrent: {
    contentSimilarity: 0.35,      // Content similarity to historical reads
    categoryAffinity: 0.25,       // Category affinity profile
    currentBookSimilarity: 0.15,  // Direct similarity to active reading book
    behaviorScore: 0.15,          // Author affinity & behavioral signals
    lengthPreference: 0.10        // Preferred reading duration proximity
  },
  weightsWithoutCurrent: {
    contentSimilarity: 0.40,      // Content similarity to historical reads
    categoryAffinity: 0.30,       // Category affinity profile
    currentBookSimilarity: 0.00,  // No active read
    behaviorScore: 0.15,          // Author affinity & behavioral signals
    lengthPreference: 0.15        // Preferred reading duration proximity
  },
  thresholds: {
    completedPercent: 90,         // Books at >= 90% considered finished
    minRecommendationScore: 0.01,
    diversityLambda: 0.15         // MMR penalty multiplier for redundant candidates
  },
  limits: {
    recommendedCount: 5,          // 5 books in "Picked For You"
    moreLikeCurrentCount: 5       // 5 books in "More Like What You're Reading"
  }
};

// Common English and literary stopwords for deterministic TF-IDF indexing
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot',
  'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d',
  'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
  'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll',
  'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
  'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while',
  'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll',
  'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'classic', 'edition', 'story', 'novel', 'book',
  'author', 'work', 'tells', 'tale', 'written', 'published', 'volume', 'text', 'chapter', 'page'
]);

/**
 * Tokenizes and cleans text into lowercase alphanumeric tokens, filtering stopwords and short words.
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

// In-memory cache for catalog TF-IDF vectors
let cachedVectors = null;
let cachedCatalogRef = null;
let cachedDocFreq = null;
let cachedNumDocs = 0;

/**
 * Builds deterministic TF-IDF feature vectors for all books in the catalog.
 * Uses weighted fields: Title (2x), Categories (2x), Author (1.5x), Description (1x).
 */
export function buildCatalogVectors(catalog) {
  if (cachedVectors && cachedCatalogRef === catalog) {
    return cachedVectors;
  }

  const numDocs = catalog ? catalog.length : 0;
  if (numDocs === 0) return new Map();

  const docTokens = new Map();
  const docFreq = new Map();

  // 1. Build document token bags with weighted metadata fields
  for (const book of catalog) {
    if (!book || !book.id) continue;
    const tokens = [];

    // Title terms (weight x2)
    const titleTokens = tokenize(book.title);
    tokens.push(...titleTokens, ...titleTokens);

    // Author terms (weight x1.5)
    const authorTokens = tokenize(book.author);
    tokens.push(...authorTokens);

    // Categories (weight x2)
    if (Array.isArray(book.categories)) {
      for (const cat of book.categories) {
        const catTokens = tokenize(cat);
        tokens.push(...catTokens, ...catTokens);
      }
    }

    // Description (weight x1)
    if (book.description) {
      tokens.push(...tokenize(book.description));
    }

    docTokens.set(book.id, tokens);

    // Document frequencies (unique occurrence per book)
    const uniqueTokens = new Set(tokens);
    for (const t of uniqueTokens) {
      docFreq.set(t, (docFreq.get(t) || 0) + 1);
    }
  }

  // 2. Compute TF-IDF vectors normalized to unit length
  const vectors = new Map();

  for (const [bookId, tokens] of docTokens.entries()) {
    const termCounts = new Map();
    for (const t of tokens) {
      termCounts.set(t, (termCounts.get(t) || 0) + 1);
    }

    const totalTokens = Math.max(1, tokens.length);
    const tfIdfMap = new Map();
    let normSq = 0;

    for (const [term, count] of termCounts.entries()) {
      const tf = count / totalTokens;
      const df = docFreq.get(term) || 1;
      // Smooth IDF formula: ln((1 + N) / (1 + df)) + 1
      const idf = Math.log((1 + numDocs) / (1 + df)) + 1;
      const tfIdf = tf * idf;
      tfIdfMap.set(term, tfIdf);
      normSq += tfIdf * tfIdf;
    }

    // Normalize vector to unit length for fast cosine dot-product
    const norm = Math.sqrt(normSq) || 1.0;
    const unitVector = new Map();
    for (const [term, val] of tfIdfMap.entries()) {
      unitVector.set(term, val / norm);
    }

    vectors.set(bookId, unitVector);
  }

  cachedVectors = vectors;
  cachedCatalogRef = catalog;
  cachedDocFreq = docFreq;
  cachedNumDocs = numDocs;
  return vectors;
}

/**
 * Builds a unit-normalized TF-IDF vector for a natural language query string
 * using the catalog's document frequency vocabulary.
 */
export function buildQueryVector(query, catalog) {
  if (!query || typeof query !== 'string') return new Map();
  const tokens = tokenize(query);
  if (tokens.length === 0) return new Map();

  // Ensure catalog vectors and vocabulary are computed and cached
  buildCatalogVectors(catalog);

  const numDocs = cachedNumDocs || (catalog ? catalog.length : 1);
  const docFreq = cachedDocFreq || new Map();

  const termCounts = new Map();
  for (const t of tokens) {
    termCounts.set(t, (termCounts.get(t) || 0) + 1);
  }

  const totalTokens = tokens.length;
  const tfIdfMap = new Map();
  let normSq = 0;

  for (const [term, count] of termCounts.entries()) {
    const tf = count / totalTokens;
    const df = docFreq.get(term) || 0;
    // Smooth IDF formula identical to catalog: ln((1 + N) / (1 + df)) + 1
    const idf = Math.log((1 + numDocs) / (1 + df)) + 1;
    const tfIdf = tf * idf;
    tfIdfMap.set(term, tfIdf);
    normSq += tfIdf * tfIdf;
  }

  const norm = Math.sqrt(normSq) || 1.0;
  const unitVector = new Map();
  for (const [term, val] of tfIdfMap.entries()) {
    unitVector.set(term, val / norm);
  }

  return unitVector;
}

/**
 * Computes cosine similarity between two unit-normalized TF-IDF vector maps.
 * Returns a value in [0.0, 1.0].
 */
export function computeCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.size === 0 || vecB.size === 0) return 0.0;

  // Iterate over smaller vector for high performance
  const [smaller, larger] = vecA.size < vecB.size ? [vecA, vecB] : [vecB, vecA];
  let dotProduct = 0.0;

  for (const [term, weightA] of smaller.entries()) {
    const weightB = larger.get(term);
    if (weightB !== undefined) {
      dotProduct += weightA * weightB;
    }
  }

  return Math.max(0.0, Math.min(1.0, dotProduct));
}

/**
 * Computes pairwise content similarity between two books in the catalog.
 */
export function getBookContentSimilarity(catalog, bookIdA, bookIdB) {
  if (!catalog || !bookIdA || !bookIdB) return 0.0;
  if (bookIdA === bookIdB) return 1.0;
  const vectors = buildCatalogVectors(catalog);
  const vecA = vectors.get(bookIdA);
  const vecB = vectors.get(bookIdB);
  return computeCosineSimilarity(vecA, vecB);
}

/**
 * Builds user's category affinity, author affinity, and target reading length profile.
 */
export function getUserPreferenceProfile(catalog, readingHistory = []) {
  const validHistory = (readingHistory || [])
    .filter((r) => r && r.bookId && catalog.some((b) => b.id === r.bookId))
    .sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0));

  if (validHistory.length === 0) {
    return {
      isValid: false,
      normalizedCatScores: new Map(),
      dominantCategory: null,
      authorWeights: new Map(),
      avgReadingTimeMinutes: 300,
      avgWordCount: 75000,
      historyCount: 0
    };
  }

  const categoryScores = new Map();
  const authorScores = new Map();
  let totalLengthWeight = 0;
  let weightedReadingTimeSum = 0;
  let weightedWordCountSum = 0;

  validHistory.forEach((record, index) => {
    const book = catalog.find((b) => b.id === record.bookId);
    if (!book) return;

    // Recency decay factor: 1st is 1.0, 2nd is 0.77, 3rd is 0.625...
    const recencyFactor = 1.0 / (1.0 + index * 0.3);
    // Completion depth factor: books read deeper contribute higher signal
    const progressFactor = 0.5 + Math.min(1.0, (record.progressPercent || 0) / 100) * 0.5;
    const weight = recencyFactor * progressFactor;

    // Category affinity accumulation
    if (Array.isArray(book.categories)) {
      for (const cat of book.categories) {
        categoryScores.set(cat, (categoryScores.get(cat) || 0) + weight);
      }
    }

    // Author affinity accumulation
    if (book.author) {
      const authorKey = book.author.toLowerCase().trim();
      authorScores.set(authorKey, (authorScores.get(authorKey) || 0) + weight);
    }

    // Length tracking
    const time = book.estimated_reading_time || 300;
    const words = book.word_count || 75000;
    weightedReadingTimeSum += time * weight;
    weightedWordCountSum += words * weight;
    totalLengthWeight += weight;
  });

  // Square-root dampening to prevent one heavily repeated category from starving all others
  const dampenedCatScores = new Map();
  let maxDampened = 0;
  let dominantCategory = null;

  for (const [cat, rawScore] of categoryScores.entries()) {
    const dampened = Math.sqrt(rawScore);
    dampenedCatScores.set(cat, dampened);
    if (dampened > maxDampened) {
      maxDampened = dampened;
      dominantCategory = cat;
    }
  }

  // Normalize category scores to [0.0, 1.0]
  const normalizedCatScores = new Map();
  if (maxDampened > 0) {
    for (const [cat, score] of dampenedCatScores.entries()) {
      normalizedCatScores.set(cat, score / maxDampened);
    }
  }

  // Normalize author scores to [0.0, 1.0]
  let maxAuthor = 0;
  for (const score of authorScores.values()) {
    if (score > maxAuthor) maxAuthor = score;
  }
  const normalizedAuthorScores = new Map();
  if (maxAuthor > 0) {
    for (const [author, score] of authorScores.entries()) {
      normalizedAuthorScores.set(author, score / maxAuthor);
    }
  }

  const avgReadingTime = totalLengthWeight > 0 ? Math.round(weightedReadingTimeSum / totalLengthWeight) : 300;
  const avgWords = totalLengthWeight > 0 ? Math.round(weightedWordCountSum / totalLengthWeight) : 75000;

  return {
    isValid: true,
    normalizedCatScores,
    dominantCategory,
    authorWeights: normalizedAuthorScores,
    avgReadingTimeMinutes: avgReadingTime,
    avgWordCount: avgWords,
    historyCount: validHistory.length
  };
}

/**
 * Calculates a smooth length-proximity score in [0.0, 1.0] using relative distance.
 */
export function calculateLengthPreferenceScore(candidate, targetMinutes = 300) {
  if (!candidate) return 0.5;
  const candidateMinutes = candidate.estimated_reading_time || (candidate.word_count ? Math.round(candidate.word_count / 225) : 300);
  const diff = Math.abs(candidateMinutes - targetMinutes);
  const sum = candidateMinutes + targetMinutes;
  if (sum === 0) return 1.0;
  // Normalized score: 1.0 when exact match, ~0.67 when 2x difference, ~0.5 when 3x difference
  return Math.max(0.0, 1.0 - (diff / sum));
}

/**
 * Helper to get clean, shortened book title (strips subtitles like "; or, The Modern Prometheus").
 */
export function getShortBookTitle(title) {
  if (!title || typeof title !== 'string') return '';
  const semicolonIdx = title.indexOf(';');
  if (semicolonIdx !== -1) {
    return title.slice(0, semicolonIdx).trim();
  }
  return title.trim();
}

/**
 * Generates an explainable reason list and human-readable summary string for a recommendation.
 */
export function generateExplainabilityData({
  candidate,
  currentBook = null,
  mostSimilarHistoryBook = null,
  maxContentSim = 0.0,
  dominantCategory = null,
  matchedCategory = null,
  contentScore = 0.0,
  catScore = 0.0,
  currentBookSim = 0.0,
  behaviorScore = 0.0,
  lengthScore = 0.0,
  userAvgTime = 300,
  hasAuthorInHistory = false
}) {
  const primaryCat = (candidate.categories && candidate.categories[0]) || 'Classic Literature';
  const candMins = candidate.estimated_reading_time || (candidate.word_count ? Math.round(candidate.word_count / 225) : 300);
  const hours = Math.max(1, Math.round(candMins / 60));
  const reasons = [];

  // Descriptive candidate genre (preferring non-generic categories over Classics / Victorian Literature)
  const nonGenericCandidateCat = (candidate.categories || []).find(
    (c) => c !== 'Classics' && c !== 'Victorian Literature' && c !== 'Literary'
  ) || matchedCategory || dominantCategory || primaryCat;

  // Determine reference book for content similarity (active read takes precedence if high sim, else top history match)
  let refBook = null;
  let refSim = 0.0;
  if (currentBook && currentBookSim >= 0.15) {
    refBook = currentBook;
    refSim = currentBookSim;
  } else if (mostSimilarHistoryBook && maxContentSim >= 0.10) {
    refBook = mostSimilarHistoryBook;
    refSim = maxContentSim;
  }

  // 1. Author Affinity Reason (strictly factually true)
  const isAuthorMatch = (behaviorScore >= 0.30 || hasAuthorInHistory) && Boolean(candidate.author);
  if (isAuthorMatch) {
    reasons.push(`Another work by ${candidate.author}`);
  }

  // 2. Reference Book / Thematic / Content Similarity Reason
  let specificRefPhrase = null;
  if (refBook) {
    const refTitle = getShortBookTitle(refBook.title);
    const candCats = candidate.categories || [];
    const refCats = refBook.categories || [];

    const hasGothic = candCats.some((c) => /gothic/i.test(c)) && refCats.some((c) => /gothic/i.test(c));
    const hasHorror = candCats.some((c) => /horror/i.test(c)) && refCats.some((c) => /horror/i.test(c));
    const hasMystery = candCats.some((c) => /mystery|detective/i.test(c)) && refCats.some((c) => /mystery|detective/i.test(c));
    const hasSciFi = candCats.some((c) => /science fiction|space fiction|dystopian/i.test(c)) && refCats.some((c) => /science fiction|space fiction|dystopian/i.test(c));
    const hasRomance = candCats.some((c) => /romance/i.test(c)) && refCats.some((c) => /romance/i.test(c));
    const hasAdventure = candCats.some((c) => /adventure/i.test(c)) && refCats.some((c) => /adventure/i.test(c));
    const hasPhilosophy = candCats.some((c) => /philosoph/i.test(c)) && refCats.some((c) => /philosoph/i.test(c));
    const hasSatire = candCats.some((c) => /satire/i.test(c)) && refCats.some((c) => /satire/i.test(c));
    const hasVictorian = candCats.some((c) => /victorian/i.test(c)) && refCats.some((c) => /victorian/i.test(c));

    const primaryCandCat = candCats[0] || '';
    const sharedNonGeneric = candCats.filter((c) => refCats.includes(c) && c !== 'Classics' && c !== 'Victorian Literature');

    if (/science fiction/i.test(primaryCandCat) && hasSciFi) {
      specificRefPhrase = `Shares classic Science Fiction themes with ${refTitle}`;
    } else if (hasGothic && hasPhilosophy) {
      specificRefPhrase = `Similar Gothic atmosphere to ${refTitle}`;
    } else if (hasGothic && hasHorror) {
      specificRefPhrase = `Shares Gothic Fiction and dark suspense with ${refTitle}`;
    } else if (hasGothic) {
      specificRefPhrase = `Similar Gothic atmosphere to ${refTitle}`;
    } else if (hasMystery) {
      specificRefPhrase = `Similar classic mystery and deduction to ${refTitle}`;
    } else if (hasSciFi) {
      specificRefPhrase = `Shares classic Science Fiction themes with ${refTitle}`;
    } else if (hasRomance) {
      specificRefPhrase = `Shares themes of romance and society with ${refTitle}`;
    } else if (hasAdventure) {
      specificRefPhrase = `Shares classic adventure and journeys with ${refTitle}`;
    } else if (hasPhilosophy) {
      specificRefPhrase = `Shares philosophical reflections with ${refTitle}`;
    } else if (hasHorror) {
      specificRefPhrase = `Shares dark psychological horror with ${refTitle}`;
    } else if (hasSatire) {
      specificRefPhrase = `Shares sharp wit and literary satire with ${refTitle}`;
    } else if (sharedNonGeneric.length > 0) {
      specificRefPhrase = `Shares ${sharedNonGeneric[0]} themes with ${refTitle}`;
    } else if (hasVictorian) {
      specificRefPhrase = `Another Victorian classic with a similar atmosphere`;
    } else if (refSim >= 0.20) {
      specificRefPhrase = `Similar narrative style and atmosphere to ${refTitle}`;
    } else {
      specificRefPhrase = `Because you recently explored ${refTitle}`;
    }

    reasons.push(specificRefPhrase);
  } else if (contentScore >= 0.22) {
    reasons.push(`Shares thematic resonances with your previous reading`);
  }

  // 3. Category / Genre Affinity Reason
  const specificGenre = (candidate.categories || []).includes(matchedCategory)
    ? matchedCategory
    : (candidate.categories || []).includes(dominantCategory)
      ? dominantCategory
      : nonGenericCandidateCat;

  if (catScore >= 0.25 || (dominantCategory && candidate.categories?.includes(dominantCategory))) {
    if (specificGenre && specificGenre !== 'Classics' && specificGenre !== 'Victorian Literature') {
      reasons.push(`Matches your interest in ${specificGenre}`);
    } else if (dominantCategory && dominantCategory !== 'Classics') {
      reasons.push(`Matches your interest in ${dominantCategory}`);
    } else {
      reasons.push(`Matches your interest in ${primaryCat}`);
    }
  }

  // 4. Reading Length Reason
  if (userAvgTime >= 300 && candMins <= 180) {
    reasons.push(`A shorter evening read (~${hours} hr${hours > 1 ? 's' : ''}) than your usual books`);
  } else if (lengthScore >= 0.85) {
    reasons.push(`Comfortable reading length (~${hours} hr${hours > 1 ? 's' : ''}) matching your reading habits`);
  }

  // Fallback if empty
  if (reasons.length === 0) {
    reasons.push(`A timeless ${primaryCat.toLowerCase()} classic curated for your library`);
  }

  // Choose the single primary editorial reason string for Home card display
  let primaryReason = reasons[0];

  if (isAuthorMatch && behaviorScore >= 0.40) {
    if (candidate.categories?.some((c) => /mystery|detective/i.test(c))) {
      primaryReason = `Another classic mystery by ${candidate.author}`;
    } else if (candidate.categories?.some((c) => /science fiction|adventure/i.test(c))) {
      primaryReason = `Another classic adventure by ${candidate.author}`;
    } else {
      primaryReason = `Another work by ${candidate.author}`;
    }
  } else if (specificRefPhrase) {
    primaryReason = specificRefPhrase;
  } else if (isAuthorMatch) {
    primaryReason = `Another work by ${candidate.author}`;
  } else if (catScore >= 0.25 && specificGenre && specificGenre !== 'Classics' && specificGenre !== 'Victorian Literature') {
    primaryReason = `Matches your interest in ${specificGenre}`;
  } else if (userAvgTime >= 300 && candMins <= 180) {
    primaryReason = `A shorter evening read than your usual books`;
  } else if (dominantCategory && candidate.categories?.includes(dominantCategory) && dominantCategory !== 'Classics') {
    primaryReason = `Matches your interest in ${dominantCategory}`;
  } else if (catScore >= 0.30) {
    primaryReason = `Because you've been reading ${primaryCat}`;
  } else {
    primaryReason = reasons[0];
  }

  return {
    reasons,
    primaryReason
  };
}

/**
 * Core Hybrid Recommendation Pipeline.
 * Computes personalized recommendations from catalog metadata and reading activity.
 */
export function computeHybridRecommendations(catalog, readingHistory = [], customOptions = {}) {
  const cleanCatalog = (catalog || []).filter((b) => b && typeof b === 'object' && b.id && b.title && b.author);

  if (cleanCatalog.length === 0) {
    return {
      currentBook: null,
      currentProgress: null,
      recommended: [],
      moreLikeCurrent: [],
      isFresh: true,
      candidatePoolSize: 0,
      dominantCategory: null
    };
  }

  const limits = {
    recommendedCount: customOptions.recommendedCount || RECOMMENDER_CONFIG.limits.recommendedCount,
    moreLikeCurrentCount: customOptions.moreLikeCurrentCount || RECOMMENDER_CONFIG.limits.moreLikeCurrentCount
  };

  const thresholds = {
    completedPercent: customOptions.completedPercent || RECOMMENDER_CONFIG.thresholds.completedPercent,
    minRecommendationScore: customOptions.minRecommendationScore || RECOMMENDER_CONFIG.thresholds.minRecommendationScore,
    diversityLambda: customOptions.diversityLambda || RECOMMENDER_CONFIG.thresholds.diversityLambda
  };

  // 1. Build deterministic TF-IDF vectors
  const vectors = buildCatalogVectors(cleanCatalog);

  // 2. Validate reading history
  const validHistory = (readingHistory || [])
    .filter((r) => r && r.bookId && cleanCatalog.some((b) => b.id === r.bookId))
    .sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0));

  const isFresh = validHistory.length === 0;

  // --------------------------------------------------------------------------
  // COLD-START: Diverse starter selection across canonical literary pillars
  // --------------------------------------------------------------------------
  if (isFresh) {
    // Pick diverse starter books spanning different genres
    const starterPillars = [
      'Classics',
      'Gothic Fiction',
      'Science Fiction',
      'Adventure',
      'Detective / Mystery',
      'Philosophy'
    ];

    const selectedStarterIds = new Set();
    const starterBooks = [];

    // Try finding one book per genre pillar
    for (const pillar of starterPillars) {
      if (starterBooks.length >= limits.recommendedCount) break;
      const match = cleanCatalog.find((b) => 
        b &&
        !selectedStarterIds.has(b.id) &&
        Array.isArray(b.categories) &&
        b.categories.some((c) => c && c.toLowerCase().includes(pillar.toLowerCase()))
      );
      if (match) {
        selectedStarterIds.add(match.id);
        starterBooks.push(match);
      }
    }

    // Backfill with catalog order if needed
    for (const b of cleanCatalog) {
      if (starterBooks.length >= limits.recommendedCount) break;
      if (b && !selectedStarterIds.has(b.id)) {
        selectedStarterIds.add(b.id);
        starterBooks.push(b);
      }
    }

    const annotatedStarters = starterBooks.map((book) => {
      const cat = book.categories?.[0] || 'Literary';
      const reason = `A timeless ${cat.toLowerCase()} classic to begin your journey`;
      return {
        ...book,
        recommendationReason: reason,
        recommendationMetadata: {
          bookId: book.id,
          score: 1.0,
          contentSimilarity: 0.0,
          categoryAffinity: 0.0,
          currentBookSimilarity: 0.0,
          behaviorScore: 0.0,
          lengthPreference: 1.0,
          reasons: [reason]
        }
      };
    });

    return {
      currentBook: null,
      currentProgress: null,
      recommended: annotatedStarters,
      moreLikeCurrent: [],
      isFresh: true,
      candidatePoolSize: cleanCatalog.length,
      dominantCategory: null
    };
  }

  // --------------------------------------------------------------------------
  // ACTIVE USER HYBRID PIPELINE
  // --------------------------------------------------------------------------

  // Extract active read context
  const currentProgress = validHistory[0];
  const currentBook = cleanCatalog.find((b) => b.id === currentProgress.bookId) || null;
  const currentVector = currentBook ? vectors.get(currentBook.id) : null;
  const hasActiveRead = currentBook !== null && (currentProgress.progressPercent || 0) < thresholds.completedPercent;

  // Build preference profile
  const profile = getUserPreferenceProfile(cleanCatalog, validHistory);
  const weights = hasActiveRead
    ? { ...RECOMMENDER_CONFIG.weightsWithCurrent, ...(customOptions.weights || {}) }
    : { ...RECOMMENDER_CONFIG.weightsWithoutCurrent, ...(customOptions.weights || {}) };

  // Exclusion sets
  const completedIds = new Set(
    validHistory
      .filter((r) => (r.progressPercent || 0) >= thresholds.completedPercent)
      .map((r) => r.bookId)
  );

  // 3. Filter candidates: exclude current book, completed books, and unavailable entries
  const candidatePool = cleanCatalog.filter((b) => {
    if (!b || !b.id || !b.title || !b.author) return false;
    if (b.reading_availability === 'unavailable') return false;
    if (currentBook && b.id === currentBook.id) return false;
    if (completedIds.has(b.id)) return false;
    return true;
  });

  // 4. Score all candidate books across multi-signal hybrid model
  const scoredItems = candidatePool.map((candidate) => {
    const candidateVec = vectors.get(candidate.id);

    // --- Signal 1: Content Similarity to Historical Reads ---
    let maxContentSim = 0.0;
    let avgContentSim = 0.0;
    let simCount = 0;
    let mostSimilarHistoryBook = null;

    for (const record of validHistory) {
      const histVec = vectors.get(record.bookId);
      if (histVec) {
        const sim = computeCosineSimilarity(candidateVec, histVec);
        if (sim > maxContentSim) {
          maxContentSim = sim;
          mostSimilarHistoryBook = cleanCatalog.find((b) => b.id === record.bookId) || null;
        }
        avgContentSim += sim;
        simCount++;
      }
    }
    avgContentSim = simCount > 0 ? avgContentSim / simCount : 0.0;
    const contentScore = maxContentSim * 0.70 + avgContentSim * 0.30;

    // --- Signal 2: Genre / Category Affinity ---
    let catScore = 0.0;
    let matchedCategory = null;
    if (Array.isArray(candidate.categories) && candidate.categories.length > 0) {
      for (const cat of candidate.categories) {
        if (profile.normalizedCatScores.has(cat)) {
          const s = profile.normalizedCatScores.get(cat);
          if (s > catScore) {
            catScore = s;
            matchedCategory = cat;
          }
        }
      }
    }

    // --- Signal 3: Direct Content & Category Similarity to Current Read ---
    let currentBookSim = 0.0;
    if (hasActiveRead && currentVector && candidateVec) {
      const directVecSim = computeCosineSimilarity(candidateVec, currentVector);
      let catOverlap = 0;
      if (Array.isArray(candidate.categories) && Array.isArray(currentBook.categories)) {
        for (const cat of candidate.categories) {
          if (currentBook.categories.includes(cat)) catOverlap++;
        }
      }
      const normCatOverlap = Math.min(1.0, catOverlap / (currentBook.categories?.length || 1));
      currentBookSim = directVecSim * 0.70 + normCatOverlap * 0.30;
    }

    // --- Signal 4: Reading Behavior & Author Affinity ---
    let behaviorScore = 0.0;
    if (candidate.author) {
      const authorKey = candidate.author.toLowerCase().trim();
      if (profile.authorWeights.has(authorKey)) {
        behaviorScore = profile.authorWeights.get(authorKey);
      }
    }

    // --- Signal 5: Book Length Preference ---
    const lengthScore = calculateLengthPreferenceScore(candidate, profile.avgReadingTimeMinutes);

    // --- Final Hybrid Score Calculation ---
    const hybridScore =
      contentScore * weights.contentSimilarity +
      catScore * weights.categoryAffinity +
      currentBookSim * weights.currentBookSimilarity +
      behaviorScore * weights.behaviorScore +
      lengthScore * weights.lengthPreference;

    // Generate explainability data
    const explainability = generateExplainabilityData({
      candidate,
      currentBook: hasActiveRead ? currentBook : null,
      mostSimilarHistoryBook,
      maxContentSim,
      dominantCategory: profile.dominantCategory,
      matchedCategory,
      contentScore,
      catScore,
      currentBookSim,
      behaviorScore,
      lengthScore,
      userAvgTime: profile.avgReadingTimeMinutes,
      hasAuthorInHistory: Boolean(candidate.author && profile.authorWeights.has(candidate.author.toLowerCase().trim()))
    });

    return {
      candidate,
      score: hybridScore,
      contentScore,
      catScore,
      currentBookSim,
      behaviorScore,
      lengthScore,
      reasons: explainability.reasons,
      primaryReason: explainability.primaryReason
    };
  });

  // 5. Deterministic Diversity Reranking using Maximal Marginal Relevance (MMR)
  // Sort initial candidates deterministically
  scoredItems.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.00001) return b.score - a.score;
    const titleCmp = (a.candidate.title || '').localeCompare(b.candidate.title || '');
    if (titleCmp !== 0) return titleCmp;
    return (a.candidate.id || '').localeCompare(b.candidate.id || '');
  });

  const selectedRecommendations = [];
  const selectedIds = new Set();
  const targetCount = Math.min(limits.recommendedCount, scoredItems.length);

  while (selectedRecommendations.length < targetCount && scoredItems.length > 0) {
    if (selectedRecommendations.length === 0) {
      // Pick top-scoring item unconditionally as anchor
      const best = scoredItems.shift();
      selectedRecommendations.push(best);
      selectedIds.add(best.candidate.id);
    } else {
      // Find candidate maximizing score - lambda * max(similarity to already selected)
      let bestIdx = 0;
      let bestMMRScore = -Infinity;

      for (let i = 0; i < scoredItems.length; i++) {
        const item = scoredItems[i];
        const itemVec = vectors.get(item.candidate.id);

        let maxSimToSelected = 0.0;
        for (const selected of selectedRecommendations) {
          const selVec = vectors.get(selected.candidate.id);
          const sim = computeCosineSimilarity(itemVec, selVec);
          if (sim > maxSimToSelected) maxSimToSelected = sim;
        }

        const mmrScore = item.score - (thresholds.diversityLambda * maxSimToSelected);

        if (mmrScore > bestMMRScore) {
          bestMMRScore = mmrScore;
          bestIdx = i;
        }
      }

      const chosen = scoredItems.splice(bestIdx, 1)[0];
      selectedRecommendations.push(chosen);
      selectedIds.add(chosen.candidate.id);
    }
  }

  // Format "PICKED FOR YOU" results
  const recommended = selectedRecommendations.map((item) => ({
    ...item.candidate,
    recommendationReason: item.primaryReason,
    recommendationMetadata: {
      bookId: item.candidate.id,
      score: Number(item.score.toFixed(4)),
      contentSimilarity: Number(item.contentScore.toFixed(4)),
      categoryAffinity: Number(item.catScore.toFixed(4)),
      currentBookSimilarity: Number(item.currentBookSim.toFixed(4)),
      behaviorScore: Number(item.behaviorScore.toFixed(4)),
      lengthPreference: Number(item.lengthScore.toFixed(4)),
      reasons: item.reasons
    }
  }));

  // --------------------------------------------------------------------------
  // 6. Compute "MORE LIKE WHAT YOU'RE READING"
  // --------------------------------------------------------------------------
  let moreLikeCurrent = [];

  if (currentBook && currentVector) {
    const curTitle = getShortBookTitle(currentBook.title);
    const currMins = currentBook.estimated_reading_time || (currentBook.word_count ? Math.round(currentBook.word_count / 225) : 300);

    const moreLikeScored = cleanCatalog
      .filter((b) => b && b.id && b.id !== currentBook.id && !completedIds.has(b.id))
      .map((candidate) => {
        const candidateVec = vectors.get(candidate.id);
        const tfIdfSim = computeCosineSimilarity(candidateVec, currentVector);

        // Category overlap with current book
        let catOverlap = 0;
        const sharedCategories = [];
        if (Array.isArray(candidate.categories) && Array.isArray(currentBook.categories)) {
          for (const cat of candidate.categories) {
            if (currentBook.categories.includes(cat)) {
              catOverlap++;
              sharedCategories.push(cat);
            }
          }
        }
        const normCatOverlap = Math.min(1.0, catOverlap / (currentBook.categories?.length || 1));

        // Author similarity
        const isSameAuthor = Boolean(candidate.author && currentBook.author && candidate.author.toLowerCase().trim() === currentBook.author.toLowerCase().trim());
        const authorMatch = isSameAuthor ? 0.20 : 0.0;

        // Combined relevance to current book
        const simScore = tfIdfSim * 0.60 + normCatOverlap * 0.30 + authorMatch;

        return {
          candidate,
          score: simScore,
          tfIdfSim,
          normCatOverlap,
          isSameAuthor,
          sharedCategories
        };
      })
      .filter((item) => item.score >= 0.05);

    // Sort deterministically
    moreLikeScored.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.00001) return b.score - a.score;
      return (a.candidate.title || '').localeCompare(b.candidate.title || '');
    });

    // Diversity selection for More Like Current
    const selectedMoreLike = [];
    const moreLikeTarget = Math.min(limits.moreLikeCurrentCount, moreLikeScored.length);

    while (selectedMoreLike.length < moreLikeTarget && moreLikeScored.length > 0) {
      if (selectedMoreLike.length === 0) {
        selectedMoreLike.push(moreLikeScored.shift());
      } else {
        let bestIdx = 0;
        let bestScore = -Infinity;

        for (let i = 0; i < moreLikeScored.length; i++) {
          const item = moreLikeScored[i];
          const itemVec = vectors.get(item.candidate.id);

          let maxSim = 0.0;
          for (const sel of selectedMoreLike) {
            const selVec = vectors.get(sel.candidate.id);
            const sim = computeCosineSimilarity(itemVec, selVec);
            if (sim > maxSim) maxSim = sim;
          }

          const mmrScore = item.score - (0.12 * maxSim);
          if (mmrScore > bestScore) {
            bestScore = mmrScore;
            bestIdx = i;
          }
        }

        selectedMoreLike.push(moreLikeScored.splice(bestIdx, 1)[0]);
      }
    }

    moreLikeCurrent = selectedMoreLike.map((item) => {
      const cand = item.candidate;
      const candMins = cand.estimated_reading_time || (cand.word_count ? Math.round(cand.word_count / 225) : 300);
      const hours = Math.max(1, Math.round(candMins / 60));
      const sharedCats = item.sharedCategories || [];

      // Build rich, fact-based reasons array
      const itemReasons = [];
      if (item.isSameAuthor) {
        itemReasons.push(`Another work by ${currentBook.author}`);
      }
      if (sharedCats.length > 0) {
        const filteredCats = sharedCats.filter((c) => c !== 'Classics' && c !== 'Victorian Literature');
        if (filteredCats.length > 0) {
          const joinText = filteredCats.slice(0, 2).join(' and ');
          itemReasons.push(`Shares ${joinText} with ${curTitle}`);
        } else {
          itemReasons.push(`Shares classic literary tradition with ${curTitle}`);
        }
      }
      if (item.tfIdfSim >= 0.12) {
        itemReasons.push(`Similar narrative style, tone, and themes to ${curTitle}`);
      }
      if (candMins <= 180 && currMins >= 300) {
        itemReasons.push(`A concise evening read (~${hours} hr${hours > 1 ? 's' : ''})`);
      } else {
        itemReasons.push(`Estimated reading time: ~${hours} hr${hours > 1 ? 's' : ''}`);
      }

      // Determine primary editorial reason
      const candCats = cand.categories || [];
      const currCats = currentBook.categories || [];

      const hasGothic = candCats.some((c) => /gothic/i.test(c)) && currCats.some((c) => /gothic/i.test(c));
      const hasHorror = candCats.some((c) => /horror/i.test(c)) && currCats.some((c) => /horror/i.test(c));
      const hasMystery = candCats.some((c) => /mystery|detective/i.test(c)) && currCats.some((c) => /mystery|detective/i.test(c));
      const hasSciFi = candCats.some((c) => /science fiction|space fiction|dystopian/i.test(c)) && currCats.some((c) => /science fiction|space fiction|dystopian/i.test(c));
      const hasRomance = candCats.some((c) => /romance/i.test(c)) && currCats.some((c) => /romance/i.test(c));
      const hasAdventure = candCats.some((c) => /adventure/i.test(c)) && currCats.some((c) => /adventure/i.test(c));
      const hasPhilosophy = candCats.some((c) => /philosoph/i.test(c)) && currCats.some((c) => /philosoph/i.test(c));
      const hasSatire = candCats.some((c) => /satire/i.test(c)) && currCats.some((c) => /satire/i.test(c));
      const hasVictorian = candCats.some((c) => /victorian/i.test(c)) && currCats.some((c) => /victorian/i.test(c));

      const primaryCandCat = candCats[0] || '';
      const sharedNonGeneric = candCats.filter((c) => currCats.includes(c) && c !== 'Classics' && c !== 'Victorian Literature');

      let reason = '';
      if (item.isSameAuthor) {
        if (candCats.some((c) => /mystery|detective/i.test(c))) {
          reason = `Another classic mystery by ${currentBook.author}`;
        } else if (candCats.some((c) => /science fiction|adventure/i.test(c))) {
          reason = `Another classic adventure by ${currentBook.author}`;
        } else {
          reason = `Another work by ${currentBook.author}`;
        }
      } else if (candMins <= 180 && currMins >= 300 && (hasGothic || hasHorror)) {
        reason = `A shorter Gothic read for an evening`;
      } else if (candMins <= 180 && currMins >= 300 && sharedNonGeneric.length > 0) {
        reason = `A shorter ${sharedNonGeneric[0].toLowerCase()} read (~${hours} hr${hours > 1 ? 's' : ''}) like ${curTitle}`;
      } else if (/science fiction/i.test(primaryCandCat) && hasSciFi) {
        reason = `Shares classic Science Fiction themes with ${curTitle}`;
      } else if (hasGothic && hasPhilosophy) {
        reason = `Similar Gothic atmosphere to ${curTitle}`;
      } else if (hasGothic && hasHorror) {
        reason = `Shares Gothic Fiction and dark suspense with ${curTitle}`;
      } else if (hasGothic) {
        reason = `Similar Gothic atmosphere to ${curTitle}`;
      } else if (hasMystery) {
        reason = `Another classic mystery with a similar atmosphere to ${curTitle}`;
      } else if (hasSciFi) {
        reason = `Shares classic Science Fiction themes with ${curTitle}`;
      } else if (hasRomance) {
        reason = `Shares themes of romance, society, and wit with ${curTitle}`;
      } else if (hasAdventure) {
        reason = `Shares classic adventure and journeys with ${curTitle}`;
      } else if (hasPhilosophy) {
        reason = `Shares deep philosophical themes with ${curTitle}`;
      } else if (hasHorror) {
        reason = `Shares dark psychological horror with ${curTitle}`;
      } else if (hasSatire) {
        reason = `Shares sharp wit and literary satire with ${curTitle}`;
      } else if (sharedNonGeneric.length > 0) {
        reason = `Shares ${sharedNonGeneric[0]} themes with ${curTitle}`;
      } else if (hasVictorian) {
        reason = `Another Victorian classic with a similar atmosphere`;
      } else if (item.tfIdfSim >= 0.18) {
        reason = `Similar psychological themes to ${curTitle}`;
      } else {
        reason = `Similar narrative style and atmosphere to ${curTitle}`;
      }

      return {
        ...item.candidate,
        recommendationReason: reason,
        recommendationMetadata: {
          bookId: item.candidate.id,
          score: Number(item.score.toFixed(4)),
          contentSimilarity: Number(item.tfIdfSim.toFixed(4)),
          categoryAffinity: Number(item.normCatOverlap.toFixed(4)),
          reasons: itemReasons
        }
      };
    });
  }

  return {
    currentBook,
    currentProgress,
    recommended,
    moreLikeCurrent,
    isFresh: false,
    candidatePoolSize: candidatePool.length,
    dominantCategory: profile.dominantCategory
  };
}

/**
 * Convenience API helper to query recommendations directly.
 */
export function getRecommendations({
  catalog,
  readingHistory = [],
  currentBookId = null,
  limit = 5,
  excludeIds = []
} = {}) {
  const historyToUse = [...(readingHistory || [])];
  if (currentBookId && !historyToUse.some((r) => r.bookId === currentBookId)) {
    historyToUse.unshift({
      bookId: currentBookId,
      progressPercent: 10,
      lastAccessedAt: Date.now()
    });
  }

  const result = computeHybridRecommendations(catalog, historyToUse, {
    recommendedCount: limit
  });

  if (excludeIds && excludeIds.length > 0) {
    const excludeSet = new Set(excludeIds);
    result.recommended = result.recommended.filter((b) => !excludeSet.has(b.id));
    result.moreLikeCurrent = result.moreLikeCurrent.filter((b) => !excludeSet.has(b.id));
  }

  return result;
}

/**
 * Verified category and thematic intent mapping for natural language reading searches.
 */
const INTENT_CATEGORY_MAP = [
  {
    category: 'Gothic Fiction',
    triggers: ['gothic', 'dark', 'eerie', 'spooky', 'haunted', 'macabre', 'vampire', 'monster', 'creepy', 'chilling', 'shadowy', 'sinister', 'ghost', 'spectre']
  },
  {
    category: 'Horror',
    triggers: ['horror', 'scary', 'frightening', 'terrifying', 'fear', 'dread', 'monsters', 'blood', 'macabre', 'grotesque']
  },
  {
    category: 'Mystery',
    triggers: ['mystery', 'mysterious', 'detective', 'crime', 'investigation', 'clue', 'whodunit', 'puzzle', 'secrets', 'unsolved', 'sleuth', 'investigator']
  },
  {
    category: 'Detective Fiction',
    triggers: ['detective', 'holmes', 'watson', 'investigator', 'police', 'sleuth', 'crime', 'murder']
  },
  {
    category: 'Romance',
    triggers: ['romance', 'romantic', 'love', 'passion', 'courtship', 'marriage', 'heart', 'lovers', 'affection', 'sweet']
  },
  {
    category: 'Adventure',
    triggers: ['adventure', 'journey', 'quest', 'sea', 'ocean', 'ship', 'sail', 'voyage', 'expedition', 'treasure', 'island', 'wilderness', 'survival', 'pirate', 'explore']
  },
  {
    category: 'Science Fiction',
    triggers: ['sci-fi', 'science fiction', 'space', 'alien', 'martian', 'future', 'futuristic', 'time travel', 'invention', 'technology', 'scientific']
  },
  {
    category: 'Space Fiction',
    triggers: ['space', 'mars', 'martian', 'moon', 'orbit', 'planets', 'stars']
  },
  {
    category: 'Fantasy',
    triggers: ['fantasy', 'magic', 'magical', 'wonderland', 'fairy', 'myth', 'mythology', 'fable', 'enchantment', 'wizard']
  },
  {
    category: 'Philosophy',
    triggers: ['philosophy', 'philosophical', 'existential', 'ethics', 'morality', 'meaning', 'truth', 'contemplative', 'thoughtful', 'mind']
  },
  {
    category: 'Philosophical Fiction',
    triggers: ['philosophy', 'philosophical', 'existential', 'meaning of life', 'human condition', 'absurd', 'kafkaesque']
  },
  {
    category: 'Satire',
    triggers: ['satire', 'satirical', 'funny', 'humor', 'humorous', 'comedy', 'witty', 'wit', 'irony', 'ironic', 'parody', 'sarcasm']
  },
  {
    category: 'Comedy',
    triggers: ['comedy', 'comic', 'funny', 'laugh', 'humor', 'amusing', 'lighthearted', 'hilarious']
  },
  {
    category: 'Classics',
    triggers: ['classic', 'classics', 'masterpiece', 'literature', 'literary', 'great classic', 'timeless']
  },
  {
    category: 'Victorian Literature',
    triggers: ['victorian', 'society', 'manners', '19th century', 'london', 'england', 'aristocracy', 'social']
  },
  {
    category: 'Drama',
    triggers: ['drama', 'dramatic', 'tragedy', 'tragic', 'theatre', 'play', 'tension', 'conflict']
  },
  {
    category: 'Dystopian',
    triggers: ['dystopian', 'dystopia', 'totalitarian', 'oppression', 'state', 'surveillance']
  },
  {
    category: 'Historical Fiction',
    triggers: ['historical', 'history', 'revolution', 'war', 'ancient', 'medieval', 'era']
  },
  {
    category: 'Psychological Fiction',
    triggers: ['psychological', 'sanity', 'madness', 'psychology', 'guilt', 'conscience', 'paranoia']
  }
];

/**
 * Detects matched categories and keyword tags from natural language query text.
 */
function detectIntentCategories(query) {
  if (!query || typeof query !== 'string') return { matchedCategories: new Set(), intentTags: [] };
  const clean = query.toLowerCase();
  const matchedCategories = new Set();
  const intentTags = [];

  for (const entry of INTENT_CATEGORY_MAP) {
    let matched = false;
    for (const trigger of entry.triggers) {
      const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'i');
      if (re.test(clean)) {
        matched = true;
        if (!intentTags.includes(trigger)) {
          intentTags.push(trigger);
        }
      }
    }
    if (matched) {
      matchedCategories.add(entry.category);
    }
  }

  return { matchedCategories, intentTags };
}

/**
 * Extracts length and pacing preference intent modifiers from natural language queries.
 */
export function extractLengthIntent(query) {
  if (!query || typeof query !== 'string') {
    return {
      hasLengthIntent: false,
      targetMinutes: null,
      modifier: null,
      label: null
    };
  }

  const clean = query.toLowerCase();

  // 1. Check for short / quick / novella or "not too long" (meaning short)
  if (/\b(not\s+(too\s+|very\s+|super\s+)?long)\b/i.test(clean) ||
      /\b(short|quick|brief|novella|bite[- ]sized|fast|fast[- ]read)\b/i.test(clean)) {
    return {
      hasLengthIntent: true,
      targetMinutes: 100, // ~1.5 - 2 hrs (novellas, plays, short classics)
      modifier: 'short',
      label: 'Short (~1–2 hrs)'
    };
  }

  // 2. Check for long / epic / immersive / tome
  if (/\b(long|epic|immersive|tome|sweeping|lengthy|deep\s+read)\b/i.test(clean)) {
    return {
      hasLengthIntent: true,
      targetMinutes: 540, // ~8–10+ hrs (epic novels, tomes)
      modifier: 'long',
      label: 'Long & Epic (>8 hrs)'
    };
  }

  return {
    hasLengthIntent: false,
    targetMinutes: null,
    modifier: null,
    label: null
  };
}

/**
 * Generates an editorial explanation reason for an intent search result.
 */
function generateIntentReason({ candidate, contentSim, catScore, lengthIntent, intentTags, matchedCategories }) {
  const primaryCat = (candidate.categories && candidate.categories[0]) || 'Classic';
  const hours = Math.max(1, Math.round((candidate.estimated_reading_time || 300) / 60));

  if (lengthIntent.hasLengthIntent && lengthIntent.modifier === 'short' && (candidate.estimated_reading_time || 300) <= 180) {
    if (matchedCategories.has('Gothic Fiction') || matchedCategories.has('Horror')) {
      return `A quick, atmospheric gothic story (~${hours} hr${hours > 1 ? 's' : ''})`;
    }
    if (matchedCategories.has('Romance')) {
      return `A charming, brief romantic story (~${hours} hr${hours > 1 ? 's' : ''})`;
    }
    if (matchedCategories.has('Mystery') || matchedCategories.has('Detective Fiction')) {
      return `A fast, intriguing mystery (~${hours} hr${hours > 1 ? 's' : ''})`;
    }
    return `A concise read (~${hours} hr${hours > 1 ? 's' : ''}) matching your requested length`;
  }

  if (lengthIntent.hasLengthIntent && lengthIntent.modifier === 'long' && (candidate.estimated_reading_time || 300) >= 360) {
    return `An epic, immersive ${primaryCat.toLowerCase()} masterwork (~${hours} hrs)`;
  }

  if (matchedCategories.has('Gothic Fiction') || matchedCategories.has('Horror')) {
    return `Atmospheric gothic atmosphere, mystery, and dark classic themes`;
  }
  if (matchedCategories.has('Romance') && (matchedCategories.has('Victorian Literature') || intentTags.includes('society'))) {
    return `Explores timeless themes of love, courtship, and society`;
  }
  if (matchedCategories.has('Romance')) {
    return `A timeless romantic classic filled with emotion and wit`;
  }
  if (matchedCategories.has('Adventure')) {
    return `An exhilarating classic adventure across perilous journeys`;
  }
  if (matchedCategories.has('Satire') || matchedCategories.has('Comedy')) {
    return `Sharp literary wit, humor, and brilliant satire`;
  }
  if (matchedCategories.has('Mystery') || matchedCategories.has('Detective Fiction')) {
    return `A gripping classic mystery of suspense and deduction`;
  }
  if (matchedCategories.has('Science Fiction') || matchedCategories.has('Space Fiction')) {
    return `Visionary classic science fiction and imaginative worlds`;
  }
  if (matchedCategories.has('Philosophy') || matchedCategories.has('Philosophical Fiction')) {
    return `Deep philosophical contemplation on the human condition`;
  }

  if (contentSim >= 0.15) {
    return `Strong thematic resonance with your reading search`;
  }

  return `A celebrated ${primaryCat.toLowerCase()} classic matching your search`;
}

/**
 * Searches and ranks books from the catalog based on natural-language reading intent.
 * Reuses unit-normalized TF-IDF cosine similarity, category resonance, and optional length preference.
 */
export function searchByReadingIntent(query, catalog, options = {}) {
  const cleanCatalog = (catalog || []).filter(
    (b) => b && typeof b === 'object' && b.id && b.title && b.author && b.reading_availability !== 'unavailable'
  );

  const limit = Math.max(1, typeof options.limit === 'number' ? options.limit : 5);
  const minScore = typeof options.minScore === 'number' ? options.minScore : 0.01;
  const excludedSet = new Set(options.excludedBookIds || options.excludeIds || []);

  const cleanQuery = typeof query === 'string' ? query.trim() : '';
  if (!cleanQuery || cleanCatalog.length === 0) {
    const emptyRes = {
      query: cleanQuery,
      results: [],
      intentTags: [],
      lengthConstraint: null,
      totalMatches: 0
    };
    return emptyRes;
  }

  // 1. Vectorize query & catalog
  const queryVector = buildQueryVector(cleanQuery, cleanCatalog);
  const catalogVectors = buildCatalogVectors(cleanCatalog);

  // 2. Extract intent dimensions (length & category/genre)
  const lengthIntent = extractLengthIntent(cleanQuery);
  const { matchedCategories, intentTags } = detectIntentCategories(cleanQuery);

  // If query yielded no vector terms and no category/length triggers
  if (queryVector.size === 0 && matchedCategories.size === 0 && !lengthIntent.hasLengthIntent) {
    return {
      query: cleanQuery,
      results: [],
      intentTags: [],
      lengthConstraint: null,
      totalMatches: 0
    };
  }

  // 3. Score candidates
  const scoredCandidates = [];

  for (const candidate of cleanCatalog) {
    if (excludedSet.has(candidate.id)) continue;

    const candidateVec = catalogVectors.get(candidate.id);
    const contentSim = queryVector.size > 0 && candidateVec ? computeCosineSimilarity(queryVector, candidateVec) : 0.0;

    // Category resonance
    let catScore = 0.0;
    if (matchedCategories.size > 0 && Array.isArray(candidate.categories) && candidate.categories.length > 0) {
      const matchingCats = candidate.categories.filter((c) => matchedCategories.has(c));
      if (matchingCats.length > 0) {
        catScore = Math.min(1.0, 0.70 + 0.30 * (matchingCats.length / matchedCategories.size));
      }
    }

    // Length preference
    let lengthScore = 1.0;
    if (lengthIntent.hasLengthIntent) {
      lengthScore = calculateLengthPreferenceScore(candidate, lengthIntent.targetMinutes);
    }

    // Weighted intent score
    let intentScore = 0.0;
    if (!lengthIntent.hasLengthIntent) {
      intentScore = contentSim * 0.70 + catScore * 0.30;
    } else {
      intentScore = contentSim * 0.55 + catScore * 0.25 + lengthScore * 0.20;
    }

    if (intentScore >= minScore) {
      const reason = generateIntentReason({
        candidate,
        contentSim,
        catScore,
        lengthIntent,
        intentTags,
        matchedCategories
      });

      scoredCandidates.push({
        candidate,
        intentScore,
        contentSim,
        catScore,
        lengthScore,
        reason
      });
    }
  }

  // 4. Sort deterministically
  scoredCandidates.sort((a, b) => {
    if (Math.abs(b.intentScore - a.intentScore) > 0.00001) return b.intentScore - a.intentScore;
    const titleCmp = (a.candidate.title || '').localeCompare(b.candidate.title || '');
    if (titleCmp !== 0) return titleCmp;
    return (a.candidate.id || '').localeCompare(b.candidate.id || '');
  });

  // 5. Diversity Reranking using MMR (lambda = 0.15)
  const selected = [];
  const targetLimit = Math.min(limit, scoredCandidates.length);

  while (selected.length < targetLimit && scoredCandidates.length > 0) {
    if (selected.length === 0) {
      selected.push(scoredCandidates.shift());
    } else {
      let bestIdx = 0;
      let bestMMRScore = -Infinity;

      for (let i = 0; i < scoredCandidates.length; i++) {
        const item = scoredCandidates[i];
        const itemVec = catalogVectors.get(item.candidate.id);

        let maxSim = 0.0;
        for (const sel of selected) {
          const selVec = catalogVectors.get(sel.candidate.id);
          const sim = computeCosineSimilarity(itemVec, selVec);
          if (sim > maxSim) maxSim = sim;
        }

        const mmrScore = item.intentScore - (0.15 * maxSim);
        if (mmrScore > bestMMRScore) {
          bestMMRScore = mmrScore;
          bestIdx = i;
        }
      }

      selected.push(scoredCandidates.splice(bestIdx, 1)[0]);
    }
  }

  // 6. Format final results
  const results = selected.map((item) => ({
    ...item.candidate,
    intentScore: Number(item.intentScore.toFixed(4)),
    contentSimilarity: Number(item.contentSim.toFixed(4)),
    categoryMatchScore: Number(item.catScore.toFixed(4)),
    lengthScore: Number(item.lengthScore.toFixed(4)),
    recommendationReason: item.reason,
    intentTags: [...intentTags],
    lengthConstraint: lengthIntent.label || null
  }));

  results.query = cleanQuery;
  results.intentTags = [...intentTags];
  results.lengthConstraint = lengthIntent.label || null;
  results.totalMatches = scoredCandidates.length + selected.length;

  return {
    query: cleanQuery,
    results,
    intentTags: [...intentTags],
    lengthConstraint: lengthIntent.label || null,
    totalMatches: results.totalMatches
  };
}
