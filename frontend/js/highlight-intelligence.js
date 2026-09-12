/**
 * Nook Highlight Intelligence Module
 * 
 * Provides:
 * - Deterministic, lightweight local NLP for extracting recurring literary themes from saved passages
 * - Thematic clustering, cross-book conceptual links, and recurring vocabulary
 * - Elegant literary stationery UI renderer for the Journal
 */

import { getBookById, getBookCoverUrl } from './catalog.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LITERARY_STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t',
  'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
  'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s',
  'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
  'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s',
  'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re',
  'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'said', 'one', 'upon', 'like', 'see', 'now', 'made',
  'well', 'must', 'even', 'know', 'come', 'came', 'went', 'much', 'many', 'shall', 'may', 'might', 'first',
  'say', 'said', 'says', 'look', 'looked', 'seemed', 'though', 'thought', 'man', 'men', 'way', 'time', 'two'
]);

/**
 * Tokenizes text into clean lowercase words, removing stopwords and punctuation.
 */
export function tokenizeHighlightText(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !LITERARY_STOPWORDS.has(w));
}

/**
 * Literary Theme Taxonomy & Keywords.
 */
export const THEME_TAXONOMY = [
  {
    id: 'isolation-solitude',
    title: 'Isolation & Solitude',
    description: 'Passages examining solitude, detachment, and the quiet inner contemplation of the individual.',
    keywords: ['isolation', 'solitude', 'lonely', 'alone', 'desert', 'exile', 'wilderness', 'silent', 'silence', 'secluded', 'solitary', 'cell', 'distance', 'desolate']
  },
  {
    id: 'ambition-creation',
    title: 'Ambition & Creation',
    description: 'Passages contemplating intellectual striving, scientific pursuit, and the weight of ambition.',
    keywords: ['ambition', 'science', 'creation', 'experiment', 'power', 'conquest', 'aspire', 'destiny', 'glory', 'invention', 'forbidden', 'knowledge', 'curiosity', 'labour']
  },
  {
    id: 'identity-transformation',
    title: 'Identity & Transformation',
    description: 'Passages reflecting on the self, transformation, and what constitutes our shared humanity.',
    keywords: ['identity', 'soul', 'becoming', 'mask', 'mirror', 'self', 'transformation', 'consciousness', 'nature', 'monster', 'creature', 'humanity', 'human', 'form', 'mind']
  },
  {
    id: 'love-devotion',
    title: 'Love & Devotion',
    description: 'Passages exploring tenderness, courtship, and profound emotional connection.',
    keywords: ['love', 'heart', 'affection', 'passion', 'courtship', 'marriage', 'devotion', 'tender', 'friendship', 'beloved', 'compassion', 'gentle', 'fondness', 'dear']
  },
  {
    id: 'society-propriety',
    title: 'Society, Class & Propriety',
    description: 'Passages observing social expectations, convention, reputation, and class tensions.',
    keywords: ['society', 'manners', 'pride', 'wealth', 'estate', 'reputation', 'scandal', 'class', 'convention', 'custom', 'fortune', 'prejudice', 'rank', 'fashion', 'world']
  },
  {
    id: 'mortality-time',
    title: 'Mortality, Time & Memory',
    description: 'Passages reflecting on the passage of time, remembrance, and the threshold of mortality.',
    keywords: ['death', 'mortality', 'grave', 'time', 'memory', 'shadow', 'decay', 'grief', 'eternity', 'ghost', 'tomb', 'perish', 'dead', 'passed', 'remembrance', 'loss']
  },
  {
    id: 'morality-conscience',
    title: 'Morality, Guilt & Conscience',
    description: 'Passages examining moral boundaries, remorse, justice, and the burden of conscience.',
    keywords: ['sin', 'guilt', 'conscience', 'justice', 'repentance', 'evil', 'virtue', 'wicked', 'confession', 'judgment', 'fault', 'duty', 'moral', 'wrong', 'horror']
  },
  {
    id: 'mystery-unknown',
    title: 'Mystery & the Unknown',
    description: 'Passages drawn to eerie atmospheres, hidden secrets, and enigmatic encounters.',
    keywords: ['mystery', 'secret', 'shadows', 'darkness', 'strange', 'clue', 'unseen', 'hidden', 'dread', 'curiosity', 'unsolved', 'phantom', 'night', 'terror', 'wonder']
  },
  {
    id: 'nature-sublime',
    title: 'Nature & the Sublime',
    description: 'Passages captivated by the grandeur of nature, atmospheric beauty, and awe.',
    keywords: ['mountain', 'ocean', 'sea', 'wind', 'stars', 'forest', 'storm', 'sun', 'sky', 'river', 'sublime', 'beauty', 'wonder', 'landscape', 'earth', 'majestic']
  }
];

/**
 * Analyzes reader highlights and derives literary themes and connections.
 * 
 * @param {Array<Object>} highlights - Collection of highlight objects
 * @param {Array<Object>} catalog - Verified book catalog
 * @returns {Object} Deterministic analysis results
 */
export function analyzeHighlights(highlights = [], catalog = []) {
  const safeHighlights = Array.isArray(highlights) ? highlights : [];
  const safeCatalog = Array.isArray(catalog) ? catalog : [];

  // Build catalog lookup map
  const catalogMap = new Map();
  for (const book of safeCatalog) {
    if (book && typeof book === 'object' && book.id) {
      catalogMap.set(book.id, book);
    }
  }

  // Filter and normalize valid highlight records with text
  const validHighlights = safeHighlights
    .map((h) => {
      if (!h || typeof h !== 'object') return null;
      const text = (typeof h.selectedText === 'string' && h.selectedText.trim()) ||
                   (typeof h.text === 'string' && h.text.trim()) || '';
      if (!text) return null;
      return {
        ...h,
        selectedText: text
      };
    })
    .filter(Boolean);

  if (validHighlights.length === 0) {
    return {
      hasData: false,
      highlightCount: 0,
      recurringTerms: [],
      themes: [],
      thematicSummary: '',
      bookConnections: [],
      highlightedBooks: []
    };
  }

  // 1. Token frequency across highlights
  const termCounts = new Map();
  const termBooks = new Map();

  for (const h of validHighlights) {
    const tokens = tokenizeHighlightText(h.selectedText);
    const uniqueTokensInHighlight = new Set(tokens);

    for (const token of uniqueTokensInHighlight) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);

      if (!termBooks.has(token)) termBooks.set(token, new Set());
      if (h.bookId) termBooks.get(token).add(h.bookId);
    }
  }

  const recurringTerms = Array.from(termCounts.entries())
    .map(([term, count]) => ({
      term,
      count,
      distinctBooksCount: termBooks.get(term)?.size || 0
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.term.localeCompare(b.term);
    })
    .slice(0, 12);

  // 2. Theme matching
  const themeMatches = [];

  for (const theme of THEME_TAXONOMY) {
    let matchCount = 0;
    const matchingHighlights = [];
    const matchedBookIds = new Set();
    const matchedKeywords = new Set();

    const kwSet = new Set(theme.keywords);

    for (const h of validHighlights) {
      const tokens = tokenizeHighlightText(h.selectedText);
      const foundInHighlight = tokens.filter((t) => kwSet.has(t));

      if (foundInHighlight.length > 0) {
        matchCount++;
        matchingHighlights.push({
          highlightId: h.id,
          bookId: h.bookId,
          bookTitle: h.bookTitle,
          author: h.author,
          chapterTitle: h.chapterTitle,
          pageNumber: h.pageNumber,
          snippet: h.selectedText.length > 140 ? h.selectedText.substring(0, 137) + '…' : h.selectedText
        });
        if (h.bookId) matchedBookIds.add(h.bookId);
        foundInHighlight.forEach((k) => matchedKeywords.add(k));
      }
    }

    if (matchCount > 0) {
      themeMatches.push({
        id: theme.id,
        title: theme.title,
        description: theme.description,
        count: matchCount,
        distinctBooksCount: matchedBookIds.size,
        keywords: Array.from(matchedKeywords).sort(),
        sampleHighlights: matchingHighlights.slice(0, 3)
      });
    }
  }

  // Sort themes by match count desc, then distinct books desc, then title asc
  themeMatches.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.distinctBooksCount !== a.distinctBooksCount) return b.distinctBooksCount - a.distinctBooksCount;
    return a.title.localeCompare(b.title);
  });

  const topThemes = themeMatches.slice(0, 4);

  // 3. Thematic summary sentence (strictly literary)
  let thematicSummary = '';
  if (topThemes.length === 1) {
    thematicSummary = `Your saved passages often center on questions of ${topThemes[0].title.toLowerCase()}.`;
  } else if (topThemes.length === 2) {
    thematicSummary = `Your saved passages frequently explore themes of ${topThemes[0].title.toLowerCase()} and ${topThemes[1].title.toLowerCase()}.`;
  } else if (topThemes.length >= 3) {
    thematicSummary = `Your saved passages often return to themes of ${topThemes[0].title.toLowerCase()}, ${topThemes[1].title.toLowerCase()}, and ${topThemes[2].title.toLowerCase()}.`;
  } else if (recurringTerms.length >= 2) {
    thematicSummary = `Your saved passages frequently return to motifs of ${recurringTerms.slice(0, 3).map((r) => `“${r.term}”`).join(', ')}.`;
  } else {
    thematicSummary = 'Your literary notebook reflects recurring moments of reflection and inquiry across your reading.';
  }

  // 4. Highlighted Books Summary
  const bookHighlightCounts = new Map();
  for (const h of validHighlights) {
    const bId = h.bookId;
    if (!bId) continue;
    if (!bookHighlightCounts.has(bId)) {
      const book = catalogMap.get(bId);
      bookHighlightCounts.set(bId, {
        id: bId,
        title: h.bookTitle || (book && book.title) || bId,
        author: h.author || (book && book.author) || 'Unknown Author',
        cover: (book && book.cover) || `assets/covers/${bId}.webp`,
        highlightCount: 0
      });
    }
    bookHighlightCounts.get(bId).highlightCount++;
  }

  const highlightedBooks = Array.from(bookHighlightCounts.values()).sort((a, b) => {
    if (b.highlightCount !== a.highlightCount) return b.highlightCount - a.highlightCount;
    return a.title.localeCompare(b.title);
  });

  // 5. Cross-book connections
  const bookConnections = [];
  const bookList = highlightedBooks.map((b) => b.id);

  for (let i = 0; i < bookList.length; i++) {
    for (let j = i + 1; j < bookList.length; j++) {
      const idA = bookList[i];
      const idB = bookList[j];

      const bookA = bookHighlightCounts.get(idA);
      const bookB = bookHighlightCounts.get(idB);

      // Check shared themes
      const sharedThemeTitles = topThemes
        .filter((t) => {
          const inA = t.sampleHighlights.some((s) => s.bookId === idA);
          const inB = t.sampleHighlights.some((s) => s.bookId === idB);
          return inA && inB;
        })
        .map((t) => t.title);

      // Check shared vocabulary terms
      const sharedTerms = recurringTerms
        .filter((r) => {
          const books = termBooks.get(r.term);
          return books && books.has(idA) && books.has(idB);
        })
        .map((r) => r.term);

      if (sharedThemeTitles.length > 0 || sharedTerms.length > 0) {
        bookConnections.push({
          bookA: { id: bookA.id, title: bookA.title, author: bookA.author, cover: bookA.cover },
          bookB: { id: bookB.id, title: bookB.title, author: bookB.author, cover: bookB.cover },
          sharedThemes: sharedThemeTitles,
          sharedTerms: sharedTerms.slice(0, 4)
        });
      }
    }
  }

  return {
    hasData: true,
    highlightCount: validHighlights.length,
    recurringTerms,
    themes: topThemes,
    thematicSummary,
    bookConnections: bookConnections.slice(0, 4),
    highlightedBooks
  };
}

/* ============================================================================
   HIGHLIGHT INTELLIGENCE UI RENDERER
   ============================================================================ */

/**
 * Renders the Highlight Intelligence section for the Journal view.
 */
export function renderHighlightIntelligenceHTML({ highlights = [], catalog = [] }) {
  const analysis = analyzeHighlights(highlights, catalog);

  if (!analysis.hasData) {
    return `
      <section class="highlight-intel-panel empty-intel" id="journalIntelPanel" aria-label="Highlight Intelligence">
        <div class="intel-kicker">LITERARY PATTERNS</div>
        <h2 class="intel-heading">What You've Been Returning To</h2>
        <p class="intel-empty-desc">
          Save a few passages while reading, and Nook will begin quietly noticing the recurring ideas, motifs, and literary threads you return to.
        </p>
      </section>
    `;
  }

  return `
    <section class="highlight-intel-panel reveal-layer-2" id="journalIntelPanel" aria-label="Highlight Intelligence">
      <div class="intel-kicker">LITERARY PATTERNS</div>
      <h2 class="intel-heading">What You've Been Returning To</h2>
      <p class="intel-summary-lead">${escapeHtml(analysis.thematicSummary)}</p>

      <!-- Theme Cards -->
      <div class="intel-themes-grid">
        ${analysis.themes.map((theme) => `
          <div class="intel-theme-card">
            <div class="intel-theme-header">
              <h3 class="intel-theme-title">${escapeHtml(theme.title)}</h3>
              <span class="intel-theme-count">${theme.count} passage${theme.count === 1 ? '' : 's'}</span>
            </div>
            <p class="intel-theme-desc">${escapeHtml(theme.description)}</p>
            ${theme.keywords.length > 0 ? `
              <div class="intel-theme-motifs">
                <span class="motif-label">Motifs:</span>
                ${theme.keywords.map((k) => `<span class="motif-tag">${escapeHtml(k)}</span>`).join('')}
              </div>
            ` : ''}
            ${theme.sampleHighlights.length > 0 ? `
              <blockquote class="intel-theme-sample">
                <p>“${escapeHtml(theme.sampleHighlights[0].snippet)}”</p>
                <cite>— ${escapeHtml(theme.sampleHighlights[0].bookTitle)}</cite>
              </blockquote>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <!-- Cross-Book Connections (if present) -->
      ${analysis.bookConnections.length > 0 ? `
        <div class="intel-connections-section">
          <h3 class="intel-subheading">Across Your Reading</h3>
          <p class="intel-subdesc">Shared literary motifs linking the passages you have collected across different volumes.</p>

          <div class="intel-connections-list">
            ${analysis.bookConnections.map((conn) => `
              <div class="intel-connection-row">
                <div class="intel-conn-books">
                  <span class="conn-book-title">${escapeHtml(conn.bookA.title)}</span>
                  <span class="conn-arrow" aria-hidden="true">↔</span>
                  <span class="conn-book-title">${escapeHtml(conn.bookB.title)}</span>
                </div>
                <div class="intel-conn-meta">
                  ${conn.sharedThemes.length > 0 ? `
                    <span class="conn-tag-theme">${conn.sharedThemes.join(' · ')}</span>
                  ` : ''}
                  ${conn.sharedTerms.length > 0 ? `
                    <span class="conn-tag-terms">${conn.sharedTerms.map((t) => `“${t}”`).join(', ')}</span>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </section>
  `;
}
