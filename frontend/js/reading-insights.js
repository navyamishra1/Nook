/**
 * Nook Reading Insights Module
 * 
 * Provides:
 * - Deterministic, side-effect-free calculation of reading metrics
 * - Categories, length, completion, chronological activity, and recent books
 * - Beautiful literary reading report UI (Commonplace / Reading Sanctuary aesthetic)
 */

import { getBookCoverUrl } from './catalog.js';
import { computeReadingPersonality, renderReadingPersonalityHTML } from './reading-personality.js';

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
 * Formats duration in minutes to human-readable literary text (e.g. "2 hrs 15 mins", "45 mins", "1 hr").
 */
export function formatDuration(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes <= 0) {
    return '0 mins';
  }
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;

  if (hours === 0) {
    return `${mins} min${mins === 1 ? '' : 's'}`;
  }
  if (mins === 0) {
    return `${hours} hr${hours === 1 ? '' : 's'}`;
  }
  return `${hours} hr${hours === 1 ? '' : 's'} ${mins} min${mins === 1 ? '' : 's'}`;
}

/**
 * Formats word count into a clean editorial string (e.g. "121,497 words").
 */
export function formatWordCount(words) {
  if (typeof words !== 'number' || isNaN(words) || words <= 0) {
    return '0 words';
  }
  return `${words.toLocaleString('en-US')} words`;
}

/**
 * Formats epoch ms into an editorial date string (e.g. "September 12, 2026").
 */
export function formatEditorialDate(timestamp) {
  if (!timestamp || isNaN(timestamp)) return '';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}

/**
 * Formats epoch ms into an activity period grouping (e.g. "September 2026").
 */
export function formatPeriodHeader(timestamp) {
  if (!timestamp || isNaN(timestamp)) return 'Earlier Reading';
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Earlier Reading';
    return d.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return 'Earlier Reading';
  }
}

/**
 * Core Calculation Engine for Reading Insights.
 * 
 * @param {Array<Object>} catalog - List of catalog book records
 * @param {Array<Object>} readingHistory - List of reading progress records
 * @returns {Object} Structured reading insights
 */
export function computeReadingInsights(catalog = [], readingHistory = []) {
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const safeHistory = Array.isArray(readingHistory) ? readingHistory : [];

  // Build catalog lookup map
  const catalogMap = new Map();
  for (const book of safeCatalog) {
    if (book && typeof book === 'object' && book.id) {
      catalogMap.set(book.id, book);
    }
  }

  // Deduplicate and sanitize reading history
  // If duplicate records exist for the same book, keep the one with the latest timestamp or progress
  const recordsByBookId = new Map();
  for (const rawRecord of safeHistory) {
    if (!rawRecord || typeof rawRecord !== 'object') continue;
    const bookId = rawRecord.bookId || (rawRecord.book && rawRecord.book.id) || rawRecord.id;
    if (!bookId || !catalogMap.has(bookId)) continue;

    const book = catalogMap.get(bookId);

    // Resolve timestamp safely
    let timestamp = 0;
    if (typeof rawRecord.lastAccessedAt === 'number' && !isNaN(rawRecord.lastAccessedAt)) {
      timestamp = rawRecord.lastAccessedAt;
    } else if (typeof rawRecord.updatedAt === 'string') {
      const parsed = Date.parse(rawRecord.updatedAt);
      if (!isNaN(parsed)) timestamp = parsed;
    } else if (typeof rawRecord.updatedAt === 'number' && !isNaN(rawRecord.updatedAt)) {
      timestamp = rawRecord.updatedAt;
    }

    // Resolve progress percent safely
    let progressPercent = 0;
    if (typeof rawRecord.progressPercent === 'number' && !isNaN(rawRecord.progressPercent)) {
      progressPercent = Math.max(0, Math.min(100, Math.round(rawRecord.progressPercent)));
    }

    const cleanRecord = {
      bookId,
      book,
      progressPercent,
      chapterNumber: typeof rawRecord.chapterNumber === 'number' ? rawRecord.chapterNumber : 1,
      chapterTitle: typeof rawRecord.chapterTitle === 'string' ? rawRecord.chapterTitle : 'Chapter 1',
      pageNumber: typeof rawRecord.pageNumber === 'number' ? rawRecord.pageNumber : null,
      totalPages: typeof rawRecord.totalPages === 'number' ? rawRecord.totalPages : null,
      lastAccessedAt: timestamp > 0 ? timestamp : null,
      updatedAt: rawRecord.updatedAt || (timestamp > 0 ? new Date(timestamp).toISOString() : null)
    };

    if (!recordsByBookId.has(bookId)) {
      recordsByBookId.set(bookId, cleanRecord);
    } else {
      const existing = recordsByBookId.get(bookId);
      const existingTime = existing.lastAccessedAt || 0;
      const newTime = cleanRecord.lastAccessedAt || 0;
      if (newTime >= existingTime) {
        recordsByBookId.set(bookId, {
          ...cleanRecord,
          progressPercent: Math.max(existing.progressPercent, cleanRecord.progressPercent)
        });
      }
    }
  }

  const exploredRecords = Array.from(recordsByBookId.values());
  const exploredCount = exploredRecords.length;

  if (exploredCount === 0) {
    return {
      hasData: false,
      exploredCount: 0,
      completedCount: 0,
      currentlyReadingCount: 0,
      completionRate: null,
      categoryDistribution: [],
      activity: [],
      shortestBook: null,
      longestBook: null,
      averageBookLength: null,
      recentBooks: []
    };
  }

  // Completion semantics (Nook threshold >= 90%)
  const COMPLETED_THRESHOLD = 90;
  let completedCount = 0;
  let currentlyReadingCount = 0;

  for (const record of exploredRecords) {
    if (record.progressPercent >= COMPLETED_THRESHOLD) {
      completedCount++;
    } else {
      currentlyReadingCount++;
    }
  }

  const completionRate = exploredCount > 0 ? completedCount / exploredCount : null;

  // Category distribution
  const categoryCounts = new Map();
  let totalCategoryTags = 0;

  for (const record of exploredRecords) {
    const categories = Array.isArray(record.book.categories) ? record.book.categories : [];
    for (const cat of categories) {
      if (typeof cat === 'string' && cat.trim().length > 0) {
        const cleanCat = cat.trim();
        categoryCounts.set(cleanCat, (categoryCounts.get(cleanCat) || 0) + 1);
        totalCategoryTags++;
      }
    }
  }

  const categoryDistribution = Array.from(categoryCounts.entries())
    .map(([category, count]) => {
      const percentage = totalCategoryTags > 0 ? Math.round((count / totalCategoryTags) * 100) : 0;
      return {
        category,
        count,
        percentage
      };
    })
    .sort((a, b) => {
      // Deterministic: count desc, then category name asc
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.category.localeCompare(b.category);
    });

  // Book Length calculations
  const booksWithLength = exploredRecords
    .map((r) => r.book)
    .filter((b) => (typeof b.word_count === 'number' && b.word_count > 0) || (typeof b.estimated_reading_time === 'number' && b.estimated_reading_time > 0));

  let shortestBook = null;
  let longestBook = null;
  let averageBookLength = null;

  if (booksWithLength.length > 0) {
    // Sort for shortest (word_count asc, then estimated_reading_time asc, tie-break title asc)
    const sortedByLengthAsc = [...booksWithLength].sort((a, b) => {
      const wordsA = a.word_count || (a.estimated_reading_time ? a.estimated_reading_time * 225 : 0);
      const wordsB = b.word_count || (b.estimated_reading_time ? b.estimated_reading_time * 225 : 0);
      if (wordsA !== wordsB) return wordsA - wordsB;
      const titleA = a.title || a.id;
      const titleB = b.title || b.id;
      return titleA.localeCompare(titleB);
    });

    const shortestRaw = sortedByLengthAsc[0];
    const longestRaw = sortedByLengthAsc[sortedByLengthAsc.length - 1];

    shortestBook = {
      id: shortestRaw.id,
      title: shortestRaw.title || shortestRaw.id,
      author: shortestRaw.author || 'Unknown Author',
      wordCount: shortestRaw.word_count || null,
      estimatedReadingTime: shortestRaw.estimated_reading_time || null,
      formattedDuration: formatDuration(shortestRaw.estimated_reading_time || 0),
      formattedWords: formatWordCount(shortestRaw.word_count || 0),
      cover: shortestRaw.cover || null,
      coverColor: shortestRaw.coverColor || '#8FA07E'
    };

    longestBook = {
      id: longestRaw.id,
      title: longestRaw.title || longestRaw.id,
      author: longestRaw.author || 'Unknown Author',
      wordCount: longestRaw.word_count || null,
      estimatedReadingTime: longestRaw.estimated_reading_time || null,
      formattedDuration: formatDuration(longestRaw.estimated_reading_time || 0),
      formattedWords: formatWordCount(longestRaw.word_count || 0),
      cover: longestRaw.cover || null,
      coverColor: longestRaw.coverColor || '#8FA07E'
    };

    let totalWords = 0;
    let totalTime = 0;
    let wordCounted = 0;
    let timeCounted = 0;

    for (const b of booksWithLength) {
      if (typeof b.word_count === 'number' && b.word_count > 0) {
        totalWords += b.word_count;
        wordCounted++;
      }
      if (typeof b.estimated_reading_time === 'number' && b.estimated_reading_time > 0) {
        totalTime += b.estimated_reading_time;
        timeCounted++;
      }
    }

    const avgWords = wordCounted > 0 ? Math.round(totalWords / wordCounted) : null;
    const avgTime = timeCounted > 0 ? Math.round(totalTime / timeCounted) : null;

    averageBookLength = {
      averageWordCount: avgWords,
      averageReadingTimeMinutes: avgTime,
      formattedAverageDuration: formatDuration(avgTime || 0),
      formattedAverageWords: formatWordCount(avgWords || 0)
    };
  }

  // Recent Reading Books (sorted by lastAccessedAt desc, tie-break title asc)
  const recentBooks = [...exploredRecords]
    .sort((a, b) => {
      const timeA = a.lastAccessedAt || 0;
      const timeB = b.lastAccessedAt || 0;
      if (timeB !== timeA) return timeB - timeA;
      const titleA = a.book.title || a.bookId;
      const titleB = b.book.title || b.bookId;
      return titleA.localeCompare(titleB);
    })
    .map((r) => ({
      id: r.bookId,
      title: r.book.title || r.bookId,
      author: r.book.author || 'Unknown Author',
      categories: Array.isArray(r.book.categories) ? r.book.categories : [],
      progressPercent: r.progressPercent,
      isCompleted: r.progressPercent >= COMPLETED_THRESHOLD,
      chapterNumber: r.chapterNumber,
      chapterTitle: r.chapterTitle,
      pageNumber: r.pageNumber,
      lastAccessedAt: r.lastAccessedAt,
      updatedAt: r.updatedAt,
      formattedDate: formatEditorialDate(r.lastAccessedAt),
      wordCount: r.book.word_count || null,
      estimatedReadingTime: r.book.estimated_reading_time || null,
      formattedDuration: formatDuration(r.book.estimated_reading_time || 0),
      cover: r.book.cover || null,
      coverColor: r.book.coverColor || '#8FA07E'
    }));

  // Chronological Activity Grouping
  const recordsWithTime = exploredRecords.filter((r) => r.lastAccessedAt && r.lastAccessedAt > 0);
  const activityGroups = new Map();

  if (recordsWithTime.length > 0) {
    const sortedChronological = [...recordsWithTime].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

    for (const record of sortedChronological) {
      const periodKey = formatPeriodHeader(record.lastAccessedAt);
      if (!activityGroups.has(periodKey)) {
        activityGroups.set(periodKey, {
          period: periodKey,
          latestTimestamp: record.lastAccessedAt,
          books: []
        });
      }
      activityGroups.get(periodKey).books.push({
        id: record.bookId,
        title: record.book.title || record.bookId,
        author: record.book.author || 'Unknown Author',
        progressPercent: record.progressPercent,
        isCompleted: record.progressPercent >= COMPLETED_THRESHOLD,
        lastAccessedAt: record.lastAccessedAt,
        formattedDate: formatEditorialDate(record.lastAccessedAt)
      });
    }
  }

  const activity = Array.from(activityGroups.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp);

  return {
    hasData: true,
    exploredCount,
    completedCount,
    currentlyReadingCount,
    completionRate,
    categoryDistribution,
    activity,
    shortestBook,
    longestBook,
    averageBookLength,
    recentBooks
  };
}

/* ============================================================================
   READING INSIGHTS UI RENDERER
   ============================================================================ */

/**
 * Renders the full Reading Insights view HTML.
 * 
 * @param {Object} options
 * @param {Array<Object>} options.catalog - Full verified book catalog
 * @param {Array<Object>} options.readingHistory - Reading progress store entries
 * @param {Function} options.onNavigate - View navigation callback
 * @returns {string} Rendered HTML string
 */
export function renderReadingInsightsHTML({ catalog = [], readingHistory = [], journalData = {} }) {
  const insights = computeReadingInsights(catalog, readingHistory);

  if (!insights.hasData) {
    return `
      <div class="insights-container reveal-layer-2">
        <header class="insights-header">
          <div class="section-kicker">READING INSIGHTS</div>
          <h1 class="insights-title">A Little Portrait of Your Reading Life</h1>
          <p class="insights-sub">A quiet reflection on your explored shelves, reading pace, and completed volumes.</p>
        </header>

        <section class="insights-empty-stationery" role="region" aria-label="Reading insights empty state">
          <div class="empty-stationery-card">
            <div class="empty-motif" aria-hidden="true">❦</div>
            <h2 class="empty-heading">Your Reading Story Is Just Beginning</h2>
            <p class="empty-sub">Open a book from our verified catalog, and Nook will begin gathering a thoughtful portrait of your reading life.</p>
            <button class="btn dark-on-butter insights-browse-btn" data-action="browse-library">
              Wander into the library →
            </button>
          </div>
        </section>
      </div>
    `;
  }

  const personality = computeReadingPersonality(catalog, readingHistory, journalData);
  const personalityHtml = renderReadingPersonalityHTML(personality);

  const formattedCompletion = insights.completionRate !== null
    ? `${Math.round(insights.completionRate * 100)}%`
    : '—';

  return `
    <div class="insights-container reveal-layer-2">
      <!-- Header -->
      <header class="insights-header">
        <div class="section-kicker">READING INSIGHTS</div>
        <h1 class="insights-title">A Little Portrait of Your Reading Life</h1>
        <p class="insights-sub">A quiet reflection on your explored shelves, reading pace, and completed volumes.</p>
      </header>

      <!-- Reading Personality Section -->
      ${personalityHtml}

      <!-- Editorial Overview Stats -->
      <section class="insights-overview-panel" aria-label="Reading overview summary">
        <div class="insights-stat-col">
          <span class="stat-num">${insights.exploredCount}</span>
          <span class="stat-label">Book${insights.exploredCount === 1 ? '' : 's'} Explored</span>
        </div>
        <div class="insights-stat-sep" aria-hidden="true"></div>
        <div class="insights-stat-col">
          <span class="stat-num">${insights.currentlyReadingCount}</span>
          <span class="stat-label">In Progress</span>
        </div>
        <div class="insights-stat-sep" aria-hidden="true"></div>
        <div class="insights-stat-col">
          <span class="stat-num">${insights.completedCount}</span>
          <span class="stat-label">Completed</span>
        </div>
        <div class="insights-stat-sep" aria-hidden="true"></div>
        <div class="insights-stat-col">
          <span class="stat-num">${formattedCompletion}</span>
          <span class="stat-label">Completion Rate</span>
        </div>
      </section>

      <!-- Two-Column Editorial Grid: Categories & Book Length -->
      <div class="insights-editorial-grid">
        <!-- Categories Section -->
        <section class="insights-card insights-categories-card" aria-label="Explored Categories">
          <div class="card-kicker">CURATED AFFINITIES</div>
          <h2 class="card-heading">What You've Been Exploring</h2>
          <p class="card-desc">Genres and shelves discovered across your active reading history.</p>

          <div class="category-bars-list" role="list">
            ${insights.categoryDistribution.map((cat) => `
              <div class="category-bar-row" role="listitem">
                <div class="category-bar-meta">
                  <span class="category-name">${escapeHtml(cat.category)}</span>
                  <span class="category-count">${cat.count} title${cat.count === 1 ? '' : 's'} (${cat.percentage}%)</span>
                </div>
                <div class="category-bar-track" aria-hidden="true">
                  <div class="category-bar-fill" style="width: ${Math.max(6, cat.percentage)}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- Book Length Section -->
        <section class="insights-card insights-length-card" aria-label="Book Length Insights">
          <div class="card-kicker">VOLUME &amp; PACE</div>
          <h2 class="card-heading">Long &amp; Short</h2>
          <p class="card-desc">The range and scale of literary works you have immersed yourself in.</p>

          <div class="length-extremes-row">
            ${insights.shortestBook ? `
              <div class="length-book-item" data-action="open-book" data-book-id="${insights.shortestBook.id}" tabindex="0" role="button" aria-label="View shortest book: ${escapeHtml(insights.shortestBook.title)}">
                <div class="length-tag">SHORTEST READ</div>
                <div class="length-book-title">${escapeHtml(insights.shortestBook.title)}</div>
                <div class="length-book-author">by ${escapeHtml(insights.shortestBook.author)}</div>
                <div class="length-book-metric">${insights.shortestBook.formattedWords} · ~${insights.shortestBook.formattedDuration}</div>
              </div>
            ` : ''}

            ${insights.longestBook ? `
              <div class="length-book-item" data-action="open-book" data-book-id="${insights.longestBook.id}" tabindex="0" role="button" aria-label="View longest book: ${escapeHtml(insights.longestBook.title)}">
                <div class="length-tag">LONGEST READ</div>
                <div class="length-book-title">${escapeHtml(insights.longestBook.title)}</div>
                <div class="length-book-author">by ${escapeHtml(insights.longestBook.author)}</div>
                <div class="length-book-metric">${insights.longestBook.formattedWords} · ~${insights.longestBook.formattedDuration}</div>
              </div>
            ` : ''}
          </div>

          ${insights.averageBookLength ? `
            <div class="length-average-footer">
              <span class="avg-label">Average explored volume:</span>
              <span class="avg-val"><strong>${insights.averageBookLength.formattedAverageWords}</strong> (~${insights.averageBookLength.formattedAverageDuration})</span>
            </div>
          ` : ''}
        </section>
      </div>

      <!-- Chronological Activity Timeline -->
      ${insights.activity.length > 0 ? `
        <section class="insights-section insights-timeline-section" aria-label="Reading Timeline">
          <div class="card-kicker">CHRONOLOGY</div>
          <h2 class="card-heading">Your Reading Year</h2>
          <p class="card-desc">A month-by-month record of your reading milestones.</p>

          <div class="timeline-stream">
            ${insights.activity.map((group) => `
              <div class="timeline-period-block">
                <h3 class="timeline-month-label">${escapeHtml(group.period)}</h3>
                <ul class="timeline-books-list">
                  ${group.books.map((b) => `
                    <li class="timeline-book-item" data-action="open-book" data-book-id="${b.id}" tabindex="0" role="button" aria-label="Open details for ${escapeHtml(b.title)}">
                      <span class="timeline-bullet" aria-hidden="true">•</span>
                      <span class="timeline-book-title">${escapeHtml(b.title)}</span>
                      <span class="timeline-book-author">by ${escapeHtml(b.author)}</span>
                      <span class="timeline-book-status ${b.isCompleted ? 'status-completed' : 'status-progress'}">
                        ${b.isCompleted ? '✓ Completed' : `${b.progressPercent}% read`}
                      </span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </section>
      ` : ''}

      <!-- Recent Reading Section -->
      <section class="insights-section insights-recent-section" aria-label="Recent Reading Shelf">
        <div class="card-kicker">ACTIVE SHELVES</div>
        <h2 class="card-heading">Recently Explored</h2>

        <div class="insights-recent-grid">
          ${insights.recentBooks.map((b) => {
            const coverUrl = b.cover ? b.cover : (b.id ? `assets/covers/${b.id}.webp` : '');
            return `
              <article class="insights-recent-card" data-action="open-book" data-book-id="${b.id}">
                <div class="recent-cover-wrap">
                  <img src="${coverUrl}" alt="Cover of ${escapeHtml(b.title)}" loading="lazy" />
                </div>
                <div class="recent-info-wrap">
                  <h3 class="recent-title">${escapeHtml(b.title)}</h3>
                  <div class="recent-author">by ${escapeHtml(b.author)}</div>
                  <div class="recent-progress-bar-wrap">
                    <div class="recent-progress-bar" style="width: ${b.progressPercent}%;"></div>
                  </div>
                  <div class="recent-meta-bottom">
                    <span class="recent-progress-text">${b.isCompleted ? '✓ Completed' : `${b.progressPercent}% read`}</span>
                    ${b.formattedDate ? `<span class="recent-date">${escapeHtml(b.formattedDate)}</span>` : ''}
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;
}

/**
 * Attaches event listeners for reading insights interactive elements.
 */
export function bindReadingInsightsEvents(container, { onNavigate = () => {}, onOpenPassage = () => {} }) {
  if (!container) return;

  // Browse Library button
  const browseBtn = container.querySelector('[data-action="browse-library"]');
  if (browseBtn) {
    browseBtn.addEventListener('click', () => {
      onNavigate('library');
    });
  }

  // Book click triggers
  const bookItems = container.querySelectorAll('[data-action="open-book"]');
  bookItems.forEach((item) => {
    const handler = () => {
      const bookId = item.getAttribute('data-book-id');
      if (bookId) {
        onNavigate('details', { bookId, origin: 'journal' });
      }
    };

    item.addEventListener('click', handler);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}
