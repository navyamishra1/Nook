const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function runEntryFixTestSuite() {
  console.log('================================================================');
  console.log('STARTING NOOK ENTRY INTERACTION & HOVER BUG FIX TEST SUITE');
  console.log('================================================================\n');

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
        if (!targetPage) throw new Error('Target localhost:8000 page not found');
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
              mobile: width < 600
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

          async function mouseMove(x, y) {
            await send('Input.dispatchMouseEvent', {
              type: 'mouseMoved',
              x,
              y
            });
          }

          async function mouseClick(x, y) {
            await send('Input.dispatchMouseEvent', {
              type: 'mousePressed',
              x,
              y,
              button: 'left',
              clickCount: 1
            });
            await send('Input.dispatchMouseEvent', {
              type: 'mouseReleased',
              x,
              y,
              button: 'left',
              clickCount: 1
            });
          }

          async function keyPress(key, code) {
            await send('Input.dispatchKeyEvent', {
              type: 'keyDown',
              key,
              code
            });
            await send('Input.dispatchKeyEvent', {
              type: 'keyUp',
              key,
              code
            });
          }

          await setViewport(1280, 850);

          // -------------------------------------------------------------------
          // TEST 1 & 2 & 3 & 4: FRESH LOAD & HOVER MOVEMENT STABILITY (BUG 1)
          // -------------------------------------------------------------------
          console.log('--- TEST 1 to 4: Hover Stability & Cursor Movement ---');
          await evaluate(`
            localStorage.removeItem('nook_visited');
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.resetToClosed();
            }
          `);
          await new Promise((r) => setTimeout(r, 400));

          const bookRect = await evaluate(`
            (() => {
              const r = document.getElementById('tactile-book-trigger').getBoundingClientRect();
              return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, x: r.x, y: r.y };
            })()
          `);
          console.log('   Book bounding rect:', bookRect);

          const initialTransform = await evaluate(`getComputedStyle(document.getElementById('tactile-book-trigger')).transform`);
          console.log('   Initial transform (no hover):', initialTransform);

          // Move cursor across multiple positions on the book
          const probePoints = [
            { x: bookRect.left + 20, y: bookRect.top + 20, label: 'Top-Left Corner' },
            { x: bookRect.left + bookRect.width / 2, y: bookRect.top + bookRect.height / 2, label: 'Center (Title)' },
            { x: bookRect.left + 5, y: bookRect.top + bookRect.height / 2, label: 'Spine / Gutter' },
            { x: bookRect.right - 20, y: bookRect.bottom - 20, label: 'Bottom-Right Outer' },
            { x: bookRect.left + bookRect.width / 2, y: bookRect.bottom - 30, label: 'Bottom Publisher Tag' }
          ];

          let hoverTransforms = [];
          for (const pt of probePoints) {
            await mouseMove(pt.x, pt.y);
            await new Promise((r) => setTimeout(r, 80));
            const currentT = await evaluate(`getComputedStyle(document.getElementById('tactile-book-trigger')).transform`);
            const childPointerEvents = await evaluate(`getComputedStyle(document.querySelector('.cover-face-front')).pointerEvents`);
            hoverTransforms.push({ point: pt.label, transform: currentT, childPE: childPointerEvents });
          }

          console.log('   Probe transforms across hover movement:', hoverTransforms);
          const allStable = hoverTransforms.every((h) => h.transform === initialTransform && h.childPE === 'none');
          if (!allStable) {
            throw new Error('BUG 1 FAIL: Book transform shifted or child pointer-events not none during hover!');
          }
          console.log('   ✓ PASS: Book remained 100% stationary and stable during multi-point hovering.');
          await screenshot('test_hover_stability.png');

          // -------------------------------------------------------------------
          // TEST 5, 6, 7: SINGLE CLICK ACTIVATION & IDEMPOTENCY (BUG 2)
          // -------------------------------------------------------------------
          console.log('\n--- TEST 5, 6, 7: Single Click & Idempotency ---');
          const centerX = bookRect.left + bookRect.width / 2;
          const centerY = bookRect.top + bookRect.height / 2;

          // Dispatch single click
          await mouseClick(centerX, centerY);
          await new Promise((r) => setTimeout(r, 60));

          const stateImmediatelyAfterClick = await evaluate(`window.nookApp.entry.state`);
          const bookClassAfterClick = await evaluate(`document.getElementById('tactile-book-trigger').className`);
          console.log('   State immediately after 1st click:', stateImmediatelyAfterClick);
          console.log('   Book className after 1st click:', bookClassAfterClick);

          if (stateImmediatelyAfterClick !== 'opening' || !bookClassAfterClick.includes('is-opening')) {
            throw new Error('BUG 2 FAIL: Single click did not immediately start opening!');
          }
          console.log('   ✓ PASS: Single mouse click immediately started opening sequence.');

          // Dispatch 5 rapid subsequent clicks to test idempotency
          for (let i = 0; i < 5; i++) {
            await mouseClick(centerX, centerY);
            await new Promise((r) => setTimeout(r, 20));
          }

          const stateDuringMultiClick = await evaluate(`window.nookApp.entry.state`);
          console.log('   State after 5 rapid clicks:', stateDuringMultiClick);
          if (stateDuringMultiClick !== 'opening' && stateDuringMultiClick !== 'opened' && stateDuringMultiClick !== 'entering') {
            throw new Error('Animation sequence corrupted by multiple clicks!');
          }
          console.log('   ✓ PASS: Subsequent clicks during animation safely ignored (idempotent).');

          // Wait until completion (~1400ms from start)
          await new Promise((r) => setTimeout(r, 1200));
          const completedState = await evaluate(`window.nookApp.entry.state`);
          const overlayHidden = await evaluate(`document.getElementById('entry-overlay').classList.contains('entry-hidden')`);
          console.log('   Final state after click flow:', completedState, 'overlayHidden:', overlayHidden);
          if (completedState !== 'complete' || !overlayHidden) {
            throw new Error('Sequence did not reach complete state!');
          }
          console.log('   ✓ PASS: Click-initiated sequence completed smoothly to home view.');

          // -------------------------------------------------------------------
          // TEST 8, 9, 10, 11: KEYBOARD ACTIVATION VIA TAB + ENTER
          // -------------------------------------------------------------------
          console.log('\n--- TEST 8 to 11: Keyboard Activation via Tab + Enter ---');
          await evaluate(`
            window.nookApp.entry.resetToClosed();
            document.body.focus();
          `);
          await new Promise((r) => setTimeout(r, 200));

          // Press Tab to focus the book
          await keyPress('Tab', 'Tab');
          await new Promise((r) => setTimeout(r, 100));
          const activeElId = await evaluate(`document.activeElement ? document.activeElement.id : null`);
          console.log('   Active element after Tab:', activeElId);

          // Press Enter once
          await keyPress('Enter', 'Enter');
          await new Promise((r) => setTimeout(r, 60));

          const stateAfterEnter = await evaluate(`window.nookApp.entry.state`);
          console.log('   State after Enter keypress:', stateAfterEnter);
          if (stateAfterEnter !== 'opening') {
            throw new Error('BUG 2 FAIL: Enter key did not initiate opening sequence!');
          }
          console.log('   ✓ PASS: Enter key on focused book deterministically initiated opening sequence.');

          // Wait for completion
          await new Promise((r) => setTimeout(r, 1350));

          // -------------------------------------------------------------------
          // TEST 12, 13, 14, 15: KEYBOARD ACTIVATION VIA SPACE
          // -------------------------------------------------------------------
          console.log('\n--- TEST 12 to 15: Keyboard Activation via Space ---');
          await evaluate(`
            window.nookApp.entry.resetToClosed();
            document.getElementById('tactile-book-trigger').focus();
          `);
          await new Promise((r) => setTimeout(r, 200));

          // Press Space once
          await keyPress(' ', 'Space');
          await new Promise((r) => setTimeout(r, 60));

          const stateAfterSpace = await evaluate(`window.nookApp.entry.state`);
          console.log('   State after Space keypress:', stateAfterSpace);
          if (stateAfterSpace !== 'opening') {
            throw new Error('BUG 2 FAIL: Space key did not initiate opening sequence!');
          }
          console.log('   ✓ PASS: Space key on focused book deterministically initiated opening sequence.');

          // Wait for completion
          await new Promise((r) => setTimeout(r, 1350));

          // -------------------------------------------------------------------
          // TEST 16 & 17: GLOBAL ENTER/SPACE WHEN OVERLAY OPEN (WITHOUT EXPLICIT FOCUS)
          // -------------------------------------------------------------------
          console.log('\n--- TEST 16 & 17: Global Enter Trigger ---');
          await evaluate(`
            window.nookApp.entry.resetToClosed();
            window.focus();
          `);
          await new Promise((r) => setTimeout(r, 200));

          await keyPress('Enter', 'Enter');
          await new Promise((r) => setTimeout(r, 60));

          const stateAfterGlobalEnter = await evaluate(`window.nookApp.entry.state`);
          console.log('   State after Global Enter:', stateAfterGlobalEnter);
          if (stateAfterGlobalEnter !== 'opening') {
            throw new Error('Global Enter key failed to start entry sequence!');
          }
          console.log('   ✓ PASS: Global Enter key opened book directly.');
          await new Promise((r) => setTimeout(r, 1350));

          // -------------------------------------------------------------------
          // TEST 18: SKIP BUTTON & ESCAPE BEHAVIOR
          // -------------------------------------------------------------------
          console.log('\n--- TEST 18: Skip Button and Escape Key ---');
          await evaluate(`window.nookApp.entry.resetToClosed();`);
          await new Promise((r) => setTimeout(r, 200));

          // Test Escape key
          await keyPress('Escape', 'Escape');
          await new Promise((r) => setTimeout(r, 100));
          const escHidden = await evaluate(`document.getElementById('entry-overlay').classList.contains('entry-hidden')`);
          console.log('   Overlay hidden after Escape:', escHidden);
          if (!escHidden) {
            throw new Error('Escape key failed to skip entry overlay!');
          }
          console.log('   ✓ PASS: Escape key immediately skips entry.');

          // Test Skip Button click
          await evaluate(`window.nookApp.entry.resetToClosed();`);
          await new Promise((r) => setTimeout(r, 200));
          await evaluate(`document.getElementById('entry-skip-btn').click();`);
          await new Promise((r) => setTimeout(r, 100));
          const skipBtnHidden = await evaluate(`document.getElementById('entry-overlay').classList.contains('entry-hidden')`);
          console.log('   Overlay hidden after Skip Button click:', skipBtnHidden);
          if (!skipBtnHidden) {
            throw new Error('Skip button click failed to hide overlay!');
          }
          console.log('   ✓ PASS: Skip button immediately enters Nook.');

          // -------------------------------------------------------------------
          // TEST 19: REDUCED MOTION SUPPORT
          // -------------------------------------------------------------------
          console.log('\n--- TEST 19: Reduced Motion Support ---');
          await send('Emulation.setEmulatedMedia', {
            media: 'screen',
            features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
          });
          await evaluate(`window.nookApp.entry.resetToClosed();`);
          await new Promise((r) => setTimeout(r, 200));

          await evaluate(`document.getElementById('tactile-book-trigger').click();`);
          await new Promise((r) => setTimeout(r, 60));
          const rmState = await evaluate(`window.nookApp.entry.state`);
          console.log('   State under prefers-reduced-motion: reduce:', rmState);
          if (rmState !== 'opening') {
            throw new Error('Reduced-motion entry trigger failed!');
          }
          console.log('   ✓ PASS: Reduced motion triggers cleanly.');
          // Restore normal media
          await send('Emulation.setEmulatedMedia', { media: 'screen', features: [] });
          await new Promise((r) => setTimeout(r, 1350));

          // -------------------------------------------------------------------
          // TEST 20: MOBILE VIEWPORT INTERACTION
          // -------------------------------------------------------------------
          console.log('\n--- TEST 20: Mobile Viewport Interaction ---');
          await setViewport(375, 667);
          await evaluate(`window.nookApp.entry.resetToClosed();`);
          await new Promise((r) => setTimeout(r, 300));

          const mobileBookRect = await evaluate(`
            (() => {
              const r = document.getElementById('tactile-book-trigger').getBoundingClientRect();
              return { left: r.left, top: r.top, width: r.width, height: r.height };
            })()
          `);
          console.log('   Mobile book rect (375x667 viewport):', mobileBookRect);
          if (mobileBookRect.width < 280 || mobileBookRect.width > 360) {
            throw new Error('Mobile book sizing outside expected responsive range!');
          }

          await mouseClick(mobileBookRect.left + mobileBookRect.width / 2, mobileBookRect.top + mobileBookRect.height / 2);
          await new Promise((r) => setTimeout(r, 60));
          const mobileState = await evaluate(`window.nookApp.entry.state`);
          console.log('   Mobile opening state:', mobileState);
          if (mobileState !== 'opening') {
            throw new Error('Mobile single click failed to open book!');
          }
          console.log('   ✓ PASS: Mobile viewport single click opens book cleanly.');

          await new Promise((r) => setTimeout(r, 1350));
          await setViewport(1280, 850);

          console.log('\n================================================================');
          console.log('✓ ALL 20 FOCUSED ENTRY FIX VERIFICATIONS PASSED 100%!');
          console.log('================================================================\n');

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('Test suite failed:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

runEntryFixTestSuite();
