import fs from 'fs';
import { paginateBook } from '../frontend/js/pagination.js';

const books = ['pride-and-prejudice', 'the-adventures-of-sherlock-holmes', 'war-and-peace', 'frankenstein'];

for (const bookId of books) {
  const content = JSON.parse(fs.readFileSync(`./frontend/data/books/${bookId}/content.json`, 'utf8'));
  const pagination = paginateBook(content, 'md');
  console.log(`\n=== Book: ${bookId} (Total Pages: ${pagination.totalPages}) ===`);
  
  // Inspect pages with low word count or low paragraphs that are NOT last page of chapter
  for (let i = 1; i <= Math.min(pagination.totalPages, 50); i++) {
    const p = pagination.getPage(i);
    const isLastOfChapter = p.chapterPageNumber === p.chapterTotalPages;
    if (p.wordCount < 100 && !isLastOfChapter) {
      console.log(`[LOW NON-LAST PAGE] Page ${i} (Ch ${p.chapterNumber}, ChPage ${p.chapterPageNumber}/${p.chapterTotalPages}): ${p.paragraphs.length} paras, ${p.wordCount} words`);
      console.log(`   Preview:`, p.paragraphs.map(x => x.slice(0, 60)));
    }
    if (i === 22) {
      console.log(`[INSPECT PAGE 22] (Ch ${p.chapterNumber}, ChPage ${p.chapterPageNumber}/${p.chapterTotalPages}): ${p.paragraphs.length} paras, ${p.wordCount} words, isLastOfChapter: ${isLastOfChapter}`);
      console.log(`   Paras:`, p.paragraphs);
    }
  }
}
