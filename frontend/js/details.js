/**
 * Nook Book Details View Controller & Renderer
 * Renders a rich editorial details view for any selected book from the verified catalog.
 * 
 * STRICT RULES:
 * - Selected book ID is the sole source of truth.
 * - Zero hardcoding of titles or authors.
 * - Sourced strictly from verified catalog and content metadata.
 */

import { getBookById, getReadingProgressForBook, getBookCoverUrl } from './catalog.js';

export function renderBookDetailsView({
  bookId,
  containerId = 'view-details',
  origin = 'library',
  recommendationReason = null,
  recommendationMetadata = null,
  onReadNow = () => {},
  onBack = () => {}
}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const book = getBookById(bookId);

  // If book is not found in verified catalog
  if (!book) {
    container.innerHTML = `
      <div class="details-state-container" role="alert">
        <h2 class="error-title">Book Not Found</h2>
        <p class="error-text">We couldn't find the requested title in the verified catalog.</p>
        <button class="btn secondary" id="detailsBackNotFoundBtn">← Return</button>
      </div>
    `;
    const backBtn = container.querySelector('#detailsBackNotFoundBtn');
    if (backBtn) backBtn.addEventListener('click', onBack);
    return;
  }

  const palette = book.palette || { bg: '#8FA07E', text: '#FFFFFF', foil: '#FDFBF7' };
  const readingHours = Math.max(1, Math.round(book.estimated_reading_time / 60));
  const primaryCategory = book.categories && book.categories[0] ? book.categories[0] : 'Classic';
  const progress = getReadingProgressForBook(book.id);

  // Format word count with commas
  const formattedWordCount = book.word_count ? Number(book.word_count).toLocaleString() : null;

  // Source display name
  const sourceName = book.source === 'standard-ebooks' 
    ? 'Standard Ebooks' 
    : (book.source === 'gutenberg' || book.source === 'project-gutenberg')
      ? 'Project Gutenberg' 
      : (book.source || 'Public Domain Archive');

  const originLabel = origin === 'home' ? 'Home' : 'Library';

  const isDiscovery = book.reading_availability === 'discovery-only';
  const formattedYear = book.publication_year < 0 ? `${Math.abs(book.publication_year)} BCE` : book.publication_year;

  container.innerHTML = `
    <!-- Top Back Navigation -->
    <div class="details-top-bar">
      <button class="details-back-btn" id="detailsBackBtn" aria-label="Return to ${originLabel}">
        <span class="back-arrow" aria-hidden="true">←</span>
        <span>Back to ${originLabel}</span>
      </button>
      <div class="details-breadcrumbs">
        <span class="crumb">${originLabel}</span>
        <span class="crumb-sep">/</span>
        <span class="crumb current">${escapeHtml(book.title)}</span>
      </div>
    </div>

    <!-- Editorial Hero: Split Layout -->
    <div class="details-hero">
      
      <!-- Left Column: Large Editorial Cover -->
      <div class="details-cover-column">
        <div 
          class="details-cover" 
          style="background-color: ${palette.bg};"
          aria-label="Book cover for ${escapeHtml(book.title)}"
        >
          <img 
            class="details-cover-svg-img" 
            src="${getBookCoverUrl(book)}" 
            alt="Book cover for ${escapeHtml(book.title)}" 
            onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';" 
          />
          <div class="details-cover-fallback" style="display: none; width: 100%; height: 100%;">
            <div class="cover-spine-crease" aria-hidden="true"></div>
            <div class="cover-foil-frame">
              <div class="details-cover-tag">${escapeHtml(primaryCategory)}</div>
              
              <div class="details-cover-body">
                <h2 class="details-cover-title">${escapeHtml(book.title)}</h2>
                <div class="details-cover-rule"></div>
                <p class="details-cover-author">${escapeHtml(book.author)}</p>
              </div>

              <div class="details-cover-footer">
                <span class="details-cover-year">${formattedYear}</span>
                <span class="details-cover-edition">${isDiscovery ? 'Discovery Record' : 'Nook Edition'}</span>
              </div>
            </div>
            <div class="cover-sheen-overlay" aria-hidden="true"></div>
          </div>
        </div>
      </div>

      <!-- Right Column: Metadata, CTA & Summary -->
      <div class="details-meta-column">
        
        <div class="details-header-group">
          <div class="details-category-pill">${escapeHtml(isDiscovery ? 'Curated Modern Discovery' : primaryCategory)}</div>
          <h1 class="details-title">${escapeHtml(book.title)}</h1>
          <p class="details-author">by <span>${escapeHtml(book.author)}</span></p>
        </div>

        <!-- Metadata Badges -->
        <div class="details-pills-row" aria-label="Book specifications">
          <span class="pill" title="First publication year">
            <span class="pill-label">Published</span>
            <span class="pill-value">${formattedYear}</span>
          </span>
          <span class="pill" title="Estimated reading time">
            <span class="pill-label">Est. Time</span>
            <span class="pill-value">~${readingHours} hr (${book.estimated_reading_time} min)</span>
          </span>
          ${formattedWordCount ? `
            <span class="pill" title="Verified word count">
              <span class="pill-label">Length</span>
              <span class="pill-value">${formattedWordCount} words</span>
            </span>
          ` : ''}
          <span class="pill" title="Language">
            <span class="pill-label">Language</span>
            <span class="pill-value">${(book.language || 'en').toUpperCase()}</span>
          </span>
        </div>

        <!-- All Categories Tags -->
        <div class="details-genres-row" aria-label="Categories">
          ${(book.categories || []).map((cat) => `<span class="genre-tag">${escapeHtml(cat)}</span>`).join('')}
        </div>

        ${recommendationReason ? `
          <!-- Curator's Reading Note -->
          <div class="curator-note" role="note" aria-label="Curator's Reading Note">
            <div class="curator-note-kicker">Curator's Reading Note</div>
            <p class="curator-note-body">${escapeHtml(recommendationReason)}</p>
          </div>
        ` : ''}

        <!-- Primary Call to Action -->
        <div class="details-action-group">
          ${isDiscovery ? `
            <a href="${escapeHtml(book.source_url || 'https://openlibrary.org')}" target="_blank" rel="noopener noreferrer" class="btn read-now-btn" id="detailsDiscoveryBtn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
              <span>Find at Library / Bookseller ↗</span>
            </a>
          ` : progress ? `
            <button class="btn read-now-btn" id="detailsReadNowBtn" data-book-id="${book.id}">
              <span>Continue reading (${progress.progressPercent}%)</span>
              <span class="btn-arrow" aria-hidden="true">→</span>
            </button>
            <button class="btn secondary start-over-btn" id="detailsStartOverBtn" data-book-id="${book.id}">
              Start from beginning
            </button>
          ` : `
            <button class="btn read-now-btn" id="detailsReadNowBtn" data-book-id="${book.id}">
              <span>Read now</span>
              <span class="btn-arrow" aria-hidden="true">→</span>
            </button>
          `}
        </div>

        <!-- Description Paragraph -->
        <div class="details-description">
          <h3 class="details-section-label">Overview</h3>
          <p class="description-text">${escapeHtml(book.description || 'No description available for this edition.')}</p>
        </div>

      </div>
    </div>

    <div class="details-divider" aria-hidden="true"></div>

    <!-- Secondary Section: About This Edition -->
    <div class="details-section details-edition-section">
      <div class="section-badge">Provenance &amp; Integrity</div>
      <h2 class="section-heading">About this Edition</h2>
      
      <div class="edition-grid">
        <div class="edition-card">
          <div class="edition-card-label">Source Archive</div>
          <div class="edition-card-value">${escapeHtml(sourceName)}</div>
          ${book.source_url ? `
            <a href="${escapeHtml(book.source_url)}" target="_blank" rel="noopener noreferrer" class="edition-link">
              View original catalog record ↗
            </a>
          ` : ''}
        </div>

        <div class="edition-card">
          <div class="edition-card-label">Source Identifier</div>
          <div class="edition-card-value code-font">${escapeHtml(book.source_identifier || book.id)}</div>
          <div class="edition-card-sub">${isDiscovery ? 'Curated contemporary discovery record' : 'Verified public domain text corpus'}</div>
        </div>

        <div class="edition-card span-full">
          <div class="edition-card-label">License &amp; Rights</div>
          <div class="edition-card-value">${escapeHtml(book.license_or_rights || 'Public Domain')}</div>
          <p class="edition-card-sub">${isDiscovery ? 'This work is protected by copyright. Indexed for bibliographic discovery and reading recommendations; full text is available via authorized publishers and libraries.' : 'This work is in the public domain and is completely free to read, share, and study without restrictions.'}</p>
        </div>
      </div>
    </div>

    <div class="details-divider" aria-hidden="true"></div>

    <!-- Tertiary Section: Content & Chapters -->
    <div class="details-section details-content-section">
      <div class="section-badge">${isDiscovery ? 'Availability' : 'Verified Text'}</div>
      <h2 class="section-heading">${isDiscovery ? 'Reading Availability' : 'Content'}</h2>
      
      <div class="content-summary-card">
        <div class="content-summary-info">
          <div class="content-status-icon">${isDiscovery ? '📚' : '✓'}</div>
          <div>
            <h3 class="content-summary-title">${isDiscovery ? 'Curated Modern Title' : 'Full Text Ingested'}</h3>
            <p class="content-summary-sub">${isDiscovery ? 'To read this modern bestseller, borrow from your local library (e.g., via Libby or Hoopla) or purchase through your preferred bookseller.' : 'Formatted for serene, distraction-free reading with adjustable typography.'}</p>
          </div>
        </div>
        ${isDiscovery ? (book.source_url ? `
          <a href="${escapeHtml(book.source_url)}" target="_blank" rel="noopener noreferrer" class="btn secondary">
            Open Library Catalog ↗
          </a>
        ` : '') : `
          <button class="btn secondary" id="detailsJumpReadingBtn" data-book-id="${book.id}">
            Open in Reading Room →
          </button>
        `}
      </div>
    </div>
  `;

  // Attach Event Listeners
  const backBtn = container.querySelector('#detailsBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => onBack());
  }

  const readNowBtn = container.querySelector('#detailsReadNowBtn');
  if (readNowBtn) {
    readNowBtn.addEventListener('click', () => {
      onReadNow(book.id, progress ? progress.chapterNumber : 1, progress ? progress.pageNumber : null);
    });
  }

  const startOverBtn = container.querySelector('#detailsStartOverBtn');
  if (startOverBtn) {
    startOverBtn.addEventListener('click', () => {
      onReadNow(book.id, 1, 1);
    });
  }

  const jumpReadingBtn = container.querySelector('#detailsJumpReadingBtn');
  if (jumpReadingBtn) {
    jumpReadingBtn.addEventListener('click', () => {
      onReadNow(book.id, progress ? progress.chapterNumber : 1, progress ? progress.pageNumber : null);
    });
  }
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
