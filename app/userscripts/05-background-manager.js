(function () {
  'use strict';
  if (window.top !== window.self || window.__DY_BACKGROUND_MANAGER__) return;

  var state = { hidden: false };
  window.__DY_BACKGROUND_MANAGER__ = state;

  function pauseForBackground() {
    if (state.hidden) return;
    state.hidden = true;
    document.querySelectorAll('video').forEach(function (video) {
      if (video.paused || video.ended) return;
      try { video.pause(); } catch (e) {}
    });
  }

  function resumeVisibility() {
    state.hidden = false;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') pauseForBackground();
    else resumeVisibility();
  });
  if (document.visibilityState === 'hidden') pauseForBackground();
})();
