/**
 * Nook Reader View Controller & Renderer
 * Provides a serene, distraction-free reading experience for verified public-domain literature.
 * 
 * Features:
 * - Real full text loaded dynamically via fetchBookContent(bookId).
 * - Deterministic digital pagination engine (sm/md/lg font-density mapping).
 * - Digital page indicator: "Page X of Y" printed book furniture.
 * - Literary typography controls (A-, A, A+ text size & Warm, Light, Dark reading themes).
 * - Dynamic 1-2px hairline reading progress bar at top of viewport.
 * - Physical book-leaf 3D page flip transition between digital pages.
 * - Elegant chapter jump selector and on-page corner navigation arrows.
 * - Permanent Physical Stationery attached to the book page edge:
 *     * Physical Highlighter peeking from the right page edge (click to toggle highlighting mode).
 *     * Physical Note paper tab peeking from the right page edge (supports Page Notes & Passage Notes).
 *     * Physical Bookmark Ribbon with multi-style picker (Crimson Silk, Sage Linen, Deckled Ivory, Midnight Gold).
 * - Graceful error states (missing book / unavailable content).
 */

import { getBookById, fetchBookContent, saveReadingProgress, getReadingProgressForBook } from './catalog.js';
import { paginateBook, getReaderPageDimensions } from './pagination.js';
import { findSimilarChapters } from './chapter-similarity.js';
import { showTableOfContentsModal, buildTableOfContentsData } from './table-of-contents.js';
import {
  isPageBookmarked,
  getPageBookmark,
  getBookBookmark,
  addBookmark,
  removeBookmark,
  toggleBookmark,
  getHighlights,
  addHighlight,
  removeHighlight,
  showNoteModal,
  showBookmarkPickerModal,
  BOOKMARK_STYLES
} from './journal.js';

export class ReaderController {
  constructor({ containerId = 'view-reader', onNavigateBack = () => {} }) {
    this.containerId = containerId;
    this.onNavigateBack = onNavigateBack;
    
    this.activeBookId = null;
    this.bookMeta = null;
    this.contentData = null;
    this.pagination = null;
    this.currentPageNumber = 1; // 1-indexed digital page number across whole book
    this.currentChapterIndex = 0;
    this.fontSize = localStorage.getItem('nook_reader_fontsize') || 'md'; // 'sm' | 'md' | 'lg'
    this.readerTheme = localStorage.getItem('nook_reader_theme') || 'warm'; // 'warm' | 'light' | 'dark'
    this.isLoading = false;
    this.error = null;
    this.isHighlightingActive = false;
    
    this.handleKeydown = this.onKeydown.bind(this);
    this.handleFullscreenChange = this.onFullscreenChange.bind(this);
    this.handleSelection = this.onTextSelectionChange.bind(this);
    this.handleResize = this.onWindowResize.bind(this);
    this._resizeTimer = null;
    this._lastMeasuredDims = null;
    this.isTransitioning = false;
    this.isFocusedMode = false;
  }

  get container() {
    return document.getElementById(this.containerId);
  }

  /**
   * Opens the reader for a specific book ID and chapter or page.
   */
  async openBook(bookId, targetChapterNumber = null, targetPageNumber = null) {
    if (!bookId) return;

    this.activeBookId = bookId;
    this.bookMeta = getBookById(bookId);

    // Validate that book exists in catalog
    if (!this.bookMeta) {
      this.error = new Error("That book isn't in Nook.");
      this.render();
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.render();

    try {
      this.contentData = await fetchBookContent(bookId);
      this.isLoading = false;

      // Ensure web fonts (Literata / Fraunces) are fully loaded before computing DOM pagination
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (fontErr) {
          console.warn('[NOOK READER] Font loading check warning:', fontErr);
        }
      }

      // Compute deterministic digital pagination for current viewport and mode
      this._lastMeasuredDims = getReaderPageDimensions(this.isFocusedMode);
      this.pagination = paginateBook(this.contentData, this.fontSize, {
        isFocusedMode: this.isFocusedMode,
        dimensions: this._lastMeasuredDims
      });

      // Determine starting digital page number
      const savedProgress = getReadingProgressForBook(this.activeBookId);
      const bookBookmark = getBookBookmark(this.activeBookId);

      if (targetPageNumber !== null && targetPageNumber !== undefined && typeof targetPageNumber === 'number' && targetPageNumber >= 1 && targetPageNumber <= this.pagination.totalPages) {
        // 1. Explicit targetPageNumber passed by navigation
        this.currentPageNumber = targetPageNumber;
      } else if (savedProgress && typeof savedProgress.pageNumber === 'number' && savedProgress.pageNumber >= 1 && savedProgress.pageNumber <= this.pagination.totalPages) {
        // 2. Saved reading progress pageNumber
        this.currentPageNumber = savedProgress.pageNumber;
      } else if (bookBookmark && typeof bookBookmark.pageNumber === 'number' && bookBookmark.pageNumber >= 1 && bookBookmark.pageNumber <= this.pagination.totalPages) {
        // 3. Active bookmark pageNumber
        this.currentPageNumber = bookBookmark.pageNumber;
      } else if (targetChapterNumber !== null && targetChapterNumber !== undefined) {
        // 4. Explicit targetChapterNumber
        this.currentPageNumber = this.pagination.getFirstPageOfChapter(targetChapterNumber);
      } else if (savedProgress && typeof savedProgress.progressPercent === 'number' && savedProgress.progressPercent > 0) {
        // 5. Progress percentage fallback
        this.currentPageNumber = this.pagination.getPageNumberForProgress(savedProgress.progressPercent);
      } else if (savedProgress && savedProgress.chapterNumber) {
        // Saved chapter fallback
        this.currentPageNumber = this.pagination.getFirstPageOfChapter(savedProgress.chapterNumber);
      } else {
        // 6. First valid page
        this.currentPageNumber = 1;
      }

      // Derive current chapter index from page
      const curPage = this.pagination.getPage(this.currentPageNumber);
      this.currentChapterIndex = curPage ? curPage.chapterIndex : 0;

      this.render();
      this.applyTheme(this.readerTheme);
      this.attachKeyboardListener();
      this.attachFullscreenListeners();
      this.attachSelectionListeners();
      
      window.removeEventListener('resize', this.handleResize);
      window.addEventListener('resize', this.handleResize);

      this.saveProgress();
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (err) {
      console.error('[NOOK READER] Failed to load book content:', err);
      this.isLoading = false;
      this.error = err;
      this.render();
    }
  }

  /**
   * Responds to viewport dimension changes with debounced recalibration.
   */
  onWindowResize() {
    if (!this.contentData || !this.pagination || !this.container) return;
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      const newDims = getReaderPageDimensions(this.isFocusedMode);
      if (this._lastMeasuredDims && 
          Math.abs(this._lastMeasuredDims.width - newDims.width) < 6 && 
          Math.abs(this._lastMeasuredDims.height - newDims.height) < 6) {
        return;
      }
      this._lastMeasuredDims = newDims;
      const curPage = this.pagination.getPage(this.currentPageNumber);
      const curWordOffset = curPage ? curPage.startWordIndex : 0;

      this.pagination = paginateBook(this.contentData, this.fontSize, {
        forceRepaginate: true,
        isFocusedMode: this.isFocusedMode,
        dimensions: newDims
      });

      const newPage = this.pagination.getPageForWordOffset(curWordOffset);
      this.currentPageNumber = newPage ? newPage.pageNumber : 1;
      this.currentChapterIndex = newPage ? newPage.chapterIndex : 0;
      this.render();
      this.applyTheme(this.readerTheme);
      this.saveProgress();
    }, 120);
  }

  /**
   * Sets reading font size ('sm' | 'md' | 'lg') and deterministically recalibrates pagination.
   */
  setFontSize(size) {
    if (!['sm', 'md', 'lg'].includes(size)) return;
    if (this.fontSize === size) return;

    // Find current word offset before re-paginating
    const curPage = this.pagination ? this.pagination.getPage(this.currentPageNumber) : null;
    const curWordOffset = curPage ? curPage.startWordIndex : 0;

    this.fontSize = size;
    localStorage.setItem('nook_reader_fontsize', size);

    if (this.contentData) {
      this.pagination = paginateBook(this.contentData, this.fontSize, {
        forceRepaginate: true,
        isFocusedMode: this.isFocusedMode,
        dimensions: getReaderPageDimensions(this.isFocusedMode)
      });
      const newPage = this.pagination.getPageForWordOffset(curWordOffset);
      this.currentPageNumber = newPage ? newPage.pageNumber : 1;
      this.currentChapterIndex = newPage ? newPage.chapterIndex : 0;
      this.render();
      this.applyTheme(this.readerTheme);
      this.saveProgress();
    }
  }

  /**
   * Sets reading color theme ('warm' | 'light' | 'dark' | 'eye-comfort').
   */
  setTheme(theme) {
    if (!['warm', 'light', 'dark', 'eye-comfort'].includes(theme)) return;
    this.readerTheme = theme;
    localStorage.setItem('nook_reader_theme', theme);
    this.applyTheme(theme);
  }

  applyTheme(theme) {
    if (this.container) {
      this.container.setAttribute('data-reader-theme', theme);
    }
    document.body.setAttribute('data-reader-active-theme', theme);
    const themeBtns = this.container?.querySelectorAll('.theme-btn');
    themeBtns?.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-val') === theme);
    });
  }

  /**
   * Fullscreen API event listener to synchronize UI state with native browser fullscreen.
   */
  onFullscreenChange() {
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    if (this.isFocusedMode !== isFullscreen) {
      this.isFocusedMode = isFullscreen;
      document.body.classList.toggle('in-focused-reading-mode', this.isFocusedMode);
      this.repaginateForCurrentMode();
    }
  }

  attachFullscreenListeners() {
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('MSFullscreenChange', this.handleFullscreenChange);

    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', this.handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', this.handleFullscreenChange);
  }

  detachFullscreenListeners() {
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('MSFullscreenChange', this.handleFullscreenChange);
  }

  /**
   * Toggles distraction-free True Immersive Fullscreen Reading Mode.
   */
  async toggleFocusedMode(forceState = null) {
    const shouldEnter = typeof forceState === 'boolean' ? forceState : !this.isFocusedMode;
    this.isFocusedMode = shouldEnter;
    document.body.classList.toggle('in-focused-reading-mode', this.isFocusedMode);

    if (shouldEnter) {
      try {
        const rootEl = document.documentElement;
        if (rootEl.requestFullscreen) {
          await rootEl.requestFullscreen();
        } else if (rootEl.webkitRequestFullscreen) {
          await rootEl.webkitRequestFullscreen();
        } else if (rootEl.mozRequestFullScreen) {
          await rootEl.mozRequestFullScreen();
        } else if (rootEl.msRequestFullscreen) {
          await rootEl.msRequestFullscreen();
        }
      } catch (err) {
        console.warn('[NOOK READER] Fullscreen API request fallback:', err);
      }
    } else {
      const isFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      if (isFs) {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            await document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            await document.msExitFullscreen();
          }
        } catch (err) {
          console.warn('[NOOK READER] Exit fullscreen error:', err);
        }
      }
    }

    this.repaginateForCurrentMode();
  }

  /**
   * Re-paginates content for current mode geometry and preserves exact word position.
   */
  repaginateForCurrentMode() {
    if (!this.contentData) return;
    const curPage = this.pagination ? this.pagination.getPage(this.currentPageNumber) : null;
    const curWordOffset = curPage ? curPage.startWordIndex : 0;
    const newDims = getReaderPageDimensions(this.isFocusedMode);
    this._lastMeasuredDims = newDims;

    this.pagination = paginateBook(this.contentData, this.fontSize, {
      forceRepaginate: true,
      isFocusedMode: this.isFocusedMode,
      dimensions: newDims
    });

    const newPage = this.pagination.getPageForWordOffset(curWordOffset);
    this.currentPageNumber = newPage ? newPage.pageNumber : 1;
    this.currentChapterIndex = newPage ? newPage.chapterIndex : 0;
    this.render();
    this.applyTheme(this.readerTheme);
    this.saveProgress();

    const focusBtn = this.container?.querySelector('#readerFocusBtn');
    if (focusBtn) {
      focusBtn.classList.toggle('active', this.isFocusedMode);
      focusBtn.setAttribute('aria-pressed', this.isFocusedMode ? 'true' : 'false');
    }
  }

  /**
   * Navigates to a specific digital page number with serene 3D paper page-flip transition.
   */
  goToPage(pageNumber) {
    if (!this.pagination || !this.contentData) return;
    const targetPage = Math.max(1, Math.min(this.pagination.totalPages, pageNumber));
    if (targetPage === this.currentPageNumber) return;
    if (this.isTransitioning) return; // Guard against rapid duplicate clicks

    const direction = targetPage > this.currentPageNumber ? 'next' : 'prev';
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      this.currentPageNumber = targetPage;
      const curPage = this.pagination.getPage(this.currentPageNumber);
      this.currentChapterIndex = curPage ? curPage.chapterIndex : 0;
      this.render();
      this.applyTheme(this.readerTheme);
      window.scrollTo({ top: 0, behavior: 'instant' });
      this.saveProgress();
      return;
    }

    this.isTransitioning = true;
    this.animatePageFlip(targetPage, direction);
  }

  /**
   * Navigates to the first digital page of a specific chapter index.
   */
  goToChapter(chapterIndex) {
    if (!this.contentData || !this.contentData.chapters || !this.pagination) return;
    const targetIdx = Math.max(0, Math.min(this.contentData.chapters.length - 1, chapterIndex));
    const targetPage = this.pagination.getPageForChapter(targetIdx, 1);
    if (targetPage) {
      this.goToPage(targetPage.pageNumber);
    }
  }

  /**
   * Performs the physical book-leaf paper page-turn animation between digital pages.
   */
  animatePageFlip(targetPageNumber, direction) {
    const curPage = this.pagination.getPage(this.currentPageNumber);
    const title = this.bookMeta?.title || this.contentData.title || '';
    const author = this.bookMeta?.author || this.contentData.author || '';

    // Create temporary transition overlay
    const overlay = document.createElement('div');
    overlay.className = 'reader-page-flip-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    // Build realistic leaf preview of current digital page
    const previewParagraphs = (curPage?.paragraphUnits || (curPage?.paragraphs || []).map(p => ({ text: p, isContinuation: false })))
      .slice(0, 6)
      .map((u, idx) => {
        const isFirst = idx === 0 && curPage?.isFirstPageOfChapter && !u.isContinuation;
        const dropCapClass = isFirst ? 'has-drop-cap' : '';
        const contClass = u.isContinuation ? 'is-para-continuation' : '';
        return `<p class="${dropCapClass} ${contClass}">${escapeHtml(u.text || u)}</p>`;
      })
      .join('');

    const chapterHeaderHtml = curPage?.isFirstPageOfChapter
      ? `
        <header class="reader-prose-header">
          <div class="reader-ornament" aria-hidden="true">❦</div>
          <h1 class="reader-prose-chapter-title">${escapeHtml(curPage.chapterTitle)}</h1>
          <div class="reader-prose-book-title">${escapeHtml(title)}</div>
          <div class="reader-prose-author">by ${escapeHtml(author)}</div>
          <div class="reader-divider" aria-hidden="true"></div>
        </header>
      `
      : `
        <div class="reader-page-running-header">
          <span class="reader-running-title">${escapeHtml(title)}</span>
          <span class="reader-running-sep">·</span>
          <span class="reader-running-chapter">${escapeHtml(curPage?.chapterTitle || '')}</span>
        </div>
      `;

    overlay.innerHTML = `
      <div class="reader-page-flip-under-shadow flip-${direction}-shadow"></div>
      <div class="reader-page-flip-stage">
        <div class="reader-flipper flip-${direction}">
          <!-- Front face of turning page -->
          <div class="reader-flip-face reader-flip-front">
            <div class="reader-paper-spine-shadow" aria-hidden="true"></div>
            ${chapterHeaderHtml}
            <article class="reader-prose font-${this.fontSize}">
              ${previewParagraphs}
            </article>
            <div class="reader-paper-footer-row" aria-hidden="true">
              <div class="reader-paper-page-number">— ${this.currentPageNumber} —</div>
            </div>
          </div>
          <!-- Back face of turning page -->
          <div class="reader-flip-face reader-flip-back">
            <div class="reader-flip-back-paper">
              <header class="reader-flip-back-header">
                <span class="reader-flip-back-title">${escapeHtml(title)}</span>
                <span class="reader-flip-back-sep">·</span>
                <span class="reader-flip-back-author">${escapeHtml(author)}</span>
              </header>
              <div class="reader-flip-back-body">
                <div class="reader-flip-back-ornament" aria-hidden="true">❦</div>
                <div class="reader-flip-back-rule" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Update digital page state and render new page underneath at top
    this.currentPageNumber = targetPageNumber;
    const newCurPage = this.pagination.getPage(this.currentPageNumber);
    this.currentChapterIndex = newCurPage ? newCurPage.chapterIndex : 0;
    this.render();
    this.applyTheme(this.readerTheme);
    window.scrollTo({ top: 0, behavior: 'instant' });
    this.saveProgress();

    // Clean up after animation finishes (700ms)
    const ANIMATION_DURATION = 700;
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      this.isTransitioning = false;
    }, ANIMATION_DURATION);
  }

  /* --------------------------------------------------------------------------
     Keyboard & Event Listeners
     -------------------------------------------------------------------------- */
  attachKeyboardListener() {
    window.removeEventListener('keydown', this.handleKeydown);
    window.addEventListener('keydown', this.handleKeydown);
  }

  detachKeyboardListener() {
    window.removeEventListener('keydown', this.handleKeydown);
  }

  onKeydown(e) {
    if (this.isTransitioning) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.key === 'Escape') {
      if (this.isHighlightingActive) {
        e.preventDefault();
        this.toggleHighlighterMode(false);
        return;
      }
      if (this.isFocusedMode) {
        e.preventDefault();
        this.toggleFocusedMode(false);
        return;
      }
    }

    if (e.key === 'ArrowLeft') {
      if (this.currentPageNumber > 1) {
        e.preventDefault();
        this.goToPage(this.currentPageNumber - 1);
      }
    } else if (e.key === 'ArrowRight') {
      if (this.pagination && this.currentPageNumber < this.pagination.totalPages) {
        e.preventDefault();
        this.goToPage(this.currentPageNumber + 1);
      }
    } else if (e.key === 'b' || e.key === 'B') {
      // Shortcut: B opens bookmark picker
      e.preventDefault();
      this.openBookmarkPicker();
    } else if (e.key === 'h' || e.key === 'H') {
      // Shortcut: H toggles physical highlighter mode
      e.preventDefault();
      this.toggleHighlighterMode();
    } else if (e.key === 'n' || e.key === 'N') {
      // Shortcut: N opens note stationery
      e.preventDefault();
      this.openNoteStationery();
    } else if (e.key === 't' || e.key === 'T') {
      // Shortcut: T opens Table of Contents
      e.preventDefault();
      this.openTableOfContents();
    }
  }

  /* --------------------------------------------------------------------------
     Physical Stationery Actions: Highlighting, Notes, Bookmarks & TOC
     -------------------------------------------------------------------------- */
  openTableOfContents() {
    if (!this.activeBookId || !this.contentData || !this.pagination) return;
    const curPage = this.pagination.getPage(this.currentPageNumber);
    const curChapterNumber = curPage?.chapterNumber || 1;

    showTableOfContentsModal({
      contentData: this.contentData,
      pagination: this.pagination,
      currentChapterNumber: curChapterNumber,
      onSelectChapter: ({ chapterNumber, pageNumber }) => {
        this.goToPage(pageNumber);
      }
    });
  }
  toggleHighlighterMode(forceState = null) {
    this.isHighlightingActive = typeof forceState === 'boolean' ? forceState : !this.isHighlightingActive;
    
    const highlighterBtn = this.container?.querySelector('#stationeryHighlighterBtn');
    const paperPage = this.container?.querySelector('#readerPaperPage');

    if (highlighterBtn) {
      highlighterBtn.classList.toggle('is-active', this.isHighlightingActive);
      highlighterBtn.setAttribute('aria-pressed', this.isHighlightingActive ? 'true' : 'false');
    }

    if (paperPage) {
      paperPage.classList.toggle('highlighter-mode-active', this.isHighlightingActive);
    }

    // Toggle high-craft status toast
    let toast = document.getElementById('highlighterToast');
    if (this.isHighlightingActive) {
      if (!toast && this.container) {
        toast = document.createElement('div');
        toast.className = 'reader-highlighter-toast';
        toast.id = 'highlighterToast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `
          <span class="toast-dot" aria-hidden="true"></span>
          <span class="toast-title">Highlighting Mode</span>
          <span class="toast-hint">Select any passage to highlight · Click highlighter or Esc to finish</span>
        `;
        const stage = this.container.querySelector('.reader-stage');
        if (stage) stage.appendChild(toast);
      }
    } else {
      if (toast) toast.remove();
    }
  }

  openBookmarkPicker() {
    if (!this.activeBookId || !this.pagination) return;
    const page = this.pagination.getPage(this.currentPageNumber);
    const title = this.contentData?.title || this.bookMeta?.title || 'Untitled';
    const author = this.contentData?.author || this.bookMeta?.author || 'Unknown Author';
    const curBookmark = getPageBookmark(this.activeBookId, this.currentPageNumber);

    showBookmarkPickerModal({
      bookId: this.activeBookId,
      bookTitle: title,
      author: author,
      chapterNumber: page?.chapterNumber || 1,
      chapterTitle: page?.chapterTitle || 'Chapter 1',
      pageNumber: this.currentPageNumber,
      totalPages: this.pagination.totalPages,
      currentBookmark: curBookmark,
      onSelect: () => {
        this.render();
      },
      onRemove: () => {
        this.render();
      }
    });
  }

  openNoteStationery() {
    if (!this.activeBookId || !this.pagination) return;
    const page = this.pagination.getPage(this.currentPageNumber);
    const title = this.contentData?.title || this.bookMeta?.title || 'Untitled';
    const author = this.contentData?.author || this.bookMeta?.author || 'Unknown Author';

    // Check if user has an active text selection on the page
    const selection = window.getSelection();
    let selectedText = null;
    if (selection && !selection.isCollapsed) {
      const text = selection.toString().trim();
      const proseEl = this.container?.querySelector('#readerProseContent');
      if (text.length >= 2 && proseEl && proseEl.contains(selection.anchorNode)) {
        selectedText = text;
      }
    }

    showNoteModal({
      bookId: this.activeBookId,
      bookTitle: title,
      author: author,
      chapterNumber: page?.chapterNumber || 1,
      chapterTitle: page?.chapterTitle || 'Chapter 1',
      pageNumber: this.currentPageNumber,
      selectedText: selectedText,
      onSave: () => {
        window.getSelection()?.removeAllRanges();
      }
    });
  }

  attachSelectionListeners() {
    document.removeEventListener('mouseup', this.handleSelection);
    document.removeEventListener('touchend', this.handleSelection);

    document.addEventListener('mouseup', this.handleSelection);
    document.addEventListener('touchend', this.handleSelection);
  }

  detachSelectionListeners() {
    document.removeEventListener('mouseup', this.handleSelection);
    document.removeEventListener('touchend', this.handleSelection);
  }

  onTextSelectionChange() {
    // Only auto-highlight if highlighting mode is actively turned on
    if (!this.isHighlightingActive) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
      return;
    }

    const proseEl = this.container?.querySelector('#readerProseContent');
    if (!proseEl || !proseEl.contains(selection.anchorNode) || !proseEl.contains(selection.focusNode)) {
      return;
    }

    // Apply the highlight immediately
    this.handleCreateHighlight(text);
    selection.removeAllRanges();
  }

  handleCreateHighlight(text) {
    if (!this.activeBookId || !text) return;
    const page = this.pagination?.getPage(this.currentPageNumber);
    const title = this.contentData?.title || this.bookMeta?.title || 'Untitled';
    const author = this.contentData?.author || this.bookMeta?.author || 'Unknown Author';

    addHighlight({
      bookId: this.activeBookId,
      bookTitle: title,
      author: author,
      chapterNumber: page?.chapterNumber || 1,
      chapterTitle: page?.chapterTitle || 'Chapter 1',
      pageNumber: this.currentPageNumber,
      selectedText: text
    });

    this.render(); // Re-render to show persistent highlight
  }

  /**
   * Calculates progress and saves to localStorage.
   */
  saveProgress() {
    if (!this.activeBookId || !this.contentData || !this.pagination) return;
    const page = this.pagination.getPage(this.currentPageNumber);
    if (!page) return;

    const progressPercent = this.pagination.getProgressPercentage(this.currentPageNumber);

    saveReadingProgress(
      this.activeBookId,
      page.chapterNumber,
      page.chapterTitle,
      progressPercent,
      0, // scrollRatio
      this.currentPageNumber,
      this.pagination.totalPages
    );

    const progressBadge = this.container?.querySelector('#readerProgressIndicator');
    if (progressBadge) {
      progressBadge.textContent = `${progressPercent}% read`;
    }

    const topProgressBar = this.container?.querySelector('#readerTopProgressBar');
    if (topProgressBar) {
      topProgressBar.style.width = `${progressPercent}%`;
    }
  }

  /**
   * Applies highlights safely to prose paragraphs without modifying original paragraph objects.
   */
  renderParagraphWithHighlights(rawText, pageHighlights) {
    let escaped = escapeHtml(rawText);
    if (!pageHighlights || pageHighlights.length === 0) return escaped;

    for (const h of pageHighlights) {
      const hTextEscaped = escapeHtml(h.selectedText);
      if (hTextEscaped && escaped.includes(hTextEscaped)) {
        // Wrap with subtle mark element
        escaped = escaped.split(hTextEscaped).join(`<mark class="reader-highlight" data-highlight-id="${h.id}">${hTextEscaped}</mark>`);
      }
    }
    return escaped;
  }

  /**
   * Shows a minimal inline popover to remove an existing highlight.
   */
  showDehighlightPopover(targetEl, highlightId) {
    const existing = document.getElementById('nookDehighlightPopover');
    if (existing) existing.remove();

    const rect = targetEl.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.id = 'nookDehighlightPopover';
    popover.className = 'nook-dehighlight-popover';
    popover.innerHTML = `
      <button class="btn-dehighlight-action" type="button" aria-label="Remove highlight">
        <span class="dehighlight-icon" aria-hidden="true">✕</span>
        <span>Remove highlight</span>
      </button>
    `;

    document.body.appendChild(popover);

    const popoverRect = popover.getBoundingClientRect();
    let top = window.scrollY + rect.top - popoverRect.height - 8;
    let left = window.scrollX + rect.left + (rect.width / 2) - (popoverRect.width / 2);

    if (top < window.scrollY + 10) {
      top = window.scrollY + rect.bottom + 8;
    }
    if (left < 10) left = 10;
    if (left + popoverRect.width > window.innerWidth - 10) {
      left = window.innerWidth - popoverRect.width - 10;
    }

    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;

    const closePopover = () => {
      popover.classList.add('closing');
      setTimeout(() => {
        if (popover.parentNode) popover.remove();
      }, 150);
      document.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleEsc);
    };

    const handleOutsideClick = (e) => {
      if (!popover.contains(e.target) && e.target !== targetEl) {
        closePopover();
      }
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closePopover();
      }
    };

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
      window.addEventListener('keydown', handleEsc);
    }, 10);

    const btn = popover.querySelector('.btn-dehighlight-action');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeHighlight(highlightId);
        closePopover();
        this.render();
      });
    }
  }

  /**
   * Main render function.
   */
  render() {
    if (!this.container) return;

    // Loading State
    if (this.isLoading) {
      this.container.innerHTML = `
        <div class="reader-state-container" aria-live="polite">
          <div class="nook-loading-spinner" aria-hidden="true"></div>
          <p class="reader-loading-text">Preparing your reading room…</p>
        </div>
      `;
      return;
    }

    // Error State
    if (this.error || !this.contentData || !this.pagination) {
      const errorMsg = !this.bookMeta 
        ? "That book isn't in Nook." 
        : (this.error?.message || "Text for this edition isn't available yet.");

      this.container.innerHTML = `
        <div class="reader-state-container error-state" role="alert">
          <h2 class="error-title">Unable to Open Edition</h2>
          <p class="error-text">${escapeHtml(errorMsg)}</p>
          <div class="error-actions">
            ${this.bookMeta ? '<button class="btn" id="readerRetryBtn">Try again</button>' : ''}
            <button class="btn secondary" id="readerErrorBackBtn">← Return to Details</button>
          </div>
        </div>
      `;

      const retryBtn = this.container.querySelector('#readerRetryBtn');
      if (retryBtn) retryBtn.addEventListener('click', () => this.openBook(this.activeBookId));

      const backBtn = this.container.querySelector('#readerErrorBackBtn');
      if (backBtn) backBtn.addEventListener('click', () => this.onNavigateBack(this.activeBookId));
      return;
    }

    const title = this.contentData.title || (this.bookMeta && this.bookMeta.title) || 'Untitled';
    const author = this.contentData.author || (this.bookMeta && this.bookMeta.author) || 'Unknown Author';
    const chapters = this.contentData.chapters || [];
    
    const page = this.pagination.getPage(this.currentPageNumber) || {
      pageNumber: 1,
      totalPages: 1,
      chapterIndex: 0,
      chapterNumber: 1,
      chapterTitle: 'Chapter 1',
      chapterPageNumber: 1,
      chapterTotalPages: 1,
      isFirstPageOfChapter: true,
      paragraphs: ['No content available.']
    };

    const hasPrevPage = this.currentPageNumber > 1;
    const hasNextPage = this.currentPageNumber < this.pagination.totalPages;
    const curBookmark = getPageBookmark(this.activeBookId, this.currentPageNumber);
    const isBookmarked = !!curBookmark;
    const pageHighlights = getHighlights(this.activeBookId).filter((h) => h.pageNumber === this.currentPageNumber);

    const progressPercent = this.pagination.getProgressPercentage(this.currentPageNumber);

    this.container.innerHTML = `
      <!-- Hairline Top Reading Progress Indicator (1-2px) -->
      <div class="reader-top-progress-bar" id="readerTopProgressBar" style="width: ${progressPercent}%;" aria-hidden="true"></div>

      <!-- Minimal Serene Reader Header -->
      <header class="reader-toolbar" role="toolbar" aria-label="Reading controls">
        <div class="reader-toolbar-left">
          <button class="reader-back-btn" id="readerBackBtn" aria-label="Return to Book Details">
            <span class="reader-brand">Nook</span>
            <span class="reader-back-sep" aria-hidden="true">‹</span>
            <span class="back-label">Details</span>
          </button>
          
          <div class="reader-book-info" aria-hidden="true">
            <span class="reader-book-title">${escapeHtml(title)}</span>
            <span class="reader-info-sep">·</span>
            <span class="reader-chapter-label">${escapeHtml(page.chapterTitle)}</span>
          </div>
        </div>

        <div class="reader-toolbar-right">
          <!-- Table of Contents Button -->
          <button class="reader-toc-trigger-btn" id="readerTocBtn" aria-label="Table of Contents (T)" title="Table of Contents (T)">
            <span class="toc-trigger-icon" aria-hidden="true">☰</span>
            <span class="toc-trigger-label">Contents</span>
          </button>

          <!-- Chapter Selector Dropdown -->
          <div class="reader-chapter-select-wrap">
            <select class="reader-chapter-select" id="readerChapterSelect" aria-label="Select Chapter">
              ${chapters.map((ch, idx) => `
                <option value="${idx}" ${idx === page.chapterIndex ? 'selected' : ''}>
                  ${escapeHtml(ch.title || `Chapter ${ch.number}`)}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Reading Theme Controls (Warm / Light / Dark / Paper Light) -->
          <div class="reader-theme-controls" role="group" aria-label="Reading Theme">
            <button class="theme-btn ${this.readerTheme === 'warm' ? 'active' : ''}" data-theme-val="warm" title="Warm cream theme" aria-label="Warm theme">Warm</button>
            <button class="theme-btn ${this.readerTheme === 'light' ? 'active' : ''}" data-theme-val="light" title="Light theme" aria-label="Light theme">Light</button>
            <button class="theme-btn ${this.readerTheme === 'dark' ? 'active' : ''}" data-theme-val="dark" title="Dark theme" aria-label="Dark theme">Dark</button>
            <button class="theme-btn ${this.readerTheme === 'eye-comfort' ? 'active' : ''}" data-theme-val="eye-comfort" title="Warm, low-glare colors designed for comfortable long-form reading" aria-label="Paper Light theme">Paper Light</button>
          </div>

          <!-- Font Size Selector (A-, A, A+) -->
          <div class="reader-font-controls" role="group" aria-label="Text size">
            <button class="font-size-btn ${this.fontSize === 'sm' ? 'active' : ''}" data-size="sm" title="Smaller text" aria-label="Small font size">A−</button>
            <button class="font-size-btn ${this.fontSize === 'md' ? 'active' : ''}" data-size="md" title="Default text" aria-label="Default font size">A</button>
            <button class="font-size-btn ${this.fontSize === 'lg' ? 'active' : ''}" data-size="lg" title="Larger text" aria-label="Large font size">A+</button>
          </div>

          <!-- Focused Reading Mode Toggle -->
          <button 
            class="reader-focus-toggle-btn ${this.isFocusedMode ? 'active' : ''}" 
            id="readerFocusBtn" 
            title="Focused reading" 
            aria-label="Focused reading" 
            aria-pressed="${this.isFocusedMode ? 'true' : 'false'}"
          >
            <span class="focus-icon" aria-hidden="true">⛶</span>
            <span class="focus-label">Focus</span>
          </button>

          <!-- Progress Indicator Badge -->
          <div class="reader-progress-badge" id="readerProgressIndicator" aria-label="Reading progress">
            ${progressPercent}% read
          </div>
        </div>
      </header>

      <!-- Reading Chamber -->
      <main class="reader-stage">

        <!-- Floating Minimal Exit Focus Control (visible only in Focused Reading Mode) -->
        <button 
          class="reader-focus-exit-btn" 
          id="readerFocusExitBtn" 
          aria-label="Exit focused reading" 
          title="Exit focused reading (Esc)"
        >
          <span class="exit-focus-text">Exit Focus</span>
          <span class="exit-focus-icon" aria-hidden="true">✕</span>
        </button>
        
        <!-- Physical Paper Book Page (5.5" × 8.5" / 11:17 Ratio) -->
        <div class="reader-paper-page ${isBookmarked ? 'has-bookmark' : ''} ${this.isHighlightingActive ? 'highlighter-mode-active' : ''}" id="readerPaperPage" data-page-num="${this.currentPageNumber}">
          
          <div class="reader-paper-spine-shadow" aria-hidden="true"></div>

          <!-- Physical Ribbon / Bookmark on Page (if bookmarked) -->
          ${curBookmark ? `
            <div 
              class="reader-page-bookmark-ribbon style-${curBookmark.bookmarkStyle || 'crimson-silk'}" 
              id="readerPaperRibbon" 
              title="Bookmark placed (${curBookmark.bookmarkStyle || 'crimson-silk'}) — Click to change or remove" 
              aria-label="Bookmark placed on Page ${this.currentPageNumber}" 
              role="button" 
              tabindex="0"
            >
              <div class="ribbon-texture"></div>
              <span class="ribbon-tail" aria-hidden="true"></span>
            </div>
          ` : ''}

          <!-- Permanent Physical Stationery Tools Attached to Page Right Edge -->
          <aside class="reader-stationery-dock" aria-label="Book stationery tools">
            <!-- 1. Physical Bookmark Ribbon / Tab -->
            <button 
              class="stationery-item stationery-bookmark-tab ${curBookmark ? 'is-placed style-' + (curBookmark.bookmarkStyle || 'crimson-silk') : ''}" 
              id="stationeryBookmarkBtn" 
              aria-label="${curBookmark ? 'Bookmark placed (Click to change or remove)' : 'Choose bookmark'}" 
              title="${curBookmark ? 'Bookmark placed — Click to change or remove' : 'Choose bookmark (B)'}"
            >
              <span class="stationery-ribbon-tab" aria-hidden="true">
                <span class="ribbon-point"></span>
              </span>
              <span class="sr-only">Choose bookmark</span>
            </button>

            <!-- 2. Physical Note Paper Stationery Tab -->
            <button 
              class="stationery-item stationery-note-tab" 
              id="stationeryNoteBtn" 
              aria-label="Add note" 
              title="Add note to page or selected passage (N)"
            >
              <span class="stationery-paper-tab" aria-hidden="true">
                <span class="paper-fold"></span>
              </span>
              <span class="sr-only">Add note</span>
            </button>

            <!-- 3. Physical Highlighter Stationery (Barrel on left inside book, Chisel tip facing OUTWARD to the right) -->
            <button 
              class="stationery-item stationery-highlighter-tab ${this.isHighlightingActive ? 'is-active' : ''}" 
              id="stationeryHighlighterBtn" 
              aria-label="${this.isHighlightingActive ? 'Highlighting mode active — click to finish (H or Esc)' : 'Activate highlighter'}" 
              title="${this.isHighlightingActive ? 'Highlighting active — select text to highlight (Click or Esc to exit)' : 'Activate highlighter (H)'}" 
              aria-pressed="${this.isHighlightingActive ? 'true' : 'false'}"
            >
              <span class="stationery-highlighter-body" aria-hidden="true">
                <span class="hl-barrel"></span>
                <span class="hl-band"></span>
                <span class="hl-chisel-tip"></span>
              </span>
              <span class="sr-only">Activate highlighter</span>
            </button>
          </aside>

          ${page.isFirstPageOfChapter ? `
            <!-- Chapter Header Banner -->
            <header class="reader-prose-header">
              <div class="reader-ornament" aria-hidden="true">❦</div>
              <h1 class="reader-prose-chapter-title">${escapeHtml(page.chapterTitle)}</h1>
              <div class="reader-prose-book-title">${escapeHtml(title)}</div>
              <div class="reader-prose-author">by ${escapeHtml(author)}</div>
              <div class="reader-divider" aria-hidden="true"></div>
            </header>
          ` : `
            <!-- Running Page Header for subsequent chapter pages -->
            <div class="reader-page-running-header" aria-hidden="true">
              <span class="reader-running-title">${escapeHtml(title)}</span>
              <span class="reader-running-sep">·</span>
              <span class="reader-running-chapter">${escapeHtml(page.chapterTitle)}</span>
            </div>
          `}

          <!-- Page Prose Content with Highlight Restoration -->
          <article class="reader-prose font-${this.fontSize} ${page.isFirstPageOfChapter ? 'is-chapter-start' : ''}" id="readerProseContent">
            ${(page.paragraphUnits || (page.paragraphs || []).map(p => ({ text: p, isContinuation: false, continuedOnNext: false }))).map((u, idx) => {
              const isFirst = idx === 0 && page.isFirstPageOfChapter && !u.isContinuation;
              const dropCapClass = isFirst ? 'has-drop-cap' : '';
              const contClass = u.isContinuation ? 'is-para-continuation' : '';
              const highlightedHtml = this.renderParagraphWithHighlights(u.text || u, pageHighlights);
              return `<p class="${dropCapClass} ${contClass}">${highlightedHtml}</p>`;
            }).join('')}
          </article>

          <!-- Printed Literary Folio & Corner Navigation at Bottom of Physical Page -->
          <div class="reader-paper-footer-row" aria-label="Page navigation">
            <button 
              class="reader-paper-corner-nav prev-corner" 
              id="readerPaperCornerPrev" 
              aria-label="Previous page" 
              title="Previous page (←)"
              ${!hasPrevPage ? 'disabled aria-disabled="true"' : ''}
            >
              <span class="corner-nav-arrow" aria-hidden="true">←</span>
            </button>

            <div class="reader-paper-page-number" aria-hidden="true">— ${this.currentPageNumber} —</div>

            <button 
              class="reader-paper-corner-nav next-corner" 
              id="readerPaperCornerNext" 
              aria-label="Next page" 
              title="Next page (→)"
              ${!hasNextPage ? 'disabled aria-disabled="true"' : ''}
            >
              <span class="corner-nav-arrow" aria-hidden="true">→</span>
            </button>
          </div>

        </div>

        <!-- Contextual Chapter Similarity ("Elsewhere in Nook") -->
        <section class="reader-elsewhere-panel" id="readerElsewherePanel" aria-label="Related chapters in other books" style="display: none;">
          <div class="elsewhere-kicker">ELSEWHERE IN NOOK</div>
          <h3 class="elsewhere-heading">Related Passages Across the Library</h3>
          <div class="elsewhere-cards-grid" id="readerElsewhereGrid"></div>
        </section>

        <!-- Highlighting Mode Active Toast Notification -->
        ${this.isHighlightingActive ? `
          <div class="reader-highlighter-toast" id="highlighterToast" role="status" aria-live="polite">
            <span class="toast-dot" aria-hidden="true"></span>
            <span class="toast-title">Highlighting Mode</span>
            <span class="toast-hint">Select any passage to highlight · Click highlighter or Esc to finish</span>
          </div>
        ` : ''}

      </main>
    `;

    this.bindEvents();
    if (page && typeof page.chapterNumber === 'number') {
      this.loadElsewhereChapters(page.chapterNumber);
    }
  }

  bindEvents() {
    const backBtn = this.container.querySelector('#readerBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.onNavigateBack(this.activeBookId);
      });
    }

    // Table of Contents Modal
    const tocBtn = this.container.querySelector('#readerTocBtn');
    if (tocBtn) {
      tocBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openTableOfContents();
      });
    }

    // Physical Stationery: Bookmark Picker
    const stationeryBookmarkBtn = this.container.querySelector('#stationeryBookmarkBtn');
    if (stationeryBookmarkBtn) {
      stationeryBookmarkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openBookmarkPicker();
      });
    }

    // Physical Ribbon Click
    const paperRibbon = this.container.querySelector('#readerPaperRibbon');
    if (paperRibbon) {
      paperRibbon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openBookmarkPicker();
      });
    }

    // Physical Stationery: Note Tab
    const stationeryNoteBtn = this.container.querySelector('#stationeryNoteBtn');
    if (stationeryNoteBtn) {
      stationeryNoteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openNoteStationery();
      });
    }

    // Physical Stationery: Highlighter
    const stationeryHighlighterBtn = this.container.querySelector('#stationeryHighlighterBtn');
    if (stationeryHighlighterBtn) {
      stationeryHighlighterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleHighlighterMode();
      });
    }

    // Highlight click for removal ("Dehighlight")
    const marks = this.container.querySelectorAll('mark.reader-highlight');
    marks.forEach((mark) => {
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        const highlightId = mark.getAttribute('data-highlight-id');
        this.showDehighlightPopover(mark, highlightId);
      });
    });

    // Font size buttons
    const fontBtns = this.container.querySelectorAll('.font-size-btn');
    fontBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const size = e.currentTarget.getAttribute('data-size');
        this.setFontSize(size);
      });
    });

    // Theme buttons (Warm / Light / Dark)
    const themeBtns = this.container.querySelectorAll('.theme-btn');
    themeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const theme = e.currentTarget.getAttribute('data-theme-val');
        this.setTheme(theme);
      });
    });

    // Focus Reading Mode Toggle
    const focusBtn = this.container.querySelector('#readerFocusBtn');
    if (focusBtn) {
      focusBtn.addEventListener('click', () => {
        this.toggleFocusedMode();
      });
    }

    // Floating Exit Focus Button
    const exitFocusBtn = this.container.querySelector('#readerFocusExitBtn');
    if (exitFocusBtn) {
      exitFocusBtn.addEventListener('click', () => {
        this.toggleFocusedMode(false);
      });
    }

    // On-Page Corner Navigation (Primary & Only Page Controls)
    const cornerPrevBtn = this.container.querySelector('#readerPaperCornerPrev');
    if (cornerPrevBtn && this.currentPageNumber > 1) {
      cornerPrevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.goToPage(this.currentPageNumber - 1);
      });
    }

    const cornerNextBtn = this.container.querySelector('#readerPaperCornerNext');
    if (cornerNextBtn && this.pagination && this.currentPageNumber < this.pagination.totalPages) {
      cornerNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.goToPage(this.currentPageNumber + 1);
      });
    }

    // Chapter select dropdown
    const chapterSelect = this.container.querySelector('#readerChapterSelect');
    if (chapterSelect) {
      chapterSelect.addEventListener('change', (e) => {
        const targetIdx = parseInt(e.target.value, 10);
        if (!isNaN(targetIdx)) {
          this.goToChapter(targetIdx);
        }
      });
    }
  }

  async loadElsewhereChapters(chapterNumber) {
    const panel = this.container.querySelector('#readerElsewherePanel');
    const grid = this.container.querySelector('#readerElsewhereGrid');
    if (!panel || !grid) return;

    try {
      const res = await findSimilarChapters(this.activeBookId, chapterNumber, {
        contentData: this.contentData,
        limit: 3,
        minSimilarity: 0.03,
        excludeSameBook: true
      });

      if (!res || !res.results || res.results.length === 0) {
        panel.style.display = 'none';
        return;
      }

      panel.style.display = 'block';
      grid.innerHTML = res.results.map((r) => {
        const authorText = r.author ? (r.author.trim().toLowerCase().startsWith('by ') ? r.author.trim() : `by ${r.author.trim()}`) : '';
        return `
        <article class="elsewhere-card" data-action="open-related-chapter" data-book-id="${r.bookId}" data-chapter="${r.chapterNumber}" tabindex="0" role="button" aria-label="Read ${escapeHtml(r.bookTitle)}, ${escapeHtml(r.chapterTitle)}">
          <div class="elsewhere-card-top">
            <span class="elsewhere-book-title">${escapeHtml(r.bookTitle)}</span>
            <span class="elsewhere-chapter-title">${escapeHtml(r.chapterTitle)}</span>
          </div>
          ${authorText ? `<div class="elsewhere-author">${escapeHtml(authorText)}</div>` : ''}
          <p class="elsewhere-explanation">${escapeHtml(r.explanation)}</p>
          <div class="elsewhere-action-hint">Explore chapter →</div>
        </article>
      `;
      }).join('');

      const cards = grid.querySelectorAll('[data-action="open-related-chapter"]');
      cards.forEach((card) => {
        const navigateHandler = () => {
          const targetBookId = card.getAttribute('data-book-id');
          const targetChapter = parseInt(card.getAttribute('data-chapter'), 10) || 1;
          this.openBook(targetBookId, targetChapter, 1);
        };

        card.addEventListener('click', navigateHandler);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigateHandler();
          }
        });
      });
    } catch (err) {
      console.warn('[READER] Failed to load chapter similarity:', err);
      panel.style.display = 'none';
    }
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    clearTimeout(this._resizeTimer);
    this.detachKeyboardListener();
    this.detachFullscreenListeners();
    this.detachSelectionListeners();
    this.toggleFocusedMode(false);
    this.isHighlightingActive = false;
    document.body.classList.remove('in-reader-mode');
    document.body.removeAttribute('data-reader-active-theme');
    const existingOverlay = document.querySelector('.reader-page-flip-overlay');
    if (existingOverlay) existingOverlay.remove();
    this.isTransitioning = false;
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
