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

const PORT = 4968;
const DEBUG_PORT = 9290;

server.listen(PORT, async () => {
  console.log(`Diagnostic server running on http://localhost:${PORT}`);

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

          // Skip entry
          await evaluate(`
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.skipEntry(false);
            }
          `);
          await new Promise((r) => setTimeout(r, 300));

          // Open Crime and Punishment
          console.log('Navigating to Crime and Punishment...');
          await evaluate(`
            window.nookApp.navigateTo('reader', { bookId: 'crime-and-punishment', chapterNumber: 1, pageNumber: 3 });
          `);

          // Wait for load & pagination
          for (let i = 0; i < 50; i++) {
            const ready = await evaluate(`!!(window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.pagination)`);
            if (ready) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          // Let's inspect Page 3 in NORMAL MODE and FOCUS MODE
          for (const mode of ['normal', 'focus']) {
            console.log(`\n======================================================`);
            console.log(`MODE: ${mode.toUpperCase()}`);
            console.log(`======================================================`);

            if (mode === 'focus') {
              await evaluate(`
                if (window.nookApp.reader && !window.nookApp.reader.isFocusedMode) {
                  window.nookApp.reader.toggleFocusedReadingMode();
                }
              `);
            } else {
              await evaluate(`
                if (window.nookApp.reader && window.nookApp.reader.isFocusedMode) {
                  window.nookApp.reader.toggleFocusedReadingMode();
                }
              `);
            }
            await new Promise((r) => setTimeout(r, 500));

            // Navigate to page 3
            await evaluate(`
              window.nookApp.reader.goToPage(3);
            `);
            await new Promise((r) => setTimeout(r, 300));

            const inspection = await evaluate(`
              (() => {
                const page = document.getElementById('readerPaperPage');
                const leafBody = document.querySelector('.reader-leaf-body');
                const prose = document.getElementById('readerProseContent');
                const footer = document.querySelector('.reader-paper-footer-row');
                const prevBtn = document.getElementById('readerPaperCornerPrev');
                const nextBtn = document.getElementById('readerPaperCornerNext');
                const folio = document.getElementById('readerPaperFolio');
                const stage = document.querySelector('.reader-page-flip-stage');
                const container = document.querySelector('.reader-container') || document.querySelector('.reader-paper-surface');

                const pageRect = page.getBoundingClientRect();
                const leafRect = leafBody ? leafBody.getBoundingClientRect() : null;
                const proseRect = prose ? prose.getBoundingClientRect() : null;
                const footerRect = footer ? footer.getBoundingClientRect() : null;
                const prevRect = prevBtn ? prevBtn.getBoundingClientRect() : null;
                const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
                const folioRect = folio ? folio.getBoundingClientRect() : null;
                const stageRect = stage ? stage.getBoundingClientRect() : null;

                const pageStyle = window.getComputedStyle(page);
                const leafStyle = leafBody ? window.getComputedStyle(leafBody) : null;
                const proseStyle = prose ? window.getComputedStyle(prose) : null;
                const footerStyle = footer ? window.getComputedStyle(footer) : null;

                const paras = Array.from(prose ? prose.querySelectorAll('p') : []);
                const paraData = paras.map((p, idx) => {
                  const r = p.getBoundingClientRect();
                  const range = document.createRange();
                  range.selectNodeContents(p);
                  const clientRects = Array.from(range.getClientRects()).map(cr => ({
                    top: cr.top - pageRect.top,
                    bottom: cr.bottom - pageRect.top,
                    left: cr.left - pageRect.left,
                    right: cr.right - pageRect.left,
                    height: cr.height,
                    width: cr.width
                  }));

                  return {
                    idx,
                    text: p.textContent.slice(0, 40) + '...' + p.textContent.slice(-40),
                    fullLength: p.textContent.length,
                    rect: {
                      top: r.top - pageRect.top,
                      bottom: r.bottom - pageRect.top,
                      left: r.left - pageRect.left,
                      right: r.right - pageRect.left,
                      height: r.height
                    },
                    lineCount: clientRects.length,
                    lines: clientRects
                  };
                });

                // Let's inspect the pagination measurer element used during paginateBook
                const measurer = document.getElementById('nookPaginationMeasurer');
                let measurerInfo = null;
                if (measurer) {
                  const mr = measurer.getBoundingClientRect();
                  const ms = window.getComputedStyle(measurer);
                  measurerInfo = {
                    clientWidth: measurer.clientWidth,
                    clientHeight: measurer.clientHeight,
                    offsetWidth: measurer.offsetWidth,
                    offsetHeight: measurer.offsetHeight,
                    scrollHeight: measurer.scrollHeight,
                    computedPadding: ms.padding,
                    computedWidth: ms.width,
                    computedHeight: ms.height,
                    computedBoxSizing: ms.boxSizing
                  };
                }

                // Check pagination state
                const reader = window.nookApp.reader;
                const pageObj = reader.pagination ? reader.pagination.getPage(3) : null;

                return {
                  fontSize: reader.fontSize,
                  pageCount: reader.pagination ? reader.pagination.totalPages : 0,
                  pageObj,
                  pageRect,
                  leafRect,
                  proseRect,
                  footerRect,
                  prevRect,
                  nextRect,
                  folioRect,
                  stageRect,
                  pageStyle: {
                    padding: pageStyle.padding,
                    width: pageStyle.width,
                    height: pageStyle.height,
                    boxSizing: pageStyle.boxSizing,
                    transform: pageStyle.transform,
                    position: pageStyle.position,
                    overflow: pageStyle.overflow
                  },
                  proseStyle: proseStyle ? {
                    padding: proseStyle.padding,
                    margin: proseStyle.margin,
                    fontSize: proseStyle.fontSize,
                    lineHeight: proseStyle.lineHeight,
                    width: proseStyle.width,
                    height: proseStyle.height
                  } : null,
                  footerStyle: footerStyle ? {
                    position: footerStyle.position,
                    bottom: footerStyle.bottom,
                    height: footerStyle.height,
                    padding: footerStyle.padding
                  } : null,
                  measurerInfo,
                  paraCount: paras.length,
                  paraData
                };
              })()
            `);

            console.log('Inspection Data:', JSON.stringify(inspection, null, 2));

            // Capture screenshot of the full viewport and page
            const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
            if (screenshotRes && screenshotRes.data) {
              const imgPath = path.join(artifactDir, `diagnose_p3_${mode}.png`);
              nodeFs.writeFileSync(imgPath, Buffer.from(screenshotRes.data, 'base64'));
              console.log(`Saved screenshot: diagnose_p3_${mode}.png`);
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
