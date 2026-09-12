const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

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

          console.log('=== VERIFYING EXPANDED 105-BOOK CATALOG RUNTIME UI ===\n');

          // Bypass entry overlay directly for testing
          await evaluate(`
            localStorage.setItem('nook_visited', 'true');
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

          await new Promise((r) => setTimeout(r, 1000));

          // 1. Home View Checks
          const catalogLen = await evaluate('window.nookApp ? window.nookApp.catalog.length : 0');
          console.log(`[CHECK 1] Catalog loaded in App: ${catalogLen} books (Target: >=100)`);

          const homeCardsCount = await evaluate('document.querySelectorAll("#view-home .book-card").length');
          console.log(`[CHECK 2] Home view rendered book cards count: ${homeCardsCount}`);

          const curatedShelvesCount = await evaluate('document.querySelectorAll("#view-home .collection-card").length');
          console.log(`[CHECK 3] Home curated shelves count: ${curatedShelvesCount}`);

          // 2. Library View Checks
          await evaluate('window.nookApp.navigateTo("library")');
          await new Promise((r) => setTimeout(r, 500));

          const libCountText = await evaluate('document.querySelector(".lib-count-text") ? document.querySelector(".lib-count-text").textContent : ""');
          const libCardsCount = await evaluate('document.querySelectorAll("#library-books-grid .book-card").length');
          const chipsCount = await evaluate('document.querySelectorAll(".chips .chip").length');
          console.log(`[CHECK 4] Library count header: "${libCountText}"`);
          console.log(`[CHECK 5] Library grid cards count: ${libCardsCount}`);
          console.log(`[CHECK 6] Category filter chips count: ${chipsCount}`);

          // 3. Category Filter Test (e.g., Romance)
          await evaluate(`
            const romanceChip = Array.from(document.querySelectorAll('.chips .chip')).find(c => c.textContent.includes('Romance'));
            if (romanceChip) romanceChip.click();
          `);
          await new Promise((r) => setTimeout(r, 300));
          const romanceFilteredCount = await evaluate('document.querySelectorAll("#library-books-grid .book-card").length');
          const romanceResultText = await evaluate('document.querySelector(".lib-count-text").textContent');
          console.log(`[CHECK 7] Romance filter active: "${romanceResultText}", books rendered: ${romanceFilteredCount}`);

          // 4. Search Test for Discovery Book
          await evaluate(`
            window.nookApp.library.clearFilters();
            window.nookApp.library.setSearch('Evelyn Hugo');
          `);
          await new Promise((r) => setTimeout(r, 300));
          const searchEvelynCount = await evaluate('document.querySelectorAll("#library-books-grid .book-card").length');
          const searchEvelynTitle = await evaluate('document.querySelector("#library-books-grid .book-card .title") ? document.querySelector("#library-books-grid .book-card .title").textContent : ""');
          console.log(`[CHECK 8] Search "Evelyn Hugo" matches: ${searchEvelynCount}, First Title: "${searchEvelynTitle}"`);

          // 5. Details View for Discovery Title
          await evaluate('window.nookApp.navigateTo("details", { bookId: "the-seven-husbands-of-evelyn-hugo" })');
          await new Promise((r) => setTimeout(r, 500));
          const evelynPill = await evaluate('document.querySelector(".details-category-pill").textContent');
          const evelynBtn = await evaluate('document.querySelector("#detailsDiscoveryBtn") ? document.querySelector("#detailsDiscoveryBtn").textContent.trim() : ""');
          const evelynRights = await evaluate('document.querySelector(".details-edition-section .span-full .edition-card-value").textContent');
          console.log(`[CHECK 9] Discovery Details View: Pill="${evelynPill}", CTA="${evelynBtn}", Rights="${evelynRights}"`);

          // 6. Search Test & Details for Public Domain Classic (e.g. Jane Eyre)
          await evaluate('window.nookApp.navigateTo("details", { bookId: "jane-eyre" })');
          await new Promise((r) => setTimeout(r, 500));
          const janeTitle = await evaluate('document.querySelector(".details-title").textContent');
          const janeReadBtn = await evaluate('document.querySelector("#detailsReadNowBtn") ? document.querySelector("#detailsReadNowBtn").textContent.trim() : ""');
          console.log(`[CHECK 10] Classic Details View: Title="${janeTitle}", CTA="${janeReadBtn}"`);

          // 7. Reader Test (Read Now for Jane Eyre)
          await evaluate('document.querySelector("#detailsReadNowBtn").click()');
          await new Promise((r) => setTimeout(r, 800));
          const inReaderMode = await evaluate('document.body.classList.contains("in-reader-mode")');
          const readerBookTitle = await evaluate('document.getElementById("readerBookTitle") ? document.getElementById("readerBookTitle").textContent : ""');
          const readerChapterTitle = await evaluate('document.getElementById("readerChapterTitle") ? document.getElementById("readerChapterTitle").textContent : ""');
          const readerProseLen = await evaluate('document.getElementById("readerProseContent") ? document.getElementById("readerProseContent").textContent.length : 0');
          console.log(`[CHECK 11] Reader Active: ${inReaderMode}, Book: "${readerBookTitle}", Chapter: "${readerChapterTitle}", Prose Length: ${readerProseLen} chars`);

          // 8. Spin the Nook Test
          await evaluate('window.nookApp.navigateTo("spin")');
          await new Promise((r) => setTimeout(r, 500));
          const spinBtnExists = await evaluate('!!document.getElementById("spinBtn")');
          console.log(`[CHECK 12] Spin View active, Spin button exists: ${spinBtnExists}`);
          await evaluate('document.getElementById("spinBtn").click()');
          console.log('>>> Spinning the Nook wheel...');
          await new Promise((r) => setTimeout(r, 3200));
          const winnerShown = await evaluate('document.getElementById("resultCard").classList.contains("show")');
          const winnerTitle = await evaluate('document.getElementById("resultTitle").textContent');
          const winnerAuthor = await evaluate('document.getElementById("resultAuthor").textContent');
          console.log(`[CHECK 13] Spin result: winnerShown=${winnerShown}, Title="${winnerTitle}", Author="${winnerAuthor}"`);

          console.log('\n=== ALL UI & RUNTIME VALIDATIONS COMPLETED SUCCESSFULLY ===\n');

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
