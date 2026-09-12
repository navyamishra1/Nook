const { spawn } = require('child_process');
const http = require('http');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:8000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  const req = http.get('http://127.0.0.1:9222/json', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const pages = JSON.parse(data);
        const targetPage = pages.find((p) => p.url.includes('localhost:8000'));
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

          await send('Page.navigate', { url: 'http://localhost:8000' });
          await new Promise((r) => setTimeout(r, 1500));

          async function evaluate(expression, awaitPromise = true) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
            if (!res) return null;
            if (res.exceptionDetails) {
              console.error('Eval exception:', res.exceptionDetails);
            }
            return res.result ? res.result.value : res;
          }

          // Wait for window.nookApp initialization
          for (let i = 0; i < 40; i++) {
            const isReady = await evaluate(`!!(window.nookApp && window.nookApp.catalog)`);
            if (isReady) break;
            await new Promise((r) => setTimeout(r, 100));
          }

          // Navigate to Reader for Pride and Prejudice
          await evaluate(`
            if (window.nookApp) {
              window.nookApp.navigateTo('reader', { bookId: 'pride-and-prejudice', chapterNumber: 1, pageNumber: 1 });
            }
          `);

          await new Promise((r) => setTimeout(r, 1200));

          const pageGeom = await evaluate(`
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

              return {
                page: { top: pageRect.top, bottom: pageRect.bottom, height: pageRect.height, clientHeight: page.clientHeight },
                footer: footerRect ? { top: footerRect.top, bottom: footerRect.bottom, height: footerRect.height, offsetFromPageBottom: pageRect.bottom - footerRect.bottom, topFromPageTop: footerRect.top - pageRect.top } : null,
                prose: { top: proseRect.top, bottom: proseRect.bottom, height: proseRect.height, topFromPageTop: proseRect.top - pageRect.top, bottomFromPageTop: proseRect.bottom - pageRect.top },
                lastPara: lastParaRect ? { top: lastParaRect.top, bottom: lastParaRect.bottom, height: lastParaRect.height, bottomFromPageTop: lastParaRect.bottom - pageRect.top } : null,
                overlapWithFooter: lastParaRect && footerRect ? (lastParaRect.bottom > footerRect.top) : false,
                gapBetweenLastParaAndFooterTop: lastParaRect && footerRect ? (footerRect.top - lastParaRect.bottom) : null
              };
            })()
          `);

          console.log('\n--- PAGE 1 GEOMETRY INSPECTION ---');
          console.log(JSON.stringify(pageGeom, null, 2));

          // Let's also check Page 2
          await evaluate(`window.nookApp.reader.goToPage(2)`);
          await new Promise((r) => setTimeout(r, 400));

          const page2Geom = await evaluate(`
            (() => {
              const page = document.getElementById('readerPaperPage');
              const footer = document.querySelector('.reader-paper-footer-row');
              const prose = document.getElementById('readerProseContent');
              const paras = Array.from(prose.querySelectorAll('p'));
              const lastPara = paras[paras.length - 1];
              const lastParaRect = lastPara ? lastPara.getBoundingClientRect() : null;
              const pageRect = page.getBoundingClientRect();
              const footerRect = footer ? footer.getBoundingClientRect() : null;
              const proseRect = prose.getBoundingClientRect();

              return {
                page: { top: pageRect.top, bottom: pageRect.bottom, height: pageRect.height, clientHeight: page.clientHeight },
                footer: footerRect ? { top: footerRect.top, bottom: footerRect.bottom, height: footerRect.height, topFromPageTop: footerRect.top - pageRect.top } : null,
                prose: { top: proseRect.top, bottom: proseRect.bottom, height: proseRect.height, bottomFromPageTop: proseRect.bottom - pageRect.top },
                lastPara: lastParaRect ? { top: lastParaRect.top, bottom: lastParaRect.bottom, height: lastParaRect.height, bottomFromPageTop: lastParaRect.bottom - pageRect.top } : null,
                overlapWithFooter: lastParaRect && footerRect ? (lastParaRect.bottom > footerRect.top) : false,
                gapBetweenLastParaAndFooterTop: lastParaRect && footerRect ? (footerRect.top - lastParaRect.bottom) : null
              };
            })()
          `);

          console.log('\n--- PAGE 2 GEOMETRY INSPECTION ---');
          console.log(JSON.stringify(page2Geom, null, 2));

          ws.close();
          edge.kill();
          process.exit(0);
        });
      } catch (e) {
        console.error(e);
        edge.kill();
        process.exit(1);
      }
    });
  });
}

main();
