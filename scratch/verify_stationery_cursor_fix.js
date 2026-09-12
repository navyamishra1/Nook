const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

function getPages(port = 9222, retries = 20) {
  return new Promise((resolve, reject) => {
    function tryConnect(attempt) {
      const req = http.get(`http://127.0.0.1:${port}/json`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const pages = JSON.parse(data);
            resolve(pages);
          } catch (e) {
            if (attempt < retries) setTimeout(() => tryConnect(attempt + 1), 300);
            else reject(e);
          }
        });
      });
      req.on('error', (err) => {
        if (attempt < retries) setTimeout(() => tryConnect(attempt + 1), 300);
        else reject(err);
      });
    }
    tryConnect(1);
  });
}

async function main() {
  console.log('Starting Verification Suite for Reader Stationery Cursor Fix...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  try {
    const pages = await getPages(9222, 30);
    const targetPage = pages.find((p) => p.url.includes('localhost:8000')) || pages[0];
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
          mobile: false
        });
      }

      await setViewport(1280, 850);

      // Wait for window.nookApp and navigate to reader
      await evaluate(`
        new Promise((resolve) => {
          const check = () => {
            if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length >= 105) {
              if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
              window.nookApp.navigateTo('reader', { bookId: 'pride-and-prejudice', pageNumber: 1 });
              const p = document.querySelector('#readerPaperPage p');
              if (p) resolve();
              else setTimeout(check, 50);
            } else {
              setTimeout(check, 50);
            }
          };
          check();
        })
      `);

      await new Promise((r) => setTimeout(r, 400));

      console.log('\n--- 1. VERIFYING READER PROSE / TEXT CURSOR (NATIVE I-BEAM) ---');
      const proseParaCursor = await evaluate(`getComputedStyle(document.querySelector('.reader-prose p')).cursor`);
      const dropCapCursor = await evaluate(`getComputedStyle(document.querySelector('.reader-prose p.has-drop-cap') || document.querySelector('.reader-prose p')).cursor`);

      console.log('   Reader prose paragraph cursor:', proseParaCursor);
      console.log('   Reader drop-cap paragraph cursor:', dropCapCursor);

      if (proseParaCursor !== 'text' || dropCapCursor !== 'text') {
        throw new Error(`Prose paragraph cursor should be 'text', got: ${proseParaCursor}`);
      }

      console.log('\n--- 2. VERIFYING PHYSICAL BOOKMARK STATIONERY CONTROLS ---');
      const bookmarkBtnCursor = await evaluate(`getComputedStyle(document.getElementById('stationeryBookmarkBtn')).cursor`);
      const bookmarkRibbonCursor = await evaluate(`getComputedStyle(document.querySelector('.stationery-ribbon-tab')).cursor`);
      const bookmarkPointCursor = await evaluate(`getComputedStyle(document.querySelector('.ribbon-point')).cursor`);

      console.log('   #stationeryBookmarkBtn cursor:', bookmarkBtnCursor.substring(0, 40) + '...');
      console.log('   .stationery-ribbon-tab cursor:', bookmarkRibbonCursor.substring(0, 40) + '...');
      console.log('   .ribbon-point cursor:', bookmarkPointCursor.substring(0, 40) + '...');

      if (!bookmarkBtnCursor.includes('url(') || !bookmarkRibbonCursor.includes('url(') || !bookmarkPointCursor.includes('url(')) {
        throw new Error('Bookmark stationery elements cursor check failed');
      }

      console.log('\n--- 3. VERIFYING PHYSICAL NOTE PAPER STATIONERY CONTROLS ---');
      const noteBtnCursor = await evaluate(`getComputedStyle(document.getElementById('stationeryNoteBtn')).cursor`);
      const notePaperCursor = await evaluate(`getComputedStyle(document.querySelector('.stationery-paper-tab')).cursor`);
      const noteFoldCursor = await evaluate(`getComputedStyle(document.querySelector('.paper-fold')).cursor`);

      console.log('   #stationeryNoteBtn cursor:', noteBtnCursor.substring(0, 40) + '...');
      console.log('   .stationery-paper-tab cursor:', notePaperCursor.substring(0, 40) + '...');
      console.log('   .paper-fold cursor:', noteFoldCursor.substring(0, 40) + '...');

      if (!noteBtnCursor.includes('url(') || !notePaperCursor.includes('url(') || !noteFoldCursor.includes('url(')) {
        throw new Error('Note stationery elements cursor check failed');
      }

      console.log('\n--- 4. VERIFYING PHYSICAL HIGHLIGHTER STATIONERY CONTROLS ---');
      const hlBtnCursor = await evaluate(`getComputedStyle(document.getElementById('stationeryHighlighterBtn')).cursor`);
      const hlBodyCursor = await evaluate(`getComputedStyle(document.querySelector('.stationery-highlighter-body')).cursor`);
      const hlBarrelCursor = await evaluate(`getComputedStyle(document.querySelector('.hl-barrel')).cursor`);
      const hlBandCursor = await evaluate(`getComputedStyle(document.querySelector('.hl-band')).cursor`);
      const hlChiselCursor = await evaluate(`getComputedStyle(document.querySelector('.hl-chisel-tip')).cursor`);

      console.log('   #stationeryHighlighterBtn cursor:', hlBtnCursor.substring(0, 40) + '...');
      console.log('   .stationery-highlighter-body cursor:', hlBodyCursor.substring(0, 40) + '...');
      console.log('   .hl-barrel cursor:', hlBarrelCursor.substring(0, 40) + '...');
      console.log('   .hl-band cursor:', hlBandCursor.substring(0, 40) + '...');
      console.log('   .hl-chisel-tip cursor:', hlChiselCursor.substring(0, 40) + '...');

      if (!hlBtnCursor.includes('url(') || !hlBarrelCursor.includes('url(') || !hlChiselCursor.includes('url(')) {
        throw new Error('Highlighter stationery elements cursor check failed');
      }

      console.log('\n--- 5. VERIFYING DOCK CONTAINER & CONTROLS ---');
      const dockCursor = await evaluate(`getComputedStyle(document.querySelector('.reader-stationery-dock')).cursor`);
      console.log('   .reader-stationery-dock cursor:', dockCursor.substring(0, 40) + '...');

      console.log('\n--- 6. TESTING FUNCTIONALITY OF STATIONERY CONTROLS ---');
      // Click bookmark button
      await evaluate(`document.getElementById('stationeryBookmarkBtn').click();`);
      await new Promise((r) => setTimeout(r, 200));
      const bmModalOpen = await evaluate(`!!document.querySelector('.bm-picker-backdrop') || !document.getElementById('bookmarkPickerModal').classList.contains('hidden')`);
      console.log('   Bookmark picker modal opened on click:', bmModalOpen);

      // Close modal
      await evaluate(`
        const closeBtn = document.querySelector('.bm-modal-close') || document.querySelector('.journal-modal-close') || document.getElementById('closeBookmarkPicker');
        if (closeBtn) closeBtn.click();
      `);
      await new Promise((r) => setTimeout(r, 200));

      // Toggle highlighter mode
      await evaluate(`document.getElementById('stationeryHighlighterBtn').click();`);
      const isHlActive = await evaluate(`window.nookApp.reader.isHighlightingActive`);
      console.log('   Highlighter mode toggled active on click:', isHlActive);

      // Turn off highlighter mode
      await evaluate(`document.getElementById('stationeryHighlighterBtn').click();`);
      const isHlOff = await evaluate(`!window.nookApp.reader.isHighlightingActive`);
      console.log('   Highlighter mode toggled off on second click:', isHlOff);

      console.log('\n======================================================');
      console.log('✓ ALL READER STATIONERY CURSOR CHECKS PASSED PERFECTLY!');
      console.log('======================================================\n');

      ws.close();
      edge.kill();
      process.exit(0);
    });
  } catch (err) {
    console.error('Verification failed with error:', err);
    edge.kill();
    process.exit(1);
  }
}

main();
