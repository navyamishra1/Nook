/**
 * Nook Reading Personality Module
 * 
 * Provides:
 * - Lightweight, deterministic inference of literary reading tendencies from verified reading history and journal annotations
 * - Curated literary archetypes (The Atmospheric Wanderer, The Curious Detective, The Deep Diver, The Restless Explorer, The Humanist, The Dreamer of Strange Worlds, The Thoughtful Observer, The Classicist)
 * - Grounded, explainable evidence generation ("Why Nook Noticed This")
 * - Ethical boundary enforcement (ZERO psychological/personality diagnostic claims)
 * - Literary stationery UI renderer integrated with Reading Insights
 */

import { analyzeHighlights } from './highlight-intelligence.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Thresholds for reading personality confidence and discovery.
 */
export const COLD_START_MIN_BOOKS = 3;
export const COMPLETED_PROGRESS_THRESHOLD = 90;

/**
 * Curated Literary Archetypes.
 */
export const READING_ARCHETYPES = [
  {
    id: 'atmospheric-wanderer',
    title: 'The Atmospheric Wanderer',
    kicker: 'LITERARY READING PROFILE',
    description: 'Your reading repeatedly circles back to rich atmosphere, gothic tension, and shadowy mysteries that take their time building an immersive sense of place.',
    categories: ['Gothic Fiction', 'Horror', 'Mystery', 'Thriller', 'Psychological Fiction'],
    themes: ['Mystery & the Unknown', 'Isolation & Solitude', 'Nature & the Sublime'],
    preferredLengths: ['medium', 'long', 'immersive']
  },
  {
    id: 'curious-detective',
    title: 'The Curious Detective',
    kicker: 'LITERARY READING PROFILE',
    description: 'You are drawn toward investigations, intricate plots, enigmas, and analytical deductions where every clue, motive, and secret matters.',
    categories: ['Detective Fiction', 'Mystery', 'Thriller'],
    themes: ['Mystery & the Unknown', 'Morality, Guilt & Conscience', 'Identity & Transformation'],
    preferredLengths: ['short', 'medium', 'long']
  },
  {
    id: 'deep-diver',
    title: 'The Deep Diver',
    kicker: 'LITERARY READING PROFILE',
    description: 'You show a sustained preference for expansive, immersive masterworks and substantial volumes that reward patient, deep engagement.',
    categories: ['Victorian Literature', 'Epic Poetry', 'Historical Fiction', 'Classics'],
    themes: ['Mortality, Time & Memory', 'Morality, Guilt & Conscience', 'Society, Class & Propriety'],
    preferredLengths: ['long', 'immersive']
  },
  {
    id: 'restless-explorer',
    title: 'The Restless Explorer',
    kicker: 'LITERARY READING PROFILE',
    description: 'You move freely and curiously across varied literary genres, eras, and formats, resisting a single shelf in favor of wide discovery.',
    categories: [], // Broad diversity across all categories
    themes: [],
    preferredLengths: ['varied', 'short', 'medium', 'long']
  },
  {
    id: 'humanist',
    title: 'The Humanist',
    kicker: 'LITERARY READING PROFILE',
    description: 'Your reading frequently returns to the nuances of human relationships, social conventions, emotional devotion, and domestic drama.',
    categories: ['Romance', 'Literary Fiction', 'Coming-of-Age', 'Drama', 'Victorian Literature'],
    themes: ['Love & Devotion', 'Society, Class & Propriety', 'Identity & Transformation'],
    preferredLengths: ['medium', 'long', 'short']
  },
  {
    id: 'dreamer-of-strange-worlds',
    title: 'The Dreamer of Strange Worlds',
    kicker: 'LITERARY READING PROFILE',
    description: 'You are captivated by imaginative possibilities, scientific horizons, strange journeys, and speculative realms beyond everyday reality.',
    categories: ['Science Fiction', 'Fantasy', 'Adventure', 'Space Fiction', 'Dystopian', 'Mythology'],
    themes: ['Ambition & Creation', 'Nature & the Sublime', 'Identity & Transformation'],
    preferredLengths: ['short', 'medium', 'long']
  },
  {
    id: 'thoughtful-observer',
    title: 'The Thoughtful Observer',
    kicker: 'LITERARY READING PROFILE',
    description: 'You seek out philosophical contemplation, moral questions, psychological depth, and the inner conscience of characters.',
    categories: ['Philosophy', 'Philosophical Fiction', 'Psychological', 'Psychological Fiction', 'Absurdist Fiction', 'Satire'],
    themes: ['Morality, Guilt & Conscience', 'Identity & Transformation', 'Isolation & Solitude', 'Ambition & Creation'],
    preferredLengths: ['short', 'medium', 'long']
  },
  {
    id: 'classicist',
    title: 'The Classicist',
    kicker: 'LITERARY READING PROFILE',
    description: 'You return time and again to foundational masterworks, canonical literature, and the enduring literary heritage of past centuries.',
    categories: ['Classics', 'Historical Fiction', 'Epic Poetry', 'Victorian Literature'],
    themes: ['Mortality, Time & Memory', 'Society, Class & Propriety'],
    preferredLengths: ['medium', 'long', 'immersive']
  }
];

/**
 * Extracts and normalizes signals from reading history, catalog, and journal.
 * 
 * @param {Array<Object>} catalog - Full verified book catalog
 * @param {Array<Object>} readingHistory - Reading progress store
 * @param {Object} journalData - Highlights, notes, bookmarks
 * @returns {Object} Extracted signals
 */
export function extractReadingPersonalitySignals(catalog = [], readingHistory = [], journalData = {}) {
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const safeHistory = Array.isArray(readingHistory) ? readingHistory : [];
  const safeJournal = journalData && typeof journalData === 'object' ? journalData : {};

  const catalogMap = new Map();
  for (const book of safeCatalog) {
    if (book && typeof book === 'object' && book.id) {
      catalogMap.set(book.id, book);
    }
  }

  // Deduplicate and sanitize explored books
  const recordsByBookId = new Map();
  for (const rawRecord of safeHistory) {
    if (!rawRecord || typeof rawRecord !== 'object') continue;
    const bookId = rawRecord.bookId || (rawRecord.book && rawRecord.book.id) || rawRecord.id;
    if (!bookId || !catalogMap.has(bookId)) continue;

    const book = catalogMap.get(bookId);

    let timestamp = 0;
    if (typeof rawRecord.lastAccessedAt === 'number' && !isNaN(rawRecord.lastAccessedAt)) {
      timestamp = rawRecord.lastAccessedAt;
    } else if (typeof rawRecord.updatedAt === 'string') {
      const parsed = Date.parse(rawRecord.updatedAt);
      if (!isNaN(parsed)) timestamp = parsed;
    } else if (typeof rawRecord.updatedAt === 'number' && !isNaN(rawRecord.updatedAt)) {
      timestamp = rawRecord.updatedAt;
    }

    let progressPercent = 0;
    if (typeof rawRecord.progressPercent === 'number' && !isNaN(rawRecord.progressPercent)) {
      progressPercent = Math.max(0, Math.min(100, Math.round(rawRecord.progressPercent)));
    }

    const cleanRecord = {
      bookId,
      book,
      progressPercent,
      isCompleted: progressPercent >= COMPLETED_PROGRESS_THRESHOLD,
      lastAccessedAt: timestamp > 0 ? timestamp : null
    };

    if (!recordsByBookId.has(bookId)) {
      recordsByBookId.set(bookId, cleanRecord);
    } else {
      const existing = recordsByBookId.get(bookId);
      const existingTime = existing.lastAccessedAt || 0;
      const newTime = cleanRecord.lastAccessedAt || 0;
      if (newTime >= existingTime || cleanRecord.progressPercent >= existing.progressPercent) {
        recordsByBookId.set(bookId, cleanRecord);
      }
    }
  }

  const exploredRecords = Array.from(recordsByBookId.values());
  const exploredCount = exploredRecords.length;
  const completedCount = exploredRecords.filter(r => r.isCompleted).length;
  const inProgressCount = exploredCount - completedCount;
  const completionRate = exploredCount > 0 ? completedCount / exploredCount : 0;

  // Category counts and frequencies
  const categoryCounts = new Map();
  let totalCategoryOccurrences = 0;
  for (const rec of exploredRecords) {
    const cats = Array.isArray(rec.book.categories) ? rec.book.categories : [];
    for (const cat of cats) {
      if (typeof cat === 'string' && cat.trim()) {
        const cleanCat = cat.trim();
        categoryCounts.set(cleanCat, (categoryCounts.get(cleanCat) || 0) + 1);
        totalCategoryOccurrences++;
      }
    }
  }

  const sortedCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, count]) => ({
      category,
      count,
      ratio: totalCategoryOccurrences > 0 ? count / totalCategoryOccurrences : 0
    }));

  const distinctCategoryCount = categoryCounts.size;
  let categoryDiversity = 'focused';
  if (distinctCategoryCount >= 6 || (distinctCategoryCount >= 4 && exploredCount >= 4)) {
    categoryDiversity = 'broad';
  } else if (distinctCategoryCount >= 3) {
    categoryDiversity = 'moderate';
  }

  // Author counts
  const authorCounts = new Map();
  for (const rec of exploredRecords) {
    const author = rec.book.author || 'Unknown Author';
    authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
  }
  const topAuthors = Array.from(authorCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .filter(([_, count]) => count >= 2)
    .map(([author, count]) => ({ author, count }));

  // Length calculations
  const wordsList = exploredRecords
    .map(r => (typeof r.book.word_count === 'number' && r.book.word_count > 0 ? r.book.word_count : null))
    .filter(w => w !== null);

  const durationList = exploredRecords
    .map(r => (typeof r.book.estimated_reading_time === 'number' && r.book.estimated_reading_time > 0 ? r.book.estimated_reading_time : null))
    .filter(d => d !== null);

  const avgWordCount = wordsList.length > 0 ? Math.round(wordsList.reduce((a, b) => a + b, 0) / wordsList.length) : null;
  const avgDuration = durationList.length > 0 ? Math.round(durationList.reduce((a, b) => a + b, 0) / durationList.length) : null;

  let lengthTendency = 'medium';
  const minWord = wordsList.length > 0 ? Math.min(...wordsList) : 0;
  const maxWord = wordsList.length > 0 ? Math.max(...wordsList) : 0;

  if (wordsList.length >= 3 && (maxWord - minWord) > 85000 && minWord < 40000 && maxWord > 110000) {
    lengthTendency = 'varied';
  } else if (avgWordCount !== null) {
    if (avgWordCount < 45000 || (avgDuration !== null && avgDuration < 160)) {
      lengthTendency = 'short';
    } else if (avgWordCount > 95000 || (avgDuration !== null && avgDuration > 360)) {
      lengthTendency = 'long';
    } else {
      lengthTendency = 'medium';
    }
  }

  // Highlight themes extraction
  const highlights = Array.isArray(safeJournal.highlights) ? safeJournal.highlights : [];
  let highlightThemes = [];
  if (highlights.length > 0) {
    const analysis = analyzeHighlights(highlights, safeCatalog);
    if (analysis && analysis.hasData && Array.isArray(analysis.themes)) {
      highlightThemes = analysis.themes.map(t => ({
        id: t.id,
        title: t.title,
        highlightCount: t.highlightCount
      }));
    }
  }

  return {
    exploredCount,
    completedCount,
    inProgressCount,
    completionRate,
    exploredRecords,
    sortedCategories,
    distinctCategoryCount,
    categoryDiversity,
    topAuthors,
    avgWordCount,
    avgDuration,
    lengthTendency,
    highlightThemes,
    totalHighlights: highlights.length,
    totalNotes: Array.isArray(safeJournal.notes) ? safeJournal.notes.length : 0,
    totalBookmarks: Array.isArray(safeJournal.bookmarks) ? safeJournal.bookmarks.length : 0
  };
}

/**
 * Deterministically computes the Reading Personality from catalog, reading history, and journal data.
 * 
 * @param {Array<Object>} catalog - Full verified book catalog
 * @param {Array<Object>} readingHistory - Reading progress store
 * @param {Object} journalData - Highlights, notes, bookmarks
 * @returns {Object} Structured reading personality
 */
export function computeReadingPersonality(catalog = [], readingHistory = [], journalData = {}) {
  const signals = extractReadingPersonalitySignals(catalog, readingHistory, journalData);

  // Check Cold-Start Threshold
  // Requires at least 3 explored books (or 2 books with at least 2 highlights/notes)
  const hasSufficientHistory = signals.exploredCount >= COLD_START_MIN_BOOKS ||
    (signals.exploredCount >= 2 && (signals.totalHighlights >= 2 || signals.totalNotes >= 2));

  if (!hasSufficientHistory || signals.exploredCount === 0) {
    return {
      hasData: false,
      confidence: 'emerging',
      archetype: null,
      evidence: [],
      tendencies: {
        drawnTo: signals.sortedCategories.slice(0, 3).map(c => c.category),
        prefersLength: formatLengthTendency(signals.lengthTendency, signals.avgDuration),
        recurringThemes: signals.highlightThemes.slice(0, 2).map(t => t.title),
        completionHabit: formatCompletionHabit(signals.completionRate, signals.completedCount, signals.exploredCount)
      },
      signals,
      message: {
        title: 'Your Reading Personality Is Taking Shape',
        description: 'Explore a few books in Nook and your literary tendencies, thematic affinities, and reading patterns will begin to emerge.'
      }
    };
  }

  // Calculate affinity scores for each archetype
  const categoryMap = new Map(signals.sortedCategories.map(c => [c.category, c.count]));
  const themeMap = new Map(signals.highlightThemes.map(t => [t.title, t.highlightCount]));

  const scoredArchetypes = READING_ARCHETYPES.map((arch) => {
    let score = 0;
    const matchedCategories = [];
    const matchedThemes = [];

    // 1. Category Affinity Scoring
    for (const cat of arch.categories) {
      if (categoryMap.has(cat)) {
        const count = categoryMap.get(cat);
        const weight = cat === 'Classics' ? 1.0 : 4.0;
        score += count * weight;
        matchedCategories.push({ category: cat, count });
      }
    }

    // 2. Highlight Theme Scoring (Weight: 2.5 per matching theme instance)
    for (const theme of arch.themes) {
      if (themeMap.has(theme)) {
        const count = themeMap.get(theme);
        score += count * 2.5;
        matchedThemes.push({ theme, count });
      }
    }

    // 3. Archetype-Specific Behavioral Adjustments
    if (arch.id === 'restless-explorer') {
      // Rewards broad diversity and exploration across disparate shelves
      if (signals.categoryDiversity === 'broad') {
        score += 16.0;
      } else if (signals.categoryDiversity === 'moderate') {
        score += 6.0;
      }
      if (signals.distinctCategoryCount >= 4) {
        score += signals.distinctCategoryCount * 2.0;
      }
      if (signals.lengthTendency === 'varied') {
        score += 4.0;
      }
    } else if (arch.id === 'humanist') {
      const romanceCount = categoryMap.get('Romance') || 0;
      if (romanceCount > 0) {
        score += romanceCount * 7.0;
      }
      const humanistAuthors = ['Jane Austen', 'Charlotte Brontë', 'Emily Brontë', 'George Eliot', 'Louisa May Alcott', 'Gustave Flaubert'];
      for (const a of signals.topAuthors) {
        if (humanistAuthors.includes(a.author)) score += a.count * 6.0;
      }
      const loveThemeCount = themeMap.get('Love & Devotion') || 0;
      const societyThemeCount = themeMap.get('Society, Class & Propriety') || 0;
      if (loveThemeCount > 0) score += loveThemeCount * 4.0;
      if (societyThemeCount > 0) score += societyThemeCount * 3.0;
    } else if (arch.id === 'deep-diver') {
      // Rewards long immersive books and strong sustained reading depth
      if (signals.lengthTendency === 'long') {
        score += 14.0;
      }
      if (signals.avgWordCount && signals.avgWordCount > 130000) {
        score += 8.0;
      }
      if (signals.completionRate >= 0.5 && signals.exploredCount >= 2) {
        score += 4.0;
      }
    } else if (arch.id === 'classicist') {
      // Canonical classics focus when specific genres (Romance, Sci-Fi, Gothic, Detective, Phil) are low
      const specificNonClassics = (categoryMap.get('Romance') || 0) +
                                  (categoryMap.get('Science Fiction') || 0) +
                                  (categoryMap.get('Gothic Fiction') || 0) +
                                  (categoryMap.get('Detective Fiction') || 0) +
                                  (categoryMap.get('Philosophy') || 0);
      if (specificNonClassics <= 1 && signals.exploredCount >= 2) {
        score += 12.0;
      }
      const classicAuthors = ['Charles Dickens', 'Leo Tolstoy', 'Victor Hugo', 'Mark Twain', 'Nathaniel Hawthorne'];
      for (const a of signals.topAuthors) {
        if (classicAuthors.includes(a.author)) score += a.count * 5.0;
      }
      const histCount = (categoryMap.get('Historical Fiction') || 0) + (categoryMap.get('Epic Poetry') || 0);
      if (histCount > 0) score += histCount * 4.0;
    } else if (arch.id === 'curious-detective') {
      const detectiveCount = categoryMap.get('Detective Fiction') || 0;
      const mysteryCount = categoryMap.get('Mystery') || 0;
      if (detectiveCount > 0) score += detectiveCount * 7.0;
      if (mysteryCount > 0) score += mysteryCount * 4.0;
      const detectiveAuthors = ['Arthur Conan Doyle', 'Agatha Christie', 'Wilkie Collins', 'G. K. Chesterton'];
      for (const a of signals.topAuthors) {
        if (detectiveAuthors.includes(a.author)) score += a.count * 4.0;
      }
    } else if (arch.id === 'atmospheric-wanderer') {
      const gothicCount = categoryMap.get('Gothic Fiction') || 0;
      const horrorCount = categoryMap.get('Horror') || 0;
      if (gothicCount > 0) score += gothicCount * 6.0;
      if (horrorCount > 0) score += horrorCount * 4.0;
    } else if (arch.id === 'thoughtful-observer') {
      const philCount = (categoryMap.get('Philosophy') || 0) + (categoryMap.get('Philosophical Fiction') || 0);
      const psychCount = (categoryMap.get('Psychological') || 0) + (categoryMap.get('Psychological Fiction') || 0);
      const absurdistCount = categoryMap.get('Absurdist Fiction') || 0;
      if (philCount > 0) score += philCount * 7.0;
      if (psychCount > 0) score += psychCount * 4.0;
      if (absurdistCount > 0) score += absurdistCount * 4.0;
    } else if (arch.id === 'dreamer-of-strange-worlds') {
      const sciFiCount = (categoryMap.get('Science Fiction') || 0) + (categoryMap.get('Space Fiction') || 0);
      const fantasyCount = (categoryMap.get('Fantasy') || 0) + (categoryMap.get('Adventure') || 0);
      if (sciFiCount > 0) score += sciFiCount * 6.0;
      if (fantasyCount > 0) score += fantasyCount * 3.0;
    }

    // 4. Length Tendency Alignment Bonus
    if (arch.preferredLengths.includes(signals.lengthTendency)) {
      score += 1.5;
    }

    return {
      archetype: arch,
      score,
      matchedCategories,
      matchedThemes
    };
  });

  // Sort by score descending; deterministic tie-breaking by alphabetical id
  scoredArchetypes.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.001) {
      return b.score - a.score;
    }
    return a.archetype.id.localeCompare(b.archetype.id);
  });

  const bestMatch = scoredArchetypes[0];
  const selectedArchetype = bestMatch.archetype;

  // Generate grounded, explainable evidence bullet points ("Why Nook Noticed This")
  const evidence = generatePersonalityEvidence(selectedArchetype, signals, bestMatch);

  // Derive secondary literary tendencies
  const drawnToCategories = signals.sortedCategories
    .filter(c => c.category !== 'Classics' || signals.sortedCategories.length === 1)
    .slice(0, 3)
    .map(c => c.category);
  if (drawnToCategories.length === 0 && signals.sortedCategories.length > 0) {
    drawnToCategories.push(signals.sortedCategories[0].category);
  }

  const recurringThemeTitles = signals.highlightThemes.slice(0, 2).map(t => t.title);

  return {
    hasData: true,
    confidence: signals.exploredCount >= 4 ? 'established' : 'emerging',
    archetype: {
      id: selectedArchetype.id,
      title: selectedArchetype.title,
      kicker: selectedArchetype.kicker,
      description: selectedArchetype.description
    },
    evidence,
    tendencies: {
      drawnTo: drawnToCategories,
      prefersLength: formatLengthTendency(signals.lengthTendency, signals.avgDuration),
      recurringThemes: recurringThemeTitles,
      completionHabit: formatCompletionHabit(signals.completionRate, signals.completedCount, signals.exploredCount)
    },
    signals: {
      exploredCount: signals.exploredCount,
      completedCount: signals.completedCount,
      inProgressCount: signals.inProgressCount,
      completionRate: signals.completionRate,
      categoryDiversity: signals.categoryDiversity,
      lengthTendency: signals.lengthTendency,
      avgWordCount: signals.avgWordCount,
      avgDuration: signals.avgDuration,
      topCategories: signals.sortedCategories.slice(0, 5),
      topAuthors: signals.topAuthors,
      topThemes: signals.highlightThemes,
      highlightThemes: signals.highlightThemes
    }
  };
}

/**
 * Generates grounded, human-readable evidence strings explaining the archetype choice.
 */
function generatePersonalityEvidence(archetype, signals, matchDetails) {
  const evidence = [];

  // 1. Category Evidence
  if (signals.categoryDiversity === 'broad' && archetype.id === 'restless-explorer') {
    evidence.push(`Broad exploration spanning ${signals.distinctCategoryCount} distinct literary categories`);
  } else if (matchDetails.matchedCategories.length > 0) {
    const topMatched = matchDetails.matchedCategories.slice(0, 2);
    const catNames = topMatched.map(c => c.category).join(' and ');
    const totalMatchedCount = topMatched.reduce((acc, c) => acc + c.count, 0);
    evidence.push(`${totalMatchedCount} book${totalMatchedCount === 1 ? '' : 's'} explored in ${catNames}`);
  } else if (signals.sortedCategories.length > 0) {
    const topCat = signals.sortedCategories[0];
    evidence.push(`Frequent exploration of ${topCat.category} (${topCat.count} title${topCat.count === 1 ? '' : 's'})`);
  }

  // 2. Length & Scale Evidence
  if (signals.lengthTendency === 'long' || (signals.avgWordCount && signals.avgWordCount > 95000)) {
    const wordsFmt = signals.avgWordCount ? `${signals.avgWordCount.toLocaleString('en-US')} words` : 'substantial length';
    evidence.push(`Tendency toward longer, immersive volumes (avg. ~${wordsFmt})`);
  } else if (signals.lengthTendency === 'short') {
    const durFmt = signals.avgDuration ? `~${Math.round(signals.avgDuration / 60)} hrs` : 'concise formats';
    evidence.push(`Preference for concise, focused reading experiences (${durFmt})`);
  } else if (signals.lengthTendency === 'varied') {
    evidence.push('Appetite for both concise novellas and expansive multi-chapter epics');
  }

  // 3. Highlight Theme Evidence (if available)
  if (matchDetails.matchedThemes.length > 0) {
    const themeName = matchDetails.matchedThemes[0].theme;
    evidence.push(`Recurring annotations and saved passages reflecting ${themeName}`);
  } else if (signals.highlightThemes.length > 0) {
    const themeName = signals.highlightThemes[0].title;
    evidence.push(`Saved passages drawn to reflections on ${themeName}`);
  }

  // 4. Completion & Immersion Evidence
  if (signals.completedCount >= 2) {
    evidence.push(`${signals.completedCount} volumes read to completion`);
  } else if (signals.completedCount === 1 && signals.exploredCount >= 2) {
    evidence.push(`Dedicated focus with completed volumes and active reading in progress`);
  } else if (signals.inProgressCount >= 3) {
    evidence.push(`${signals.inProgressCount} active volumes being explored concurrently`);
  }

  // 5. Author Affinity Evidence (if recurring)
  if (signals.topAuthors.length > 0 && evidence.length < 4) {
    const author = signals.topAuthors[0];
    evidence.push(`Repeated affinity for the works of ${author.author} (${author.count} books)`);
  }

  // Ensure between 2 and 4 crisp evidence points
  return evidence.slice(0, 4);
}

function formatLengthTendency(tendency, avgDuration) {
  if (tendency === 'long') {
    return avgDuration ? `Longer immersive works (~${Math.round(avgDuration / 60)} hrs avg)` : 'Longer immersive works';
  }
  if (tendency === 'short') {
    return avgDuration ? `Concise, focused reads (~${Math.round(avgDuration / 60)} hrs avg)` : 'Concise, focused reads';
  }
  if (tendency === 'varied') {
    return 'Varied reading lengths';
  }
  return avgDuration ? `Medium-length volumes (~${Math.round(avgDuration / 60)} hrs)` : 'Medium-length works';
}

function formatCompletionHabit(rate, completed, total) {
  if (rate >= 0.6) {
    return `Dedicated finisher (${Math.round(rate * 100)}% completed)`;
  }
  if (rate <= 0.3 && total >= 3) {
    return 'Expansive explorer (multiple concurrent reads)';
  }
  return 'Balanced exploration and completion';
}

/* ============================================================================
   READING PERSONALITY UI RENDERER
   ============================================================================ */

/**
 * Renders the Reading Personality stationery component HTML for Reading Insights.
 * 
 * @param {Object} personality - Output of computeReadingPersonality
 * @returns {string} Rendered HTML string
 */
export function renderReadingPersonalityHTML(personality) {
  if (!personality || typeof personality !== 'object') {
    return '';
  }

  // Emerging / Cold-Start State
  if (!personality.hasData || !personality.archetype) {
    const explored = (personality.signals && personality.signals.exploredCount) || 0;
    return `
      <section class="personality-card emerging" aria-label="Reading personality emerging state">
        <div class="personality-kicker">LITERARY OBSERVATION</div>
        <h2 class="personality-title emerging-title">Your Reading Personality Is Taking Shape</h2>
        <p class="personality-description emerging-desc">
          Explore a few books in Nook and your literary tendencies, thematic affinities, and reading patterns will begin to emerge.
        </p>
        <div class="personality-emerging-trail">
          <span class="trail-icon" aria-hidden="true">❦</span>
          <span class="trail-text">${explored} of ${COLD_START_MIN_BOOKS} books explored so far</span>
        </div>
      </section>
    `;
  }

  const { archetype, evidence, tendencies } = personality;

  return `
    <section class="personality-card" aria-label="Your Reading Personality">
      <header class="personality-header">
        <div class="personality-kicker">${escapeHtml(archetype.kicker || 'YOUR READING PERSONALITY')}</div>
        <h2 class="personality-title">${escapeHtml(archetype.title)}</h2>
        <p class="personality-description">${escapeHtml(archetype.description)}</p>
      </header>

      <div class="personality-grid">
        <!-- Why Nook Noticed This / Evidence Column -->
        <div class="personality-col personality-evidence-col">
          <h3 class="personality-subheading">WHY NOOK NOTICED THIS</h3>
          <ul class="personality-evidence-list" role="list">
            ${evidence.map(item => `
              <li class="personality-evidence-item" role="listitem">
                <span class="evidence-bullet" aria-hidden="true">•</span>
                <span class="evidence-text">${escapeHtml(item)}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- Literary Tendencies Column -->
        <div class="personality-col personality-tendencies-col">
          <h3 class="personality-subheading">LITERARY TENDENCIES</h3>
          
          <div class="tendency-item">
            <span class="tendency-label">DRAWN TO</span>
            <span class="tendency-val">${tendencies.drawnTo && tendencies.drawnTo.length > 0 ? tendencies.drawnTo.map(escapeHtml).join(' · ') : 'Varied Shelves'}</span>
          </div>

          <div class="tendency-item">
            <span class="tendency-label">PREFERS</span>
            <span class="tendency-val">${escapeHtml(tendencies.prefersLength || 'Varied reading lengths')}</span>
          </div>

          ${tendencies.recurringThemes && tendencies.recurringThemes.length > 0 ? `
            <div class="tendency-item">
              <span class="tendency-label">OFTEN RETURNS TO</span>
              <span class="tendency-val">${tendencies.recurringThemes.map(escapeHtml).join(' · ')}</span>
            </div>
          ` : ''}
        </div>
      </div>
    </section>
  `;
}
