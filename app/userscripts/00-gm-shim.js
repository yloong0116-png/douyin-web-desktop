/* GM_* 兼容层：让 Tampermonkey 用户脚本能直接在启动器里注入运行（无需安装扩展） */
(function () {
  'use strict';
  if (window.__GM_SHIM__) return;
  window.__GM_SHIM__ = '1.1';

  var P = 'gmshim:';

  function GM_getValue(k, d) {
    try { var v = localStorage.getItem(P + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function GM_setValue(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} }
  function GM_deleteValue(k) { try { localStorage.removeItem(P + k); } catch (e) {} }
  function GM_listValues() {
    var r = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(P) === 0) r.push(k.slice(P.length));
      }
    } catch (e) {}
    return r;
  }
  function GM_addStyle(css) {
    var s = document.createElement('style');
    s.textContent = String(css);
    (document.head || document.documentElement).appendChild(s);
    return s;
  }
  function GM_setClipboard(t) { try { navigator.clipboard.writeText(String(t)); } catch (e) {} }
  function GM_xmlhttpRequest(o) {
    var aborted = false;
    var ctl = { abort: function () { aborted = true; } };
    var opts = { method: o.method || 'GET', headers: o.headers || {} };
    if (o.data) opts.body = o.data;
    if (o.responseType === 'blob') {
      fetch(o.url, opts).then(function (r) { return r.blob(); })
        .then(function (b) { if (!aborted && o.onload) o.onload({ status: 200, response: b, responseText: '', finalUrl: o.url }); })
        .catch(function (e) { if (!aborted && o.onerror) o.onerror(e); });
    } else {
      fetch(o.url, opts)
        .then(function (r) { return r.text().then(function (t) { return { r: r, t: t }; }); })
        .then(function (x) {
          if (aborted) return;
          if (o.onload) o.onload({ status: x.r.status, statusText: x.r.statusText, responseText: x.t, response: x.t, finalUrl: x.r.url });
        })
        .catch(function (e) { if (!aborted && o.onerror) o.onerror(e); });
    }
    return ctl;
  }

  var menu = [];
  window.__GM_MENU__ = menu;
  var btn = null, panel = null, btnTimer = null;

  // 左上角竖直排布：返回键 (12,12) 由 nav.js 提供，菜单键放在它正下方，两者都在鼠标靠近时才淡入，
  // 平时完全隐藏，不遮挡抖音自己的 logo 和侧栏。
  var ZONE_X = 90, ZONE_Y = 170;

  function showBtn(on) {
    if (!btn) return;
    if (on) {
      btn.style.opacity = '.9';
      if (btnTimer) { clearTimeout(btnTimer); btnTimer = null; }
    } else if (!btnTimer) {
      btnTimer = setTimeout(function () { btn.style.opacity = '0'; btnTimer = null; }, 1200);
    }
  }

  function renderPanel() {
    if (!panel) {
      panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;left:12px;top:94px;min-width:180px;max-width:320px;padding:6px;' +
        'background:rgba(20,20,20,.92);color:#fff;border-radius:10px;font:13px/1.6 system-ui,sans-serif;' +
        'z-index:2147483647;box-shadow:0 4px 16px rgba(0,0,0,.45);display:none';
      (document.documentElement).appendChild(panel);
    }
    panel.textContent = '';
    if (!menu.length) {
      var e = document.createElement('div');
      e.textContent = '（无脚本菜单）';
      e.style.cssText = 'padding:4px 8px;opacity:.6';
      panel.appendChild(e);
    }
    menu.forEach(function (m) {
      var it = document.createElement('div');
      it.textContent = m.name;
      it.style.cssText = 'padding:5px 8px;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      it.addEventListener('mouseenter', function () { it.style.background = 'rgba(255,255,255,.14)'; });
      it.addEventListener('mouseleave', function () { it.style.background = 'transparent'; });
      it.addEventListener('click', function (ev) {
        ev.stopPropagation();
        panel.style.display = 'none';
        try { m.fn(); } catch (err) { console.warn('[gm-shim] menu error', err); }
      });
      panel.appendChild(it);
    });
  }

  function ensureButton() {
    if (btn) return;
    btn = document.createElement('div');
    btn.textContent = '\u2699';
    btn.title = '脚本菜单';
    btn.style.cssText = 'position:fixed;left:12px;top:54px;width:32px;height:32px;line-height:30px;text-align:center;' +
      'font-size:17px;color:#fff;background:rgba(20,20,20,.72);border-radius:50%;cursor:pointer;' +
      'z-index:2147483647;user-select:none;font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);' +
      'opacity:0;transition:opacity .18s';
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      renderPanel();
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });
    btn.addEventListener('mouseenter', function () { showBtn(true); });
    (document.documentElement).appendChild(btn);
    document.addEventListener('mousemove', function (e) {
      showBtn(e.clientX < ZONE_X && e.clientY < ZONE_Y);
    }, true);
  }

  function renderMenu() {
    if (!menu.length) return;
    if (document.documentElement) ensureButton(); else document.addEventListener('DOMContentLoaded', ensureButton);
    if (panel && panel.style.display === 'block') renderPanel();
  }

  function GM_registerMenuCommand(name, fn) { menu.push({ id: name, name: name, fn: fn }); renderMenu(); return name; }
  function GM_unregisterMenuCommand(id) {
    for (var i = menu.length - 1; i >= 0; i--) if (menu[i].id === id) menu.splice(i, 1);
    if (panel && panel.style.display === 'block') renderPanel();
  }

  function GM_notification(o) { try { console.log('[gm-shim] notify:', typeof o === 'string' ? o : (o && o.text)); } catch (e) {} }
  function GM_openInTab(u) { return window.open(u, '_blank'); }
  function GM_log() { try { console.log.apply(console, ['[GM]'].concat([].slice.call(arguments))); } catch (e) {} }

  Object.assign(window, {
    GM_getValue: GM_getValue,
    GM_setValue: GM_setValue,
    GM_deleteValue: GM_deleteValue,
    GM_listValues: GM_listValues,
    GM_addStyle: GM_addStyle,
    GM_setClipboard: GM_setClipboard,
    GM_xmlhttpRequest: GM_xmlhttpRequest,
    GM_registerMenuCommand: GM_registerMenuCommand,
    GM_unregisterMenuCommand: GM_unregisterMenuCommand,
    GM_notification: GM_notification,
    GM_openInTab: GM_openInTab,
    GM_log: GM_log,
    GM_info: { script: { name: 'injected', version: '1.0' }, scriptHandler: 'launcher', version: '1.0' },
    unsafeWindow: window
  });
})();
