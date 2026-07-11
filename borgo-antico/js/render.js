// ============================================================
// Borgo Antico — rendering isometrico su canvas
// ============================================================
'use strict';

const Renderer = {
  canvas: null, ctx: null,
  w: 0, h: 0, dpr: 1,
  cam: { x: 0, y: 0, zoom: 1 },
  minZoom: 0.45, maxZoom: 2.4,
  ghost: null,            // { x, y, type, ok } anteprima costruzione
  selected: null,         // { x, y } tile selezionato
  time: 0,
  particles: [],
  lightnings: [],
  birdTimer: 8,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const c = CONFIG.MAP >> 1;
    const p = this.tileToWorld(c, c);
    this.cam.x = p.x; this.cam.y = p.y;
    this.cam.zoom = Math.min(1.2, Math.max(0.7, this.w / 900));
  },

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
  },

  // ---- proiezione isometrica ----
  tileToWorld(x, y) {
    return { x: (x - y) * CONFIG.TILE_W / 2, y: (x + y) * CONFIG.TILE_H / 2 };
  },
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.cam.x) * this.cam.zoom + this.w / 2,
      y: (wy - this.cam.y) * this.cam.zoom + this.h / 2,
    };
  },
  screenToTile(sx, sy) {
    const wx = (sx - this.w / 2) / this.cam.zoom + this.cam.x;
    const wy = (sy - this.h / 2) / this.cam.zoom + this.cam.y;
    const a = wx / (CONFIG.TILE_W / 2), b = wy / (CONFIG.TILE_H / 2);
    return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
  },

  clampCamera() {
    const N = CONFIG.MAP;
    const half = N * CONFIG.TILE_W / 2;
    this.cam.x = Math.max(-half, Math.min(half, this.cam.x));
    this.cam.y = Math.max(-CONFIG.TILE_H, Math.min(N * CONFIG.TILE_H + CONFIG.TILE_H, this.cam.y));
    this.cam.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.cam.zoom));
  },

  // ---- ciclo giorno/notte: 0 = mezzogiorno, 1 = mezzanotte ----
  nightness() {
    if (!Game.state) return 0;
    const t = (Game.state.time % CONFIG.DAY_LENGTH) / CONFIG.DAY_LENGTH;
    return (1 - Math.cos(t * Math.PI * 2)) / 2 * 0.9; // parte da giorno
  },

  addLightning(tx, ty) {
    this.lightnings.push({ tx, ty, ttl: 0.7 });
  },

  addSmoke(wx, wy) {
    this.particles.push({
      x: wx + (Math.random() - 0.5) * 8, y: wy - 26,
      vx: (Math.random() - 0.5) * 3, vy: -9 - Math.random() * 5,
      ttl: 2.5 + Math.random(), max: 3, kind: 'smoke',
    });
  },

  frame(dt) {
    this.time += dt;
    const ctx = this.ctx;
    const s = Game.state;
    if (!s) return;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const night = this.nightness();

    // cielo/sfondo
    const skyDay = [126, 168, 116], skyNight = [16, 22, 34];
    const mix = (a, b, t) => Math.round(a + (b - a) * t);
    ctx.fillStyle = `rgb(${mix(skyDay[0], skyNight[0], night)},${mix(skyDay[1], skyNight[1], night)},${mix(skyDay[2], skyNight[2], night)})`;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawMap(ctx, night);
    this.drawCamps(ctx, night);
    this.drawEffects(ctx, dt);
    this.drawParticles(ctx, dt);

    // velo notturno
    if (night > 0.05) {
      ctx.fillStyle = `rgba(10, 16, 46, ${night * 0.32})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.restore();

    // fumo dai camini ogni tanto
    if (Math.random() < dt * 1.5) {
      const houses = s.buildings.filter(b => b.type === 'casa' || b.type === 'taverna');
      if (houses.length) {
        const h = houses[(Math.random() * houses.length) | 0];
        const p = this.tileToWorld(h.x, h.y);
        this.addSmoke(p.x, p.y);
      }
    }
  },

  visibleRange() {
    // bounding box dei tile visibili
    const corners = [
      this.screenToTile(0, 0), this.screenToTile(this.w, 0),
      this.screenToTile(0, this.h), this.screenToTile(this.w, this.h),
    ];
    const pad = 2;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of corners) {
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    }
    const N = CONFIG.MAP;
    return {
      minX: Math.max(0, minX - pad), maxX: Math.min(N - 1, maxX + pad),
      minY: Math.max(0, minY - pad), maxY: Math.min(N - 1, maxY + pad),
    };
  },

  drawMap(ctx, night) {
    const s = Game.state;
    const N = CONFIG.MAP;
    const z = this.cam.zoom;
    const W2 = CONFIG.TILE_W / 2 * z, H2 = CONFIG.TILE_H / 2 * z;
    const r = this.visibleRange();

    for (let y = r.minY; y <= r.maxY; y++) {
      for (let x = r.minX; x <= r.maxX; x++) {
        const cell = s.grid[y * N + x];
        const wp = this.tileToWorld(x, y);
        const p = this.worldToScreen(wp.x, wp.y);
        if (p.x < -W2 * 2 || p.x > this.w + W2 * 2 || p.y < -H2 * 6 || p.y > this.h + H2 * 3) continue;

        this.drawTile(ctx, p.x, p.y, W2, H2, cell, night);

        // selezione
        if (this.selected && this.selected.x === x && this.selected.y === y) {
          this.diamond(ctx, p.x, p.y, W2, H2);
          ctx.strokeStyle = '#ffe9b0';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        if (cell.b) this.drawBuilding(ctx, p.x, p.y, z, cell.b, night);

        // anteprima costruzione
        if (this.ghost && this.ghost.x === x && this.ghost.y === y) {
          this.diamond(ctx, p.x, p.y, W2, H2);
          ctx.fillStyle = this.ghost.ok ? 'rgba(110, 230, 120, 0.45)' : 'rgba(230, 90, 70, 0.5)';
          ctx.fill();
          ctx.globalAlpha = 0.65;
          this.emoji(ctx, BUILDINGS[this.ghost.type].emoji, p.x, p.y - H2 * 0.9, 26 * z);
          ctx.globalAlpha = 1;
        }
      }
    }
  },

  diamond(ctx, cx, cy, W2, H2) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - H2);
    ctx.lineTo(cx + W2, cy);
    ctx.lineTo(cx, cy + H2);
    ctx.lineTo(cx - W2, cy);
    ctx.closePath();
  },

  drawTile(ctx, cx, cy, W2, H2, cell, night) {
    const v = cell.deco; // variazione 0..1
    let fill;
    switch (cell.t) {
      case T.GRASS: fill = `hsl(${96 + v * 12}, 38%, ${34 + v * 6}%)`; break;
      case T.FERTILE: fill = `hsl(${78 + v * 8}, 46%, ${38 + v * 5}%)`; break;
      case T.FOREST: fill = `hsl(${112 + v * 10}, 40%, ${26 + v * 5}%)`; break;
      case T.ROCK: fill = `hsl(${30 + v * 20}, 8%, ${42 + v * 8}%)`; break;
      case T.WATER: {
        const wave = Math.sin(this.time * 1.6 + v * 9) * 4;
        fill = `hsl(205, 52%, ${30 + wave}%)`;
        break;
      }
    }
    this.diamond(ctx, cx, cy, W2, H2);
    ctx.fillStyle = fill;
    ctx.fill();
    // bordo leggero
    ctx.strokeStyle = 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const z = this.cam.zoom;
    if (cell.t === T.FOREST) {
      // alberelli
      const n = 1 + ((v * 3) | 0);
      for (let i = 0; i < n; i++) {
        const ox = ((v * 137 + i * 61) % 40 - 20) * 0.55 * z;
        const oy = ((v * 89 + i * 43) % 16 - 8) * 0.55 * z;
        this.tree(ctx, cx + ox, cy + oy, (14 + (v * 8)) * z, night);
      }
    } else if (cell.t === T.ROCK) {
      ctx.fillStyle = `hsl(30, 6%, ${52 + v * 10}%)`;
      ctx.beginPath();
      ctx.ellipse(cx - 6 * z, cy, 9 * z, 5.5 * z, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 7 * z, cy + 2 * z, 6 * z, 4 * z, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (cell.t === T.FERTILE && !cell.b) {
      // solchi del campo
      ctx.strokeStyle = 'rgba(70, 50, 20, 0.25)';
      ctx.lineWidth = 1.5 * z;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - W2 * 0.5, cy + i * H2 * 0.34);
        ctx.lineTo(cx + W2 * 0.5, cy + i * H2 * 0.34);
        ctx.stroke();
      }
    }
  },

  tree(ctx, x, y, size, night) {
    ctx.fillStyle = '#5a4126';
    ctx.fillRect(x - size * 0.08, y - size * 0.3, size * 0.16, size * 0.35);
    const g = 30 - night * 8;
    ctx.fillStyle = `hsl(120, 38%, ${g}%)`;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.42, y - size * 0.22);
    ctx.lineTo(x - size * 0.42, y - size * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - size * 1.35);
    ctx.lineTo(x + size * 0.32, y - size * 0.72);
    ctx.lineTo(x - size * 0.32, y - size * 0.72);
    ctx.closePath();
    ctx.fill();
  },

  emoji(ctx, ch, x, y, size) {
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y);
  },

  drawBuilding(ctx, cx, cy, z, type, night) {
    const def = BUILDINGS[type];
    const big = type === 'municipio' || type === 'castello' || type === 'cattedrale';
    const size = (big ? 40 : 28) * z;

    // ombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3 * z, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    this.emoji(ctx, def.emoji, cx, cy - size * 0.38, size);

    // finestre accese di notte
    if (night > 0.45 && (type === 'casa' || type === 'taverna' || big)) {
      ctx.fillStyle = `rgba(255, 200, 90, ${(night - 0.45) * 1.2})`;
      ctx.beginPath();
      ctx.arc(cx + 5 * z, cy - 6 * z, 2.2 * z, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawCamps(ctx, night) {
    const s = Game.state;
    const z = this.cam.zoom;
    for (const camp of s.camps) {
      if (!camp.alive) continue;
      const wp = this.tileToWorld(camp.x, camp.y);
      const p = this.worldToScreen(wp.x, wp.y);
      if (p.x < -80 || p.x > this.w + 80 || p.y < -80 || p.y > this.h + 80) continue;

      // alone rosso pulsante se razzia in arrivo da questo campo
      if (s.raid && s.camps[s.raid.camp] === camp) {
        const pulse = 0.35 + Math.sin(this.time * 6) * 0.2;
        ctx.fillStyle = `rgba(220, 60, 40, ${pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 34 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 4 * z, 22 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      this.emoji(ctx, '⛺', p.x - 8 * z, p.y - 8 * z, 26 * z);
      this.emoji(ctx, '⛺', p.x + 9 * z, p.y - 4 * z, 20 * z);
      this.emoji(ctx, '🏴', p.x + 2 * z, p.y - 26 * z, 18 * z);

      // etichetta forza
      ctx.font = `${11 * Math.max(0.8, z)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb0a0';
      ctx.fillText('💢 ' + camp.strength, p.x, p.y + 18 * z);
    }

    // soldati in marcia
    if (s.attack) {
      const camp = s.camps[s.attack.camp];
      const c = CONFIG.MAP >> 1;
      const t = 1 - Math.max(0, (s.attack.at - s.time) / ENEMY.ATTACK_TRAVEL);
      const a = this.tileToWorld(c, c), b = this.tileToWorld(camp.x, camp.y);
      const p = this.worldToScreen(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      this.emoji(ctx, '⚔️', p.x, p.y - 8, 22 * z);
    }
  },

  drawEffects(ctx, dt) {
    // fulmini
    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      const L = this.lightnings[i];
      L.ttl -= dt;
      if (L.ttl <= 0) { this.lightnings.splice(i, 1); continue; }
      const wp = this.tileToWorld(L.tx, L.ty);
      const p = this.worldToScreen(wp.x, wp.y);
      const alpha = Math.min(1, L.ttl * 2);
      ctx.strokeStyle = `rgba(255, 255, 180, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      let x = p.x, y = p.y - 300;
      ctx.moveTo(x, y);
      while (y < p.y) {
        x += (Math.random() - 0.5) * 30;
        y += 40;
        ctx.lineTo(Math.min(y, p.y) === p.y ? p.x : x, Math.min(y, p.y));
      }
      ctx.stroke();
      if (L.ttl > 0.5) {
        ctx.fillStyle = `rgba(255,255,220,${(L.ttl - 0.5) * 1.5})`;
        ctx.fillRect(0, 0, this.w, this.h);
      }
    }

    // scudo divino attivo: alone sul municipio
    const s = Game.state;
    if (s.time < s.effects.scudoUntil) {
      const c = CONFIG.MAP >> 1;
      const wp = this.tileToWorld(c, c);
      const p = this.worldToScreen(wp.x, wp.y);
      const pulse = 40 + Math.sin(this.time * 3) * 6;
      ctx.strokeStyle = 'rgba(140, 200, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, pulse * this.cam.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawParticles(ctx, dt) {
    // uccellini di tanto in tanto
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 12 + Math.random() * 20;
      const y = this.cam.y - 150 + Math.random() * 200;
      this.particles.push({
        x: this.cam.x - this.w / this.cam.zoom / 2 - 40, y,
        vx: 35 + Math.random() * 20, vy: Math.sin(Math.random() * 6) * 4,
        ttl: 30, max: 30, kind: 'bird',
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.ttl -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.ttl <= 0) { this.particles.splice(i, 1); continue; }
      const p = this.worldToScreen(pt.x, pt.y);
      if (pt.kind === 'smoke') {
        const a = Math.min(0.4, pt.ttl / pt.max * 0.5);
        const r = (3 + (pt.max - pt.ttl) * 3) * this.cam.zoom;
        ctx.fillStyle = `rgba(220, 220, 210, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === 'bird') {
        if (p.x > this.w + 60) { this.particles.splice(i, 1); continue; }
        ctx.strokeStyle = 'rgba(30, 30, 30, 0.7)';
        ctx.lineWidth = 1.6;
        const flap = Math.sin(this.time * 10 + pt.y) * 4;
        ctx.beginPath();
        ctx.moveTo(p.x - 5, p.y - flap);
        ctx.quadraticCurveTo(p.x, p.y + 3, p.x + 5, p.y - flap);
        ctx.stroke();
      }
    }
  },
};
