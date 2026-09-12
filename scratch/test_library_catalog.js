const { spawn } = require('child_process');
const http = require('http');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  console.log('Starting Edge for Phase 3B Library integration verification...');
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

          console.log('=== PHASE 3B: NOOK LIBRARY VERIFICATION ===\n');

          // 1. Enter Nook and navigate to Library
          await evaluate("localStorage.removeItem('nook_visited');");
          await evaluate("document.getElementById('tactile-book-trigger').click()");
          await new Promise((r) => setTimeout(r, 3800));

          console.log('Navigating to Library view...');
          await evaluate("window.nookApp.navigateTo('library')");

          // Verify Library view active
          const isLibraryActive = await evaluate("document.getElementById('view-library').classList.contains('active')");
          console.log('1. Library view active:', isLibraryActive);

          // 2. Initial Library rendering
          const initialCardCount = await evaluate("document.querySelectorAll('#view-library .book-card').length");
          const initialTitles = await evaluate("[...document.querySelectorAll('#view-library .book-card .title')].map(t => t.textContent)");
          console.log('\n2. Initial Library Cards Count:', initialCardCount);
          console.log('   Titles rendered:');
          initialTitles.forEach((t, i) => console.log(`   [${i + 1}] ${t}`));

          // 3. Test Category Filtering
          console.log('\n3. Testing Category Filter: "Gothic Fiction"...');
          await evaluate("window.nookApp.library.setCategory('Gothic Fiction')");
          const gothicCount = await evaluate("document.querySelectorAll('#view-library .book-card').length");
          const gothicTitle = await evaluate("document.querySelector('#view-library .book-card .title').textContent");
          console.log('   - Filtered count for "Gothic Fiction":', gothicCount);
          console.log('   - Book title rendered:', gothicTitle);

          console.log('\n4. Testing Category Filter: "Romance"...');
          await evaluate("window.nookApp.library.setCategory('Romance')");
          const romanceCount = await evaluate("document.querySelectorAll('#view-library .book-card').length");
          const romanceTitle = await evaluate("document.querySelector('#view-library .book-card .title').textContent");
          console.log('   - Filtered count for "Romance":', romanceCount);
          console.log('   - Book title rendered:', romanceTitle);

          // Reset to All
          await evaluate("window.nookApp.library.setCategory('All')");

          // 4. Test Search
          console.log('\n5. Testing Search: Title "alice"...');
          await evaluate("window.nookApp.library.setSearch('alice')");
          const aliceCount = await evaluate("document.querySelectorAll('#view-library .book-card').length");
          const aliceTitle = await evaluate("document.querySelector('#view-library .book-card .title').textContent");
          console.log('   - Search count for "alice":', aliceCount);
          console.log('   - Book title rendered:', aliceTitle);

          console.log('\n6. Testing Search: Author "  fitzgerald  " (case/whitespace tolerance)...');
          await evaluate("window.nookApp.library.setSearch('  fitzgerald  ')");
          const gatsbyCount = await evaluate("document.querySelectorAll('#view-library .book-card').length");
          const gatsbyTitle = await evaluate("document.querySelector('#view-library .book-card .title').textContent");
          console.log('   - Search count for "  fitzgerald  ":', gatsbyCount);
          console.log('   - Book title rendered:', gatsbyTitle);

          // 5. Test Search + Category Combo
          console.log('\n7. Testing Search ("mary") + Category ("Gothic Fiction") Combo...');
          await evaluate("window.nookApp.library.setCategory('Gothic Fiction')");
          await evaluate("window.nookApp.library.setSearch('mary')");
          const comboMatchCount = await evaluate("document.querySelectorAll('#view-library .book-card').length");
          console.log('   - Combo matching count:', comboMatchCount);

          console.log('\n8. Testing Search ("mary") + Mismatched Category ("Romance") Combo...');
          await evaluate("window.nookApp.library.setCategory('Romance')");
          const comboZeroCount = await evaluate("document.querySelectorAll('#view-library .book-card').length");
          const emptyStateVisible = await evaluate("!!document.querySelector('#view-library .lib-empty-state')");
          console.log('   - Mismatched combo count:', comboZeroCount);
          console.log('   - Empty state visible:', emptyStateVisible);

          // 6. Test Clear Filters
          console.log('\n9. Testing Clear Filters action...');
          await evaluate("window.nookApp.library.clearFilters()");
          const resetCardCount = await evaluate("document.querySelectorAll('#view-library .book-card').length");
          console.log('   - Cards count after clear:', resetCardCount);

          // 7. Test Sorting
          console.log('\n10. Testing Sorting: Title (A-Z)...');
          await evaluate("window.nookApp.library.setSort('title')");
          const titleSorted = await evaluate("[...document.querySelectorAll('#view-library .book-card .title')].map(t => t.textContent)");
          console.log('   - Sorted by Title (A-Z):', titleSorted);

          console.log('\n11. Testing Sorting: Author (A-Z)...');
          await evaluate("window.nookApp.library.setSort('author')");
          const authorSorted = await evaluate("[...document.querySelectorAll('#view-library .book-card .author')].map(t => t.textContent)");
          console.log('   - Sorted by Author (A-Z):', authorSorted);

          console.log('\n12. Testing Sorting: Shortest (~reading time)...');
          await evaluate("window.nookApp.library.setSort('shortest')");
          const shortestTitles = await evaluate("[...document.querySelectorAll('#view-library .book-card .title')].map(t => t.textContent)");
          console.log('   - Sorted by Shortest:', shortestTitles);

          // 8. Test Book Selection
          console.log('\n13. Testing Book Card Selection...');
          await evaluate("document.querySelector('#view-library .book-card[data-book-id=\"pride-and-prejudice\"]').click()");
          const selectedBook = await evaluate("window.nookApp.selectedBookId");
          console.log('   - nookApp.selectedBookId after clicking Pride & Prejudice:', selectedBook);

          // 9. Test Navigation from Home Collection Card
          console.log('\n14. Testing Navigation from Home Collection card ("Gothic Fiction")...');
          await evaluate("window.nookApp.navigateTo('home')");
          await evaluate("document.querySelector('#view-home .collection-card[data-filter=\"Gothic Fiction\"]').click()");
          const activeTabInLibrary = await evaluate("document.getElementById('view-library').classList.contains('active')");
          const currentLibCategory = await evaluate("window.nookApp.library.selectedCategory");
          const activeFilteredCount = await evaluate("document.querySelectorAll('#view-library .book-card').length");
          console.log('   - Successfully navigated to Library:', activeTabInLibrary);
          console.log('   - Active category in Library:', currentLibCategory);
          console.log('   - Number of cards displayed:', activeFilteredCount);

          ws.close();
          edge.kill();
          process.exit(0);
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
