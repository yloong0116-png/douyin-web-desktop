(function () {
  'use strict';
  if (window.top !== window.self || window.__DY_BACKGROUND_MANAGER__) return;

  var state = { hidden: false, paused: new WeakSet() };
  window.__DY_BACKGROUND_MANAGER__ = state;

  function pauseForBackground() {
    if (state.hidden) return;
    state.hidden = true;
    document.querySelectorAll('video').forEach(function (video) {
      if (video.paused || video.ended) return;
      state.paused.add(video);
      try { video.pause(); } catch (e) {}
    });
  }

  function resumeVisibility() {
    state.hidden = false;
    state.paused = new WeakSet();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') pauseForBackground();
    else resumeVisibility();
  });
  if (document.visibilityState === 'hidden') pauseForBackground();
})();
