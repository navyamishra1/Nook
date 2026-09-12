/**
 * Nook Reading Journal & Annotation Module
 * 
 * Provides:
 * - Versioned local storage persistence (nook_journal)
 * - Bookmarks management (page-level)
 * - Highlights management (text & page-level)
 * - Personal Notes management (marginalia attached to text/page)
 * - Chronological & filtered journal entry querying
 * - Literary notebook UI renderer for the Journal view
 */

import { getBookById, getBookCoverUrl, getAllReadingProgress } from './catalog.js';
import { renderReadingInsightsHTML, bindReadingInsightsEvents } from './reading-insights.js';
import { renderHighlightIntelligenceHTML } from './highlight-intelligence.js';
import { renderJournalTimelineHTML, getJournalTimelineEntries, groupTimelineEntries } from './journal-timeline.js';

export { getJournalTimelineEntries, groupTimelineEntries, renderJournalTimelineHTML };

const STORAGE_JOURNAL_KEY = 'nook_journal';
const CURRENT_VERSION = 1;

/**
 * Initializes and retrieves the versioned journal data store.
 */
export function getJournalStore() {
  try {
    const raw = localStorage.getItem(STORAGE_JOURNAL_KEY);
    if (!raw) {
      return {
        version: CURRENT_VERSION,
        bookmarks: [],
        highlights: [],
        notes: []
      };
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      return { version: CURRENT_VERSION, bookmarks: [], highlights: [], notes: [] };
    }
    if (!Array.isArray(data.bookmarks)) {
      data.bookmarks = [];
    } else {
      const seen = new Set();
      data.bookmarks = data.bookmarks.filter((bm) => {
        if (!bm || !bm.bookId) return false;
        if (seen.has(bm.bookId)) return false;
        seen.add(bm.bookId);
        return true;
      });
    }
    if (!Array.isArray(data.highlights)) data.highlights = [];
    if (!Array.isArray(data.notes)) data.notes = [];
    return data;
  } catch (e) {
    console.warn('[JOURNAL] Error reading journal storage:', e);
    return { version: CURRENT_VERSION, bookmarks: [], highlights: [], notes: [] };
  }
}

/**
 * Persists the journal store to localStorage.
 */
export function saveJournalStore(store) {
  try {
    store.version = CURRENT_VERSION;
    localStorage.setItem(STORAGE_JOURNAL_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    console.warn('[JOURNAL] Error writing journal storage:', e);
    return false;
  }
}

/* ============================================================================
   BOOKMARKS & PHYSICAL BOOKMARK STYLES
   ============================================================================ */

export const BOOKMARK_STYLES = [
  {
    id: 'crimson-silk',
    name: 'Crimson Silk',
    description: 'Deep terracotta & crimson ribbon with gold foil flourish',
    accentColor: '#8C3A27'
  },
  {
    id: 'sage-linen',
    name: 'Sage Linen',
    description: 'Muted botanical sage green with blind debossed leaf motif',
    accentColor: '#5C715E'
  },
  {
    id: 'classic-cream',
    name: 'Deckled Ivory',
    description: 'Warm antique deckled-edge paper with letterpress typography',
    accentColor: '#C4A877'
  },
  {
    id: 'midnight-gold',
    name: 'Midnight & Gold',
    description: 'Deep obsidian charcoal card with fine gold celestial rule',
    accentColor: '#2B3A42'
  }
];

export function getBookmarks(bookId = null) {
  const store = getJournalStore();
  if (bookId) {
    return store.bookmarks.filter((b) => b.bookId === bookId);
  }
  return store.bookmarks;
}

export function getBookBookmark(bookId) {
  if (!bookId) return null;
  const store = getJournalStore();
  return store.bookmarks.find((b) => b.bookId === bookId) || null;
}

export function getPageBookmark(bookId, pageNumber) {
  if (!bookId || typeof pageNumber !== 'number') return null;
  const store = getJournalStore();
  const bookBookmark = store.bookmarks.find((b) => b.bookId === bookId);
  if (bookBookmark && bookBookmark.pageNumber === pageNumber) {
    return bookBookmark;
  }
  return null;
}

export function isPageBookmarked(bookId, pageNumber) {
  return !!getPageBookmark(bookId, pageNumber);
}

/**
 * Adds or moves the single physical bookmark for a book to the specified page.
 * Enforces the invariant: exactly 0 or 1 active bookmark per bookId.
 */
export function addBookmark({ bookId, bookTitle, author, chapterNumber, chapterTitle, pageNumber, totalPages, bookmarkStyle = 'crimson-silk' }) {
  if (!bookId || typeof pageNumber !== 'number') return null;
  const store = getJournalStore();

  // Find any existing bookmark for this bookId (at most one per book)
  const existingIndex = store.bookmarks.findIndex((b) => b.bookId === bookId);
  
  const bookmark = {
    id: existingIndex >= 0 ? store.bookmarks[existingIndex].id : `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'bookmark',
    bookId,
    bookTitle: bookTitle || (existingIndex >= 0 ? store.bookmarks[existingIndex].bookTitle : 'Untitled'),
    author: author || (existingIndex >= 0 ? store.bookmarks[existingIndex].author : 'Unknown Author'),
    chapterNumber: chapterNumber || 1,
    chapterTitle: chapterTitle || `Chapter ${chapterNumber || 1}`,
    pageNumber,
    totalPages: totalPages || (existingIndex >= 0 ? store.bookmarks[existingIndex].totalPages : null),
    bookmarkStyle: bookmarkStyle || (existingIndex >= 0 ? store.bookmarks[existingIndex].bookmarkStyle : 'crimson-silk'),
    createdAt: existingIndex >= 0 ? store.bookmarks[existingIndex].createdAt : Date.now(),
    updatedAt: Date.now()
  };

  // Remove any legacy duplicates for this bookId and place the updated bookmark
  store.bookmarks = store.bookmarks.filter((b) => b.bookId !== bookId);
  store.bookmarks.unshift(bookmark);

  saveJournalStore(store);
  return bookmark;
}

export function removeBookmark(idOrBookId, pageNumber = null) {
  const store = getJournalStore();
  if (pageNumber !== null) {
    store.bookmarks = store.bookmarks.filter(
      (b) => !(b.bookId === idOrBookId && b.pageNumber === pageNumber)
    );
  } else {
    store.bookmarks = store.bookmarks.filter((b) => b.id !== idOrBookId && b.bookId !== idOrBookId);
  }
  saveJournalStore(store);
}

export function toggleBookmark({ bookId, bookTitle, author, chapterNumber, chapterTitle, pageNumber, totalPages, bookmarkStyle = 'crimson-silk' }) {
  if (isPageBookmarked(bookId, pageNumber)) {
    removeBookmark(bookId, pageNumber);
    return { bookmarked: false };
  } else {
    const bookmark = addBookmark({ bookId, bookTitle, author, chapterNumber, chapterTitle, pageNumber, totalPages, bookmarkStyle });
    return { bookmarked: true, bookmark };
  }
}

/* ============================================================================
   HIGHLIGHTS
   ============================================================================ */

export function getHighlights(bookId = null) {
  const store = getJournalStore();
  if (bookId) {
    return store.highlights.filter((h) => h.bookId === bookId);
  }
  return store.highlights;
}

export function addHighlight({ bookId, bookTitle, author, chapterNumber, chapterTitle, pageNumber, selectedText }) {
  if (!bookId || !selectedText || !selectedText.trim()) return null;
  const store = getJournalStore();

  const highlight = {
    id: `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'highlight',
    bookId,
    bookTitle: bookTitle || 'Untitled',
    author: author || 'Unknown Author',
    chapterNumber: chapterNumber || 1,
    chapterTitle: chapterTitle || `Chapter ${chapterNumber || 1}`,
    pageNumber: pageNumber || 1,
    selectedText: selectedText.trim(),
    createdAt: Date.now()
  };

  store.highlights.unshift(highlight);
  saveJournalStore(store);
  return highlight;
}

export function removeHighlight(idOrCriteria) {
  if (!idOrCriteria) return;
  const store = getJournalStore();
  if (typeof idOrCriteria === 'string') {
    store.highlights = store.highlights.filter((h) => h.id !== idOrCriteria);
  } else if (typeof idOrCriteria === 'object') {
    const { id, bookId, chapterNumber, pageNumber, selectedText } = idOrCriteria;
    if (id) {
      store.highlights = store.highlights.filter((h) => h.id !== id);
    } else {
      store.highlights = store.highlights.filter((h) => {
        const matchBook = !bookId || h.bookId === bookId;
        const matchChap = !chapterNumber || h.chapterNumber === chapterNumber;
        const matchPage = !pageNumber || h.pageNumber === pageNumber;
        const matchText = !selectedText || h.selectedText === (selectedText && selectedText.trim());
        return !(matchBook && matchChap && matchPage && matchText);
      });
    }
  }
  saveJournalStore(store);
}

/* ============================================================================
   PERSONAL NOTES
   ============================================================================ */

export function getNotes(bookId = null) {
  const store = getJournalStore();
  if (bookId) {
    return store.notes.filter((n) => n.bookId === bookId);
  }
  return store.notes;
}

export function addNote({ bookId, bookTitle, author, chapterNumber, chapterTitle, pageNumber, selectedText = null, note }) {
  if (!bookId || !note || !note.trim()) return null;
  const store = getJournalStore();

  const noteEntry = {
    id: `nt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: 'note',
    bookId,
    bookTitle: bookTitle || 'Untitled',
    author: author || 'Unknown Author',
    chapterNumber: chapterNumber || 1,
    chapterTitle: chapterTitle || `Chapter ${chapterNumber || 1}`,
    pageNumber: pageNumber || 1,
    selectedText: (selectedText && selectedText.trim()) ? selectedText.trim() : null,
    note: note.trim(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  store.notes.unshift(noteEntry);
  saveJournalStore(store);
  return noteEntry;
}

export function updateNote(noteId, updatedNoteText) {
  if (!noteId || !updatedNoteText || !updatedNoteText.trim()) return null;
  const store = getJournalStore();
  const entry = store.notes.find((n) => n.id === noteId);
  if (entry) {
    entry.note = updatedNoteText.trim();
    entry.updatedAt = Date.now();
    saveJournalStore(store);
    return entry;
  }
  return null;
}

export function removeNote(noteId) {
  const store = getJournalStore();
  store.notes = store.notes.filter((n) => n.id !== noteId);
  saveJournalStore(store);
}

/* ============================================================================
   JOURNAL QUERY & STATS
   ============================================================================ */

export function getJournalStats() {
  const store = getJournalStore();
  return {
    totalBookmarks: store.bookmarks.length,
    totalHighlights: store.highlights.length,
    totalNotes: store.notes.length,
    totalEntries: store.bookmarks.length + store.highlights.length + store.notes.length
  };
}

/**
 * Returns all journal entries sorted chronologically (newest first), with optional filtering.
 */
export function getJournalEntries({ type = 'all', searchQuery = '', bookId = null } = {}) {
  const store = getJournalStore();
  let entries = [];

  if (type === 'all' || type === 'bookmarks') {
    entries.push(...store.bookmarks);
  }
  if (type === 'all' || type === 'highlights') {
    entries.push(...store.highlights);
  }
  if (type === 'all' || type === 'notes') {
    entries.push(...store.notes);
  }

  // Filter by bookId
  if (bookId) {
    entries = entries.filter((e) => e.bookId === bookId);
  }

  // Filter by search query
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    entries = entries.filter((e) => {
      const matchTitle = (e.bookTitle || '').toLowerCase().includes(q);
      const matchAuthor = (e.author || '').toLowerCase().includes(q);
      const matchChapter = (e.chapterTitle || '').toLowerCase().includes(q);
      const matchText = (e.selectedText || '').toLowerCase().includes(q);
      const matchNote = (e.note || '').toLowerCase().includes(q);
      return matchTitle || matchAuthor || matchChapter || matchText || matchNote;
    });
  }

  // Sort chronological descending (newest first)
  entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return entries;
}

/* ============================================================================
   JOURNAL VIEW RENDERER
   ============================================================================ */

export function renderJournalView({
  containerId = 'view-journal',
  activeSection = 'commonplace',
  filterType = 'all',
  searchQuery = '',
  selectedBookId = null,
  catalog = [],
  onNavigate = () => {},
  onOpenPassage = () => {}
}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = {
    containerId,
    activeSection,
    filterType,
    searchQuery,
    selectedBookId,
    catalog,
    onNavigate,
    onOpenPassage
  };

  const store = getJournalStore();
  const stats = getJournalStats();

  if (activeSection === 'insights') {
    const readingHistory = getAllReadingProgress();
    const insightsHtml = renderReadingInsightsHTML({ catalog, readingHistory, journalData: store });
    container.innerHTML = `
      <div class="journal-wrapper reveal-layer-2">
        <header class="journal-header">
          <div class="journal-section-tabs" role="tablist" aria-label="Journal sections">
            <button class="j-section-tab" data-jsection="commonplace" role="tab" aria-selected="false">
              Commonplace Book
            </button>
            <button class="j-section-tab" data-jsection="timeline" role="tab" aria-selected="false">
              Reading Timeline
            </button>
            <button class="j-section-tab active" data-jsection="insights" role="tab" aria-selected="true">
              Reading Insights
            </button>
          </div>
        </header>
        ${insightsHtml}
      </div>
    `;
    bindJournalEvents(container, state);
    bindReadingInsightsEvents(container, { onNavigate, onOpenPassage });
    return;
  }

  if (activeSection === 'timeline') {
    const timelineHtml = renderJournalTimelineHTML({
      store,
      catalog,
      type: filterType,
      searchQuery,
      selectedBookId
    });
    container.innerHTML = `
      <div class="journal-wrapper reveal-layer-2">
        <header class="journal-header">
          <div class="journal-section-tabs" role="tablist" aria-label="Journal sections">
            <button class="j-section-tab" data-jsection="commonplace" role="tab" aria-selected="false">
              Commonplace Book
            </button>
            <button class="j-section-tab active" data-jsection="timeline" role="tab" aria-selected="true">
              Reading Timeline
            </button>
            <button class="j-section-tab" data-jsection="insights" role="tab" aria-selected="false">
              Reading Insights
            </button>
          </div>

          <div class="section-kicker">READING CHRONOLOGY</div>
          <h1 class="journal-title">Your Reading Timeline</h1>
          <p class="journal-sub">A chronological journal of passages saved, notes inscribed, and ribbons placed across time.</p>

          <!-- Stats Bar -->
          <div class="journal-stats-bar">
            <span class="stat-item"><strong>${stats.totalEntries}</strong> total entr${stats.totalEntries === 1 ? 'y' : 'ies'}</span>
            <span class="stat-sep">·</span>
            <span class="stat-item"><strong>${stats.totalNotes}</strong> note${stats.totalNotes === 1 ? '' : 's'}</span>
            <span class="stat-sep">·</span>
            <span class="stat-item"><strong>${stats.totalHighlights}</strong> highlight${stats.totalHighlights === 1 ? '' : 's'}</span>
            <span class="stat-sep">·</span>
            <span class="stat-item"><strong>${stats.totalBookmarks}</strong> bookmark${stats.totalBookmarks === 1 ? '' : 's'}</span>
          </div>
        </header>

        ${timelineHtml}
      </div>
    `;
    bindJournalEvents(container, state);
    return;
  }

  const entries = getJournalEntries({ type: filterType, searchQuery, bookId: selectedBookId });

  // Get distinct books represented in journal for dropdown filter
  const booksInJournalMap = new Map();
  [...store.bookmarks, ...store.highlights, ...store.notes].forEach((e) => {
    if (e.bookId && !booksInJournalMap.has(e.bookId)) {
      const book = getBookById(e.bookId);
      booksInJournalMap.set(e.bookId, {
        id: e.bookId,
        title: e.bookTitle || (book && book.title) || e.bookId
      });
    }
  });
  const booksInJournal = Array.from(booksInJournalMap.values()).sort((a, b) => a.title.localeCompare(b.title));

  container.innerHTML = `
    <div class="journal-wrapper reveal-layer-2">
      <!-- Section Switcher Tabs -->
      <header class="journal-header">
        <div class="journal-section-tabs" role="tablist" aria-label="Journal sections">
          <button class="j-section-tab active" data-jsection="commonplace" role="tab" aria-selected="true">
            Commonplace Book
          </button>
          <button class="j-section-tab" data-jsection="timeline" role="tab" aria-selected="false">
            Reading Timeline
          </button>
          <button class="j-section-tab" data-jsection="insights" role="tab" aria-selected="false">
            Reading Insights
          </button>
        </div>

        <div class="section-kicker">READING JOURNAL</div>
        <h1 class="journal-title">Your Literary Commonplace Book</h1>
        <p class="journal-sub">Saved passages, marginal notes, and page ribbons collected while reading.</p>

        <!-- Stats Bar -->
        <div class="journal-stats-bar">
          <span class="stat-item"><strong>${stats.totalEntries}</strong> total entr${stats.totalEntries === 1 ? 'y' : 'ies'}</span>
          <span class="stat-sep">·</span>
          <span class="stat-item"><strong>${stats.totalNotes}</strong> note${stats.totalNotes === 1 ? '' : 's'}</span>
          <span class="stat-sep">·</span>
          <span class="stat-item"><strong>${stats.totalHighlights}</strong> highlight${stats.totalHighlights === 1 ? '' : 's'}</span>
          <span class="stat-sep">·</span>
          <span class="stat-item"><strong>${stats.totalBookmarks}</strong> bookmark${stats.totalBookmarks === 1 ? '' : 's'}</span>
        </div>
      </header>

      <!-- Journal Controls & Search Bar -->
      <div class="journal-controls-bar">
        <!-- Type Filter Tabs -->
        <div class="journal-type-tabs" role="tablist" aria-label="Journal entry filters">
          <button class="j-tab ${filterType === 'all' ? 'active' : ''}" data-jtype="all" role="tab" aria-selected="${filterType === 'all'}">All (${stats.totalEntries})</button>
          <button class="j-tab ${filterType === 'notes' ? 'active' : ''}" data-jtype="notes" role="tab" aria-selected="${filterType === 'notes'}">Notes (${stats.totalNotes})</button>
          <button class="j-tab ${filterType === 'highlights' ? 'active' : ''}" data-jtype="highlights" role="tab" aria-selected="${filterType === 'highlights'}">Highlights (${stats.totalHighlights})</button>
          <button class="j-tab ${filterType === 'bookmarks' ? 'active' : ''}" data-jtype="bookmarks" role="tab" aria-selected="${filterType === 'bookmarks'}">Bookmarks (${stats.totalBookmarks})</button>
        </div>

        <!-- Search & Book Filter Row -->
        <div class="journal-search-row">
          <div class="j-search-input-wrap">
            <input 
              type="search" 
              class="journal-search-input" 
              id="journalSearchInput" 
              placeholder="Search quotes, notes, or titles…" 
              value="${escapeHtml(searchQuery)}"
              aria-label="Search journal entries"
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

      <!-- Highlight Intelligence Thematic Panel -->
      ${(filterType === 'all' || filterType === 'highlights') && !searchQuery && !selectedBookId
        ? (store.highlights.length > 0
            ? renderHighlightIntelligenceHTML({ highlights: store.highlights, catalog })
            : (filterType === 'highlights' ? renderHighlightIntelligenceHTML({ highlights: [], catalog }) : ''))
        : ''}

      <!-- Journal Entries Stream -->
      <main class="journal-entries-stream" id="journalEntriesStream">
        ${entries.length > 0 ? entries.map((entry) => renderJournalEntryCard(entry)).join('') : renderJournalEmptyState(stats.totalEntries === 0)}
      </main>
    </div>
  `;

  bindJournalEvents(container, state);
}

function renderJournalEntryCard(entry) {
  const book = getBookById(entry.bookId);
  const coverUrl = book ? getBookCoverUrl(book) : `assets/covers/${entry.bookId}.webp`;
  const dateStr = formatDate(entry.createdAt);

  const typeLabels = {
    bookmark: 'PAGE BOOKMARK',
    highlight: 'SAVED PASSAGE',
    note: 'MARGINAL NOTE'
  };
  const typeLabel = typeLabels[entry.type] || 'ENTRY';

  const styleObj = entry.type === 'bookmark' ? BOOKMARK_STYLES.find(s => s.id === (entry.bookmarkStyle || 'crimson-silk')) : null;

  return `
    <article class="journal-entry-card entry-type-${entry.type}" data-entry-id="${entry.id}" data-book-id="${entry.bookId}">
      <div class="j-card-left-strip">
        <div class="j-cover-thumb">
          <img src="${coverUrl}" alt="Cover of ${escapeHtml(entry.bookTitle)}" loading="lazy" />
        </div>
      </div>

      <div class="j-card-body">
        <div class="j-card-meta-header">
          <div class="j-type-badge">${typeLabel}${styleObj ? ` · ${styleObj.name}` : ''}</div>
          <time class="j-card-date" datetime="${new Date(entry.createdAt).toISOString()}">${dateStr}</time>
        </div>

        <div class="j-card-book-row">
          <span class="j-book-title">${escapeHtml(entry.bookTitle)}</span>
          <span class="j-meta-sep">·</span>
          <span class="j-book-author">by ${escapeHtml(entry.author)}</span>
        </div>

        <div class="j-location-tag">
          <span class="j-loc-chapter">${escapeHtml(entry.chapterTitle)}</span>
          <span class="j-meta-sep">·</span>
          <span class="j-loc-page">Page ${entry.pageNumber}${entry.totalPages ? ` of ${entry.totalPages}` : ''}</span>
        </div>

        ${entry.selectedText ? `
          <blockquote class="j-quote-block">
            <p>“${escapeHtml(entry.selectedText)}”</p>
          </blockquote>
        ` : (entry.type === 'note' ? `
          <div class="j-page-reflection-tag">
            <span class="j-reflection-icon">📄</span>
            <span>Page Reflection</span>
          </div>
        ` : '')}

        ${entry.type === 'note' && entry.note ? `
          <div class="j-note-block">
            <div class="j-note-label">Personal Note</div>
            <p class="j-note-text">${escapeHtml(entry.note)}</p>
          </div>
        ` : ''}

        <div class="j-card-actions">
          <button 
            class="btn-open-passage" 
            data-action="open-passage" 
            data-book-id="${entry.bookId}" 
            data-chapter="${entry.chapterNumber}" 
            data-page="${entry.pageNumber}"
            aria-label="Open ${escapeHtml(entry.bookTitle)} at ${escapeHtml(entry.chapterTitle)}, Page ${entry.pageNumber}"
          >
            <span>Open passage</span>
            <span aria-hidden="true">→</span>
          </button>

          <div class="j-secondary-actions">
            ${entry.type === 'note' ? `
              <button class="btn-j-action edit-note-btn" data-action="edit-note" data-entry-id="${entry.id}" title="Edit note">Edit</button>
            ` : ''}
            <button class="btn-j-action delete-entry-btn" data-action="delete-entry" data-entry-id="${entry.id}" data-entry-type="${entry.type}" title="Delete entry">Delete</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderJournalEmptyState(isTrulyEmpty) {
  if (isTrulyEmpty) {
    return `
      <div class="journal-empty-container">
        <div class="j-empty-ornament" aria-hidden="true">❦</div>
        <h2 class="j-empty-title">Your Journal is Quiet</h2>
        <p class="j-empty-text">As you read in Nook, bookmark pages with stationery ribbons, highlight resonant passages with the physical highlighter, and leave personal reflections in the margin.</p>
        <div class="j-empty-guide">
          <div class="j-guide-item">
            <span class="j-guide-icon">🔖</span>
            <span class="j-guide-desc"><strong>Bookmarks:</strong> Click the bookmark ribbon on any page to choose a stationery design.</span>
          </div>
          <div class="j-guide-item">
            <span class="j-guide-icon">✎</span>
            <span class="j-guide-desc"><strong>Highlighter:</strong> Click the highlighter on the right page edge to enter highlighting mode.</span>
          </div>
          <div class="j-guide-item">
            <span class="j-guide-icon">✍</span>
            <span class="j-guide-desc"><strong>Notes:</strong> Click the paper note tab on the right page edge to capture reflections.</span>
          </div>
        </div>
      </div>
    `;
  }
  return `
    <div class="journal-empty-container">
      <h2 class="j-empty-title">No matching entries found</h2>
      <p class="j-empty-text">Try adjusting your search terms or filter selection.</p>
    </div>
  `;
}

function bindJournalEvents(container, state) {
  const { onNavigate, onOpenPassage } = state;

  // Section switcher tabs (Commonplace Book vs Reading Insights)
  const sectionTabs = container.querySelectorAll('.j-section-tab');
  sectionTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const jsection = e.currentTarget.getAttribute('data-jsection');
      renderJournalView({
        ...state,
        activeSection: jsection
      });
    });
  });

  // Type filter tab clicks
  const tabs = container.querySelectorAll('.j-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const jtype = e.currentTarget.getAttribute('data-jtype');
      renderJournalView({
        ...state,
        filterType: jtype
      });
    });
  });

  // Search input
  const searchInput = container.querySelector('#journalSearchInput');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        renderJournalView({
          ...state,
          searchQuery: e.target.value
        });
      }, 200);
    });
  }

  // Book filter select
  const bookSelect = container.querySelector('#journalBookSelect');
  if (bookSelect) {
    bookSelect.addEventListener('change', (e) => {
      renderJournalView({
        ...state,
        selectedBookId: e.target.value || null
      });
    });
  }

  // Action buttons: Open passage, Edit note, Delete entry
  container.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');

    if (action === 'open-passage') {
      const bookId = target.getAttribute('data-book-id');
      const chapter = parseInt(target.getAttribute('data-chapter'), 10) || 1;
      const page = parseInt(target.getAttribute('data-page'), 10) || 1;
      onOpenPassage({ bookId, chapterNumber: chapter, pageNumber: page });
    } else if (action === 'delete-entry') {
      const entryId = target.getAttribute('data-entry-id');
      const entryType = target.getAttribute('data-entry-type');
      if (confirm('Are you sure you want to remove this journal entry?')) {
        if (entryType === 'bookmark') removeBookmark(entryId);
        else if (entryType === 'highlight') removeHighlight(entryId);
        else if (entryType === 'note') removeNote(entryId);
        renderJournalView(state);
      }
    } else if (action === 'edit-note') {
      const entryId = target.getAttribute('data-entry-id');
      const store = getJournalStore();
      const noteEntry = store.notes.find((n) => n.id === entryId);
      if (noteEntry) {
        showNoteModal({
          noteEntry,
          onSave: (newText) => {
            updateNote(entryId, newText);
            renderJournalView(state);
          },
          onDelete: () => {
            removeNote(entryId);
            renderJournalView(state);
          }
        });
      }
    }
  });
}

/* ============================================================================
   BOOKMARK PICKER MODAL (PHYSICAL STATIONERY SELECTION)
   ============================================================================ */

export function showBookmarkPickerModal({
  bookId = '',
  bookTitle = '',
  author = '',
  chapterNumber = 1,
  chapterTitle = '',
  pageNumber = 1,
  totalPages = null,
  currentBookmark = null,
  onSelect = () => {},
  onRemove = () => {}
}) {
  const existing = document.getElementById('nookBookmarkPickerModal');
  if (existing) existing.remove();

  const currentStyleId = currentBookmark ? (currentBookmark.bookmarkStyle || 'crimson-silk') : null;

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'nook-modal-overlay';
  modalOverlay.id = 'nookBookmarkPickerModal';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-labelledby', 'bookmarkPickerTitle');

  modalOverlay.innerHTML = `
    <div class="nook-modal-card bookmark-picker-card">
      <header class="nook-modal-header">
        <div class="modal-kicker">PAGE BOOKMARK</div>
        <h2 id="bookmarkPickerTitle" class="modal-title">Tuck a Bookmark</h2>
        <div class="modal-location">${escapeHtml(chapterTitle)} · Page ${pageNumber}${totalPages ? ` of ${totalPages}` : ''}</div>
        <button class="modal-close-btn" id="bmPickerCloseBtn" aria-label="Close modal">✕</button>
      </header>

      <div class="nook-modal-body">
        <p class="bm-picker-intro">Choose a stationery bookmark style for this page:</p>
        
        <div class="bm-styles-grid" role="radiogroup" aria-label="Bookmark styles">
          ${BOOKMARK_STYLES.map((style) => {
            const isSelected = currentStyleId === style.id;
            return `
              <button 
                type="button" 
                class="bm-style-option style-${style.id} ${isSelected ? 'selected' : ''}" 
                data-style-id="${style.id}" 
                role="radio" 
                aria-checked="${isSelected ? 'true' : 'false'}"
                aria-label="${style.name}: ${style.description}"
              >
                <div class="bm-preview-swatch">
                  <div class="bm-ribbon-preview preview-${style.id}">
                    <span class="preview-tail" aria-hidden="true"></span>
                  </div>
                </div>
                <div class="bm-style-meta">
                  <div class="bm-style-name">${style.name}</div>
                  <div class="bm-style-desc">${style.description}</div>
                </div>
                ${isSelected ? '<span class="bm-current-badge">Placed</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <footer class="nook-modal-footer">
        <div class="modal-footer-left">
          ${currentBookmark ? `
            <button class="btn-text-danger" id="bmRemoveBtn" type="button">Remove Bookmark</button>
          ` : ''}
        </div>
        <div class="modal-footer-right">
          <button class="btn secondary" id="bmPickerCancelBtn" type="button">Cancel</button>
        </div>
      </footer>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const closeModal = () => {
    modalOverlay.classList.add('closing');
    setTimeout(() => {
      if (modalOverlay.parentNode) modalOverlay.parentNode.removeChild(modalOverlay);
    }, 180);
    window.removeEventListener('keydown', handleKeydown);
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };

  window.addEventListener('keydown', handleKeydown);

  const closeBtn = modalOverlay.querySelector('#bmPickerCloseBtn');
  const cancelBtn = modalOverlay.querySelector('#bmPickerCancelBtn');
  const removeBtn = modalOverlay.querySelector('#bmRemoveBtn');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      removeBookmark(bookId, pageNumber);
      closeModal();
      onRemove();
    });
  }

  const styleOptions = modalOverlay.querySelectorAll('.bm-style-option');
  styleOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedStyleId = btn.getAttribute('data-style-id');
      addBookmark({
        bookId,
        bookTitle,
        author,
        chapterNumber,
        chapterTitle,
        pageNumber,
        totalPages,
        bookmarkStyle: selectedStyleId
      });
      closeModal();
      onSelect(selectedStyleId);
    });
  });

  // Click outside to close
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

/* ============================================================================
   NOTE MODAL (LIGHTWEIGHT & ACCESSIBLE)
   ============================================================================ */

export function showNoteModal({
  bookId = '',
  bookTitle = '',
  author = '',
  chapterNumber = 1,
  chapterTitle = '',
  pageNumber = 1,
  selectedText = null,
  noteEntry = null,
  onSave = () => {},
  onDelete = null
}) {
  // Remove any existing note modal
  const existing = document.getElementById('nookNoteModal');
  if (existing) existing.remove();

  const isEditing = !!noteEntry;
  const initialNote = isEditing ? noteEntry.note : '';
  const currentTitle = isEditing ? noteEntry.bookTitle : bookTitle;
  const currentChapter = isEditing ? noteEntry.chapterTitle : chapterTitle;
  const currentPage = isEditing ? noteEntry.pageNumber : pageNumber;
  const currentText = isEditing ? noteEntry.selectedText : (selectedText && selectedText.trim() ? selectedText.trim() : null);

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'nook-modal-overlay';
  modalOverlay.id = 'nookNoteModal';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-labelledby', 'noteModalTitle');

  modalOverlay.innerHTML = `
    <div class="nook-modal-card">
      <header class="nook-modal-header">
        <div class="modal-kicker">${isEditing ? 'EDIT NOTE' : (currentText ? 'ADD PASSAGE NOTE' : 'ADD PAGE NOTE')}</div>
        <h2 id="noteModalTitle" class="modal-title">${escapeHtml(currentTitle)}</h2>
        <div class="modal-location">${escapeHtml(currentChapter)} · Page ${currentPage}</div>
        <button class="modal-close-btn" id="noteModalCloseBtn" aria-label="Close modal">✕</button>
      </header>

      <div class="nook-modal-body">
        ${currentText ? `
          <blockquote class="modal-quote">
            <p>“${escapeHtml(currentText)}”</p>
          </blockquote>
        ` : `
          <div class="modal-page-note-badge">
            <span class="badge-icon" aria-hidden="true">📄</span>
            <span>Page Reflection · Marginal note for Page ${currentPage}</span>
          </div>
        `}

        <label for="noteInput" class="modal-label">Your Note &amp; Marginalia</label>
        <textarea 
          id="noteInput" 
          class="modal-textarea" 
          rows="4" 
          placeholder="Write your thoughts, reflections, or marginal notes here…"
          autofocus
        >${escapeHtml(initialNote)}</textarea>
      </div>

      <footer class="nook-modal-footer">
        <div class="modal-footer-left">
          ${isEditing && onDelete ? `
            <button class="btn-text-danger" id="noteModalDeleteBtn" type="button">Delete Note</button>
          ` : ''}
        </div>
        <div class="modal-footer-right">
          <button class="btn secondary" id="noteModalCancelBtn" type="button">Cancel</button>
          <button class="btn dark-on-butter" id="noteModalSaveBtn" type="button">${isEditing ? 'Save Changes' : 'Save Note'}</button>
        </div>
      </footer>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const textarea = modalOverlay.querySelector('#noteInput');
  const saveBtn = modalOverlay.querySelector('#noteModalSaveBtn');
  const cancelBtn = modalOverlay.querySelector('#noteModalCancelBtn');
  const closeBtn = modalOverlay.querySelector('#noteModalCloseBtn');
  const deleteBtn = modalOverlay.querySelector('#noteModalDeleteBtn');

  const closeModal = () => {
    modalOverlay.classList.add('closing');
    setTimeout(() => {
      if (modalOverlay.parentNode) modalOverlay.parentNode.removeChild(modalOverlay);
    }, 180);
    window.removeEventListener('keydown', handleKeydown);
  };

  const handleSave = () => {
    const val = textarea.value.trim();
    if (!val) {
      textarea.focus();
      return;
    }
    closeModal();
    if (isEditing) {
      onSave(val);
    } else {
      addNote({
        bookId,
        bookTitle,
        author,
        chapterNumber,
        chapterTitle,
        pageNumber,
        selectedText: currentText,
        note: val
      });
      onSave(val);
    }
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  window.addEventListener('keydown', handleKeydown);
  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);

  if (deleteBtn && onDelete) {
    deleteBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this note?')) {
        closeModal();
        onDelete();
      }
    });
  }

  // Click outside card to close
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  textarea.focus();
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
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
