const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('Starting Nook Cursor Redesign Verification Suite...');
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

          // Wait for window.nookApp to be ready
          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length >= 105) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  window.nookApp.navigateTo('home');
                  setTimeout(resolve, 200);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          console.log('\n--- 1. VERIFYING DEFAULT & POINTER CSS CURSOR TOKENS ---');
          const defaultToken = await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--cursor-default').trim()`);
          const pointerToken = await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--cursor-pointer').trim()`);

          console.log('   --cursor-default defined:', defaultToken.startsWith('url(') && defaultToken.includes('image/svg+xml'));
          console.log('   --cursor-pointer defined:', pointerToken.startsWith('url(') && pointerToken.includes('image/svg+xml'));

          if (!defaultToken.includes('svg') || !pointerToken.includes('svg')) {
            throw new Error('Cursor CSS custom property tokens missing or invalid');
          }

          console.log('\n--- 2. VERIFYING COMPUTED CURSORS ACROSS INTERACTIVE ELEMENTS ---');
          const bodyCursor = await evaluate(`getComputedStyle(document.body).cursor`);
          const navLinkCursor = await evaluate(`getComputedStyle(document.querySelector('.mainnav a')).cursor`);
          const themeBtnCursor = await evaluate(`getComputedStyle(document.getElementById('themeBtn')).cursor`);
          const bookCardCursor = await evaluate(`getComputedStyle(document.querySelector('.book-card') || document.querySelector('.opening-line a')).cursor`);

          console.log('   Body computed cursor:', (bodyCursor || '').substring(0, 40) + '...');
          console.log('   Nav link computed cursor:', (navLinkCursor || '').substring(0, 40) + '...');
          console.log('   Theme button computed cursor:', (themeBtnCursor || '').substring(0, 40) + '...');
          console.log('   Book card/link computed cursor:', (bookCardCursor || '').substring(0, 40) + '...');

          if (!bodyCursor || !navLinkCursor || !themeBtnCursor || !bodyCursor.includes('url(') || !navLinkCursor.includes('url(')) {
            throw new Error('Interactive computed cursor check failed');
          }

          console.log('\n--- 3. VERIFYING TEXT INPUT & EDITABLE ELEMENTS (NATIVE I-BEAM CURSOR) ---');
          // Navigate to library to inspect search bar
          await evaluate(`window.nookApp.navigateTo('library');`);
          await new Promise((r) => setTimeout(r, 400));

          const searchInputCursor = await evaluate(`getComputedStyle(document.getElementById('libSearchInput')).cursor`);
          console.log('   Library search input cursor:', searchInputCursor);
          if (searchInputCursor !== 'text') {
            throw new Error(`Search input cursor should be 'text', got '${searchInputCursor}'`);
          }

          console.log('\n--- 4. VERIFYING READER TEXT SELECTION & PHYSICAL STATIONERY CONTROLS ---');
          // Open a book in reader
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'pride-and-prejudice', pageNumber: 1 });
              const check = () => {
                const p = document.querySelector('#readerPaperPage p');
                const bm = document.getElementById('stationeryBookmarkBtn');
                if (p && bm) resolve();
                else setTimeout(check, 50);
              };
              check();
            })
          `);

          // Verify prose text cursor is text (I-beam)
          const readerTextCursor = await evaluate(`getComputedStyle(document.querySelector('#readerPaperPage p') || document.querySelector('.reader-prose p')).cursor`);
          console.log('   Reader content paragraph cursor (must be text):', readerTextCursor);
          if (readerTextCursor !== 'text') {
            throw new Error(`Reader prose text cursor should be 'text', got: ${readerTextCursor}`);
          }

          // Verify physical stationery controls & children use custom literary pointer
          const bookmarkBtnCursor = await evaluate(`getComputedStyle(document.getElementById('stationeryBookmarkBtn')).cursor`);
          const ribbonTabCursor = await evaluate(`getComputedStyle(document.querySelector('.stationery-ribbon-tab')).cursor`);
          const ribbonPointCursor = await evaluate(`getComputedStyle(document.querySelector('.ribbon-point')).cursor`);
          const noteBtnCursor = await evaluate(`getComputedStyle(document.getElementById('stationeryNoteBtn')).cursor`);
          const paperTabCursor = await evaluate(`getComputedStyle(document.querySelector('.stationery-paper-tab')).cursor`);
          const paperFoldCursor = await evaluate(`getComputedStyle(document.querySelector('.paper-fold')).cursor`);
          const hlBtnCursor = await evaluate(`getComputedStyle(document.getElementById('stationeryHighlighterBtn')).cursor`);
          const hlBodyCursor = await evaluate(`getComputedStyle(document.querySelector('.stationery-highlighter-body')).cursor`);
          const hlBarrelCursor = await evaluate(`getComputedStyle(document.querySelector('.hl-barrel')).cursor`);
          const hlChiselCursor = await evaluate(`getComputedStyle(document.querySelector('.hl-chisel-tip')).cursor`);
          const dockCursor = await evaluate(`getComputedStyle(document.querySelector('.reader-stationery-dock')).cursor`);

          console.log('   #stationeryBookmarkBtn cursor:', bookmarkBtnCursor.substring(0, 40) + '...');
          console.log('   .stationery-ribbon-tab cursor:', ribbonTabCursor.substring(0, 40) + '...');
          console.log('   .ribbon-point cursor:', ribbonPointCursor.substring(0, 40) + '...');
          console.log('   #stationeryNoteBtn cursor:', noteBtnCursor.substring(0, 40) + '...');
          console.log('   .stationery-paper-tab cursor:', paperTabCursor.substring(0, 40) + '...');
          console.log('   .paper-fold cursor:', paperFoldCursor.substring(0, 40) + '...');
          console.log('   #stationeryHighlighterBtn cursor:', hlBtnCursor.substring(0, 40) + '...');
          console.log('   .hl-barrel cursor:', hlBarrelCursor.substring(0, 40) + '...');
          console.log('   .hl-chisel-tip cursor:', hlChiselCursor.substring(0, 40) + '...');
          console.log('   .reader-stationery-dock cursor:', dockCursor.substring(0, 40) + '...');

          if (!bookmarkBtnCursor.includes('url(') || 
              !ribbonTabCursor.includes('url(') || 
              !ribbonPointCursor.includes('url(') || 
              !noteBtnCursor.includes('url(') || 
              !paperTabCursor.includes('url(') || 
              !paperFoldCursor.includes('url(') || 
              !hlBtnCursor.includes('url(') || 
              !hlBarrelCursor.includes('url(') || 
              !hlChiselCursor.includes('url(')) {
            throw new Error('Stationery controls custom cursor assertion failed');
          }

          console.log('\n--- 5. VERIFYING DARK THEME CURSOR TOKENS ---');
          await evaluate(`
            document.documentElement.setAttribute('data-theme', 'dark');
          `);
          const darkDefaultToken = await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--cursor-default').trim()`);
          const darkPointerToken = await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--cursor-pointer').trim()`);

          console.log('   Dark theme --cursor-default defined:', darkDefaultToken.includes('8C3E3E'));
          console.log('   Dark theme --cursor-pointer defined:', darkPointerToken.includes('8C3E3E'));

          if (!darkDefaultToken.includes('8C3E3E')) {
            throw new Error('Dark theme cursor token check failed');
          }

          // Restore light theme
          await evaluate(`
            document.documentElement.removeAttribute('data-theme');
          `);

          console.log('\n======================================================');
          console.log('✓ ALL NOOK CURSOR REDESIGN VERIFICATIONS PASSED!');
          console.log('======================================================\n');

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('Cursor test failed with error:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
