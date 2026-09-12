/**
 * Nook Chapter-Level Similarity Engine
 * 
 * Provides:
 * - Deterministic, lightweight chapter-to-chapter text representation & indexing
 * - Fast sparse cosine similarity matching across chapters
 * - Literary connection explanations (e.g. "Elsewhere in Nook")
 * - In-memory caching for zero-latency lookups during reading
 */

import { getBookById, fetchBookContent, getCachedCatalog } from './catalog.js';

const CHAPTER_STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t',
  'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
  'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s',
  'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
  'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s',
  'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re',
  'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'said', 'one', 'upon', 'like', 'see', 'now', 'made',
  'well', 'must', 'even', 'know', 'come', 'came', 'went', 'much', 'many', 'shall', 'may', 'might', 'first',
  'say', 'says', 'look', 'looked', 'seemed', 'though', 'thought', 'man', 'men', 'way', 'time', 'two',
  'chapter', 'page', 'section', 'part', 'volume', 'book', 'title', 'standard', 'ebooks', 'gutenberg',
  'project', 'edition', 'author', 'novel', 'story'
]);

/**
 * Clean chapter text into meaningful lowercase tokens.
 */
export function tokenizeChapterText(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !CHAPTER_STOPWORDS.has(w));
}

/**
 * Builds a unit-normalized sparse TF vector from an array of tokens.
 */
export function buildChapterVector(tokens) {
  if (!tokens || tokens.length === 0) return new Map();

  const termCounts = new Map();
  for (const t of tokens) {
    termCounts.set(t, (termCounts.get(t) || 0) + 1);
  }

  // Calculate Euclidean norm
  let sumSquares = 0;
  for (const count of termCounts.values()) {
    sumSquares += count * count;
  }
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) return new Map();

  const vector = new Map();
  for (const [term, count] of termCounts.entries()) {
    vector.set(term, count / norm);
  }

  return vector;
}

/**
 * Computes cosine similarity between two unit-normalized sparse vector maps.
 */
export function computeVectorSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.size === 0 || vecB.size === 0) return 0;

  let dot = 0;
  const [smallMap, largeMap] = vecA.size <= vecB.size ? [vecA, vecB] : [vecB, vecA];

  for (const [term, weightA] of smallMap.entries()) {
    const weightB = largeMap.get(term);
    if (weightB) {
      dot += weightA * weightB;
    }
  }

  return dot;
}

// In-memory cache for precomputed chapter vectors: bookId -> Array<ChapterVectorObj>
const chapterVectorCache = new Map();

/**
 * Indexes and caches chapter vectors for a given book content payload.
 */
export function indexBookChapters(contentData) {
  if (!contentData || !contentData.id || !Array.isArray(contentData.chapters)) {
    return [];
  }

  const bookId = contentData.id;
  if (chapterVectorCache.has(bookId)) {
    return chapterVectorCache.get(bookId);
  }

  const indexedChapters = [];

  for (const ch of contentData.chapters) {
    if (!ch || typeof ch.content !== 'string' || ch.content.trim().length === 0) {
      continue;
    }

    const tokens = tokenizeChapterText(ch.content);
    const vector = buildChapterVector(tokens);

    // Extract top frequent terms in this chapter for explanation derivation
    const termFreqs = new Map();
    for (const t of tokens) {
      termFreqs.set(t, (termFreqs.get(t) || 0) + 1);
    }
    const topTerms = Array.from(termFreqs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);

    indexedChapters.push({
      bookId,
      chapterNumber: typeof ch.number === 'number' ? ch.number : (indexedChapters.length + 1),
      chapterTitle: ch.title || `Chapter ${ch.number || indexedChapters.length + 1}`,
      tokensCount: tokens.length,
      vector,
      topTerms
    });
  }

  chapterVectorCache.set(bookId, indexedChapters);
  return indexedChapters;
}

/**
 * Generates an editorial explanation based on shared chapter themes and vocabulary.
 */
export function deriveChapterExplanation(sharedTerms = []) {
  if (!sharedTerms || sharedTerms.length === 0) {
    return 'Shares kindred atmospheric and narrative resonance';
  }

  const termsSet = new Set(sharedTerms.map((t) => t.toLowerCase()));

  // Thematic pattern matchers
  if (termsSet.has('science') || termsSet.has('creation') || termsSet.has('ambition') || termsSet.has('monster') || termsSet.has('experiment')) {
    return 'Echoes parallel themes of intellectual striving, scientific pursuit, and creation';
  }
  if (termsSet.has('solitude') || termsSet.has('isolation') || termsSet.has('lonely') || termsSet.has('desert') || termsSet.has('wilderness')) {
    return 'Explores kindred reflections on solitude, withdrawal, and quiet contemplation';
  }
  if (termsSet.has('society') || termsSet.has('manners') || termsSet.has('pride') || termsSet.has('marriage') || termsSet.has('fortune')) {
    return 'Touches on shared observations of social convention, class, and courtship';
  }
  if (termsSet.has('mystery') || termsSet.has('secret') || termsSet.has('darkness') || termsSet.has('night') || termsSet.has('shadows')) {
    return 'Shares a similar eerie atmosphere and suspenseful intrigue';
  }
  if (termsSet.has('death') || termsSet.has('grave') || termsSet.has('mortality') || termsSet.has('grief') || termsSet.has('tomb')) {
    return 'Dwells on parallel reflections on mortality, loss, and remembrance';
  }
  if (termsSet.has('sea') || termsSet.has('ocean') || termsSet.has('mountain') || termsSet.has('wind') || termsSet.has('storm')) {
    return 'Features kindred depictions of the sublime natural landscape and awe';
  }

  const sample = sharedTerms.slice(0, 3).map((t) => `“${t}”`).join(', ');
  return `Explores parallel literary motifs around ${sample}`;
}

/**
 * Finds semantically related chapters across the catalog for a given source chapter.
 * 
 * @param {string} bookId - Source book ID
 * @param {number} chapterNumber - Source chapter number
 * @param {Object} options - Configuration options
 * @param {Array<Object>} options.catalog - Full verified book catalog
 * @param {number} options.limit - Max similar chapters to return (default: 3)
 * @param {number} options.minSimilarity - Threshold below which matches are omitted (default: 0.04)
 * @param {boolean} options.excludeSameBook - Whether to omit other chapters from the same book (default: true)
 * @param {Object} options.contentData - Optional preloaded content.json for source book
 * @param {Array<Object>} options.candidateContents - Optional preloaded contents for candidate books
 * @returns {Promise<Object>} Formatted similarity results
 */
export async function findSimilarChapters(bookId, chapterNumber, options = {}) {
  const {
    catalog = [],
    limit = 3,
    minSimilarity = 0.04,
    excludeSameBook = true,
    contentData = null,
    candidateContents = null
  } = options;

  if (!bookId || typeof chapterNumber !== 'number') {
    return { sourceChapter: null, results: [] };
  }

  // 1. Resolve source book content
  let sourceBookContent = contentData;
  if (!sourceBookContent) {
    try {
      sourceBookContent = await fetchBookContent(bookId);
    } catch {
      return { sourceChapter: null, results: [] };
    }
  }

  if (!sourceBookContent) {
    return { sourceChapter: null, results: [] };
  }

  const sourceChapters = indexBookChapters(sourceBookContent);
  const targetChapter = sourceChapters.find((c) => c.chapterNumber === chapterNumber);

  if (!targetChapter || !targetChapter.vector || targetChapter.vector.size === 0) {
    return {
      sourceChapter: targetChapter ? {
        bookId,
        bookTitle: sourceBookContent.title || bookId,
        chapterNumber,
        chapterTitle: targetChapter.chapterTitle
      } : null,
      results: []
    };
  }

  const sourceChapterInfo = {
    bookId,
    bookTitle: sourceBookContent.title || (getBookById(bookId)?.title) || bookId,
    author: sourceBookContent.author || (getBookById(bookId)?.author) || 'Unknown Author',
    chapterNumber,
    chapterTitle: targetChapter.chapterTitle
  };

  // 2. Resolve Candidate Chapters
  let candidateChapterList = [];

  if (Array.isArray(candidateContents) && candidateContents.length > 0) {
    for (const cData of candidateContents) {
      if (!cData || (excludeSameBook && cData.id === bookId)) continue;
      candidateChapterList.push(...indexBookChapters(cData));
    }
  } else {
    // If cache has few or no external books, lazily preload top candidate books from catalog
    const cat = (Array.isArray(catalog) && catalog.length > 0) ? catalog : (getCachedCatalog() || []);
    if (cat.length > 0 && chapterVectorCache.size <= 2) {
      const sourceBook = getBookById(bookId) || cat.find((b) => b.id === bookId);
      const sourceCategories = new Set(sourceBook?.categories || []);
      
      // Pick related books from same/shared categories or author, falling back to top catalog pool
      let candidateBooks = cat.filter((b) => {
        if (!b || b.id === bookId) return false;
        if (sourceBook && b.author === sourceBook.author) return true;
        return (b.categories || []).some((c) => sourceCategories.has(c));
      });

      if (candidateBooks.length === 0) {
        candidateBooks = cat.filter((b) => b && b.id !== bookId);
      }

      const pool = candidateBooks.slice(0, 6);

      // Fetch and index candidate books concurrently
      await Promise.allSettled(
        pool.map(async (cb) => {
          try {
            if (!chapterVectorCache.has(cb.id)) {
              const content = await fetchBookContent(cb.id);
              indexBookChapters(content);
            }
          } catch {
            // Ignore missing content
          }
        })
      );
    }

    for (const [cBookId, chapters] of chapterVectorCache.entries()) {
      if (excludeSameBook && cBookId === bookId) continue;
      candidateChapterList.push(...chapters);
    }
  }

  // 3. Compute Similarities
  const scored = [];

  for (const cand of candidateChapterList) {
    // Exclude exact same chapter
    if (cand.bookId === bookId && cand.chapterNumber === chapterNumber) continue;
    if (excludeSameBook && cand.bookId === bookId) continue;

    const sim = computeVectorSimilarity(targetChapter.vector, cand.vector);
    if (sim < minSimilarity) continue;

    // Find shared terms
    const sharedTerms = [];
    for (const term of targetChapter.topTerms) {
      if (cand.vector.has(term)) {
        sharedTerms.push(term);
      }
    }

    const candBookMeta = getBookById(cand.bookId);

    scored.push({
      bookId: cand.bookId,
      bookTitle: (candBookMeta && candBookMeta.title) || cand.bookId,
      author: (candBookMeta && candBookMeta.author) || 'Unknown Author',
      cover: (candBookMeta && candBookMeta.cover) || `assets/covers/${cand.bookId}.webp`,
      chapterNumber: cand.chapterNumber,
      chapterTitle: cand.chapterTitle,
      similarity: Math.round(sim * 10000) / 10000,
      sharedTerms,
      explanation: deriveChapterExplanation(sharedTerms)
    });
  }

  // 4. Deterministic Sort: similarity desc, then bookTitle asc, then chapterNumber asc
  scored.sort((a, b) => {
    if (Math.abs(b.similarity - a.similarity) > 0.0001) {
      return b.similarity - a.similarity;
    }
    const titleCmp = a.bookTitle.localeCompare(b.bookTitle);
    if (titleCmp !== 0) return titleCmp;
    return a.chapterNumber - b.chapterNumber;
  });

  return {
    sourceChapter: sourceChapterInfo,
    results: scored.slice(0, Math.max(1, limit))
  };
}

/**
 * Clears in-memory chapter vector caches (used for testing).
 */
export function clearChapterCache() {
  chapterVectorCache.clear();
}
