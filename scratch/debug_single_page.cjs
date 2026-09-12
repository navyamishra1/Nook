const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

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
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '..', reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = 4920;
const DEBUG_PORT = 9240;

server.listen(PORT, async () => {
  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1280,900',
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
          await new Promise((r) => setTimeout(r, 1500));

          async function evaluate(expression, awaitPromise = true) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
            if (!res) return null;
            if (res.exceptionDetails) {
              console.error('Eval exception:', res.exceptionDetails);
            }
            return res.result ? res.result.value : res;
          }

          for (let i = 0; i < 40; i++) {
            const isReady = await evaluate(`!!(window.nookApp && window.nookApp.catalog)`);
            if (isReady) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          await evaluate(`
            window.nookApp.navigateTo('reader', { bookId: 'pride-and-prejudice', chapterNumber: 1, pageNumber: 1 });
          `);
          await new Promise((r) => setTimeout(r, 600));

          await evaluate(`
            window.nookApp.reader.setFontSize('sm');
          `);
          await new Promise((r) => setTimeout(r, 400));

          await evaluate(`window.nookApp.reader.goToPage(30)`);
          await new Promise((r) => setTimeout(r, 300));

          const debugInfo = await evaluate(`
            (() => {
              const page = document.getElementById('readerPaperPage');
              const footer = document.querySelector('.reader-paper-footer-row');
              const prose = document.getElementById('readerProseContent');
              const measurer = document.getElementById('nook-pagination-measurer');
              const paras = Array.from(prose.querySelectorAll('p'));

              const pageRect = page.getBoundingClientRect();
              const footerRect = footer ? footer.getBoundingClientRect() : null;
              const proseRect = prose.getBoundingClientRect();
              const measurerRect = measurer ? measurer.getBoundingClientRect() : null;

              return {
                window: { width: window.innerWidth, height: window.innerHeight },
                page: {
                  width: pageRect.width,
                  height: pageRect.height,
                  clientHeight: page.clientHeight,
                  scrollHeight: page.scrollHeight,
                  computedPadding: window.getComputedStyle(page).padding,
                  computedWidth: window.getComputedStyle(page).width
                },
                footer: footerRect ? {
                  top: footerRect.top,
                  bottom: footerRect.bottom,
                  height: footerRect.height,
                  topFromPageTop: footerRect.top - pageRect.top,
                  computedBottom: window.getComputedStyle(footer).bottom
                } : null,
                prose: {
                  topFromPageTop: proseRect.top - pageRect.top,
                  bottomFromPageTop: proseRect.bottom - pageRect.top,
                  height: proseRect.height,
                  computedPadding: window.getComputedStyle(prose).padding,
                  computedFontSize: window.getComputedStyle(prose).fontSize,
                  computedLineHeight: window.getComputedStyle(prose).lineHeight
                },
                paras: paras.map((p, idx) => {
                  const r = p.getBoundingClientRect();
                  return {
                    idx,
                    topFromPageTop: r.top - pageRect.top,
                    bottomFromPageTop: r.bottom - pageRect.top,
                    height: r.height,
                    text: p.textContent.slice(0, 40)
                  };
                }),
                measurer: measurer ? {
                  clientH: measurer.clientHeight,
                  scrollH: measurer.scrollHeight,
                  height: measurerRect.height,
                  computedPadding: window.getComputedStyle(measurer).padding,
                  computedFontSize: window.getComputedStyle(measurer).fontSize,
                  computedLineHeight: window.getComputedStyle(measurer).lineHeight
                } : null
              };
            })()
          `);

          console.log('\n--- DEBUG PAGE 30 (sm) ---');
          console.log(JSON.stringify(debugInfo, null, 2));

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
