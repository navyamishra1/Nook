/**
 * Nook Home View Renderer
 * Personal Reading Dashboard & Reading Room.
 * Driven entirely by real reading progress and verified catalog metadata.
 */

import { getAllReadingProgress, getReadingProgress, getCatalogCategories, getBookCoverUrl } from './catalog.js';
import { computeHybridRecommendations, searchByReadingIntent } from './recommender.js';

/**
 * Generates an editorial book card element with custom SVG vector cover and typographic fallback.
 */
export function createBookCardMarkup(book, isPrimary = false) {
  const palette = book.palette || { bg: '#8FA07E', text: '#FFFFFF', foil: '#FDFBF7' };
  const readingHours = Math.max(1, Math.round(book.estimated_reading_time / 60));
  const primaryCategory = book.categories && book.categories[0] ? book.categories[0] : 'Classic';
  const formattedYear = book.publication_year < 0 ? `${Math.abs(book.publication_year)} BCE` : book.publication_year;
  const coverUrl = getBookCoverUrl(book);

  return `
    <article 
      class="book-card ${isPrimary ? 'primary' : ''}" 
      data-book-id="${book.id}"
      tabindex="0"
      role="button"
      aria-label="${escapeHtml(book.title)} by ${escapeHtml(book.author)}"
    >
      <div 
        class="cover" 
        style="background-color: ${palette.bg};"
      >
        <img 
          class="cover-svg-img" 
          src="${coverUrl}" 
          alt="Cover of ${escapeHtml(book.title)}" 
          loading="lazy"
          onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
        />
        <div class="cover-inner" style="display: none;">
          <div class="cover-tag">${escapeHtml(primaryCategory)}</div>
          <div class="cover-body">
            <div class="cover-title">${escapeHtml(book.title)}</div>
            <div class="cover-author">${escapeHtml(book.author)}</div>
          </div>
          <div class="cover-year">${formattedYear}</div>
        </div>
      </div>
      <div class="meta">
        <h3 class="title">${escapeHtml(book.title)}</h3>
        <div class="author">${escapeHtml(book.author)}</div>
        ${book.recommendationReason ? `<div class="rec-reason">${escapeHtml(book.recommendationReason)}</div>` : ''}
        <div class="tags-row">
          <span class="tag">${escapeHtml(primaryCategory)}</span>
          <span class="tag">~${readingHours} hr</span>
          <span class="tag">${formattedYear}</span>
        </div>
      </div>
    </article>
  `;
}

/**
 * Deterministic hybrid recommendation engine operating on TF-IDF content similarity,
 * user category affinity, current book proximity, and legitimate reading history.
 */
export function computeHomeRecommendations(catalog, readingHistory = []) {
  return computeHybridRecommendations(catalog, readingHistory);
}

/**
 * Renders the Continue Reading priority card.
 */
function renderContinueReadingCard(currentBook, currentProgress) {
  const palette = currentBook.palette || { bg: '#8FA07E', text: '#FFFFFF' };
  const percent = currentProgress.progressPercent || 0;
  const chapterText = currentProgress.chapterTitle || `Chapter ${currentProgress.chapterNumber || 1}`;
  const primaryCategory = currentBook.categories && currentBook.categories[0] ? currentBook.categories[0] : 'Classic';

  return `
    <section class="home-section continue-section reveal-layer-3" aria-labelledby="continue-heading">
      <div class="section-kicker">CONTINUE READING</div>
      <h2 id="continue-heading" class="visually-hidden">Continue Reading</h2>
      
      <div 
        class="continue-card" 
        data-book-id="${currentBook.id}" 
        data-chapter="${currentProgress.chapterNumber || 1}"
        data-page="${currentProgress.pageNumber || ''}"
        tabindex="0" 
        role="button" 
        aria-label="Continue reading ${escapeHtml(currentBook.title)}, ${percent}% complete"
      >
        <div class="continue-cover" style="background-color: ${palette.bg};">
          <img 
            class="cover-svg-img" 
            src="${getBookCoverUrl(currentBook)}" 
            alt="Cover of ${escapeHtml(currentBook.title)}" 
            loading="lazy"
            onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
          />
          <div class="cover-inner" style="display: none;">
            <div class="cover-tag">${escapeHtml(primaryCategory)}</div>
            <div class="cover-body">
              <div class="cover-title">${escapeHtml(currentBook.title)}</div>
              <div class="cover-author">${escapeHtml(currentBook.author)}</div>
            </div>
            <div class="cover-year">${currentBook.publication_year}</div>
          </div>
        </div>

        <div class="continue-body">
          <div class="continue-meta">
            <h3 class="continue-title">${escapeHtml(currentBook.title)}</h3>
            <div class="continue-author">${escapeHtml(currentBook.author)}</div>
          </div>

          <div class="continue-status">
            <span class="status-chapter">${escapeHtml(chapterText)}</span>
            <span class="status-dot">·</span>
            <span class="status-percent">${percent}% through the book</span>
          </div>

          <div class="continue-progress-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar-fill" style="width: ${percent}%;"></div>
          </div>

          <div class="continue-action-row">
            <button class="btn-continue-action" type="button">
              Continue reading <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Renders the personalized Home view.
 */
export function renderHomeView({ catalog, isLoading = false, error = null, onRetry = () => {}, onNavigate = () => {} }) {
  const homeView = document.getElementById('view-home');
  if (!homeView) return;

  // 1. Handle Loading State
  if (isLoading) {
    homeView.innerHTML = `
      <div class="home-state-container" aria-live="polite">
        <div class="nook-loading-spinner" aria-hidden="true"></div>
        <p class="loading-text">Opening your reading room…</p>
      </div>
    `;
    return;
  }

  // 2. Handle Error State
  if (error) {
    homeView.innerHTML = `
      <div class="home-state-container error-state" role="alert">
        <h2 class="error-title">Shelves momentarily unavailable</h2>
        <p class="error-text">${escapeHtml(error.message || 'Something went wrong while opening your shelves.')}</p>
        <button class="btn secondary retry-btn" id="homeRetryBtn">Try again</button>
      </div>
    `;
    const retryBtn = document.getElementById('homeRetryBtn');
    if (retryBtn) retryBtn.addEventListener('click', onRetry);
    return;
  }

  // 3. Handle Empty Catalog State
  if (!catalog || catalog.length === 0) {
    homeView.innerHTML = `
      <div class="home-state-container">
        <p class="empty-text">No books currently on the shelves.</p>
      </div>
    `;
    return;
  }

  // 4. Calculate Personal Dashboard State
  const readingHistory = getAllReadingProgress();
  const { currentBook, currentProgress, recommended, moreLikeCurrent, isFresh } = computeHomeRecommendations(catalog, readingHistory);

  let sectionsHtml = '';

  if (!isFresh && currentBook && currentProgress) {
    // === ACTIVE USER DASHBOARD ===

    // Section 1: Continue Reading (1 book)
    sectionsHtml += renderContinueReadingCard(currentBook, currentProgress);

    // Section 2: Picked For You (4–6 books from full-catalog recommendation algorithm)
    sectionsHtml += `
      <section class="home-section reveal-layer-4" aria-labelledby="recommended-heading">
        <div class="section-header-block">
          <div class="section-kicker">PICKED FOR YOU</div>
          <h2 id="recommended-heading" class="section-title">Stories that might be your kind of thing</h2>
        </div>
    `;

    if (recommended.length > 0) {
      sectionsHtml += `
        <div class="home-books-grid">
          ${recommended.map((book) => createBookCardMarkup(book, false)).join('')}
        </div>
      `;
    } else {
      sectionsHtml += `
        <div class="quiet-empty-rec">
          <p class="empty-note">Your shelves are still taking shape.</p>
          <p class="empty-hint">Read a little more and Nook will learn what you like.</p>
        </div>
      `;
    }
    sectionsHtml += `</section>`;

    // Section 3: More Like What You're Reading (4–6 books based on current book categories)
    sectionsHtml += `
      <section class="home-section reveal-layer-4" aria-labelledby="more-like-heading">
        <div class="section-header-block">
          <div class="section-kicker">MORE LIKE WHAT YOU'RE READING</div>
          <h2 id="more-like-heading" class="section-title">Because you're exploring ${escapeHtml(currentBook.title)}</h2>
        </div>
    `;

    if (moreLikeCurrent.length > 0) {
      sectionsHtml += `
        <div class="home-books-grid">
          ${moreLikeCurrent.map((book) => createBookCardMarkup(book, false)).join('')}
        </div>
      `;
    } else {
      sectionsHtml += `
        <div class="quiet-empty-rec">
          <p class="empty-note">Your shelves are still taking shape.</p>
          <p class="empty-hint">Read a little more and Nook will learn what you like.</p>
        </div>
      `;
    }
    sectionsHtml += `</section>`;

  } else {
    // === FRESH / NO READING HISTORY STATE ===
    const starterBooks = (recommended && recommended.length > 0)
      ? recommended
      : catalog.slice(0, 5);
    sectionsHtml += `
      <section class="home-section reveal-layer-3" aria-labelledby="start-heading">
        <div class="section-header-block">
          <div class="section-kicker">START SOMETHING NEW</div>
          <h2 id="start-heading" class="section-title">Pick a story and make yourself at home</h2>
        </div>
        <div class="home-books-grid">
          ${starterBooks.map((book) => createBookCardMarkup(book, false)).join('')}
        </div>
      </section>
    `;
  }

  // Explore Library & Curated Categories Section (Reveal Layer 5)
  const categories = getCatalogCategories();
  const collectionsMarkup = renderCollectionsGrid(categories);
  const readingIntentMarkup = renderReadingIntentSection();

  homeView.innerHTML = `
    <!-- Opening Editorial Header (Reveal Layer 2) -->
    <div class="opening-line reveal-layer-2">
      <p class="greeting-lead">${isFresh ? 'A quiet place to discover and read timeless literature in the public domain.' : 'Welcome back to your reading sanctuary.'}</p>
      <a data-nav="library" tabindex="0" role="link">Wander into the complete library →</a>
    </div>

    <!-- Main Dynamic Personal Sections -->
    ${sectionsHtml}

    <!-- Reading Intent Section (Reveal Layer 4) -->
    ${readingIntentMarkup}

    <!-- Curated Shelves & Spin (Reveal Layer 5) -->
    <div class="reveal-layer-5">
      ${collectionsMarkup}

      <!-- Spin the Nook Promotion -->
      <div class="spin-band">
        <div class="l">
          <h3>Don't know what to read next?</h3>
          <p>Spin the Nook and let serendipity choose from our verified catalog.</p>
        </div>
        <button class="btn dark-on-butter" data-nav="spin">Spin the Nook</button>
      </div>
    </div>
  `;

  // Attach Reading Intent interaction controls
  bindReadingIntentControls({ homeView, catalog, onNavigate });

  // Collect recommendation reasons map for detail navigation
  const recMap = new Map();
  if (Array.isArray(recommended)) {
    recommended.forEach((b) => {
      if (b && b.id) recMap.set(b.id, b);
    });
  }
  if (Array.isArray(moreLikeCurrent)) {
    moreLikeCurrent.forEach((b) => {
      if (b && b.id) recMap.set(b.id, b);
    });
  }

  // Attach card click handlers for book details
  const cards = homeView.querySelectorAll('.home-section:not(.reading-intent-section) .book-card');
  cards.forEach((card) => {
    const bookId = card.getAttribute('data-book-id');
    const recBook = recMap.get(bookId);
    const handleSelect = () => {
      console.log(`[NOOK] Selected book from Home: ${bookId}`);
      onNavigate('details', { 
        bookId: bookId, 
        origin: 'home',
        recommendationReason: recBook?.recommendationReason || null,
        recommendationMetadata: recBook?.recommendationMetadata || null
      });
    };

    card.addEventListener('click', handleSelect);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
    });
  });

  // Attach Continue Reading click handler
  const continueCard = homeView.querySelector('.continue-card');
  if (continueCard) {
    const bookId = continueCard.getAttribute('data-book-id');
    const chapterNumber = parseInt(continueCard.getAttribute('data-chapter'), 10) || 1;
    const pageNumberAttr = continueCard.getAttribute('data-page');
    const pageNumber = pageNumberAttr ? parseInt(pageNumberAttr, 10) : null;
    const handleContinue = (e) => {
      e.preventDefault();
      console.log(`[NOOK] Continuing reading: ${bookId}, Chapter ${chapterNumber}, Page ${pageNumber}`);
      onNavigate('reader', { bookId, chapterNumber, pageNumber });
    };

    continueCard.addEventListener('click', handleContinue);
    continueCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleContinue(e);
      }
    });
  }

  // Attach nav link handlers
  const navLinks = homeView.querySelectorAll('[data-nav]');
  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-nav');
      const filter = link.getAttribute('data-filter');
      onNavigate(target, { filterCategory: filter });
    });
  });
}

/**
 * Renders the collections row on Home (top 6 featured shelves for a clean, spacious layout).
 */
function renderCollectionsGrid(categories) {
  if (!categories || categories.length === 0) return '';

  const featuredCategories = categories.slice(0, 6);

  const cardsHtml = featuredCategories.map((cat, index) => {
    const num = String(index + 1).padStart(2, '0');
    const bookList = cat.books.map((b) => b.title).slice(0, 2).join(', ');
    return `
      <div 
        class="collection-card" 
        data-nav="library" 
        data-filter="${escapeHtml(cat.name)}"
        tabindex="0"
        role="button"
        aria-label="Collection ${cat.name} with ${cat.count} verified title${cat.count > 1 ? 's' : ''}"
      >
        <div class="num">${num}</div>
        <div class="name">${escapeHtml(cat.name)}</div>
        <div class="count">${cat.count} title${cat.count > 1 ? 's' : ''} · ${escapeHtml(bookList)}</div>
      </div>
    `;
  }).join('');

  return `
    <h2 class="section-title" style="margin-top: 56px;">Curated Shelves</h2>
    <div class="collections">
      ${cardsHtml}
    </div>
  `;
}

/**
 * Renders the "What Do You Feel Like Reading?" intent search section.
 */
function renderReadingIntentSection() {
  const suggestions = [
    'something dark & gothic',
    'a short, witty romance',
    'a grand adventure across the sea',
    'philosophical & melancholic',
    'a quick bedtime classic'
  ];

  const suggestionsHtml = suggestions.map((prompt) => `
    <button 
      type="button" 
      class="intent-suggestion-btn" 
      data-intent-prompt="${escapeHtml(prompt)}"
      tabindex="0"
      aria-label="Search reading intent: ${escapeHtml(prompt)}"
    >
      ${escapeHtml(prompt)}
    </button>
  `).join('');

  return `
    <section class="home-section reading-intent-section reveal-layer-4" aria-labelledby="reading-intent-heading">
      <div class="section-header-block">
        <div class="section-kicker">WHAT DO YOU FEEL LIKE READING?</div>
        <h2 id="reading-intent-heading" class="section-title">Describe a mood or a story you're longing for</h2>
        <p class="reading-intent-sub">Tell Nook what you're in the mood for — a feeling, a genre, a world, or even how much time you have.</p>
      </div>

      <div class="reading-intent-desk">
        <div class="reading-intent-input-wrap">
          <label for="readingIntentInput" class="visually-hidden">Describe what you feel like reading</label>
          <span class="reading-intent-prompt-icon" aria-hidden="true">✦</span>
          <input 
            type="text" 
            id="readingIntentInput" 
            class="reading-intent-input" 
            placeholder="something dark and atmospheric, but not too long…" 
            aria-label="Describe what you feel like reading"
            autocomplete="off"
            spellcheck="false"
          />
          <button 
            type="button" 
            id="readingIntentClear" 
            class="reading-intent-clear" 
            aria-label="Clear search" 
            title="Clear search"
            style="display: none;"
          >×</button>
        </div>

        <div class="reading-intent-suggestions" role="group" aria-label="Inspiration reading prompts">
          <span class="suggestions-lead">Inspiration:</span>
          <div class="suggestions-list">
            ${suggestionsHtml}
          </div>
        </div>
      </div>

      <div 
        id="readingIntentResults" 
        class="reading-intent-results-area" 
        role="region" 
        aria-label="Reading intent results" 
        aria-live="polite"
        style="display: none;"
      >
        <!-- Dynamically populated -->
      </div>
    </section>
  `;
}

/**
 * Binds events and debounced search interaction for the Reading Intent component.
 */
function bindReadingIntentControls({ homeView, catalog, onNavigate }) {
  const input = homeView.querySelector('#readingIntentInput');
  const clearBtn = homeView.querySelector('#readingIntentClear');
  const resultsContainer = homeView.querySelector('#readingIntentResults');
  const suggestionBtns = homeView.querySelectorAll('.intent-suggestion-btn');

  if (!input || !resultsContainer) return;

  let debounceTimer = null;

  const performSearch = (queryText) => {
    const clean = (queryText || '').trim();

    if (!clean) {
      if (clearBtn) clearBtn.style.display = 'none';
      resultsContainer.style.display = 'none';
      resultsContainer.innerHTML = '';
      return;
    }

    if (clearBtn) clearBtn.style.display = 'flex';

    const searchResponse = searchByReadingIntent(clean, catalog, { limit: 5 });
    const books = searchResponse.results || [];
    const lengthConstraint = searchResponse.lengthConstraint;

    resultsContainer.style.display = 'block';

    if (books.length === 0) {
      resultsContainer.innerHTML = `
        <div class="quiet-empty-rec intent-empty-state" role="status">
          <p class="empty-note">We couldn't find a book quite like that on our shelves.</p>
          <p class="empty-hint">Try a broader mood, genre, or browse the Curated Shelves.</p>
        </div>
      `;
      return;
    }

    const count = books.length;
    const metaHtml = `
      <div class="intent-results-meta">
        <span class="intent-meta-text">Found ${count} ${count === 1 ? 'story' : 'stories'} for “<strong>${escapeHtml(clean)}</strong>”</span>
        ${lengthConstraint ? `<span class="intent-length-pill">${escapeHtml(lengthConstraint)}</span>` : ''}
      </div>
    `;

    const gridHtml = `
      <div class="home-books-grid">
        ${books.map((book) => createBookCardMarkup(book, false)).join('')}
      </div>
    `;

    resultsContainer.innerHTML = `
      ${metaHtml}
      ${gridHtml}
    `;

    // Attach card click handlers for newly rendered intent cards
    const resultCards = resultsContainer.querySelectorAll('.book-card');
    resultCards.forEach((card) => {
      const bookId = card.getAttribute('data-book-id');
      const intentBook = books.find((b) => b && b.id === bookId);
      const handleSelect = () => {
        console.log(`[NOOK INTENT] Selected book: ${bookId}`);
        onNavigate('details', { 
          bookId, 
          origin: 'home',
          recommendationReason: intentBook?.recommendationReason || null,
          recommendationMetadata: intentBook?.recommendationMetadata || null
        });
      };

      card.addEventListener('click', handleSelect);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      });
    });
  };

  input.addEventListener('input', (e) => {
    const val = e.target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(val);
    }, 180);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      performSearch('');
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      input.focus();
      performSearch('');
    });
  }

  suggestionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const promptText = btn.getAttribute('data-intent-prompt');
      if (promptText) {
        input.value = promptText;
        performSearch(promptText);
        input.focus();
      }
    });
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
