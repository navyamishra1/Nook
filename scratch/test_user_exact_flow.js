const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('--- RUNNING TARGETED EXACT FLOW VERIFICATION FOR BOOKMARK & PAGE RESTORATION ---');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9225/json', (res) => {
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

          await send('Emulation.setDeviceMetricsOverride', {
            width: 1440,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false
          });

          // Reset storage to test with fresh state
          await evaluate(`localStorage.clear();`);

          // Wait for catalog load
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

          // Seed 1 highlight and 1 note to verify Requirement 11 (highlights & notes preserved)
          await evaluate(`
            (() => {
              window.nookApp.journal.addHighlight({
                bookId: 'frankenstein',
                bookTitle: 'Frankenstein',
                author: 'Mary Shelley',
                chapterNumber: 1,
                chapterTitle: 'Letter I',
                pageNumber: 1,
                selectedText: 'You will rejoice to hear that no disaster has accompanied the commencement of an enterprise'
              });
              window.nookApp.journal.addNote({
                bookId: 'frankenstein',
                bookTitle: 'Frankenstein',
                author: 'Mary Shelley',
                chapterNumber: 1,
                chapterTitle: 'Letter I',
                pageNumber: 1,
                note: 'Opening epistolary reflection.'
              });
            })()
          `);

          let passed = 0;
          let failed = 0;
          function assert(cond, msg) {
            if (cond) {
              console.log(`  ✓ ${msg}`);
              passed++;
            } else {
              console.error(`  ✗ FAIL: ${msg}`);
              failed++;
            }
          }

          console.log('\n--- STEP 1 & 2: Open Frankenstein and navigate to page 8 ---');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein' });
              const check = () => {
                if (window.nookApp.reader && !window.nookApp.reader.isLoading) {
                  window.nookApp.reader.goToPage(8);
                  setTimeout(resolve, 400);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          const curPageCheck1 = await evaluate(`window.nookApp.reader.currentPageNumber`);
          assert(curPageCheck1 === 8, 'Step 2: Successfully navigated to Page 8');

          console.log('\n--- STEP 3: Add bookmark on Page 8 ---');
          await evaluate(`
            (() => {
              window.nookApp.journal.addBookmark({
                bookId: 'frankenstein',
                bookTitle: 'Frankenstein',
                author: 'Mary Shelley',
                chapterNumber: window.nookApp.reader.pagination.getPage(8).chapterNumber,
                chapterTitle: window.nookApp.reader.pagination.getPage(8).chapterTitle,
                pageNumber: 8,
                bookmarkStyle: 'crimson-silk'
              });
              window.nookApp.reader.render();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          const page8RibbonCheck = await evaluate(`
            (() => {
              const ribbon = document.querySelector('#readerPaperRibbon');
              return {
                ribbonPresent: !!ribbon,
                ribbonVisible: ribbon ? getComputedStyle(ribbon).display !== 'none' : false,
                isBm: window.nookApp.journal.isPageBookmarked('frankenstein', 8)
              };
            })()
          `);
          assert(page8RibbonCheck.ribbonPresent && page8RibbonCheck.ribbonVisible, 'Step 3: Bookmark ribbon is visible on Page 8');
          assert(page8RibbonCheck.isBm === true, 'Step 3: isPageBookmarked("frankenstein", 8) is true');
          await screenshot('step3_page8_bookmark.png');

          console.log('\n--- STEP 4 & 5: Leave the book and reopen Frankenstein ---');
          // Navigate to home
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('home');
              setTimeout(resolve, 300);
            })
          `);

          // Reopen Frankenstein (via details or direct reader open without explicit pageNumber)
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein' });
              const check = () => {
                if (window.nookApp.reader && !window.nookApp.reader.isLoading) {
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          const reopenCheck1 = await evaluate(`
            (() => {
              const ribbon = document.querySelector('#readerPaperRibbon');
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonPresent: !!ribbon,
                ribbonVisible: ribbon ? getComputedStyle(ribbon).display !== 'none' : false,
                isBm: window.nookApp.journal.isPageBookmarked('frankenstein', window.nookApp.reader.currentPageNumber)
              };
            })()
          `);
          assert(reopenCheck1.currentPage === 8, 'Step 5 EXPECT: Frankenstein reopens EXACTLY on page 8');
          assert(reopenCheck1.ribbonPresent && reopenCheck1.ribbonVisible, 'Step 5 EXPECT: Bookmark ribbon is visible on page 8 upon reopen');
          await screenshot('step5_reopened_page8.png');

          console.log('\n--- STEP 6 & 7: Navigate to page 11 and add bookmark ---');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.reader.goToPage(11);
              setTimeout(resolve, 400);
            })
          `);

          // Verify before adding bookmark that page 11 has no ribbon
          const page11Before = await evaluate(`
            (() => {
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonPresent: !!document.querySelector('#readerPaperRibbon'),
                isBm: window.nookApp.journal.isPageBookmarked('frankenstein', 11)
              };
            })()
          `);
          assert(page11Before.currentPage === 11, 'Step 6: Navigated to page 11');
          assert(page11Before.ribbonPresent === false, 'Step 6: Page 11 has no bookmark ribbon before placing');

          // Place bookmark on page 11
          await evaluate(`
            (() => {
              window.nookApp.journal.addBookmark({
                bookId: 'frankenstein',
                bookTitle: 'Frankenstein',
                author: 'Mary Shelley',
                chapterNumber: window.nookApp.reader.pagination.getPage(11).chapterNumber,
                chapterTitle: window.nookApp.reader.pagination.getPage(11).chapterTitle,
                pageNumber: 11,
                bookmarkStyle: 'sage-linen'
              });
              window.nookApp.reader.render();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          const page11After = await evaluate(`
            (() => {
              const ribbon = document.querySelector('#readerPaperRibbon');
              return {
                page8IsBm: window.nookApp.journal.isPageBookmarked('frankenstein', 8),
                page11IsBm: window.nookApp.journal.isPageBookmarked('frankenstein', 11),
                ribbonPresent: !!ribbon,
                ribbonVisible: ribbon ? getComputedStyle(ribbon).display !== 'none' : false,
                allFrankensteinBms: window.nookApp.journal.getBookmarks('frankenstein')
              };
            })()
          `);
          assert(page11After.page8IsBm === false, 'Step 7 EXPECT: Page 8 no longer has a bookmark');
          assert(page11After.page11IsBm === true, 'Step 7 EXPECT: Page 11 has the bookmark');
          assert(page11After.ribbonPresent && page11After.ribbonVisible, 'Step 7 EXPECT: Bookmark ribbon is visible on page 11');
          assert(page11After.allFrankensteinBms.length === 1, 'Step 7 EXPECT: Total bookmarks for Frankenstein is exactly 1');
          await screenshot('step7_page11_bookmark.png');

          console.log('\n--- STEP 8 & 9: Leave the book from page 11 and reopen Frankenstein ---');
          // Ensure we leave from page 11 as in the user's exact flow
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.reader.goToPage(11);
              setTimeout(resolve, 300);
            })
          `);

          // Leave book
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('home');
              setTimeout(resolve, 300);
            })
          `);

          // Reopen Frankenstein
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein' });
              const check = () => {
                if (window.nookApp.reader && !window.nookApp.reader.isLoading) {
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          const reopenCheck2 = await evaluate(`
            (() => {
              const ribbon = document.querySelector('#readerPaperRibbon');
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonPresent: !!ribbon,
                ribbonVisible: ribbon ? getComputedStyle(ribbon).display !== 'none' : false,
                activeBm: window.nookApp.journal.getBookBookmark('frankenstein')
              };
            })()
          `);
          assert(reopenCheck2.currentPage === 11, 'Step 9 EXPECT: Reopens EXACTLY on page 11');
          assert(reopenCheck2.ribbonPresent && reopenCheck2.ribbonVisible, 'Step 9 EXPECT: Bookmark ribbon visible on page 11');
          assert(reopenCheck2.activeBm?.pageNumber === 11, 'Step 9 EXPECT: Active bookmark record points to page 11');
          await screenshot('step9_reopened_page11.png');

          console.log('\n--- STEP 10: Open Journal → Bookmarks ---');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('journal');
              setTimeout(resolve, 300);
            })
          `);

          const journalCheck = await evaluate(`
            (() => {
              const bms = window.nookApp.journal.getBookmarks('frankenstein');
              const bmEntries = window.nookApp.journal.getJournalEntries({ type: 'bookmarks', bookId: 'frankenstein' });
              const renderedBmCards = document.querySelectorAll('.journal-entry-card.entry-type-bookmark');
              const locText = renderedBmCards[0]?.querySelector('.j-loc-page')?.textContent.trim();
              return {
                bmsCount: bms.length,
                bmTargetPage: bms[0]?.pageNumber,
                bmEntriesCount: bmEntries.length,
                renderedBmCardsCount: renderedBmCards.length,
                locText
              };
            })()
          `);
          assert(journalCheck.bmsCount === 1, 'Step 10 EXPECT: Exactly ONE Frankenstein bookmark in store');
          assert(journalCheck.bmTargetPage === 11, 'Step 10 EXPECT: Bookmark points to page 11');
          assert(journalCheck.bmEntriesCount === 1, 'Step 10 EXPECT: getJournalEntries returns exactly 1 bookmark');
          assert(journalCheck.locText?.includes('Page 11'), 'Step 10 EXPECT: Journal card UI text shows Page 11');
          await screenshot('step10_journal_bookmarks.png');

          console.log('\n--- STEP 11: Verify existing highlights and notes are still present ---');
          const preservationCheck = await evaluate(`
            (() => {
              const highlights = window.nookApp.journal.getHighlights('frankenstein');
              const notes = window.nookApp.journal.getNotes('frankenstein');
              const stats = window.nookApp.journal.getJournalStats();
              return {
                highlightsCount: highlights.length,
                notesCount: notes.length,
                highlightText: highlights[0]?.selectedText,
                noteText: notes[0]?.note,
                stats
              };
            })()
          `);
          assert(preservationCheck.highlightsCount === 1, 'Step 11 EXPECT: Existing highlight preserved (1 highlight)');
          assert(preservationCheck.notesCount === 1, 'Step 11 EXPECT: Existing note preserved (1 note)');
          assert(preservationCheck.highlightText?.includes('commencement of an enterprise'), 'Step 11: Highlight content intact');
          assert(preservationCheck.noteText === 'Opening epistolary reflection.', 'Step 11: Note content intact');
          assert(preservationCheck.stats.totalBookmarks === 1, 'Step 11: Total stats bookmarks = 1');
          assert(preservationCheck.stats.totalHighlights === 1, 'Step 11: Total stats highlights = 1');
          assert(preservationCheck.stats.totalNotes === 1, 'Step 11: Total stats notes = 1');
          assert(preservationCheck.stats.totalEntries === 3, 'Step 11: Total stats entries = 3');
          await screenshot('step11_journal_all_entries.png');

          console.log(`\n================ EXACT FLOW RESULTS ================`);
          console.log(`Passed: ${passed} | Failed: ${failed}`);

          ws.close();
          edge.kill();

          if (failed > 0) {
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
