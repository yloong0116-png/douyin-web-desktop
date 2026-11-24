/* 左侧导航：原生样式 + 只隐藏四个入口（v2.0）
 *
 * 与 v1.3 的区别：不注入任何 CSS、不加悬浮定位、不改宽度/内边距/圆角/背景/
 * 阴影/backdrop-filter、不改图标与文字、不动 title/aria-label、不跟随 video 定位、
 * 不压缩左侧布局列。只做一件事：把 AI抖音 / 放映厅 / 短剧 / 小游戏 隐藏。
 *
 * 定位依据（实测）：从可见的「精选」锚点向上找到同时满足
 *   子元素数 ≥ 8 且文本包含 ≥ 8 个导航名的祖先 = 导航容器；
 * 再在其直接子元素中按文本精确匹配四个待隐藏入口。
 */
(function () {
  'use strict';
  if (window.top !== window.self) return;

  var DROP = ['AI抖音', '放映厅', '短剧', '小游戏'];
  var ALL = ['精选', '推荐', 'AI抖音', '关注', '朋友', '我的', '直播', '放映厅', '短剧', '小游戏'];
  var MARK = 'data-dy-hidden';

  function hide(it) {
    if (it.getAttribute(MARK) === '1') return;
    it.setAttribute(MARK, '1');
    try { it.style.setProperty('display', 'none', 'important'); } catch (e) {}
  }

  function findContainers() {
    var anchors = [].slice.call(document.querySelectorAll('a[href]')).filter(function (a) {
      return (a.textContent || '').trim() === '精选' && a.getBoundingClientRect().width > 0;
    });
    var out = [];
    anchors.forEach(function (a) {
      var n = a;
      for (var i = 0; i < 8 && n; i++) {
        var txt = n.textContent || '';
        var hit = ALL.filter(function (w) { return txt.indexOf(w) >= 0; }).length;
        if (n.children.length >= 8 && hit >= 8) {
          if (out.indexOf(n) < 0) out.push(n);
          break;
        }
        n = n.parentElement;
      }
    });
    return out;
  }

  function apply(container) {
    if (!container) return 0;
    var n = 0;
    [].slice.call(container.children).forEach(function (it) {
      var t = (it.textContent || '').trim();
      if (DROP.indexOf(t) >= 0) { hide(it); n++; }
    });
    return n;
  }

  var pending = null;
  var obs = null;

  function scan() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = null;
      try {
        var cs = findContainers();
        var total = 0;
        cs.forEach(function (c) { total += apply(c); });
        if (cs.length && container0 !== cs[0]) {
          container0 = cs[0];
          console.log('[DouyinSave] nativenav ready containers=' + cs.length +
            ' hidden=' + total + ' drop=' + DROP.join(','));
        }
      } catch (e) { console.log('[DouyinSave] nativenav err ' + e.message); }
    }, 220);
  }
  var container0 = null;

  function boot() {
    scan();
    obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) { scan(); return; }
      }
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    console.log('[DouyinSave] nativenav v2.0 boot (native styles, only 4 hidden)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
