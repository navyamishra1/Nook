/**
 * Nook Table of Contents Module
 * 
 * Provides:
 * - Deterministic extraction of chapter structure & exact first page numbers from pagination
 * - Typeset book-furniture Table of Contents renderer (leader dots, numerals, right-aligned folios)
 * - Accessible, keyboard-navigable modal controller
 */

import { paginateBook } from './pagination.js';

/**
 * Builds deterministic Table of Contents data from verified book content and active pagination.
 * 
 * @param {Object} contentData - Raw book content ({ id, title, author, chapters })
 * @param {Object} pagination - Pagination instance from paginateBook
 * @param {number} currentChapterNumber - Active chapter number being read
 * @returns {Object} Structured Table of Contents metadata
 */
export function buildTableOfContentsData(contentData, pagination, currentChapterNumber = 1) {
  if (!contentData || !Array.isArray(contentData.chapters) || contentData.chapters.length === 0) {
    return {
      bookId: contentData?.id || '',
      bookTitle: contentData?.title || 'Untitled',
      author: contentData?.author || 'Unknown Author',
      totalPages: pagination?.totalPages || 0,
      currentChapterNumber: null,
      chapters: []
    };
  }

  const totalPages = pagination?.totalPages || 1;
  const seenNumbers = new Set();
  const chapters = [];

  for (let idx = 0; idx < contentData.chapters.length; idx++) {
    const ch = contentData.chapters[idx];
    if (!ch || typeof ch !== 'object') continue;

    const chapterNumber = typeof ch.number === 'number' ? ch.number : (idx + 1);
    if (seenNumbers.has(chapterNumber)) continue;
    seenNumbers.add(chapterNumber);

    const chapterTitle = (typeof ch.title === 'string' && ch.title.trim())
      ? ch.title.trim()
      : `Chapter ${chapterNumber}`;

    // Get exact first page number from pagination instance
    let firstPageNumber = 1;
    if (pagination && typeof pagination.getFirstPageOfChapter === 'function') {
      firstPageNumber = pagination.getFirstPageOfChapter(chapterNumber);
    } else if (pagination && Array.isArray(pagination.pages)) {
      const p = pagination.pages.find((page) => page.chapterNumber === chapterNumber);
      if (p && typeof p.pageNumber === 'number') {
        firstPageNumber = p.pageNumber;
      }
    }

    const isCurrent = chapterNumber === currentChapterNumber;

    // Zero-pad chapter number if 1-99
    const formattedNum = chapterNumber < 10 ? `0${chapterNumber}` : `${chapterNumber}`;
    const formattedPage = firstPageNumber < 10 ? `0${firstPageNumber}` : `${firstPageNumber}`;

    chapters.push({
      chapterIndex: idx,
      chapterNumber,
      formattedNumber: formattedNum,
      chapterTitle,
      firstPageNumber,
      formattedPageNumber: formattedPage,
      isCurrent
    });
  }

  return {
    bookId: contentData.id || '',
    bookTitle: contentData.title || 'Untitled',
    author: contentData.author || 'Unknown Author',
    totalPages,
    currentChapterNumber,
    chapters
  };
}

/**
 * Renders the Table of Contents HTML markup.
 * 
 * @param {Object} tocData - Output from buildTableOfContentsData
 * @returns {string} HTML string
 */
export function renderTableOfContentsHTML(tocData) {
  const { bookTitle, author, chapters = [] } = tocData;

  return `
    <div class="toc-modal-backdrop" id="tocBackdrop" role="dialog" aria-modal="true" aria-labelledby="tocHeading">
      <div class="toc-modal-paper reveal-layer-1">
        
        <!-- Modal Top Bar -->
        <div class="toc-modal-header">
          <div class="toc-book-provenance">
            <span class="toc-book-title">${escapeHtml(bookTitle)}</span>
            <span class="toc-author-sep">·</span>
            <span class="toc-book-author">by ${escapeHtml(author)}</span>
          </div>
          <button class="toc-close-btn" id="tocCloseBtn" aria-label="Close Table of Contents (Esc)" title="Close (Esc)">✕</button>
        </div>

        <!-- Book Contents Heading -->
        <div class="toc-title-group">
          <div class="toc-kicker">TABLE OF CONTENTS</div>
          <h2 class="toc-main-heading" id="tocHeading">Contents</h2>
          <div class="toc-rule-ornament" aria-hidden="true">
            <span class="rule-line"></span>
            <span class="rule-symbol">❧</span>
            <span class="rule-line"></span>
          </div>
        </div>

        <!-- Chapter Folio List -->
        <nav class="toc-folio-nav" aria-label="Book Chapters">
          <ul class="toc-chapter-list" role="list">
            ${chapters.map((ch) => `
              <li class="toc-chapter-item ${ch.isCurrent ? 'is-current-chapter' : ''}" role="listitem">
                <button 
                  class="toc-row-btn ${ch.isCurrent ? 'is-active' : ''}" 
                  data-action="jump-chapter" 
                  data-chapter-number="${ch.chapterNumber}" 
                  data-page-number="${ch.firstPageNumber}"
                  aria-label="${escapeHtml(ch.chapterTitle)}, Page ${ch.firstPageNumber}${ch.isCurrent ? ' (Current Chapter)' : ''}"
                  ${ch.isCurrent ? 'aria-current="location"' : ''}
                >
                  <span class="toc-num" aria-hidden="true">${escapeHtml(ch.formattedNumber)}</span>
                  <span class="toc-title-text">${escapeHtml(ch.chapterTitle)}</span>
                  <span class="toc-leader-dots" aria-hidden="true"></span>
                  <span class="toc-page-num">${escapeHtml(ch.formattedPageNumber)}</span>
                  ${ch.isCurrent ? `<span class="toc-current-marker" title="Currently reading">← current</span>` : ''}
                </button>
              </li>
            `).join('')}
          </ul>
        </nav>

        <!-- Modal Footer -->
        <div class="toc-modal-footer">
          <span class="toc-footer-hint">Click any chapter or press Esc to return to reading</span>
        </div>

      </div>
    </div>
  `;
}

/**
 * Displays the Table of Contents modal and binds keyboard & click event listeners.
 * 
 * @param {Object} params
 * @param {Object} params.contentData - Raw book content
 * @param {Object} params.pagination - Active pagination instance
 * @param {number} params.currentChapterNumber - Current chapter number
 * @param {Function} params.onSelectChapter - Callback when a chapter is clicked ({ chapterNumber, pageNumber })
 * @param {Function} params.onClose - Callback when modal is dismissed
 */
export function showTableOfContentsModal({
  contentData,
  pagination,
  currentChapterNumber = 1,
  onSelectChapter = () => {},
  onClose = () => {}
}) {
  // Remove any existing TOC modal
  const existing = document.getElementById('tocBackdrop');
  if (existing) existing.remove();

  const tocData = buildTableOfContentsData(contentData, pagination, currentChapterNumber);
  const modalContainer = document.createElement('div');
  modalContainer.id = 'nookTocModalWrapper';
  modalContainer.innerHTML = renderTableOfContentsHTML(tocData);
  document.body.appendChild(modalContainer);

  const backdrop = modalContainer.querySelector('#tocBackdrop');
  const closeBtn = modalContainer.querySelector('#tocCloseBtn');
  const chapterButtons = Array.from(modalContainer.querySelectorAll('[data-action="jump-chapter"]'));

  // Trap focus & focus active/first button
  const currentBtn = chapterButtons.find((b) => b.classList.contains('is-active')) || chapterButtons[0];
  if (currentBtn) {
    setTimeout(() => currentBtn.focus(), 50);
  }

  function cleanup() {
    document.removeEventListener('keydown', handleKeyDown);
    if (modalContainer && modalContainer.parentNode) {
      modalContainer.remove();
    }
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIdx = chapterButtons.indexOf(document.activeElement);
      if (currentIdx !== -1) {
        const nextIdx = e.key === 'ArrowDown'
          ? (currentIdx + 1) % chapterButtons.length
          : (currentIdx - 1 + chapterButtons.length) % chapterButtons.length;
        chapterButtons[nextIdx]?.focus();
      }
    }
  }

  document.addEventListener('keydown', handleKeyDown);

  if (closeBtn) {
    closeBtn.addEventListener('click', () => cleanup());
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cleanup();
      }
    });
  }

  chapterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const chNum = parseInt(btn.getAttribute('data-chapter-number'), 10) || 1;
      const pgNum = parseInt(btn.getAttribute('data-page-number'), 10) || 1;
      cleanup();
      onSelectChapter({ chapterNumber: chNum, pageNumber: pgNum });
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
