const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

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
        if (!targetPage) {
          console.error('No target page');
          edge.kill();
          process.exit(1);
        }

        const ws = new globalThis.WebSocket(targetPage.webSocketDebuggerUrl);
        let id = 1;
        const pending = new Map();

        ws.addEventListener('open', async () => {
          function send(method, params = {}) {
            return new Promise((resolve, reject) => {
              const msgId = id++;
              pending.set(msgId, { resolve, reject });
              ws.send(JSON.stringify({ id: msgId, method, params }));
            });
          }

          ws.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id && pending.has(msg.id)) {
              const { resolve, reject } = pending.get(msg.id);
              pending.delete(msg.id);
              if (msg.error) reject(msg.error);
              else resolve(msg.result);
            }
          });

          async function evaluate(expression) {
            const res = await send('Runtime.evaluate', {
              expression,
              returnByValue: true,
              awaitPromise: true
            });
            if (res.exceptionDetails) {
              throw new Error(`Evaluation failed: ${JSON.stringify(res.exceptionDetails)}`);
            }
            return res.result.value;
          }

          try {
            await send('Emulation.setDeviceMetricsOverride', {
              width: 1920,
              height: 1080,
              deviceScaleFactor: 1,
              mobile: false
            });

            await evaluate(`
              if (window.nookApp) {
                if (window.nookApp.entry) window.nookApp.entry.skipEntry();
                window.nookApp.navigateTo('reader', { bookId: 'frankenstein', chapterNumber: 1 });
              }
            `);
            await new Promise((r) => setTimeout(r, 1200));

            const testBooks = [
              'frankenstein',
              'pride-and-prejudice',
              'alices-adventures-in-wonderland',
              'the-great-gatsby',
              'the-adventures-of-sherlock-holmes',
              'jane-eyre',
              'dracula',
              'war-and-peace'
            ];

            for (const bookId of testBooks) {
              console.log(`\n================ Testing ${bookId} ================`);
              await evaluate(`
                window.nookApp.navigateTo('reader', { bookId: '${bookId}', chapterNumber: 1 });
              `);
              await new Promise((r) => setTimeout(r, 800));

              const pagInfo = await evaluate(`(() => {
                const reader = window.nookApp.reader;
                const pag = reader.pagination;
                if (!pag) return null;
                const samplePages = pag.pages.slice(0, 8).map(p => {
                  return {
                    page: p.pageNumber,
                    chap: p.chapterTitle,
                    isFirst: p.isFirstPageOfChapter,
                    wordCount: p.wordCount,
                    paraCount: p.paragraphs.length,
                    firstChars: p.paragraphs[0] ? p.paragraphs[0].slice(0, 40) : '',
                    lastChars: p.paragraphs[p.paragraphs.length - 1] ? p.paragraphs[p.paragraphs.length - 1].slice(-40) : ''
                  };
                });
                return {
                  totalPages: pag.totalPages,
                  samplePages
                };
              })()`);

              console.log(`Total Pages: ${pagInfo?.totalPages}`);
              pagInfo?.samplePages.forEach(p => {
                console.log(`Page ${p.page} (${p.chap}, first=${p.isFirst}): ${p.wordCount} words, ${p.paraCount} paras`);
              });
            }

            edge.kill();
            process.exit(0);
          } catch (err) {
            console.error('Error:', err);
            edge.kill();
            process.exit(1);
          }
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
