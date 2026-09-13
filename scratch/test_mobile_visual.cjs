const { spawn } = require('child_process');
const http = require('http');
const nodeFs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifactDir = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(__dirname, '../frontend', reqPath);
  if (!nodeFs.existsSync(filePath)) {
    filePath = path.join(__dirname, '..', reqPath);
  }

  if (nodeFs.existsSync(filePath) && nodeFs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    nodeFs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = 4965;
const DEBUG_PORT = 9287;

server.listen(PORT, async () => {
  console.log('Testing mobile visual rendering (390x844)...');

  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=390,844',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `http://localhost:${PORT}`
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const pages = JSON.parse(data);
        const targetPage = pages.find((p) => p.url.includes(`localhost:${PORT}`));
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

          await send('Page.navigate', { url: `http://localhost:${PORT}` });
          await new Promise((r) => setTimeout(r, 2000));

          async function evaluate(expression, awaitPromise = true) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
            if (!res) return null;
            if (res.exceptionDetails) {
              console.error('Eval exception:', res.exceptionDetails);
            }
            return res.result ? res.result.value : res;
          }

          await evaluate(`document.fonts.ready`, true);

          // Dismiss entry overlay
          await evaluate(`
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.skipEntry(false);
            }
          `);
          await new Promise((r) => setTimeout(r, 200));

          await evaluate(`
            window.nookApp.navigateTo('reader', { bookId: 'crime-and-punishment', chapterNumber: 1, pageNumber: 1 });
          `);

          for (let i = 0; i < 60; i++) {
            const ready = await evaluate(`!!(window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.pagination && window.nookApp.reader.activeBookId === 'crime-and-punishment')`);
            if (ready) break;
            await new Promise((r) => setTimeout(r, 80));
          }

          for (const p of [1, 2, 3]) {
            await evaluate(`
              (() => {
                const r = window.nookApp.reader;
                r.isTransitioning = false;
                r.currentPageNumber = ${p};
                const curPage = r.pagination.getPage(${p});
                r.currentChapterIndex = curPage ? curPage.chapterIndex : 0;
                r.render();
                r.applyTheme(r.readerTheme);
                window.scrollTo({ top: 0, behavior: 'instant' });
                r.saveProgress();
              })()
            `);
            await new Promise((r) => setTimeout(r, 150));

            const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
            if (screenshotRes && screenshotRes.data) {
              const imgPath = path.join(artifactDir, `mobile_390_crime_p${p}.png`);
              nodeFs.writeFileSync(imgPath, Buffer.from(screenshotRes.data, 'base64'));
              console.log(`Saved mobile screenshot: mobile_390_crime_p${p}.png`);
            }
          }

          ws.close();
          edge.kill();
          server.close();
          process.exit(0);
        });
      } catch (e) {
        console.error(e);
        edge.kill();
        server.close();
        process.exit(1);
      }
    });
  });
});
