/* 隐藏 SmartFeed 脚本的"智能助手"悬浮球
 *
 * 定位依据（实测，非猜测）：
 *   - 元素：div.smart-feed-float-btn
 *   - 父节点：BODY（body 直接子节点）
 *   - 属性：title="点击打开智能助手"，inline style 仅 left/top/transform，未设 display
 *   - 来源：13-smartfeed.user.js 注入（该元素无 __reactFiber 属性，抖音原生元素都有）
 *   - 不是抖音原生组件，也不是浏览器扩展
 *
 * 处理方式：仅按这个类名隐藏，不用通用选择器；不改 SmartFeed 的推荐流过滤逻辑，
 * 只去掉它的入口按钮。元素若被脚本重建，CSS 仍然生效。
 */
(function () {
  'use strict';
  if (window.top !== window.self) return;
  var STYLE_ID = 'dy-hide-assistant-style';

  function inject() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      'div.smart-feed-float-btn{',
      '  display:none!important;',
      '  visibility:hidden!important;',
      '  pointer-events:none!important;',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
    console.log('[DouyinSave] hideassist style injected');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true });
  else inject();
})();
