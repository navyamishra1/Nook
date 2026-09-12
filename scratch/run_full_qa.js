const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('Starting full browser QA suite for Nook Covers & Reader Pagination...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const pages = JSON.parse(data);
        const targetPage = pages.find((p) => p.url.includes('localhost:8000'));
        const ws = new globalThis.WebSocket(targetPage.webSocketDebuggerUrl);

        let id = 1;
        const pending = new Map();

        ws.addEventListener('open', async () => {
          function send(method, params = {}) {
            return new Promise((resolve) => {
              const msgId = id++;
              pending.set(msgId, resolve);
              ws.send(JSON.stringify({ id: msgId, method, params }));
            });
          }

          ws.addEventListener('message', (event) => {
            const parsed = JSON.parse(event.data);
            if (parsed.id && pending.has(parsed.id)) {
              pending.get(parsed.id)(parsed.result);
              pending.delete(parsed.id);
            }
          });

          await send('Runtime.enable');
          await send('Page.enable');
          await send('DOM.enable');

          async function evaluate(expression, awaitPromise = true) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
            if (!res) return null;
            if (res.exceptionDetails) {
              console.error('Eval exception:', res.exceptionDetails);
            }
            return res.result ? res.result.value : res;
          }

          async function setViewport(width, height) {
            await send('Emulation.setDeviceMetricsOverride', {
              width,
              height,
              deviceScaleFactor: 1,
              mobile: width < 600
            });
          }

          async function screenshot(filename) {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            if (res && res.data) {
              const buf = Buffer.from(res.data, 'base64');
              const fullPath = path.join(artifactDir, filename);
              fs.writeFileSync(fullPath, buf);
              console.log(`  -> Captured screenshot: ${filename}`);
            }
          }

          await setViewport(1280, 850);

          // 1. Home Page Verification
          console.log('\n--- 1. TESTING HOME PAGE & COVER RENDERING ---');
          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length >= 105) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  window.nookApp.navigateTo('home');
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          const homeStats = await evaluate(`
            (() => {
              const covers = Array.from(document.querySelectorAll('img[src*="assets/covers"]'));
              return {
                catalogLength: window.nookApp.catalog.length,
                renderedCoversCount: covers.length,
                heroTitle: document.querySelector('.hero-book-title, .hero-title')?.textContent.trim()
              };
            })()
          `);
          console.log('Home stats:', homeStats);
          await screenshot('qa_home_pastel_covers.png');

          // 2. Library Page Verification
          console.log('\n--- 2. TESTING LIBRARY PAGE & 105 COVERS ---');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('library');
              setTimeout(resolve, 500);
            })
          `);

          const libStats = await evaluate(`
            (() => {
              const cards = document.querySelectorAll('.library-book-card, .book-card');
              const coverImgs = Array.from(document.querySelectorAll('.library-book-card img, .book-card img'));
              return {
                cardsCount: cards.length,
                coverImgsCount: coverImgs.length
              };
            })()
          `);
          console.log('Library stats:', libStats);
          await screenshot('qa_library_pastel_grid.png');

          // 3. Book Details Page Verification
          console.log('\n--- 3. TESTING BOOK DETAILS PAGE ---');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'pride-and-prejudice' });
              setTimeout(resolve, 400);
            })
          `);
          await screenshot('qa_details_pride_and_prejudice.png');

          // 4. Test 8 Required Books in Reader
          const testBooks = [
            { id: 'pride-and-prejudice', title: 'Pride and Prejudice', chapter: 1 },
            { id: 'frankenstein', title: 'Frankenstein', chapter: 4 },
            { id: 'alices-adventures-in-wonderland', title: "Alice's Adventures in Wonderland", chapter: 1 },
            { id: 'the-great-gatsby', title: 'The Great Gatsby', chapter: 1 },
            { id: 'the-adventures-of-sherlock-holmes', title: 'The Adventures of Sherlock Holmes', chapter: 1 },
            { id: 'jane-eyre', title: 'Jane Eyre', chapter: 1 },
            { id: 'dracula', title: 'Dracula', chapter: 1 },
            { id: 'war-and-peace', title: 'War and Peace', chapter: 1 }
          ];

          console.log('\n--- 4. TESTING READER PAGINATION & FLOW FOR 8 TEST BOOKS ---');
          const readerResults = [];

          for (const book of testBooks) {
            console.log(`\nTesting Reader for: ${book.title} (${book.id})`);
            await evaluate(`
              new Promise((resolve) => {
                window.nookApp.navigateTo('reader', { bookId: '${book.id}', chapterNumber: ${book.chapter} });
                const checkReader = () => {
                  if (window.nookApp.reader && window.nookApp.reader.contentData && !window.nookApp.reader.isLoading) {
                    setTimeout(resolve, 400);
                  } else {
                    setTimeout(checkReader, 50);
                  }
                };
                checkReader();
              })
            `);

            const pageInfo = await evaluate(`
              (() => {
                const sheet = document.querySelector('#readerPaperPage');
                const prose = document.querySelector('#readerProseContent');
                const pageNumEl = document.querySelector('.reader-paper-page-number');
                const paragraphs = Array.from(prose ? prose.querySelectorAll('p') : []);
                const text = prose ? prose.textContent.trim() : '';
                const wordCount = text ? text.split(/\\s+/).filter(Boolean).length : 0;
                
                const sheetRect = sheet ? sheet.getBoundingClientRect() : null;
                const proseRect = prose ? prose.getBoundingClientRect() : null;
                
                return {
                  bookId: '${book.id}',
                  chapterTitle: window.nookApp.reader.contentData?.chapters?.[window.nookApp.reader.currentChapterIndex]?.title || '',
                  currentPage: window.nookApp.reader.currentPageNumber,
                  totalPages: window.nookApp.reader.pagination?.totalPages || 0,
                  wordsOnPage: wordCount,
                  paragraphCount: paragraphs.length,
                  pageNumberText: pageNumEl ? pageNumEl.textContent.trim() : '',
                  sheetWidth: sheetRect ? Math.round(sheetRect.width) : 0,
                  sheetHeight: sheetRect ? Math.round(sheetRect.height) : 0,
                  aspectRatio: sheetRect ? (sheetRect.width / sheetRect.height).toFixed(3) : 0,
                  proseHeight: proseRect ? Math.round(proseRect.height) : 0
                };
              })()
            `);

            console.log(`  Page 1 info:`, pageInfo);
            readerResults.push(pageInfo);

            const shotName = `qa_reader_${book.id.replace(/-/g, '_')}_p1.png`;
            await screenshot(shotName);

            // Test Next Page Arrow Navigation
            await evaluate(`
              (() => {
                const nextBtn = document.querySelector('#readerPaperCornerNext');
                if (nextBtn) nextBtn.click();
              })()
            `);
            await new Promise((r) => setTimeout(r, 800)); // Wait for flip transition

            const page2Info = await evaluate(`
              (() => {
                const prose = document.querySelector('#readerProseContent');
                const pageNumEl = document.querySelector('.reader-paper-page-number');
                const paragraphs = Array.from(prose ? prose.querySelectorAll('p') : []);
                const text = prose ? prose.textContent.trim() : '';
                const wordCount = text ? text.split(/\\s+/).filter(Boolean).length : 0;
                const proseRect = prose ? prose.getBoundingClientRect() : null;
                return {
                  currentPage: window.nookApp.reader.currentPageNumber,
                  wordsOnPage: wordCount,
                  paragraphCount: paragraphs.length,
                  pageNumberText: pageNumEl ? pageNumEl.textContent.trim() : '',
                  proseHeight: proseRect ? Math.round(proseRect.height) : 0
                };
              })()
            `);
            console.log(`  Page 2 info:`, page2Info);

            const shotNameP2 = `qa_reader_${book.id.replace(/-/g, '_')}_p2.png`;
            await screenshot(shotNameP2);
          }

          // 5. Test Responsive Viewports on Pride and Prejudice
          console.log('\n--- 5. TESTING RESPONSIVE VIEWPORTS ---');
          // Tablet
          await setViewport(800, 1024);
          await new Promise((r) => setTimeout(r, 400));
          await screenshot('qa_reader_tablet_800.png');

          // Mobile
          await setViewport(390, 844);
          await new Promise((r) => setTimeout(r, 400));
          await screenshot('qa_reader_mobile_390.png');

          console.log('\n================ QA SUMMARY REPORT ================');
          console.log(`Catalog Count: ${homeStats.catalogLength} / 105`);
          console.log(`Library Cards: ${libStats.cardsCount} / 105`);
          console.log('Tested 8 Books in Reader with filled pages:');
          for (const r of readerResults) {
            console.log(`  - ${r.bookId}: Page ${r.currentPage}/${r.totalPages} (${r.pageNumberText}), ${r.wordsOnPage} words across ${r.paragraphCount} paras, Sheet: ${r.sheetWidth}x${r.sheetHeight} (ratio ${r.aspectRatio}, expected ~0.647)`);
          }
          console.log('====================================================\n');

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('QA Error:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
