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

  http.get('http://127.0.0.1:9222/json', (res) => {
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

          async function evaluate(expression) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            return res && res.result ? res.result.value : null;
          }

          async function setViewport(width, height) {
            await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
          }

          async function screenshot(filename) {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            if (res && res.data) {
              fs.writeFileSync(path.join(artifactDir, filename), Buffer.from(res.data, 'base64'));
              console.log(`Saved screenshot: ${filename}`);
            }
          }

          await setViewport(1440, 900);

          await evaluate(`
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length >= 105) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  window.nookApp.navigateTo('library');
                  setTimeout(resolve, 500);
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          // 1. Filter by Adventure
          await evaluate(`
            new Promise((resolve) => {
              const tag = Array.from(document.querySelectorAll('.filter-tag, .chip, .category-pill')).find(el => el.textContent.includes('Adventure'));
              if (tag) tag.click();
              setTimeout(resolve, 500);
            })
          `);
          await screenshot('qa_verified_library_filter_adventure.png');

          // 2. Filter by Children's Literature
          await evaluate(`
            new Promise((resolve) => {
              const tag = Array.from(document.querySelectorAll('.filter-tag, .chip, .category-pill')).find(el => el.textContent.includes("Children's Literature"));
              if (tag) tag.click();
              setTimeout(resolve, 500);
            })
          `);
          await screenshot('qa_verified_library_filter_children.png');

          // 3. Filter by Science Fiction
          await evaluate(`
            new Promise((resolve) => {
              const tag = Array.from(document.querySelectorAll('.filter-tag, .chip, .category-pill')).find(el => el.textContent.includes('Science Fiction'));
              if (tag) tag.click();
              setTimeout(resolve, 500);
            })
          `);
          await screenshot('qa_verified_library_filter_scifi.png');

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
