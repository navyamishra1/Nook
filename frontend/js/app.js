/**
 * Nook Main Application Controller
 * Manages runtime catalog loading, view routing, dark/light theme switching, and interaction.
 */

import { fetchCatalog, getBookCoverUrl } from './catalog.js';
import { renderHomeView } from './home.js';
import { LibraryController } from './library.js';
import { EntryController } from './entry.js';
import { renderBookDetailsView } from './details.js';
import { ReaderController } from './reader.js';
import { renderJournalView } from './journal.js';
import * as journal from './journal.js';

class NookApp {
  constructor() {
    this.catalog = [];
    this.isLoading = true;
    this.error = null;
    this.currentView = 'home';
    this.previousView = 'home';
    this.selectedBookId = null;
    this.theme = localStorage.getItem('nook_theme') || 'light';
    this.spinWinnerBookId = null;
    this.journal = journal;
    
    this.library = new LibraryController({
      getCatalog: () => this.catalog,
      onSelectBook: (bookId) => this.handleBookSelected(bookId)
    });

    this.reader = new ReaderController({
      containerId: 'view-reader',
      onNavigateBack: (bookId) => {
        this.navigateTo('details', { bookId });
      }
    });

    this.init();
  }

  async init() {
    this.initTheme();
    this.initNavigation();
    this.initEntry();
    
    // Render initial loading state on Home
    this.renderHome();

    // Fetch verified Phase 2 catalog at runtime
    await this.loadCatalog();
  }

  /* --------------------------------------------------------------------------
     Catalog Loading & Error Handling
     -------------------------------------------------------------------------- */
  async loadCatalog() {
    this.isLoading = true;
    this.error = null;
    this.renderHome();

    try {
      this.catalog = await fetchCatalog();
      this.isLoading = false;
      this.renderHome();
      this.library.init();
      this.initSpinWheel();
    } catch (err) {
      console.error('[NOOK] Catalog loading failed:', err);
      this.isLoading = false;
      this.error = err;
      this.renderHome();
    }
  }

  /* --------------------------------------------------------------------------
     Theme Management
     -------------------------------------------------------------------------- */
  initTheme() {
    document.body.setAttribute('data-theme', this.theme);
    this.updateThemeButtonText();

    const themeToggleBtn = document.getElementById('themeBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', this.theme);
    localStorage.setItem('nook_theme', this.theme);
    this.updateThemeButtonText();
  }

  updateThemeButtonText() {
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.textContent = this.theme === 'dark' ? 'Light' : 'Dark';
      btn.setAttribute('aria-label', `Switch to ${this.theme === 'dark' ? 'light' : 'dark'} theme`);
    }
  }

  /* --------------------------------------------------------------------------
     Navigation & Routing
     -------------------------------------------------------------------------- */
  initNavigation() {
    const navLinks = document.querySelectorAll('header.masthead [data-nav]');
    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-nav');
        this.navigateTo(targetView);
      });
    });

    const wordmark = document.querySelector('.wordmark');
    if (wordmark) {
      wordmark.addEventListener('click', () => this.navigateTo('home'));
    }
  }

  navigateBack() {
    this.navigateTo(this.browseOrigin || 'library');
  }

  navigateTo(viewName, params = {}) {
    // If leaving reader, detach any active listeners
    if (this.currentView === 'reader' && viewName !== 'reader') {
      this.reader.destroy();
    }

    if (this.currentView === 'home' || this.currentView === 'library' || this.currentView === 'journal') {
      this.browseOrigin = params.origin || this.currentView;
    }

    if (this.currentView !== viewName) {
      this.previousView = this.currentView;
    }

    if (viewName === 'reader') {
      document.body.classList.add('in-reader-mode');
      const curTheme = localStorage.getItem('nook_reader_theme') || 'warm';
      document.body.setAttribute('data-reader-active-theme', curTheme);
    } else {
      document.body.classList.remove('in-reader-mode');
      document.body.removeAttribute('data-reader-active-theme');
    }

    const views = document.querySelectorAll('.view');
    const navLinks = document.querySelectorAll('nav.mainnav a');

    views.forEach((v) => {
      const isTarget = v.id === `view-${viewName}`;
      v.classList.toggle('active', isTarget);
    });

    navLinks.forEach((link) => {
      const isTarget = link.getAttribute('data-nav') === viewName;
      link.classList.toggle('active', isTarget);
      link.setAttribute('aria-current', isTarget ? 'page' : 'false');
    });

    this.currentView = viewName;
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Handle view-specific initializations
    if (viewName === 'home') {
      this.renderHome(); // Re-render to refresh continue reading progress bar
    } else if (viewName === 'journal') {
      this.renderJournal(params);
    } else if (viewName === 'library') {
      if (params.filterCategory) {
        this.library.setCategory(params.filterCategory);
      }
      if (params.searchQuery) {
        this.library.setSearch(params.searchQuery);
      }
    } else if (viewName === 'details') {
      if (params.bookId) {
        this.selectedBookId = params.bookId;
      }
      this.renderBookDetails(this.selectedBookId, params);
    } else if (viewName === 'reader') {
      if (params.bookId) {
        this.selectedBookId = params.bookId;
      }
      this.reader.openBook(this.selectedBookId, params.chapterNumber, params.pageNumber);
    }
  }

  renderJournal(params = {}) {
    renderJournalView({
      containerId: 'view-journal',
      activeSection: params.tab || params.activeSection || 'commonplace',
      catalog: this.catalog,
      onNavigate: (target, p) => this.navigateTo(target, p),
      onOpenPassage: ({ bookId, chapterNumber, pageNumber }) => {
        this.selectedBookId = bookId;
        this.navigateTo('reader', { bookId, chapterNumber, pageNumber });
      }
    });
  }

  /* --------------------------------------------------------------------------
     Book Selection & Details
     -------------------------------------------------------------------------- */
  handleBookSelected(bookId) {
    this.selectedBookId = bookId;
    console.log(`[NOOK] Active book selected: ${bookId}`);
    this.navigateTo('details', { bookId, origin: 'library' });
  }

  renderBookDetails(bookId, params = {}) {
    renderBookDetailsView({
      bookId,
      containerId: 'view-details',
      origin: params.origin || this.browseOrigin || 'library',
      recommendationReason: params.recommendationReason || null,
      recommendationMetadata: params.recommendationMetadata || null,
      onReadNow: (targetBookId, chapterNumber, pageNumber) => {
        this.navigateTo('reader', { bookId: targetBookId, chapterNumber, pageNumber });
      },
      onBack: () => this.navigateBack()
    });
  }

  /* --------------------------------------------------------------------------
     Home View Rendering (Data-Driven from Verified Catalog)
     -------------------------------------------------------------------------- */
  renderHome() {
    renderHomeView({
      catalog: this.catalog,
      isLoading: this.isLoading,
      error: this.error,
      onRetry: () => this.loadCatalog(),
      onNavigate: (view, params) => this.navigateTo(view, params)
    });
  }

  /* --------------------------------------------------------------------------
     Spin Wheel (Dynamic from Verified Catalog)
     -------------------------------------------------------------------------- */
  initSpinWheel() {
    const wheelEl = document.getElementById('wheel');
    const spinBtn = document.getElementById('spinBtn');
    const resultCard = document.getElementById('resultCard');
    const spinAgain = document.getElementById('spinAgain');
    const spinDetailsBtn = document.getElementById('spinDetailsBtn');
    if (!wheelEl || !spinBtn || this.catalog.length === 0) return;

    // Curated Nook Literary Wheel Palette (soft, low-saturation paper tones)
    const NOOK_WHEEL_PALETTE = [
      '#F4EFE6', // Warm cream
      '#D3DDE4', // Dusty blue
      '#D6E0CC', // Muted sage
      '#F9F1D8', // Pale butter yellow
      '#EAE3D2', // Soft beige
      '#EEDFD8', // Subtle dusty blush
      '#E3DFE8', // Muted lavender
      '#DFCFC2', // Warm terracotta/brown
    ];

    // Use up to 16 curated slices for optimal visual layout and label readability
    const featuredPool = this.catalog.length <= 16 ? this.catalog : this.catalog.slice(0, 16);
    const n = featuredPool.length;
    const angle = 360 / n;
    const grad = featuredPool
      .map((b, i) => `${NOOK_WHEEL_PALETTE[i % NOOK_WHEEL_PALETTE.length]} ${i * angle}deg ${(i + 1) * angle}deg`)
      .join(', ');
    
    wheelEl.style.background = `conic-gradient(${grad})`;
    wheelEl.innerHTML = '';

    featuredPool.forEach((book, i) => {
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.style.position = 'absolute';
      seg.style.top = '0';
      seg.style.left = 'calc(50% - 36px)';
      seg.style.width = '72px';
      seg.style.height = '50%';
      seg.style.transformOrigin = '50% 100%';
      seg.style.transform = `rotate(${i * angle + angle / 2}deg)`;
      seg.style.pointerEvents = 'none';
      
      const span = document.createElement('span');
      // Clean truncation to keep text elegant and uncrowded
      const shortTitle = book.title.length > 16 ? book.title.slice(0, 14) + '…' : book.title;
      span.textContent = shortTitle;
      span.style.position = 'absolute';
      span.style.top = '12px';
      span.style.left = 'calc(50% - 7px)';
      span.style.width = '80px';
      span.style.height = '14px';
      span.style.lineHeight = '14px';
      span.style.fontFamily = 'var(--serif-head)';
      span.style.fontSize = '10px';
      span.style.fontWeight = '500';
      span.style.letterSpacing = '0.015em';
      span.style.color = '#38322B'; // Deep warm charcoal ink
      span.style.textAlign = 'left';
      span.style.transformOrigin = '7px 7px';
      span.style.transform = 'rotate(90deg)';
      span.style.whiteSpace = 'nowrap';
      span.style.overflow = 'hidden';
      span.style.textOverflow = 'ellipsis';
      
      seg.appendChild(span);
      wheelEl.appendChild(seg);
    });

    let currentRotation = 0;
    let excludeIdx = -1;

    const doSpin = () => {
      resultCard.classList.remove('show');
      let pool = featuredPool.map((_, i) => i).filter((i) => i !== excludeIdx);
      const winnerIdx = pool[Math.floor(Math.random() * pool.length)];
      const targetCenter = winnerIdx * angle + angle / 2;
      const extraSpins = 5 * 360;
      const newRotation = currentRotation - (currentRotation % 360) + extraSpins - targetCenter + 720;
      currentRotation = newRotation;
      wheelEl.style.transform = `rotate(${currentRotation}deg)`;

      setTimeout(() => {
        const winner = featuredPool[winnerIdx];
        this.spinWinnerBookId = winner.id;
        const winnerPalette = winner.palette || { bg: '#8FA07E' };
        const resultCoverEl = document.getElementById('resultCover');
        if (resultCoverEl) {
          resultCoverEl.style.backgroundColor = winnerPalette.bg;
          let img = resultCoverEl.querySelector('img');
          if (!img) {
            img = document.createElement('img');
            img.className = 'cover-svg-img';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = 'inherit';
            resultCoverEl.appendChild(img);
          }
          img.src = getBookCoverUrl(winner);
          img.alt = winner.title;
        }
        const coverText = document.getElementById('resultCoverText');
        if (coverText) coverText.style.display = 'none';
        document.getElementById('resultTitle').textContent = winner.title;
        document.getElementById('resultAuthor').textContent = winner.author;
        resultCard.classList.add('show');
        excludeIdx = winnerIdx;
      }, 2850);
    };

    spinBtn.addEventListener('click', doSpin);
    if (spinAgain) spinAgain.addEventListener('click', doSpin);

    if (spinDetailsBtn) {
      spinDetailsBtn.addEventListener('click', () => {
        if (this.spinWinnerBookId) {
          this.navigateTo('details', { bookId: this.spinWinnerBookId });
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     Entry Experience Setup
     -------------------------------------------------------------------------- */
  initEntry() {
    this.entry = new EntryController({
      onEntered: () => {
        // Callback when user enters Nook
      }
    });

    const replayBtn = document.getElementById('replayEntryBtn');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        this.entry.replay();
      });
    }
  }
}

// Instantiate application on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.nookApp = new NookApp();
  });
} else {
  window.nookApp = new NookApp();
}
