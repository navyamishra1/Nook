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

const PORT = 4964;
const DEBUG_PORT = 9286;

server.listen(PORT, async () => {
  console.log('Testing full visual book page rendering...');

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

          await evaluate(`document.fonts.ready`, true);

          // Dismiss entry overlay
          await evaluate(`
            if (window.nookApp && window.nookApp.entry) {
              window.nookApp.entry.skipEntry(false);
            }
          `);
          await new Promise((r) => setTimeout(r, 200));

          const books = [
            { id: 'crime-and-punishment', title: 'Crime and Punishment', pages: [1, 2, 3, 4, 5] },
            { id: 'oliver-twist', title: 'Oliver Twist', pages: [1, 2, 3] },
            { id: 'frankenstein', title: 'Frankenstein', pages: [1, 2, 3] },
            { id: 'pride-and-prejudice', title: 'Pride and Prejudice', pages: [1, 2, 3] },
            { id: 'alices-adventures-in-wonderland', title: "Alice's Adventures in Wonderland", pages: [1, 2, 3] },
            { id: 'the-great-gatsby', title: 'The Great Gatsby', pages: [1, 2, 3] }
          ];

          let allPassed = true;

          for (const book of books) {
            console.log(`\n======================================================`);
            console.log(`BOOK: ${book.title}`);
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

              for (const p of book.pages) {
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
                await new Promise((r) => setTimeout(r, 120));

                const metrics = await evaluate(`
                  (() => {
                    const page = document.getElementById('readerPaperPage');
                    const prose = document.getElementById('readerProseContent');
                    const footer = document.querySelector('.reader-paper-footer-row');
                    const prevBtn = document.getElementById('readerPaperCornerPrev');
                    const nextBtn = document.getElementById('readerPaperCornerNext');
                    const paras = Array.from(prose.querySelectorAll('p'));

                    const pageRect = page.getBoundingClientRect();
                    const footerRect = footer ? footer.getBoundingClientRect() : null;
                    const prevRect = prevBtn ? prevBtn.getBoundingClientRect() : null;
                    const nextRect = nextBtn ? nextBtn.getBoundingClientRect() : null;

                    const lastPara = paras[paras.length - 1];
                    let trueGlyphBottom = 0;

                    if (lastPara) {
                      const range = document.createRange();
                      range.selectNodeContents(lastPara);
                      const rects = range.getClientRects();
                      if (rects.length > 0) {
                        const lastRect = rects[rects.length - 1];
                        trueGlyphBottom = lastRect.bottom - pageRect.top;
                      } else {
                        trueGlyphBottom = lastPara.getBoundingClientRect().bottom - pageRect.top;
                      }
                    }

                    const footerTop = footerRect ? (footerRect.top - pageRect.top) : (pageRect.height - 64);
                    const navTop = prevRect ? (prevRect.top - pageRect.top) : footerTop;
                    const clearanceToNav = navTop - trueGlyphBottom;
                    const clearanceToBottom = pageRect.height - trueGlyphBottom;

                    return {
                      pageRect: { x: pageRect.x, y: pageRect.y, width: pageRect.width, height: pageRect.height },
                      pageHeight: pageRect.height,
                      trueGlyphBottom,
                      footerTop,
                      navTop,
                      clearanceToNav,
                      clearanceToBottom,
                      lastTextSnippet: lastPara ? lastPara.textContent.slice(-50) : '',
                      pass: clearanceToNav >= 40 && clearanceToBottom >= 100
                    };
                  })()
                `);

                if (!metrics.pass) allPassed = false;

                console.log(`[${book.id}] Font: ${sizeName} | Page ${p}:`);
                console.log(`  Last Glyph Bottom = ${metrics.trueGlyphBottom.toFixed(1)}px | Footer Top = ${metrics.footerTop.toFixed(1)}px`);
                console.log(`  Clearance to Nav/Folio = ${metrics.clearanceToNav.toFixed(1)}px | Clearance to Page Bottom = ${metrics.clearanceToBottom.toFixed(1)}px`);
                console.log(`  PASS = ${metrics.pass} | "${metrics.lastTextSnippet.trim()}"`);

                // Capture clipped element screenshot of the full paper page
                if (metrics.pageRect && (book.id === 'crime-and-punishment' || p === 1)) {
                  const clip = {
                    x: Math.max(0, metrics.pageRect.x - 20),
                    y: Math.max(0, metrics.pageRect.y - 10),
                    width: metrics.pageRect.width + 40,
                    height: metrics.pageRect.height + 20,
                    scale: 1
                  };
                  const screenshotRes = await send('Page.captureScreenshot', { format: 'png', clip });
                  if (screenshotRes && screenshotRes.data) {
                    const imgPath = path.join(artifactDir, `full_paper_${book.id}_${sizeName}_p${p}.png`);
                    nodeFs.writeFileSync(imgPath, Buffer.from(screenshotRes.data, 'base64'));
                    console.log(`  Saved element screenshot: full_paper_${book.id}_${sizeName}_p${p}.png`);
                  }
                }
              }
            }
          }

          console.log(`\n======================================================`);
          console.log(`FINAL RESULT: ${allPassed ? 'ALL 6 BOOKS PASSED (100% GREEN)' : 'FAILED'}`);
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
