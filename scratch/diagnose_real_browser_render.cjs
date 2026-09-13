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

const PORT = 4963;
const DEBUG_PORT = 9285;

server.listen(PORT, async () => {
  console.log('Connecting to browser to inspect real rendered DOM and fonts...');

  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1280,1024',
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

          // Check document.fonts status
          const fontsLoaded = await evaluate(`document.fonts.status`);
          console.log('Document fonts status initially:', fontsLoaded);

          // Wait for fonts to be ready
          await evaluate(`document.fonts.ready`, true);
          const fontsLoadedAfter = await evaluate(`document.fonts.status`);
          console.log('Document fonts status after ready:', fontsLoadedAfter);

          // Dismiss entry overlay immediately
          await evaluate(`
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.skipEntry(false);
            }
          `);
          await new Promise((r) => setTimeout(r, 200));

          // Check if Literata / Fraunces are loaded
          const checkLiterata = await evaluate(`document.fonts.check('16px Literata')`);
          const checkFraunces = await evaluate(`document.fonts.check('24px Fraunces')`);
          console.log('Literata loaded:', checkLiterata, '| Fraunces loaded:', checkFraunces);

          // Open Crime and Punishment
          await evaluate(`
            window.nookApp.navigateTo('reader', { bookId: 'crime-and-punishment', chapterNumber: 1, pageNumber: 1 });
          `);

          for (let i = 0; i < 60; i++) {
            const ready = await evaluate(`!!(window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.pagination && window.nookApp.reader.activeBookId === 'crime-and-punishment')`);
            if (ready) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          // Check real DOM vs measurer DOM metrics for Page 1, 2, 3, 4, 5
          for (const p of [1, 2, 3, 4, 5]) {
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
            await new Promise((r) => setTimeout(r, 200));

            const diagnostics = await evaluate(`
              (() => {
                const page = document.getElementById('readerPaperPage');
                const prose = document.getElementById('readerProseContent');
                const footer = document.querySelector('.reader-paper-footer-row');
                const prevBtn = document.getElementById('readerPaperCornerPrev');
                const nextBtn = document.getElementById('readerPaperCornerNext');
                const pageNum = document.querySelector('.reader-paper-page-number');

                const pageRect = page.getBoundingClientRect();
                const proseRect = prose.getBoundingClientRect();
                const footerRect = footer ? footer.getBoundingClientRect() : null;
                const prevRect = prevBtn ? prevBtn.getBoundingClientRect() : null;
                const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;
                const pageNumRect = pageNum ? pageNum.getBoundingClientRect() : null;

                // Inspect each paragraph in real reader
                const paras = Array.from(prose.querySelectorAll('p'));
                const paraData = paras.map((p, idx) => {
                  const r = p.getBoundingClientRect();
                  const comp = window.getComputedStyle(p);
                  
                  // Use Range to find exact lines and client rects
                  const range = document.createRange();
                  range.selectNodeContents(p);
                  const clientRects = Array.from(range.getClientRects()).map(cr => ({
                    top: cr.top - pageRect.top,
                    bottom: cr.bottom - pageRect.top,
                    height: cr.height,
                    left: cr.left - pageRect.left,
                    right: cr.right - pageRect.left
                  }));

                  return {
                    idx,
                    textSnippet: p.textContent.slice(-40),
                    top: r.top - pageRect.top,
                    bottom: r.bottom - pageRect.top,
                    height: r.height,
                    marginBottom: parseFloat(comp.marginBottom),
                    lineHeight: comp.lineHeight,
                    fontFamily: comp.fontFamily,
                    fontSize: comp.fontSize,
                    lineRectsCount: clientRects.length,
                    lastLineRect: clientRects[clientRects.length - 1] || null
                  };
                });

                const lastPara = paraData[paraData.length - 1];
                const lastLine = lastPara ? lastPara.lastLineRect : null;
                const trueGlyphBottom = lastLine ? lastLine.bottom : (lastPara ? lastPara.bottom : proseRect.bottom - pageRect.top);

                return {
                  pageHeight: pageRect.height,
                  pageWidth: pageRect.width,
                  clientHeight: page.clientHeight,
                  footerTop: footerRect ? (footerRect.top - pageRect.top) : null,
                  prevTop: prevRect ? (prevRect.top - pageRect.top) : null,
                  nextTop: nextRect ? (nextRect.top - pageRect.top) : null,
                  pageNumTop: pageNumRect ? (pageNumRect.top - pageRect.top) : null,
                  lastParaBottom: lastPara ? lastPara.bottom : null,
                  trueGlyphBottom,
                  clearanceToFooter: footerRect ? (footerRect.top - pageRect.top - trueGlyphBottom) : null,
                  clearanceToPageBottom: pageRect.height - trueGlyphBottom,
                  paras: paraData
                };
              })()
            `);

            console.log(`\n--- CRIME AND PUNISHMENT PAGE ${p} DIAGNOSTICS ---`);
            console.log(`Page Height: ${diagnostics.pageHeight}px | Client Height: ${diagnostics.clientHeight}px`);
            console.log(`Footer Top: ${diagnostics.footerTop}px | PrevBtn Top: ${diagnostics.prevTop}px | NextBtn Top: ${diagnostics.nextTop}px`);
            console.log(`Last Para Bottom: ${diagnostics.lastParaBottom}px | True Last Line Bottom: ${diagnostics.trueGlyphBottom}px`);
            console.log(`Clearance to Footer: ${diagnostics.clearanceToFooter}px | Clearance to Page Bottom: ${diagnostics.clearanceToPageBottom}px`);
            if (diagnostics.paras.length > 0) {
              const lp = diagnostics.paras[diagnostics.paras.length - 1];
              console.log(`Last Para Font: ${lp.fontFamily} ${lp.fontSize} | LineHeight: ${lp.lineHeight} | MarginBottom: ${lp.marginBottom}px`);
              console.log(`Last Line snippet: "${lp.textSnippet}"`);
            }

            // Capture screenshot of page
            const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
            if (screenshotRes && screenshotRes.data) {
              const imgPath = path.join(artifactDir, `crime_and_punishment_real_diag_p${p}.png`);
              nodeFs.writeFileSync(imgPath, Buffer.from(screenshotRes.data, 'base64'));
              console.log(`Saved screenshot: crime_and_punishment_real_diag_p${p}.png`);
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
