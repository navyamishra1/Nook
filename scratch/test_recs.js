import { NOOK_CATALOG } from '../frontend/js/catalog-data.js';
import { computeHomeRecommendations } from '../frontend/js/home.js';

console.log('Testing computeHomeRecommendations with 105 books...');

// Scenario 1: Fresh user
const freshResult = computeHomeRecommendations(NOOK_CATALOG, []);
console.log('Fresh user candidate pool size:', freshResult.candidatePoolSize);
console.log('Fresh user isFresh:', freshResult.isFresh);
if (!freshResult.isFresh) {
  throw new Error('Expected isFresh to be true for empty history');
}

// Scenario 2: User reading Frankenstein
const readingHistory = [
  {
    bookId: 'frankenstein',
    chapterNumber: 4,
    chapterTitle: 'Letter IV',
    progressPercent: 12,
    lastAccessedAt: Date.now()
  }
];

const activeResult = computeHomeRecommendations(NOOK_CATALOG, readingHistory);
console.log('Active user current book:', activeResult.currentBook.title);
console.log('Active user recommended count:', activeResult.recommended.length);
console.log('Active user moreLikeCurrent count:', activeResult.moreLikeCurrent.length);
console.log('Active user candidate pool size:', activeResult.candidatePoolSize);

if (activeResult.recommended.length > 5) {
  throw new Error(`Recommended count ${activeResult.recommended.length} exceeds 5`);
}
if (activeResult.moreLikeCurrent.length > 5) {
  throw new Error(`MoreLikeCurrent count ${activeResult.moreLikeCurrent.length} exceeds 5`);
}
if (activeResult.candidatePoolSize !== 105) {
  throw new Error(`Candidate pool size ${activeResult.candidatePoolSize} is not 105`);
}

console.log('==================================================');
console.log('RECOMMENDATIONS EVALUATE FULL 105 CATALOG & CAP OUTPUT: VERIFIED');
console.log('==================================================');
