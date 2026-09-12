/**
 * Node.js test script for verifying journal.js data model and logic.
 */

// Simple LocalStorage mock for Node environment
const storageMock = {};
global.localStorage = {
  getItem: (key) => storageMock[key] || null,
  setItem: (key, val) => { storageMock[key] = String(val); },
  removeItem: (key) => { delete storageMock[key]; },
  clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
};

// Mock catalog lookup
global.catalogMock = {
  'pride-and-prejudice': { id: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen' },
  'frankenstein': { id: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley' }
};

import('../frontend/js/journal.js').then((journal) => {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  console.log('\n--- TESTING NOOK JOURNAL STORAGE & CRUD ---');

  // Test 1: Empty initial store
  const store0 = journal.getJournalStore();
  assert(store0.version === 1, 'Store version is 1');
  assert(Array.isArray(store0.bookmarks) && store0.bookmarks.length === 0, 'Bookmarks initialized empty');
  assert(Array.isArray(store0.highlights) && store0.highlights.length === 0, 'Highlights initialized empty');
  assert(Array.isArray(store0.notes) && store0.notes.length === 0, 'Notes initialized empty');

  // Test 2: Add Bookmark
  const bm1 = journal.addBookmark({
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 4,
    chapterTitle: 'Chapter IV',
    pageNumber: 37,
    totalPages: 180
  });
  assert(bm1 !== null && bm1.id.startsWith('bm_'), 'Bookmark created with valid ID');
  assert(journal.isPageBookmarked('frankenstein', 37) === true, 'isPageBookmarked returns true for page 37');
  assert(journal.isPageBookmarked('frankenstein', 38) === false, 'isPageBookmarked returns false for unbookmarked page');

  // Test 3: Toggle Bookmark
  const toggleRes1 = journal.toggleBookmark({
    bookId: 'frankenstein',
    pageNumber: 37
  });
  assert(toggleRes1.bookmarked === false, 'toggleBookmark removes existing bookmark');
  assert(journal.isPageBookmarked('frankenstein', 37) === false, 'Page 37 is no longer bookmarked');

  const toggleRes2 = journal.toggleBookmark({
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 4,
    chapterTitle: 'Chapter IV',
    pageNumber: 37,
    totalPages: 180
  });
  assert(toggleRes2.bookmarked === true, 'toggleBookmark re-adds bookmark');
  assert(journal.isPageBookmarked('frankenstein', 37) === true, 'Page 37 is bookmarked again');

  // Test 4: Add Highlight
  const hl1 = journal.addHighlight({
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 4,
    chapterTitle: 'Chapter IV',
    pageNumber: 37,
    selectedText: 'It was on a dreary night of November that I beheld the accomplishment of my toils.'
  });
  assert(hl1 !== null && hl1.id.startsWith('hl_'), 'Highlight created successfully');
  assert(journal.getHighlights('frankenstein').length === 1, 'Get highlights for Frankenstein returns 1');
  assert(journal.getHighlights('pride-and-prejudice').length === 0, 'Get highlights for Pride and Prejudice returns 0');

  // Test 5: Add Note
  const nt1 = journal.addNote({
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 4,
    chapterTitle: 'Chapter IV',
    pageNumber: 37,
    selectedText: 'It was on a dreary night of November...',
    note: 'This is where the atmosphere becomes genuinely unsettling.'
  });
  assert(nt1 !== null && nt1.id.startsWith('nt_'), 'Note created successfully');
  assert(nt1.note === 'This is where the atmosphere becomes genuinely unsettling.', 'Note content matches');

  // Test 6: Edit Note
  const updated = journal.updateNote(nt1.id, 'Updated reflection: masterful gothic tone.');
  assert(updated !== null && updated.note === 'Updated reflection: masterful gothic tone.', 'Note updated successfully');

  // Test 8: Physical Bookmark Styles & Single Movable Bookmark per Book
  assert(Array.isArray(journal.BOOKMARK_STYLES) && journal.BOOKMARK_STYLES.length === 4, 'BOOKMARK_STYLES contains 4 designs');
  
  // Place bookmark on Frankenstein Page 12
  const bmP12 = journal.addBookmark({
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 2,
    chapterTitle: 'Chapter II',
    pageNumber: 12,
    bookmarkStyle: 'crimson-silk'
  });
  assert(journal.getBookmarks('frankenstein').length === 1, 'Frankenstein has exactly 1 bookmark (Page 12)');
  assert(journal.getPageBookmark('frankenstein', 12).bookmarkStyle === 'crimson-silk', 'Page 12 has crimson-silk style');
  assert(journal.getPageBookmark('frankenstein', 37) === null, 'Previous Page 37 bookmark was replaced/moved');

  // Move bookmark on Frankenstein to Page 48 (Midnight Gold)
  const bmP48 = journal.addBookmark({
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 5,
    chapterTitle: 'Chapter V',
    pageNumber: 48,
    bookmarkStyle: 'midnight-gold'
  });
  assert(journal.getBookmarks('frankenstein').length === 1, 'Frankenstein still has exactly 1 bookmark (now on Page 48)');
  assert(journal.getPageBookmark('frankenstein', 48).bookmarkStyle === 'midnight-gold', 'Page 48 has midnight-gold style');
  assert(journal.getPageBookmark('frankenstein', 12) === null, 'Page 12 bookmark disappeared when moved to Page 48');

  // Move bookmark on Frankenstein to Page 91 (Sage Linen)
  const bmP91 = journal.addBookmark({
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 8,
    chapterTitle: 'Chapter VIII',
    pageNumber: 91,
    bookmarkStyle: 'sage-linen'
  });
  assert(journal.getBookmarks('frankenstein').length === 1, 'Frankenstein has exactly 1 bookmark (now on Page 91)');
  assert(journal.getPageBookmark('frankenstein', 91).bookmarkStyle === 'sage-linen', 'Page 91 has sage-linen style');
  assert(journal.getPageBookmark('frankenstein', 48) === null, 'Page 48 bookmark disappeared');

  // Updating bookmark style on the same page updates style without duplicating
  const updatedBmP91 = journal.addBookmark({
    bookId: 'frankenstein',
    pageNumber: 91,
    bookmarkStyle: 'classic-cream'
  });
  assert(updatedBmP91.bookmarkStyle === 'classic-cream', 'Page 91 bookmark updated to classic-cream');
  assert(journal.getBookmarks('frankenstein').length === 1, 'Bookmark count remains 1');
  assert(journal.getPageBookmark('frankenstein', 91).bookmarkStyle === 'classic-cream', 'getPageBookmark(91) returns updated style');

  // Test 9: Page Note (selectedText is null) vs Passage Note
  const pageNote = journal.addNote({
    bookId: 'frankenstein',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    chapterNumber: 2,
    chapterTitle: 'Chapter II',
    pageNumber: 12,
    selectedText: null,
    note: 'General reflection on Chapter II themes.'
  });
  assert(pageNote !== null && pageNote.selectedText === null, 'Page note successfully created with selectedText: null');

  // Empty highlight creation protection
  const emptyHl = journal.addHighlight({
    bookId: 'frankenstein',
    pageNumber: 12,
    selectedText: ''
  });
  assert(emptyHl === null, 'Empty highlight returns null and is not saved');

  // Test 10: Multi-Book Coexistence (1 bookmark per book)
  const bm2 = journal.addBookmark({
    bookId: 'pride-and-prejudice',
    bookTitle: 'Pride and Prejudice',
    author: 'Jane Austen',
    chapterNumber: 1,
    chapterTitle: 'Chapter 1',
    pageNumber: 5,
    totalPages: 240,
    bookmarkStyle: 'sage-linen'
  });
  const nt2 = journal.addNote({
    bookId: 'pride-and-prejudice',
    bookTitle: 'Pride and Prejudice',
    author: 'Jane Austen',
    chapterNumber: 1,
    chapterTitle: 'Chapter 1',
    pageNumber: 5,
    selectedText: 'It is a truth universally acknowledged...',
    note: 'Classic opening sentence.'
  });

  const stats = journal.getJournalStats();
  assert(stats.totalBookmarks === 2, 'Total bookmarks count is 2 across books (1 per book)');
  assert(stats.totalHighlights === 1, 'Total highlights count is 1');
  assert(stats.totalNotes === 3, 'Total notes count is 3 (2 passage notes + 1 page note)');
  assert(stats.totalEntries === 6, 'Total entries count is 6');

  // Test 11: Queries & Filters
  const allEntries = journal.getJournalEntries();
  assert(allEntries.length === 6, 'All entries query returns 6 entries');

  const notesOnly = journal.getJournalEntries({ type: 'notes' });
  assert(notesOnly.length === 3, 'Notes filter returns 3 entries');

  const hlOnly = journal.getJournalEntries({ type: 'highlights' });
  assert(hlOnly.length === 1, 'Highlights filter returns 1 entry');

  const bmOnly = journal.getJournalEntries({ type: 'bookmarks' });
  assert(bmOnly.length === 2, 'Bookmarks filter returns 2 entries (1 per book)');

  const pandpEntries = journal.getJournalEntries({ bookId: 'pride-and-prejudice' });
  assert(pandpEntries.length === 2, 'Filter by book pride-and-prejudice returns 2 entries');

  // Test 12: Search
  const searchNone = journal.getJournalEntries({ searchQuery: 'nonexistent-query-string' });
  assert(searchNone.length === 0, 'Search for nonexistent query returns 0');

  const searchNote = journal.getJournalEntries({ searchQuery: 'gothic' });
  assert(searchNote.length === 1, 'Search for "gothic" returns the edited note');

  const searchAusten = journal.getJournalEntries({ searchQuery: 'Austen' });
  assert(searchAusten.length === 2, 'Search for "Austen" returns 2 entries');

  // Test 13: Removal & Deletion
  journal.removeNote(nt1.id);
  journal.removeNote(pageNote.id);
  assert(journal.getNotes('frankenstein').length === 0, 'Frankenstein notes removed');

  journal.removeHighlight(hl1.id);
  assert(journal.getHighlights('frankenstein').length === 0, 'Frankenstein highlight removed by ID');

  const tempHl = journal.addHighlight({
    bookId: 'pride-and-prejudice',
    bookTitle: 'Pride and Prejudice',
    author: 'Jane Austen',
    chapterNumber: 1,
    chapterTitle: 'Chapter 1',
    pageNumber: 5,
    selectedText: 'It is a truth universally acknowledged'
  });
  assert(journal.getHighlights('pride-and-prejudice').length === 1, 'Temporary highlight added');
  journal.removeHighlight({
    bookId: 'pride-and-prejudice',
    chapterNumber: 1,
    pageNumber: 5,
    selectedText: 'It is a truth universally acknowledged'
  });
  assert(journal.getHighlights('pride-and-prejudice').length === 0, 'Highlight removed via metadata criteria object');

  journal.removeBookmark(toggleRes2.bookmark.id);
  journal.removeBookmark(bmP12.id);
  journal.removeBookmark(bmP48.id);
  journal.removeBookmark(bmP91.id);
  assert(journal.getBookmarks('frankenstein').length === 0, 'All Frankenstein bookmarks removed');

  const finalStats = journal.getJournalStats();
  assert(finalStats.totalEntries === 2, 'Final stats reflect 2 remaining entries for Pride and Prejudice');

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}).catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
