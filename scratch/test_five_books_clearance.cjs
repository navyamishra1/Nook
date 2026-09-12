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

const PORT = 4940;
const DEBUG_PORT = 9260;

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

          const booksToTest = [
            'oliver-twist',
            'frankenstein',
            'pride-and-prejudice',
            'alices-adventures-in-wonderland',
            'the-great-gatsby'
          ];

          console.log('\n================================================================');
          console.log('NOOK READER — 5 BOOKS CLEARANCE & BOTTOM BOUNDARY QA');
          console.log('================================================================');

          let totalViolations = 0;

          for (const bookId of booksToTest) {
            console.log(`\n--- Testing Book: ${bookId} ---`);
            for (const fs of ['sm', 'md', 'lg']) {
              // Direct open via reader.openBook
              await evaluate(`window.nookApp.reader.openBook('${bookId}', 1, 1)`);
              
              for (let i = 0; i < 50; i++) {
                const ready = await evaluate(`!!(window.nookApp.reader && !window.nookApp.reader.isLoading && window.nookApp.reader.pagination && window.nookApp.reader.activeBookId === '${bookId}')`);
                if (ready) break;
                await new Promise((r) => setTimeout(r, 50));
              }

              await evaluate(`window.nookApp.reader.setFontSize('${fs}')`);
              await new Promise((r) => setTimeout(r, 150));

              const totalPages = await evaluate(`window.nookApp.reader.pagination.totalPages`);

              // Check sample of pages
              const pagesToCheck = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, Math.floor(totalPages / 2), totalPages].filter(p => p <= totalPages);
              let minGap = Infinity;
              let minGapPage = 1;
              let violations = 0;

              for (const p of pagesToCheck) {
                await evaluate(`window.nookApp.reader.goToPage(${p})`);
                await new Promise((r) => setTimeout(r, 30));

                const metrics = await evaluate(`
                  (() => {
                    const page = document.getElementById('readerPaperPage');
                    const footer = document.querySelector('.reader-paper-footer-row');
                    const prose = document.getElementById('readerProseContent');
                    const paras = Array.from(prose.querySelectorAll('p'));
                    const lastPara = paras[paras.length - 1];

                    const pageRect = page.getBoundingClientRect();
                    const footerRect = footer ? footer.getBoundingClientRect() : null;
                    const lpRect = lastPara ? lastPara.getBoundingClientRect() : null;

                    const footerTop = footerRect ? footerRect.top : 0;
                    const lpBottom = lpRect ? lpRect.bottom : 0;
                    const gap = footerTop - lpBottom;

                    return {
                      pageNumber: ${p},
                      gap,
                      footerTopFromTop: footerRect ? (footerRect.top - pageRect.top) : 0,
                      lpBottomFromTop: lpRect ? (lpRect.bottom - pageRect.top) : 0,
                      overlaps: gap <= 0
                    };
                  })()
                `);

                if (metrics.gap < minGap) {
                  minGap = metrics.gap;
                  minGapPage = p;
                }

                if (metrics.overlaps || metrics.gap < 12) {
                  violations++;
                  totalViolations++;
                  console.error(`  [FAIL] ${bookId} (${fs}) Page ${p}: gap = ${metrics.gap.toFixed(1)}px (< 12px) | lpBottom = ${metrics.lpBottomFromTop.toFixed(1)}px | footerTop = ${metrics.footerTopFromTop.toFixed(1)}px`);
                }
              }

              console.log(`  ${violations === 0 ? '[PASS]' : '[FAIL]'} ${bookId.padEnd(30)} | size: ${fs} | totalPages: ${String(totalPages).padStart(4)} | minGap: ${minGap.toFixed(1)}px (Page ${minGapPage})`);
            }
          }

          console.log('\n================================================================');
          console.log(`TOTAL CLEARANCE VIOLATIONS: ${totalViolations}`);
          console.log(`STATUS: ${totalViolations === 0 ? '100% CLEAN & VERIFIED' : 'FAILED'}`);
          console.log('================================================================');

          ws.close();
          edge.kill();
          server.close();
          process.exit(totalViolations === 0 ? 0 : 1);
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
