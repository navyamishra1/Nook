const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('Starting Phase 2 Physical Stationery & Annotation End-to-End QA Suite...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9223/json', (res) => {
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
              console.log(`  -> Saved screenshot: ${filename}`);
            }
          }

          await setViewport(1440, 900);

          // Clear existing journal storage for clean test run
          await evaluate(`localStorage.removeItem('nook_journal');`);

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

          console.log('\n================ 1. OPENING READER & STATIONERY DOCK VERIFICATION ================');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 4, pageNumber: 1 });
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

          const stationeryStatus = await evaluate(`
            (() => {
              const dock = document.querySelector('.reader-stationery-dock');
              const hlBtn = document.querySelector('#stationeryHighlighterBtn');
              const noteBtn = document.querySelector('#stationeryNoteBtn');
              const bmBtn = document.querySelector('#stationeryBookmarkBtn');
              const popover = document.querySelector('#readerSelectionPopover');

              return {
                dockVisible: !!dock && getComputedStyle(dock).display !== 'none',
                highlighterVisible: !!hlBtn && getComputedStyle(hlBtn).display !== 'none',
                noteVisible: !!noteBtn && getComputedStyle(noteBtn).display !== 'none',
                bookmarkVisible: !!bmBtn && getComputedStyle(bmBtn).display !== 'none',
                floatingToolbarAbsent: !popover,
                highlighterAriaLabel: hlBtn?.getAttribute('aria-label'),
                noteAriaLabel: noteBtn?.getAttribute('aria-label'),
                bookmarkAriaLabel: bmBtn?.getAttribute('aria-label')
              };
            })()
          `);
          console.log('Stationery Dock Check:', stationeryStatus);
          await screenshot('qa_stationery_dock_initial_1440.png');

          console.log('\n================ 2. HIGHLIGHTER MODE ACTIVATION (WITHOUT SELECTION) ================');
          // Click physical highlighter
          await evaluate(`
            (() => {
              const hlBtn = document.querySelector('#stationeryHighlighterBtn');
              if (hlBtn) hlBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          const hlModeCheck = await evaluate(`
            (() => {
              const hlBtn = document.querySelector('#stationeryHighlighterBtn');
              const toast = document.querySelector('#highlighterToast');
              const journal = window.nookApp.journal.getJournalStore();
              return {
                isHighlightingActive: window.nookApp.reader.isHighlightingActive,
                hlBtnHasActiveClass: hlBtn?.classList.contains('active'),
                toastVisible: toast?.classList.contains('visible'),
                toastText: toast?.textContent.trim(),
                highlightsCount: journal.highlights.length
              };
            })()
          `);
          console.log('Highlighter Mode Active:', hlModeCheck);
          await screenshot('qa_highlighter_mode_active.png');

          console.log('\n================ 3. APPLY HIGHLIGHT IN ACTIVE MODE ================');
          // Select passage of text on the page
          const hlResult = await evaluate(`
            (() => {
              const p = document.querySelector('#readerProseContent p');
              if (!p) return { error: 'No paragraph found' };
              
              // Simulate selecting text range
              const range = document.createRange();
              const textNode = p.firstChild;
              range.setStart(textNode, 0);
              range.setEnd(textNode, Math.min(65, textNode.textContent.length));
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);

              // Trigger mouseup
              const ev = new MouseEvent('mouseup', { bubbles: true });
              p.dispatchEvent(ev);

              const journal = window.nookApp.journal.getJournalStore();
              return {
                highlightsCount: journal.highlights.length,
                highlightCreated: journal.highlights[0] || null
              };
            })()
          `);
          console.log('Highlight created:', hlResult);

          console.log('\n================ 3B. TEST DEHIGHLIGHT / REMOVE HIGHLIGHT ================');
          // Click on the newly created highlight mark
          await evaluate(`
            (() => {
              const mark = document.querySelector('mark.reader-highlight');
              if (mark) {
                mark.click();
              }
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          const popoverCheck = await evaluate(`
            (() => {
              const popover = document.querySelector('#nookDehighlightPopover');
              return {
                popoverPresent: !!popover,
                btnText: popover?.querySelector('.btn-dehighlight-action')?.textContent.trim()
              };
            })()
          `);
          console.log('Dehighlight popover shown:', popoverCheck);
          await screenshot('qa_dehighlight_popover.png');

          // Click "Remove highlight"
          await evaluate(`
            (() => {
              const btn = document.querySelector('.btn-dehighlight-action');
              if (btn) btn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 300));

          const afterDehlCheck = await evaluate(`
            (() => {
              const marks = document.querySelectorAll('mark.reader-highlight');
              const journal = window.nookApp.journal.getJournalStore();
              return {
                marksOnPage: marks.length,
                highlightsInJournal: journal.highlights.length
              };
            })()
          `);
          console.log('After dehighlight check:', afterDehlCheck);

          // Re-create highlight for subsequent journal tests
          await evaluate(`
            (() => {
              window.nookApp.reader.handleCreateHighlight('The Publishers of the Standard Novels, in selecting Frankenstein');
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          console.log('\n================ 4. PAGE NOTE CREATION (WITHOUT TEXT SELECTION) ================');
          // Click Note stationery tab
          await evaluate(`
            (() => {
              const noteBtn = document.querySelector('#stationeryNoteBtn');
              if (noteBtn) noteBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          const noteModalCheck = await evaluate(`
            (() => {
              const modal = document.querySelector('#nookNoteModal');
              const kicker = modal?.querySelector('.modal-kicker')?.textContent.trim();
              const badge = modal?.querySelector('.modal-page-note-badge');
              return {
                modalPresent: !!modal,
                kicker,
                isPageNoteBadgePresent: !!badge
              };
            })()
          `);
          console.log('Note Modal (Page Note):', noteModalCheck);
          await screenshot('qa_page_note_modal.png');

          // Submit page note
          await evaluate(`
            (() => {
              const textarea = document.querySelector('#noteInput');
              const saveBtn = document.querySelector('#noteModalSaveBtn');
              if (textarea && saveBtn) {
                textarea.value = 'Atmospheric gothic opening to Chapter IV.';
                saveBtn.click();
              }
            })()
          `);
          await new Promise((r) => setTimeout(r, 300));

          const pageNoteInJournal = await evaluate(`
            (() => {
              const journal = window.nookApp.journal.getJournalStore();
              return {
                notesCount: journal.notes.length,
                note: journal.notes[0]
              };
            })()
          `);
          console.log('Page note saved to journal:', pageNoteInJournal);

          console.log('\n================ 5. PASSAGE NOTE CREATION (WITH TEXT SELECTION) ================');
          // Select text first, then click Note stationery tab
          await evaluate(`
            (() => {
              const p = document.querySelectorAll('#readerProseContent p')[1] || document.querySelector('#readerProseContent p');
              const textNode = p.firstChild;
              const range = document.createRange();
              range.setStart(textNode, 5);
              range.setEnd(textNode, Math.min(50, textNode.textContent.length));
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);

              const noteBtn = document.querySelector('#stationeryNoteBtn');
              if (noteBtn) noteBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          const passageNoteModalCheck = await evaluate(`
            (() => {
              const modal = document.querySelector('#nookNoteModal');
              const kicker = modal?.querySelector('.modal-kicker')?.textContent.trim();
              const quote = modal?.querySelector('.modal-quote')?.textContent.trim();
              return {
                modalPresent: !!modal,
                kicker,
                quote
              };
            })()
          `);
          console.log('Passage Note Modal:', passageNoteModalCheck);
          await screenshot('qa_passage_note_modal.png');

          // Submit passage note
          await evaluate(`
            (() => {
              const textarea = document.querySelector('#noteInput');
              const saveBtn = document.querySelector('#noteModalSaveBtn');
              if (textarea && saveBtn) {
                textarea.value = 'Key thematic imagery.';
                saveBtn.click();
              }
            })()
          `);
          await new Promise((r) => setTimeout(r, 300));

          const allNotesJournal = await evaluate(`
            (() => {
              const journal = window.nookApp.journal.getJournalStore();
              return {
                notesCount: journal.notes.length,
                notes: journal.notes
              };
            })()
          `);
          console.log('All notes in journal:', allNotesJournal);

          console.log('\n================ 6. BOOKMARK PICKER & STYLE PLACEMENT ================');
          // Click bookmark stationery button
          await evaluate(`
            (() => {
              const bmBtn = document.querySelector('#stationeryBookmarkBtn');
              if (bmBtn) bmBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          const bmPickerCheck = await evaluate(`
            (() => {
              const modal = document.querySelector('#nookBookmarkPickerModal');
              const options = Array.from(modal?.querySelectorAll('.bm-style-option') || []);
              return {
                modalPresent: !!modal,
                optionsCount: options.length,
                styles: options.map(o => o.getAttribute('data-style-id'))
              };
            })()
          `);
          console.log('Bookmark Picker Modal:', bmPickerCheck);
          await screenshot('qa_bookmark_picker_modal.png');

          // Select 'sage-linen' bookmark
          await evaluate(`
            (() => {
              const sageBtn = document.querySelector('.bm-style-option.style-sage-linen');
              if (sageBtn) sageBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 300));

          const bmPlacedCheck = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', 1);
              return {
                ribbonPresent: !!ribbon,
                ribbonClasses: ribbon?.className,
                bookmarkRecord: bm
              };
            })()
          `);
          console.log('Bookmark Placed Check on Page 1:', bmPlacedCheck);
          await screenshot('qa_bookmark_ribbon_page_1.png');

          console.log('\n================ 7. NAVIGATION & PERSISTENCE VERIFICATION ================');
          // Navigate to Page 2
          await evaluate(`
            (() => {
              const nextBtn = document.querySelector('#readerPaperCornerNext');
              if (nextBtn) nextBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 600));

          const p2BmCheck = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonOnPage2: !!ribbon
              };
            })()
          `);
          console.log('Page 2 Bookmark Presence (Should be false):', p2BmCheck);

          // Place Midnight & Gold bookmark on Page 2
          await evaluate(`
            (() => {
              window.nookApp.journal.addBookmark({
                bookId: 'frankenstein',
                bookTitle: 'Frankenstein',
                author: 'Mary Shelley',
                chapterNumber: 4,
                chapterTitle: 'Chapter IV',
                pageNumber: 2,
                bookmarkStyle: 'midnight-gold'
              });
              window.nookApp.reader.render();
            })()
          `);
          await new Promise((r) => setTimeout(r, 200));

          const p2BmPlaced = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', 2);
              return {
                ribbonPresent: !!ribbon,
                ribbonClasses: ribbon?.className,
                style: bm?.bookmarkStyle
              };
            })()
          `);
          console.log('Page 2 Placed Midnight Bookmark:', p2BmPlaced);
          await screenshot('qa_bookmark_ribbon_page_2_midnight.png');

          // Navigate back to Page 1
          await evaluate(`
            (() => {
              const prevBtn = document.querySelector('#readerPaperCornerPrev');
              if (prevBtn) prevBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 600));

          const p1RestoredCheck = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              const bm = window.nookApp.journal.getPageBookmark('frankenstein', 1);
              return {
                currentPage: window.nookApp.reader.currentPageNumber,
                ribbonPresent: !!ribbon,
                ribbonClasses: ribbon?.className,
                style: bm?.bookmarkStyle
              };
            })()
          `);
          console.log('Page 1 Restored Bookmark (Sage Linen):', p1RestoredCheck);

          console.log('\n================ 8. CLOSE READER & REOPEN PERSISTENCE ================');
          // Navigate to Home
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('home');
              setTimeout(resolve, 300);
            })
          `);

          // Reopen Frankenstein
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 4, pageNumber: 1 });
              setTimeout(resolve, 500);
            })
          `);

          const reopenCheck = await evaluate(`
            (() => {
              const ribbon = document.querySelector('.reader-page-bookmark-ribbon');
              return {
                ribbonPresent: !!ribbon,
                ribbonClasses: ribbon?.className
              };
            })()
          `);
          console.log('Reopen Reader Bookmark Check:', reopenCheck);
          await screenshot('qa_reopen_reader_bookmark_restored.png');

          console.log('\n================ 9. JOURNAL VIEW & "OPEN PASSAGE" VERIFICATION ================');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('journal');
              setTimeout(resolve, 400);
            })
          `);

          const journalViewStats = await evaluate(`
            (() => {
              const cards = document.querySelectorAll('.journal-entry-card');
              const statsBar = document.querySelector('.journal-stats-bar')?.textContent.trim();
              const openBtns = document.querySelectorAll('[data-action="open-passage"]');
              return {
                renderedCardsCount: cards.length,
                statsBar,
                openBtnsCount: openBtns.length
              };
            })()
          `);
          console.log('Journal View stats:', journalViewStats);
          await screenshot('qa_journal_view_with_stationery_entries.png');

          // Click "Open passage →" on first card
          await evaluate(`
            (() => {
              const firstOpenBtn = document.querySelector('[data-action="open-passage"]');
              if (firstOpenBtn) firstOpenBtn.click();
            })()
          `);
          await new Promise((r) => setTimeout(r, 600));

          const passageNavCheck = await evaluate(`
            (() => {
              return {
                currentView: window.nookApp.currentView,
                bookId: window.nookApp.reader?.bookId,
                chapterNumber: window.nookApp.reader?.currentChapterNumber,
                pageNumber: window.nookApp.reader?.currentPageNumber
              };
            })()
          `);
          console.log('"Open passage" destination:', passageNavCheck);

          console.log('\n================ 10. MULTI-VIEWPORT RESPONSIVE VISUAL QA ================');
          const viewports = [
            { name: 'desktop_1440x900', w: 1440, h: 900 },
            { name: 'desktop_1280x800', w: 1280, h: 800 },
            { name: 'desktop_1024x768', w: 1024, h: 768 },
            { name: 'tablet_768x1024', w: 768, h: 1024 },
            { name: 'mobile_430x932', w: 430, h: 932 },
            { name: 'mobile_390x844', w: 390, h: 844 }
          ];

          for (const vp of viewports) {
            await setViewport(vp.w, vp.h);
            await new Promise((r) => setTimeout(r, 400));
            await screenshot(`qa_viewport_${vp.name}.png`);
          }

          console.log('\n================ QA SUMMARY COMPLETE ================');
          ws.close();
          edge.kill();
          process.exit(0);
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
