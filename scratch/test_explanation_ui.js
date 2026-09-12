/**
 * Verification Test Suite for Feature #3B: Recommendation Explanation UI
 */

const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, '..', 'data', 'seed', 'books.json');
const catalog = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

// Mock fetch for catalog.js
global.fetch = async () => ({
  ok: true,
  json: async () => catalog
});

// Mock localStorage
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};

async function runTests() {
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

  console.log('\n================ FEATURE #3B: EXPLANATION UI VERIFICATION ================');

  const { fetchCatalog } = await import('../frontend/js/catalog.js');
  await fetchCatalog();

  const { createBookCardMarkup } = await import('../frontend/js/home.js');
  const { renderBookDetailsView } = await import('../frontend/js/details.js');
  const recommender = await import('../frontend/js/recommender.js');

  // 1. Home Card Markup with recommendationReason
  console.log('\n--- 1. Home Card Markup with recommendationReason ---');
  const testBookWithReason = {
    id: 'frankenstein',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    estimated_reading_time: 346,
    publication_year: 1818,
    categories: ['Classics', 'Gothic Fiction'],
    recommendationReason: 'Shares Gothic Fiction and dark suspense with Frankenstein'
  };
  const cardHtml = createBookCardMarkup(testBookWithReason);
  assert(cardHtml.includes('class="rec-reason"'), 'Card contains rec-reason element');
  assert(cardHtml.includes('Shares Gothic Fiction and dark suspense with Frankenstein'), 'Card displays exact recommendationReason text');

  // 2. Home Card Markup without recommendationReason
  console.log('\n--- 2. Home Card Markup without recommendationReason ---');
  const testBookWithoutReason = {
    id: 'pride-and-prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    estimated_reading_time: 540,
    publication_year: 1813,
    categories: ['Classics', 'Romance']
  };
  const normalCardHtml = createBookCardMarkup(testBookWithoutReason);
  assert(!normalCardHtml.includes('class="rec-reason"'), 'Normal card does NOT render rec-reason element');

  // 3. Details View Curator Note (when recommendationReason is present)
  console.log('\n--- 3. Details View Curator Note (Home/Recommended Navigation) ---');
  const mockContainer = { innerHTML: '', querySelector: () => null };
  global.document = {
    getElementById: (id) => (id === 'view-details' ? mockContainer : null)
  };

  renderBookDetailsView({
    bookId: 'the-island-of-doctor-moreau',
    containerId: 'view-details',
    origin: 'home',
    recommendationReason: 'Shares classic Science Fiction themes with Frankenstein'
  });

  assert(mockContainer.innerHTML.includes('Curator\'s Reading Note'), 'Details view contains "Curator\'s Reading Note" heading');
  assert(mockContainer.innerHTML.includes('Shares classic Science Fiction themes with Frankenstein'), 'Details view renders the specific recommendation reason');
  assert(mockContainer.innerHTML.includes('class="curator-note"'), 'Details view renders .curator-note container');
  assert(mockContainer.innerHTML.includes('role="note"'), 'Curator note has semantic role="note"');

  // 4. Details View from Library (Normal Navigation without reason)
  console.log('\n--- 4. Details View from Library (Normal Navigation) ---');
  mockContainer.innerHTML = '';
  renderBookDetailsView({
    bookId: 'the-island-of-doctor-moreau',
    containerId: 'view-details',
    origin: 'library',
    recommendationReason: null
  });

  assert(!mockContainer.innerHTML.includes('Curator\'s Reading Note'), 'Library navigation does NOT show Curator\'s Reading Note');
  assert(!mockContainer.innerHTML.includes('class="curator-note"'), 'No .curator-note markup rendered for normal Library browsing');

  // 5. Reading Intent Recommendation forward to Details
  console.log('\n--- 5. Reading Intent Recommendation forward to Details ---');
  const intentResult = recommender.searchByReadingIntent('something dark and mysterious', catalog, { limit: 1 });
  const topIntentBook = intentResult.results[0];
  assert(Boolean(topIntentBook.recommendationReason), 'Reading Intent result has recommendationReason');

  mockContainer.innerHTML = '';
  renderBookDetailsView({
    bookId: topIntentBook.id,
    containerId: 'view-details',
    origin: 'home',
    recommendationReason: topIntentBook.recommendationReason
  });
  assert(mockContainer.innerHTML.includes('Curator\'s Reading Note'), 'Reading Intent book shows Curator\'s Reading Note');
  assert(mockContainer.innerHTML.includes(topIntentBook.recommendationReason), 'Reading Intent reason is displayed in Curator Note');

  // 6. CSS Styling Rules Verification
  console.log('\n--- 6. CSS Styling Rules Verification ---');
  const cssContent = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'css', 'app-shell.css'), 'utf-8');
  assert(cssContent.includes('.book-card .meta .rec-reason'), 'CSS defines .book-card .meta .rec-reason styles');
  assert(cssContent.includes('.curator-note'), 'CSS defines .curator-note container styles');
  assert(cssContent.includes('.curator-note .curator-note-kicker'), 'CSS defines .curator-note-kicker styles');
  assert(cssContent.includes('.curator-note .curator-note-body'), 'CSS defines .curator-note-body styles');
  assert(cssContent.includes('[data-theme="dark"] .curator-note'), 'CSS includes dark mode styles for curator-note');

  console.log(`\n================ TEST SUMMARY ================`);
  console.log(`Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
