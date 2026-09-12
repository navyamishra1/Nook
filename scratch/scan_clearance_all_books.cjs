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

const PORT = 4916;
const DEBUG_PORT = 9236;

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

          const fontSizes = ['sm', 'md', 'lg'];

          console.log('\n========================================================');
          console.log('SCANNING RENDERED CLEARANCE ACROSS BOOKS & SIZES');
          console.log('========================================================');

          let violationsCount = 0;

          for (const bookId of booksToTest) {
            for (const fs of fontSizes) {
              await evaluate(`
                window.nookApp.navigateTo('reader', { bookId: '${bookId}', chapterNumber: 1, pageNumber: 1 });
              `);
              await new Promise((r) => setTimeout(r, 600));

              await evaluate(`
                window.nookApp.reader.setFontSize('${fs}');
              `);
              await new Promise((r) => setTimeout(r, 400));

              const totalPages = await evaluate(`window.nookApp.reader.pagination ? window.nookApp.reader.pagination.totalPages : 0`);
              console.log(`\nBook: ${bookId} | Font: ${fs} | Total Pages: ${totalPages}`);

              // Scan every 5th page up to 50 pages plus first 10 pages
              const pagesToScan = [];
              for (let p = 1; p <= Math.min(15, totalPages); p++) pagesToScan.push(p);
              for (let p = 20; p <= Math.min(60, totalPages); p += 5) pagesToScan.push(p);

              let minGap = Infinity;
              let minGapPage = 1;

              for (const p of pagesToScan) {
                await evaluate(`window.nookApp.reader.goToPage(${p})`);
                await new Promise((r) => setTimeout(r, 80));

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
                  violationsCount++;
                  console.error(`  [VIOLATION] Page ${p}: gap = ${metrics.gap.toFixed(1)}px (< 12px) | lpBottom = ${metrics.lpBottomFromTop.toFixed(1)}px | footerTop = ${metrics.footerTopFromTop.toFixed(1)}px`);
                }
              }

              console.log(`  Summary ${bookId} (${fs}): Minimum gap to footer = ${minGap.toFixed(1)}px (on Page ${minGapPage})`);
            }
          }

          console.log(`\nTotal clearance violations found: ${violationsCount}`);

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
