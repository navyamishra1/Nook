import fs from 'fs';

// Accurate vertical-height / line-capacity model for 5.5" x 8.5" physical novel page
// Page outer: 550px wide x 850px tall (aspect 11:17)
// Margins: top 56px, bottom 64px, sides 52px => Prose width: 446px, height: 730px
// Line height at 16px font: 26px (~1.62 line-height)
// Available lines: ~27-28 lines per standard page, ~19-20 lines on Chapter Page 1

export const TYPOGRAPHY_CONFIG = {
  sm: {
    fontSize: 14.5,
    lineHeight: 23,
    charsPerLine: 64,
    wordsPerLine: 11.5,
    pageLineBudget: 30,
    chapter1LineBudget: 22,
    paragraphGapLines: 0.6,
  },
  md: {
    fontSize: 16,
    lineHeight: 26,
    charsPerLine: 58,
    wordsPerLine: 10.2,
    pageLineBudget: 26,
    chapter1LineBudget: 19,
    paragraphGapLines: 0.6,
  },
  lg: {
    fontSize: 17.5,
    lineHeight: 29.5,
    charsPerLine: 52,
    wordsPerLine: 9.0,
    pageLineBudget: 23,
    chapter1LineBudget: 16,
    paragraphGapLines: 0.6,
  },
};

/**
 * Estimate the number of lines a piece of text will occupy at the given typography config.
 */
function estimateLinesForText(text, typo) {
  if (!text || !text.trim()) return 0;
  // Count words and characters
  const trimmed = text.trim();
  const charCount = trimmed.length;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  
  // Use a blended character and word estimation to accurately model proportional typesetting
  const linesByChars = charCount / typo.charsPerLine;
  const linesByWords = wordCount / typo.wordsPerLine;
  const estimatedLines = Math.ceil(Math.max(linesByChars, linesByWords) * 0.98);
  return Math.max(1, estimatedLines);
}

/**
 * Splits text into sentences.
 */
function splitIntoSentences(text) {
  if (!text) return [];
  // Match sentences ending in punctuation or quotes, or the final remaining chunk
  const matches = text.match(/[^.!?]+[.!?]+(?:["'”’\s]+|$)|[^.!?]+$/g);
  if (!matches || matches.length === 0) return [text];
  return matches.map(s => s.trim()).filter(Boolean);
}

/**
 * Continuously flows chapter paragraphs across 5.5" x 8.5" novel pages.
 */
export function flowChapterPages(chapter, chapIdx, typo) {
  const chapNumber = chapter.number || chapIdx + 1;
  const chapTitle = chapter.title || `Chapter ${chapNumber}`;
  
  const rawParagraphs = (chapter.content || '')
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (rawParagraphs.length === 0) {
    return [{
      chapterIndex: chapIdx,
      chapterNumber: chapNumber,
      chapterTitle: chapTitle,
      paragraphs: [''],
      paragraphUnits: [{ text: '', isContinuation: false, continuedOnNext: false }],
      isFirstPageOfChapter: true,
      wordCount: 0,
      linesUsed: 0,
      linesBudget: typo.chapter1LineBudget,
    }];
  }

  const pages = [];
  let currentPageUnits = [];
  let currentLinesUsed = 0;
  let isFirstPage = true;

  function getRemainingLines() {
    const budget = isFirstPage ? typo.chapter1LineBudget : typo.pageLineBudget;
    return Math.max(0, budget - currentLinesUsed);
  }

  function getPageBudget() {
    return isFirstPage ? typo.chapter1LineBudget : typo.pageLineBudget;
  }

  function flushPage() {
    if (currentPageUnits.length === 0) return;
    const pageWords = currentPageUnits.reduce((acc, u) => acc + (u.text.split(/\s+/).filter(Boolean).length), 0);
    pages.push({
      chapterIndex: chapIdx,
      chapterNumber: chapNumber,
      chapterTitle: chapTitle,
      paragraphs: currentPageUnits.map(u => u.text),
      paragraphUnits: [...currentPageUnits],
      isFirstPageOfChapter: isFirstPage,
      wordCount: pageWords,
      linesUsed: currentLinesUsed,
      linesBudget: getPageBudget(),
    });
    currentPageUnits = [];
    currentLinesUsed = 0;
    isFirstPage = false;
  }

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    const fullParagraphText = rawParagraphs[pIdx];
    let remainingParaText = fullParagraphText;
    let isParaContinuation = false;

    while (remainingParaText.length > 0) {
      const remainingLinesOnPage = getRemainingLines();
      const paraLinesNeeded = estimateLinesForText(remainingParaText, typo) + (currentPageUnits.length > 0 ? typo.paragraphGapLines : 0);

      // Case A: Entire remaining paragraph fits comfortably on the current page
      if (paraLinesNeeded <= remainingLinesOnPage) {
        currentPageUnits.push({
          text: remainingParaText,
          isContinuation: isParaContinuation,
          continuedOnNext: false,
          originalParaIndex: pIdx,
        });
        currentLinesUsed += paraLinesNeeded;
        remainingParaText = '';
        break;
      }

      // Case B: Entire paragraph cannot fit, but can we fit a portion (sentences) on this page?
      // If remaining page space is very tight (<= 2 lines) and we already have content on this page,
      // flush to start fresh on next page to avoid orphans
      if (remainingLinesOnPage <= 2 && currentPageUnits.length > 0) {
        flushPage();
        continue;
      }

      // Break remaining paragraph into sentences
      const sentences = splitIntoSentences(remainingParaText);
      
      let fittingSentences = [];
      let fittingLines = 0;
      let sentenceIndex = 0;

      for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
        const candidate = [...fittingSentences, sentences[sIdx]].join(' ');
        const candidateLines = estimateLinesForText(candidate, typo) + (currentPageUnits.length > 0 ? typo.paragraphGapLines : 0);
        
        if (candidateLines <= remainingLinesOnPage) {
          fittingSentences.push(sentences[sIdx]);
          fittingLines = candidateLines;
          sentenceIndex = sIdx + 1;
        } else {
          break;
        }
      }

      // If at least one sentence fit (or if page is empty and we must fit something)
      if (fittingSentences.length > 0) {
        const fittedText = fittingSentences.join(' ');
        const remainderText = sentences.slice(sentenceIndex).join(' ').trim();
        
        currentPageUnits.push({
          text: fittedText,
          isContinuation: isParaContinuation,
          continuedOnNext: remainderText.length > 0,
          originalParaIndex: pIdx,
        });
        currentLinesUsed += fittingLines;

        remainingParaText = remainderText;
        isParaContinuation = true;

        // Since this filled the available lines on the page, flush to next page
        flushPage();
      } else {
        // Even the single sentence was too long for the remaining lines
        // If current page already has content, flush it and try on the fresh next page
        if (currentPageUnits.length > 0) {
          flushPage();
        } else {
          // Fresh page, but single sentence is huge (e.g. 30 lines long sentence)
          // We must word-chunk this single sentence across pages
          const words = remainingParaText.split(/\s+/).filter(Boolean);
          const maxWordsForPage = Math.floor(getPageBudget() * typo.wordsPerLine * 0.95);
          const chunkWords = words.slice(0, maxWordsForPage);
          const remainderWords = words.slice(maxWordsForPage);

          const chunkText = chunkWords.join(' ');
          currentPageUnits.push({
            text: chunkText,
            isContinuation: isParaContinuation,
            continuedOnNext: remainderWords.length > 0,
            originalParaIndex: pIdx,
          });
          currentLinesUsed = getPageBudget();
          remainingParaText = remainderWords.join(' ').trim();
          isParaContinuation = true;
          flushPage();
        }
      }
    }
  }

  // Flush any remaining content on the final page of the chapter
  if (currentPageUnits.length > 0) {
    flushPage();
  }

  return pages;
}

// Test with Pride and Prejudice
const content = JSON.parse(fs.readFileSync('./frontend/data/books/pride-and-prejudice/content.json', 'utf8'));
const typo = TYPOGRAPHY_CONFIG.md;

let allPages = [];
content.chapters.forEach((ch, idx) => {
  const chPages = flowChapterPages(ch, idx, typo);
  chPages.forEach((cp, cpIdx) => {
    allPages.push({
      ...cp,
      chapterPageNumber: cpIdx + 1,
      chapterTotalPages: chPages.length,
      globalPageNumber: allPages.length + 1,
    });
  });
});

console.log(`\n=== Continuous Flow Pagination Test: Pride and Prejudice ===`);
console.log(`Total Global Pages: ${allPages.length}`);

for (let i = 18; i <= 26; i++) {
  const p = allPages[i - 1];
  console.log(`\nPage ${p.globalPageNumber} (Ch ${p.chapterNumber}, Page ${p.chapterPageNumber}/${p.chapterTotalPages}): ${p.paragraphs.length} blocks, ${p.wordCount} words, linesUsed: ${p.linesUsed.toFixed(1)} / ${p.linesBudget}`);
  p.paragraphUnits.forEach((u, uIdx) => {
    console.log(`  [${uIdx}] (cont: ${u.isContinuation}, next: ${u.continuedOnNext}): ${u.text.slice(0, 70)}...`);
  });
}
