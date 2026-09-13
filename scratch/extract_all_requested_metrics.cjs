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

const PORT = 4988;
const DEBUG_PORT = 9310;

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

          await evaluate(`document.fonts.ready`, true);

          // Skip entry overlay
          await evaluate(`
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.skipEntry(false);
            }
          `);
          await new Promise((r) => setTimeout(r, 300));

          // Open Crime and Punishment in Normal Mode
          await evaluate(`
            window.nookApp.navigateTo('reader', { bookId: 'crime-and-punishment', chapterNumber: 1, pageNumber: 1 });
          `);

          for (let i = 0; i < 50; i++) {
            const ready = await evaluate(`!!(window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.pagination)`);
            if (ready) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          // Ensure normal mode
          await evaluate(`
            if (window.nookApp.reader && window.nookApp.reader.isFocusedMode) {
              window.nookApp.reader.toggleFocusedReadingMode();
            }
          `);
          await new Promise((r) => setTimeout(r, 300));

          // Extract detailed metrics for all pages in Translator's Preface
          const allMetrics = await evaluate(`
            (() => {
              const r = window.nookApp.reader;
              const pag = r.pagination;
              const results = [];

              for (let p = 1; p <= pag.totalPages; p++) {
                const pageObj = pag.getPage(p);
                if (pageObj.chapterIndex !== 0) continue;

                // Render page p
                r.currentPageNumber = p;
                r.render();

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
                const headerRect = runningHeader ? runningHeader.getBoundingClientRect() : (proseHeader ? proseHeader.getBoundingClientRect() : null);

                const paras = Array.from(prose.querySelectorAll('p'));
                const lastPara = paras[paras.length - 1];

                let lastLineRect = null;
                let lastLineText = '';
                if (lastPara) {
                  const range = document.createRange();
                  range.selectNodeContents(lastPara);
                  const rects = Array.from(range.getClientRects());
                  if (rects.length > 0) {
                    const lr = rects[rects.length - 1];
                    lastLineRect = {
                      top: lr.top - pageRect.top,
                      bottom: lr.bottom - pageRect.top,
                      height: lr.height
                    };
                  }
                  lastLineText = lastPara.textContent;
                }

                results.push({
                  pageNumber: p,
                  PAGE: {
                    width: pageRect.width,
                    height: pageRect.height,
                    top: pageRect.top,
                    bottom: pageRect.bottom
                  },
                  PROSE: {
                    top: proseRect ? (proseRect.top - pageRect.top) : 0,
                    bottom: proseRect ? (proseRect.bottom - pageRect.top) : 0,
                    height: proseRect ? proseRect.height : 0
                  },
                  FOOTER: {
                    top: footerRect ? (footerRect.top - pageRect.top) : 0,
                    bottom: footerRect ? (footerRect.bottom - pageRect.top) : 0,
                    height: footerRect ? footerRect.height : 0
                  },
                  NAV_BUTTONS: {
                    prevTop: prevRect ? (prevRect.top - pageRect.top) : 0,
                    nextTop: nextRect ? (nextRect.top - pageRect.top) : 0,
                    height: prevRect ? prevRect.height : 0
                  },
                  FOLIO: {
                    top: folioRect ? (folioRect.top - pageRect.top) : 0,
                    bottom: folioRect ? (folioRect.bottom - pageRect.top) : 0
                  },
                  LAST_TEXT: {
                    top: lastLineRect ? lastLineRect.top : (lastPara ? lastPara.getBoundingClientRect().top - pageRect.top : 0),
                    bottom: lastLineRect ? lastLineRect.bottom : (lastPara ? lastPara.getBoundingClientRect().bottom - pageRect.top : 0),
                    snippet: lastLineText.slice(-60)
                  },
                  CLEARANCE: {
                    toFooterTop: (footerRect && lastLineRect) ? (footerRect.top - pageRect.top - lastLineRect.bottom) : null,
                    toPageBottom: lastLineRect ? (pageRect.height - lastLineRect.bottom) : null
                  }
                });
              }

              return results;
            })()
          `);

          console.log('\n======================================================');
          console.log('ALL EXTRACTED DOM MEASUREMENTS (NORMAL MODE):');
          console.log('======================================================');
          console.log(JSON.stringify(allMetrics, null, 2));

          // Now let's capture screenshots for each page
          for (let p = 1; p <= allMetrics.length; p++) {
            await evaluate(`
              window.nookApp.reader.currentPageNumber = ${p};
              window.nookApp.reader.render();
            `);
            await new Promise((r) => setTimeout(r, 200));

            const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
            if (screenshotRes && screenshotRes.data) {
              const imgPath = path.join(artifactDir, `normal_mode_verified_p${p}.png`);
              nodeFs.writeFileSync(imgPath, Buffer.from(screenshotRes.data, 'base64'));
              console.log(`Saved screenshot: normal_mode_verified_p${p}.png`);
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
