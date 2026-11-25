/* 布局实验室 v2.0 —— LAB_R（默认关闭）
 *
 * 目标定位（v2 修正）：不再按 class 名查询。以当前 .xgplayer 为起点逐层向上，
 * 只认「是 .xgplayer 的真实祖先」且同时满足：
 *   1) computed padding-right 在 40–100px
 *   2) box-sizing: border-box
 *   3) right 边界与窗口右边界相差 ≤2px（即播放器列右边界）
 * 多个候选 → 拒绝操作并输出候选列表；找不到 → 记录定位失败，不改任何元素。
 *
 * enable/disable 绑定同一个元素引用，重复调用不覆盖首次保存的原始值。
 * sampleR() 只读，供人工进全屏后采样。
 */
(function () {
  'use strict';
  if (window.top !== window.self) return;

  var KEY = 'dy-lab-R';
  var seq = 0;
  var S = { on: false, id: '', el: null, inlineVal: '', inlinePrio: '', computedBefore: '' };

  function chainOf() {
    var pg = document.querySelector('.xgplayer');
    if (!pg) return { err: 'no-xgplayer', chain: [], cands: [] };
    var chain = [], cands = [], n = pg, i = 0;
    while (n && i < 10) {
      var r = n.getBoundingClientRect(), cs = getComputedStyle(n);
      var pr = parseFloat(cs.paddingRight) || 0;
      var row = {
        i: i,
        cls: String(n.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'),
        w: Math.round(r.width), right: Math.round(r.right), pr: pr, bs: cs.boxSizing
      };
      chain.push(row);
      if (pr >= 40 && pr <= 100 && cs.boxSizing === 'border-box' && Math.abs(r.right - window.innerWidth) <= 2) {
        cands.push(n);
      }
      n = n.parentElement;
      i++;
    }
    return { chain: chain, cands: cands };
  }

  function describe(el) {
    if (!el) return 'none';
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return {
      cls: String(el.className || '').split(/\s+/).slice(0, 3).join('.'),
      w: Math.round(r.width), right: Math.round(r.right),
      padRight: cs.paddingRight, bs: cs.boxSizing,
      isConnected: el.isConnected,
      sideCardVar: cs.getPropertyValue('--fullscreen-layout-side-card-width').trim() || '(none)'
    };
  }

  function enableR() {
    if (S.on && S.el && S.el.isConnected) return true;   // 幂等，不覆盖原始值
    if (S.on && S.el && !S.el.isConnected) {
      console.log('[DouyinSave] labR ABORT: previous target detached, not rebinding');
      S.on = false; S.el = null;
      return false;
    }
    var res = chainOf();
    if (res.err) { console.log('[DouyinSave] labR fail: ' + res.err); return false; }
    if (res.cands.length === 0) { console.log('[DouyinSave] labR fail: no candidate'); return false; }
    if (res.cands.length > 1) {
      console.log('[DouyinSave] labR fail: ' + res.cands.length + ' candidates -> ' +
        res.cands.map(function (c) { return describe(c).cls + '@' + describe(c).w; }).join(' | '));
      return false;
    }
    var t = res.cands[0];
    seq++;
    S.id = 'R#' + seq;
    S.el = t;
    var cs = getComputedStyle(t);
    S.computedBefore = cs.paddingRight;
    S.inlineVal = t.style.getPropertyValue('padding-right');
    S.inlinePrio = t.style.getPropertyPriority('padding-right');
    t.style.setProperty('padding-right', '0px', 'important');
    S.on = true;
    console.log('[DouyinSave] labR ON ' + S.id + ' ' + JSON.stringify(describe(t)) +
      ' | inlineBefore="' + S.inlineVal + '"' + (S.inlinePrio ? '!' + S.inlinePrio : '') +
      ' computedBefore=' + S.computedBefore +
      ' computedAfter=' + getComputedStyle(t).paddingRight);
    return true;
  }

  function disableR() {
    if (!S.on || !S.el) return true;
    if (!S.el.isConnected) {
      console.log('[DouyinSave] labR OFF aborted: ' + S.id + ' detached, nothing to restore');
      S.on = false; S.el = null;
      return false;
    }
    if (S.inlineVal) S.el.style.setProperty('padding-right', S.inlineVal, S.inlinePrio || '');
    else S.el.style.removeProperty('padding-right');
    var after = getComputedStyle(S.el).paddingRight;
    console.log('[DouyinSave] labR OFF ' + S.id + ' ' + S.el.className.toString().slice(0, 30) +
      ' connected=' + S.el.isConnected +
      ' computedAfterRestore=' + after +
      ' (expect ' + S.computedBefore + ') ' + (after === S.computedBefore ? 'OK' : 'MISMATCH'));
    S.on = false; S.el = null;
    return after === S.computedBefore;
  }

  /* 只读采样：不修改任何样式 */
  function sampleR() {
    var res = chainOf();
    var v = document.querySelector('video');
    var vr = v ? v.getBoundingClientRect() : null;
    var like = document.querySelectorAll('[data-e2e="video-player-digg"], .xgplayer-playswitch');
    var box = like.length ? like[0].getBoundingClientRect() : null;
    var out = {
      t: new Date().toISOString(),
      fullscreen: !!document.fullscreenElement,
      win: innerWidth + 'x' + innerHeight,
      chain: res.chain,
      candidates: res.cands.length,
      candidateInfo: res.cands.map(describe),
      bound: S.on ? { id: S.id, info: describe(S.el) } : null,
      video: vr ? {
        w: Math.round(vr.width), h: Math.round(vr.height), right: Math.round(vr.right),
        fit: getComputedStyle(v).objectFit, src: v.videoWidth + 'x' + v.videoHeight,
        gapRight: innerWidth - Math.round(vr.right)
      } : null,
      rightControls: box ? { x: Math.round(box.left), w: Math.round(box.width) } : null
    };
    console.log('[DouyinSave] sampleR ' + JSON.stringify(out).slice(0, 1800));
    return out;
  }

  window.__dyLab = {
    enableR: enableR,
    disableR: disableR,
    sampleR: sampleR,
    state: function () { return { R: S.on, id: S.id, connected: S.el ? S.el.isConnected : null, was: S.computedBefore }; }
  };

  // 被动监听：进入/退出全屏时自动采样两次（只读，不改样式）
  document.addEventListener('fullscreenchange', function () {
    console.log('[DouyinSave] fullscreenchange fullscreen=' + !!document.fullscreenElement);
    setTimeout(function () { sampleR(); }, 600);
    setTimeout(function () { sampleR(); }, 2500);
  });

  try {
    if (localStorage.getItem(KEY) === '1') {
      var go = function () { setTimeout(enableR, 900); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
      else go();
    }
  } catch (e) {}

  console.log('[DouyinSave] layoutlab v2.0 loaded (default off)');
})();
