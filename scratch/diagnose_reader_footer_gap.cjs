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

const PORT = 4910;
const DEBUG_PORT = 9230;

server.listen(PORT, async () => {
  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
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

          const booksToTest = [
            'pride-and-prejudice',
            'frankenstein',
            'oliver-twist',
            'alices-adventures-in-wonderland',
            'the-great-gatsby'
          ];

          console.log('\n========================================================');
          console.log('MEASURING RENDERED GEOMETRY AND FOOTER CLEARANCE');
          console.log('========================================================');

          for (const bookId of booksToTest) {
            console.log(`\n--- Inspecting Book: ${bookId} ---`);
            await evaluate(`
              window.nookApp.navigateTo('reader', { bookId: '${bookId}', chapterNumber: 1, pageNumber: 1 });
            `);
            await new Promise((r) => setTimeout(r, 800));

            // Inspect first 8 pages of book
            const numPagesToCheck = 8;
            for (let p = 1; p <= numPagesToCheck; p++) {
              await evaluate(`window.nookApp.reader.goToPage(${p})`);
              await new Promise((r) => setTimeout(r, 150));

              const geom = await evaluate(`
                (() => {
                  const page = document.getElementById('readerPaperPage');
                  const footer = document.querySelector('.reader-paper-footer-row');
                  const prevBtn = document.getElementById('readerPaperCornerPrev');
                  const pageNum = document.querySelector('.reader-paper-page-number');
                  const nextBtn = document.getElementById('readerPaperCornerNext');
                  const prose = document.getElementById('readerProseContent');
                  const paras = Array.from(prose.querySelectorAll('p'));

                  const lastPara = paras[paras.length - 1];
                  const lastParaRect = lastPara ? lastPara.getBoundingClientRect() : null;
                  const pageRect = page.getBoundingClientRect();
                  const footerRect = footer ? footer.getBoundingClientRect() : null;
                  const proseRect = prose.getBoundingClientRect();

                  const footerTop = footerRect ? footerRect.top : 0;
                  const lastParaBottom = lastParaRect ? lastParaRect.bottom : 0;
                  const gap = footerTop - lastParaBottom;

                  return {
                    pageNumber: ${p},
                    pageHeight: pageRect.height,
                    clientHeight: page.clientHeight,
                    footerTopFromPageTop: footerRect ? (footerRect.top - pageRect.top) : null,
                    footerHeight: footerRect ? footerRect.height : null,
                    proseBottomFromPageTop: proseRect ? (proseRect.bottom - pageRect.top) : null,
                    lastParaBottomFromPageTop: lastParaRect ? (lastParaRect.bottom - pageRect.top) : null,
                    gapToFooterTop: gap,
                    overlapsFooter: gap < 0,
                    proseParagraphsCount: paras.length,
                    lastParaTextSnippet: lastPara ? lastPara.textContent.slice(-50) : ''
                  };
                })()
              `);

              console.log(`  Page ${p}: gap to footer top = ${geom.gapToFooterTop.toFixed(1)}px | lastParaBottomFromTop = ${geom.lastParaBottomFromPageTop.toFixed(1)}px | footerTopFromTop = ${geom.footerTopFromPageTop.toFixed(1)}px | overlap = ${geom.overlapsFooter}`);
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
