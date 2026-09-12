/**
 * End-to-End Headless Edge CDP QA for Feature #4: Reading Insights UI
 */

import http from 'http';
import { spawn } from 'child_process';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple WebSocket client for CDP
class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new globalThis.WebSocket(this.wsUrl);
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (err) => reject(err));
      this.ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(msg.error);
          else cb.resolve(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      const msg = res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'CDP Evaluation Exception';
      throw new Error(msg);
    }
    return res.result?.value;
  }
}

async function getWsEndpoint(port = 9224) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const page = parsed.find((p) => p.url.includes('localhost:8000') || p.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runQA() {
  console.log('================ READING INSIGHTS BROWSER QA ================');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9224;

  const edgeProc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\fc23f026-09fd-424b-a43f-ef1178db2bd0\\scratch\\edge_qa_insights_profile',
    'http://localhost:8000'
  ]);

  let cdp;
  try {
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        wsUrl = await getWsEndpoint(cdpPort);
        if (wsUrl) break;
      } catch (e) {
        // waiting for browser to bind port
      }
    }

    if (!wsUrl) throw new Error('Could not connect to Edge DevTools port');

    cdp = new SimpleCDP(wsUrl);
    await cdp.connect();
    console.log('✓ Connected to Edge CDP session');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    await sleep(1500);

    // 1. Dismiss entry overlay
    await cdp.evaluate(`
      (function() {
        const skip = document.getElementById('entry-skip-btn');
        if (skip) skip.click();
        const overlay = document.getElementById('entry-overlay');
        if (overlay) overlay.style.display = 'none';
        const app = document.getElementById('app');
        if (app) app.classList.add('ready');
      })()
    `);
    await sleep(500);

    // 2. Test Empty State (No Reading History)
    console.log('\n--- 1. Testing Empty State (No Reading History) ---');
    await cdp.evaluate(`
      (function() {
        localStorage.removeItem('nook_reading_progress');
        localStorage.removeItem('nook_reading_progress_v2');
        const journalNav = document.querySelector('a[data-nav="journal"]');
        if (journalNav) journalNav.click();
      })()
    `);
    await sleep(500);

    // Switch to Reading Insights tab
    await cdp.evaluate(`
      (function() {
        const insightsTab = document.querySelector('.j-section-tab[data-jsection="insights"]');
        if (insightsTab) insightsTab.click();
      })()
    `);
    await sleep(500);

    const emptyStateInfo = await cdp.evaluate(`
      (function() {
        const emptyCard = document.querySelector('.empty-stationery-card');
        const heading = document.querySelector('.empty-heading')?.textContent?.trim();
        const browseBtn = document.querySelector('[data-action="browse-library"]');
        return {
          hasEmptyCard: !!emptyCard,
          heading,
          hasBrowseBtn: !!browseBtn
        };
      })()
    `);

    console.log('Empty state status:', emptyStateInfo);
    if (!emptyStateInfo.hasEmptyCard || !emptyStateInfo.heading?.includes('Reading Story Is Just Beginning')) {
      throw new Error('Empty state not displayed correctly when reading history is empty');
    }
    console.log('✓ Empty state successfully rendered');

    // Test clicking "Wander into the Library" from empty state
    await cdp.evaluate(`
      (function() {
        const browseBtn = document.querySelector('[data-action="browse-library"]');
        if (browseBtn) browseBtn.click();
      })()
    `);
    await sleep(400);

    const activeView = await cdp.evaluate(`
      document.querySelector('.view.active')?.id
    `);
    console.log('Active view after clicking browse:', activeView);
    if (activeView !== 'view-library') {
      throw new Error(`Expected view-library to be active, got ${activeView}`);
    }
    console.log('✓ "Wander into the library" navigation works');

    // 3. Test Populated Reading Insights (Multiple Books: Active & Completed)
    console.log('\n--- 2. Testing Populated Reading Insights ---');
    await cdp.evaluate(`
      (function() {
        const sampleHistory = {
          books: {
            'pride-and-prejudice': {
              bookId: 'pride-and-prejudice',
              progressPercent: 100,
              chapterNumber: 61,
              chapterTitle: 'Chapter 61',
              lastAccessedAt: 1789056000000,
              updatedAt: new Date(1789056000000).toISOString()
            },
            'frankenstein': {
              bookId: 'frankenstein',
              progressPercent: 95,
              chapterNumber: 24,
              chapterTitle: 'Chapter 24',
              lastAccessedAt: 1789057000000,
              updatedAt: new Date(1789057000000).toISOString()
            },
            'the-metamorphosis': {
              bookId: 'the-metamorphosis',
              progressPercent: 45,
              chapterNumber: 2,
              chapterTitle: 'Chapter 2',
              lastAccessedAt: 1789058000000,
              updatedAt: new Date(1789058000000).toISOString()
            },
            'dracula': {
              bookId: 'dracula',
              progressPercent: 20,
              chapterNumber: 5,
              chapterTitle: 'Chapter 5',
              lastAccessedAt: 1789059000000,
              updatedAt: new Date(1789059000000).toISOString()
            }
          },
          lastActiveBookId: 'dracula'
        };
        localStorage.setItem('nook_reading_progress_v2', JSON.stringify(sampleHistory));
        localStorage.setItem('nook_reading_progress', JSON.stringify(sampleHistory));

        const journalNav = document.querySelector('a[data-nav="journal"]');
        if (journalNav) journalNav.click();
      })()
    `);
    await sleep(500);

    // Switch to Reading Insights tab
    await cdp.evaluate(`
      (function() {
        const insightsTab = document.querySelector('.j-section-tab[data-jsection="insights"]');
        if (insightsTab) insightsTab.click();
      })()
    `);
    await sleep(500);

    const populatedInfo = await cdp.evaluate(`
      (function() {
        const stats = Array.from(document.querySelectorAll('.insights-stat-col')).map(c => ({
          num: c.querySelector('.stat-num')?.textContent?.trim(),
          label: c.querySelector('.stat-label')?.textContent?.trim()
        }));
        const catRows = Array.from(document.querySelectorAll('.category-bar-row')).map(r => ({
          name: r.querySelector('.category-name')?.textContent?.trim(),
          count: r.querySelector('.category-count')?.textContent?.trim()
        }));
        const shortest = document.querySelector('.length-book-item:first-child .length-book-title')?.textContent?.trim();
        const longest = document.querySelector('.length-book-item:last-child .length-book-title')?.textContent?.trim();
        const avgText = document.querySelector('.length-average-footer')?.textContent?.trim();
        const timelineGroups = Array.from(document.querySelectorAll('.timeline-period-block')).map(g => ({
          period: g.querySelector('.timeline-month-label')?.textContent?.trim(),
          booksCount: g.querySelectorAll('.timeline-book-item').length
        }));
        const recentCards = Array.from(document.querySelectorAll('.insights-recent-card')).map(c => ({
          title: c.querySelector('.recent-title')?.textContent?.trim(),
          progress: c.querySelector('.recent-progress-text')?.textContent?.trim()
        }));

        return {
          stats,
          catRows,
          shortest,
          longest,
          avgText,
          timelineGroups,
          recentCards
        };
      })()
    `);

    console.log('Populated Insights Summary:');
    console.log('  Overview Stats:', populatedInfo.stats);
    console.log('  Categories:', populatedInfo.catRows.slice(0, 3));
    console.log('  Shortest Book:', populatedInfo.shortest);
    console.log('  Longest Book:', populatedInfo.longest);
    console.log('  Average Length Footer:', populatedInfo.avgText);
    console.log('  Timeline Groups:', populatedInfo.timelineGroups);
    console.log('  Recent Cards:', populatedInfo.recentCards);

    // Assertions
    const exploredStat = populatedInfo.stats.find(s => s.label?.toLowerCase().includes('explored'));
    const inProgressStat = populatedInfo.stats.find(s => s.label?.toLowerCase().includes('progress'));
    const completedStat = populatedInfo.stats.find(s => s.label?.toLowerCase().includes('completed'));
    const completionRateStat = populatedInfo.stats.find(s => s.label?.toLowerCase().includes('completion'));

    if (exploredStat?.num !== '4') throw new Error(`Expected 4 explored books, got ${exploredStat?.num}`);
    if (inProgressStat?.num !== '2') throw new Error(`Expected 2 in progress books, got ${inProgressStat?.num}`);
    if (completedStat?.num !== '2') throw new Error(`Expected 2 completed books, got ${completedStat?.num}`);
    if (completionRateStat?.num !== '50%') throw new Error(`Expected 50% completion rate, got ${completionRateStat?.num}`);
    console.log('✓ Overview stats verified (4 explored, 2 in progress, 2 completed, 50% completion rate)');

    if (!populatedInfo.shortest?.includes('Metamorphosis')) {
      throw new Error(`Expected shortest book to be The Metamorphosis, got ${populatedInfo.shortest}`);
    }
    if (!populatedInfo.longest?.includes('Dracula')) {
      throw new Error(`Expected longest book to be Dracula, got ${populatedInfo.longest}`);
    }
    console.log('✓ Long & Short extreme volumes verified');

    if (populatedInfo.recentCards.length !== 4) {
      throw new Error(`Expected 4 recent cards, got ${populatedInfo.recentCards.length}`);
    }
    console.log('✓ Recent books shelf verified');

    // 4. Test Tab Switching Between Commonplace Book & Reading Insights
    console.log('\n--- 3. Testing Tab Switching ---');
    await cdp.evaluate(`
      (function() {
        const commonplaceTab = document.querySelector('.j-section-tab[data-jsection="commonplace"]');
        if (commonplaceTab) commonplaceTab.click();
      })()
    `);
    await sleep(400);

    const isCommonplaceActive = await cdp.evaluate(`
      !!document.querySelector('.journal-controls-bar') && !!document.querySelector('.journal-entries-stream')
    `);
    if (!isCommonplaceActive) throw new Error('Commonplace book stream not displayed on tab switch');
    console.log('✓ Commonplace Book tab displayed correctly');

    await cdp.evaluate(`
      (function() {
        const insightsTab = document.querySelector('.j-section-tab[data-jsection="insights"]');
        if (insightsTab) insightsTab.click();
      })()
    `);
    await sleep(400);

    const isInsightsActive = await cdp.evaluate(`
      !!document.querySelector('.insights-container') && !!document.querySelector('.insights-editorial-grid')
    `);
    if (!isInsightsActive) throw new Error('Reading Insights view not displayed on tab switch');
    console.log('✓ Reading Insights tab displayed correctly');

    // 5. Test Responsive Viewports (1280px, 1024px, 768px, 390px)
    console.log('\n--- 4. Testing Responsive Viewports & Horizontal Overflow ---');
    const viewports = [
      { width: 1280, height: 800, label: '1280px Desktop' },
      { width: 1024, height: 768, label: '1024px Small Desktop' },
      { width: 768, height: 1024, label: '768px Tablet' },
      { width: 390, height: 844, label: '390px Mobile' }
    ];

    for (const vp of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width <= 768
      });
      await sleep(300);

      const overflowCheck = await cdp.evaluate(`
        (function() {
          const overflowing = [];
          document.querySelectorAll('*').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > document.documentElement.clientWidth + 1 || el.scrollWidth > document.documentElement.clientWidth + 1) {
              overflowing.push({
                tag: el.tagName,
                id: el.id,
                class: el.className,
                clientWidth: el.clientWidth,
                scrollWidth: el.scrollWidth,
                rectRight: rect.right
              });
            }
          });
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            overflowing: overflowing.slice(0, 10)
          };
        })()
      `);

      console.log(`  Viewport ${vp.label}:`, overflowCheck);
      if (overflowCheck.hasOverflow) {
        console.error('Overflowing elements details:', overflowCheck.overflowing);
        throw new Error(`Horizontal overflow detected at ${vp.label}`);
      }
    }
    console.log('✓ Zero horizontal overflow across all responsive breakpoints');

    // 6. Test Book Details Click Navigation
    console.log('\n--- 5. Testing Book Click Navigation to Details ---');
    await cdp.evaluate(`
      (function() {
        const firstRecentCard = document.querySelector('.insights-recent-card');
        if (firstRecentCard) firstRecentCard.click();
      })()
    `);
    await sleep(500);

    const detailsViewStatus = await cdp.evaluate(`
      ({
        activeView: document.querySelector('.view.active')?.id,
        detailsTitle: document.querySelector('.details-title')?.textContent?.trim()
      })
    `);
    console.log('Details navigation status:', detailsViewStatus);
    if (detailsViewStatus.activeView !== 'view-details') {
      throw new Error(`Expected view-details to be active, got ${detailsViewStatus.activeView}`);
    }
    console.log('✓ Clicking book in Reading Insights opens Details page');

    console.log('\n================ ALL CDP QA TESTS PASSED ================');
  } finally {
    try {
      edgeProc.kill();
    } catch (e) {
      // process cleanup
    }
  }
}

runQA().catch((err) => {
  console.error('CDP QA Error:', err);
  process.exit(1);
});
