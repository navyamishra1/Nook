import { NOOK_CATALOG } from '../frontend/js/catalog-data.js';
import fs from 'fs';
import path from 'path';

console.log('Testing Frontend Catalog and Content files...');
console.log('Total books in NOOK_CATALOG:', NOOK_CATALOG.length);

if (NOOK_CATALOG.length !== 105) {
  throw new Error(`Expected 105 books, found ${NOOK_CATALOG.length}`);
}

// Verify each book has matching frontend/data/books/{id}/content.json
let totalWords = 0;
let totalChapters = 0;

for (const book of NOOK_CATALOG) {
  if (!book.id || !book.title || !book.author) {
    throw new Error(`Invalid book record: ${JSON.stringify(book)}`);
  }
  if (book.word_count < 1000) {
    throw new Error(`Book ${book.id} word count below threshold: ${book.word_count}`);
  }
  if (!book.cover_config || !book.cover_config.palette) {
    throw new Error(`Book ${book.id} missing cover_config palette`);
  }

  totalWords += book.word_count;

  const contentFile = path.resolve(`frontend/data/books/${book.id}/content.json`);
  if (!fs.existsSync(contentFile)) {
    throw new Error(`Frontend content file missing: ${contentFile}`);
  }

  const raw = fs.readFileSync(contentFile, 'utf-8');
  const payload = JSON.parse(raw);
  if (!payload.chapters || payload.chapters.length === 0) {
    throw new Error(`Frontend book ${book.id} has no chapters`);
  }

  for (const ch of payload.chapters) {
    if (!ch.title || !ch.content || ch.content.trim().length === 0) {
      throw new Error(`Book ${book.id} chapter ${ch.number} has empty content or title`);
    }
  }

  totalChapters += payload.chapters.length;
}

console.log('==================================================');
console.log('FRONTEND CATALOG CONTRACT: 100% VALIDATED');
console.log(`Total Books: ${NOOK_CATALOG.length}`);
console.log(`Total Chapters across catalog: ${totalChapters.toLocaleString()}`);
console.log(`Total Words across catalog: ${totalWords.toLocaleString()}`);
console.log('==================================================');
