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

const PORT = 4962;
const DEBUG_PORT = 9284;

server.listen(PORT, async () => {
  console.log('Connecting to browser to inspect Crime and Punishment...');

  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--window-size=1280,950',
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

          // Inspect all requested books
          const booksToTest = [
            { id: 'crime-and-punishment', title: 'Crime and Punishment', testPages: [1, 2, 3, 4, 5] },
            { id: 'oliver-twist', title: 'Oliver Twist', testPages: [1, 2, 3] },
            { id: 'frankenstein', title: 'Frankenstein', testPages: [1, 2, 3] },
            { id: 'pride-and-prejudice', title: 'Pride and Prejudice', testPages: [1, 2, 3] },
            { id: 'alices-adventures-in-wonderland', title: "Alice's Adventures in Wonderland", testPages: [1, 2, 3] },
            { id: 'the-great-gatsby', title: 'The Great Gatsby', testPages: [1, 2, 3] }
          ];

          let allPassed = true;
          const reportSummary = [];

          for (const book of booksToTest) {
            console.log(`\n======================================================`);
            console.log(`BOOK: ${book.title} (${book.id})`);
            console.log(`======================================================`);

            for (const sizeName of ['sm', 'md', 'lg']) {
              await evaluate(`
                window.nookApp.navigateTo('reader', { bookId: '${book.id}', chapterNumber: 1, pageNumber: 1 });
              `);

              for (let i = 0; i < 60; i++) {
                const ready = await evaluate(`!!(window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.pagination && window.nookApp.reader.activeBookId === '${book.id}')`);
                if (ready) break;
                await new Promise((r) => setTimeout(r, 80));
              }

              await evaluate(`window.nookApp.reader.setFontSize('${sizeName}')`);
              for (let i = 0; i < 30; i++) {
                const settled = await evaluate(`!!(window.nookApp.reader.pagination && window.nookApp.reader.fontSize === '${sizeName}' && !window.nookApp.reader.isTransitioning)`);
                if (settled) break;
                await new Promise((r) => setTimeout(r, 60));
              }

              const totalPages = await evaluate(`window.nookApp.reader.pagination.totalPages`);

              for (const p of book.testPages) {
                if (p > totalPages) continue;

                // Turn to page with reduced motion for instant sync inspection
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
                await new Promise((r) => setTimeout(r, 100));

                const info = await evaluate(`
                  (() => {
                    const page = document.getElementById('readerPaperPage');
                    const footer = document.querySelector('.reader-paper-footer-row');
                    const prevBtn = document.getElementById('readerPaperCornerPrev');
                    const nextBtn = document.getElementById('readerPaperCornerNext');
                    const pageNum = document.querySelector('.reader-paper-page-number');
                    const prose = document.getElementById('readerProseContent');
                    const paras = Array.from(prose.querySelectorAll('p'));
                    const lastPara = paras[paras.length - 1];

                    const pageRect = page.getBoundingClientRect();
                    const footerRect = footer ? footer.getBoundingClientRect() : null;
                    const prevRect = prevBtn ? prevBtn.getBoundingClientRect() : null;
                    const pageNumRect = pageNum ? pageNum.getBoundingClientRect() : null;
                    const lpRect = lastPara ? lastPara.getBoundingClientRect() : null;
                    const proseRect = prose.getBoundingClientRect();

                    const physicalBottom = pageRect.bottom;
                    const lastTextBottom = lpRect ? lpRect.bottom : proseRect.bottom;
                    const footerTop = footerRect ? footerRect.top : (physicalBottom - 64);
                    const prevTop = prevRect ? prevRect.top : footerTop;
                    const pageNumTop = pageNumRect ? pageNumRect.top : footerTop;

                    const clearanceFromPhysicalBottom = physicalBottom - lastTextBottom;
                    const clearanceFromFooterTop = footerTop - lastTextBottom;
                    const clearanceFromNavButtons = Math.min(prevTop, pageNumTop) - lastTextBottom;

                    return {
                      pageNumber: ${p},
                      pageHeight: pageRect.height,
                      clientHeight: page.clientHeight,
                      lastTextBottomFromTop: lastTextBottom - pageRect.top,
                      footerTopFromTop: footerTop - pageRect.top,
                      clearanceFromPhysicalBottom,
                      clearanceFromFooterTop,
                      clearanceFromNavButtons,
                      parasCount: paras.length,
                      lastTextSnippet: lastPara ? lastPara.textContent.slice(-60) : '',
                      overflowsPage: lastTextBottom > physicalBottom,
                      overlapsFooter: lastTextBottom > footerTop
                    };
                  })()
                `);

                const pass = info.clearanceFromPhysicalBottom >= 80 && info.clearanceFromFooterTop >= 16 && !info.overflowsPage && !info.overlapsFooter;
                if (!pass) allPassed = false;

                console.log(`[${book.id}] Font: ${sizeName} | Page ${p}:`);
                console.log(`  lastTextBottom = ${info.lastTextBottomFromTop.toFixed(1)}px | footerTop = ${info.footerTopFromTop.toFixed(1)}px | pageH = ${info.pageHeight.toFixed(1)}px`);
                console.log(`  clearance (physical bottom) = ${info.clearanceFromPhysicalBottom.toFixed(1)}px | clearance (footer top) = ${info.clearanceFromFooterTop.toFixed(1)}px`);
                console.log(`  PASS: ${pass} | snippet: "${info.lastTextSnippet.trim()}"`);

                reportSummary.push({
                  book: book.id,
                  font: sizeName,
                  page: p,
                  clearancePhysical: info.clearanceFromPhysicalBottom.toFixed(1),
                  clearanceFooter: info.clearanceFromFooterTop.toFixed(1),
                  pass
                });

                // Capture screenshot for key pages
                if (book.id === 'crime-and-punishment' || p === 1 || p === 2) {
                  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
                  if (screenshotRes && screenshotRes.data) {
                    const imgPath = path.join(artifactDir, `page_${book.id}_${sizeName}_p${p}.png`);
                    nodeFs.writeFileSync(imgPath, Buffer.from(screenshotRes.data, 'base64'));
                  }
                }
              }
            }
          }

          console.log(`\n======================================================`);
          console.log(`ALL 6 BOOKS CLEARANCE VERIFICATION RESULT: ${allPassed ? 'PASSED (100% GREEN)' : 'FAILED'}`);
          console.log(`Total sample pages tested: ${reportSummary.length}`);
          console.log(`======================================================`);

          ws.close();
          edge.kill();
          server.close();
          process.exit(allPassed ? 0 : 1);
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

