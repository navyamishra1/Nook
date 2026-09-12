const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('Starting Nook Entry / Open Book Animation Verification Suite...');
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
              console.log(`  -> Captured screenshot: ${filename}`);
            }
          }

          await setViewport(1280, 850);

          // Reset entry to closed state
          await evaluate(`
            localStorage.removeItem('nook_visited');
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.resetToClosed();
            }
          `);

          await new Promise((r) => setTimeout(r, 400));

          console.log('\n--- 1. TESTING CLOSED BOOK INITIAL STATE (PHASE 1) ---');
          const isOverlayVisible = await evaluate(`!document.getElementById('entry-overlay').classList.contains('entry-hidden')`);
          const bookClass = await evaluate(`document.getElementById('tactile-book-trigger').className`);
          const ribbonWidth = await evaluate(`getComputedStyle(document.querySelector('.book-ribbon')).getPropertyValue('width')`);
          const gutterOpacity = await evaluate(`getComputedStyle(document.querySelector('.book-spine-gutter')).getPropertyValue('opacity')`);

          console.log('   Overlay visible:', isOverlayVisible);
          console.log('   Book className:', JSON.stringify(bookClass));
          console.log('   Ribbon width:', ribbonWidth);
          console.log('   Spine gutter opacity (closed):', gutterOpacity);

          if (!isOverlayVisible || ribbonWidth !== '9px' || gutterOpacity !== '0') {
            throw new Error('Phase 1 Closed Book state assertion failed');
          }
          await screenshot('entry_phase1_closed.png');

          console.log('\n--- 2. TESTING CLICK-TO-OPEN & OPEN SPREAD (PHASE 2 & 3) ---');
          const clickTime = Date.now();
          await evaluate(`document.getElementById('tactile-book-trigger').click()`);

          // Wait 550ms for book to reach open spread hold
          await new Promise((r) => setTimeout(r, 550));
          const openBookClass = await evaluate(`document.getElementById('tactile-book-trigger').className`);
          const leftPageOpacity = await evaluate(`getComputedStyle(document.querySelector('.inside-page-left')).getPropertyValue('opacity')`);
          const gutterOpenOpacity = await evaluate(`getComputedStyle(document.querySelector('.book-spine-gutter')).getPropertyValue('opacity')`);
          const ribbonOpenTransform = await evaluate(`getComputedStyle(document.querySelector('.book-ribbon')).getPropertyValue('transform')`);

          console.log('   Book className at 550ms:', JSON.stringify(openBookClass));
          console.log('   Left page opacity (spread hold):', leftPageOpacity);
          console.log('   Spine gutter opacity (spread hold):', gutterOpenOpacity);
          console.log('   Ribbon transform (spread hold):', ribbonOpenTransform);

          if (!openBookClass.includes('is-open') || leftPageOpacity !== '1' || gutterOpenOpacity !== '1') {
            throw new Error('Phase 3 Open Spread state assertion failed');
          }
          await screenshot('entry_phase3_open_spread.png');

          console.log('\n--- 3. TESTING ZOOM TRANSITION (PHASE 4) ---');
          // Wait another 300ms (total ~850ms, zoom active)
          await new Promise((r) => setTimeout(r, 300));
          const enteringClass = await evaluate(`document.getElementById('tactile-book-trigger').className`);
          const stageTransform = await evaluate(`getComputedStyle(document.querySelector('.book-stage-container')).getPropertyValue('transform')`);

          console.log('   Book className at 850ms:', JSON.stringify(enteringClass));
          console.log('   Stage transform during zoom:', stageTransform);

          if (!enteringClass.includes('is-entering')) {
            throw new Error('Phase 4 Entering Zoom state assertion failed');
          }
          await screenshot('entry_phase4_entering_zoom.png');

          console.log('\n--- 4. TESTING HOMEPAGE REVEAL & COMPLETION (PHASE 5 & 6) ---');
          // Wait for sequence completion (at ~1450ms total)
          await new Promise((r) => setTimeout(r, 600));
          const finalOverlayClass = await evaluate(`document.getElementById('entry-overlay').className`);
          const appClass = await evaluate(`document.getElementById('app').className`);
          const appOpacity = await evaluate(`getComputedStyle(document.getElementById('app')).getPropertyValue('opacity')`);

          console.log('   Final overlay className:', JSON.stringify(finalOverlayClass));
          console.log('   Final app className:', JSON.stringify(appClass));
          console.log('   Final app opacity:', appOpacity);

          if (!finalOverlayClass.includes('entry-hidden') || !appClass.includes('app-visible') || appOpacity !== '1') {
            throw new Error('Phase 6 Completion assertion failed');
          }
          await screenshot('entry_phase6_completed_home.png');

          console.log('\n--- 5. TESTING SKIP BUTTON FUNCTIONALITY ---');
          // Reset and test skip
          await evaluate(`
            window.nookApp.entry.resetToClosed();
          `);
          await new Promise((r) => setTimeout(r, 200));
          await evaluate(`document.getElementById('entry-skip-btn').click()`);
          await new Promise((r) => setTimeout(r, 200));

          const skipOverlayHidden = await evaluate(`document.getElementById('entry-overlay').classList.contains('entry-hidden')`);
          console.log('   Skip button immediately hides overlay:', skipOverlayHidden);
          if (!skipOverlayHidden) {
            throw new Error('Skip button test failed');
          }

          console.log('\n======================================================');
          console.log('✓ ALL ENTRY ANIMATION VERIFICATIONS PASSED SUCCESSFULLY!');
          console.log('======================================================\n');

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('Test failed with error:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
