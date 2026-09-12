import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  tokenize,
  buildCatalogVectors,
  computeCosineSimilarity,
  computeHybridRecommendations,
  RECOMMENDER_CONFIG
} from '../frontend/js/recommender.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const catalogPath = path.join(__dirname, '..', 'data', 'seed', 'books.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

console.log(`Loaded ${catalog.length} catalog books for Node recommender test.`);

// Test 1: Vector construction
const vectors = buildCatalogVectors(catalog);
console.log(`Built TF-IDF vectors for ${vectors.size} books.`);
if (vectors.size !== 105) throw new Error(`Expected 105 vectors, got ${vectors.size}`);

// Test 2: Fresh user
const freshResult = computeHybridRecommendations(catalog, []);
console.log(`Fresh user recommendations: ${freshResult.recommended.length} books, isFresh: ${freshResult.isFresh}`);
if (freshResult.recommended.length !== 5 || !freshResult.isFresh) {
  throw new Error('Fresh user test failed');
}

// Test 3: Active user with reading history (reading Dracula, completed Frankenstein)
const activeHistory = [
  {
    bookId: 'dracula',
    chapterNumber: 5,
    chapterTitle: 'Chapter 5',
    progressPercent: 28,
    lastAccessedAt: Date.now()
  },
  {
    bookId: 'frankenstein',
    chapterNumber: 24,
    chapterTitle: 'Chapter 24',
    progressPercent: 100,
    lastAccessedAt: Date.now() - 3600000
  },
  {
    bookId: 'the-turn-of-the-screw',
    chapterNumber: 3,
    chapterTitle: 'Chapter 3',
    progressPercent: 40,
    lastAccessedAt: Date.now() - 7200000
  }
];

const activeResult = computeHybridRecommendations(catalog, activeHistory);
console.log(`Active user current book: ${activeResult.currentBook?.title} (${activeResult.currentBook?.id})`);
console.log(`Picked for you (${activeResult.recommended.length} books):`);
for (const b of activeResult.recommended) {
  console.log(`  - ${b.title} by ${b.author} | Reason: "${b.recommendationReason}"`);
}

console.log(`More like what you're reading (${activeResult.moreLikeCurrent.length} books):`);
for (const b of activeResult.moreLikeCurrent) {
  console.log(`  - ${b.title} by ${b.author} | Reason: "${b.recommendationReason}"`);
}

// Verification assertions
const recIds = activeResult.recommended.map((b) => b.id);
if (recIds.includes('dracula')) throw new Error('Active book was not excluded from recommendations');
if (recIds.includes('frankenstein')) throw new Error('Completed book was not excluded from recommendations');

if (activeResult.recommended.length < 4 || activeResult.recommended.length > 6) {
  throw new Error(`Recommended count ${activeResult.recommended.length} out of expected bounds 4-6`);
}

for (const b of activeResult.recommended) {
  if (!b.recommendationReason || b.recommendationReason.includes('0.')) {
    throw new Error(`Invalid recommendation reason for ${b.id}: ${b.recommendationReason}`);
  }
}

console.log('\n[PASS] All JS Hybrid Recommender test scenarios executed with 100% success!');
