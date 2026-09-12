/**
 * Nook Journal Timeline Module
 * 
 * Provides:
 * - Chronological normalization of reading artifacts (highlights, notes, bookmarks)
 * - Deterministic tie-breaking and timestamp handling
 * - Month/day hierarchical grouping for literary reading journals
 * - Editorial timeline UI renderer matching Nook's stationery aesthetic
 */

import { getBookById, getBookCoverUrl } from './catalog.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Formats a timestamp into a human-readable day label (e.g. "12 September 2026").
 */
export function formatTimelineDay(timestamp) {
  if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
    return 'Undated';
  }
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 'Undated';
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()] || '';
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Formats a timestamp into Month & Year (e.g. "September 2026").
 */
export function formatTimelineMonthYear(timestamp) {
  if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
    return 'Earlier & Undated';
  }
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 'Earlier & Undated';
  const month = MONTH_NAMES[d.getMonth()] || '';
  const year = d.getFullYear();
  return `${month} ${year}`;
}

/**
 * Formats a timestamp into a short clock time (e.g. "4:15 PM").
 */
export function formatTimelineTime(timestamp) {
  if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
    return null;
  }
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Normalizes all journal entries into a flat, chronologically sorted timeline list.
 * 
 * @param {Object} params
 * @param {Object} params.store - The raw journal store object ({ bookmarks, highlights, notes })
 * @param {Array<Object>} params.catalog - Verified book catalog
 * @param {string} params.type - Filter type ('all' | 'highlights' | 'notes' | 'bookmarks')
 * @param {string} params.searchQuery - Text search filter
 * @param {string} params.bookId - Optional bookId filter
 * @returns {Array<Object>} Normalized, deterministically sorted timeline entries
 */
export function getJournalTimelineEntries({
  store = { bookmarks: [], highlights: [], notes: [] },
  catalog = [],
  type = 'all',
  searchQuery = '',
  bookId = null
} = {}) {
  const safeStore = store || { bookmarks: [], highlights: [], notes: [] };
  const bookmarks = Array.isArray(safeStore.bookmarks) ? safeStore.bookmarks : [];
  const highlights = Array.isArray(safeStore.highlights) ? safeStore.highlights : [];
  const notes = Array.isArray(safeStore.notes) ? safeStore.notes : [];

  // Build catalog map for fast lookup
  const catalogMap = new Map();
  if (Array.isArray(catalog)) {
    for (const b of catalog) {
      if (b && b.id) catalogMap.set(b.id, b);
    }
  }

  const rawList = [];

  if (type === 'all' || type === 'bookmarks') {
    for (const bm of bookmarks) {
      if (!bm || typeof bm !== 'object') continue;
      const catBook = catalogMap.get(bm.bookId) || getBookById(bm.bookId);
      rawList.push({
        id: String(bm.id || `bm_${bm.bookId}_${bm.pageNumber}`),
        type: 'bookmark',
        bookId: String(bm.bookId || ''),
        bookTitle: bm.bookTitle || (catBook && catBook.title) || bm.bookId || 'Untitled',
        author: bm.author || (catBook && catBook.author) || 'Unknown Author',
        chapterNumber: typeof bm.chapterNumber === 'number' ? bm.chapterNumber : 1,
        chapterTitle: bm.chapterTitle || `Chapter ${bm.chapterNumber || 1}`,
        pageNumber: typeof bm.pageNumber === 'number' ? bm.pageNumber : 1,
        totalPages: typeof bm.totalPages === 'number' ? bm.totalPages : null,
        bookmarkStyle: bm.bookmarkStyle || 'crimson-silk',
        selectedText: null,
        note: null,
        createdAt: typeof bm.createdAt === 'number' ? bm.createdAt : null,
        updatedAt: typeof bm.updatedAt === 'number' ? bm.updatedAt : null
      });
    }
  }

  if (type === 'all' || type === 'highlights') {
    for (const hl of highlights) {
      if (!hl || typeof hl !== 'object') continue;
      const text = (typeof hl.selectedText === 'string' && hl.selectedText.trim()) ||
                   (typeof hl.text === 'string' && hl.text.trim()) || '';
      if (!text) continue;
      const catBook = catalogMap.get(hl.bookId) || getBookById(hl.bookId);
      rawList.push({
        id: String(hl.id || `hl_${hl.bookId}_${Date.now()}`),
        type: 'highlight',
        bookId: String(hl.bookId || ''),
        bookTitle: hl.bookTitle || (catBook && catBook.title) || hl.bookId || 'Untitled',
        author: hl.author || (catBook && catBook.author) || 'Unknown Author',
        chapterNumber: typeof hl.chapterNumber === 'number' ? hl.chapterNumber : 1,
        chapterTitle: hl.chapterTitle || `Chapter ${hl.chapterNumber || 1}`,
        pageNumber: typeof hl.pageNumber === 'number' ? hl.pageNumber : 1,
        totalPages: typeof hl.totalPages === 'number' ? hl.totalPages : null,
        bookmarkStyle: null,
        selectedText: text,
        note: hl.note || null,
        color: hl.color || 'sage',
        createdAt: typeof hl.createdAt === 'number' ? hl.createdAt : null,
        updatedAt: typeof hl.updatedAt === 'number' ? hl.updatedAt : null
      });
    }
  }

  if (type === 'all' || type === 'notes') {
    for (const nt of notes) {
      if (!nt || typeof nt !== 'object') continue;
      const noteContent = (typeof nt.note === 'string' && nt.note.trim()) || '';
      if (!noteContent) continue;
      const catBook = catalogMap.get(nt.bookId) || getBookById(nt.bookId);
      const text = (typeof nt.selectedText === 'string' && nt.selectedText.trim()) || null;
      rawList.push({
        id: String(nt.id || `nt_${nt.bookId}_${Date.now()}`),
        type: 'note',
        bookId: String(nt.bookId || ''),
        bookTitle: nt.bookTitle || (catBook && catBook.title) || nt.bookId || 'Untitled',
        author: nt.author || (catBook && catBook.author) || 'Unknown Author',
        chapterNumber: typeof nt.chapterNumber === 'number' ? nt.chapterNumber : 1,
        chapterTitle: nt.chapterTitle || `Chapter ${nt.chapterNumber || 1}`,
        pageNumber: typeof nt.pageNumber === 'number' ? nt.pageNumber : 1,
        totalPages: typeof nt.totalPages === 'number' ? nt.totalPages : null,
        bookmarkStyle: null,
        selectedText: text,
        note: noteContent,
        createdAt: typeof nt.createdAt === 'number' ? nt.createdAt : null,
        updatedAt: typeof nt.updatedAt === 'number' ? nt.updatedAt : null
      });
    }
  }

  // 1. Filter by bookId
  let filtered = rawList;
  if (bookId) {
    filtered = filtered.filter((e) => e.bookId === bookId);
  }

  // 2. Filter by search query
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter((e) => {
      const matchTitle = (e.bookTitle || '').toLowerCase().includes(q);
      const matchAuthor = (e.author || '').toLowerCase().includes(q);
      const matchChapter = (e.chapterTitle || '').toLowerCase().includes(q);
      const matchText = (e.selectedText || '').toLowerCase().includes(q);
      const matchNote = (e.note || '').toLowerCase().includes(q);
      return matchTitle || matchAuthor || matchChapter || matchText || matchNote;
    });
  }

  // 3. Chronological sorting with deterministic tie-breaking
  const TYPE_PRIORITY = { bookmark: 1, highlight: 2, note: 3 };

  filtered.sort((a, b) => {
    const timeA = typeof a.createdAt === 'number' ? a.createdAt : -1;
    const timeB = typeof b.createdAt === 'number' ? b.createdAt : -1;

    // Newest first
    if (timeB !== timeA) {
      return timeB - timeA;
    }

    // Tie-breaker 1: Entry type
    const pA = TYPE_PRIORITY[a.type] || 99;
    const pB = TYPE_PRIORITY[b.type] || 99;
    if (pA !== pB) return pA - pB;

    // Tie-breaker 2: Book title
    const titleCmp = (a.bookTitle || '').localeCompare(b.bookTitle || '');
    if (titleCmp !== 0) return titleCmp;

    // Tie-breaker 3: ID
    return (a.id || '').localeCompare(b.id || '');
  });

  return filtered.map((entry) => ({
    ...entry,
    dayLabel: formatTimelineDay(entry.createdAt),
    monthYearLabel: formatTimelineMonthYear(entry.createdAt),
    timeLabel: formatTimelineTime(entry.createdAt)
  }));
}

/**
 * Groups flat timeline entries into Month/Year and Day sections.
 * 
 * @param {Array<Object>} timelineEntries - Output from getJournalTimelineEntries
 * @returns {Array<Object>} Hierarchical grouped timeline data
 */
export function groupTimelineEntries(timelineEntries = []) {
  if (!Array.isArray(timelineEntries) || timelineEntries.length === 0) {
    return [];
  }

  const monthMap = new Map();

  for (const entry of timelineEntries) {
    const monthKey = entry.monthYearLabel || 'Earlier & Undated';
    const dayKey = entry.dayLabel || 'Undated';

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        monthYear: monthKey,
        days: new Map()
      });
    }

    const monthObj = monthMap.get(monthKey);
    if (!monthObj.days.has(dayKey)) {
      monthObj.days.set(dayKey, {
        dayLabel: dayKey,
        entries: []
      });
    }

    monthObj.days.get(dayKey).entries.push(entry);
  }

  return Array.from(monthMap.values()).map((m) => ({
    monthYear: m.monthYear,
    days: Array.from(m.days.values())
  }));
}

/**
 * Renders the Journal Timeline view HTML.
 */
export function renderJournalTimelineHTML({
  store = { bookmarks: [], highlights: [], notes: [] },
  catalog = [],
  type = 'all',
  searchQuery = '',
  selectedBookId = null
} = {}) {
  const entries = getJournalTimelineEntries({ store, catalog, type, searchQuery, bookId: selectedBookId });
  const groups = groupTimelineEntries(entries);

  // Distinct books for filter
  const booksInJournalMap = new Map();
  [...store.bookmarks, ...store.highlights, ...store.notes].forEach((e) => {
    if (e && e.bookId && !booksInJournalMap.has(e.bookId)) {
      const book = getBookById(e.bookId);
      booksInJournalMap.set(e.bookId, {
        id: e.bookId,
        title: e.bookTitle || (book && book.title) || e.bookId
      });
    }
  });
  const booksInJournal = Array.from(booksInJournalMap.values()).sort((a, b) => a.title.localeCompare(b.title));

  const totalEntriesCount = (store.bookmarks?.length || 0) + (store.highlights?.length || 0) + (store.notes?.length || 0);

  if (entries.length === 0) {
    return `
      <div class="journal-controls-bar">
        <div class="journal-type-tabs" role="tablist" aria-label="Timeline entry filters">
          <button class="j-tab ${type === 'all' ? 'active' : ''}" data-jtype="all" role="tab" aria-selected="${type === 'all'}">All (${totalEntriesCount})</button>
          <button class="j-tab ${type === 'notes' ? 'active' : ''}" data-jtype="notes" role="tab" aria-selected="${type === 'notes'}">Notes (${store.notes?.length || 0})</button>
          <button class="j-tab ${type === 'highlights' ? 'active' : ''}" data-jtype="highlights" role="tab" aria-selected="${type === 'highlights'}">Highlights (${store.highlights?.length || 0})</button>
          <button class="j-tab ${type === 'bookmarks' ? 'active' : ''}" data-jtype="bookmarks" role="tab" aria-selected="${type === 'bookmarks'}">Bookmarks (${store.bookmarks?.length || 0})</button>
        </div>

        <div class="journal-search-row">
          <div class="j-search-input-wrap">
            <input 
              type="search" 
              class="journal-search-input" 
              id="journalSearchInput" 
              placeholder="Search timeline quotes, notes, or titles…" 
              value="${escapeHtml(searchQuery)}"
              aria-label="Search timeline entries"
            />
          </div>
          ${booksInJournal.length > 0 ? `
            <div class="j-book-filter-wrap">
              <select class="journal-book-select" id="journalBookSelect" aria-label="Filter by book">
                <option value="">All Books (${booksInJournal.length})</option>
                ${booksInJournal.map((b) => `
                  <option value="${b.id}" ${b.id === selectedBookId ? 'selected' : ''}>${escapeHtml(b.title)}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}
        </div>
      </div>

      <section class="journal-timeline-empty" aria-label="Empty Timeline">
        <div class="timeline-empty-card">
          <div class="empty-ornament" aria-hidden="true">❧</div>
          <h2 class="empty-title">Your Reading Timeline Will Gather Here</h2>
          <p class="empty-desc">
            Save a memorable passage, leave a marginal note, or place a ribbon bookmark while reading, and your chronological reading trail will gather here.
          </p>
        </div>
      </section>
    `;
  }

  return `
    <div class="journal-controls-bar">
      <div class="journal-type-tabs" role="tablist" aria-label="Timeline entry filters">
        <button class="j-tab ${type === 'all' ? 'active' : ''}" data-jtype="all" role="tab" aria-selected="${type === 'all'}">All (${totalEntriesCount})</button>
        <button class="j-tab ${type === 'notes' ? 'active' : ''}" data-jtype="notes" role="tab" aria-selected="${type === 'notes'}">Notes (${store.notes?.length || 0})</button>
        <button class="j-tab ${type === 'highlights' ? 'active' : ''}" data-jtype="highlights" role="tab" aria-selected="${type === 'highlights'}">Highlights (${store.highlights?.length || 0})</button>
        <button class="j-tab ${type === 'bookmarks' ? 'active' : ''}" data-jtype="bookmarks" role="tab" aria-selected="${type === 'bookmarks'}">Bookmarks (${store.bookmarks?.length || 0})</button>
      </div>

      <div class="journal-search-row">
        <div class="j-search-input-wrap">
          <input 
            type="search" 
            class="journal-search-input" 
            id="journalSearchInput" 
            placeholder="Search timeline quotes, notes, or titles…" 
            value="${escapeHtml(searchQuery)}"
            aria-label="Search timeline entries"
          />
        </div>
        ${booksInJournal.length > 0 ? `
          <div class="j-book-filter-wrap">
            <select class="journal-book-select" id="journalBookSelect" aria-label="Filter by book">
              <option value="">All Books (${booksInJournal.length})</option>
              ${booksInJournal.map((b) => `
                <option value="${b.id}" ${b.id === selectedBookId ? 'selected' : ''}>${escapeHtml(b.title)}</option>
              `).join('')}
            </select>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Chronological Timeline Stream -->
    <main class="journal-timeline-container" id="journalTimelineStream" aria-label="Chronological Reading Timeline">
      <div class="timeline-hairline" aria-hidden="true"></div>

      ${groups.map((group) => `
        <section class="timeline-month-group" aria-label="${escapeHtml(group.monthYear)}">
          <div class="timeline-month-header">
            <span class="timeline-month-badge">${escapeHtml(group.monthYear)}</span>
          </div>

          ${group.days.map((day) => `
            <div class="timeline-day-block">
              <div class="timeline-day-marker">
                <span class="day-node" aria-hidden="true"></span>
                <span class="day-label">${escapeHtml(day.dayLabel)}</span>
              </div>

              <div class="timeline-day-entries">
                ${day.entries.map((entry) => renderTimelineEntryCard(entry)).join('')}
              </div>
            </div>
          `).join('')}
        </section>
      `).join('')}
    </main>
  `;
}

function renderTimelineEntryCard(entry) {
  const typeLabels = {
    bookmark: 'PAGE BOOKMARK',
    highlight: 'SAVED PASSAGE',
    note: 'MARGINAL NOTE'
  };
  const typeLabel = typeLabels[entry.type] || 'ENTRY';

  return `
    <article class="timeline-entry-card timeline-type-${entry.type}" data-entry-id="${entry.id}" data-book-id="${entry.bookId}">
      <header class="t-card-header">
        <div class="t-card-type-row">
          <span class="t-type-tag">${typeLabel}</span>
          ${entry.timeLabel ? `<span class="t-time-tag">${escapeHtml(entry.timeLabel)}</span>` : ''}
        </div>
        <div class="t-book-meta">
          <h3 class="t-book-title">${escapeHtml(entry.bookTitle)}</h3>
          <span class="t-chapter-page">
            ${escapeHtml(entry.chapterTitle)}${entry.pageNumber ? ` · Page ${entry.pageNumber}` : ''}
          </span>
        </div>
      </header>

      <div class="t-card-body">
        ${entry.type === 'highlight' ? `
          <blockquote class="t-highlight-quote">
            <p>“${escapeHtml(entry.selectedText)}”</p>
          </blockquote>
          ${entry.note ? `
            <div class="t-attached-note">
              <span class="t-note-marker">Marginal Note:</span>
              <p>${escapeHtml(entry.note)}</p>
            </div>
          ` : ''}
        ` : ''}

        ${entry.type === 'note' ? `
          ${entry.selectedText ? `
            <blockquote class="t-passage-quote">
              <p>“${escapeHtml(entry.selectedText)}”</p>
            </blockquote>
          ` : ''}
          <div class="t-note-content">
            <p>${escapeHtml(entry.note)}</p>
          </div>
        ` : ''}

        ${entry.type === 'bookmark' ? `
          <div class="t-bookmark-content">
            <span class="t-ribbon-swatch swatch-${entry.bookmarkStyle || 'crimson-silk'}" aria-hidden="true"></span>
            <span class="t-bookmark-desc">Ribbon saved at page ${entry.pageNumber}${entry.totalPages ? ` of ${entry.totalPages}` : ''}</span>
          </div>
        ` : ''}
      </div>

      <footer class="t-card-footer">
        <button 
          class="t-action-btn t-open-btn" 
          data-action="open-passage" 
          data-book-id="${entry.bookId}" 
          data-chapter="${entry.chapterNumber}" 
          data-page="${entry.pageNumber}"
          aria-label="Read in ${escapeHtml(entry.bookTitle)}, ${escapeHtml(entry.chapterTitle)}"
        >
          <span>Open in Reader</span>
          <span aria-hidden="true">→</span>
        </button>

        <div class="t-manage-actions">
          ${entry.type === 'note' ? `
            <button class="t-icon-btn" data-action="edit-note" data-entry-id="${entry.id}" title="Edit note" aria-label="Edit note">✎ Edit</button>
          ` : ''}
          <button class="t-icon-btn t-delete-btn" data-action="delete-entry" data-entry-id="${entry.id}" data-entry-type="${entry.type}" title="Remove entry" aria-label="Remove entry">✕</button>
        </div>
      </footer>
    </article>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
