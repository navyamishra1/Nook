/**
 * Stage 7 — Journal Timeline Unit & Invariant Test Suite
 */

import assert from 'assert';
import {
  getJournalTimelineEntries,
  groupTimelineEntries,
  renderJournalTimelineHTML,
  formatTimelineDay,
  formatTimelineMonthYear,
  formatTimelineTime
} from '../frontend/js/journal-timeline.js';

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

const mockCatalog = [
  {
    id: 'frankenstein',
    title: 'Frankenstein',
    author: 'Mary Wollstonecraft Shelley',
    categories: ['Classics', 'Gothic', 'Horror', 'Science Fiction']
  },
  {
    id: 'dracula',
    title: 'Dracula',
    author: 'Bram Stoker',
    categories: ['Classics', 'Gothic', 'Horror']
  },
  {
    id: 'pride-and-prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    categories: ['Classics', 'Romance']
  }
];

console.log('================ JOURNAL TIMELINE TEST SUITE ================');

// -------------------------------------------------------------
// 1. Empty Journal
// -------------------------------------------------------------
console.log('\n--- 1. Empty Journal ---');
it('Empty store returns empty array', () => {
  const res = getJournalTimelineEntries({
    store: { bookmarks: [], highlights: [], notes: [] },
    catalog: mockCatalog
  });
  assert.strictEqual(res.length, 0);
});

it('Null or undefined store returns empty array', () => {
  assert.strictEqual(getJournalTimelineEntries({ store: null, catalog: mockCatalog }).length, 0);
  assert.strictEqual(getJournalTimelineEntries({ store: undefined, catalog: mockCatalog }).length, 0);
});

it('Empty timeline groups into empty array', () => {
  const groups = groupTimelineEntries([]);
  assert.strictEqual(groups.length, 0);
});

// -------------------------------------------------------------
// 2. Single Highlight Normalization
// -------------------------------------------------------------
console.log('\n--- 2. Single Highlight ---');
it('Normalizes single highlight with all required metadata', () => {
  const testStore = {
    bookmarks: [],
    highlights: [
      {
        id: 'hl-1',
        bookId: 'frankenstein',
        chapterNumber: 4,
        chapterTitle: 'Chapter 4',
        pageNumber: 12,
        selectedText: 'Learn from me, how dangerous is the acquirement of knowledge.',
        color: 'sage',
        createdAt: 1726050000000 // Sept 11, 2024
      }
    ],
    notes: []
  };

  const entries = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog });
  assert.strictEqual(entries.length, 1);
  const e = entries[0];
  assert.strictEqual(e.id, 'hl-1');
  assert.strictEqual(e.type, 'highlight');
  assert.strictEqual(e.bookId, 'frankenstein');
  assert.strictEqual(e.bookTitle, 'Frankenstein');
  assert.strictEqual(e.author, 'Mary Wollstonecraft Shelley');
  assert.strictEqual(e.chapterNumber, 4);
  assert.strictEqual(e.chapterTitle, 'Chapter 4');
  assert.strictEqual(e.pageNumber, 12);
  assert.strictEqual(e.selectedText, 'Learn from me, how dangerous is the acquirement of knowledge.');
  assert.ok(e.dayLabel.includes('September 2024'));
  assert.ok(e.monthYearLabel.includes('September 2024'));
});

// -------------------------------------------------------------
// 3. Single Note Normalization
// -------------------------------------------------------------
console.log('\n--- 3. Single Note ---');
it('Normalizes single note with attached quote and text', () => {
  const testStore = {
    bookmarks: [],
    highlights: [],
    notes: [
      {
        id: 'nt-1',
        bookId: 'dracula',
        chapterNumber: 2,
        chapterTitle: 'Chapter 2',
        pageNumber: 5,
        selectedText: 'Welcome to my house! Enter freely and of your own will!',
        note: 'Count Dracula greets Harker.',
        createdAt: 1726055000000
      }
    ]
  };

  const entries = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog });
  assert.strictEqual(entries.length, 1);
  const e = entries[0];
  assert.strictEqual(e.type, 'note');
  assert.strictEqual(e.bookId, 'dracula');
  assert.strictEqual(e.bookTitle, 'Dracula');
  assert.strictEqual(e.selectedText, 'Welcome to my house! Enter freely and of your own will!');
  assert.strictEqual(e.note, 'Count Dracula greets Harker.');
});

// -------------------------------------------------------------
// 4. Single Bookmark Normalization
// -------------------------------------------------------------
console.log('\n--- 4. Single Bookmark ---');
it('Normalizes single bookmark with ribbon style', () => {
  const testStore = {
    bookmarks: [
      {
        id: 'bm-1',
        bookId: 'pride-and-prejudice',
        chapterNumber: 1,
        chapterTitle: 'Chapter 1',
        pageNumber: 3,
        totalPages: 120,
        bookmarkStyle: 'sage-linen',
        createdAt: 1726060000000
      }
    ],
    highlights: [],
    notes: []
  };

  const entries = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog });
  assert.strictEqual(entries.length, 1);
  const e = entries[0];
  assert.strictEqual(e.type, 'bookmark');
  assert.strictEqual(e.bookmarkStyle, 'sage-linen');
  assert.strictEqual(e.totalPages, 120);
});

// -------------------------------------------------------------
// 5. Multiple Entry Types & Chronological Ordering
// -------------------------------------------------------------
console.log('\n--- 5. Multiple Entries & Chronological Ordering ---');
it('Sorts entries strictly newest first', () => {
  const testStore = {
    bookmarks: [
      { id: 'bm-old', bookId: 'frankenstein', pageNumber: 1, createdAt: 1000 }
    ],
    highlights: [
      { id: 'hl-newest', bookId: 'frankenstein', selectedText: 'Newest quote', createdAt: 3000 }
    ],
    notes: [
      { id: 'nt-middle', bookId: 'frankenstein', note: 'Middle note', createdAt: 2000 }
    ]
  };

  const entries = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog });
  assert.strictEqual(entries.length, 3);
  assert.strictEqual(entries[0].id, 'hl-newest');
  assert.strictEqual(entries[1].id, 'nt-middle');
  assert.strictEqual(entries[2].id, 'bm-old');
});

// -------------------------------------------------------------
// 6. Multiple Books & Chapters
// -------------------------------------------------------------
console.log('\n--- 6. Multiple Books & Chapters ---');
it('Correctly resolves metadata across multiple books', () => {
  const testStore = {
    bookmarks: [],
    highlights: [
      { id: 'hl-1', bookId: 'frankenstein', chapterNumber: 10, selectedText: 'Quote 1', createdAt: 2000 },
      { id: 'hl-2', bookId: 'dracula', chapterNumber: 5, selectedText: 'Quote 2', createdAt: 1500 },
      { id: 'hl-3', bookId: 'pride-and-prejudice', chapterNumber: 3, selectedText: 'Quote 3', createdAt: 1000 }
    ],
    notes: []
  };

  const entries = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog });
  assert.strictEqual(entries.length, 3);
  assert.strictEqual(entries[0].bookTitle, 'Frankenstein');
  assert.strictEqual(entries[1].bookTitle, 'Dracula');
  assert.strictEqual(entries[2].bookTitle, 'Pride and Prejudice');
});

// -------------------------------------------------------------
// 7. Equal Timestamp Deterministic Tie-Breaking
// -------------------------------------------------------------
console.log('\n--- 7. Equal Timestamp Tie-Breaking ---');
it('Applies deterministic tie-breaking on identical timestamps', () => {
  const sameTime = 1726050000000;
  const testStore = {
    bookmarks: [
      { id: 'bm-1', bookId: 'frankenstein', pageNumber: 10, createdAt: sameTime }
    ],
    highlights: [
      { id: 'hl-1', bookId: 'frankenstein', selectedText: 'Sample text', createdAt: sameTime }
    ],
    notes: [
      { id: 'nt-1', bookId: 'frankenstein', note: 'Sample note', createdAt: sameTime }
    ]
  };

  const entries = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog });
  assert.strictEqual(entries.length, 3);
  // Priority order: bookmark (1) -> highlight (2) -> note (3)
  assert.strictEqual(entries[0].type, 'bookmark');
  assert.strictEqual(entries[1].type, 'highlight');
  assert.strictEqual(entries[2].type, 'note');
});

// -------------------------------------------------------------
// 8. Missing Timestamps Graceful Handling
// -------------------------------------------------------------
console.log('\n--- 8. Missing Timestamps Handling ---');
it('Places undated entries at the end without inventing fake dates', () => {
  const testStore = {
    bookmarks: [
      { id: 'bm-undated', bookId: 'frankenstein', pageNumber: 1, createdAt: null }
    ],
    highlights: [
      { id: 'hl-dated', bookId: 'frankenstein', selectedText: 'Dated highlight', createdAt: 1726050000000 }
    ],
    notes: []
  };

  const entries = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog });
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].id, 'hl-dated');
  assert.strictEqual(entries[1].id, 'bm-undated');
  assert.strictEqual(entries[1].dayLabel, 'Undated');
  assert.strictEqual(entries[1].monthYearLabel, 'Earlier & Undated');
});

// -------------------------------------------------------------
// 9. Filtering by Type
// -------------------------------------------------------------
console.log('\n--- 9. Filtering by Type ---');
it('Filters by highlights only', () => {
  const testStore = {
    bookmarks: [{ id: 'bm-1', bookId: 'frankenstein', pageNumber: 1, createdAt: 1000 }],
    highlights: [{ id: 'hl-1', bookId: 'frankenstein', selectedText: 'A highlight', createdAt: 2000 }],
    notes: [{ id: 'nt-1', bookId: 'frankenstein', note: 'A note', createdAt: 3000 }]
  };

  const hlOnly = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog, type: 'highlights' });
  assert.strictEqual(hlOnly.length, 1);
  assert.strictEqual(hlOnly[0].type, 'highlight');

  const notesOnly = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog, type: 'notes' });
  assert.strictEqual(notesOnly.length, 1);
  assert.strictEqual(notesOnly[0].type, 'note');

  const bmOnly = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog, type: 'bookmarks' });
  assert.strictEqual(bmOnly.length, 1);
  assert.strictEqual(bmOnly[0].type, 'bookmark');
});

// -------------------------------------------------------------
// 10. Unknown Book ID Resilience
// -------------------------------------------------------------
console.log('\n--- 10. Unknown Book ID Resilience ---');
it('Gracefully renders unknown book ID without crashing', () => {
  const testStore = {
    bookmarks: [],
    highlights: [
      { id: 'hl-unk', bookId: 'unknown-book-xyz', selectedText: 'Some quote', createdAt: 1000 }
    ],
    notes: []
  };

  const entries = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog });
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].bookId, 'unknown-book-xyz');
  assert.strictEqual(entries[0].bookTitle, 'unknown-book-xyz');
});

// -------------------------------------------------------------
// 11. Exact Navigation Parameters
// -------------------------------------------------------------
console.log('\n--- 11. Exact Navigation Parameters ---');
it('Preserves exact bookId, chapterNumber, and pageNumber for reader navigation', () => {
  const testStore = {
    bookmarks: [],
    highlights: [
      {
        id: 'hl-nav',
        bookId: 'frankenstein',
        chapterNumber: 7,
        chapterTitle: 'Chapter 7',
        pageNumber: 22,
        selectedText: 'Exact target text',
        createdAt: 1000
      }
    ],
    notes: []
  };

  const entries = getJournalTimelineEntries({ store: testStore, catalog: mockCatalog });
  const e = entries[0];
  assert.strictEqual(e.bookId, 'frankenstein');
  assert.strictEqual(e.chapterNumber, 7);
  assert.strictEqual(e.pageNumber, 22);
});

// -------------------------------------------------------------
// 12. Month/Day Grouping
// -------------------------------------------------------------
console.log('\n--- 12. Month/Day Grouping ---');
it('Groups entries hierarchically by Month/Year and Day', () => {
  // Sept 12, 2026, Sept 11, 2026, Aug 15, 2026
  const testEntries = [
    { id: '1', createdAt: 1789210000000, dayLabel: '12 September 2026', monthYearLabel: 'September 2026' },
    { id: '2', createdAt: 1789123600000, dayLabel: '11 September 2026', monthYearLabel: 'September 2026' },
    { id: '3', createdAt: 1786790000000, dayLabel: '15 August 2026', monthYearLabel: 'August 2026' }
  ];

  const groups = groupTimelineEntries(testEntries);
  assert.strictEqual(groups.length, 2);
  assert.strictEqual(groups[0].monthYear, 'September 2026');
  assert.strictEqual(groups[0].days.length, 2);
  assert.strictEqual(groups[0].days[0].dayLabel, '12 September 2026');
  assert.strictEqual(groups[1].monthYear, 'August 2026');
  assert.strictEqual(groups[1].days.length, 1);
});

// -------------------------------------------------------------
// 13. UI Renderer Markup Check
// -------------------------------------------------------------
console.log('\n--- 13. UI Renderer Markup ---');
it('Renders timeline container, stream, and entry cards', () => {
  const testStore = {
    bookmarks: [{ id: 'bm-1', bookId: 'frankenstein', pageNumber: 3, createdAt: 1789210000000 }],
    highlights: [{ id: 'hl-1', bookId: 'frankenstein', selectedText: 'A great quote', createdAt: 1789210000000 }],
    notes: [{ id: 'nt-1', bookId: 'frankenstein', note: 'A profound note', createdAt: 1789210000000 }]
  };

  const html = renderJournalTimelineHTML({ store: testStore, catalog: mockCatalog });
  assert.ok(html.includes('journal-timeline-container'));
  assert.ok(html.includes('timeline-hairline'));
  assert.ok(html.includes('timeline-entry-card'));
  assert.ok(html.includes('data-action="open-passage"'));
  assert.ok(html.includes('Open in Reader'));
});

it('Renders elegant empty state when store has 0 entries', () => {
  const html = renderJournalTimelineHTML({
    store: { bookmarks: [], highlights: [], notes: [] },
    catalog: mockCatalog
  });
  assert.ok(html.includes('journal-timeline-empty'));
  assert.ok(html.includes('Your Reading Timeline Will Gather Here'));
});

// -------------------------------------------------------------
// 14. Deterministic Output
// -------------------------------------------------------------
console.log('\n--- 14. Deterministic Output ---');
it('Produces 100% byte-for-byte identical output across repeated runs', () => {
  const testStore = {
    bookmarks: [{ id: 'bm-1', bookId: 'frankenstein', pageNumber: 5, createdAt: 1000 }],
    highlights: [{ id: 'hl-1', bookId: 'dracula', selectedText: 'Sample', createdAt: 2000 }],
    notes: [{ id: 'nt-1', bookId: 'pride-and-prejudice', note: 'Note', createdAt: 1500 }]
  };

  const run1 = JSON.stringify(getJournalTimelineEntries({ store: testStore, catalog: mockCatalog }));
  const run2 = JSON.stringify(getJournalTimelineEntries({ store: testStore, catalog: mockCatalog }));
  assert.strictEqual(run1, run2);
});

console.log('\n================ TEST SUMMARY ================');
console.log(`Passed: ${passedTests} | Failed: ${failedTests}`);

if (failedTests > 0) {
  process.exit(1);
}
