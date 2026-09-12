const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
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

server.listen(4894, async () => {
  const edge = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:4894'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  http.get('http://127.0.0.1:9224/json', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', async () => {
      try {
        const pages = JSON.parse(data);
        const targetPage = pages.find((p) => p.url.includes('localhost:4894'));
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
            const resObj = JSON.parse(event.data);
            if (resObj.id && pending.has(resObj.id)) {
              const resolve = pending.get(resObj.id);
              pending.delete(resObj.id);
              resolve(resObj.result);
            }
          });

          await send('Page.enable');
          await send('Runtime.enable');
          await send('Emulation.setDeviceMetricsOverride', {
            width: 1200,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false
          });

          // Skip entry
          await send('Runtime.evaluate', {
            expression: `
              const skip = document.getElementById('entry-skip-btn');
              if (skip) skip.click();
            `
          });
          await new Promise((r) => setTimeout(r, 800));

          // Log error listeners if any in page
          const evalRes = await send('Runtime.evaluate', {
            expression: `
              (function() {
                const input = document.getElementById('readingIntentInput');
                if (!input) return { error: 'No input' };
                input.value = 'something dark and mysterious';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return { success: true, val: input.value };
              })()
            `,
            returnByValue: true
          });
          console.log('Eval res:', evalRes);

          await new Promise((r) => setTimeout(r, 500));

          const resDOM = await send('Runtime.evaluate', {
            expression: `
              (function() {
                const results = document.getElementById('readingIntentResults');
                return {
                  display: results.style.display,
                  html: results.innerHTML.slice(0, 300)
                };
              })()
            `,
            returnByValue: true
          });
          console.log('Results DOM:', resDOM);

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
