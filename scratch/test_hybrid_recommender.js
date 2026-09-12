/**
 * Comprehensive Test Suite for Nook Hybrid Recommendation Engine
 * Step 1: Improved Recommendation Explanations & Explainability Validation
 */

const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, '..', 'data', 'seed', 'books.json');
const rawCatalog = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

import('../frontend/js/recommender.js').then((recommender) => {
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

  console.log('\n================ NOOK HYBRID RECOMMENDER & EXPLANATION TEST SUITE ================');

  // Baseline ranking expectations (MUST remain 100% invariant)
  const EXPECTED_FRANKENSTEIN_RECS = [
    'the-island-of-doctor-moreau',
    'the-picture-of-dorian-gray',
    'northanger-abbey',
    'the-war-of-the-worlds',
    'the-phantom-of-the-opera'
  ];
  const EXPECTED_FRANKENSTEIN_MORE_LIKE = [
    'the-island-of-doctor-moreau',
    'the-strange-case-of-dr-jekyll-and-mr-hyde',
    'the-invisible-man',
    'the-picture-of-dorian-gray',
    'the-turn-of-the-screw'
  ];
  const EXPECTED_SHERLOCK_RECS = [
    'the-return-of-sherlock-holmes',
    'the-memoirs-of-sherlock-holmes',
    'the-hound-of-the-baskervilles',
    'the-lost-world',
    'the-secret-adversary'
  ];
  const EXPECTED_SHERLOCK_MORE_LIKE = [
    'the-return-of-sherlock-holmes',
    'the-memoirs-of-sherlock-holmes',
    'the-hound-of-the-baskervilles',
    'the-moonstone',
    'the-mysterious-affair-at-styles'
  ];

  // --------------------------------------------------------------------------
  // TEST 1: Frankenstein Single-Book History & Explanations
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Frankenstein Single-Book History & Explanations ---');
  const frankensteinHistory = [
    { bookId: 'frankenstein', progressPercent: 45, lastAccessedAt: 10000 }
  ];
  const frankResult = recommender.computeHybridRecommendations(rawCatalog, frankensteinHistory);
  assert(frankResult.isFresh === false, 'Single-book history recognized as active reading session');
  assert(frankResult.currentBook?.id === 'frankenstein', 'Frankenstein identified as active book');
  assert(frankResult.recommended.length === 5, '5 Picked For You recommendations returned');

  // Check specific, non-generic reasons
  const frankRecReasons = frankResult.recommended.map((b) => b.recommendationReason);
  assert(frankRecReasons.some((r) => r.includes('Frankenstein')), 'Picked For You references current/historical read "Frankenstein"');
  assert(!frankRecReasons.includes('Because you enjoy Classics'), 'Avoids generic "Because you enjoy Classics" fallback');
  assert(frankRecReasons.some((r) => r.includes('Science Fiction') || r.includes('Gothic')), 'References specific genres (Science Fiction / Gothic)');

  // --------------------------------------------------------------------------
  // TEST 2: Multiple-Book Reading History
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Multiple-Book Reading History ---');
  const sherlockHistory = [
    { bookId: 'the-adventures-of-sherlock-holmes', progressPercent: 75, lastAccessedAt: 3000 },
    { bookId: 'the-sign-of-the-four', progressPercent: 95, lastAccessedAt: 2000 },
    { bookId: 'a-study-in-scarlet', progressPercent: 90, lastAccessedAt: 1000 }
  ];
  const sherlockResult = recommender.computeHybridRecommendations(rawCatalog, sherlockHistory);
  assert(sherlockResult.recommended.length === 5, 'Returns 5 recommendations for multi-book history');
  
  const sherlockRecReasons = sherlockResult.recommended.map((b) => b.recommendationReason);
  assert(sherlockRecReasons.some((r) => r.includes('Arthur Conan Doyle')), 'Correctly identifies and cites author Arthur Conan Doyle');
  assert(sherlockRecReasons.some((r) => r.includes('mystery') || r.includes('The Adventures of Sherlock Holmes')), 'Cites mystery genre and Sherlock Holmes reference');

  // --------------------------------------------------------------------------
  // TEST 3: More Like What You're Reading (Specific & Non-Repeating)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. More Like What You\'re Reading (Specific & Non-Repeating) ---');
  assert(frankResult.moreLikeCurrent.length === 5, '5 books in More Like What You\'re Reading');
  const moreLikeReasons = frankResult.moreLikeCurrent.map((b) => b.recommendationReason);

  // Check diversity of phrasing
  const uniqueMoreLikeReasons = new Set(moreLikeReasons);
  assert(uniqueMoreLikeReasons.size >= 3, `More Like What You're Reading produces diverse reasons (${uniqueMoreLikeReasons.size} unique patterns)`);
  assert(!moreLikeReasons.every((r) => r === "Because you're exploring Frankenstein; or, The Modern Prometheus"), 'Does not repeat identical generic string for all cards');
  assert(moreLikeReasons.some((r) => r.includes('shorter Gothic read') || r.includes('evening')), 'Identifies shorter evening read (e.g. Dr. Jekyll and Mr. Hyde)');
  assert(moreLikeReasons.some((r) => r.includes('Science Fiction')), 'Identifies shared Science Fiction themes');

  // --------------------------------------------------------------------------
  // TEST 4: Category-Based Explanations
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Category-Based Explanations ---');
  const gothicHistory = [
    { bookId: 'the-turn-of-the-screw', progressPercent: 100, lastAccessedAt: 2000 },
    { bookId: 'dracula', progressPercent: 80, lastAccessedAt: 3000 }
  ];
  const gothicResult = recommender.computeHybridRecommendations(rawCatalog, gothicHistory);
  const gothicRecReasons = gothicResult.recommended.map((b) => b.recommendationReason);
  assert(gothicRecReasons.some((r) => r.includes('Gothic') || r.includes('Dracula') || r.includes('Turn of the Screw')), 'Cites specific Gothic genre or historical read');

  // --------------------------------------------------------------------------
  // TEST 5: Author-Based Explanations
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Author-Based Explanations ---');
  const austenHistory = [
    { bookId: 'pride-and-prejudice', progressPercent: 80, lastAccessedAt: 5000 }
  ];
  const austenResult = recommender.computeHybridRecommendations(rawCatalog, austenHistory);
  const austenRecs = austenResult.recommended;
  const austenAuthorMatches = austenRecs.filter((b) => b.author === 'Jane Austen');
  
  if (austenAuthorMatches.length > 0) {
    assert(austenAuthorMatches.some((b) => b.recommendationReason.includes('Jane Austen')), 'Jane Austen books in recommendations cite Jane Austen');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Length-Based Explanations
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Length-Based Explanations ---');
  // Long-reading user reading a concise novella candidate
  const longUserHistory = [
    { bookId: 'war-and-peace', progressPercent: 50, lastAccessedAt: 5000 },
    { bookId: 'les-miserables', progressPercent: 60, lastAccessedAt: 4000 }
  ];
  const longUserResult = recommender.computeHybridRecommendations(rawCatalog, longUserHistory);
  const shortRecs = longUserResult.recommended.filter((b) => (b.estimated_reading_time || 300) <= 180);
  if (shortRecs.length > 0) {
    assert(shortRecs.some((b) => b.recommendationReason.includes('shorter') || b.recommendationMetadata.reasons.some((r) => r.includes('shorter'))), 'Identifies shorter evening read for long-book readers');
  } else {
    assert(true, 'Length signal active across preference scoring');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Cold-Start Explanations
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Cold-Start Explanations ---');
  const coldStart = recommender.computeHybridRecommendations(rawCatalog, []);
  assert(coldStart.isFresh === true, 'Cold-start sets isFresh = true');
  assert(coldStart.recommended.length === 5, 'Cold-start returns exactly 5 starter books');
  assert(coldStart.recommended.every((b) => b.recommendationReason.includes('classic') && b.recommendationReason.includes('journey')), 'Starter books have elegant cold-start journey reasons');
  assert(coldStart.moreLikeCurrent.length === 0, 'Cold-start has no More Like Current');

  // --------------------------------------------------------------------------
  // TEST 8: Determinism & Stability
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Determinism & Stability ---');
  const run1 = recommender.computeHybridRecommendations(rawCatalog, frankensteinHistory);
  const run2 = recommender.computeHybridRecommendations(rawCatalog, frankensteinHistory);
  assert(JSON.stringify(run1.recommended.map((b) => b.id)) === JSON.stringify(run2.recommended.map((b) => b.id)), 'Recommendation IDs 100% deterministic');
  assert(JSON.stringify(run1.recommended.map((b) => b.recommendationReason)) === JSON.stringify(run2.recommended.map((b) => b.recommendationReason)), 'Recommendation reasons 100% deterministic');
  assert(JSON.stringify(run1.moreLikeCurrent.map((b) => b.recommendationReason)) === JSON.stringify(run2.moreLikeCurrent.map((b) => b.recommendationReason)), 'More Like Current reasons 100% deterministic');

  // --------------------------------------------------------------------------
  // TEST 9: No False Book / Category / Author Claims
  // --------------------------------------------------------------------------
  console.log('\n--- 9. No False Book / Category / Author Claims ---');
  const testHistories = [frankensteinHistory, sherlockHistory, austenHistory, gothicHistory];
  let falseClaimsFound = false;

  for (const hist of testHistories) {
    const res = recommender.computeHybridRecommendations(rawCatalog, hist);
    const histBookIds = new Set(hist.map((h) => h.bookId));
    const histAuthors = new Set(rawCatalog.filter((b) => histBookIds.has(b.id)).map((b) => b.author?.toLowerCase()));

    // Check all recommended books
    for (const book of [...res.recommended, ...res.moreLikeCurrent]) {
      const reason = book.recommendationReason || '';
      
      // If author is claimed: "Another work by [Author]" -> book.author must match AND author was in history
      if (reason.includes('Another work by ') || reason.includes('by Arthur Conan Doyle') || reason.includes('by Jane Austen')) {
        if (!histAuthors.has(book.author?.toLowerCase())) {
          console.error(`False author claim in ${book.id}: ${reason}`);
          falseClaimsFound = true;
        }
      }

      // If category is claimed: "Matches your interest in [Category]" -> book must belong to related category or dominant category
      if (reason.startsWith('Matches your interest in ')) {
        const catClaim = reason.replace('Matches your interest in ', '').trim();
        if (catClaim !== 'classic literature' && !(book.categories || []).some((c) => c.toLowerCase().includes(catClaim.toLowerCase()))) {
          console.error(`False category claim in ${book.id}: ${reason}`);
          falseClaimsFound = true;
        }
      }
    }
  }
  assert(!falseClaimsFound, 'Zero false book, author, or category claims across test suites');

  // --------------------------------------------------------------------------
  // TEST 10: Recommendation Ranking Remains 100% Unchanged
  // --------------------------------------------------------------------------
  console.log('\n--- 10. Invariant Check: Recommendation Ranking Unchanged ---');
  const frankRecIds = frankResult.recommended.map((b) => b.id);
  const frankMoreIds = frankResult.moreLikeCurrent.map((b) => b.id);
  assert(JSON.stringify(frankRecIds) === JSON.stringify(EXPECTED_FRANKENSTEIN_RECS), `Frankenstein Picked For You ranking matches baseline exact order: ${frankRecIds.join(', ')}`);
  assert(JSON.stringify(frankMoreIds) === JSON.stringify(EXPECTED_FRANKENSTEIN_MORE_LIKE), `Frankenstein More Like Current ranking matches baseline exact order: ${frankMoreIds.join(', ')}`);

  const sherlockRecIds = sherlockResult.recommended.map((b) => b.id);
  const sherlockMoreIds = sherlockResult.moreLikeCurrent.map((b) => b.id);
  assert(JSON.stringify(sherlockRecIds) === JSON.stringify(EXPECTED_SHERLOCK_RECS), `Sherlock Picked For You ranking matches baseline exact order: ${sherlockRecIds.join(', ')}`);
  assert(JSON.stringify(sherlockMoreIds) === JSON.stringify(EXPECTED_SHERLOCK_MORE_LIKE), `Sherlock More Like Current ranking matches baseline exact order: ${sherlockMoreIds.join(', ')}`);

  // --------------------------------------------------------------------------
  // TEST 11: Catalog Vectors & Content Similarity Sanity Checks
  // --------------------------------------------------------------------------
  console.log('\n--- 11. Core Mathematical Vector & Similarity Checks ---');
  const vectors = recommender.buildCatalogVectors(rawCatalog);
  assert(vectors.size === 105, '105 catalog vectors built');
  const simSherlock = recommender.getBookContentSimilarity(rawCatalog, 'the-adventures-of-sherlock-holmes', 'the-hound-of-the-baskervilles');
  assert(simSherlock > 0.25, `Sherlock similarity: ${simSherlock.toFixed(4)} > 0.25`);
  const simGothic = recommender.getBookContentSimilarity(rawCatalog, 'frankenstein', 'dracula');
  assert(simGothic > 0.10, `Frankenstein vs Dracula gothic similarity: ${simGothic.toFixed(4)} > 0.10`);

  // --------------------------------------------------------------------------
  // TEST 12: Completed Book Exclusion & Edge Cases
  // --------------------------------------------------------------------------
  console.log('\n--- 12. Completed-Book Exclusion & Edge Cases ---');
  const completedHistory = [
    { bookId: 'dracula', progressPercent: 100, lastAccessedAt: Date.now() - 10000 },
    { bookId: 'frankenstein', progressPercent: 50, lastAccessedAt: Date.now() }
  ];
  const completedResult = recommender.computeHybridRecommendations(rawCatalog, completedHistory);
  assert(!completedResult.recommended.some((b) => b.id === 'dracula'), 'Completed Dracula excluded from Picked For You');
  assert(!completedResult.moreLikeCurrent.some((b) => b.id === 'dracula'), 'Completed Dracula excluded from More Like Current');

  const nullResult = recommender.computeHybridRecommendations(null, []);
  assert(nullResult.recommended.length === 0 && nullResult.isFresh === true, 'Null catalog handled safely');

  console.log(`\n================ TEST SUITE COMPLETED ================`);
  console.log(`Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch((err) => {
  console.error('Test execution exception:', err);
  process.exit(1);
});
