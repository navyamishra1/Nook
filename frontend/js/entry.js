/**
 * Nook Entry Experience Controller (Deterministic 5-Phase Sequence)
 * 
 * Sequence & Timing:
 * PHASE 1 — CLOSED: Centered closed tactile book (360x520px). Clickable.
 * PHASE 2 — OPENING (0ms - 500ms): Front cover physically rotates 175deg around spine (500ms).
 * PHASE 3 — OPENED / SPREAD HOLD (500ms - 700ms): Holds open double spread for ~200ms.
 * PHASE 4 — ENTERING PAGE (700ms - 1250ms): Camera zooms smoothly into right inside page (550ms).
 * PHASE 5 — HOME REVEAL (1150ms): Staggered reveal of Nook masthead and shelf.
 * PHASE 6 — COMPLETE (1350ms): Entry overlay hidden; full homepage interactive.
 */

const STORAGE_KEY = 'nook_visited';
const DEV_ALWAYS_SHOW_ENTRY = true; // Set to true during development to ensure entry animation is always visible

export class EntryController {
  constructor({ onEntered } = {}) {
    this.onEntered = onEntered || (() => {});
    this.overlay = document.getElementById('entry-overlay');
    this.stage = document.getElementById('book-stage-container');
    this.book = document.getElementById('tactile-book-trigger');
    this.skipBtn = document.getElementById('entry-skip-btn');
    this.app = document.getElementById('app');

    this.state = 'closed'; // 'closed' | 'opening' | 'opened' | 'entering' | 'complete'
    this.isAnimating = false;
    this.timeouts = [];

    this.init();
  }

  init() {
    if (!this.overlay || !this.book) return;

    // Check returning user status (bypassed if DEV_ALWAYS_SHOW_ENTRY is active)
    const hasVisited = localStorage.getItem(STORAGE_KEY) === 'true';
    if (hasVisited && !DEV_ALWAYS_SHOW_ENTRY) {
      this.skipEntry(false);
      return;
    }

    // Set initial closed state
    this.resetToClosed();

    // 1. Mouse Click on the book trigger surface
    this.book.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startEntry();
    });

    // 2. Focused Keyboard activation on the book (Enter / Space)
    this.book.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.startEntry();
      }
    });

    // 3. Window-level keyboard listener when entry overlay is visible
    window.addEventListener('keydown', (e) => {
      const isOverlayActive = this.overlay && !this.overlay.classList.contains('entry-hidden');
      if (!isOverlayActive) return;

      if (this.state === 'closed') {
        if (e.key === 'Enter' || e.key === ' ') {
          // If focus is currently on the skip button, allow native button activation
          if (document.activeElement === this.skipBtn) {
            return;
          }
          e.preventDefault();
          this.startEntry();
          return;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          this.skipEntry(true);
          return;
        }
      } else if (e.key === 'Escape') {
        // Escape during active animation cancels and skips immediately
        e.preventDefault();
        this.skipEntry(true);
      }
    });

    // 4. Skip button click handler
    if (this.skipBtn) {
      this.skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.skipEntry(true);
      });
    }
  }

  clearTimeouts() {
    this.timeouts.forEach((t) => clearTimeout(t));
    this.timeouts = [];
  }

  resetToClosed() {
    this.clearTimeouts();
    this.state = 'closed';
    this.isAnimating = false;

    if (this.overlay) {
      this.overlay.classList.remove('entry-hidden');
    }
    if (this.stage) {
      this.stage.classList.remove('is-opening', 'is-open', 'is-entering');
    }
    if (this.book) {
      this.book.classList.remove('is-opening', 'is-open', 'is-entering');
    }
    if (this.app) {
      this.app.classList.remove('app-visible', 'app-revealing-staggered');
    }
  }

  /**
   * Canonical, idempotent method to initiate the entry sequence.
   * All valid triggers (single click, Enter, Space) call this single entry point.
   */
  startEntry() {
    if (this.state !== 'closed') {
      // Idempotent guard: already opening, opened, entering, or complete
      return;
    }

    this.state = 'opening';
    this.isAnimating = true;

    // ------------------------------------------------------------------------
    // PHASE 2 — OPENING (0ms - 500ms)
    // Cover physically rotates 175deg around spine (smooth 500ms duration)
    // ------------------------------------------------------------------------
    this.book.classList.add('is-opening');
    if (this.stage) this.stage.classList.add('is-opening');

    // ------------------------------------------------------------------------
    // PHASE 3 — OPENED / INSIDE SPREAD HOLD (500ms - 700ms)
    // Clear view of open spread with brief 200ms hold
    // ------------------------------------------------------------------------
    this.timeouts.push(
      setTimeout(() => {
        this.state = 'opened';
        this.book.classList.add('is-open');
        if (this.stage) this.stage.classList.add('is-open');
      }, 500)
    );

    // ------------------------------------------------------------------------
    // PHASE 4 — ENTERING THE PAGE (700ms - 1250ms)
    // Camera zooms smoothly into right page (550ms duration)
    // ------------------------------------------------------------------------
    this.timeouts.push(
      setTimeout(() => {
        this.state = 'entering';
        this.book.classList.add('is-entering');
        if (this.stage) this.stage.classList.add('is-entering');
      }, 700)
    );

    // ------------------------------------------------------------------------
    // PHASE 5 — HOMEPAGE REVEAL (1150ms)
    // Reveal homepage as page expansion concludes
    // ------------------------------------------------------------------------
    this.timeouts.push(
      setTimeout(() => {
        if (this.app) {
          this.app.classList.add('app-visible', 'app-revealing-staggered');
        }
      }, 1150)
    );

    // ------------------------------------------------------------------------
    // PHASE 6 — COMPLETE (1350ms)
    // Overlay removed, interactive sanctuary active
    // ------------------------------------------------------------------------
    this.timeouts.push(
      setTimeout(() => {
        this.finishEntry();
      }, 1350)
    );
  }

  openBook() {
    this.startEntry();
  }

  finishEntry() {
    this.clearTimeouts();
    this.state = 'complete';
    this.isAnimating = false;
    localStorage.setItem(STORAGE_KEY, 'true');

    if (this.overlay) {
      this.overlay.classList.add('entry-hidden');
    }
    if (this.app) {
      this.app.classList.remove('app-revealing-staggered');
      this.app.classList.add('app-visible');
    }

    this.onEntered();

    const wordmark = document.querySelector('.wordmark');
    if (wordmark) {
      wordmark.focus();
    }
  }

  skipEntry(persist = true) {
    this.clearTimeouts();
    this.state = 'complete';
    this.isAnimating = false;
    if (persist && !DEV_ALWAYS_SHOW_ENTRY) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }

    if (this.overlay) {
      this.overlay.classList.add('entry-hidden');
    }
    if (this.app) {
      this.app.classList.remove('app-revealing-staggered');
      this.app.classList.add('app-visible');
    }

    this.onEntered();
  }

  replay() {
    this.resetToClosed();
    window.scrollTo({ top: 0, behavior: 'instant' });

    setTimeout(() => {
      if (this.book) {
        this.book.focus();
      }
    }, 100);
  }
}
