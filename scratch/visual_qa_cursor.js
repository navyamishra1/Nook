const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('Testing refined sleek cursor geometries...');
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
              mobile: false
            });
          }

          async function screenshot(filename, clip = null) {
            const params = { format: 'png' };
            if (clip) params.clip = clip;
            const res = await send('Page.captureScreenshot', params);
            if (res && res.data) {
              const buf = Buffer.from(res.data, 'base64');
              const fullPath = path.join(artifactDir, filename);
              fs.writeFileSync(fullPath, buf);
              console.log(`  -> Captured screenshot: ${filename}`);
            }
          }

          await setViewport(1280, 850);

          // Wait for window.nookApp to be ready and bypass entry
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

          // Test refined sleek SVG overlays
          await evaluate(`
            const refinedDefaultSvg = \`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="20" viewBox="0 0 16 20" fill="none"><polygon points="2.5,2.5 11.5,2.5 11.5,17 7,14 2.5,17" fill="rgba(46,42,38,0.20)" filter="blur(0.3px)"/><polygon points="2,2 11,2 11,16.5 6.5,13.5 2,16.5" fill="#9E5353" stroke="#2E2A26" stroke-width="1.05" stroke-linejoin="round"/><polygon points="3.2,3.2 9.8,3.2 9.8,14.5 6.5,12.2 3.2,14.5" fill="#B06363" opacity="0.45"/><line x1="3.2" y1="5" x2="9.8" y2="5" stroke="#FAF6EF" stroke-width="0.8" stroke-dasharray="1.1,1.1" opacity="0.9"/></svg>\`;

            const refinedPointerSvg = \`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="20" viewBox="0 0 18 20" fill="none"><polygon points="2.5,2.5 9,3.8 15.5,2.5 15.5,14.5 9,15.8 2.5,14.5" fill="rgba(46,42,38,0.18)" filter="blur(0.3px)"/><polygon points="2,2 8.5,3.2 8.5,14.2 2,13" fill="#FAF6EF" stroke="#2E2A26" stroke-width="1.05" stroke-linejoin="round"/><polygon points="8.5,3.2 15,2 15,13 8.5,14.2" fill="#F4EEE3" stroke="#2E2A26" stroke-width="1.05" stroke-linejoin="round"/><line x1="8.5" y1="3.2" x2="8.5" y2="14.2" stroke="#8FA07E" stroke-width="1"/><polygon points="7.7,3.2 9.3,3.2 9.3,17.2 8.5,16 7.7,17.2" fill="#9E5353" stroke="#2E2A26" stroke-width="0.6"/><line x1="3.5" y1="6" x2="7" y2="6.6" stroke="#DDD1BA" stroke-width="0.7"/><line x1="3.5" y1="9.2" x2="7" y2="9.8" stroke="#DDD1BA" stroke-width="0.7"/><line x1="10" y1="6.6" x2="13.5" y2="6" stroke="#DDD1BA" stroke-width="0.7"/><line x1="10" y1="9.8" x2="13.5" y2="9.2" stroke="#DDD1BA" stroke-width="0.7"/></svg>\`;

            const overlay = document.createElement('div');
            overlay.id = 'refined-cursor-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:999999;';

            // Place default cursor over open space
            const c1 = document.createElement('div');
            c1.style.cssText = 'position:absolute;left:280px;top:220px;';
            c1.innerHTML = refinedDefaultSvg;

            // Place pointer cursor over Library nav link
            const libLink = document.querySelector('a[data-nav="library"]');
            const rect = libLink ? libLink.getBoundingClientRect() : { left: 420, top: 40 };
            const c2 = document.createElement('div');
            // Hotspot of refined pointer is exact top-left tip (2, 2)
            c2.style.cssText = \`position:absolute;left:\${rect.left - 2}px;top:\${rect.top - 2}px;\`;
            c2.innerHTML = refinedPointerSvg;

            // Place pointer cursor over first book card cover
            const card = document.querySelector('.book-card');
            const cardRect = card ? card.getBoundingClientRect() : { left: 100, top: 400 };
            const c3 = document.createElement('div');
            c3.style.cssText = \`position:absolute;left:\${cardRect.left + 50}px;top:\${cardRect.top + 50}px;\`;
            c3.innerHTML = refinedPointerSvg;

            overlay.appendChild(c1);
            overlay.appendChild(c2);
            overlay.appendChild(c3);
            document.body.appendChild(overlay);
          `);

          // Capture close-up of Nav Header with refined pointer cursor
          await screenshot('cursor_refined_header_closeup.png', {
            x: 0,
            y: 0,
            width: 800,
            height: 200,
            scale: 1
          });

          // Capture close-up of Book Card with refined pointer cursor
          const cardBox = await evaluate(`
            (() => {
              const c = document.querySelector('.book-card');
              if (!c) return { x: 0, y: 300, width: 300, height: 400 };
              const r = c.getBoundingClientRect();
              return { x: Math.max(0, r.left - 20), y: Math.max(0, r.top - 20), width: r.width + 80, height: r.height + 60 };
            })()
          `);
          await screenshot('cursor_refined_bookcard_closeup.png', {
            x: Math.round(cardBox.x),
            y: Math.round(cardBox.y),
            width: Math.round(cardBox.width),
            height: Math.round(cardBox.height),
            scale: 1
          });

          await screenshot('cursor_refined_homepage.png');

          console.log('\n======================================================');
          console.log('✓ Refined cursor screenshots captured successfully!');
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
