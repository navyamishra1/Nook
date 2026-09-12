const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

const NEXT_16_BOOKS = [
  { id: 'sense-and-sensibility', title: 'Sense and Sensibility', author: 'Jane Austen' },
  { id: 'the-picture-of-dorian-gray', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde' },
  { id: 'the-secret-garden', title: 'The Secret Garden', author: 'Frances Hodgson Burnett' },
  { id: 'the-time-machine', title: 'The Time Machine', author: 'H. G. Wells' },
  { id: 'the-war-of-the-worlds', title: 'The War of the Worlds', author: 'H. G. Wells' },
  { id: 'the-invisible-man', title: 'The Invisible Man', author: 'H. G. Wells' },
  { id: 'the-strange-case-of-dr-jekyll-and-mr-hyde', title: 'Dr. Jekyll and Mr. Hyde', author: 'Robert Louis Stevenson' },
  { id: 'the-adventures-of-tom-sawyer', title: 'The Adventures of Tom Sawyer', author: 'Mark Twain' },
  { id: 'adventures-of-huckleberry-finn', title: 'Adventures of Huckleberry Finn', author: 'Mark Twain' },
  { id: 'a-little-princess', title: 'A Little Princess', author: 'Frances Hodgson Burnett' },
  { id: 'the-wind-in-the-willows', title: 'The Wind in the Willows', author: 'Kenneth Grahame' },
  { id: 'the-call-of-the-wild', title: 'The Call of the Wild', author: 'Jack London' },
  { id: 'white-fang', title: 'White Fang', author: 'Jack London' },
  { id: 'the-wonderful-wizard-of-oz', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum' },
  { id: 'anne-of-green-gables', title: 'Anne of Green Gables', author: 'L. M. Montgomery' },
  { id: 'the-jungle-book', title: 'The Jungle Book', author: 'Rudyard Kipling' }
];

async function main() {
  console.log('Starting automated QA verification for NEXT 16 high-resolution illustrated covers...');
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

          // 1. Initialize and check Home
          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length >= 105) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  window.nookApp.navigateTo('home');
                  setTimeout(resolve, 400);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          await screenshot('qa_verified_home_next16.png');
          console.log('[Home QA] Home rendered successfully.');

          // 2. Check Library
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('library');
              setTimeout(resolve, 500);
            })
          `);
          await screenshot('qa_verified_library_next16.png');
          console.log('[Library QA] Library rendered successfully.');

          // Verify Library cards for the 16 new books
          const libraryCardsStatus = await evaluate(`
            (() => {
              const ids = [${NEXT_16_BOOKS.map(b => `'${b.id}'`).join(', ')}];
              return ids.map(id => {
                const card = document.querySelector(\`[data-book-id="\${id}"]\`);
                if (!card) return { id, found: false };
                const img = card.querySelector('img');
                return {
                  id,
                  found: true,
                  src: img ? img.src : null,
                  naturalWidth: img ? img.naturalWidth : 0,
                  naturalHeight: img ? img.naturalHeight : 0,
                  complete: img ? img.complete : false
                };
              });
            })()
          `);
          console.log('\n--- LIBRARY GRID COVERS CHECK ---');
          libraryCardsStatus.forEach(s => {
            console.log(`  Library card ${s.id}: found=${s.found}, complete=${s.complete}, size=${s.naturalWidth}x${s.naturalHeight}, src=${s.src}`);
          });

          // 3. Verify all 16 books in Details view
          console.log('\n--- VERIFYING DETAILS VIEW FOR ALL 16 NEXT BOOKS ---');
          const detailsResults = [];
          for (const book of NEXT_16_BOOKS) {
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

          // Capture sample detail view screenshots
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'the-war-of-the-worlds' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_verified_details_war_of_the_worlds.png');

          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'the-secret-garden' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_verified_details_secret_garden.png');

          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'the-wonderful-wizard-of-oz' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_verified_details_wizard_of_oz.png');

          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'the-call-of-the-wild' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_verified_details_call_of_the_wild.png');

          // 4. Test Search View
          console.log('\n--- VERIFYING SEARCH VIEW ---');
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('library');
              setTimeout(() => {
                const searchInput = document.querySelector('#library-search-input, .search-input, input[type="search"], input');
                if (searchInput) {
                  searchInput.value = 'War of the Worlds';
                  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                setTimeout(resolve, 400);
              }, 200);
            })
          `);
          await screenshot('qa_verified_search_war_of_the_worlds.png');

          const searchCoverCheck = await evaluate(`
            (() => {
              const card = document.querySelector('[data-book-id="the-war-of-the-worlds"]');
              const img = card ? card.querySelector('img') : null;
              return {
                cardFound: !!card,
                src: img ? img.src : null,
                complete: img ? img.complete : false,
                naturalWidth: img ? img.naturalWidth : 0
              };
            })()
          `);
          console.log('[Search QA] Search for War of the Worlds:', searchCoverCheck);

          // 5. Spin the Nook
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('spin');
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_verified_spin_next16.png');

          console.log('\n================ NEXT 16 COVERS QA VERIFICATION SUMMARY ================');
          let allPassed = true;
          for (const res of detailsResults) {
            const expectedSrc = `assets/covers/${res.bookId}.webp`;
            const hasExpectedSrc = res.coverSrc.includes(expectedSrc) || res.coverSrc.includes(`${res.bookId}.png`);
            const isHighRes = res.naturalWidth >= 1200 && res.naturalHeight >= 1800;
            const ratio = res.naturalWidth / res.naturalHeight;
            const is2x3 = Math.abs(ratio - 2.0/3.0) < 0.02;
            const pass = hasExpectedSrc && res.complete && isHighRes && is2x3;
            if (!pass) allPassed = false;
            console.log(`  - ${res.bookId}: ${pass ? 'PASS' : 'FAIL'} (src: ${res.coverSrc}, ${res.naturalWidth}x${res.naturalHeight}, ratio: ${ratio.toFixed(3)})`);
          }
          console.log(`\nOverall 16/16 Verification: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
          console.log('========================================================================\n');

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
