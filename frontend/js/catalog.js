/**
 * Nook Catalog Data Access Layer
 * Loads, validates, and manages the verified Phase 2 public-domain catalog (data/seed/books.json).
 * 
 * STRICT RULES:
 * - Never invent fallback book records.
 * - Enforce schema validation on runtime fetch.
 * - Provide graceful loading & error states.
 */

const CANDIDATE_URLS = [
  'data/seed/books.json',
  '/data/seed/books.json',
  '../data/seed/books.json'
];

const STORAGE_PROGRESS_KEY = 'nook_reading_progress';

// Curated editorial book cover palette for typographic book rendering
const EDITORIAL_PALETTES = [
  { bg: '#95A8BA', foil: '#F7F3EB', text: '#FFFFFF', tag: 'Wedgwood Blue' },
  { bg: '#7B8E6D', foil: '#E8DEC8', text: '#FFFFFF', tag: 'Sage Leather' },
  { bg: '#C4A877', foil: '#FAF6EE', text: '#FFFFFF', tag: 'Warm Amber' },
  { bg: '#9E829F', foil: '#F6EFF7', text: '#FFFFFF', tag: 'Mulberry Cloth' },
  { bg: '#8B9A92', foil: '#EDE7DC', text: '#FFFFFF', tag: 'Moss Slate' },
  { bg: '#B39274', foil: '#FBF8F2', text: '#FFFFFF', tag: 'Tuscan Ochre' }
];

let cachedCatalog = null;
let loadPromise = null;

/**
 * Validates a single book record against the formal Phase 2 schema.
 */
export function validateBookRecord(book) {
  if (!book || typeof book !== 'object') return false;
  if (!book.id || typeof book.id !== 'string') return false;
  if (!book.title || typeof book.title !== 'string') return false;
  if (!book.author || typeof book.author !== 'string') return false;
  if (!Array.isArray(book.categories) || book.categories.length === 0) return false;
  if (typeof book.publication_year !== 'number' || book.publication_year < -3000 || book.publication_year > 2030 || book.publication_year === 0) return false;
  if (typeof book.estimated_reading_time !== 'number' || book.estimated_reading_time < 0) return false;
  return true;
}

/**
 * Resolves the canonical URL for a book's cover image from its catalog metadata.
 */
export function getBookCoverUrl(book) {
  if (!book) return 'assets/covers/default.png';
  if (typeof book === 'object' && book.cover) {
    return book.cover;
  }
  const id = typeof book === 'string' ? book : (book.id || '');
  if (!id) return 'assets/covers/default.png';
  
  const customCovers = {
    'a-christmas-carol': 'assets/covers/a-christmas-carol.webp',
    'a-little-princess': 'assets/covers/a-little-princess.webp',
    'a-portrait-of-the-artist-as-a-young-man': 'assets/covers/a-portrait-of-the-artist-as-a-young-man.webp',
    'a-room-with-a-view': 'assets/covers/a-room-with-a-view.webp',
    'a-study-in-scarlet': 'assets/covers/a-study-in-scarlet.webp',
    'a-tale-of-two-cities': 'assets/covers/a-tale-of-two-cities.webp',
    'adventures-of-huckleberry-finn': 'assets/covers/adventures-of-huckleberry-finn.webp',
    'alices-adventures-in-wonderland': 'assets/covers/alices-adventures-in-wonderland.webp',
    'anna-karenina': 'assets/covers/anna-karenina.webp',
    'anne-of-avonlea': 'assets/covers/anne-of-avonlea.webp',
    'anne-of-green-gables': 'assets/covers/anne-of-green-gables.webp',
    'anne-of-the-island': 'assets/covers/anne-of-the-island.webp',
    'around-the-world-in-eighty-days': 'assets/covers/around-the-world-in-eighty-days.webp',
    'bartleby-the-scrivener': 'assets/covers/bartleby-the-scrivener.webp',
    'crime-and-punishment': 'assets/covers/crime-and-punishment.webp',
    'david-copperfield': 'assets/covers/david-copperfield.webp',
    'dracula': 'assets/covers/dracula.webp',
    'dubliners': 'assets/covers/dubliners.webp',
    'emma': 'assets/covers/emma.webp',
    'far-from-the-madding-crowd': 'assets/covers/far-from-the-madding-crowd.webp',
    'frankenstein': 'assets/covers/frankenstein.webp',
    'great-expectations': 'assets/covers/great-expectations.webp',
    'heart-of-darkness': 'assets/covers/heart-of-darkness.webp',
    'jane-eyre': 'assets/covers/jane-eyre.webp',
    'jos-boys': 'assets/covers/jos-boys.webp',
    'journey-to-the-center-of-the-earth': 'assets/covers/journey-to-the-center-of-the-earth.webp',
    'kidnapped': 'assets/covers/kidnapped.webp',
    'les-miserables': 'assets/covers/les-miserables.webp',
    'little-men': 'assets/covers/little-men.webp',
    'little-women': 'assets/covers/little-women.webp',
    'madame-bovary': 'assets/covers/madame-bovary.webp',
    'mansfield-park': 'assets/covers/mansfield-park.webp',
    'meditations': 'assets/covers/meditations.webp',
    'moby-dick': 'assets/covers/moby-dick.webp',
    'northanger-abbey': 'assets/covers/northanger-abbey.webp',
    'notes-from-underground': 'assets/covers/notes-from-underground.webp',
    'oliver-twist': 'assets/covers/oliver-twist.webp',
    'persuasion': 'assets/covers/persuasion.webp',
    'peter-and-wendy': 'assets/covers/peter-and-wendy.webp',
    'pride-and-prejudice': 'assets/covers/pride-and-prejudice.webp',
    'sense-and-sensibility': 'assets/covers/sense-and-sensibility.webp',
    'silas-marner': 'assets/covers/silas-marner.webp',
    'tess-of-the-durbervilles': 'assets/covers/tess-of-the-durbervilles.webp',
    'the-adventures-of-sherlock-holmes': 'assets/covers/the-adventures-of-sherlock-holmes.webp',
    'the-adventures-of-tom-sawyer': 'assets/covers/the-adventures-of-tom-sawyer.webp',
    'the-age-of-innocence': 'assets/covers/the-age-of-innocence.webp',
    'the-awakening': 'assets/covers/the-awakening.webp',
    'the-brothers-karamazov': 'assets/covers/the-brothers-karamazov.webp',
    'the-call-of-the-wild': 'assets/covers/the-call-of-the-wild.webp',
    'the-count-of-monte-cristo': 'assets/covers/the-count-of-monte-cristo.webp',
    'the-death-of-ivan-ilyich': 'assets/covers/the-death-of-ivan-ilyich.webp',
    'the-first-men-in-the-moon': 'assets/covers/the-first-men-in-the-moon.webp',
    'the-great-gatsby': 'assets/covers/the-great-gatsby.webp',
    'the-hound-of-the-baskervilles': 'assets/covers/the-hound-of-the-baskervilles.webp',
    'the-house-of-mirth': 'assets/covers/the-house-of-mirth.webp',
    'the-house-of-the-seven-gables': 'assets/covers/the-house-of-the-seven-gables.webp',
    'the-hunchback-of-notre-dame': 'assets/covers/the-hunchback-of-notre-dame.webp',
    'the-idiot': 'assets/covers/the-idiot.webp',
    'the-iliad': 'assets/covers/the-iliad.webp',
    'the-importance-of-being-earnest': 'assets/covers/the-importance-of-being-earnest.webp',
    'the-invisible-man': 'assets/covers/the-invisible-man.webp',
    'the-island-of-doctor-moreau': 'assets/covers/the-island-of-doctor-moreau.webp',
    'the-jungle-book': 'assets/covers/the-jungle-book.webp',
    'the-lost-world': 'assets/covers/the-lost-world.webp',
    'the-man-in-the-brown-suit': 'assets/covers/the-man-in-the-brown-suit.webp',
    'the-mayor-of-casterbridge': 'assets/covers/the-mayor-of-casterbridge.webp',
    'the-memoirs-of-sherlock-holmes': 'assets/covers/the-memoirs-of-sherlock-holmes.webp',
    'the-metamorphosis': 'assets/covers/the-metamorphosis.webp',
    'the-moonstone': 'assets/covers/the-moonstone.webp',
    'the-murder-of-roger-ackroyd': 'assets/covers/the-murder-of-roger-ackroyd.webp',
    'the-murder-on-the-links': 'assets/covers/the-murder-on-the-links.webp',
    'the-mysterious-affair-at-styles': 'assets/covers/the-mysterious-affair-at-styles.webp',
    'the-odyssey': 'assets/covers/the-odyssey.webp',
    'the-phantom-of-the-opera': 'assets/covers/the-phantom-of-the-opera.webp',
    'the-picture-of-dorian-gray': 'assets/covers/the-picture-of-dorian-gray.webp',
    'the-prince-and-the-pauper': 'assets/covers/the-prince-and-the-pauper.webp',
    'the-prisoner-of-zenda': 'assets/covers/the-prisoner-of-zenda.webp',
    'the-red-badge-of-courage': 'assets/covers/the-red-badge-of-courage.webp',
    'the-return-of-sherlock-holmes': 'assets/covers/the-return-of-sherlock-holmes.webp',
    'the-scarlet-letter': 'assets/covers/the-scarlet-letter.webp',
    'the-scarlet-pimpernel': 'assets/covers/the-scarlet-pimpernel.webp',
    'the-sea-wolf': 'assets/covers/the-sea-wolf.webp',
    'the-second-jungle-book': 'assets/covers/the-second-jungle-book.webp',
    'the-secret-adversary': 'assets/covers/the-secret-adversary.webp',
    'the-secret-agent': 'assets/covers/the-secret-agent.webp',
    'the-secret-garden': 'assets/covers/the-secret-garden.webp',
    'the-secret-of-chimneys': 'assets/covers/the-secret-of-chimneys.webp',
    'the-sign-of-the-four': 'assets/covers/the-sign-of-the-four.webp',
    'the-strange-case-of-dr-jekyll-and-mr-hyde': 'assets/covers/the-strange-case-of-dr-jekyll-and-mr-hyde.webp',
    'the-tenant-of-wildfell-hall': 'assets/covers/the-tenant-of-wildfell-hall.webp',
    'the-three-musketeers': 'assets/covers/the-three-musketeers.webp',
    'the-time-machine': 'assets/covers/the-time-machine.webp',
    'the-trial': 'assets/covers/the-trial.webp',
    'the-turn-of-the-screw': 'assets/covers/the-turn-of-the-screw.webp',
    'the-war-of-the-worlds': 'assets/covers/the-war-of-the-worlds.webp',
    'the-wind-in-the-willows': 'assets/covers/the-wind-in-the-willows.webp',
    'the-woman-in-white': 'assets/covers/the-woman-in-white.webp',
    'the-wonderful-wizard-of-oz': 'assets/covers/the-wonderful-wizard-of-oz.webp',
    'the-yellow-wallpaper': 'assets/covers/the-yellow-wallpaper.webp',
    'treasure-island': 'assets/covers/treasure-island.webp',
    'twenty-thousand-leagues-under-the-sea': 'assets/covers/twenty-thousand-leagues-under-the-sea.webp',
    'twenty-years-after': 'assets/covers/twenty-years-after.webp',
    'war-and-peace': 'assets/covers/war-and-peace.webp',
    'white-fang': 'assets/covers/white-fang.webp',
    'wuthering-heights': 'assets/covers/wuthering-heights.webp'
  };
  if (customCovers[id]) {
    return customCovers[id];
  }
  return `assets/covers/${id}.svg`;
}

/**
 * Assigns a deterministic, harmonious palette to a book for typographic cover rendering.
 */
export function getBookPalette(book, index = 0) {
  if (book && book.cover_config && book.cover_config.palette) {
    return book.cover_config.palette;
  }
  let hash = 0;
  const str = (book && (book.id || book.title)) || String(index);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const paletteIndex = Math.abs(hash) % EDITORIAL_PALETTES.length;
  return EDITORIAL_PALETTES[paletteIndex];
}

/**
 * Fetches and validates the verified seed catalog.
 */
export async function fetchCatalog(forceReload = false) {
  if (cachedCatalog && !forceReload) {
    return cachedCatalog;
  }

  if (loadPromise && !forceReload) {
    return loadPromise;
  }

  loadPromise = (async () => {
    let rawData = null;
    let lastError = null;

    for (const url of CANDIDATE_URLS) {
      try {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response.ok) {
          rawData = await response.json();
          break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!rawData || !Array.isArray(rawData)) {
      throw new Error(
        lastError
          ? `Failed to fetch verified catalog: ${lastError.message}`
          : 'Could not load verified books.json from any known candidate path.'
      );
    }

    const validated = [];
    for (const record of rawData) {
      if (validateBookRecord(record)) {
        validated.push({
          ...record,
          palette: getBookPalette(record, validated.length)
        });
      } else {
        console.warn('[CATALOG] Skipped invalid book record:', record);
      }
    }

    if (validated.length === 0) {
      throw new Error('Verified catalog contains zero valid book records.');
    }

    cachedCatalog = validated;
    return validated;
  })();

  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

/**
 * Synchronously returns cached catalog if already loaded, or null.
 */
export function getCachedCatalog() {
  return cachedCatalog;
}

/**
 * Retrieves a single book by ID from the loaded catalog.
 */
export function getBookById(id) {
  if (!cachedCatalog) return null;
  return cachedCatalog.find((b) => b.id === id) || null;
}

/**
 * Extracts all unique categories with exact book counts from the loaded catalog.
 */
export function getCatalogCategories() {
  if (!cachedCatalog) return [];
  const map = new Map();

  for (const book of cachedCatalog) {
    for (const cat of book.categories) {
      if (!map.has(cat)) {
        map.set(cat, { name: cat, count: 0, books: [] });
      }
      const entry = map.get(cat);
      entry.count++;
      entry.books.push(book);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Reads the raw progress store from localStorage, migrating legacy records if necessary.
 */
export function getReadingProgressStore() {
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS_KEY);
    if (!raw) return { books: {}, lastActiveBookId: null };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { books: {}, lastActiveBookId: null };
    }

    // Legacy format migration: { bookId, chapterNumber, chapterTitle, progressPercent, updatedAt }
    if (parsed.bookId && !parsed.books) {
      const lastAccessedAt = parsed.lastAccessedAt || (parsed.updatedAt ? new Date(parsed.updatedAt).getTime() : Date.now());
      return {
        books: {
          [parsed.bookId]: {
            ...parsed,
            lastAccessedAt
          }
        },
        lastActiveBookId: parsed.bookId
      };
    }

    if (parsed.books && typeof parsed.books === 'object') {
      return parsed;
    }

    return { books: {}, lastActiveBookId: null };
  } catch (e) {
    console.warn('[CATALOG] Error reading progress store:', e);
    return { books: {}, lastActiveBookId: null };
  }
}

/**
 * Returns all active reading progress records with attached book metadata from the catalog.
 */
export function getAllReadingProgress() {
  const store = getReadingProgressStore();
  const list = Object.values(store.books || {});
  if (cachedCatalog) {
    return list
      .map((r) => ({ ...r, book: getBookById(r.bookId) }))
      .filter((r) => r.book !== null);
  }
  return list;
}

/**
 * Reads user's most recently active reading progress.
 * Returns null if no progress exists or if referenced book does not exist in the verified catalog.
 */
export function getReadingProgress() {
  const all = getAllReadingProgress();
  if (all.length === 0) return null;
  // Sort by lastAccessedAt descending
  all.sort((a, b) => (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0));
  return all[0];
}

/**
 * Returns reading progress specifically for a single book ID, or null.
 */
export function getReadingProgressForBook(bookId) {
  if (!bookId) return null;
  const store = getReadingProgressStore();
  const record = store.books ? store.books[bookId] : null;
  if (!record) return null;
  if (cachedCatalog) {
    const book = getBookById(bookId);
    return book ? { ...record, book } : null;
  }
  return record;
}

/**
 * Saves real reading progress to localStorage for a specific book.
 * Updates lastAccessedAt to the current timestamp.
 */
export function saveReadingProgress(bookId, chapterNumber = 1, chapterTitle = 'Chapter 1', progressPercent = 0, scrollRatio = 0, pageNumber = null, totalPages = null) {
  try {
    const store = getReadingProgressStore();
    const now = Date.now();
    const existing = store.books ? store.books[bookId] : null;
    const updatedRecord = {
      bookId,
      chapterNumber,
      chapterTitle,
      progressPercent: Math.max(0, Math.min(100, Math.round(progressPercent))),
      scrollRatio: typeof scrollRatio === 'number' ? Math.max(0, Math.min(1, scrollRatio)) : (existing?.scrollRatio || 0),
      pageNumber: typeof pageNumber === 'number' ? pageNumber : (existing?.pageNumber || null),
      totalPages: typeof totalPages === 'number' ? totalPages : (existing?.totalPages || null),
      updatedAt: new Date(now).toISOString(),
      lastAccessedAt: now
    };

    if (!store.books) store.books = {};
    store.books[bookId] = updatedRecord;
    store.lastActiveBookId = bookId;

    // Save with both new structure and top-level fields for backwards compatibility
    const dataToSave = {
      ...updatedRecord,
      books: store.books,
      lastActiveBookId: bookId
    };

    localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(dataToSave));
    return updatedRecord;
  } catch (e) {
    console.warn('[CATALOG] Error saving reading progress:', e);
    return null;
  }
}

// In-memory cache for book chapter content
const cachedBookContent = new Map();

/**
 * Validates the structure of a book's full content JSON.
 */
export function validateBookContent(content) {
  if (!content || typeof content !== 'object') return false;
  if (!content.id || typeof content.id !== 'string') return false;
  if (!Array.isArray(content.chapters) || content.chapters.length === 0) return false;
  for (const chapter of content.chapters) {
    if (typeof chapter.number !== 'number') return false;
    if (typeof chapter.title !== 'string') return false;
    if (typeof chapter.content !== 'string') return false;
  }
  return true;
}

/**
 * Fetches real chapter text content for a book from data/books/{bookId}/content.json.
 */
export async function fetchBookContent(bookId, forceReload = false) {
  if (!bookId) {
    throw new Error('Book ID is required to fetch content.');
  }

  if (cachedBookContent.has(bookId) && !forceReload) {
    return cachedBookContent.get(bookId);
  }

  const book = getBookById(bookId);
  const candidates = [];
  
  if (book && book.text_location) {
    candidates.push(book.text_location);
    candidates.push(`/${book.text_location}`);
    candidates.push(`../${book.text_location}`);
  }

  candidates.push(`data/books/${bookId}/content.json`);
  candidates.push(`/data/books/${bookId}/content.json`);
  candidates.push(`../data/books/${bookId}/content.json`);

  // Remove duplicates
  const uniqueCandidates = Array.from(new Set(candidates));

  let rawContent = null;
  let lastError = null;

  for (const url of uniqueCandidates) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.ok) {
        rawContent = await response.json();
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!rawContent || !validateBookContent(rawContent)) {
    throw new Error(
      lastError
        ? `Failed to load book content for ${bookId}: ${lastError.message}`
        : `Could not load verified content for book ID "${bookId}".`
    );
  }

  cachedBookContent.set(bookId, rawContent);
  return rawContent;
}

