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
            if (parsed.method === 'Runtime.consoleAPICalled') {
              console.log('[BROWSER CONSOLE]', parsed.params.args.map(a => a.value || a.description).join(' '));
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

          // 1. Set Desktop Viewport
          await setViewport(1280, 800);
          
          // Wait for nookApp to initialize
          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length > 0) {
                  resolve();
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          // Skip entry animation and navigate to Frankenstein reader Letter I
          await evaluate(`
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.skipEntry(false);
            }
            window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 1 });
          `);

          // Wait until reader content is fully loaded
          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp.reader && window.nookApp.reader.contentData && !window.nookApp.reader.isLoading) {
                  resolve();
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);
          await new Promise((r) => setTimeout(r, 400));

          const initialChapter = await evaluate('window.nookApp.reader.currentChapterIndex');
          console.log(`Initial chapter index: ${initialChapter}`);

          console.log('--- TESTING NEXT CHAPTER SMOOTH FLIP ---');
          // Trigger next chapter (Letter I -> Letter II)
          await evaluate('document.querySelector("#readerNextChapterBtn").click()');

          // Capture frame series: ~100ms, ~250ms, ~400ms, ~550ms, ~680ms
          await new Promise((r) => setTimeout(r, 90));
          await screenshot('smooth_flip_next_100ms.png');

          await new Promise((r) => setTimeout(r, 150));
          await screenshot('smooth_flip_next_250ms.png');

          await new Promise((r) => setTimeout(r, 150));
          await screenshot('smooth_flip_next_400ms.png');

          await new Promise((r) => setTimeout(r, 150));
          await screenshot('smooth_flip_next_550ms.png');

          await new Promise((r) => setTimeout(r, 130));
          await screenshot('smooth_flip_next_680ms.png');

          await new Promise((r) => setTimeout(r, 200));
          await screenshot('smooth_flip_next_landed.png');

          const chapterAfterNext = await evaluate('window.nookApp.reader.currentChapterIndex');
          console.log(`Chapter index after NEXT flip: ${chapterAfterNext}`);

          console.log('--- TESTING PREVIOUS CHAPTER SMOOTH FLIP ---');
          // Trigger previous chapter (Letter II -> Letter I)
          await evaluate('document.querySelector("#readerPrevChapterBtn").click()');

          // Capture frame series for prev: ~100ms, ~250ms, ~400ms, ~550ms, ~680ms
          await new Promise((r) => setTimeout(r, 90));
          await screenshot('smooth_flip_prev_100ms.png');

          await new Promise((r) => setTimeout(r, 150));
          await screenshot('smooth_flip_prev_250ms.png');

          await new Promise((r) => setTimeout(r, 150));
          await screenshot('smooth_flip_prev_400ms.png');

          await new Promise((r) => setTimeout(r, 150));
          await screenshot('smooth_flip_prev_550ms.png');

          await new Promise((r) => setTimeout(r, 130));
          await screenshot('smooth_flip_prev_680ms.png');

          await new Promise((r) => setTimeout(r, 200));
          await screenshot('smooth_flip_prev_landed.png');

          const chapterAfterPrev = await evaluate('window.nookApp.reader.currentChapterIndex');
          console.log(`Chapter index after PREV flip: ${chapterAfterPrev}`);

          console.log('--- TESTING MOBILE VIEWPORT (390px) ---');
          await setViewport(390, 844);
          await new Promise((r) => setTimeout(r, 400));
          await evaluate('document.querySelector("#readerNextChapterBtn").click()');
          await new Promise((r) => setTimeout(r, 340));
          await screenshot('smooth_flip_mobile_390_mid.png');
          await new Promise((r) => setTimeout(r, 450));
          await screenshot('smooth_flip_mobile_390_landed.png');

          console.log('--- TESTING DROPDOWN NAVIGATION ---');
          await evaluate(`
            const select = document.querySelector("#readerChapterSelect");
            select.value = "3";
            select.dispatchEvent(new Event("change"));
          `);
          await new Promise((r) => setTimeout(r, 850));
          const chapterAfterDropdown = await evaluate('window.nookApp.reader.currentChapterIndex');
          console.log(`Chapter index after dropdown navigation to index 3: ${chapterAfterDropdown}`);

          console.log('--- TESTING RAPID-CLICK PROTECTION ---');
          const rapidTestRes = await evaluate(`
            (function() {
              const before = window.nookApp.reader.currentChapterIndex;
              window.nookApp.reader.goToChapter(before - 1);
              const lockActive = window.nookApp.reader.isTransitioning;
              window.nookApp.reader.goToChapter(0); // Should be ignored because lockActive is true
              return { before, lockActive, current: window.nookApp.reader.currentChapterIndex };
            })()
          `);
          console.log('Rapid click protection test:', JSON.stringify(rapidTestRes));
          await new Promise((r) => setTimeout(r, 850));
          const finalChapterAfterRapid = await evaluate('window.nookApp.reader.currentChapterIndex');
          console.log(`Final chapter after rapid test resolved: ${finalChapterAfterRapid}`);

          console.log('--- ALL CDP VERIFICATIONS COMPLETED ---');
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
