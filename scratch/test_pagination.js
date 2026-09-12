import fs from 'fs';
import path from 'path';
import { paginateBook } from '../frontend/js/pagination.js';

console.log('Testing Nook Deterministic Pagination Engine...');

// Test 1: Pride and Prejudice
const prideContent = JSON.parse(fs.readFileSync('data/books/pride-and-prejudice/content.json', 'utf8'));

const pSm = paginateBook(prideContent, 'sm');
const pMd = paginateBook(prideContent, 'md');
const pLg = paginateBook(prideContent, 'lg');

console.log(`Pride and Prejudice:`);
console.log(`  sm (compact): ${pSm.totalPages} digital pages (${pSm.totalWords.toLocaleString()} words)`);
console.log(`  md (default): ${pMd.totalPages} digital pages (${pMd.totalWords.toLocaleString()} words)`);
console.log(`  lg (large):   ${pLg.totalPages} digital pages (${pLg.totalWords.toLocaleString()} words)`);

// Assert pagination properties
if (pSm.totalPages >= pMd.totalPages) {
  throw new Error(`Expected compact font to produce fewer or equal pages than default font`);
}
if (pMd.totalPages >= pLg.totalPages) {
  throw new Error(`Expected large font to produce more pages than default font`);
}

// Test page navigation
const page1 = pMd.getPage(1);
console.log('Page 1 of Pride:', page1.chapterTitle, `(Chapter page ${page1.chapterPageNumber}/${page1.chapterTotalPages})`);
if (!page1.isFirstPageOfChapter) {
  throw new Error('Page 1 should be first page of chapter 1');
}

const page37 = pMd.getPage(37);
console.log('Page 37 of Pride:', page37.chapterTitle, `(Chapter page ${page37.chapterPageNumber}/${page37.chapterTotalPages})`);
if (page37.pageNumber !== 37) {
  throw new Error(`Expected pageNumber to be 37, got ${page37.pageNumber}`);
}

// Test chapter page lookup
const ch2FirstPage = pMd.getPageForChapter(1, 1);
console.log('Chapter 2 first page number:', ch2FirstPage.pageNumber);
if (ch2FirstPage.chapterNumber !== 2) {
  throw new Error(`Expected chapter 2, got ${ch2FirstPage.chapterNumber}`);
}

// Test percentage roundtrip
const p50 = pMd.getPageForProgressPercent(50);
console.log('Page at 50% progress:', p50.pageNumber, `of ${pMd.totalPages}`);
const pct50 = pMd.getProgressPercentForPage(p50.pageNumber);
console.log('Calculated percentage back:', pct50);
if (Math.abs(pct50 - 50) > 2) {
  throw new Error(`Percentage roundtrip failed: expected ~50%, got ${pct50}%`);
}

console.log('==================================================');
console.log('DIGITAL PAGINATION ENGINE: 100% PASS');
console.log('==================================================');
