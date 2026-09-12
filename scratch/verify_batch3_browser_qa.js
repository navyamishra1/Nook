const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

const BATCH_3_BOOKS = [
  { id: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen' },
  { id: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley' },
  { id: 'alices-adventures-in-wonderland', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' },
  { id: 'the-great-gatsby', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { id: 'jane-eyre', title: 'Jane Eyre', author: 'Charlotte Brontë' },
  { id: 'wuthering-heights', title: 'Wuthering Heights', author: 'Emily Brontë' },
  { id: 'emma', title: 'Emma', author: 'Jane Austen' },
  { id: 'persuasion', title: 'Persuasion', author: 'Jane Austen' },
  { id: 'northanger-abbey', title: 'Northanger Abbey', author: 'Jane Austen' },
  { id: 'mansfield-park', title: 'Mansfield Park', author: 'Jane Austen' },
  { id: 'the-tenant-of-wildfell-hall', title: 'The Tenant of Wildfell Hall', author: 'Anne Brontë' },
  { id: 'a-room-with-a-view', title: 'A Room with a View', author: 'E. M. Forster' },
  { id: 'the-age-of-innocence', title: 'The Age of Innocence', author: 'Edith Wharton' },
  { id: 'the-house-of-mirth', title: 'The House of Mirth', author: 'Edith Wharton' },
  { id: 'dracula', title: 'Dracula', author: 'Bram Stoker' },
  { id: 'the-turn-of-the-screw', title: 'The Turn of the Screw', author: 'Henry James' }
];

async function main() {
  console.log('Starting automated QA verification for 16 high-resolution physical novel covers...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  http.get('http://127.0.0.1:9222/json', (res) => {
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

          async function evaluate(expression) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            return res && res.result ? res.result.value : null;
          }

          async function setViewport(width, height) {
            await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
          }

          async function screenshot(filename) {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            if (res && res.data) {
              fs.writeFileSync(path.join(artifactDir, filename), Buffer.from(res.data, 'base64'));
              console.log(`Saved screenshot: ${filename}`);
            }
          }

          await setViewport(1440, 900);

          // 1. Initialize and skip entry
          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length >= 105) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  window.nookApp.navigateTo('library');
                  setTimeout(resolve, 500);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          // 2. Capture Library Grid
          await screenshot('qa_batch3_library_grid_top.png');

          // Scroll down to Romance / Victorian / Gothic books
          await evaluate(`
            window.scrollBy(0, 600);
          `);
          await new Promise(r => setTimeout(r, 400));
          await screenshot('qa_batch3_library_grid_scroll1.png');

          await evaluate(`
            window.scrollBy(0, 800);
          `);
          await new Promise(r => setTimeout(r, 400));
          await screenshot('qa_batch3_library_grid_scroll2.png');

          // 3. Verify all 16 books in Details view
          console.log('\n--- VERIFYING DETAILS VIEW FOR ALL 16 BATCH 3 BOOKS ---');
          const detailsResults = [];
          for (const book of BATCH_3_BOOKS) {
            await evaluate(`
              new Promise((resolve) => {
                window.nookApp.navigateTo('details', { bookId: '${book.id}' });
                setTimeout(resolve, 250);
              })
            `);

            const info = await evaluate(`
              (() => {
                const coverImg = document.querySelector('.book-detail-cover img, .details-cover img');
                const titleEl = document.querySelector('.book-detail-title, .details-title, h1');
                return {
                  bookId: '${book.id}',
                  renderedTitle: titleEl ? titleEl.textContent.trim() : '',
                  coverSrc: coverImg ? coverImg.src : '',
                  naturalWidth: coverImg ? coverImg.naturalWidth : 0,
                  naturalHeight: coverImg ? coverImg.naturalHeight : 0,
                  complete: coverImg ? coverImg.complete : false
                };
              })()
            `);
            console.log(`[VERIFIED DETAILS] ${book.title}:`, info);
            detailsResults.push(info);
          }

          // Sample Detail view screenshots
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'emma' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_batch3_details_emma.png');

          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'the-turn-of-the-screw' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_batch3_details_turn_of_the_screw.png');

          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'the-age-of-innocence' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_batch3_details_age_of_innocence.png');

          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'pride-and-prejudice' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_batch3_details_pride.png');

          // 4. Search View
          console.log('\n--- VERIFYING SEARCH VIEW ---');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('library');
              setTimeout(() => {
                const searchInput = document.querySelector('#library-search-input, .search-input, input[type="search"], input');
                if (searchInput) {
                  searchInput.value = 'Emma';
                  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                setTimeout(resolve, 400);
              }, 200);
            })
          `);
          await screenshot('qa_batch3_search_emma.png');

          // 5. Home View
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('home');
              setTimeout(resolve, 400);
            })
          `);
          await screenshot('qa_batch3_home.png');

          // 6. Spin the Nook
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('spin');
              setTimeout(resolve, 400);
            })
          `);
          await screenshot('qa_batch3_spin.png');

          console.log('\n================ BATCH 3 COVERS QA SUMMARY ================');
          let allPassed = true;
          for (const res of detailsResults) {
            const expectedSrc = `assets/covers/${res.bookId}.webp`;
            const hasExpectedSrc = res.coverSrc.includes(expectedSrc);
            const isHighRes = res.naturalWidth >= 1200 && res.naturalHeight >= 1800;
            const ratio = res.naturalWidth / res.naturalHeight;
            const is2x3 = Math.abs(ratio - 2.0/3.0) < 0.02;
            const pass = hasExpectedSrc && res.complete && isHighRes && is2x3;
            if (!pass) allPassed = false;
            console.log(`  - ${res.bookId}: ${pass ? 'PASS' : 'FAIL'} (src: ${res.coverSrc}, ${res.naturalWidth}x${res.naturalHeight}, ratio: ${ratio.toFixed(3)})`);
          }
          console.log(`\nOverall 16/16 Verification: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
          console.log('===========================================================\n');

          ws.close();
          edge.kill();
          process.exit(allPassed ? 0 : 1);
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
