/**
 * Nook Rendered DOM Progressive Measurement Pagination Engine
 * 
 * Features:
 * - Real rendered DOM height progressive measurement (#nook-pagination-measurer)
 * - 5.5" × 8.5" (11:17) true physical novel page aspect ratio
 * - Continuous paragraph and sentence packing until vertical content area is exhausted
 * - Natural word-boundary binary search for long paragraph splitting
 * - Chapter opening headers vs standard running headers distinction
 * - Deterministic layout simulator fallback for Node.js / headless test environments
 * - Memory caching per book + font size for instantaneous navigation
 */

// Shared Typography & Geometry Constants for 5.5" × 8.5" (11:17) Paperback Page
export const TYPOGRAPHY_CONFIG = {
  sm: {
    fontSizePx: 14.5,
    lineHeightPx: 23,
    charsPerLine: 64,
    wordsPerLine: 11.5,
    pageLineBudget: 27,
    chapter1LineBudget: 17,
    paragraphGapLines: 0.6,
  },
  md: {
    fontSizePx: 16.0,
    lineHeightPx: 26,
    charsPerLine: 58,
    wordsPerLine: 10.2,
    pageLineBudget: 23,
    chapter1LineBudget: 14,
    paragraphGapLines: 0.6,
  },
  lg: {
    fontSizePx: 17.5,
    lineHeightPx: 29.5,
    charsPerLine: 52,
    wordsPerLine: 9.0,
    pageLineBudget: 20,
    chapter1LineBudget: 12,
    paragraphGapLines: 0.6,
  },
};

// In-memory pagination cache: `bookId_fontSize` -> pagination object
const paginationCache = new Map();

/**
 * Escapes HTML characters for safe template insertion in DOM measurer.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Gets or creates the hidden offscreen measurement container in the browser DOM.
 */
function getOrCreateMeasurer(fontSize = 'md') {
  if (typeof document === 'undefined') return null;

  let measurer = document.getElementById('nook-pagination-measurer');
  if (!measurer) {
    measurer = document.createElement('div');
    measurer.id = 'nook-pagination-measurer';
    measurer.setAttribute('aria-hidden', 'true');
    measurer.style.position = 'fixed';
    measurer.style.top = '-99999px';
    measurer.style.left = '-99999px';
    measurer.style.visibility = 'hidden';
    measurer.style.pointerEvents = 'none';
    measurer.style.zIndex = '-9999';
    document.body.appendChild(measurer);
  }

  // Ensure classes match visible .reader-paper-page
  measurer.className = `reader-paper-page reader-paper-measurer font-${fontSize}`;

  return measurer;
}

/**
 * Measures whether given HTML content fits inside the 5.5" x 8.5" physical page measurer.
 * 
 * @param {HTMLElement} measurer 
 * @param {string} headerHtml 
 * @param {Array<Object>} paragraphUnits 
 * @param {string} fontSize 
 * @param {boolean} isChapterFirstPage 
 * @returns {boolean} True if content fits within available page height
 */
function checkDomFit(measurer, headerHtml, paragraphUnits, fontSize, isChapterFirstPage) {
  if (!measurer) return false;

  const proseClass = `reader-prose font-${fontSize} ${isChapterFirstPage ? 'is-chapter-start' : ''}`;
  const paragraphsHtml = paragraphUnits.map((u, idx) => {
    const isFirst = idx === 0 && isChapterFirstPage && !u.isContinuation;
    const dropCapClass = isFirst ? 'has-drop-cap' : '';
    const contClass = u.isContinuation ? 'is-para-continuation' : '';
    return `<p class="${dropCapClass} ${contClass}">${escapeHtml(u.text)}</p>`;
  }).join('');

  measurer.innerHTML = `
    <div class="reader-paper-spine-shadow" aria-hidden="true"></div>
    ${headerHtml}
    <article class="${proseClass}">
      ${paragraphsHtml}
    </article>
    <div class="reader-paper-footer-row" aria-label="Page navigation">
      <button class="reader-paper-corner-nav prev-corner" aria-label="Previous page"><span class="corner-nav-arrow">←</span></button>
      <div class="reader-paper-page-number" aria-hidden="true">— 1 —</div>
      <button class="reader-paper-corner-nav next-corner" aria-label="Next page"><span class="corner-nav-arrow">→</span></button>
    </div>
  `;

  const clientH = measurer.clientHeight || 848;
  const scrollH = measurer.scrollHeight;
  const proseEl = measurer.querySelector('.reader-prose');
  const lastPara = proseEl ? proseEl.querySelector('p:last-of-type') : null;
  const proseBottom = proseEl ? (proseEl.offsetTop + proseEl.offsetHeight) : 0;
  const lastParaBottom = lastPara ? (lastPara.offsetTop + lastPara.offsetHeight) : proseBottom;

  // The 48px corner navigation arrows and folio sit at bottom: 16px (top of footer is clientH - 64).
  // Readable text must strictly end above this reserved footer zone with guaranteed generous whitespace (at or above clientH - 110).
  const maxAllowedBottom = clientH - 110;

  return scrollH <= clientH && proseBottom <= maxAllowedBottom && lastParaBottom <= maxAllowedBottom;
}

/**
 * Node.js / Headless simulation fallback estimator when window/document is unavailable.
 */
function estimateLinesForText(text, typo) {
  if (!text) return 0;
  const len = text.length;
  if (len === 0) return 0;

  // Fast word counting without intermediate array allocations
  let wordCount = 0;
  let inWord = false;
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    if (code > 32) {
      if (!inWord) {
        wordCount++;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }

  if (wordCount === 0) return 0;
  const linesByChars = len / typo.charsPerLine;
  const linesByWords = wordCount / typo.wordsPerLine;
  return Math.max(1, Math.ceil(Math.max(linesByChars, linesByWords) * 0.98));
}

const ABBREVIATIONS = new Set([
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'st.', 'lord.', 'lady.',
  'rev.', 'gen.', 'col.', 'capt.', 'lt.', 'maj.', 'sgt.', 'no.', 'vol.',
  'jan.', 'feb.', 'mar.', 'apr.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.',
  'vs.', 'etc.', 'i.e.', 'e.g.', 'cf.', 'al.', 'esq.'
]);

/**
 * Checks whether a word ends a sentence (. ! ?), ignoring standard abbreviations.
 */
function isSentenceEnding(word) {
  if (!word) return false;
  const clean = word.trim().toLowerCase();
  const cleanBase = clean.replace(/['"”’»\)\]]+$/, '');
  if (ABBREVIATIONS.has(cleanBase)) return false;
  if (/^[a-z]\.$/i.test(cleanBase)) return false;
  return /[.!?]['"”’»\)\]]*$/.test(word);
}

/**
 * Checks whether a word ends a major clause (; : — – --).
 */
function isClauseEnding(word) {
  if (!word) return false;
  return /[;:—–]['"”’»\)\]]*$/.test(word) || word.endsWith('--');
}

/**
 * Intelligently refines the maximum fitting word count to eliminate orphan / tiny fragments
 * at the bottom of pages, preferring natural sentence boundaries and clause boundaries.
 * 
 * @param {Array<string>} words - All words in the current remaining paragraph
 * @param {number} maxFittingWords - Maximum words that physically fit vertically
 * @param {boolean} hasPriorContentOnPage - Whether the page already contains preceding paragraphs
 * @returns {number} Refined word count (<= maxFittingWords)
 */
function refineFittingWordCount(words, maxFittingWords, hasPriorContentOnPage) {
  if (maxFittingWords <= 0) return 0;
  if (maxFittingWords >= words.length) return words.length;

  // 1. Orphan paragraph start at page bottom:
  // If the page already has content and fewer than 12 words fit (or < 65 chars),
  // do not leave a 1-line orphan at the page bottom. Move the paragraph to the next page.
  const fittingSlice = words.slice(0, maxFittingWords);
  const fittingText = fittingSlice.join(' ');
  if (hasPriorContentOnPage && (maxFittingWords < 12 || fittingText.length < 65)) {
    return 0;
  }

  // 2. Find sentence boundaries within fitting slice
  const sentenceEnds = [];
  for (let i = 0; i < maxFittingWords; i++) {
    if (isSentenceEnding(words[i])) {
      sentenceEnds.push(i);
    }
  }

  // 3. Sentence-Aware Evaluation
  if (sentenceEnds.length > 0) {
    const lastSentenceEnd = sentenceEnds[sentenceEnds.length - 1];
    const trailingWords = maxFittingWords - 1 - lastSentenceEnd;
    const trailingText = words.slice(lastSentenceEnd + 1, maxFittingWords).join(' ');

    if (trailingWords === 0) {
      // Exactly ends on a sentence boundary
      // Check widow on next page: if next page only gets 1-3 words of paragraph
      const remainingWordsCount = words.length - maxFittingWords;
      if (remainingWordsCount > 0 && remainingWordsCount < 4 && sentenceEnds.length >= 2) {
        const prevSentenceEnd = sentenceEnds[sentenceEnds.length - 2];
        const prevCandidate = prevSentenceEnd + 1;
        if (prevCandidate >= 12 || !hasPriorContentOnPage) {
          return prevCandidate;
        }
      }
      return maxFittingWords;
    }

    // Trailing fragment after last complete sentence
    // Orphan threshold: fewer than 10 words OR fewer than 55 characters
    if (trailingWords < 10 || trailingText.length < 55) {
      const candidateCount = lastSentenceEnd + 1;
      if (candidateCount >= 12 || !hasPriorContentOnPage) {
        return candidateCount;
      }
      if (hasPriorContentOnPage) {
        return 0; // Flush page so paragraph starts clean
      }
    }

    // If trailing words >= 10, check widow on next page
    const remainingWordsCount = words.length - maxFittingWords;
    if (remainingWordsCount > 0 && remainingWordsCount < 4) {
      const candidateCount = lastSentenceEnd + 1;
      if (candidateCount >= 12 || !hasPriorContentOnPage) {
        return candidateCount;
      }
    }

    // Check clause boundaries in trailing fragment
    const clauseEnds = [];
    for (let i = lastSentenceEnd + 1; i < maxFittingWords; i++) {
      if (isClauseEnding(words[i])) clauseEnds.push(i);
    }
    if (clauseEnds.length > 0) {
      const lastClauseEnd = clauseEnds[clauseEnds.length - 1];
      const trailingAfterClause = maxFittingWords - 1 - lastClauseEnd;
      if (trailingAfterClause > 0 && trailingAfterClause < 4) {
        const candidate = lastClauseEnd + 1;
        if (candidate >= 12 || !hasPriorContentOnPage) {
          return candidate;
        }
      }
    }

    return maxFittingWords;
  }

  // 4. No complete sentence in fitting slice (e.g. single long sentence or continuation)
  if (hasPriorContentOnPage && (maxFittingWords < 12 || fittingText.length < 65)) {
    return 0; // Flush page to allow sentence room at top of next page
  }

  // Check for clause boundaries
  const clauseEnds = [];
  for (let i = 0; i < maxFittingWords; i++) {
    if (isClauseEnding(words[i])) clauseEnds.push(i);
  }

  if (clauseEnds.length > 0) {
    const lastClauseEnd = clauseEnds[clauseEnds.length - 1];
    const trailingAfterClause = maxFittingWords - 1 - lastClauseEnd;
    if (trailingAfterClause > 0 && trailingAfterClause < 4) {
      const candidate = lastClauseEnd + 1;
      if (candidate >= 12 || !hasPriorContentOnPage) {
        return candidate;
      }
    }
  }

  // Widow check on next page for long sentence
  const remainingWordsCount = words.length - maxFittingWords;
  if (remainingWordsCount > 0 && remainingWordsCount < 4 && clauseEnds.length > 0) {
    const lastClauseEnd = clauseEnds[clauseEnds.length - 1];
    const candidate = lastClauseEnd + 1;
    if (candidate >= 12 || !hasPriorContentOnPage) {
      return candidate;
    }
  }

  return maxFittingWords;
}

/**
 * Paginates a single chapter using either DOM progressive measurement (Browser)
 * or deterministic layout budget simulation (Node.js).
 */
function paginateChapter(chapter, chapIdx, bookTitle, authorName, fontSize, measurer) {
  const chapNumber = chapter.number || chapIdx + 1;
  const chapTitle = chapter.title || `Chapter ${chapNumber}`;
  const typo = TYPOGRAPHY_CONFIG[fontSize] || TYPOGRAPHY_CONFIG.md;

  const rawParagraphs = (chapter.content || '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (rawParagraphs.length === 0) {
    return [{
      chapterIndex: chapIdx,
      chapterNumber: chapNumber,
      chapterTitle: chapTitle,
      paragraphs: [''],
      paragraphUnits: [{ text: '', isContinuation: false, continuedOnNext: false }],
      isFirstPageOfChapter: true,
      wordCount: 0,
    }];
  }

  const chapterOpeningHeaderHtml = `
    <header class="reader-prose-header">
      <div class="reader-ornament" aria-hidden="true">❦</div>
      <h1 class="reader-prose-chapter-title">${escapeHtml(chapTitle)}</h1>
      <div class="reader-prose-book-title">${escapeHtml(bookTitle)}</div>
      <div class="reader-prose-author">by ${escapeHtml(authorName)}</div>
      <div class="reader-divider" aria-hidden="true"></div>
    </header>
  `;

  const runningHeaderHtml = `
    <div class="reader-page-running-header" aria-hidden="true">
      <span class="reader-running-title">${escapeHtml(bookTitle)}</span>
      <span class="reader-running-sep">·</span>
      <span class="reader-running-chapter">${escapeHtml(chapTitle)}</span>
    </div>
  `;

  const pages = [];
  let currentPageUnits = [];
  let isFirstPage = true;

  function getHeaderHtml() {
    return isFirstPage ? chapterOpeningHeaderHtml : runningHeaderHtml;
  }

  function getSimulationBudget() {
    return isFirstPage ? typo.chapter1LineBudget : typo.pageLineBudget;
  }

  function flushPage() {
    if (currentPageUnits.length === 0) return;
    const pageWords = currentPageUnits.reduce((acc, u) => acc + u.text.split(/\s+/).filter(Boolean).length, 0);
    pages.push({
      chapterIndex: chapIdx,
      chapterNumber: chapNumber,
      chapterTitle: chapTitle,
      paragraphs: currentPageUnits.map((u) => u.text),
      paragraphUnits: [...currentPageUnits],
      isFirstPageOfChapter: isFirstPage,
      wordCount: pageWords,
    });
    currentPageUnits = [];
    isFirstPage = false;
  }

  function testFit(candidateUnits) {
    if (measurer) {
      return checkDomFit(measurer, getHeaderHtml(), candidateUnits, fontSize, isFirstPage);
    }
    // Simulation fallback for Node.js test environment
    const totalLines = candidateUnits.reduce((acc, u, idx) => {
      const lines = estimateLinesForText(u.text, typo);
      const gap = idx > 0 ? typo.paragraphGapLines : 0;
      return acc + lines + gap;
    }, 0);
    return totalLines <= getSimulationBudget();
  }

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    let remainingParaText = rawParagraphs[pIdx];
    let isParaContinuation = false;

    while (remainingParaText.length > 0) {
      // 1. Test if the entire remaining paragraph fits on the current page
      const candidateWhole = [
        ...currentPageUnits,
        { text: remainingParaText, isContinuation: isParaContinuation, continuedOnNext: false, originalParaIndex: pIdx }
      ];

      if (testFit(candidateWhole)) {
        currentPageUnits.push({
          text: remainingParaText,
          isContinuation: isParaContinuation,
          continuedOnNext: false,
          originalParaIndex: pIdx,
        });
        remainingParaText = '';
        break;
      }

      // 2. The entire paragraph does not fit. Can a portion (words) fit in remaining page space?
      const words = remainingParaText.split(/\s+/).filter(Boolean);

      // If current page already has content, test if even the first word fits
      if (currentPageUnits.length > 0) {
        const testMinimal = [
          ...currentPageUnits,
          { text: words[0], isContinuation: isParaContinuation, continuedOnNext: true, originalParaIndex: pIdx }
        ];
        if (!testFit(testMinimal)) {
          // Even 1 word cannot fit in remaining space. Flush current page and start on fresh page!
          flushPage();
          continue;
        }
      }

      // 3. Binary search for maximum number of words that fit on current page
      let low = 1;
      let high = words.length;
      let bestFittingWordCount = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const testText = words.slice(0, mid).join(' ');
        const candidateSlice = [
          ...currentPageUnits,
          { text: testText, isContinuation: isParaContinuation, continuedOnNext: true, originalParaIndex: pIdx }
        ];

        if (testFit(candidateSlice)) {
          bestFittingWordCount = mid;
          low = mid + 1; // Try to fit more words
        } else {
          high = mid - 1; // Exceeded height, reduce words
        }
      }

      // 4. Intelligently refine the split boundary to avoid orphan / tiny trailing fragments
      let refinedWordCount = bestFittingWordCount;
      if (bestFittingWordCount > 0 && bestFittingWordCount < words.length) {
        refinedWordCount = refineFittingWordCount(
          words,
          bestFittingWordCount,
          currentPageUnits.length > 0
        );
      }

      if (refinedWordCount > 0) {
        const fittingWords = words.slice(0, refinedWordCount);
        const remainingWords = words.slice(refinedWordCount);

        currentPageUnits.push({
          text: fittingWords.join(' '),
          isContinuation: isParaContinuation,
          continuedOnNext: remainingWords.length > 0,
          originalParaIndex: pIdx,
        });

        flushPage();
        remainingParaText = remainingWords.join(' ').trim();
        isParaContinuation = true;
      } else {
        // If refinedWordCount is 0 (or bestFittingWordCount was 0):
        // If current page has prior content, flush current page so paragraph can start cleanly on next page
        if (currentPageUnits.length > 0) {
          flushPage();
        } else {
          // On an empty page, we must take at least something to make forward progress
          const fallbackCount = Math.max(1, bestFittingWordCount);
          currentPageUnits.push({
            text: words.slice(0, fallbackCount).join(' '),
            isContinuation: isParaContinuation,
            continuedOnNext: words.length > fallbackCount,
            originalParaIndex: pIdx,
          });
          flushPage();
          remainingParaText = words.slice(fallbackCount).join(' ').trim();
          isParaContinuation = true;
        }
      }
    }
  }

  // Flush remaining content on final page of chapter
  if (currentPageUnits.length > 0) {
    flushPage();
  }

  return pages;
}

/**
 * Paginates a book's full content data into deterministic digital pages.
 * 
 * @param {Object} contentData - Full content payload with chapters array
 * @param {string} fontSize - 'sm' | 'md' | 'lg'
 * @param {Object} [options] - Optional settings { forceRepaginate: boolean }
 * @returns {Object} Pagination structure with totalPages, pages array, and lookup helpers
 */
export function paginateBook(contentData, fontSize = 'md', options = {}) {
  if (!contentData || !Array.isArray(contentData.chapters) || contentData.chapters.length === 0) {
    return {
      totalPages: 1,
      pages: [{
        pageIndex: 0,
        pageNumber: 1,
        chapterIndex: 0,
        chapterNumber: 1,
        chapterTitle: 'Chapter 1',
        chapterPageNumber: 1,
        chapterTotalPages: 1,
        paragraphs: ['No content available.'],
        paragraphUnits: [{ text: 'No content available.', isContinuation: false, continuedOnNext: false }],
        isFirstPageOfChapter: true,
        wordCount: 3,
        startWordIndex: 0,
      }],
      chapterPageMap: [1],
      getPage: () => null,
      getPageForChapter: () => null,
      getPageForProgressPercent: () => 1,
    };
  }

  const bookId = contentData.id || contentData.title || 'nook_book';
  const cacheKey = `${bookId}_${fontSize}`;

  if (!options.forceRepaginate && paginationCache.has(cacheKey)) {
    return paginationCache.get(cacheKey);
  }

  const bookTitle = contentData.title || 'Untitled';
  const authorName = contentData.author || 'Unknown Author';
  const measurer = getOrCreateMeasurer(fontSize);

  const rawPages = [];
  let cumulativeWordCount = 0;
  const chapterPageMap = []; // chapterIndex -> first global pageNumber

  contentData.chapters.forEach((chapter, chapIdx) => {
    const firstPageOfThisChapter = rawPages.length + 1;
    chapterPageMap.push(firstPageOfThisChapter);

    const chapPages = paginateChapter(chapter, chapIdx, bookTitle, authorName, fontSize, measurer);
    const chapTotalPages = chapPages.length;

    chapPages.forEach((cp, cpIdx) => {
      rawPages.push({
        chapterIndex: chapIdx,
        chapterNumber: cp.chapterNumber,
        chapterTitle: cp.chapterTitle,
        chapterPageNumber: cpIdx + 1,
        chapterTotalPages: chapTotalPages,
        paragraphs: cp.paragraphs,
        paragraphUnits: cp.paragraphUnits,
        isFirstPageOfChapter: cp.isFirstPageOfChapter,
        wordCount: cp.wordCount,
        startWordIndex: cumulativeWordCount,
      });
      cumulativeWordCount += cp.wordCount;
    });
  });

  const totalPages = Math.max(1, rawPages.length);

  // Assign global pageNumbers (1-indexed) and pageIndex (0-indexed)
  const pages = rawPages.map((page, idx) => ({
    ...page,
    pageIndex: idx,
    pageNumber: idx + 1,
    totalPages: totalPages,
  }));

  const paginationResult = {
    totalPages,
    pages,
    chapterPageMap,
    fontSize,
    totalWords: cumulativeWordCount,
    getPage(pageNumber) {
      const cleanNum = Math.max(1, Math.min(totalPages, Number(pageNumber) || 1));
      return pages[cleanNum - 1];
    },
    getFirstPageOfChapter(chapterNumber) {
      const found = pages.find((p) => p.chapterNumber === chapterNumber);
      if (found) return found.pageNumber;
      const idx = Number(chapterNumber) - 1;
      return chapterPageMap[idx] || 1;
    },
    getPageForChapter(chapterIndex, chapterPageNumber = 1) {
      const firstPageNum = chapterPageMap[chapterIndex] || 1;
      const targetPageNum = Math.min(totalPages, firstPageNum + (chapterPageNumber - 1));
      return pages[targetPageNum - 1];
    },
    getPageForWordOffset(wordOffset) {
      if (!wordOffset || wordOffset <= 0) return pages[0];
      let target = pages[0];
      for (const p of pages) {
        if (p.startWordIndex <= wordOffset) {
          target = p;
        } else {
          break;
        }
      }
      return target;
    },
    getProgressPercentage(pageNumber) {
      const cleanNum = Math.max(1, Math.min(totalPages, Number(pageNumber) || 1));
      return Math.round((cleanNum / totalPages) * 100);
    },
    getProgressPercentForPage(pageNumber) {
      const cleanNum = Math.max(1, Math.min(totalPages, Number(pageNumber) || 1));
      return Math.round((cleanNum / totalPages) * 100);
    },
    getPageNumberForProgress(percent) {
      const p = Math.max(0, Math.min(100, Number(percent) || 0));
      return Math.max(1, Math.min(totalPages, Math.round((p / 100) * totalPages) || 1));
    },
    getPageForProgressPercent(percent) {
      const p = Math.max(0, Math.min(100, Number(percent) || 0));
      const targetNum = Math.max(1, Math.min(totalPages, Math.round((p / 100) * totalPages) || 1));
      return pages[targetNum - 1];
    },
  };

  paginationCache.set(cacheKey, paginationResult);
  return paginationResult;
}

/**
 * Clears pagination cache (useful when hot-reloading or changing layout).
 */
export function clearPaginationCache() {
  paginationCache.clear();
}
