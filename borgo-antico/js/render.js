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
    ctx.imageSmoothingEnabled = false;   // pixel art nitida

    const night = this.nightness();

    // cielo/sfondo
    const skyDay = [126, 168, 116], skyNight = [16, 22, 34];
    const mix = (a, b, t) => Math.round(a + (b - a) * t);
    ctx.fillStyle = `rgb(${mix(skyDay[0], skyNight[0], night)},${mix(skyDay[1], skyNight[1], night)},${mix(skyDay[2], skyNight[2], night)})`;
    ctx.fillRect(0, 0, this.w, this.h);

    this.drawMap(ctx, night);
    this.updateLife(dt);
    this.drawLife(ctx);
    this.drawCamps(ctx, night);
    this.drawEffects(ctx, dt);
    this.drawParticles(ctx, dt);

    // velo notturno
    if (night > 0.05) {
      ctx.fillStyle = `rgba(10, 14, 40, ${night * 0.48})`;
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
          this.sprite(ctx, Sprites.building(this.ghost.type, false), p.x, p.y + H2 * 0.7, 2 * z, 0.65);
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

  // disegna uno sprite pixel art ancorato al suo punto base
  sprite(ctx, spr, x, y, scale, alpha) {
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(spr,
      Math.round(x - spr._ax * scale), Math.round(y - spr._ay * scale),
      Math.round(spr.width * scale), Math.round(spr.height * scale));
    if (alpha != null) ctx.globalAlpha = 1;
  },

  drawTile(ctx, cx, cy, W2, H2, cell, night) {
    const v = cell.deco;
    const variant = (v * 3) | 0;
    const frame = cell.t === T.WATER ? (((this.time * 2.2) | 0) + ((v * 3) | 0)) % 3 : 0;
    const ground = Sprites.terrain(cell.t, variant, frame);
    // +1 px per evitare cuciture tra i rombi
    ctx.drawImage(ground,
      Math.round(cx - W2) - 1, Math.round(cy - H2),
      Math.round(W2 * 2) + 2, Math.round(H2 * 2) + 1);

    const z = this.cam.zoom;
    // decorazioni sparse sull'erba: fiori, funghi, sassi, ciuffi
    if (cell.t === T.GRASS && !cell.b) {
      const d = (v * 997) | 0;
      if (d % 10 < 4) {
        const kind = d % 4;
        const ox = ((d % 23) - 11) * 1.4 * z;
        const oy = ((d % 13) - 6) * 0.9 * z;
        this.sprite(ctx, Sprites.decor(kind), cx + ox, cy + oy + H2 * 0.3, 1.6 * z);
      }
    }
    if (cell.t === T.FOREST) {
      const n = 2 + ((v * 2) | 0);
      for (let i = 0; i < n; i++) {
        const ox = ((v * 137 + i * 67) % 44 - 22) * 0.8 * z;
        const oy = ((v * 89 + i * 47) % 22 - 8) * 0.8 * z;
        this.sprite(ctx, Sprites.tree((((v * 7) | 0) + i) % 2), cx + ox, cy + oy + H2 * 0.4, (1.5 + v * 0.6) * z);
      }
    } else if (cell.t === T.ROCK) {
      this.sprite(ctx, Sprites.boulder(), cx, cy + H2 * 0.5, (1.5 + v * 0.6) * z);
    }
  },

  drawBuilding(ctx, cx, cy, z, type, night) {
    const spr = Sprites.building(type, night > 0.45);
    // ombra morbida alla base
    ctx.fillStyle = 'rgba(20, 14, 6, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3 * z, 20 * z, 8 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    this.sprite(ctx, spr, cx, cy + CONFIG.TILE_H / 2 * z * 0.7, 2 * z);
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

      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 4 * z, 22 * z, 8 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      this.sprite(ctx, Sprites.camp(), p.x, p.y + 6 * z, 2 * z);

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
      const bob = Math.abs(Math.sin(this.time * 8)) * 2 * z;
      this.sprite(ctx, Sprites.soldier(), p.x - 4 * z, p.y - bob, 2 * z);
      this.sprite(ctx, Sprites.soldier(), p.x + 6 * z, p.y + 3 * z - bob, 2 * z);
    }
  },

  // ---------- vita nel borgo: villici e pecore ----------
  walkers: [],
  flock: [],

  _buildingSpot(b) {
    const p = this.tileToWorld(b.x, b.y);
    return {
      x: p.x + (Math.random() - 0.5) * 22,
      y: p.y + 6 + (Math.random() - 0.5) * 10,
    };
  },

  _grassSpot(nearX, nearY, radius) {
    const s = Game.state;
    const N = CONFIG.MAP;
    for (let tries = 0; tries < 8; tries++) {
      const tx = Math.round(nearX + (Math.random() - 0.5) * radius * 2);
      const ty = Math.round(nearY + (Math.random() - 0.5) * radius * 2);
      if (tx < 1 || ty < 1 || tx >= N - 1 || ty >= N - 1) continue;
      const cell = s.grid[ty * N + tx];
      if ((cell.t === T.GRASS || cell.t === T.FERTILE) && !cell.b) {
        const p = this.tileToWorld(tx, ty);
        return { x: p.x + (Math.random() - 0.5) * 20, y: p.y + (Math.random() - 0.5) * 10, tx, ty };
      }
    }
    return null;
  },

  updateLife(dt) {
    const s = Game.state;
    if (!s) return;
    const bl = s.buildings;

    // villici a passeggio tra gli edifici
    const wantWalkers = bl.length >= 2 ? Math.min(12, 1 + Math.floor(s.pop / 3)) : 0;
    if (this.walkers.length < wantWalkers && Math.random() < dt * 0.8) {
      const from = bl[(Math.random() * bl.length) | 0];
      const pos = this._buildingSpot(from);
      this.walkers.push({
        x: pos.x, y: pos.y, target: null, pause: Math.random() * 2,
        color: (Math.random() * 4) | 0, speed: 13 + Math.random() * 6,
      });
    }
    if (this.walkers.length > wantWalkers) this.walkers.length = wantWalkers;

    for (const w of this.walkers) {
      if (w.pause > 0) { w.pause -= dt; continue; }
      if (!w.target) {
        const to = bl[(Math.random() * bl.length) | 0];
        w.target = this._buildingSpot(to);
        continue;
      }
      const dx = w.target.x - w.x, dy = w.target.y - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) {
        w.target = null;
        w.pause = 1 + Math.random() * 4;
      } else {
        w.x += dx / dist * w.speed * dt;
        w.y += dy / dist * w.speed * dt;
        w.dir = dx >= 0 ? 1 : -1;
      }
    }

    // pecorelle al pascolo attorno al borgo
    const wantSheep = bl.length >= 3 ? 5 : 0;
    if (this.flock.length < wantSheep && Math.random() < dt * 0.5) {
      const home = bl[(Math.random() * bl.length) | 0];
      const spot = this._grassSpot(home.x, home.y, 5);
      if (spot) this.flock.push({ x: spot.x, y: spot.y, tx: spot.tx, ty: spot.ty, target: null, pause: Math.random() * 3 });
    }
    if (this.flock.length > wantSheep) this.flock.length = wantSheep;

    for (const sh of this.flock) {
      if (sh.pause > 0) { sh.pause -= dt; continue; }
      if (!sh.target) {
        sh.target = this._grassSpot(sh.tx, sh.ty, 2);
        if (!sh.target) sh.pause = 2;
        continue;
      }
      const dx = sh.target.x - sh.x, dy = sh.target.y - sh.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        sh.tx = sh.target.tx; sh.ty = sh.target.ty;
        sh.target = null;
        sh.pause = 2 + Math.random() * 5;   // bruca con calma
      } else {
        sh.x += dx / dist * 5 * dt;
        sh.y += dy / dist * 5 * dt;
      }
    }
  },

  drawLife(ctx) {
    const z = this.cam.zoom;
    const frame = ((this.time * 6) | 0) % 2;
    for (const sh of this.flock) {
      const p = this.worldToScreen(sh.x, sh.y);
      if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
      this.sprite(ctx, Sprites.sheep(sh.target ? frame : 0), p.x, p.y, 1.6 * z);
    }
    for (const w of this.walkers) {
      const p = this.worldToScreen(w.x, w.y);
      if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
      this.sprite(ctx, Sprites.villager(w.color, w.target && w.pause <= 0 ? frame : 0), p.x, p.y, 1.6 * z);
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
        // sbuffo quadrato in stile pixel
        const r = Math.max(2, Math.round((3 + (pt.max - pt.ttl) * 3) * this.cam.zoom / 2) * 2);
        ctx.fillStyle = `rgba(226, 222, 210, ${a})`;
        ctx.fillRect(Math.round(p.x - r / 2), Math.round(p.y - r / 2), r, r);
        ctx.fillRect(Math.round(p.x - r / 4), Math.round(p.y - r), r / 2, r / 2);
      } else if (pt.kind === 'bird') {
        if (p.x > this.w + 60) { this.particles.splice(i, 1); continue; }
        const flap = Math.sin(this.time * 10 + pt.y) > 0 ? 2 : 0;
        const u = Math.max(1, Math.round(1.5 * this.cam.zoom));
        ctx.fillStyle = 'rgba(40, 36, 30, 0.8)';
        ctx.fillRect(p.x - 2 * u, p.y - flap * u, u, u);
        ctx.fillRect(p.x - u, p.y - u, u, u);
        ctx.fillRect(p.x, p.y - u, u, u);
        ctx.fillRect(p.x + u, p.y - flap * u, u, u);
      }
    }
  },
};
