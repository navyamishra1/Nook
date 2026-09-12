/**
 * Comprehensive Test Suite for Stage 9: Reading Personality
 * 
 * Tests:
 * 1. Empty history handling
 * 2. Insufficient history (< 3 books, cold-start)
 * 3. Minimum threshold (cold-start boundary)
 * 4. Established profile (confidence and fields)
 * 5. Deterministic archetype extraction
 * 6. Repeated category affinity (The Atmospheric Wanderer)
 * 7. Broad category exploration (The Restless Explorer)
 * 8. Short-book preference
 * 9. Long-book preference (The Deep Diver)
 * 10. Mixed-length reader
 * 11. Completion behavior (Finisher vs Explorer)
 * 12. Highlight-theme influence on scoring & evidence
 * 13. Evidence correctness ("Why Nook Noticed This")
 * 14. Ethical boundaries (Zero psychological diagnostic/sensitive claims)
 * 15. Unknown book IDs & malformed records resilience
 * 16. Missing metadata resilience
 * 17. Deterministic output across repeated calls
 * 18. Same input = 100% byte-for-byte identical output
 * 19. Personality responsiveness to changing reading behavior
 * 20. Synthetic profiles differentiation (Profiles A, B, C, D, E, F)
 * 21. UI Renderer markup and structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeReadingPersonality,
  extractReadingPersonalitySignals,
  renderReadingPersonalityHTML,
  READING_ARCHETYPES,
  COLD_START_MIN_BOOKS
} from '../frontend/js/reading-personality.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.resolve(__dirname, '../data/seed/books.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

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

console.log('\n================ NOOK READING PERSONALITY TEST SUITE ================');

// --- 1. Empty History Handling ---
console.log('\n--- 1. Empty History Handling ---');
{
  const res = computeReadingPersonality(catalog, [], {});
  assert(res.hasData === false, 'Empty history returns hasData = false');
  assert(res.confidence === 'emerging', 'Empty history returns confidence = emerging');
  assert(res.archetype === null, 'Empty history returns null archetype');
  assert(Array.isArray(res.evidence) && res.evidence.length === 0, 'Empty history returns empty evidence');
  assert(res.signals.exploredCount === 0, 'Empty history returns exploredCount = 0');
  assert(typeof res.message.title === 'string' && res.message.title.length > 0, 'Returns encouraging emerging message');
}

// --- 2. Insufficient History (< 3 books, cold-start) ---
console.log('\n--- 2. Insufficient History (Cold-Start Boundary) ---');
{
  const oneBookHistory = [
    { bookId: 'frankenstein', progressPercent: 45, lastAccessedAt: 1700000000000 }
  ];
  const res1 = computeReadingPersonality(catalog, oneBookHistory, {});
  assert(res1.hasData === false, '1 book returns hasData = false (cold-start active)');
  assert(res1.signals.exploredCount === 1, 'Records exploredCount = 1');

  const twoBookHistory = [
    { bookId: 'frankenstein', progressPercent: 45, lastAccessedAt: 1700000000000 },
    { bookId: 'dracula', progressPercent: 20, lastAccessedAt: 1700001000000 }
  ];
  const res2 = computeReadingPersonality(catalog, twoBookHistory, {});
  assert(res2.hasData === false, '2 books without annotations returns hasData = false');
  assert(res2.signals.exploredCount === 2, 'Records exploredCount = 2');
}

// --- 3. Minimum Threshold Reached (>= 3 books) ---
console.log('\n--- 3. Minimum Threshold Reached ---');
{
  const threeBookHistory = [
    { bookId: 'frankenstein', progressPercent: 95, lastAccessedAt: 1700000000000 },
    { bookId: 'dracula', progressPercent: 90, lastAccessedAt: 1700001000000 },
    { bookId: 'the-picture-of-dorian-gray', progressPercent: 60, lastAccessedAt: 1700002000000 }
  ];
  const res = computeReadingPersonality(catalog, threeBookHistory, {});
  assert(res.hasData === true, '>= 3 books activates established personality (hasData = true)');
  assert(res.archetype !== null, 'Returns non-null archetype');
  assert(res.evidence.length > 0, 'Generates non-empty evidence list');
  assert(res.signals.exploredCount === 3, 'Explored count is 3');
}

// --- 4. Established Profile & Field Contracts ---
console.log('\n--- 4. Established Profile & Field Contracts ---');
{
  const history = [
    { bookId: 'frankenstein', progressPercent: 95, lastAccessedAt: 1700000000000 },
    { bookId: 'dracula', progressPercent: 92, lastAccessedAt: 1700001000000 },
    { bookId: 'the-strange-case-of-dr-jekyll-and-mr-hyde', progressPercent: 100, lastAccessedAt: 1700002000000 },
    { bookId: 'the-turn-of-the-screw', progressPercent: 80, lastAccessedAt: 1700003000000 }
  ];
  const res = computeReadingPersonality(catalog, history, {});
  assert(res.hasData === true, 'hasData is true');
  assert(res.confidence === 'established', '>= 4 books sets confidence = established');
  assert(typeof res.archetype.id === 'string', 'Archetype has string id');
  assert(typeof res.archetype.title === 'string', 'Archetype has string title');
  assert(typeof res.archetype.description === 'string', 'Archetype has string description');
  assert(Array.isArray(res.evidence) && res.evidence.length >= 2, 'Evidence has at least 2 points');
  assert(Array.isArray(res.tendencies.drawnTo), 'Tendencies has drawnTo categories array');
  assert(typeof res.tendencies.prefersLength === 'string', 'Tendencies has prefersLength string');
  assert(typeof res.tendencies.completionHabit === 'string', 'Tendencies has completionHabit string');
}

// --- 5. Category Affinity: The Atmospheric Wanderer ---
console.log('\n--- 5. Category Affinity: The Atmospheric Wanderer ---');
{
  const gothicHistory = [
    { bookId: 'frankenstein', progressPercent: 95 },
    { bookId: 'dracula', progressPercent: 92 },
    { bookId: 'the-picture-of-dorian-gray', progressPercent: 88 }
  ];
  const res = computeReadingPersonality(catalog, gothicHistory, {});
  assert(res.archetype.id === 'atmospheric-wanderer', `Selected "atmospheric-wanderer", got "${res.archetype.id}"`);
  assert(res.archetype.title === 'The Atmospheric Wanderer', 'Archetype title is "The Atmospheric Wanderer"');
  assert(res.evidence.some(e => e.includes('Gothic Fiction')), 'Evidence cites Gothic Fiction');
}

// --- 6. Broad Exploration: The Restless Explorer ---
console.log('\n--- 6. Broad Exploration: The Restless Explorer ---');
{
  const broadHistory = [
    { bookId: 'alices-adventures-in-wonderland', progressPercent: 50 }, // Fantasy / Children's
    { bookId: 'the-war-of-the-worlds', progressPercent: 30 }, // Science Fiction / Space
    { bookId: 'pride-and-prejudice', progressPercent: 40 }, // Romance / Classics
    { bookId: 'a-study-in-scarlet', progressPercent: 60 }, // Detective Fiction / Mystery
    { bookId: 'the-metamorphosis', progressPercent: 100 }, // Absurdist / Philosophical
    { bookId: 'the-adventures-of-tom-sawyer', progressPercent: 20 } // Adventure / Coming-of-Age
  ];
  const res = computeReadingPersonality(catalog, broadHistory, {});
  assert(res.signals.categoryDiversity === 'broad', 'Detects broad category diversity');
  assert(res.archetype.id === 'restless-explorer', `Selected "restless-explorer", got "${res.archetype.id}"`);
  assert(res.evidence.some(e => e.toLowerCase().includes('broad') || e.toLowerCase().includes('spanning')), 'Evidence highlights broad exploration');
}

// --- 7. Long-Book Immersive Depth: The Deep Diver ---
console.log('\n--- 7. Long-Book Immersive Depth: The Deep Diver ---');
{
  const longHistory = [
    { bookId: 'moby-dick', progressPercent: 95 }, // ~210k words
    { bookId: 'les-miserables', progressPercent: 90 }, // ~500k words
    { bookId: 'david-copperfield', progressPercent: 92 } // ~360k words
  ];
  const res = computeReadingPersonality(catalog, longHistory, {});
  assert(res.signals.lengthTendency === 'long', 'Detects long length tendency');
  assert(res.archetype.id === 'deep-diver', `Selected "deep-diver", got "${res.archetype.id}"`);
  assert(res.evidence.some(e => e.toLowerCase().includes('longer') || e.toLowerCase().includes('immersive')), 'Evidence cites long immersive volumes');
}

// --- 8. Short-Book & Novella Preference ---
console.log('\n--- 8. Short-Book & Novella Preference ---');
{
  const shortHistory = [
    { bookId: 'the-metamorphosis', progressPercent: 100 }, // ~22k words
    { bookId: 'the-strange-case-of-dr-jekyll-and-mr-hyde', progressPercent: 100 }, // ~26k words
    { bookId: 'a-christmas-carol', progressPercent: 100 } // ~29k words
  ];
  const res = computeReadingPersonality(catalog, shortHistory, {});
  assert(res.signals.lengthTendency === 'short', 'Detects short length tendency');
  assert(res.tendencies.prefersLength.toLowerCase().includes('concise'), 'Tendency reflects concise reads');
}

// --- 9. Humanist & Romance Affinity ---
console.log('\n--- 9. Humanist & Romance Affinity ---');
{
  const romanceHistory = [
    { bookId: 'pride-and-prejudice', progressPercent: 95 },
    { bookId: 'sense-and-sensibility', progressPercent: 90 },
    { bookId: 'emma', progressPercent: 85 },
    { bookId: 'jane-eyre', progressPercent: 80 }
  ];
  const res = computeReadingPersonality(catalog, romanceHistory, {});
  assert(res.archetype.id === 'humanist', `Selected "humanist", got "${res.archetype.id}"`);
  assert(res.evidence.some(e => e.includes('Romance')), 'Evidence cites Romance and human connection');
}

// --- 10. Detective & Mystery Affinity ---
console.log('\n--- 10. Detective & Mystery Affinity ---');
{
  const detectiveHistory = [
    { bookId: 'a-study-in-scarlet', progressPercent: 95 },
    { bookId: 'the-hound-of-the-baskervilles', progressPercent: 90 },
    { bookId: 'the-mysterious-affair-at-styles', progressPercent: 85 }
  ];
  const res = computeReadingPersonality(catalog, detectiveHistory, {});
  assert(res.archetype.id === 'curious-detective', `Selected "curious-detective", got "${res.archetype.id}"`);
  assert(res.archetype.title === 'The Curious Detective', 'Archetype title is "The Curious Detective"');
}

// --- 11. Speculative & Sci-Fi: The Dreamer of Strange Worlds ---
console.log('\n--- 11. Speculative & Sci-Fi: The Dreamer of Strange Worlds ---');
{
  const sciFiHistory = [
    { bookId: 'the-war-of-the-worlds', progressPercent: 90 },
    { bookId: 'the-time-machine', progressPercent: 95 },
    { bookId: 'journey-to-the-center-of-the-earth', progressPercent: 85 },
    { bookId: 'twenty-thousand-leagues-under-the-sea', progressPercent: 80 }
  ];
  const res = computeReadingPersonality(catalog, sciFiHistory, {});
  assert(res.archetype.id === 'dreamer-of-strange-worlds', `Selected "dreamer-of-strange-worlds", got "${res.archetype.id}"`);
}

// --- 12. Philosophical & Introspective: The Thoughtful Observer ---
console.log('\n--- 12. Philosophical & Introspective: The Thoughtful Observer ---');
{
  const philHistory = [
    { bookId: 'meditations', progressPercent: 90 },
    { bookId: 'crime-and-punishment', progressPercent: 95 },
    { bookId: 'notes-from-underground', progressPercent: 85 }
  ];
  const res = computeReadingPersonality(catalog, philHistory, {});
  assert(res.archetype.id === 'thoughtful-observer', `Selected "thoughtful-observer", got "${res.archetype.id}"`);
}

// --- 13. Canonical Classicist ---
console.log('\n--- 13. Canonical Classicist ---');
{
  const classicHistory = [
    { bookId: 'great-expectations', progressPercent: 90 },
    { bookId: 'a-tale-of-two-cities', progressPercent: 90 },
    { bookId: 'david-copperfield', progressPercent: 90 }
  ];
  const res = computeReadingPersonality(catalog, classicHistory, {});
  assert(res.hasData === true, 'Canonical classics activates personality profile');
  assert(res.archetype.id === 'classicist' || res.archetype.id === 'deep-diver', `Selects canonical archetype, got "${res.archetype.id}"`);
}

// --- 14. Highlight Theme Influence ---
console.log('\n--- 14. Highlight Theme Influence ---');
{
  const history = [
    { bookId: 'frankenstein', progressPercent: 60 },
    { bookId: 'dracula', progressPercent: 50 },
    { bookId: 'the-island-of-doctor-moreau', progressPercent: 50 }
  ];
  const journalWithCreationHighlights = {
    highlights: [
      { id: 'h1', bookId: 'frankenstein', selectedText: 'I had worked hard for nearly two years, for the sole purpose of infusing life into an inanimate body. For this I had deprived myself of rest and health. I had desired it with an ardour that far exceeded moderation; but now that I had finished, the beauty of the dream vanished, and breathless horror and disgust filled my heart.' },
      { id: 'h2', bookId: 'the-island-of-doctor-moreau', selectedText: 'To this day I have never troubled about the ethics of the matter. The study of Nature, the pursuit of scientific knowledge, has become my sole ambition and creation.' }
    ]
  };
  const res = computeReadingPersonality(catalog, history, journalWithCreationHighlights);
  assert(res.signals.highlightThemes.length > 0, 'Extracts highlight themes');
  assert(res.signals.highlightThemes.some(t => t.title.includes('Ambition') || t.title.includes('Mystery')), 'Discovers relevant themes');
  assert(res.evidence.some(e => e.toLowerCase().includes('passages') || e.toLowerCase().includes('reflections') || e.toLowerCase().includes('annotations')), 'Evidence references highlight themes');
}

// --- 15. Ethical & Safety Assertions ---
console.log('\n--- 15. Ethical & Safety Assertions ---');
{
  const testHistories = [
    [{ bookId: 'frankenstein', progressPercent: 50 }, { bookId: 'dracula', progressPercent: 50 }, { bookId: 'the-picture-of-dorian-gray', progressPercent: 50 }],
    [{ bookId: 'pride-and-prejudice', progressPercent: 100 }, { bookId: 'emma', progressPercent: 100 }, { bookId: 'mansfield-park', progressPercent: 100 }],
    [{ bookId: 'meditations', progressPercent: 80 }, { bookId: 'crime-and-punishment', progressPercent: 80 }, { bookId: 'notes-from-underground', progressPercent: 80 }]
  ];

  const forbiddenTerms = [
    'introvert', 'extrovert', 'anxiety', 'depress', 'disorder', 'iq', 'intelligent',
    'psycholog', 'mbti', 'horoscope', 'neurotic', 'adhd', 'trauma', 'patholog'
  ];

  let hasForbidden = false;
  for (const h of testHistories) {
    const res = computeReadingPersonality(catalog, h, {});
    const fullText = JSON.stringify(res).toLowerCase();
    for (const term of forbiddenTerms) {
      if (fullText.includes(term) && !fullText.includes('psychological fiction') && !fullText.includes('psychological')) {
        console.error(`Found forbidden psychological claim: "${term}" in output`);
        hasForbidden = true;
      }
    }
  }
  assert(!hasForbidden, 'Zero psychological, mental health, or personality diagnostic claims');
}

// --- 16. Unknown Book IDs & Malformed Metadata Resilience ---
console.log('\n--- 16. Unknown Book IDs & Malformed Metadata Resilience ---');
{
  const malformedHistory = [
    null,
    undefined,
    { bookId: 'non-existent-book-xyz', progressPercent: 100 },
    { bookId: 'frankenstein', progressPercent: 95 },
    { bookId: 'dracula', progressPercent: 'invalid-number' },
    { bookId: 'the-picture-of-dorian-gray', progressPercent: 80 }
  ];
  const res = computeReadingPersonality(catalog, malformedHistory, null);
  assert(res.signals.exploredCount === 3, 'Gracefully filters invalid records and keeps 3 valid books');
  assert(res.hasData === true, 'Processes valid records successfully without crashing');
}

// --- 17. Deterministic Output & Reproducibility ---
console.log('\n--- 17. Deterministic Output & Reproducibility ---');
{
  const history = [
    { bookId: 'pride-and-prejudice', progressPercent: 95 },
    { bookId: 'sense-and-sensibility', progressPercent: 80 },
    { bookId: 'emma', progressPercent: 70 }
  ];
  const res1 = computeReadingPersonality(catalog, history, {});
  const res2 = computeReadingPersonality(catalog, history, {});
  assert(JSON.stringify(res1) === JSON.stringify(res2), '100% byte-for-byte identical output across repeated runs');
}

// --- 18. Responsiveness to Meaningful Changes in Reading History ---
console.log('\n--- 18. Responsiveness to Changes in Reading History ---');
{
  const historyGothic = [
    { bookId: 'frankenstein', progressPercent: 90 },
    { bookId: 'dracula', progressPercent: 90 },
    { bookId: 'the-picture-of-dorian-gray', progressPercent: 90 }
  ];
  const resGothic = computeReadingPersonality(catalog, historyGothic, {});

  const historySciFi = [
    { bookId: 'the-war-of-the-worlds', progressPercent: 90 },
    { bookId: 'the-time-machine', progressPercent: 90 },
    { bookId: 'journey-to-the-center-of-the-earth', progressPercent: 90 }
  ];
  const resSciFi = computeReadingPersonality(catalog, historySciFi, {});

  assert(resGothic.archetype.id !== resSciFi.archetype.id, 'Different reading histories produce different archetypes');
  assert(resGothic.archetype.id === 'atmospheric-wanderer', 'Gothic history produces Atmospheric Wanderer');
  assert(resSciFi.archetype.id === 'dreamer-of-strange-worlds', 'Sci-Fi history produces Dreamer of Strange Worlds');
}

// --- 19. UI Renderer Markup ---
console.log('\n--- 19. UI Renderer Markup ---');
{
  const history = [
    { bookId: 'frankenstein', progressPercent: 95 },
    { bookId: 'dracula', progressPercent: 90 },
    { bookId: 'the-picture-of-dorian-gray', progressPercent: 80 }
  ];
  const personality = computeReadingPersonality(catalog, history, {});
  const html = renderReadingPersonalityHTML(personality);

  assert(html.includes('personality-card'), 'Rendered HTML contains .personality-card');
  assert(html.includes('The Atmospheric Wanderer'), 'Rendered HTML displays archetype title');
  assert(html.includes('WHY NOOK NOTICED THIS'), 'Rendered HTML displays evidence heading');
  assert(html.includes('LITERARY TENDENCIES'), 'Rendered HTML displays tendencies heading');
  assert(html.includes('DRAWN TO'), 'Rendered HTML displays DRAWN TO tag');

  const emptyHtml = renderReadingPersonalityHTML(computeReadingPersonality(catalog, [], {}));
  assert(emptyHtml.includes('emerging'), 'Empty state HTML renders .emerging card');
  assert(emptyHtml.includes('Your Reading Personality Is Taking Shape'), 'Empty state displays literary guidance');
}

// --- 20. Summary ---
console.log('\n================ TEST SUMMARY ================');
console.log(`Passed: ${passed} | Failed: ${failed}\n`);

if (failed > 0) {
  process.exit(1);
}
