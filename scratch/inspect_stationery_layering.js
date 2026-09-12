const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

async function main() {
  console.log('Testing and inspecting physical stationery layering...');
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9225/json', (res) => {
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
              console.log(`  -> Saved screenshot: ${filename}`);
            }
          }

          await setViewport(1440, 900);

          // Clear storage & skip entry
          await evaluate(`
            localStorage.clear();
            new Promise((resolve) => {
              const check = () => {
                if (window.nookApp && window.nookApp.catalog && window.nookApp.catalog.length >= 105) {
                  if (window.nookApp.entry) window.nookApp.entry.skipEntry(false);
                  resolve();
                } else {
                  setTimeout(check, 50);
                }
              };
              check();
            })
          `);

          // Open reader
          await evaluate(`
            new Promise((resolve) => {
              window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 4, pageNumber: 1 });
              const checkReader = () => {
                if (window.nookApp.reader && window.nookApp.reader.contentData && !window.nookApp.reader.isLoading) {
                  setTimeout(resolve, 300);
                } else {
                  setTimeout(checkReader, 50);
                }
              };
              checkReader();
            })
          `);

          await new Promise((r) => setTimeout(r, 600));

          // Get bounding box of stationery dock and right edge of page
          const bounds = await evaluate(`
            (() => {
              const page = document.querySelector('.reader-paper-page');
              const dock = document.querySelector('.reader-stationery-dock');
              const pageRect = page.getBoundingClientRect();
              const dockRect = dock.getBoundingClientRect();
              return {
                page: { top: pageRect.top, left: pageRect.left, right: pageRect.right, bottom: pageRect.bottom, width: pageRect.width, height: pageRect.height },
                dock: { top: dockRect.top, left: dockRect.left, right: dockRect.right, bottom: dockRect.bottom, width: dockRect.width, height: dockRect.height }
              };
            })()
          `);

          console.log('Bounds:', JSON.stringify(bounds, null, 2));

          // Capture full reader page in default Warm theme
          await screenshot('layering_warm_theme_full.png');

          // Capture zoomed clip around right edge and stationery dock
          const clip = {
            x: Math.max(0, Math.round(bounds.dock.left - 60)),
            y: Math.max(0, Math.round(bounds.dock.top - 30)),
            width: Math.round(bounds.dock.width + 100),
            height: Math.round(bounds.dock.height + 60),
            scale: 1
          };
          console.log('Clip:', clip);
          await screenshot('layering_stationery_dock_zoom_warm.png', clip);

          // Test Eye Comfort / Paper Light theme
          await evaluate(`
            window.nookApp.reader.applyTheme('eye-comfort');
          `);
          await new Promise((r) => setTimeout(r, 400));
          await screenshot('layering_stationery_dock_zoom_eye_comfort.png', clip);

          // Test Dark theme
          await evaluate(`
            window.nookApp.reader.applyTheme('dark');
          `);
          await new Promise((r) => setTimeout(r, 400));
          await screenshot('layering_stationery_dock_zoom_dark.png', clip);

          // Test Light theme
          await evaluate(`
            window.nookApp.reader.applyTheme('light');
          `);
          await new Promise((r) => setTimeout(r, 400));
          await screenshot('layering_stationery_dock_zoom_light.png', clip);

          // Return to Warm theme and test clicking stationery items
          await evaluate(`
            window.nookApp.reader.applyTheme('warm');
          `);
          await new Promise((r) => setTimeout(r, 400));

          // Test clicking Bookmark button
          const bookmarkClicked = await evaluate(`
            (() => {
              const btn = document.getElementById('stationeryBookmarkBtn');
              btn.click();
              const modal = document.querySelector('.nook-bookmark-picker-modal');
              return { modalPresent: !!modal };
            })()
          `);
          console.log('Bookmark click test:', bookmarkClicked);
          await screenshot('layering_stationery_bookmark_modal_open.png');

          // Close modal
          await evaluate(`
            const closeBtn = document.querySelector('.nook-stationery-modal-close');
            if (closeBtn) closeBtn.click();
          `);
          await new Promise((r) => setTimeout(r, 400));

          // Test clicking Highlighter button
          const hlClicked = await evaluate(`
            (() => {
              const btn = document.getElementById('stationeryHighlighterBtn');
              btn.click();
              return {
                isActive: window.nookApp.reader.isHighlightingActive,
                btnClass: btn.className
              };
            })()
          `);
          console.log('Highlighter click test:', hlClicked);
          await screenshot('layering_stationery_highlighter_active_zoom.png', clip);

          console.log('Stationery layering verification completed successfully.');
          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (err) {
        console.error('Error:', err);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
