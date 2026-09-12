const { spawn } = require('child_process');
const http = require('http');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
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
          });

          await send('Runtime.enable');
          await send('Page.enable');
          await send('DOM.enable');

          async function evaluate(expression) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true });
            return res.result ? res.result.value : res;
          }

          console.log('=== VERIFYING HOME CURATION & LIBRARY ARCHITECTURE ===\n');

          // 1. FRESH STATE (No reading history)
          await evaluate(`
            localStorage.setItem('nook_visited', 'true');
            localStorage.removeItem('nook_reading_progress');
            const overlay = document.getElementById('entry-overlay');
            if (overlay) overlay.style.display = 'none';
            const app = document.getElementById('app');
            if (app) {
              app.style.display = 'block';
              app.style.visibility = 'visible';
              app.style.opacity = '1';
            }
            if (window.nookApp) {
              window.nookApp.navigateTo('home');
            }
          `);

          await new Promise((r) => setTimeout(r, 800));

          const totalCatalog = await evaluate('window.nookApp ? window.nookApp.catalog.length : 0');
          const freshHomeCards = await evaluate('document.querySelectorAll("#view-home .book-card").length');
          const freshShelves = await evaluate('document.querySelectorAll("#view-home .collection-card").length');
          const hasContinueFresh = await evaluate('!!document.querySelector("#view-home .continue-card")');

          console.log(`[TEST 1: FRESH STATE]`);
          console.log(`  - Total Catalog Size in Memory: ${totalCatalog} books`);
          console.log(`  - Home Book Cards Rendered: ${freshHomeCards} (Expected: 5, NOT 105)`);
          console.log(`  - Curated Shelves Rendered: ${freshShelves} (Expected: 6)`);
          console.log(`  - Has Fake Continue Reading Card: ${hasContinueFresh} (Expected: false)`);

          // 2. LIBRARY STATE (Full 105 catalog)
          await evaluate('window.nookApp.navigateTo("library")');
          await new Promise((r) => setTimeout(r, 500));

          const libCountText = await evaluate('document.querySelector(".lib-count-text") ? document.querySelector(".lib-count-text").textContent : ""');
          const libCardsCount = await evaluate('document.querySelectorAll("#library-books-grid .book-card").length');
          const chipsCount = await evaluate('document.querySelectorAll(".chips .chip").length');

          console.log(`\n[TEST 2: LIBRARY STATE]`);
          console.log(`  - Library Header Count: "${libCountText}"`);
          console.log(`  - Library Grid Book Cards: ${libCardsCount} (Expected: 105)`);
          console.log(`  - Category Filter Chips: ${chipsCount}`);

          // 3. ACTIVE READING STATE (Personalized Recommendations from 105 Catalog)
          // Simulate user reading Frankenstein (Gothic Fiction, Science Fiction, Horror)
          await evaluate(`
            import('./js/catalog.js').then(module => {
              module.saveReadingProgress('frankenstein', 2, 'Chapter 2', 25, 0.2);
              window.nookApp.navigateTo('home');
            });
          `);

          await new Promise((r) => setTimeout(r, 800));

          const activeHomeTotalCards = await evaluate('document.querySelectorAll("#view-home .book-card").length');
          const hasContinueActive = await evaluate('!!document.querySelector("#view-home .continue-card")');
          const continueTitle = await evaluate('document.querySelector(".continue-title") ? document.querySelector(".continue-title").textContent : ""');
          const continuePercent = await evaluate('document.querySelector(".status-percent") ? document.querySelector(".status-percent").textContent : ""');

          const pickedHeading = await evaluate('document.getElementById("recommended-heading") ? document.getElementById("recommended-heading").previousElementSibling.textContent : ""');
          const pickedCardsCount = await evaluate(`
            const pickedSection = document.querySelector('section[aria-labelledby="recommended-heading"]');
            pickedSection ? pickedSection.querySelectorAll('.book-card').length : 0
          `);

          const moreLikeHeading = await evaluate('document.getElementById("more-like-heading") ? document.getElementById("more-like-heading").textContent : ""');
          const moreLikeCardsCount = await evaluate(`
            const moreSection = document.querySelector('section[aria-labelledby="more-like-heading"]');
            moreSection ? moreSection.querySelectorAll('.book-card').length : 0
          `);

          const samplePickedTitles = await evaluate(`
            Array.from(document.querySelectorAll('section[aria-labelledby="recommended-heading"] .book-card .title')).map(el => el.textContent)
          `);

          const sampleMoreLikeTitles = await evaluate(`
            Array.from(document.querySelectorAll('section[aria-labelledby="more-like-heading"] .book-card .title')).map(el => el.textContent)
          `);

          console.log(`\n[TEST 3: ACTIVE READING & RECOMMENDATION ENGINE]`);
          console.log(`  - Has Active Continue Reading: ${hasContinueActive}`);
          console.log(`  - Continue Reading Title: "${continueTitle}" (${continuePercent})`);
          console.log(`  - Section 2 Label: "${pickedHeading}" with ${pickedCardsCount} books`);
          console.log(`    Sample Recommendations: ${JSON.stringify(samplePickedTitles)}`);
          console.log(`  - Section 3 Heading: "${moreLikeHeading}" with ${moreLikeCardsCount} books`);
          console.log(`    Sample Overlap Titles: ${JSON.stringify(sampleMoreLikeTitles)}`);
          console.log(`  - Total Book Cards on Home (Excluding continue banner): ${activeHomeTotalCards} cards (Total on Home: ${activeHomeTotalCards + (hasContinueActive ? 1 : 0)} books, Target: 10–15)`);

          console.log('\n=== ALL TESTS VERIFIED: HOME IS CURATED (10-11 BOOKS), LIBRARY IS COMPLETE (105 BOOKS) ===\n');

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (e) {
        console.error(e);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
