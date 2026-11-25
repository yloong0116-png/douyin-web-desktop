const { chromium } = require(process.env.DY_PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ROOT = path.resolve(__dirname, '..', '..');
const PROFILE = process.env.DY_PROFILE || path.join(ROOT, 'profile');
const NAV = path.join(__dirname, 'nav.js');
const SCRIPTS = path.join(ROOT, 'app', 'userscripts');
const LOG = process.env.DY_LOG || path.join(ROOT, 'launcher.log');
const DEFAULT_SAVE_DIR = 'D:\\Media\\Douyin';
function resolveSaveDir() {
  try { const p = readPrefs(); if (p && p.saveDir) return p.saveDir; } catch (e) {}
  return process.env.DY_SAVE_DIR || DEFAULT_SAVE_DIR;
}
const PARSE_API = 'https://parse.rcuts.com:8443/v1/parse';
const WEB = 'https://www.douyin.com/?recommend=1';
const UA_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 aweme_8.3.1 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/zh Region/CN';
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const log = (m) => { try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} };

// 默认下载选项：独立配置文件，缺失/损坏都回退到内置默认值
const PREFS_FILE = path.join(path.dirname(LOG), 'download-preferences.json');
const PREF_KEYS = ['media', 'music', 'cover', 'music_cover', 'avatar', 'text'];
const PREF_DEFAULTS = { media: true, music: false, cover: false, music_cover: false, avatar: false, text: false };

function normalizePrefs(j) {
  const out = {};
  for (const k of PREF_KEYS) out[k] = (j && typeof j[k] === 'boolean') ? j[k] : PREF_DEFAULTS[k];
  if (j && typeof j.saveDir === 'string' && j.saveDir.trim()) out.saveDir = j.saveDir.trim();
  return out;
}
function readPrefs() {
  try {
    const raw = fs.readFileSync(PREFS_FILE, 'utf8');
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object') throw new Error('not an object');
    return normalizePrefs(j);
  } catch (e) {
    if (e.code !== 'ENOENT') log('prefs: read fallback (' + e.message + ')');
    return normalizePrefs(null);
  }
}
function writePrefs(p) {
  try {
    fs.mkdirSync(path.dirname(PREFS_FILE), { recursive: true });
    fs.writeFileSync(PREFS_FILE, JSON.stringify(p, null, 2), 'utf8');
    return true;
  } catch (e) { log('prefs: write failed ' + e.message); return false; }
}

function scriptList() {
  try {
    return fs.readdirSync(SCRIPTS).filter(f => f.endsWith('.js')).sort().map(f => path.join(SCRIPTS, f));
  } catch (e) { log('SCRIPTS read fail ' + e.message); return []; }
}

function runAtOf(file) {
  try {
    const head = fs.readFileSync(file, 'utf8');
    const m = head.match(/@run-at\s+(\S+)/);
    return m ? m[1] : 'document-idle';
  } catch (e) { return 'document-idle'; }
}

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: false, viewport: null,
    ignoreDefaultArgs: ['--no-sandbox', '--enable-automation'],
    args: ['--app=data:text/html,<body style=background:%230f0f10>', '--start-maximized', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--exclude-switches=enable-automation']
  });

  await ctx.addInitScript({
    content: `(() => {
      try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (e) {}
      try {
        if (!window.chrome) window.chrome = {};
        if (!window.chrome.runtime) window.chrome.runtime = {};
      } catch (e) {}
    })();`
  });

  // 把默认选项注入页面，面板首次打开即可同步拿到
  const prefs = readPrefs();
  log('prefs: loaded ' + JSON.stringify(prefs));
  await ctx.addInitScript({ content: 'window.__DY_PREFS = ' + JSON.stringify(prefs) + ';' });
  await ctx.addInitScript({ content: 'window.__DVD_SAVE_DIR = ' + JSON.stringify(resolveSaveDir()) + ';' });

  const scripts = scriptList();
  const early = [], late = [];
  for (const p of scripts) {
    const isBase = path.basename(p).startsWith('00-');
    (isBase || runAtOf(p) === 'document-start' ? early : late).push(p);
  }
  // early 批次合并成一个有序块注入：不依赖多次 addInitScript 之间的调用顺序，
  // 且 00- 前缀（GM Shim / Vue）一定排在依赖它的脚本之前。
  const earlyCode = early.map(p => {
    let code = '';
    try { code = fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
    return '(function(){try{\n' + code + '\n; }catch(e){console.error("[inject early] ' + path.basename(p) + '",e)}})();';
  }).join('\n');
  await ctx.addInitScript({ content: '(function(){try{\n' + earlyCode + '\n}catch(e){console.error("[inject] early block error",e)}})();' });

  if (late.length) {
    const body = late.map(p => {
      let code = '';
      try { code = fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
      return '(function(){try{\n' + code + '\n; }catch(e){console.error("[inject late] ' + path.basename(p) + '",e)}})();';
    }).join('\n');
    await ctx.addInitScript({
      content: '(function(){function __run(){try{\n' + body +
        '\n}catch(e){console.error("[inject] late error",e)}}' +
        'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",__run,{once:true})}else{__run()}})();'
    });
  }
  log('init: nav + early[' + early.map(p => path.basename(p)).join(',') + '] late[' + late.map(p => path.basename(p)).join(',') + ']');

  await ctx.addInitScript({ path: NAV });


  const sanitize = (s) => String(s || '').replace(/[\\/:*?"<>|\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const extOf = (u) => { const m = String(u).split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i); return m ? '.' + m[1].toLowerCase().replace('jpeg', 'jpg') : '.jpg'; };

  const download = async (u, file, referer) => {
    const r = await fetch(u, { headers: { 'Referer': referer || 'https://www.douyin.com/', 'User-Agent': UA_PC } });
    if (!r.ok) throw new Error('http ' + r.status);
    const b = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(file, b);
    return b.length;
  };

  const parseOnce = async (awemeId, quality) => {
    const r = await fetch(PARSE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA_IOS },
      body: JSON.stringify({ url: 'https://www.douyin.com/video/' + awemeId, sv: '1', client: 'ios-shortcut', quality: quality || 'all' })
    });
    const j = await r.json().catch(() => null);
    if (!j) return { err: 'invalid json' };
    if (j.code !== 0 || !j.data) return { err: 'code=' + j.code + ' ' + (j.msg || '') };
    return { data: j.data };
  };

  const topQuality = (ql) => String(ql || '').split('|').map(s => s.trim()).filter(Boolean)[0] || '';

  // 保存默认选项（只影响下次打开面板的初始勾选，不影响正在进行的任务）
  await ctx.exposeBinding('__dySetPrefs', async (source, payload) => {
    try {
      const j = JSON.parse(payload || '{}');
      const next = normalizePrefs(j);
      const ok = writePrefs(next);
      for (const k of PREF_KEYS) prefs[k] = next[k];
      log('[DouyinSave] prefs saved ok=' + ok + ' ' + JSON.stringify(next));
    } catch (e) { log('[DouyinSave] prefs save fail ' + e.message); }
  });

  // 下载：以点击瞬间锁定的快照为唯一依据，解析结果必须与快照 ID 一致
  await ctx.exposeBinding('__dySave', async (source, payload) => {
    let snap = {};
    try { snap = JSON.parse(payload || '{}'); } catch (e) {}
    const T = '[DouyinSave] task=' + (snap.task_id || '?');
    try {
      const id = String(snap.aweme_id || '');
      log(T + ' click id=' + id + ' via=' + snap.via + ' captured=' + new Date(snap.captured_at || Date.now()).toISOString());
      if (!/^\d{8,}$/.test(id)) { log(T + ' refuse: invalid aweme_id "' + id + '"'); return; }

      let r = await parseOnce(id, 'all');
      if (r.err) { log(T + ' parse(all) failed: ' + r.err); return; }
      let d = r.data;
      const gotId = String(d.id || '');
      log(T + ' parse -> id=' + gotId + ' type=' + d.type + ' quality=' + d.quality + ' list=' + d.quality_list);
      if (gotId && gotId !== id) {
        log(T + ' ABORT: parsed id ' + gotId + ' != locked ' + id);
        return;
      }
      if (!gotId) { log(T + ' WARN: parse response has no id, cannot verify identity'); }

      const top = topQuality(d.quality_list);
      if (top && d.quality !== top) {
        const r2 = await parseOnce(id, top);
        if (!r2.err && String(r2.data.id || '') === id) { d = r2.data; log(T + ' upgraded to ' + top); }
        else log(T + ' upgrade to ' + top + ' skipped');
      }

      const title = String(d.title || d.desc || snap.title || 'douyin').trim();
      const base = sanitize(title) || 'douyin';
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const dir = resolveSaveDir();
      fs.mkdirSync(dir, { recursive: true });

      const files = [];
      const type = String(d.type || '').toLowerCase();
      const seen = Object.create(null);
      const imgs = (d.medias || [])
        .filter(m => m && m.type === 'image' && m.url)
        .map((m, i) => ({ url: m.url, index: typeof m.index === 'number' ? m.index : i }))
        .sort((a, b) => a.index - b.index)
        .filter(m => (seen[m.url] ? false : (seen[m.url] = 1, true)));

      const sel = Array.isArray(snap.selected) && snap.selected.length ? snap.selected : [];
      const job = [];
      if (sel.indexOf('media') >= 0) {
        if (type !== 'video' && imgs.length) {
          imgs.forEach((m, i) => job.push({ k: 'media', url: m.url, ext: '.jpg', seq: i + 1 }));
          log(T + ' type=image count=' + imgs.length);
        } else {
          const vUrl = d.video || ((d.medias || [])[0] && d.medias[0].url) || '';
          if (vUrl) job.push({ k: 'media', url: vUrl, ext: '.mp4', seq: 0 });
          else log(T + ' media missing in response');
        }
      }
      const musicUrl = (d.music && d.music.url) || d.audio || '';
      if (sel.indexOf('music') >= 0) {
        if (musicUrl) job.push({ k: 'music', url: musicUrl, ext: '.mp3', seq: 0 });
        else log(T + ' music missing in response');
      }
      if (sel.indexOf('cover') >= 0) {
        if (d.cover) job.push({ k: 'cover', url: d.cover, ext: extOf(d.cover), tag: '_cover', seq: 0 });
        else log(T + ' cover missing in response');
      }
      if (sel.indexOf('music_cover') >= 0) {
        const mc = (d.music && d.music.cover) || '';
        if (mc) job.push({ k: 'music_cover', url: mc, ext: extOf(mc), tag: '_music_cover', seq: 0 });
        else log(T + ' music_cover missing in response');
      }
      if (sel.indexOf('avatar') >= 0) {
        const av = (d.author && d.author.avatar) || '';
        if (av) job.push({ k: 'avatar', url: av, ext: extOf(av), tag: '_avatar', seq: 0 });
        else log(T + ' avatar missing in response');
      }
      const wantsText = sel.indexOf('text') >= 0 && !!title;
      if (!job.length && !wantsText) { log(T + ' nothing to download for selection [' + sel.join(',') + ']'); return; }

      // 同秒同标题的不同作品会撞名：自动加序号，绝不覆盖
      let stem = base + '_' + stamp;
      for (let k = 0; k < 100; k++) {
        const cand = k === 0 ? stem : stem + '_' + k;
        const probe = path.join(dir, cand + (type !== 'video' && imgs.length ? '_01.jpg' : '.mp4'));
        if (!fs.existsSync(probe)) { stem = cand; break; }
      }

      for (const item of job) {
        const name = stem + (item.seq ? '_' + String(item.seq).padStart(2, '0') : '') + (item.tag || '') + item.ext;
        try {
          const n = await download(item.url, path.join(dir, name), 'https://www.douyin.com/');
          files.push(name + ' (' + n + 'B)');
          log(T + ' ok ' + item.k + ' -> ' + name);
        } catch (e) {
          log(T + ' fail ' + item.k + ' ' + e.message);
        }
      }

      if (sel.indexOf('text') >= 0 && title) {
        try {
          fs.writeFileSync(path.join(dir, stem + '.txt'), title + '\n', 'utf8');
          files.push(stem + '.txt');
          log(T + ' ok text -> ' + stem + '.txt');
        } catch (e) { log(T + ' fail text ' + e.message); }
      } else if (sel.indexOf('text') >= 0 && !title) {
        log(T + ' text skipped: empty description');
      }
      log(T + ' DONE files=' + files.length + ' :: ' + files.join(' | '));
    } catch (e) {
      log(T + ' FAILED: ' + e.message);
    }
  });

  const main = ctx.pages()[0];
  let docLoads = 0;
  main.on('framenavigated', (f) => { try { if (f === main.mainFrame()) log('[nav] ' + f.url().slice(0, 70)); } catch (e) {} });
  main.on('load', () => { docLoads++; log('[life] document load #' + docLoads); });
  let stack = [main];
  let errCount = 0;

  const watch = (pg) => {
    try {
      pg.on('console', (m) => {
        const t = m.text();
        if (m.type() === 'error' && errCount < 40) { errCount++; log('console: ' + t.slice(0, 180)); }
        else if (t.indexOf('[DouyinSave]') === 0 || t.indexOf('[inject') === 0) log('console: ' + t.slice(0, 400));
      });
    } catch (e) {}
  };
  watch(main);

  const clean = () => { stack = stack.filter(p => { try { return !p.isClosed(); } catch (e) { return false; } }); if (!stack.length) stack = [main]; };

  // 选择保存目录（Windows 原生文件夹对话框）
  await ctx.exposeBinding('__dyPickDir', async () => {
    const { execFile } = require('child_process');
    const cur = resolveSaveDir().replace(/'/g, "''");
    const ps = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$f = New-Object System.Windows.Forms.FolderBrowserDialog',
      "$f.Description = '选择抖音下载保存位置'",
      "$f.SelectedPath = '" + cur + "'",
      '$f.ShowNewFolderButton = $true',
      'if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }'
    ].join('\n');
    return await new Promise((resolve) => {
      execFile('powershell', ['-NoProfile', '-STA', '-Command', ps], { windowsHide: true, timeout: 120000 }, (err, stdout) => {
        const p = String(stdout || '').trim();
        log('[dir] pick -> ' + (p || '(cancelled)'));
        resolve(p || null);
      });
    });
  });

  // 校验可写并持久化
  await ctx.exposeBinding('__dySetDir', async (source, dirInput) => {
    const p = String(dirInput || '').trim();
    if (!p) return { ok: false, err: 'empty' };
    try {
      fs.mkdirSync(p, { recursive: true });
      fs.accessSync(p, fs.constants.W_OK);
      const probe = path.join(p, '.dy-write-test-' + Date.now());
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
    } catch (e) {
      log('[dir] invalid ' + p + ' ' + (e.code || e.message));
      return { ok: false, err: e.code || e.message };
    }
    const next = readPrefs();
    next.saveDir = p;
    const ok = writePrefs(next);
    log('[dir] saved ' + p + ' ok=' + ok);
    return ok ? { ok: true, dir: p } : { ok: false, err: 'write prefs failed' };
  });

  await ctx.exposeBinding('__dyBack', async (source) => {
    clean();
    if (stack.length > 1) {
      stack.pop();
      const prev = stack[stack.length - 1];
      try { await prev.bringToFront(); } catch (e) { log('front ' + e.message); }
      return true;
    }
    try { await source.page.evaluate(() => history.back()); } catch (e) {}
    return false;
  });

  await main.goto(WEB, { waitUntil: 'commit', timeout: 45000 }).catch(e => log('goto fail ' + e.message));

  // 诊断模式：%LOCALAPPDATA%\DouyinApp\diag.on 存在时 dump 播放器/容器结构
  const DIAG = path.join(path.dirname(LOG), 'diag.on');
  if (fs.existsSync(DIAG)) {
    setTimeout(async () => {
      try {
        const dump = await main.evaluate(() => {
          const R = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
          const vs = [].slice.call(document.querySelectorAll('video'));
          return {
            url: location.href,
            count: vs.length,
            info: vs.slice(0, 6).map((v, i) => {
              var host = v; for (var k = 0; k < 10 && host; k++) { if (host.getAttribute && host.getAttribute('data-e2e-vid')) break; host = host.parentElement; }
              return { i: i, vid: host && host.getAttribute ? host.getAttribute('data-e2e-vid') : '', e2e: host && host.getAttribute ? host.getAttribute('data-e2e') : '', paused: v.paused, t: Math.round(v.currentTime * 10) / 10, rect: R(v) };
            })
          };
        });
        log('[DouyinSave] DIAG ' + JSON.stringify(dump).slice(0, 3000));
        // 自动验收：模拟点击保存按钮，走与用户完全相同的一条链路
        await new Promise(r => setTimeout(r, 2000));
        const clicked = await main.evaluate(() => {
          const bs = [].slice.call(document.querySelectorAll('div')).filter(d => d.textContent === '\u2B07');
          if (!bs.length) return 0;
          bs[0].click();
          return bs.length;
        });
        log('[DouyinSave] DIAG auto-click buttons=' + clicked);
        // 第二轮：切到下一条后再点一次，验证两个任务互不干扰、各自锁对作品
        await new Promise(r => setTimeout(r, 3500));
        await main.evaluate(() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true }));
          window.scrollBy(0, window.innerHeight);
        });
        await new Promise(r => setTimeout(r, 5000));
        const c2 = await main.evaluate(() => {
          const bs = [].slice.call(document.querySelectorAll('div')).filter(d => d.textContent === '\u2B07');
          if (!bs.length) return 0;
          bs[0].click();
          return 1;
        });
        log('[DouyinSave] DIAG second-click=' + c2);
      } catch (e) { log('[DouyinSave] DIAG fail ' + e.message); }
    }, 14000);
  }

  ctx.on('page', async (np) => {
    if (np === main) return;
    watch(np);
    try { await np.waitForLoadState('domcontentloaded', { timeout: 15000 }); } catch (e) {}
    clean();
    if (stack.indexOf(np) === -1) stack.push(np);
    try { await np.bringToFront(); } catch (e) { log('front2 ' + e.message); }
  });

  ctx.on('close', () => process.exit(0));
  const b = ctx.browser && ctx.browser();
  if (b) b.on('disconnected', () => process.exit(0));
  setInterval(() => {}, 1 << 30);
})().catch(e => { log('BOOT ' + e.message); process.exit(1); });
