const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';
const PROD_URL = 'https://frontend-inky-one-39.vercel.app';

async function verifyVercelProduction() {
  console.log('================================================================');
  console.log(`VERIFYING LIVE VERCEL PRODUCTION DEPLOYMENT: ${PROD_URL}`);
  console.log('================================================================\n');

  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    PROD_URL
  ]);

  await new Promise((r) => setTimeout(r, 2500));

  const req = http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const pages = JSON.parse(data);
        const targetPage = pages.find((p) => p.url.includes('vercel.app'));
        if (!targetPage) throw new Error('Target Vercel production page not found in browser');
        const ws = new globalThis.WebSocket(targetPage.webSocketDebuggerUrl);

        let id = 1;
        const pending = new Map();
        const failedNetworkRequests = [];
        const consoleErrors = [];

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

            // Track network failures
            if (parsed.method === 'Network.responseReceived') {
              const status = parsed.params.response.status;
              const url = parsed.params.response.url;
              if (status >= 400) {
                failedNetworkRequests.push({ url, status });
              }
            }

            // Track console errors
            if (parsed.method === 'Runtime.consoleAPICalled') {
              if (parsed.params.type === 'error') {
                consoleErrors.push(parsed.params.args.map((a) => a.value || a.description).join(' '));
              }
            }
          });

          await send('Runtime.enable');
          await send('Page.enable');
          await send('DOM.enable');
          await send('Network.enable');
          await send('Input.enable');

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
              mobile: false
            });
          }

          async function screenshot(filename) {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            if (res && res.data) {
              const buf = Buffer.from(res.data, 'base64');
              const fullPath = path.join(artifactDir, filename);
              fs.writeFileSync(fullPath, buf);
              console.log(`  [Screenshot] Saved: ${filename}`);
            }
          }

          await setViewport(1280, 850);

          // Wait for window.nookApp initialization
          for (let i = 0; i < 40; i++) {
            const isReady = await evaluate(`!!(window.nookApp && window.nookApp.entry && window.nookApp.catalog)`);
            if (isReady) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          // -------------------------------------------------------------------
          // 1. ENTRY BOOK EXPERIENCE (CLICK & KEYBOARD)
          // -------------------------------------------------------------------
          console.log('\n--- 1. Testing Live Entry Screen & Click Activation ---');
          const isOverlayPresent = await evaluate(`!document.getElementById('entry-overlay').classList.contains('entry-hidden')`);
          console.log('   Entry overlay present on initial load:', isOverlayPresent);
          if (!isOverlayPresent) throw new Error('Entry overlay not present on live page load');

          // Click book to trigger opening
          await evaluate(`document.getElementById('tactile-book-trigger').click()`);
          await new Promise((r) => setTimeout(r, 60));
          const entryState = await evaluate(`window.nookApp.entry.state`);
          console.log('   State after book click:', entryState);
          if (entryState !== 'opening') throw new Error('Live entry click failed to start opening sequence');

          // Wait for sequence to complete
          await new Promise((r) => setTimeout(r, 1400));
          const isHomeVisible = await evaluate(`document.getElementById('app').classList.contains('app-visible')`);
          console.log('   Home view visible after opening sequence:', isHomeVisible);
          if (!isHomeVisible) throw new Error('Homepage not visible after entry completion');
          await screenshot('vercel_prod_home.png');

          // Test Replay & Enter / Space Key
          console.log('\n--- 2. Testing Entry Replay & Enter/Space Activation ---');
          await evaluate(`window.nookApp.entry.replay();`);
          await new Promise((r) => setTimeout(r, 200));
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
          await new Promise((r) => setTimeout(r, 60));
          const replayState = await evaluate(`window.nookApp.entry.state`);
          console.log('   Replay state after Enter keypress:', replayState);
          if (replayState !== 'opening') throw new Error('Enter key failed on live entry replay');
          await new Promise((r) => setTimeout(r, 1400));

          // -------------------------------------------------------------------
          // 3. 105-BOOK CATALOG LOADING & METADATA
          // -------------------------------------------------------------------
          console.log('\n--- 3. Verifying 105-Book Catalog Loading & Validation ---');
          const catalogCount = await evaluate(`window.nookApp.catalog ? window.nookApp.catalog.length : 0`);
          console.log(`   Catalog books loaded: ${catalogCount} / 105`);
          if (catalogCount !== 105) throw new Error(`Catalog count mismatch on live Vercel: expected 105, got ${catalogCount}`);

          // -------------------------------------------------------------------
          // 4. HOMEPAGE CURATED SECTIONS & COVERS
          // -------------------------------------------------------------------
          console.log('\n--- 4. Verifying Homepage Shelves & Cover Images ---');
          const homeCoversCount = await evaluate(`document.querySelectorAll('#view-home .book-card img, #view-home .book-spine-card img').length`);
          console.log(`   Homepage rendered book cover images: ${homeCoversCount}`);
          if (homeCoversCount < 3) throw new Error('Homepage cover images failed to render');

          // -------------------------------------------------------------------
          // 5. LIBRARY VIEW & 105 CARDS
          // -------------------------------------------------------------------
          console.log('\n--- 5. Verifying Library Navigation & Full Grid ---');
          await evaluate(`window.nookApp.navigateTo('library')`);
          await new Promise((r) => setTimeout(r, 300));
          const libraryCardsCount = await evaluate(`document.querySelectorAll('#view-library .book-card').length`);
          console.log(`   Library grid rendered book cards: ${libraryCardsCount} / 105`);
          if (libraryCardsCount !== 105) throw new Error(`Library card count mismatch: expected 105, got ${libraryCardsCount}`);
          await screenshot('vercel_prod_library.png');

          // -------------------------------------------------------------------
          // 6. BOOK DETAILS VIEW
          // -------------------------------------------------------------------
          console.log('\n--- 6. Verifying Book Details View ---');
          await evaluate(`window.nookApp.navigateTo('details', { bookId: 'pride-and-prejudice' })`);
          await new Promise((r) => setTimeout(r, 300));
          const detailsTitle = await evaluate(`document.querySelector('#view-details .details-title') ? document.querySelector('#view-details .details-title').textContent.trim() : ''`);
          const detailsAuthor = await evaluate(`document.querySelector('#view-details .details-author') ? document.querySelector('#view-details .details-author').textContent.trim() : ''`);
          console.log(`   Book details loaded: "${detailsTitle}" by ${detailsAuthor}`);
          if (detailsTitle !== 'Pride and Prejudice' || !detailsAuthor.includes('Jane Austen')) {
            throw new Error(`Details page failed to render Pride and Prejudice properly: ${detailsTitle}`);
          }
          await screenshot('vercel_prod_details.png');

          // -------------------------------------------------------------------
          // 7. READER / CONTENT FETCH & PAGINATION
          // -------------------------------------------------------------------
          console.log('\n--- 7. Verifying Reader Loading & Pagination Quality ---');
          await evaluate(`window.nookApp.navigateTo('reader', { bookId: 'pride-and-prejudice', chapterNumber: 1, pageNumber: 1 })`);
          
          // Wait for reader content to load and paginate
          for (let i = 0; i < 40; i++) {
            const hasPaper = await evaluate(`!!(document.getElementById('readerPaperPage') && document.getElementById('readerProseContent'))`);
            if (hasPaper) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          const readerInfo = await evaluate(`
            (() => {
              const paper = document.getElementById('readerPaperPage');
              const pageNum = document.querySelector('.reader-paper-page-number');
              const prose = document.getElementById('readerProseContent');
              return {
                inReaderMode: document.body.classList.contains('in-reader-mode'),
                pageText: pageNum ? pageNum.textContent.trim() : '',
                hasProse: prose && prose.textContent.length > 50,
                sheetWidth: paper ? paper.clientWidth : 0,
                sheetHeight: paper ? paper.clientHeight : 0
              };
            })()
          `);
          console.log('   Reader state:', readerInfo);
          if (!readerInfo.inReaderMode || !readerInfo.hasProse || !readerInfo.pageText.includes('1')) {
            throw new Error('Reader failed to paginate or load Pride and Prejudice content on live production');
          }
          await screenshot('vercel_prod_reader.png');

          // -------------------------------------------------------------------
          // 8. RECOMMENDATIONS ENGINE (SPIN & INTENT)
          // -------------------------------------------------------------------
          console.log('\n--- 8. Verifying Recommendations Engine & Spin the Nook ---');
          await evaluate(`window.nookApp.navigateTo('spin')`);
          await new Promise((r) => setTimeout(r, 300));
          const spinContainer = await evaluate(`!!(document.querySelector('.spin-view') && document.getElementById('wheel'))`);
          console.log('   Spin the Nook view rendered:', spinContainer);
          if (!spinContainer) throw new Error('Spin the Nook view failed to render');
          await screenshot('vercel_prod_spin.png');

          // -------------------------------------------------------------------
          // 9. JOURNAL VIEW & READING TIMELINE
          // -------------------------------------------------------------------
          console.log('\n--- 9. Verifying Journal & Reading Insights ---');
          await evaluate(`window.nookApp.navigateTo('journal')`);
          await new Promise((r) => setTimeout(r, 400));
          const journalActive = await evaluate(`document.getElementById('view-journal').classList.contains('active')`);
          const journalTitle = await evaluate(`document.querySelector('#view-journal .journal-header h1') ? document.querySelector('#view-journal .journal-header h1').textContent.trim() : ''`);
          console.log(`   Journal view active: ${journalActive}, title: "${journalTitle}"`);
          if (!journalActive || !journalTitle) throw new Error('Journal view failed to render on live production');
          await screenshot('vercel_prod_journal.png');

          // -------------------------------------------------------------------
          // 10. NETWORK & CONSOLE ERROR AUDIT
          // -------------------------------------------------------------------
          console.log('\n--- 10. Auditing Network Failures & Console Errors ---');
          console.log('   Failed network requests count:', failedNetworkRequests.length);
          if (failedNetworkRequests.length > 0) {
            console.error('   Failed requests:', failedNetworkRequests);
            throw new Error(`Detected ${failedNetworkRequests.length} failed network requests on live production!`);
          }

          // Filter ignorable favicon or external font warning if any
          const realConsoleErrors = consoleErrors.filter((e) => !e.includes('favicon') && !e.includes('telemetry'));
          console.log('   Console errors count:', realConsoleErrors.length);
          if (realConsoleErrors.length > 0) {
            console.error('   Console errors:', realConsoleErrors);
            throw new Error(`Detected console errors on live production: ${realConsoleErrors.join('; ')}`);
          }

          console.log('\n================================================================');
          console.log('✓ LIVE VERCEL PRODUCTION VERIFICATION PASSED 100% WITH ZERO ERRORS!');
          console.log('================================================================\n');

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('Production verification failed:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

verifyVercelProduction();
