// ============================================================
// Borgo Antico — avvio e game loop
// ============================================================
'use strict';

(function () {
  const canvas = document.getElementById('game');

  if (!Game.load()) {
    Game.newGame();
    setTimeout(() => {
      UI.banner('🏕️ Benvenuto, Signore del Borgo! Tocca 🔨 per costruire la tua prima casa.', 'good');
    }, 800);
  }

  Renderer.init(canvas);
  Input.init(canvas);
  UI.init();

  let last = performance.now();
  let tickAcc = 0;
  let saveAcc = 0;

  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.5) dt = 0.5; // dopo pause lunghe non far esplodere il tempo

    tickAcc += dt;
    while (tickAcc >= CONFIG.TICK) {
      tickAcc -= CONFIG.TICK;
      Game.tick();
    }

    saveAcc += dt;
    if (saveAcc >= CONFIG.AUTOSAVE_EVERY) {
      saveAcc = 0;
      Game.save();
    }

    Renderer.frame(dt);
    UI.update();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // salva quando l'app va in background (importante su iOS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Game.save();
  });
  window.addEventListener('pagehide', () => Game.save());

  // service worker per giocare offline
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
