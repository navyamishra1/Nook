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
            if (parsed.method === 'Runtime.consoleAPICalled') {
              console.log('[BROWSER CONSOLE]', parsed.params.args.map(a => a.value || a.description).join(' '));
            }
          });

          await send('Runtime.enable');
          await send('Page.enable');
          await send('DOM.enable');
          await send('CSS.enable');

          async function evaluate(expression) {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true });
            return res.result ? res.result.value : res;
          }

          // Step 5: clear localStorage & reload
          await evaluate("localStorage.removeItem('nook_visited')");

          console.log('=== REAL RUNTIME BROWSER DIAGNOSTIC ===\n');

          // Step 6: prefers-reduced-motion
          const reducedMotion = await evaluate("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
          console.log('Q6: window.matchMedia("(prefers-reduced-motion: reduce)").matches =', reducedMotion);

          // Step 7: Elements existence
          const trigger = await evaluate("!!document.getElementById('tactile-book-trigger')");
          const overlay = await evaluate("!!document.getElementById('entry-overlay')");
          console.log("Q7: document.getElementById('tactile-book-trigger') exists =", trigger);
          console.log("Q7: document.getElementById('entry-overlay') exists =", overlay);

          // Step 13: Stylesheets
          const sheets = await evaluate("[...document.styleSheets].map(s => s.href)");
          console.log('\nQ13: Loaded stylesheets:');
          sheets.forEach(s => console.log('   -', s));

          // Step 9 & 10 before click
          const preCoverTransform = await evaluate("getComputedStyle(document.querySelector('.book-front-cover')).getPropertyValue('transform')");
          const preCoverOrigin = await evaluate("getComputedStyle(document.querySelector('.book-front-cover')).getPropertyValue('transform-origin')");
          const preOverlayClass = await evaluate("document.getElementById('entry-overlay').className");
          console.log('\nQ9/10/11 [BEFORE CLICK - PHASE 1 CLOSED]:');
          console.log('   - .book-front-cover computed transform:', preCoverTransform);
          console.log('   - .book-front-cover computed transform-origin:', preCoverOrigin);
          console.log('   - #entry-overlay className:', JSON.stringify(preOverlayClass));
          console.log('   - #tactile-book-trigger className:', JSON.stringify(await evaluate("document.getElementById('tactile-book-trigger').className")));

          // Click book
          console.log('\n>>> Clicking #tactile-book-trigger now...');
          await evaluate("document.getElementById('tactile-book-trigger').click()");

          // During Phase 2 (Opening at ~450ms)
          await new Promise(r => setTimeout(r, 450));
          const openCoverTransform = await evaluate("getComputedStyle(document.querySelector('.book-front-cover')).getPropertyValue('transform')");
          const openBookTransform = await evaluate("getComputedStyle(document.getElementById('tactile-book-trigger')).getPropertyValue('transform')");
          const openStageTransform = await evaluate("getComputedStyle(document.querySelector('.book-stage-container')).getPropertyValue('transform')");
          const openOverlayClass = await evaluate("document.getElementById('entry-overlay').className");
          const openBookClass = await evaluate("document.getElementById('tactile-book-trigger').className");
          console.log('\nQ9/10/11/12 [DURING PHASE 2 - OPENING AT 450ms]:');
          console.log('   - #tactile-book-trigger className:', JSON.stringify(openBookClass));
          console.log('   - #entry-overlay className:', JSON.stringify(openOverlayClass));
          console.log('   - .book-front-cover computed transform:', openCoverTransform);
          console.log('   - #tactile-book-trigger computed transform:', openBookTransform);
          console.log('   - .book-stage-container computed transform:', openStageTransform);

          // During Phase 3 (Opened / Spread Hold at ~1300ms)
          await new Promise(r => setTimeout(r, 850));
          const spreadCoverTransform = await evaluate("getComputedStyle(document.querySelector('.book-front-cover')).getPropertyValue('transform')");
          const leftPageOpacity = await evaluate("getComputedStyle(document.querySelector('.inside-page-left')).getPropertyValue('opacity')");
          const rightPageOpacity = await evaluate("getComputedStyle(document.querySelector('.inside-page-right')).getPropertyValue('opacity')");
          const spreadBookClass = await evaluate("document.getElementById('tactile-book-trigger').className");
          const spreadOverlayClass = await evaluate("document.getElementById('entry-overlay').className");
          console.log('\nQ9/10/11 [DURING PHASE 3 - OPENED SPREAD AT 1300ms]:');
          console.log('   - #tactile-book-trigger className:', JSON.stringify(spreadBookClass));
          console.log('   - #entry-overlay className:', JSON.stringify(spreadOverlayClass));
          console.log('   - .book-front-cover computed transform:', spreadCoverTransform);
          console.log('   - .inside-page-left computed opacity:', leftPageOpacity);
          console.log('   - .inside-page-right computed opacity:', rightPageOpacity);

          // During Phase 4 (Entering / Zoom at ~2600ms)
          await new Promise(r => setTimeout(r, 1300));
          const enterStageTransform = await evaluate("getComputedStyle(document.querySelector('.book-stage-container')).getPropertyValue('transform')");
          const enterCoverOpacity = await evaluate("getComputedStyle(document.querySelector('.book-front-cover')).getPropertyValue('opacity')");
          const enterLeftOpacity = await evaluate("getComputedStyle(document.querySelector('.inside-page-left')).getPropertyValue('opacity')");
          const enterBookClass = await evaluate("document.getElementById('tactile-book-trigger').className");
          const enterOverlayClass = await evaluate("document.getElementById('entry-overlay').className");
          console.log('\nQ11/12 [DURING PHASE 4 - ENTERING ZOOM AT 2600ms]:');
          console.log('   - #tactile-book-trigger className:', JSON.stringify(enterBookClass));
          console.log('   - #entry-overlay className:', JSON.stringify(enterOverlayClass));
          console.log('   - .book-stage-container computed transform:', enterStageTransform);
          console.log('   - .book-front-cover computed opacity:', enterCoverOpacity);
          console.log('   - .inside-page-left computed opacity:', enterLeftOpacity);

          // Phase 6 Complete (at ~3800ms)
          await new Promise(r => setTimeout(r, 1200));
          const finalOverlayDisplay = await evaluate("getComputedStyle(document.getElementById('entry-overlay')).getPropertyValue('display')");
          const finalOverlayOpacity = await evaluate("getComputedStyle(document.getElementById('entry-overlay')).getPropertyValue('opacity')");
          const finalAppDisplay = await evaluate("getComputedStyle(document.getElementById('app')).getPropertyValue('display')");
          const finalAppVisibility = await evaluate("getComputedStyle(document.getElementById('app')).getPropertyValue('visibility')");
          const finalAppOpacity = await evaluate("getComputedStyle(document.getElementById('app')).getPropertyValue('opacity')");
          console.log('\n[PHASE 6 - COMPLETE AT 3800ms]:');
          console.log('   - #entry-overlay computed display:', finalOverlayDisplay, 'opacity:', finalOverlayOpacity);
          console.log('   - #app computed display:', finalAppDisplay, 'visibility:', finalAppVisibility, 'opacity:', finalAppOpacity);

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
