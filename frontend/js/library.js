/**
 * Nook Library View Controller & Renderer
 * Provides client-side data-driven search, dynamic category filtering, sorting,
 * result counts, and responsive book card rendering from the verified catalog.
 */

import { getCatalogCategories } from './catalog.js';
import { createBookCardMarkup } from './home.js';

export class LibraryController {
  constructor({ getCatalog, onSelectBook = () => {} }) {
    this.getCatalog = getCatalog;
    this.onSelectBook = onSelectBook;
    
    this.searchQuery = '';
    this.selectedCategory = 'All';
    this.sortBy = 'curated'; // 'curated' | 'title' | 'author' | 'shortest'

    this.container = document.getElementById('view-library');
  }

  /**
   * Initializes or re-renders the complete Library view.
   */
  init(initialCategory = null) {
    if (!this.container) return;

    if (initialCategory) {
      this.selectedCategory = initialCategory;
    }

    this.renderBaseLayout();
    this.bindControls();
    this.updateGrid();
  }

  /**
   * Sets active category filter from external navigation (e.g. from Home collection card).
   */
  setCategory(categoryName) {
    this.selectedCategory = categoryName || 'All';
    this.updateChipsActiveState();
    this.updateGrid();
  }

  /**
   * Sets search query.
   */
  setSearch(query) {
    this.searchQuery = (query || '').trim();
    const searchInput = this.container.querySelector('#libSearchInput');
    if (searchInput && searchInput.value !== this.searchQuery) {
      searchInput.value = this.searchQuery;
    }
    this.updateGrid();
  }

  /**
   * Sets sorting option.
   */
  setSort(sortKey) {
    this.sortBy = sortKey || 'curated';
    const sortSelect = this.container.querySelector('#libSortSelect');
    if (sortSelect) {
      sortSelect.value = this.sortBy;
    }
    this.updateGrid();
  }

  /**
   * Clears all filters and resets search.
   */
  clearFilters() {
    this.searchQuery = '';
    this.selectedCategory = 'All';
    this.sortBy = 'curated';

    const searchInput = this.container.querySelector('#libSearchInput');
    if (searchInput) searchInput.value = '';

    const sortSelect = this.container.querySelector('#libSortSelect');
    if (sortSelect) sortSelect.value = 'curated';

    this.updateChipsActiveState();
    this.updateGrid();
  }

  /**
   * Renders the base editorial layout for the Library view.
   */
  renderBaseLayout() {
    const catalog = this.getCatalog() || [];
    const categories = getCatalogCategories();

    let chipsHtml = `
      <button class="chip ${this.selectedCategory === 'All' ? 'active' : ''}" data-filter="All" role="tab" aria-selected="${this.selectedCategory === 'All'}">
        All <span class="chip-count">(${catalog.length})</span>
      </button>
    `;

    categories.forEach((cat) => {
      const isActive = this.selectedCategory === cat.name;
      chipsHtml += `
        <button class="chip ${isActive ? 'active' : ''}" data-filter="${escapeHtml(cat.name)}" role="tab" aria-selected="${isActive}">
          ${escapeHtml(cat.name)} <span class="chip-count">(${cat.count})</span>
        </button>
      `;
    });

    this.container.innerHTML = `
      <div class="lib-head">
        <h1 class="lib-title">The Library</h1>
        <p class="lib-sub">Every book in Nook is verified public-domain literature, curated for quiet reading.</p>
      </div>

      <!-- Controls Toolbar: Search, Filters, Sort -->
      <div class="lib-toolbar" role="region" aria-label="Library Controls">
        <div class="lib-search-wrap">
          <label for="libSearchInput" class="visually-hidden">Search verified catalog</label>
          <input 
            type="search" 
            id="libSearchInput" 
            class="lib-search" 
            placeholder="Search by title, author, or genre…" 
            aria-label="Search verified catalog by title, author, or genre"
            value="${escapeHtml(this.searchQuery)}"
            autocomplete="off"
            spellcheck="false"
          >
          <button class="lib-search-clear" id="libSearchClear" aria-label="Clear search input" title="Clear search">×</button>
        </div>

        <div class="lib-sort-wrap">
          <label for="libSortSelect" class="sort-label">Sort:</label>
          <select id="libSortSelect" class="lib-sort-select" aria-label="Sort library catalog">
            <option value="curated" ${this.sortBy === 'curated' ? 'selected' : ''}>Curated</option>
            <option value="title" ${this.sortBy === 'title' ? 'selected' : ''}>Title (A–Z)</option>
            <option value="author" ${this.sortBy === 'author' ? 'selected' : ''}>Author (A–Z)</option>
            <option value="shortest" ${this.sortBy === 'shortest' ? 'selected' : ''}>Shortest (~hrs)</option>
          </select>
        </div>
      </div>

      <!-- Category Filter Chips -->
      <div class="chips" role="tablist" aria-label="Filter by genre">
        ${chipsHtml}
      </div>

      <!-- Active Filter Status & Result Count -->
      <div class="lib-results-bar" id="libResultsBar" aria-live="polite">
        <!-- Dynamically rendered -->
      </div>

      <!-- Book Grid Container -->
      <div class="lib-grid" id="library-books-grid" role="region" aria-label="Book Catalog Grid">
        <!-- Dynamically rendered -->
      </div>
    `;
  }

  /**
   * Binds event listeners to search, filter chips, sort select, and clear buttons.
   */
  bindControls() {
    const searchInput = this.container.querySelector('#libSearchInput');
    const searchClear = this.container.querySelector('#libSearchClear');
    const sortSelect = this.container.querySelector('#libSortSelect');
    const chipsContainer = this.container.querySelector('.chips');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.updateClearBtnVisibility();
        this.updateGrid();
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.setSearch('');
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        this.setSearch('');
        if (searchInput) searchInput.focus();
      });
      this.updateClearBtnVisibility();
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.setSort(e.target.value);
      });
    }

    if (chipsContainer) {
      chipsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const filter = chip.getAttribute('data-filter');
        this.setCategory(filter);
      });
    }
  }

  updateClearBtnVisibility() {
    const searchClear = this.container.querySelector('#libSearchClear');
    if (searchClear) {
      searchClear.style.display = this.searchQuery.length > 0 ? 'flex' : 'none';
    }
  }

  updateChipsActiveState() {
    const chips = this.container.querySelectorAll('.chips .chip');
    chips.forEach((chip) => {
      const filter = chip.getAttribute('data-filter');
      const isActive = filter === this.selectedCategory;
      chip.classList.toggle('active', isActive);
      chip.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  /**
   * Filters and sorts the verified catalog based on current state.
   */
  getFilteredAndSortedBooks() {
    const catalog = this.getCatalog() || [];
    const q = this.searchQuery.toLowerCase();

    // 1. Filter by Search Query
    let results = catalog.filter((book) => {
      if (!q) return true;
      const titleMatch = book.title && book.title.toLowerCase().includes(q);
      const authorMatch = book.author && book.author.toLowerCase().includes(q);
      const categoryMatch = Array.isArray(book.categories) && book.categories.some((c) => c.toLowerCase().includes(q));
      const descriptionMatch = book.description && book.description.toLowerCase().includes(q);
      return titleMatch || authorMatch || categoryMatch || descriptionMatch;
    });

    // 2. Filter by Category
    if (this.selectedCategory && this.selectedCategory !== 'All') {
      results = results.filter((book) => {
        return Array.isArray(book.categories) && book.categories.includes(this.selectedCategory);
      });
    }

    // 3. Sort (immutable slice)
    results = results.slice().sort((a, b) => {
      if (this.sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (this.sortBy === 'author') {
        return (a.author || '').localeCompare(b.author || '');
      }
      if (this.sortBy === 'shortest') {
        const timeA = a.estimated_reading_time || (a.word_count ? a.word_count / 225 : 0);
        const timeB = b.estimated_reading_time || (b.word_count ? b.word_count / 225 : 0);
        return timeA - timeB;
      }
      // 'curated' keeps original catalog array order
      return 0;
    });

    return results;
  }

  /**
   * Updates the book grid and result count bar based on active query/filter/sort.
   */
  updateGrid() {
    const grid = this.container.querySelector('#library-books-grid');
    const resultsBar = this.container.querySelector('#libResultsBar');
    if (!grid || !resultsBar) return;

    const books = this.getFilteredAndSortedBooks();
    const count = books.length;

    // Render Results Bar
    let statusText = `${count} ${count === 1 ? 'verified book' : 'verified books'}`;
    if (this.selectedCategory !== 'All') {
      statusText += ` in <span class="active-filter-tag">${escapeHtml(this.selectedCategory)}</span>`;
    }
    if (this.searchQuery) {
      statusText += ` matching “${escapeHtml(this.searchQuery)}”`;
    }

    resultsBar.innerHTML = `
      <span class="lib-count-text">${statusText}</span>
      ${(this.searchQuery || this.selectedCategory !== 'All' || this.sortBy !== 'curated')
        ? `<button class="lib-reset-btn" id="libResetFiltersBtn">Reset filters</button>`
        : ''}
    `;

    const resetBtn = resultsBar.querySelector('#libResetFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.clearFilters());
    }

    // Handle Empty State
    if (count === 0) {
      grid.innerHTML = `
        <div class="lib-empty-state" role="status">
          <div class="empty-icon" aria-hidden="true">📖</div>
          <h2 class="empty-title">No books found</h2>
          <p class="empty-sub">
            We couldn't find any books matching ${this.searchQuery ? `“${escapeHtml(this.searchQuery)}”` : ''} 
            ${this.selectedCategory !== 'All' ? `in ${escapeHtml(this.selectedCategory)}` : ''}.
          </p>
          <button class="btn secondary" id="emptyClearBtn">Clear search and filters</button>
        </div>
      `;

      const emptyClearBtn = grid.querySelector('#emptyClearBtn');
      if (emptyClearBtn) {
        emptyClearBtn.addEventListener('click', () => this.clearFilters());
      }
      return;
    }

    // Render Book Cards
    grid.innerHTML = books.map((book) => createBookCardMarkup(book, false)).join('');

    // Attach card click & keyboard listeners
    const cards = grid.querySelectorAll('.book-card');
    cards.forEach((card) => {
      const bookId = card.getAttribute('data-book-id');
      const handleSelect = () => {
        console.log(`[NOOK LIBRARY] Selected book: ${bookId}`);
        this.onSelectBook(bookId);
      };

      card.addEventListener('click', handleSelect);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      });
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
