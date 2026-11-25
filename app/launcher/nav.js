(function () {
  'use strict';
  if (window.__DY_NAV__) return;
  window.__DY_NAV__ = 'v3';

  function goBack() {
    if (typeof window.__dyBack === 'function') { try { window.__dyBack(); return; } catch (e) {} }
    history.back();
  }

  function addBtn() {
    if (document.getElementById('__dy_back_btn')) return;
    var b = document.createElement('div');
    b.id = '__dy_back_btn';
    b.textContent = '\u2190';
    b.title = '返回上一个页面（Alt + ←）';
    b.style.cssText = [
      'position:fixed', 'left:12px', 'top:12px', 'width:32px', 'height:32px',
      'line-height:30px', 'text-align:center', 'font-size:19px', 'color:#fff',
      'background:rgba(20,20,20,.72)', 'border-radius:50%', 'cursor:pointer',
      'z-index:2147483647', 'opacity:0', 'transition:opacity .18s',
      'user-select:none', 'font-family:system-ui,sans-serif', 'pointer-events:auto',
      'box-shadow:0 2px 8px rgba(0,0,0,.35)'
    ].join(';');
    b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); goBack(); });
    b.addEventListener('mouseenter', function () { b.style.opacity = '.9'; });
    b.addEventListener('mouseleave', function () { b.style.opacity = '0'; });
    document.documentElement.appendChild(b);

    var timer = null;
    document.addEventListener('mousemove', function (e) {
      if (e.clientX < 90 && e.clientY < 90) {
        b.style.opacity = '.9';
        if (timer) { clearTimeout(timer); timer = null; }
      } else if (!timer && b.style.opacity !== '0') {
        timer = setTimeout(function () { b.style.opacity = '0'; timer = null; }, 1200);
      }
    }, true);
  }
  if (document.documentElement) addBtn(); else document.addEventListener('DOMContentLoaded', addBtn);

  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
  }, true);
})();
