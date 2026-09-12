const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('================================================================');
  console.log('NOOK BOOKMARK RESTORATION & NAVIGATION REGRESSION TEST SUITE');
  console.log('================================================================');

  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9229/json', (res) => {
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

          async function screenshot(filename) {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            if (res && res.data) {
              const buf = Buffer.from(res.data, 'base64');
              const fullPath = path.join(artifactDir, filename);
              fs.writeFileSync(fullPath, buf);
              console.log(`    [Screenshot saved: ${filename}]`);
            }
          }

          // Step 0: Initialize app
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

          let testsPassed = 0;
          let testsFailed = 0;

          function assert(condition, message) {
            if (condition) {
              console.log(`  ✓ ${message}`);
              testsPassed++;
            } else {
              console.error(`  ✗ FAILED: ${message}`);
              testsFailed++;
            }
          }

          // ====================================================================
          // TEST 1: REPRODUCE USER REPORTED FLOW (PAGE 8)
          // ====================================================================
          console.log('\n--- TEST 1: User Reported Flow (Page 8 Bookmark & Reopen) ---');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein' });
              const check = () => {
                if (window.nookApp.reader && window.nookApp.reader.contentData && !window.nookApp.reader.isLoading) {
                  setTimeout(resolve, 200);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          await evaluate(`window.nookApp.reader.goToPage(8);`);
          await new Promise((r) => setTimeout(r, 800));

          // Place bookmark on page 8
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

          // Leave book
          await evaluate(`window.nookApp.navigateTo('home');`);
          await new Promise((r) => setTimeout(r, 300));

          // Reopen book via Continue Reading
          await evaluate(`
            const card = document.querySelector('.continue-card');
            if (card) card.click();
          `);
          await new Promise((r) => setTimeout(r, 800));

          const test1Result = await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const ribbon = document.querySelector('#readerPaperRibbon');
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', r.currentPageNumber);
              return {
                page: r.currentPageNumber,
                ribbonVisible: !!ribbon,
                ribbonClasses: ribbon?.className,
                bookmarkFound: !!bm,
                style: bm?.bookmarkStyle
              };
            })()
          `);

          assert(test1Result.page === 8, `Reopened reader lands exactly on Page 8 (actual: Page ${test1Result.page})`);
          assert(test1Result.ribbonVisible === true, `Bookmark ribbon is visually present on Page 8`);
          assert(test1Result.style === 'crimson-silk', `Bookmark style is crimson-silk`);
          await screenshot('test1_reopen_page_8_bookmark.png');

          // ====================================================================
          // TEST 2: TEST MULTIPLE PAGES (1, 2, 6, 8, 10, 20)
          // ====================================================================
          console.log('\n--- TEST 2: Multi-Page Bookmark & Reopen Suite (Pages 1, 2, 6, 10, 20) ---');
          const testPages = [1, 2, 6, 10, 20];
          for (const pNum of testPages) {
            await evaluate(`window.nookApp.reader.goToPage(${pNum});`);
            await new Promise((r) => setTimeout(r, 800));

            // Place bookmark
            await evaluate(`
              (() => {
                const r = window.nookApp.reader;
                const p = r.pagination.getPage(${pNum});
                window.nookApp.journal.addBookmark({
                  bookId: 'frankenstein',
                  bookTitle: r.bookMeta.title,
                  author: r.bookMeta.author,
                  chapterNumber: p.chapterNumber,
                  chapterTitle: p.chapterTitle,
                  pageNumber: ${pNum},
                  totalPages: r.pagination.totalPages,
                  bookmarkStyle: 'sage-linen'
                });
                r.render();
              })()
            `);

            // Leave book to Library
            await evaluate(`window.nookApp.navigateTo('library');`);
            await new Promise((r) => setTimeout(r, 300));

            // Select book again and Read Now from Details
            await evaluate(`
              (() => {
                window.nookApp.handleBookSelected('frankenstein');
              })()
            `);
            await new Promise((r) => setTimeout(r, 300));
            await evaluate(`
              (() => {
                const btn = document.querySelector('#detailsReadNowBtn');
                if (btn) btn.click();
              })()
            `);
            await new Promise((r) => setTimeout(r, 800));

            const res = await evaluate(`
              (() => {
                const r = window.nookApp.reader;
                const ribbon = document.querySelector('#readerPaperRibbon');
                return {
                  page: r.currentPageNumber,
                  ribbonVisible: !!ribbon
                };
              })()
            `);

            assert(res.page === pNum, `Reopening Page ${pNum} restored exact Page ${pNum} (actual: Page ${res.page})`);
            assert(res.ribbonVisible === true, `Bookmark ribbon visible on Page ${pNum}`);
          }

          // ====================================================================
          // TEST 3: MULTIPLE COEXISTING BOOKMARKS WITH DIFFERENT STYLES
          // ====================================================================
          console.log('\n--- TEST 3: Multiple Coexisting Bookmarks with Distinct Styles ---');
          // Clear journal bookmarks for fresh multi-bookmark test
          await evaluate(`
            localStorage.removeItem('nook_journal');
          `);

          // Place 3 bookmarks in Pride and Prejudice
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'pride-and-prejudice' });
              const check = () => {
                if (window.nookApp.reader && window.nookApp.reader.contentData && !window.nookApp.reader.isLoading) {
                  setTimeout(resolve, 200);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          // Bookmark Page 8 (Crimson Silk)
          await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const p = r.pagination.getPage(8);
              window.nookApp.journal.addBookmark({
                bookId: 'pride-and-prejudice',
                bookTitle: r.bookMeta.title,
                author: r.bookMeta.author,
                chapterNumber: p.chapterNumber,
                chapterTitle: p.chapterTitle,
                pageNumber: 8,
                totalPages: r.pagination.totalPages,
                bookmarkStyle: 'crimson-silk'
              });
            })()
          `);

          // Bookmark Page 20 (Midnight Gold)
          await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const p = r.pagination.getPage(20);
              window.nookApp.journal.addBookmark({
                bookId: 'pride-and-prejudice',
                bookTitle: r.bookMeta.title,
                author: r.bookMeta.author,
                chapterNumber: p.chapterNumber,
                chapterTitle: p.chapterTitle,
                pageNumber: 20,
                totalPages: r.pagination.totalPages,
                bookmarkStyle: 'midnight-gold'
              });
            })()
          `);

          // Bookmark Page 40 (Sage Linen)
          await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const p = r.pagination.getPage(40);
              window.nookApp.journal.addBookmark({
                bookId: 'pride-and-prejudice',
                bookTitle: r.bookMeta.title,
                author: r.bookMeta.author,
                chapterNumber: p.chapterNumber,
                chapterTitle: p.chapterTitle,
                pageNumber: 40,
                totalPages: r.pagination.totalPages,
                bookmarkStyle: 'sage-linen'
              });
            })()
          `);

          // Check bookmarks count
          const bms = await evaluate(`window.nookApp.journal.getBookmarks('pride-and-prejudice')`);
          assert(bms.length === 3, `All 3 bookmarks exist in storage without overwriting (count: ${bms.length})`);

          // Navigate to Page 8 and check
          await evaluate(`window.nookApp.reader.goToPage(8);`);
          await new Promise((r) => setTimeout(r, 800));
          const p8Check = await evaluate(`
            (() => {
              const ribbon = document.querySelector('#readerPaperRibbon');
              return {
                page: window.nookApp.reader.currentPageNumber,
                ribbonVisible: !!ribbon,
                ribbonClasses: ribbon?.className || ''
              };
            })()
          `);
          assert(p8Check.page === 8 && p8Check.ribbonClasses.includes('style-crimson-silk'), `Page 8 has Crimson Silk bookmark`);

          // Navigate to Page 20 and check
          await evaluate(`window.nookApp.reader.goToPage(20);`);
          await new Promise((r) => setTimeout(r, 800));
          const p20Check = await evaluate(`
            (() => {
              const ribbon = document.querySelector('#readerPaperRibbon');
              return {
                page: window.nookApp.reader.currentPageNumber,
                ribbonVisible: !!ribbon,
                ribbonClasses: ribbon?.className || ''
              };
            })()
          `);
          assert(p20Check.page === 20 && p20Check.ribbonClasses.includes('style-midnight-gold'), `Page 20 has Midnight Gold bookmark`);

          // Navigate to Page 40 and check
          await evaluate(`window.nookApp.reader.goToPage(40);`);
          await new Promise((r) => setTimeout(r, 800));
          const p40Check = await evaluate(`
            (() => {
              const ribbon = document.querySelector('#readerPaperRibbon');
              return {
                page: window.nookApp.reader.currentPageNumber,
                ribbonVisible: !!ribbon,
                ribbonClasses: ribbon?.className || ''
              };
            })()
          `);
          assert(p40Check.page === 40 && p40Check.ribbonClasses.includes('style-sage-linen'), `Page 40 has Sage Linen bookmark`);

          // Navigate to Page 15 (unbookmarked) and check
          await evaluate(`window.nookApp.reader.goToPage(15);`);
          await new Promise((r) => setTimeout(r, 800));
          const p15Check = await evaluate(`
            (() => {
              const ribbon = document.querySelector('#readerPaperRibbon');
              return { ribbonVisible: !!ribbon };
            })()
          `);
          assert(p15Check.ribbonVisible === false, `Page 15 has no bookmark ribbon`);

          // ====================================================================
          // TEST 4: JOURNAL VIEW "OPEN PASSAGE" DIRECT NAVIGATION
          // ====================================================================
          console.log('\n--- TEST 4: Journal View "Open Passage" Navigation ---');
          await evaluate(`window.nookApp.navigateTo('journal');`);
          await new Promise((r) => setTimeout(r, 400));

          // Filter by bookmarks tab
          await evaluate(`
            const bmFilterBtn = document.querySelector('[data-filter="bookmark"]');
            if (bmFilterBtn) bmFilterBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 300));

          // Find the bookmark card for Page 20 and click Open passage
          const openedP20 = await evaluate(`
            (() => {
              const cards = Array.from(document.querySelectorAll('.journal-entry-card'));
              const card20 = cards.find(c => c.textContent.includes('Page 20'));
              if (!card20) return false;
              const openBtn = card20.querySelector('.btn-open-passage');
              if (!openBtn) return false;
              openBtn.click();
              return true;
            })()
          `);
          assert(openedP20 === true, `Found and clicked "Open passage" on Page 20 bookmark in Journal`);
          await new Promise((r) => setTimeout(r, 800));

          const journalNavP20 = await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const ribbon = document.querySelector('#readerPaperRibbon');
              return {
                view: window.nookApp.currentView,
                page: r.currentPageNumber,
                ribbonVisible: !!ribbon,
                ribbonClasses: ribbon?.className || ''
              };
            })()
          `);
          assert(journalNavP20.view === 'reader', `Navigated to Reader view`);
          assert(journalNavP20.page === 20, `Reader opened EXACT Page 20 (actual: ${journalNavP20.page})`);
          assert(journalNavP20.ribbonVisible === true && journalNavP20.ribbonClasses.includes('style-midnight-gold'), `Midnight Gold bookmark visible on Page 20`);
          await screenshot('test4_journal_open_passage_p20.png');

          // ====================================================================
          // TEST 5: REFRESH & PERSISTENCE
          // ====================================================================
          console.log('\n--- TEST 5: Refresh & Deep Persistence ---');
          // Navigate to Page 8 in Frankenstein and bookmark
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein', pageNumber: 8 });
              const check = () => {
                if (window.nookApp.reader && window.nookApp.reader.contentData && !window.nookApp.reader.isLoading) {
                  setTimeout(resolve, 200);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);
          await new Promise((r) => setTimeout(r, 400));
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
                bookmarkStyle: 'classic-cream'
              });
              r.render();
            })()
          `);

          // Reload page via Page.reload
          await send('Page.reload');
          await new Promise((r) => setTimeout(r, 1800));

          // Reinitialize app on fresh page
          await evaluate(`
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

          // Click Continue reading from fresh Home
          await evaluate(`
            const card = document.querySelector('.continue-card');
            if (card) card.click();
          `);
          await new Promise((r) => setTimeout(r, 800));

          const reloadState = await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const ribbon = document.querySelector('#readerPaperRibbon');
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', r.currentPageNumber);
              return {
                page: r.currentPageNumber,
                ribbonVisible: !!ribbon,
                ribbonClasses: ribbon?.className || '',
                style: bm?.bookmarkStyle
              };
            })()
          `);

          assert(reloadState.page === 8, `After reload & reopen, exact Page 8 is restored (actual: ${reloadState.page})`);
          assert(reloadState.ribbonVisible === true, `Bookmark ribbon visible after full page reload`);
          assert(reloadState.style === 'classic-cream', `Bookmark style classic-cream preserved`);
          await screenshot('test5_reload_reopen_page_8.png');

          // ====================================================================
          // TEST 6: START OVER FROM BEGINNING
          // ====================================================================
          console.log('\n--- TEST 6: Start Over from Beginning Button ---');
          await evaluate(`window.nookApp.navigateTo('details', { bookId: 'frankenstein' });`);
          await new Promise((r) => setTimeout(r, 400));

          await evaluate(`
            const startOverBtn = document.querySelector('#detailsStartOverBtn');
            if (startOverBtn) startOverBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 800));

          const startOverState = await evaluate(`
            (() => {
              return {
                page: window.nookApp.reader.currentPageNumber
              };
            })()
          `);
          assert(startOverState.page === 1, `"Start from beginning" resets reader to Page 1 (actual: ${startOverState.page})`);

          console.log('\n================================================================');
          console.log(`REGRESSION TEST COMPLETE: ${testsPassed} passed, ${testsFailed} failed.`);
          console.log('================================================================');

          ws.close();
          edge.kill();
          process.exit(testsFailed === 0 ? 0 : 1);
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
