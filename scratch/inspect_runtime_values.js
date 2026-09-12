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

          await setViewport(1280, 800);

          // Initialize app & navigate to Frankenstein Letter I (chapter 4, index 3)
          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length > 0) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 4 });
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

          // Trigger Next Chapter and inspect at exactly 320ms
          await evaluate(`
            window.inspectionPromise = new Promise((resolve) => {
              document.querySelector('#readerNextChapterBtn').click();
              setTimeout(() => {
                function getValues(selector) {
                  const el = document.querySelector(selector);
                  if (!el) return null;
                  const cs = window.getComputedStyle(el);
                  return {
                    selector,
                    width: cs.width,
                    height: cs.height,
                    position: cs.position,
                    left: cs.left,
                    top: cs.top,
                    zIndex: cs.zIndex,
                    perspective: cs.perspective,
                    transform: cs.transform,
                    transformOrigin: cs.transformOrigin,
                    opacity: cs.opacity,
                    animationName: cs.animationName,
                    animationDuration: cs.animationDuration,
                    animationTimingFunction: cs.animationTimingFunction,
                    backfaceVisibility: cs.backfaceVisibility
                  };
                }

                resolve({
                  overlay: getValues('.reader-page-flip-overlay'),
                  stage: getValues('.reader-page-flip-stage'),
                  flipper: getValues('.reader-flipper'),
                  front: getValues('.reader-flip-front'),
                  back: getValues('.reader-flip-back'),
                  shadow: getValues('.reader-page-flip-under-shadow')
                });
              }, 320);
            });
          `);

          const computedResults = await evaluate('window.inspectionPromise');
          console.log('--- COMPUTED RUNTIME VALUES AT 320ms ---');
          console.log(JSON.stringify(computedResults, null, 2));

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error(err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
