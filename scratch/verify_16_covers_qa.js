const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

const REF_16_BOOKS = [
  { id: 'pride-and-prejudice', title: 'Pride and Prejudice' },
  { id: 'frankenstein', title: 'Frankenstein' },
  { id: 'alices-adventures-in-wonderland', title: "Alice's Adventures in Wonderland" },
  { id: 'the-adventures-of-sherlock-holmes', title: 'The Adventures of Sherlock Holmes' },
  { id: 'the-great-gatsby', title: 'The Great Gatsby' },
  { id: 'moby-dick', title: 'Moby-Dick' },
  { id: 'little-women', title: 'Little Women' },
  { id: 'dracula', title: 'Dracula' },
  { id: 'jane-eyre', title: 'Jane Eyre' },
  { id: 'wuthering-heights', title: 'Wuthering Heights' },
  { id: 'great-expectations', title: 'Great Expectations' },
  { id: 'the-count-of-monte-cristo', title: 'The Count of Monte Cristo' },
  { id: 'the-odyssey', title: 'The Odyssey' },
  { id: 'the-iliad', title: 'The Iliad' },
  { id: 'meditations', title: 'Meditations' },
  { id: 'the-importance-of-being-earnest', title: 'The Importance of Being Earnest' }
];

async function main() {
  console.log('Starting automated QA verification for 16 extracted reference covers...');
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

          await setViewport(1280, 850);

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

          await screenshot('qa_verified_home_16covers.png');

          // 2. Check Library
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('library');
              setTimeout(resolve, 500);
            })
          `);
          await screenshot('qa_verified_library_16covers.png');

          // 3. Verify all 16 books in Details view
          console.log('\n--- VERIFYING DETAILS VIEW FOR ALL 16 BOOKS ---');
          const detailsResults = [];
          for (const book of REF_16_BOOKS) {
            await evaluate(`
              new Promise((resolve) => {
                window.nookApp.navigateTo('details', { bookId: '${book.id}' });
                setTimeout(resolve, 300);
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

          // Capture a combined screenshot of details for Pride and Prejudice and Dracula
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'pride-and-prejudice' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_verified_details_pride.png');

          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'dracula' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_verified_details_dracula.png');

          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('details', { bookId: 'the-great-gatsby' });
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_verified_details_gatsby.png');

          // 4. Check Spin the Nook
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('spin');
              setTimeout(resolve, 300);
            })
          `);
          await screenshot('qa_verified_spin.png');

          console.log('\n================ 16 COVERS QA VERIFICATION SUMMARY ================');
          let allPassed = true;
          for (const res of detailsResults) {
            const expectedSrc = `assets/covers/${res.bookId}.png`;
            const pass = res.coverSrc.includes(expectedSrc) && res.complete && res.naturalWidth > 0;
            if (!pass) allPassed = false;
            console.log(`  - ${res.bookId}: ${pass ? 'PASS' : 'FAIL'} (src: ${res.coverSrc}, ${res.naturalWidth}x${res.naturalHeight})`);
          }
          console.log(`\nOverall 16/16 Verification: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
          console.log('===================================================================\n');

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
