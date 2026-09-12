const { spawn } = require('child_process');
const http = require('http');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  console.log('Starting Edge for Home catalog integration verification...');
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
            if (parsed.method === 'Runtime.consoleAPICalled') {
              console.log('[BROWSER CONSOLE]', parsed.params.args.map((a) => a.value || a.description).join(' '));
            }
          });

          await send('Runtime.enable');
          await send('Page.enable');
          await send('DOM.enable');

          async function evaluate(expression) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true });
            return res.result ? res.result.value : res;
          }

          console.log('=== VERIFYING REAL CATALOG ON NOOK HOME ===\n');

          // 1. Clear progress & visited state
          await evaluate("localStorage.removeItem('nook_visited'); localStorage.removeItem('nook_reading_progress');");

          // 2. Click book to enter
          console.log('Clicking book to trigger entry animation...');
          await evaluate("document.getElementById('tactile-book-trigger').click()");

          // Wait for entry animation to complete (3.8s)
          await new Promise((r) => setTimeout(r, 3800));

          // 3. Inspect loaded catalog in window.nookApp
          const catalogLength = await evaluate("window.nookApp ? window.nookApp.catalog.length : 0");
          const catalogTitles = await evaluate("window.nookApp ? window.nookApp.catalog.map(b => b.title) : []");
          const catalogAuthors = await evaluate("window.nookApp ? window.nookApp.catalog.map(b => b.author) : []");
          console.log('1. Catalog items loaded at runtime:', catalogLength);
          console.log('2. Verified Titles in runtime catalog:');
          catalogTitles.forEach((t, i) => console.log(`   [${i + 1}] ${t} (by ${catalogAuthors[i]})`));

          // 4. Inspect rendered DOM on Home view
          const renderedCardsCount = await evaluate("document.querySelectorAll('#view-home .book-card').length");
          const renderedBookIds = await evaluate("[...document.querySelectorAll('#view-home .book-card')].map(c => c.getAttribute('data-book-id'))");
          const primaryTitle = await evaluate("document.querySelector('#view-home .book-card.primary .title') ? document.querySelector('#view-home .book-card.primary .title').textContent : 'NONE'");
          console.log('\n3. Rendered Book Cards on Home:', renderedCardsCount);
          console.log('4. Rendered Book IDs:', renderedBookIds);
          console.log('5. Primary Featured Book Title:', primaryTitle);

          // 5. Inspect Continue Reading section (should be HIDDEN when no progress)
          const continueStripExists = await evaluate("!!document.querySelector('#view-home .continue-strip')");
          console.log('\n6. Continue Reading section rendered (when progress is null):', continueStripExists, '(Expected: false)');

          // 6. Test simulating saved reading progress
          console.log('\nSimulating saved progress for Frankenstein (Chapter 2, 45%)...');
          await evaluate(`
            localStorage.setItem('nook_reading_progress', JSON.stringify({
              bookId: 'frankenstein',
              chapterNumber: 2,
              chapterTitle: 'Chapter II',
              progressPercent: 45
            }));
            window.nookApp.renderHome();
          `);
          const continueStripWithData = await evaluate("!!document.querySelector('#view-home .continue-strip')");
          const continueStripTitle = await evaluate("document.querySelector('#view-home .continue-strip .t') ? document.querySelector('#view-home .continue-strip .t').textContent : 'NONE'");
          const continueStripInfo = await evaluate("document.querySelector('#view-home .continue-strip .p') ? document.querySelector('#view-home .continue-strip .p').textContent : 'NONE'");
          const continueStripBarWidth = await evaluate("document.querySelector('#view-home .continue-strip .bar span') ? document.querySelector('#view-home .continue-strip .bar span').style.width : 'NONE'");
          console.log('7. Continue Reading rendered after saving progress:', continueStripWithData, '(Expected: true)');
          console.log('8. Continue Reading Title:', continueStripTitle);
          console.log('9. Continue Reading Info:', continueStripInfo);
          console.log('10. Continue Reading Progress Bar Width:', continueStripBarWidth);

          // 7. Inspect Curated Collections
          const collectionNames = await evaluate("[...document.querySelectorAll('#view-home .collection-card .name')].map(el => el.textContent)");
          const collectionCounts = await evaluate("[...document.querySelectorAll('#view-home .collection-card .count')].map(el => el.textContent)");
          console.log('\n11. Curated Collections extracted from actual catalog categories:');
          collectionNames.forEach((name, i) => console.log(`   - ${name}: ${collectionCounts[i]}`));

          // 8. Test Error state rendering
          console.log('\nTesting error state rendering on Home view...');
          await evaluate(`
            window.nookApp.error = new Error('Simulated network failure reading books.json');
            window.nookApp.renderHome();
          `);
          const errorTitle = await evaluate("document.querySelector('#view-home .error-title') ? document.querySelector('#view-home .error-title').textContent : 'NONE'");
          const errorText = await evaluate("document.querySelector('#view-home .error-text') ? document.querySelector('#view-home .error-text').textContent : 'NONE'");
          const retryBtnExists = await evaluate("!!document.querySelector('#view-home .retry-btn')");
          console.log('12. Error Title:', errorTitle);
          console.log('13. Error Text:', errorText);
          console.log('14. Retry Button Exists:', retryBtnExists);

          // Restore normal Home state
          await evaluate(`
            window.nookApp.error = null;
            window.nookApp.renderHome();
          `);

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error(err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
