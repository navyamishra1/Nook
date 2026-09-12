/**
 * Live Browser QA for Feature #3B via Microsoft Edge CDP
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  console.log('Starting Edge CDP QA session...');
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
        if (!targetPage) {
          console.error('Target page localhost:8000 not found in CDP endpoints');
          edge.kill();
          process.exit(1);
        }

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
            return res.result ? res.result.value : res;
          }

          console.log('\n--- 1. Dismissing Entry Screen if active ---');
          await evaluate(`
            const enterBtn = document.getElementById('enterNookBtn');
            if (enterBtn) enterBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 1200));

          console.log('\n--- 2. Checking Home Recommendation Cards ---');
          const homeCards = await evaluate(`
            (() => {
              const cards = Array.from(document.querySelectorAll('.home-section:not(.reading-intent-section) .book-card'));
              return cards.map(c => ({
                title: c.querySelector('.title')?.textContent?.trim(),
                author: c.querySelector('.author')?.textContent?.trim(),
                reason: c.querySelector('.rec-reason')?.textContent?.trim()
              }));
            })()
          `);
          console.log('Found Home recommendation cards:', homeCards.length);
          homeCards.forEach((c, idx) => {
            console.log(`  Card ${idx + 1}: ${c.title} by ${c.author}`);
            console.log(`    Reason: "${c.reason || 'NONE'}"`);
          });

          if (homeCards.length === 0 || !homeCards[0].reason) {
            console.error('FAIL: No recommendation reasons found on Home cards');
          } else {
            console.log('✓ Recommendation reasons properly rendered on Home cards');
          }

          console.log('\n--- 3. Clicking Recommendation Card to Open Details ---');
          await evaluate(`
            const firstRecCard = document.querySelector('.home-section:not(.reading-intent-section) .book-card');
            if (firstRecCard) firstRecCard.click();
          `);
          await new Promise((r) => setTimeout(r, 600));

          const detailsInfo = await evaluate(`
            (() => {
              const detailsView = document.getElementById('view-details');
              const curatorNote = detailsView.querySelector('.curator-note');
              const kicker = curatorNote?.querySelector('.curator-note-kicker')?.textContent?.trim();
              const body = curatorNote?.querySelector('.curator-note-body')?.textContent?.trim();
              const title = detailsView.querySelector('.details-title')?.textContent?.trim();
              return {
                title,
                hasNote: Boolean(curatorNote),
                kicker,
                body
              };
            })()
          `);
          console.log('Details View Status:');
          console.log('  Book Title:', detailsInfo.title);
          console.log('  Has Curator Note:', detailsInfo.hasNote);
          console.log('  Kicker:', detailsInfo.kicker);
          console.log('  Note Body:', detailsInfo.body);

          if (detailsInfo.hasNote && detailsInfo.kicker === "Curator's Reading Note" && detailsInfo.body) {
            console.log('✓ Curator\'s Reading Note successfully rendered on Details page from Home navigation');
          } else {
            console.error('FAIL: Curator\'s Reading Note not found or incomplete on Details page');
          }

          console.log('\n--- 4. Navigating to Library -> Opening Book (Should have NO Curator Note) ---');
          await evaluate(`
            const libLink = document.querySelector('nav.mainnav a[data-nav="library"]');
            if (libLink) libLink.click();
          `);
          await new Promise((r) => setTimeout(r, 600));

          await evaluate(`
            const libCard = document.querySelector('#view-library .book-card');
            if (libCard) libCard.click();
          `);
          await new Promise((r) => setTimeout(r, 600));

          const libDetailsInfo = await evaluate(`
            (() => {
              const detailsView = document.getElementById('view-details');
              const curatorNote = detailsView.querySelector('.curator-note');
              return {
                title: detailsView.querySelector('.details-title')?.textContent?.trim(),
                hasNote: Boolean(curatorNote)
              };
            })()
          `);
          console.log('Library Details View Status:');
          console.log('  Book Title:', libDetailsInfo.title);
          console.log('  Has Curator Note:', libDetailsInfo.hasNote);

          if (!libDetailsInfo.hasNote) {
            console.log('✓ Normal Library -> Details navigation correctly does NOT show Curator\'s Reading Note');
          } else {
            console.error('FAIL: Library navigation unexpectedly rendered Curator\'s Reading Note');
          }

          console.log('\n--- 5. Testing Mobile Viewport & Horizontal Overflow ---');
          await send('Emulation.setDeviceMetricsOverride', {
            width: 375,
            height: 667,
            deviceScaleFactor: 2,
            mobile: true
          });
          await evaluate(`
            const homeLink = document.querySelector('nav.mainnav a[data-nav="home"]');
            if (homeLink) homeLink.click();
          `);
          await new Promise((r) => setTimeout(r, 600));

          const overflowCheck = await evaluate(`
            (() => {
              const docWidth = document.documentElement.offsetWidth;
              const scrollWidth = document.documentElement.scrollWidth;
              return {
                docWidth,
                scrollWidth,
                hasHorizontalScroll: scrollWidth > docWidth
              };
            })()
          `);
          console.log('Mobile Viewport Metrics (375px width):', overflowCheck);
          if (!overflowCheck.hasHorizontalScroll) {
            console.log('✓ Mobile viewport has zero horizontal overflow');
          } else {
            console.error('FAIL: Horizontal scroll detected on mobile');
          }

          console.log('\n================ BROWSER CDP QA COMPLETED ================');
          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('CDP Error:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main().catch((err) => {
  console.error('Execution exception:', err);
  process.exit(1);
});
