const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('--- EXECUTING SPECIFIC 20-STEP SINGLE BOOKMARK PER BOOK TEST FLOW ---');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9226/json', (res) => {
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
              console.log(`  [Screenshot] ${filename}`);
            }
          }

          // Set 1440x900 viewport
          await send('Emulation.setDeviceMetricsOverride', {
            width: 1440,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false
          });

          // Clear local storage for a clean test
          await evaluate(`localStorage.clear();`);

          // Wait for App to initialize
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

          let testPassed = 0;
          let testFailed = 0;

          function assert(condition, message) {
            if (condition) {
              console.log(`  ✓ ${message}`);
              testPassed++;
            } else {
              console.error(`  ✗ FAIL: ${message}`);
              testFailed++;
            }
          }

          // ----------------------------------------------------
          // Step 1: Open Frankenstein
          // Step 2: Go to Page 8
          // ----------------------------------------------------
          console.log('\n[Step 1 & 2] Opening Frankenstein and navigating to Page 8...');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein', pageNumber: 8 });
              const check = () => {
                if (window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.currentPageNumber === 8) {
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          // ----------------------------------------------------
          // Step 3: Place bookmark on Page 8
          // Step 4: Confirm bookmark visible on Page 8
          // ----------------------------------------------------
          console.log('\n[Step 3 & 4] Placing bookmark on Page 8 and confirming visibility...');
          await evaluate(`
            (() => {
              const bmBtn = document.querySelector('#stationeryBookmarkBtn');
              if (bmBtn) bmBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          // Select 'crimson-silk'
          await evaluate(`
            (() => {
              const crimsonOption = document.querySelector('.bm-style-option.style-crimson-silk');
              if (crimsonOption) crimsonOption.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 400));

          const page8BmState = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              const isBm = window.nookApp.journal.isPageBookmarked('frankenstein', 8);
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', 8);
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonPresent: !!ribbon,
                ribbonVisible: ribbon ? getComputedStyle(ribbon).display !== 'none' : false,
                isBm,
                style: bm ? bm.bookmarkStyle : null
              };
            })()
          `);
          assert(page8BmState.currentPage === 8, 'Step 2: Currently on Page 8');
          assert(page8BmState.ribbonPresent && page8BmState.ribbonVisible, 'Step 4: Bookmark ribbon visible on Page 8');
          assert(page8BmState.isBm === true, 'Step 4: Journal reports Page 8 is bookmarked');
          await screenshot('single_bm_step4_page8_visible.png');

          // ----------------------------------------------------
          // Step 5: Go to Page 11
          // Step 6: Confirm bookmark is NOT visible on Page 11 yet
          // ----------------------------------------------------
          console.log('\n[Step 5 & 6] Navigating to Page 11 and confirming bookmark is NOT visible yet...');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.reader.goToPage(11);
              const check = () => {
                if (window.nookApp.reader.currentPageNumber === 11) {
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          const page11BeforeBmState = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              const isBm = window.nookApp.journal.isPageBookmarked('frankenstein', 11);
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonPresent: !!ribbon,
                isBm
              };
            })()
          `);
          assert(page11BeforeBmState.currentPage === 11, 'Step 5: Currently on Page 11');
          assert(page11BeforeBmState.ribbonPresent === false, 'Step 6: Bookmark ribbon is NOT present on Page 11 yet');
          assert(page11BeforeBmState.isBm === false, 'Step 6: Journal reports Page 11 is not bookmarked');
          await screenshot('single_bm_step6_page11_not_visible.png');

          // ----------------------------------------------------
          // Step 7: Place bookmark on Page 11
          // Step 8: Confirm bookmark visible on Page 11
          // ----------------------------------------------------
          console.log('\n[Step 7 & 8] Placing bookmark on Page 11 and confirming visibility...');
          await evaluate(`
            (() => {
              const bmBtn = document.querySelector('#stationeryBookmarkBtn');
              if (bmBtn) bmBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          // Select 'sage-linen'
          await evaluate(`
            (() => {
              const sageOption = document.querySelector('.bm-style-option.style-sage-linen');
              if (sageOption) sageOption.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 400));

          const page11AfterBmState = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              const isBm = window.nookApp.journal.isPageBookmarked('frankenstein', 11);
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', 11);
              const allBms = window.nookApp.journal.getBookmarks('frankenstein');
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonPresent: !!ribbon,
                ribbonVisible: ribbon ? getComputedStyle(ribbon).display !== 'none' : false,
                isBm,
                style: bm ? bm.bookmarkStyle : null,
                totalFrankensteinBookmarks: allBms.length
              };
            })()
          `);
          assert(page11AfterBmState.currentPage === 11, 'Step 7: Currently on Page 11');
          assert(page11AfterBmState.ribbonPresent && page11AfterBmState.ribbonVisible, 'Step 8: Bookmark ribbon visible on Page 11');
          assert(page11AfterBmState.isBm === true, 'Step 8: Journal reports Page 11 is bookmarked');
          assert(page11AfterBmState.totalFrankensteinBookmarks === 1, 'Data check: Frankenstein has exactly 1 bookmark total');
          await screenshot('single_bm_step8_page11_visible.png');

          // ----------------------------------------------------
          // Step 9: Return to Page 8
          // Step 10: Confirm NO bookmark is visible
          // ----------------------------------------------------
          console.log('\n[Step 9 & 10] Returning to Page 8 and confirming NO bookmark is visible...');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.reader.goToPage(8);
              const check = () => {
                if (window.nookApp.reader.currentPageNumber === 8) {
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          const page8ReturnState = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              const isBm = window.nookApp.journal.isPageBookmarked('frankenstein', 8);
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonPresent: !!ribbon,
                isBm
              };
            })()
          `);
          assert(page8ReturnState.currentPage === 8, 'Step 9: Returned to Page 8');
          assert(page8ReturnState.ribbonPresent === false, 'Step 10: NO bookmark ribbon is visible on Page 8');
          assert(page8ReturnState.isBm === false, 'Step 10: Journal confirms Page 8 is not bookmarked');
          await screenshot('single_bm_step10_page8_no_bookmark.png');

          // Return to Page 11
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.reader.goToPage(11);
              setTimeout(resolve, 300);
            })
          `);

          // ----------------------------------------------------
          // Step 11: Open Journal
          // Step 12: Confirm Frankenstein has exactly ONE bookmark
          // Step 13: Confirm it points to Page 11
          // ----------------------------------------------------
          console.log('\n[Step 11, 12, 13] Opening Journal and verifying Frankenstein bookmark count & target page...');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('journal');
              setTimeout(resolve, 400);
            })
          `);

          const journalState = await evaluate(`
            (() => {
              const frankensteinBms = window.nookApp.journal.getBookmarks('frankenstein');
              const allBmsInJournal = window.nookApp.journal.getJournalEntries({ type: 'bookmarks' });
              const renderedCards = document.querySelectorAll('.journal-entry-card.entry-type-bookmark');
              const cardPageText = renderedCards[0]?.querySelector('.j-loc-page')?.textContent.trim();
              return {
                frankensteinBmsCount: frankensteinBms.length,
                activeBookmarkPage: frankensteinBms[0]?.pageNumber,
                activeBookmarkStyle: frankensteinBms[0]?.bookmarkStyle,
                allBmsInJournalCount: allBmsInJournal.length,
                renderedCardsCount: renderedCards.length,
                cardPageText
              };
            })()
          `);
          assert(journalState.frankensteinBmsCount === 1, 'Step 12: Frankenstein has exactly ONE bookmark in store');
          assert(journalState.activeBookmarkPage === 11, 'Step 13: Bookmark points to Page 11');
          assert(journalState.allBmsInJournalCount === 1, 'Step 12: Journal entries query returns exactly 1 bookmark entry');
          assert(journalState.cardPageText?.includes('Page 11'), 'Step 13: Journal UI card displays Page 11');
          await screenshot('single_bm_step13_journal_page11.png');

          // ----------------------------------------------------
          // Step 14: Close/reopen Frankenstein
          // Step 15: Confirm it opens Page 11
          // Step 16: Confirm bookmark is visible on Page 11
          // ----------------------------------------------------
          console.log('\n[Step 14, 15, 16] Closing Frankenstein (navigating to Home) and reopening...');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('home');
              setTimeout(resolve, 300);
            })
          `);

          // Reopen Frankenstein (without specifying page, should restore active bookmark/reading progress)
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein' });
              const check = () => {
                if (window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.activeBookId === 'frankenstein') {
                  setTimeout(resolve, 400);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          const reopenState = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', window.nookApp.reader.currentPageNumber);
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonPresent: !!ribbon,
                ribbonVisible: ribbon ? getComputedStyle(ribbon).display !== 'none' : false,
                style: bm ? bm.bookmarkStyle : null
              };
            })()
          `);
          assert(reopenState.currentPage === 11, 'Step 15: Reopened Frankenstein directly to saved bookmark Page 11');
          assert(reopenState.ribbonPresent && reopenState.ribbonVisible, 'Step 16: Bookmark is visible on Page 11 upon reopen');
          assert(reopenState.style === 'sage-linen', 'Step 16: Placed bookmark style preserved as sage-linen');
          await screenshot('single_bm_step16_reopen_page11.png');

          // ----------------------------------------------------
          // Step 17: Open Pride and Prejudice
          // Step 18: Place bookmark on Page 20
          // Step 19: Confirm Frankenstein's Page 11 bookmark still exists
          // Step 20: Confirm Pride and Prejudice has its own Page 20 bookmark
          // ----------------------------------------------------
          console.log('\n[Step 17 & 18] Opening Pride and Prejudice, navigating to Page 20, and placing bookmark...');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'pride-and-prejudice', pageNumber: 20 });
              const check = () => {
                if (window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.activeBookId === 'pride-and-prejudice' && window.nookApp.reader.currentPageNumber === 20) {
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          // Place 'midnight-gold' bookmark on Pride and Prejudice Page 20
          await evaluate(`
            (() => {
              const bmBtn = document.querySelector('#stationeryBookmarkBtn');
              if (bmBtn) bmBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          await evaluate(`
            (() => {
              const midnightOption = document.querySelector('.bm-style-option.style-midnight-gold');
              if (midnightOption) midnightOption.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 400));

          console.log('\n[Step 19 & 20] Verifying multi-book bookmark coexistence...');
          const multiBookState = await evaluate(`
            (() => {
              const frankensteinBm = window.nookApp.journal.getBookBookmark('frankenstein');
              const pandpBm = window.nookApp.journal.getBookBookmark('pride-and-prejudice');
              const allBookmarks = window.nookApp.journal.getBookmarks();
              const ribbonOnPandP20 = document.querySelector('.reader-page-bookmark-ribbon');
              
              // Invariant check across entire store
              const bookIdCounts = {};
              allBookmarks.forEach(b => {
                bookIdCounts[b.bookId] = (bookIdCounts[b.bookId] || 0) + 1;
              });
              const invariantSatisfied = Object.values(bookIdCounts).every(count => count <= 1);

              return {
                frankensteinBm,
                pandpBm,
                allBookmarksCount: allBookmarks.length,
                ribbonOnPandP20Present: !!ribbonOnPandP20,
                invariantSatisfied,
                bookIdCounts
              };
            })()
          `);

          assert(multiBookState.frankensteinBm !== null && multiBookState.frankensteinBm.pageNumber === 11, "Step 19: Frankenstein's Page 11 bookmark still exists");
          assert(multiBookState.pandpBm !== null && multiBookState.pandpBm.pageNumber === 20, "Step 20: Pride and Prejudice has its own Page 20 bookmark");
          assert(multiBookState.allBookmarksCount === 2, 'Total active bookmarks across both books is 2 (1 per book)');
          assert(multiBookState.invariantSatisfied, 'FINAL INVARIANT CONFIRMED: For every book, number of active bookmarks <= 1');
          await screenshot('single_bm_step20_pride_and_prejudice_page20.png');

          console.log(`\n================ TEST EXECUTION COMPLETE ================`);
          console.log(`Passed: ${testPassed} | Failed: ${testFailed}`);

          ws.close();
          edge.kill();

          if (testFailed > 0) {
            process.exit(1);
          } else {
            process.exit(0);
          }
        });
      } catch (err) {
        console.error('Test error:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
