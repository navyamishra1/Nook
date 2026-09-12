import { NOOK_CATALOG } from '../frontend/js/catalog-data.js';
import { computeHomeRecommendations, getCuratedShelves } from '../frontend/js/home.js';

console.log('Testing Home Recommendation Constraints...');

// Test Scenario A: Fresh user (no reading history)
const recsFresh = computeHomeRecommendations(NOOK_CATALOG, null);
console.log('Fresh user starter books count:', recsFresh.starterBooks.length);
console.log('Fresh user pickedForYou count:', recsFresh.pickedForYou.length);
console.log('Fresh user moreLikeThis count:', recsFresh.moreLikeThis.length);

if (recsFresh.starterBooks.length !== 5) {
  throw new Error(`Expected 5 starter books, got ${recsFresh.starterBooks.length}`);
}
if (recsFresh.pickedForYou.length !== 5) {
  throw new Error(`Expected 5 pickedForYou books, got ${recsFresh.pickedForYou.length}`);
}
if (recsFresh.moreLikeThis.length !== 5) {
  throw new Error(`Expected 5 moreLikeThis books, got ${recsFresh.moreLikeThis.length}`);
}

// Test Scenario B: Active reading book (e.g. Frankenstein)
const frankenstein = NOOK_CATALOG.find(b => b.id === 'frankenstein');
const recsActive = computeHomeRecommendations(NOOK_CATALOG, frankenstein);
console.log('Active user pickedForYou count:', recsActive.pickedForYou.length);
console.log('Active user moreLikeThis count:', recsActive.moreLikeThis.length);

if (recsActive.pickedForYou.length !== 5) {
  throw new Error(`Expected 5 pickedForYou books, got ${recsActive.pickedForYou.length}`);
}
if (recsActive.moreLikeThis.length !== 5) {
  throw new Error(`Expected 5 moreLikeThis books, got ${recsActive.moreLikeThis.length}`);
}

// Verify Curated Shelves capped to top 6
const shelves = getCuratedShelves(NOOK_CATALOG);
console.log('Curated shelves count:', shelves.length);
if (shelves.length > 6) {
  throw new Error(`Expected max 6 curated shelves, got ${shelves.length}`);
}

console.log('==================================================');
console.log('HOME PAGE EDITORIAL CONSTRAINTS: 100% VERIFIED');
console.log('Home remains calm, uncrowded, and editorial.');
console.log('==================================================');
