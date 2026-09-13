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

const PORT = 4976;
const DEBUG_PORT = 9298;

server.listen(PORT, async () => {
  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1440,900',
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

          // Let's hook console.log to capture pagination debug logs if needed
          await evaluate(`
            window.__pagLogs = [];
          `);

          // Open Crime and Punishment
          await evaluate(`
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.skipEntry(false);
            }
            window.nookApp.navigateTo('reader', { bookId: 'crime-and-punishment', chapterNumber: 1, pageNumber: 1 });
          `);

          for (let i = 0; i < 50; i++) {
            const ready = await evaluate(`!!(window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.pagination)`);
            if (ready) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          // Let's inspect each page from 1 to 5 in Normal mode and log all details
          for (let p = 1; p <= 5; p++) {
            await evaluate(`window.nookApp.reader.goToPage(${p})`);
            await new Promise((r) => setTimeout(r, 200));

            const pageInfo = await evaluate(`
              (() => {
                const page = document.getElementById('readerPaperPage');
                const prose = document.getElementById('readerProseContent');
                const footer = document.querySelector('.reader-paper-footer-row');
                const prevBtn = document.getElementById('readerPaperCornerPrev');
                const nextBtn = document.getElementById('readerPaperCornerNext');
                const folio = document.querySelector('.reader-paper-page-number');
                const runningHeader = document.querySelector('.reader-page-running-header');
                const proseHeader = document.querySelector('.reader-prose-header');

                const pageRect = page.getBoundingClientRect();
                const proseRect = prose ? prose.getBoundingClientRect() : null;
                const footerRect = footer ? footer.getBoundingClientRect() : null;
                const prevRect = prevBtn ? prevBtn.getBoundingClientRect() : null;
                const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
                const folioRect = folio ? folio.getBoundingClientRect() : null;
                const headRect = runningHeader ? runningHeader.getBoundingClientRect() : (proseHeader ? proseHeader.getBoundingClientRect() : null);

                const paras = Array.from(prose.querySelectorAll('p'));
                const lastPara = paras[paras.length - 1];

                let lastLine = null;
                let lastLineText = '';
                if (lastPara) {
                  const range = document.createRange();
                  range.selectNodeContents(lastPara);
                  const rects = Array.from(range.getClientRects());
                  if (rects.length > 0) {
                    const lr = rects[rects.length - 1];
                    lastLine = {
                      top: lr.top - pageRect.top,
                      bottom: lr.bottom - pageRect.top,
                      height: lr.height
                    };
                  }
                  lastLineText = lastPara.textContent.slice(-60);
                }

                return {
                  pageNumber: ${p},
                  pageDimensions: { width: pageRect.width, height: pageRect.height },
                  header: headRect ? { top: headRect.top - pageRect.top, bottom: headRect.bottom - pageRect.top, height: headRect.height } : null,
                  prose: proseRect ? { top: proseRect.top - pageRect.top, bottom: proseRect.bottom - pageRect.top, height: proseRect.height } : null,
                  footer: footerRect ? { top: footerRect.top - pageRect.top, bottom: footerRect.bottom - pageRect.top, height: footerRect.height } : null,
                  nav: {
                    prevTop: prevRect ? prevRect.top - pageRect.top : null,
                    nextTop: nextRect ? nextRect.top - pageRect.top : null
                  },
                  folio: folioRect ? { top: folioRect.top - pageRect.top, bottom: folioRect.bottom - pageRect.top } : null,
                  lastLine,
                  lastLineText,
                  parasCount: paras.length,
                  firstParaStart: paras[0] ? paras[0].textContent.slice(0, 40) : '',
                  gapToFooter: (footerRect && lastLine) ? (footerRect.top - pageRect.top - lastLine.bottom) : null,
                  gapToPageBottom: lastLine ? (pageRect.height - lastLine.bottom) : null
                };
              })()
            `);

            console.log(`\n--- PAGE ${p} ---`);
            console.log(JSON.stringify(pageInfo, null, 2));

            // Save screenshot
            const clip = {
              x: 0,
              y: 0,
              width: 1440,
              height: 900,
              scale: 1
            };
            const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
            if (screenshotRes && screenshotRes.data) {
              const imgPath = path.join(artifactDir, `crime_normal_p${p}.png`);
              nodeFs.writeFileSync(imgPath, Buffer.from(screenshotRes.data, 'base64'));
              console.log(`Saved screenshot: crime_normal_p${p}.png`);
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
