// ============================================================
// Borgo Antico — generazione mappa
// ============================================================
'use strict';

const World = {
  // RNG deterministico (mulberry32)
  rng(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // value noise semplice interpolato
  makeNoise(rand, size, scale) {
    const g = Math.ceil(size / scale) + 2;
    const grid = [];
    for (let i = 0; i < g * g; i++) grid.push(rand());
    const lerp = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
    return (x, y) => {
      const fx = x / scale, fy = y / scale;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const v = (ix, iy) => grid[iy * g + ix];
      return lerp(lerp(v(x0, y0), v(x0 + 1, y0), tx),
                  lerp(v(x0, y0 + 1), v(x0 + 1, y0 + 1), tx), ty);
    };
  },

  generate(seed) {
    const N = CONFIG.MAP;
    const rand = this.rng(seed);
    const elev = this.makeNoise(rand, N, 9);
    const veg = this.makeNoise(rand, N, 6);
    const fert = this.makeNoise(rand, N, 7);
    const grid = new Array(N * N);
    const cx = N / 2, cy = N / 2;

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dCenter = Math.hypot(x - cx, y - cy) / (N / 2);
        const e = elev(x, y);
        let t = T.GRASS;
        if (e < 0.26 && dCenter > 0.3) t = T.WATER;
        else if (e > 0.78) t = T.ROCK;
        else if (veg(x, y) > 0.62 && dCenter > 0.18) t = T.FOREST;
        else if (fert(x, y) > 0.62) t = T.FERTILE;
        // area di partenza pulita attorno al centro
        if (dCenter < 0.11 && t !== T.GRASS && t !== T.FERTILE) t = T.GRASS;
        grid[y * N + x] = { t, b: null, deco: rand() };
      }
    }

    // posizioni campi nemici: verso gli angoli, su terra
    const corners = [
      [4, 4], [N - 5, 4], [4, N - 5], [N - 5, N - 5],
    ];
    const camps = [];
    for (const [bx, by] of corners) {
      if (camps.length >= ENEMY.CAMPS) break;
      const spot = this.findLand(grid, N, bx, by);
      if (spot) {
        grid[spot.y * N + spot.x].t = T.GRASS;
        camps.push({
          x: spot.x, y: spot.y,
          strength: ENEMY.START_STRENGTH[camps.length],
          alive: true, respawnAt: 0, lastRaid: 0, generation: 0,
        });
      }
    }
    return { grid, camps };
  },

  findLand(grid, N, sx, sy) {
    for (let r = 0; r < 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = sx + dx, y = sy + dy;
          if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) continue;
          if (grid[y * N + x].t !== T.WATER) return { x, y };
        }
      }
    }
    return null;
  },

  // tiles adiacenti (8 direzioni)
  neighbors(x, y) {
    const out = [];
    const N = CONFIG.MAP;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N) out.push(ny * N + nx);
      }
    }
    return out;
  },
};
