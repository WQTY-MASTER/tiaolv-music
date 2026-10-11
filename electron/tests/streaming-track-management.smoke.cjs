// Browser fixture only: never writes to a real music account. Requires running Vite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tiaolv-track-smoke-'));
  const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--remote-debugging-port=9232', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, 'about:blank'
  ], { windowsHide: true, stdio: 'ignore' });
  let ws;
  try {
    let version;
    for (let i = 0; i < 60; i++) { try { version = await (await fetch('http://127.0.0.1:9232/json/version')).json(); break; } catch { await pause(100); } }
    if (!version) throw Error('Chrome debugger did not start');
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let sequence = 0;
    const pending = new Map();
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (request) { clearTimeout(request.timer); pending.delete(message.id); message.error ? request.reject(Error(message.error.message)) : request.resolve(message.result); }
      if (message.method === 'Fetch.requestPaused') {
        void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
          responseHeaders: [{name:'Content-Type',value:'text/html'}], body: Buffer.from('<html><body style="margin:0;background:#f5f5f8"><div id="fixture"></div></body></html>').toString('base64') }, message.sessionId);
      }
    });
    const { browserContextId } = await send('Target.createBrowserContext');
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const cdp = (method, params) => send(method, params, sessionId);
    await cdp('Page.enable');
    await cdp('Fetch.enable', { patterns: [{ resourceType: 'Document', requestStage: 'Request' }] });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.navigate', { url: process.env.TRACK_TEST_URL || 'http://127.0.0.1:5173' });
    await pause(300);
    const evaluate = async expression => {
      const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await evaluate(String.raw`(async()=>{
      const entry = await (await fetch('/src/main.ts')).text();
      const vueUrl = entry.match(/from ["']([^"']*vue[^"']*)["']/)[1];
      const {createApp,reactive,nextTick} = await import(vueUrl);
      const Component = (await import('/src/components/StreamingDailyMixPage.vue')).default;
      window.events=[]; window.tick=nextTick;
      window.fixture=reactive({tracks:['a','b','c'].map((id,i)=>({id,title:'歌曲'+id,artist:'歌手',album:'专辑',duration:180,liked:true,primary:'#aac',secondary:'#789',mark:id})),providerName:'QQ 音乐',currentTrackId:'',isPlaying:false,title:'测试歌单',reorderable:true,batchMode:'favorites',
        runBatch:async(action,ids)=>{events.push(['batch',action,ids]);await new Promise(r=>window.finishBatch=r);return {succeeded:ids.filter(id=>id!=='b'),failed:ids.filter(id=>id==='b')};},
        onPlay:id=>events.push(['play',id]),onReorder:(a,b)=>events.push(['order',a,b])});
      createApp(Component,fixture).mount('#fixture');await nextTick();
    })()`);
    const point = id => evaluate(`(()=>{const r=document.querySelector('[data-track-id="${id}"]').getBoundingClientRect();return {x:r.x+250,y:r.y+r.height/2}})()`);
    const mouse = (type, p) => cdp('Input.dispatchMouseEvent', {type,...p,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,clickCount:1});
    const a = await point('a'), b = await point('b');
    await mouse('mousePressed',a); await pause(520); await mouse('mouseMoved',b); await mouse('mouseReleased',b); await pause(50);
    assert.deepEqual(await evaluate('events'), [['order','a','b']], 'long press emits order once and never plays');
    await evaluate('events=[]'); await pause(450);
    await mouse('mousePressed',a); await mouse('mouseMoved',b); await pause(520); await mouse('mouseReleased',b);
    assert.equal((await evaluate('events')).some(event=>event[0]==='order'), false, 'moving before hold cancels reorder');
    await evaluate(`document.querySelector('.daily-track-management button').click()`);
    await evaluate(`document.querySelector('.daily-track-management input').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('.daily-detail-index input:checked').length`), 3);
    await evaluate(`Array.from(document.querySelectorAll('.daily-track-management button')).find(b=>b.textContent==='取消喜欢').click()`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.daily-track-management button')).every(b=>b.disabled)`), true, 'busy blocks repeated writes');
    await evaluate('finishBatch()');
    await pause(160);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.daily-detail-row')).filter(r=>r.querySelector('input:checked')).map(r=>r.dataset.trackId)`), ['b'], 'only failed tracks remain selected');
    assert.match(await evaluate(`document.querySelector('.daily-track-management').textContent`), /成功 2 首，失败 1 首/);
    await evaluate(`events=[];const input=document.querySelector('.daily-detail-filter-search input');input.value='歌曲b';input.dispatchEvent(new Event('input',{bubbles:true}));`);
    await pause(50);
    await evaluate(`Array.from(document.querySelectorAll('.daily-track-management button')).find(b=>b.textContent==='取消喜欢').click()`);
    await evaluate('finishBatch()');
    await pause(150);
    assert.deepEqual(await evaluate(`events.filter(e=>e[0]==='batch')`), [['batch','unlike',['b']]], 'filtered actions submit visible selection only');
    await send('Target.disposeBrowserContext', { browserContextId });
    await send('Browser.close');
    console.log('Browser track management: long press, early cancellation, no accidental playback, selection, partial failure, filtering, duplicate write lock passed');
  } finally {
    ws?.close(); chrome.kill(); await pause(250);
    const resolved = path.resolve(profile);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('tiaolv-track-smoke-')) {
      try { fs.rmSync(resolved, { recursive:true, force:true }); } catch { /* Chrome may retain a file briefly. */ }
    }
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
