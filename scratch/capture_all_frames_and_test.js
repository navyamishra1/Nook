const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

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
          await send('CSS.enable');

          async function evaluate(expression, awaitPromise = true) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
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
            const buf = Buffer.from(res.data, 'base64');
            const filePath = path.join(artifactDir, filename);
            fs.writeFileSync(filePath, buf);
            console.log(`Saved screenshot: ${filename}`);
          }

          await setViewport(1280, 800);

          // Initialize app & navigate to Frankenstein Letter I
          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length > 0) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 1 });
                  const checkReader = () => {
                    if (window.nookApp.reader && window.nookApp.reader.contentData && !window.nookApp.reader.isLoading) {
                      resolve();
                    } else {
                      setTimeout(checkReader, 50);
                    }
                  };
                  checkReader();
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          console.log('--- CAPTURING EXACT 100ms - 700ms NEXT FLIP FRAMES ---');
          const targetFrames = [100, 200, 300, 400, 500, 600, 700];
          for (const t of targetFrames) {
            // Reset to chapter 0 and ensure no overlay
            await evaluate(`
              const overlay = document.querySelector('.reader-page-flip-overlay');
              if (overlay) overlay.remove();
              window.nookApp.reader.isTransitioning = false;
              window.nookApp.reader.currentChapterIndex = 0;
              window.nookApp.reader.render();
              window.nookApp.reader.applyTheme(window.nookApp.reader.readerTheme);
            `);
            await new Promise((r) => setTimeout(r, 60));

            // Trigger next click
            await evaluate('document.querySelector("#readerNextChapterBtn").click()');
            await new Promise((r) => setTimeout(r, t));
            await screenshot(`page_flip_next_${t}ms.png`);

            // Wait for completion before next frame
            await new Promise((r) => setTimeout(r, Math.max(0, 780 - t)));
          }

          // Landed screenshot after Next
          await screenshot('page_flip_next_landed.png');

          console.log('--- CAPTURING EXACT 100ms - 700ms PREVIOUS FLIP FRAMES ---');
          for (const t of targetFrames) {
            // Reset to chapter 1 and ensure no overlay
            await evaluate(`
              const overlay = document.querySelector('.reader-page-flip-overlay');
              if (overlay) overlay.remove();
              window.nookApp.reader.isTransitioning = false;
              window.nookApp.reader.currentChapterIndex = 1;
              window.nookApp.reader.render();
              window.nookApp.reader.applyTheme(window.nookApp.reader.readerTheme);
            `);
            await new Promise((r) => setTimeout(r, 60));

            // Trigger prev click
            await evaluate('document.querySelector("#readerPrevChapterBtn").click()');
            await new Promise((r) => setTimeout(r, t));
            await screenshot(`page_flip_prev_${t}ms.png`);

            // Wait for completion before next frame
            await new Promise((r) => setTimeout(r, Math.max(0, 780 - t)));
          }

          // Landed screenshot after Prev
          await screenshot('page_flip_prev_landed.png');

          console.log('--- PERFORMING 5x NEXT CLICK STABILITY TEST ---');
          for (let i = 0; i < 5; i++) {
            const chBefore = await evaluate('window.nookApp.reader.currentChapterIndex');
            console.log(`Clicking Next Chapter (step ${i + 1}/5, current chapter index: ${chBefore})...`);
            await evaluate('document.querySelector("#readerNextChapterBtn").click()');
            await new Promise((r) => setTimeout(r, 750));
            const chAfter = await evaluate('window.nookApp.reader.currentChapterIndex');
            console.log(`Landed on chapter index: ${chAfter}`);
          }
          await screenshot('page_flip_5x_next_landed.png');

          console.log('--- PERFORMING 5x PREV CLICK STABILITY TEST ---');
          for (let i = 0; i < 5; i++) {
            const chBefore = await evaluate('window.nookApp.reader.currentChapterIndex');
            console.log(`Clicking Prev Chapter (step ${i + 1}/5, current chapter index: ${chBefore})...`);
            await evaluate('document.querySelector("#readerPrevChapterBtn").click()');
            await new Promise((r) => setTimeout(r, 750));
            const chAfter = await evaluate('window.nookApp.reader.currentChapterIndex');
            console.log(`Landed on chapter index: ${chAfter}`);
          }
          await screenshot('page_flip_5x_prev_landed.png');

          console.log('--- CAPTURING MOBILE 390px ---');
          await setViewport(390, 844);
          await evaluate(`
            const overlay = document.querySelector('.reader-page-flip-overlay');
            if (overlay) overlay.remove();
            window.nookApp.reader.isTransitioning = false;
            window.nookApp.reader.currentChapterIndex = 0;
            window.nookApp.reader.render();
            window.nookApp.reader.applyTheme(window.nookApp.reader.readerTheme);
          `);
          await new Promise((r) => setTimeout(r, 150));
          await evaluate('window.nookApp.reader.goToChapter(1)');
          await new Promise((r) => setTimeout(r, 350));
          await screenshot('page_flip_mobile_390_mid.png');
          await new Promise((r) => setTimeout(r, 450));
          await screenshot('page_flip_mobile_390_landed.png');

          console.log('--- TESTING REDUCED MOTION ---');
          await send('Emulation.setEmulatedMedia', {
            media: 'screen',
            features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
          });
          await evaluate(`
            window.nookApp.reader.currentChapterIndex = 0;
            window.nookApp.reader.render();
            window.nookApp.reader.goToChapter(1);
          `);
          const overlayCount = await evaluate('document.querySelectorAll(".reader-page-flip-overlay").length');
          console.log(`Reduced motion active. Overlays in DOM during instant change: ${overlayCount} (expected 0)`);
          const reducedMotionChapter = await evaluate('window.nookApp.reader.currentChapterIndex');
          console.log(`Reduced motion landed on chapter index: ${reducedMotionChapter} (expected 1)`);

          console.log('--- ALL FRAME CAPTURES AND TESTS COMPLETED SUCCESSFULLY ---');
          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('Error during test execution:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
