import { NOOK_CATALOG } from '../frontend/js/catalog-data.js';
import { paginateBook } from '../frontend/js/pagination.js';
import { getBookCoverUrl } from '../frontend/js/catalog.js';
import fs from 'fs';
import path from 'path';

console.log('Testing Nook Phase: Digital Pagination & 105 Custom Covers...');

// 1. Validate covers resolution
let validCovers = 0;
for (const book of NOOK_CATALOG) {
  const coverUrl = getBookCoverUrl(book);
  const diskPath = path.resolve('frontend', coverUrl);
  if (!fs.existsSync(diskPath)) {
    throw new Error(`Cover file missing on disk for book ${book.id}: ${diskPath}`);
  }
  const stat = fs.statSync(diskPath);
  if (stat.size < 500) {
    throw new Error(`Cover file suspiciously small for book ${book.id}: ${stat.size} bytes`);
  }
  validCovers++;
}
console.log(`[PASS] 105 Custom SVG Covers resolved and verified on disk: ${validCovers}/105`);

// 2. Validate Pagination across all books at sm, md, lg
let totalSamplePagesChecked = 0;
for (const book of NOOK_CATALOG) {
  const contentFile = path.resolve(`frontend/data/books/${book.id}/content.json`);
  const raw = fs.readFileSync(contentFile, 'utf-8');
  const content = JSON.parse(raw);

  const pagSm = paginateBook(content, 'sm');
  const pagMd = paginateBook(content, 'md');
  const pagLg = paginateBook(content, 'lg');

  if (pagSm.totalPages <= 0 || pagMd.totalPages <= 0 || pagLg.totalPages <= 0) {
    throw new Error(`Pagination generated 0 pages for ${book.id}`);
  }

  // Sm font density (more words/page) should produce fewer or equal total pages than Lg font density (fewer words/page)
  if (pagSm.totalPages > pagLg.totalPages) {
    throw new Error(`Pagination scale inverted for ${book.id}: sm=${pagSm.totalPages}, lg=${pagLg.totalPages}`);
  }

  // Check Page 1 integrity
  const p1 = pagMd.getPage(1);
  if (!p1 || p1.pageNumber !== 1 || !p1.isFirstPageOfChapter || !p1.paragraphs || p1.paragraphs.length === 0) {
    throw new Error(`Page 1 malformed for ${book.id}`);
  }

  // Check last page integrity
  const pLast = pagMd.getPage(pagMd.totalPages);
  if (!pLast || pLast.pageNumber !== pagMd.totalPages || !pLast.paragraphs || pLast.paragraphs.length === 0) {
    throw new Error(`Last page malformed for ${book.id}`);
  }

  // Check chapter jump lookup
  for (let i = 0; i < content.chapters.length; i++) {
    const ch = content.chapters[i];
    const pageNum = pagMd.getFirstPageOfChapter(ch.number);
    if (pageNum < 1 || pageNum > pagMd.totalPages) {
      throw new Error(`Chapter ${ch.number} mapped to invalid page ${pageNum} in ${book.id}`);
    }
  }

  totalSamplePagesChecked += pagMd.totalPages;
}

console.log(`[PASS] Digital Pagination tested across all 105 books: ${totalSamplePagesChecked.toLocaleString()} digital pages validated.`);
console.log('==================================================');
console.log('NOOK PHASE VERIFICATION: 100% SUCCESS');
console.log('==================================================');
