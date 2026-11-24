/* 保存当前作品 v3.1：内容选择面板 + 默认选项设置（齿轮）+ 六项资源 */
(function () {
  'use strict';
  var VERSION = '3.3';
  var btn = null, panel = null, settings = null, snap = null;

  var DEFAULTS = { media: true, music: false, cover: false, music_cover: false, avatar: false, text: false };
  var KEYS = ['media', 'music', 'cover', 'music_cover', 'avatar', 'text'];

  function normalize(o) {
    var out = {};
    KEYS.forEach(function (k) {
      out[k] = (o && typeof o[k] === 'boolean') ? o[k] : DEFAULTS[k];
    });
    return out;
  }
  var prefs = normalize(window.__DY_PREFS || null);

  function area(el) {
    var r = el.getBoundingClientRect();
    var w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    var h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    return w * h;
  }
  function descOf(el) {
    var scope = (el && el.closest && el.closest('[data-e2e="feed-item"]')) || document;
    var d = scope.querySelector('[data-e2e="video-desc"], [data-e2e="browse-video-desc"]');
    if (!d) d = document.querySelector('[data-e2e="video-desc"], [data-e2e="browse-video-desc"]');
    return d ? d.textContent.trim() : '';
  }

  /* ---- 作品上下文（v3.3）----
   * 规则：
   *  1) 候选必须属于当前路由：lastClick 带 pathname，切路由即失效。
   *  2) 播放器宿主 ID 优先取 <a href="/video/…">（渲染态），其次属性（可能被 React 复用后滞留）。
   *  3) 无 URL 作品标识、无作品浮层时，只接受"正在播放"的可见播放器 —— 隐藏/暂停的残留不算。
   *  4) 多源冲突又无权威来源 → 拒绝，绝不回退到旧上下文。
   */
  var lastClick = null;     // { id, ts, path }
  var lastPath = location.pathname;

  function idLike(s) { return /^\d{8,}$/.test(String(s || '')); }

  function attrsOf(el) {
    if (!el || !el.getAttribute) return '';
    var v = el.getAttribute('data-e2e-vid') || el.getAttribute('data-aweme-id') ||
            el.getAttribute('data-vid') || el.getAttribute('data-id');
    return idLike(v) ? String(v) : '';
  }

  function urlIds() {
    var out = [];
    var m = location.search.match(/[?&]modal_id=(\d{8,})/);
    if (m) out.push({ id: m[1], via: 'url:modal_id' });
    var p = location.pathname.match(/\/video\/(\d{8,})/) || location.pathname.match(/\/note\/(\d{8,})/);
    if (p) out.push({ id: p[1], via: 'url:path' });
    var v = location.search.match(/[?&]vid=(\d{8,})/);
    if (v) out.push({ id: v[1], via: 'url:vid' });
    return out;
  }

  /* 宿主：href 优先（渲染态更可信），attr 次之；两者不一致时用 href 并记录 */
  function hostOf(v) {
    var n = v, byHref = null, byAttr = null;
    for (var i = 0; i < 14 && n; i++) {
      if (!byAttr) { var a = attrsOf(n); if (a) byAttr = { id: a, el: n }; }
      if (!byHref && n.getAttribute) {
        var h = n.getAttribute('href');
        if (h) {
          var m = String(h).match(/\/video\/(\d{8,})/) || String(h).match(/[?&]modal_id=(\d{8,})/);
          if (m) byHref = { id: m[1], el: n };
        }
      }
      n = n.parentElement;
    }
    if (byHref) return { id: byHref.id, el: byHref.el, via: 'href', attrDisagree: (byAttr && byAttr.id !== byHref.id) ? byAttr.id : '' };
    return byAttr ? { id: byAttr.id, el: byAttr.el, via: 'attr', attrDisagree: '' } : null;
  }

  function onScreen(v) {
    var r = v.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return false;
    var w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    var h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    return (w * h) >= (r.width * r.height) * 0.3;
  }

  /* 只有"内部真的含播放器"的可见浮层才算作品浮层；登录弹窗等一律忽略 */
  function dialogScope() {
    var list = document.querySelectorAll('[role="dialog"], [data-e2e="video-detail"], [class*="modal"], [class*="Modal"]');
    for (var i = 0; i < list.length && i < 8; i++) {
      var d = list[i];
      var r = d.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (!d.querySelector('video')) continue;
      return d;
    }
    return null;
  }

  function resolveCurrent() {
    var out = { videos: document.querySelectorAll('video').length, candidates: [], chosen: null,
                conflict: false, note: '', page: location.pathname };

    if (location.pathname !== lastPath) {      // SPA 切路由：旧点击上下文立即作废
      lastPath = location.pathname;
      lastClick = null;
    }

    urlIds().forEach(function (c) { out.candidates.push({ id: c.id, via: c.via }); });
    var hasUrl = out.candidates.length > 0;

    var act = document.querySelector('[data-e2e="feed-active-video"][data-e2e-vid]');
    if (act) {
      var ar = act.getBoundingClientRect();
      if (ar.width > 0 && ar.height > 0) out.candidates.push({ id: act.getAttribute('data-e2e-vid'), via: 'feed-active-video' });
      else out.note = 'active-hidden';
    }

    var scope = dialogScope();
    var best = null, skipped = 0;
    [].slice.call((scope || document).querySelectorAll('video')).forEach(function (v) {
      if (!onScreen(v)) { skipped++; return; }
      var h = hostOf(v);
      if (!h) { skipped++; return; }
      var playing = !v.paused && !v.ended && v.currentTime > 0;
      /* 无 URL 标识、无浮层时：播放中的才算"当前作品"，否则视为残留播放器 */
      if (!hasUrl && !scope && !playing) { skipped++; return; }
      var a = area(v);
      var score = a + (playing ? 5e5 : 0);
      if (!best || score > best.score) {
        best = { id: h.id, via: (scope ? 'dialog-video' : (h.via === 'href' ? 'video-href' : 'video-attr')),
                 score: score, el: v, playing: playing, attrDisagree: h.attrDisagree };
      }
    });
    if (best) {
      out.candidates.push({ id: best.id, via: best.via });
      out.play = best.playing;
      if (best.attrDisagree) out.note = (out.note ? out.note + ';' : '') + 'attr-stale:' + best.attrDisagree;
    }
    out.bestEl = best ? best.el : null;
    out.scope = scope;
    out.skipped = skipped;

    if (lastClick && lastClick.path === location.pathname && Date.now() - lastClick.ts < 30000) {
      out.candidates.push({ id: lastClick.id, via: 'recent-click' });
    }

    var ids = [];
    out.candidates.forEach(function (c) { if (c.id && ids.indexOf(c.id) < 0) ids.push(c.id); });
    out.ids = ids;

    var PRI = { 'url:path': 100, 'url:modal_id': 96, 'url:vid': 94, 'dialog-video': 92,
                'feed-active-video': 85, 'video-href': 70, 'video-attr': 65, 'recent-click': 30 };
    var ranked = out.candidates.filter(function (c) { return c.id; }).sort(function (a, b) {
      return (PRI[b.via] || 0) - (PRI[a.via] || 0);
    });

    if (ids.length === 1) {
      out.chosen = { id: ids[0], via: (ranked[0] && ranked[0].via) || 'single' };
    } else if (ids.length > 1) {
      var top = ranked[0];
      var authoritative = top && (top.via.indexOf('url:') === 0 || top.via === 'dialog-video');
      if (authoritative) {
        out.chosen = { id: top.id, via: top.via };
        out.note = (out.note ? out.note + ';' : '') + 'dom-disagrees:' + ids.filter(function (x) { return x !== top.id; }).join(',');
      } else {
        /* 无权威来源 + 候选互相矛盾（典型：跨页面残留 vs 当前播放）→ 拒绝，不猜 */
        out.conflict = true;
        out.note = (out.note ? out.note + ';' : '') + 'multi:' + ids.join(',');
      }
    }
    return out;
  }

  document.addEventListener('click', function (e) {
    var n = e.target;
    for (var i = 0; i < 14 && n; i++) {
      var id = attrsOf(n);
      if (id) { lastClick = { id: id, ts: Date.now(), path: location.pathname }; return; }
      var href = n.getAttribute && n.getAttribute('href');
      if (href) {
        var m = String(href).match(/\/video\/(\d{8,})/) || String(href).match(/[?&]modal_id=(\d{8,})/);
        if (m) { lastClick = { id: m[1], ts: Date.now(), path: location.pathname }; return; }
      }
      n = n.parentElement;
    }
  }, true);

  function toast(msg, ms) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 18px;' +
      'background:rgba(20,20,20,.92);color:#fff;border-radius:10px;font:14px/1.5 system-ui;z-index:2147483647;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.45);pointer-events:none';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 2400);
  }
  function flash(txt) {
    if (!btn) return;
    btn.textContent = txt;
    setTimeout(function () { btn.textContent = '\u2B07'; }, 1600);
  }

  var OPTS = [
    { k: 'media', label: '视频 / 图文', hint: '原片 · 全部原图' },
    { k: 'music', label: '背景音乐', hint: '.mp3' },
    { k: 'cover', label: '视频封面', hint: '作品封面图' },
    { k: 'music_cover', label: '音乐封面', hint: '音乐封面图' },
    { k: 'avatar', label: '作者头像', hint: '头像图' },
    { k: 'text', label: '视频文案', hint: '.txt' }
  ];
  var LABEL = {};
  OPTS.forEach(function (o) { LABEL[o.k] = o.label; });

  function boxes(scope) {
    return scope ? [].slice.call(scope.querySelectorAll('input[type="checkbox"]')) : [];
  }
  function setAll(scope, v) { boxes(scope).forEach(function (b) { b.checked = v; }); }
  function readChecked(scope) {
    var o = {};
    boxes(scope).forEach(function (b) { o[b.getAttribute('data-k')] = b.checked; });
    return o;
  }
  function applyChecked(scope, obj) {
    boxes(scope).forEach(function (b) {
      var k = b.getAttribute('data-k');
      b.checked = typeof obj[k] === 'boolean' ? obj[k] : DEFAULTS[k];
    });
  }
  function selected() {
    return boxes(panel).filter(function (b) { return b.checked; }).map(function (b) { return b.getAttribute('data-k'); });
  }
  function closeSettings() { if (settings) settings.style.display = 'none'; }
  function close() { closeSettings(); if (panel) panel.style.display = 'none'; snap = null; }

  function mkBtn(text, primary, fn, parent, flex) {
    var b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'flex:' + (flex === undefined ? 1 : flex) + ';padding:7px 0;border:none;border-radius:8px;cursor:pointer;font:12px system-ui;' +
      (primary ? 'background:#fe2c55;color:#fff' : 'background:rgba(255,255,255,.13);color:#e8e8ea');
    b.addEventListener('mouseenter', function () { b.style.filter = 'brightness(1.18)'; });
    b.addEventListener('mouseleave', function () { b.style.filter = 'none'; });
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
    parent.appendChild(b);
    return b;
  }

  function row(o, scope) {
    var r = document.createElement('label');
    r.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;border-radius:8px;cursor:pointer';
    r.addEventListener('mouseenter', function () { r.style.background = 'rgba(255,255,255,.08)'; });
    r.addEventListener('mouseleave', function () { r.style.background = 'transparent'; });
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.setAttribute('data-k', o.k);
    cb.style.cssText = 'accent-color:#fe2c55;width:15px;height:15px;cursor:pointer';
    var t = document.createElement('span');
    t.innerHTML = '<span style="font-weight:500">' + o.label + '</span>' +
      '<span style="opacity:.45;font-size:11px;margin-left:6px">' + o.hint + '</span>';
    r.appendChild(cb); r.appendChild(t);
    scope.appendChild(r);
    return cb;
  }

  function buildSettings() {
    if (settings) return settings;
    settings = document.createElement('div');
    settings.style.cssText = 'position:fixed;right:282px;bottom:196px;width:236px;padding:12px 14px;' +
      'background:rgba(24,24,27,.96);border-radius:14px;color:#f2f2f3;font:13px/1.5 system-ui;' +
      'z-index:2147483647;box-shadow:0 10px 30px rgba(0,0,0,.55);display:none';

    var head = document.createElement('div');
    head.textContent = '默认下载选项';
    head.style.cssText = 'font-size:13px;font-weight:600;margin-bottom:6px;opacity:.92';
    settings.appendChild(head);

    OPTS.forEach(function (o) { row(o, settings); });

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;opacity:.45;margin-top:6px;line-height:1.4';
    hint.textContent = '修改后需点「保存默认选项」才会生效';
    settings.appendChild(hint);

    var r1 = document.createElement('div');
    r1.style.cssText = 'display:flex;gap:6px;margin-top:8px';
    mkBtn('保存默认选项', true, function () {
      var next = normalize(readChecked(settings));
      try {
        window.__dySetPrefs(JSON.stringify(next));
        prefs = next;
        toast('默认选项已保存');
        console.log('[DouyinSave] prefs saved ' + JSON.stringify(next));
      } catch (e) {
        console.log('[DouyinSave] prefs save fail ' + e.message);
        toast('保存失败');
      }
      closeSettings();
    }, r1, 1.4);
    settings.appendChild(r1);

    var r2 = document.createElement('div');
    r2.style.cssText = 'display:flex;gap:6px;margin-top:6px';
    mkBtn('恢复默认', false, function () {
      applyChecked(settings, DEFAULTS);
      hint.textContent = '已填入默认值，点「保存默认选项」后生效';
      hint.style.color = '#fe2c55';
    }, r2);
    mkBtn('取消', false, function () { closeSettings(); }, r2);
    settings.appendChild(r2);

    document.body.appendChild(settings);
    return settings;
  }

  function buildPanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;right:16px;bottom:196px;width:250px;padding:12px 14px;' +
      'background:rgba(18,18,20,.94);border-radius:14px;color:#f2f2f3;font:13px/1.5 system-ui;' +
      'z-index:2147483647;box-shadow:0 10px 30px rgba(0,0,0,.5);display:none';

    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px';
    var h = document.createElement('div');
    h.textContent = '选择下载内容';
    h.style.cssText = 'font-size:13px;font-weight:600;opacity:.92';
    var gear = document.createElement('div');
    gear.textContent = '\u2699';
    gear.title = '默认下载选项';
    gear.style.cssText = 'cursor:pointer;font-size:15px;opacity:.55;line-height:1;padding:2px 4px;border-radius:6px';
    gear.addEventListener('mouseenter', function () { gear.style.opacity = '1'; gear.style.background = 'rgba(255,255,255,.1)'; });
    gear.addEventListener('mouseleave', function () { gear.style.opacity = '.55'; gear.style.background = 'transparent'; });
    gear.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var s = buildSettings();
      if (s.style.display === 'block') { s.style.display = 'none'; return; }
      applyChecked(s, prefs);
      s.style.display = 'block';
    });
    head.appendChild(h); head.appendChild(gear);
    panel.appendChild(head);

    OPTS.forEach(function (o) { row(o, panel); });

    var r1 = document.createElement('div');
    r1.style.cssText = 'display:flex;gap:6px;margin-top:10px';
    mkBtn('全选', false, function () { setAll(panel, true); }, r1);
    mkBtn('全不选', false, function () { setAll(panel, false); }, r1);
    panel.appendChild(r1);

    var r2 = document.createElement('div');
    r2.style.cssText = 'display:flex;gap:6px;margin-top:6px';
    mkBtn('取消', false, function () { close(); }, r2);
    mkBtn('开始下载', true, function () {
      if (!snap) { close(); return; }
      var sel = selected();
      if (!sel.length) { toast('至少选择一项'); return; }
      var payload = JSON.stringify({
        task_id: snap.task_id,
        aweme_id: snap.aweme_id,
        via: snap.via,
        title: snap.title,
        captured_at: snap.captured_at,
        page_url: snap.page_url,
        selected: sel
      });
      console.log('[DouyinSave] submit task=' + snap.task_id + ' id=' + snap.aweme_id + ' selected=' + sel.join(','));
      try { window.__dySave(payload); flash('\u2026'); } catch (e) { console.log('[DouyinSave] binding fail ' + e.message); }
      close();
    }, r2);
    panel.appendChild(r2);

    document.body.appendChild(panel);
    return panel;
  }

  function openPanel() {
    var r = resolveCurrent();
    var log = '[DouyinSave] resolve page=' + r.page + ' videos=' + r.videos + ' ids=' + JSON.stringify(r.ids) + ' conflict=' + r.conflict + (r.note ? ' note=' + r.note : '') + ' scope=' + (r.scope ? 'dialog' : (r.bestEl ? 'player' : 'none')) + ' play=' + r.play + ' skipped=' + r.skipped;
    if (!r.chosen) {
      console.log(log + ' -> refused (cannot determine current aweme)');
      toast('无法确定当前作品（本页未检测到作品标识）');
      flash('\u2715');
      return;
    }
    snap = Object.freeze({
      task_id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      aweme_id: String(r.chosen.id),
      via: r.chosen.via,
      title: descOf(r.bestEl),
      captured_at: Date.now(),
      page_url: location.href
    });
    console.log(log + ' -> locked ' + snap.aweme_id + ' via ' + snap.via + ' task ' + snap.task_id);
    var p = buildPanel();
    applyChecked(p, prefs);
    closeSettings();
    p.style.display = 'block';
    console.log('[DouyinSave] panel open prefs=' + JSON.stringify(prefs));
  }

  function mount() {
    if (btn || !document.body) return;
    btn = document.createElement('div');
    btn.textContent = '\u2B07';
    btn.title = '保存当前作品（可选择内容）';
    btn.style.cssText = 'position:fixed;right:16px;bottom:150px;width:34px;height:34px;line-height:32px;text-align:center;' +
      'font-size:18px;color:#fff;background:rgba(30,30,30,.75);border-radius:50%;cursor:pointer;' +
      'z-index:2147483646;user-select:none;font-family:system-ui;box-shadow:0 2px 10px rgba(0,0,0,.4)';
    btn.addEventListener('mouseenter', function () { btn.style.background = 'rgba(254,44,85,.9)'; });
    btn.addEventListener('mouseleave', function () { btn.style.background = 'rgba(30,30,30,.75)'; });
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (panel && panel.style.display === 'block') { close(); return; }
      openPanel();
    });
    document.body.appendChild(btn);
    console.log('[DouyinSave] v' + VERSION + ' button mounted prefs=' + JSON.stringify(prefs));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
