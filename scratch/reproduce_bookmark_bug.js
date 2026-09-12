const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  console.log('--- REPRODUCING BOOKMARK PERSISTENCE & RESTORATION BUG ---');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9227/json', (res) => {
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

          // Initialize app
          await evaluate(`
            localStorage.clear();
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length >= 105) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  resolve();
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          console.log('\nStep 1: Open Frankenstein in Reader...');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein' });
              const checkReader = () => {
                if (window.nookApp.reader && window.nookApp.reader.contentData && !window.nookApp.reader.isLoading) {
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(checkReader, 50);
                }
              };
              checkReader();
            })
          `);

          console.log('Step 2: Navigate to PAGE 8...');
          await evaluate(`
            window.nookApp.reader.goToPage(8);
          `);
          await new Promise((r) => setTimeout(r, 400));

          const page8State = await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const p = r.pagination.getPage(r.currentPageNumber);
              return {
                currentPageNumber: r.currentPageNumber,
                currentChapterIndex: r.currentChapterIndex,
                chapterNumber: p.chapterNumber,
                chapterTitle: p.chapterTitle,
                chapterPageNumber: p.chapterPageNumber,
                totalPages: r.pagination.totalPages
              };
            })()
          `);
          console.log('Page 8 Reader State:', page8State);

          console.log('\nStep 3: Place a bookmark on PAGE 8 (Crimson Silk)...');
          await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const p = r.pagination.getPage(8);
              window.nookApp.journal.addBookmark({
                bookId: 'frankenstein',
                bookTitle: r.bookMeta.title,
                author: r.bookMeta.author,
                chapterNumber: p.chapterNumber,
                chapterTitle: p.chapterTitle,
                pageNumber: 8,
                totalPages: r.pagination.totalPages,
                bookmarkStyle: 'crimson-silk'
              });
              r.render();
            })()
          `);

          const savedBookmark = await evaluate(`
            window.nookApp.journal.getPageBookmark('frankenstein', 8);
          `);
          console.log('Saved Bookmark in localStorage:', savedBookmark);

          const readingProgressOnPage8 = await evaluate(`
            JSON.parse(localStorage.getItem('nook_reading_progress'));
          `);
          console.log('Reading Progress stored on Page 8:', readingProgressOnPage8);

          console.log('\nStep 4: Leave book (Navigate to Home)...');
          await evaluate(`
            window.nookApp.navigateTo('home');
          `);
          await new Promise((r) => setTimeout(r, 400));

          console.log('\nStep 5: Reopen the same book via normal book flow (click Continue Reading from Home)...');
          await evaluate(`
            const continueCard = document.querySelector('.continue-card');
            if (continueCard) continueCard.click();
          `);
          await new Promise((r) => setTimeout(r, 800));

          const reopenState = await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const p = r.pagination.getPage(r.currentPageNumber);
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', r.currentPageNumber);
              const ribbonEl = document.querySelector('#readerPaperRibbon');
              return {
                currentReaderPage: r.currentPageNumber,
                currentChapterNumber: p.chapterNumber,
                currentChapterTitle: p.chapterTitle,
                currentChapterPageNumber: p.chapterPageNumber,
                bookmarkFoundForCurrentPage: bm,
                ribbonRenderedOnPage: !!ribbonEl,
                expectedPage: 8,
                bugReproduced: r.currentPageNumber !== 8
              };
            })()
          `);
          console.log('\n--- REOPEN RESULT ---');
          console.log(JSON.stringify(reopenState, null, 2));

          console.log('\nStep 6: Also test reopen via Details page ("Continue reading")...');
          await evaluate(`
            window.nookApp.navigateTo('details', { bookId: 'frankenstein' });
          `);
          await new Promise((r) => setTimeout(r, 400));
          await evaluate(`
            const readNowBtn = document.querySelector('#detailsReadNowBtn');
            if (readNowBtn) readNowBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 800));

          const reopenDetailsState = await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const p = r.pagination.getPage(r.currentPageNumber);
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', r.currentPageNumber);
              const ribbonEl = document.querySelector('#readerPaperRibbon');
              return {
                currentReaderPage: r.currentPageNumber,
                currentChapterNumber: p.chapterNumber,
                currentChapterTitle: p.chapterTitle,
                bookmarkFoundForCurrentPage: bm,
                ribbonRenderedOnPage: !!ribbonEl,
                bugReproduced: r.currentPageNumber !== 8
              };
            })()
          `);
          console.log('\n--- REOPEN VIA DETAILS RESULT ---');
          console.log(JSON.stringify(reopenDetailsState, null, 2));

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('Error:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
