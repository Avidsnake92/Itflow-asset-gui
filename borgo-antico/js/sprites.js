// ============================================================
// Borgo Antico — sprite pixel art generati proceduralmente
// Stile: cozy medievale alla Civitas Northlands.
// Tutti gli sprite sono canvas offscreen disegnati pixel per pixel
// e scalati senza smoothing per l'effetto pixel art.
// ============================================================
'use strict';

const PAL = {
  outline: '#2b2014',
  wood: '#8a5a32', woodD: '#6b4424', woodL: '#a5713f',
  beam: '#55381e',
  plaster: '#eadcb4', plasterD: '#d3bd90',
  thatch: '#cf9f4c', thatchD: '#ab7f36', thatchL: '#e5ba66',
  stone: '#a29c8e', stoneD: '#7f796c', stoneL: '#bcb5a5',
  slate: '#77879f', slateD: '#5c6a81', slateL: '#8fa0b8',
  door: '#4e3218',
  win: '#3a3226', winLit: '#ffd35c',
  gold: '#e8b64c',
  red: '#b8452f', redD: '#8c3220',
  cream: '#f0e6d2',
  leaf: '#3b7034', leafD: '#2f5d2b', leafL: '#4d8a44',
  fire: '#ff9b3d', fireY: '#ffd66b',
  // paglia dorata alla Cultures
  goldR: '#e2b23e', goldRL: '#f2cd63', goldRD: '#b98a2c', goldRX: '#93691e',
};

// pseudo-random deterministico per pattern/dithering
function pr(x, y, k) {
  let h = (x * 374761393 + y * 668265263 + (k || 0) * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1103515245;
  return ((h ^ (h >>> 16)) >>> 0) % 1000 / 1000;
}

const Sprites = {
  _c: {},

  _mk(key, w, h, ax, ay, draw) {
    if (this._c[key]) return this._c[key];
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const P = {
      g,
      px(x, y, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, 1, 1); },
      r(x, y, ww, hh, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, ww, hh); },
      col(x, y1, y2, col) {
        if (y2 < y1) return;
        g.fillStyle = col; g.fillRect(x | 0, y1 | 0, 1, (y2 - y1 + 1) | 0);
      },
    };
    draw(P);
    c._ax = ax; c._ay = ay;
    this._c[key] = c;
    return c;
  },

  // ---------- terreni (diamante 32x16) ----------
  terrain(t, variant, frame) {
    const key = `t${t}v${variant}f${frame || 0}`;
    return this._mk(key, 32, 16, 16, 8, (P) => {
      const half = y => (y < 8 ? 2 * y + 1 : 2 * (15 - y) + 1);
      for (let y = 0; y < 16; y++) {
        const hw = half(y);
        for (let x = 16 - hw; x <= 15 + hw; x++) {
          P.px(x, y, this._terrainColor(t, x, y, variant, frame || 0));
        }
        // ombreggiatura dei bordi solo dove il confine ha senso
        // (acqua, roccia, campi arati) — l'erba resta un prato continuo
        if (t === T.WATER || t === T.ROCK || t === T.FERTILE) {
          if (y >= 8) {
            P.px(16 - hw, y, 'rgba(20,16,8,0.28)');
            P.px(16 - hw + 1, y, 'rgba(20,16,8,0.14)');
            P.px(15 + hw, y, 'rgba(20,16,8,0.28)');
            P.px(15 + hw - 1, y, 'rgba(20,16,8,0.14)');
          } else {
            P.px(16 - hw, y, 'rgba(255,250,230,0.10)');
            P.px(15 + hw, y, 'rgba(255,250,230,0.10)');
          }
        }
      }
    });
  },

  _terrainColor(t, x, y, v, f) {
    const n = pr(x, y, v * 7 + t * 31);
    switch (t) {
      case T.GRASS:
        if (n > 0.93) return '#94c268';
        if (n < 0.08) return '#6b9a46';
        return n < 0.5 ? '#7fae55' : '#79a850';
      case T.FERTILE:
        if (y % 4 === 1 && x > 4 && x < 27) return '#98a04c';   // solchi leggeri
        if (n > 0.88) return '#d4ad52';                         // spighe
        return n < 0.5 ? '#aeb35c' : '#a6ad57';
      case T.FOREST:
        if (n > 0.92) return '#527c39';
        return n < 0.5 ? '#5c8a40' : '#56843c';
      case T.ROCK:
        if (n > 0.9) return '#b5ae9e';
        if (n < 0.1) return '#736d60';
        return n < 0.5 ? '#8f8a7c' : '#868174';
      case T.WATER: {
        // onde animate che scorrono
        if ((x + y * 2 + f * 4) % 13 === 0 && y > 2 && y < 13) return '#6aa6cc';
        if ((x * 2 + y + f * 3) % 17 === 0) return '#4d8ab5';
        return y > 11 ? '#376f9c' : '#3f7fae';
      }
    }
    return '#000';
  },

  // ---------- vegetazione e decorazioni ----------
  tree(variant) {
    if (variant === 0) {
      // pino
      return this._mk('tree0', 14, 22, 7, 21, (P) => {
        P.r(6, 17, 2, 4, '#4a3522');
        let yy = 16;
        for (const [i, wmax, hh] of [[0, 12, 6], [1, 9, 5], [2, 6, 5]]) {
          const ytop = yy - hh;
          for (let y = ytop; y < yy; y++) {
            const w = Math.max(2, Math.round(wmax * (y - ytop + 1) / hh));
            for (let x = 7 - (w >> 1); x < 7 + (w >> 1); x++) {
              const n = pr(x, y, 5);
              P.px(x, y, n > 0.85 ? PAL.leafL : (n < 0.25 ? PAL.leafD : PAL.leaf));
            }
          }
          yy = ytop + 2;
        }
      });
    }
    // latifoglia tonda
    return this._mk('tree1', 14, 18, 7, 17, (P) => {
      P.r(6, 13, 2, 4, '#4a3522');
      const rows = [4, 8, 10, 12, 12, 12, 10, 6];
      rows.forEach((w, i) => {
        for (let x = 7 - (w >> 1); x < 7 + (w >> 1); x++) {
          const n = pr(x, i, 9);
          P.px(x, i + 5, n > 0.82 ? PAL.leafL : (n < 0.2 ? PAL.leafD : PAL.leaf));
        }
      });
    });
  },

  // ---------- decorazioni del prato (fiori, funghi, sassi, ciuffi) ----------
  decor(kind) {
    const key = 'dec' + kind;
    if (this._c[key]) return this._c[key];
    return this._mk(key, 10, 8, 5, 7, (P) => {
      if (kind === 0) {            // fiorellini
        const cols = ['#e05a6e', '#f2cd63', '#f0e6d2'];
        for (let i = 0; i < 3; i++) {
          const x = 1 + i * 3, y = 2 + ((i * 7) % 3);
          P.px(x, y + 1, '#2f5d2b');
          P.px(x, y, cols[i]);
        }
      } else if (kind === 1) {     // funghi rossi
        P.px(3, 5, '#e8d8b0'); P.r(2, 3, 3, 2, '#c0392b');
        P.px(3, 3, '#f0e6d2');
        P.px(7, 6, '#e8d8b0'); P.r(6, 5, 3, 1, '#c0392b');
      } else if (kind === 2) {     // sassolini
        P.r(2, 5, 3, 2, PAL.stone); P.px(2, 5, PAL.stoneL);
        P.r(6, 6, 2, 1, PAL.stoneD);
      } else {                     // ciuffo d'erba alta
        for (let i = 0; i < 4; i++) {
          const x = 2 + i * 2;
          P.col(x, 3 + (i % 2), 6, i % 2 ? '#5d8a3e' : '#82b25a');
        }
      }
    });
  },

  // ---------- villico che cammina (2 frame, 4 colori di tunica) ----------
  villager(colorIdx, frame) {
    const key = `vil${colorIdx}f${frame}`;
    const tunics = ['#4a6fa5', '#b8452f', '#4e7c3a', '#c9a24b'];
    return this._mk(key, 8, 12, 4, 11, (P) => {
      const tunic = tunics[colorIdx % 4];
      P.px(3, 0, '#6b4424'); P.px(4, 0, '#6b4424');   // capelli
      P.r(3, 1, 2, 2, '#e8c39a');                     // viso
      P.r(2, 3, 4, 4, tunic);                         // tunica
      P.px(1, 4, '#e8c39a'); P.px(6, 4, '#e8c39a');   // braccia
      if (frame === 0) {
        P.r(2, 7, 1, 3, PAL.beam); P.r(5, 7, 1, 3, PAL.beam);
      } else {
        P.r(3, 7, 1, 3, PAL.beam); P.r(4, 7, 1, 2, PAL.beam);
      }
    });
  },

  // ---------- pecorella (2 frame) ----------
  sheep(frame) {
    const key = 'sheep' + frame;
    return this._mk(key, 12, 9, 6, 8, (P) => {
      P.r(2, 2, 8, 4, '#f0ece2');                     // lana
      P.px(2, 2, '#dcd6c8'); P.px(9, 2, '#dcd6c8');
      P.px(3, 1, '#f0ece2'); P.px(6, 1, '#f0ece2'); P.px(8, 1, '#f0ece2');
      P.r(9, 3, 2, 2, '#3a3226');                     // testa
      P.px(11, 3, '#3a3226');
      if (frame === 0) {
        P.px(3, 6, '#3a3226'); P.px(8, 6, '#3a3226');
      } else {
        P.px(4, 6, '#3a3226'); P.px(7, 6, '#3a3226');
      }
    });
  },

  boulder() {
    return this._mk('boulder', 16, 10, 8, 8, (P) => {
      const rows = [6, 10, 13, 14, 14, 12];
      rows.forEach((w, i) => {
        for (let x = 8 - (w >> 1); x < 8 + (w >> 1); x++) {
          const n = pr(x, i, 3);
          let c = n < 0.2 ? PAL.stoneD : (n > 0.85 ? PAL.stoneL : PAL.stone);
          if (i >= 4) c = PAL.stoneD;
          if (i <= 1 && x < 8) c = PAL.stoneL;
          P.px(x, i + 3, c);
        }
      });
    });
  },

  // ---------- costruzione componibile: capanna isometrica ----------
  // by = angolo frontale in basso; w = mezza larghezza per faccia
  _hut(P, o) {
    const { cx, by, w, h } = o;
    const roofH = o.roofH ?? 6, ov = o.ov ?? 1;
    const wallL = o.wallL ?? PAL.plasterD, wallR = o.wallR ?? PAL.plaster;
    const roofL = o.roofL ?? PAL.thatchD, roofR = o.roofR ?? PAL.thatch;
    const edgeL = o.edge ?? PAL.thatchL;

    for (let d = 1; d <= w; d++) {
      const yb = by - ((d - 1) >> 1);
      P.col(cx - d, yb - h + 1, yb, wallL);
      P.col(cx + d - 1, yb - h + 1, yb, wallR);
      P.px(cx - d, yb, 'rgba(20,14,6,0.3)');
      P.px(cx + d - 1, yb, 'rgba(20,14,6,0.3)');
    }
    // spigolo frontale
    P.col(cx - 1, by - h + 1, by, 'rgba(20,14,6,0.15)');

    const eave = d => by - ((d - 1) >> 1) - h;
    const W = w + ov;
    const apexY = eave(1) - roofH;
    for (let d = 1; d <= W; d++) {
      const bot = eave(d);
      const top = Math.round(apexY + (d - 1) * (roofH - 1) / W);
      P.col(cx - d, top, bot, roofL);
      P.col(cx + d - 1, top, bot, roofR);
      P.px(cx - d, top, edgeL);
      P.px(cx + d - 1, top, edgeL);
      P.px(cx - d, bot, 'rgba(20,14,6,0.25)');
      P.px(cx + d - 1, bot, 'rgba(20,14,6,0.25)');
    }
    return { eave, apexY };
  },

  _door(P, cx, by, w, h) {
    w = w || 4; h = h || 5;
    P.r(cx - (w >> 1), by - h + 1, w, h, PAL.door);
    P.r(cx - (w >> 1), by - h, w, 1, PAL.beam);
  },

  _win(P, x, y, night, w, h) {
    P.r(x, y, w || 2, h || 2, night ? PAL.winLit : PAL.win);
  },

  _beams(P, cx, by, w, h) {
    for (let d = 3; d < w; d += 3) {
      const ybL = by - ((d - 1) >> 1);
      P.col(cx - d, ybL - h + 1, ybL, PAL.beam);
      P.col(cx + d - 1, ybL - h + 1, ybL, PAL.beam);
    }
  },

  _crenels(P, cx, by, w, h, col) {
    for (let d = 1; d <= w; d++) {
      const yt = by - ((d - 1) >> 1) - h;
      if ((d % 3) < 2) {
        P.px(cx - d, yt - 1, col); P.px(cx - d, yt - 2, col);
        P.px(cx + d - 1, yt - 1, col); P.px(cx + d - 1, yt - 2, col);
      }
    }
  },

  _flag(P, x, apexY, col) {
    P.col(x, apexY - 6, apexY - 1, PAL.beam);
    P.r(x + 1, apexY - 6, 4, 3, col || PAL.red);
  },

  _cross(P, cx, apexY, col) {
    P.col(cx, apexY - 5, apexY - 1, col || PAL.gold);
    P.r(cx - 1, apexY - 4, 3, 1, col || PAL.gold);
  },

  // ---------- edifici ----------
  building(type, night) {
    const key = `b:${type}${night ? ':n' : ''}`;
    if (this._c[key]) return this._c[key];
    const big = { municipio: 1, castello: 1, cattedrale: 1, chiesa: 1, mulino: 1, torre: 1 }[type];
    const W = big ? 56 : 44, H = big ? 58 : 46;
    const cx = W >> 1, by = H - 4;
    return this._mk(key, W, H, cx, by, (P) => {
      this._buildings[type].call(this, P, cx, by, night);
    });
  },

  // tetto di paglia dorata alla Cultures, con anelli di texture
  _goldCone(P, cx, topY, botY, maxHalf) {
    const h = botY - topY;
    for (let y = topY; y <= botY; y++) {
      const t = (y - topY) / h;
      const half = Math.max(1, Math.round(maxHalf * t));
      for (let x = cx - half; x <= cx + half - 1; x++) {
        let c = x < cx - half * 0.4 ? PAL.goldRD : (x > cx + half * 0.3 ? PAL.goldR : PAL.goldRL);
        if ((y - topY) % 3 === 2) c = x < cx ? PAL.goldRX : PAL.goldRD;  // anelli
        if (pr(x, y, 21) > 0.9) c = PAL.goldRL;
        P.px(x, y, c);
      }
      P.px(cx - half, y, PAL.goldRX);
      P.px(cx + half - 1, y, PAL.goldRX);
    }
    // ciuffo in cima
    P.col(cx, topY - 3, topY, PAL.goldRD);
    P.px(cx - 1, topY - 3, PAL.goldRL); P.px(cx + 1, topY - 2, PAL.goldRL);
  },

  _buildings: {
    // grande sala nordica con tetto d'oro e corna
    municipio(P, cx, by, n) {
      const { apexY } = this._hut(P, {
        cx, by, w: 12, h: 9, roofH: 12,
        wallL: '#5c4226', wallR: '#7a5a34',
        roofL: PAL.goldRD, roofR: PAL.goldR, edge: PAL.goldRL,
      });
      // texture della paglia (strisce oblique)
      for (let d = 2; d <= 12; d += 3) {
        const bot = by - ((d - 1) >> 1) - 9;
        P.px(cx - d, bot - 2, PAL.goldRX);
        P.px(cx + d - 1, bot - 3, PAL.goldRL);
      }
      this._beams(P, cx, by, 12, 9);
      this._door(P, cx, by, 4, 6);
      // torce ai lati della porta
      for (const tx of [cx - 4, cx + 4]) {
        P.col(tx, by - 4, by - 1, PAL.beam);
        P.px(tx, by - 5, PAL.fire); P.px(tx, by - 6, PAL.fireY);
      }
      this._win(P, cx - 9, by - 10, n); this._win(P, cx + 7, by - 11, n);
      // corna sul colmo
      P.px(cx - 2, apexY - 1, PAL.cream); P.px(cx - 3, apexY - 2, PAL.cream); P.px(cx - 3, apexY - 3, PAL.cream);
      P.px(cx + 1, apexY - 1, PAL.cream); P.px(cx + 2, apexY - 2, PAL.cream); P.px(cx + 2, apexY - 3, PAL.cream);
      this._flag(P, cx, apexY - 3, PAL.gold);
    },

    // capanna rotonda col tetto d'oro (iconica di Cultures)
    casa(P, cx, by, n) {
      // muro circolare in graticcio
      for (let x = cx - 8; x <= cx + 7; x++) {
        const edge = (x === cx - 8 || x === cx + 7);
        P.col(x, by - 5, by, edge ? PAL.plasterD : ((x - cx) % 4 === 0 ? PAL.beam : PAL.plaster));
        P.px(x, by, 'rgba(20,14,6,0.3)');
      }
      this._goldCone(P, cx, by - 20, by - 5, 11);
      this._door(P, cx, by, 4, 4);
      this._win(P, cx - 6, by - 4, n);
      this._win(P, cx + 4, by - 4, n);
    },

    fattoria(P, cx, by, n) {
      // campo di grano davanti
      for (let i = 0; i < 12; i++) {
        const x = cx - 16 + ((pr(i, 1, 2) * 13) | 0), y = by - 1 + ((pr(i, 5, 2) * 4) | 0);
        P.px(x, y, PAL.gold); P.px(x, y - 1, PAL.thatchL);
      }
      this._hut(P, { cx: cx + 4, by: by - 2, w: 6, h: 6, roofH: 5, wallL: PAL.woodD, wallR: PAL.wood });
      this._door(P, cx + 4, by - 2, 3, 4);
      this._win(P, cx + 8, by - 8, n);
      // covone
      P.r(cx - 10, by - 5, 4, 3, PAL.thatch);
      P.r(cx - 9, by - 6, 2, 1, PAL.thatchL);
    },

    taglialegna(P, cx, by, n) {
      this._hut(P, { cx: cx - 3, by: by - 1, w: 5, h: 6, roofH: 4, wallL: PAL.woodD, wallR: PAL.wood, roofL: PAL.woodD, roofR: PAL.woodL, edge: PAL.woodL });
      this._door(P, cx - 3, by - 1, 3, 4);
      this._win(P, cx - 6, by - 6, n);
      // catasta di tronchi
      for (let i = 0; i < 3; i++) {
        P.r(cx + 5 + (i === 1 ? 1 : 0), by - 2 - i * 2, 6 - (i === 2 ? 2 : 0), 2, i % 2 ? PAL.woodL : PAL.wood);
        P.px(cx + 5, by - 2 - i * 2, PAL.woodD);
      }
      // ceppo con ascia
      P.r(cx - 12, by - 2, 3, 2, PAL.woodD);
      P.px(cx - 11, by - 4, PAL.stoneL); P.px(cx - 11, by - 3, PAL.beam);
    },

    cava(P, cx, by, n) {
      // blocchi di pietra squadrati
      P.r(cx - 8, by - 5, 6, 5, PAL.stone); P.r(cx - 8, by - 5, 6, 1, PAL.stoneL);
      P.r(cx - 2, by - 4, 5, 4, PAL.stoneD); P.r(cx - 2, by - 4, 5, 1, PAL.stone);
      P.r(cx - 5, by - 9, 5, 4, PAL.stoneL); P.r(cx - 5, by - 9, 5, 1, PAL.cream);
      P.r(cx + 4, by - 7, 4, 3, PAL.stone); P.r(cx + 4, by - 7, 4, 1, PAL.stoneL);
      // struttura in legno
      P.col(cx + 9, by - 12, by, PAL.beam);
      P.col(cx - 11, by - 12, by, PAL.beam);
      P.r(cx - 11, by - 13, 21, 1, PAL.wood);
      // piccone
      P.px(cx + 6, by - 2, PAL.stoneL); P.col(cx + 6, by - 1, by, PAL.wood);
    },

    // --- catena del contadino ---
    panificio(P, cx, by, n) {
      this._hut(P, {
        cx, by, w: 8, h: 8, roofH: 6,
        roofL: PAL.slateD, roofR: PAL.slate, edge: PAL.slateL,
      });
      this._beams(P, cx, by, 8, 8);
      // trave orizzontale (graticcio)
      for (let d = 1; d <= 8; d++) {
        const yb = by - ((d - 1) >> 1) - 4;
        P.px(cx - d, yb, PAL.beam); P.px(cx + d - 1, yb, PAL.beam);
      }
      this._door(P, cx, by, 3, 5);
      this._win(P, cx + 4, by - 8, n);
      // insegna: pagnotta dorata
      P.r(cx - 6, by - 9, 3, 2, PAL.gold);
      P.px(cx - 5, by - 10, PAL.goldRL);
      // forno con comignolo
      P.r(cx + 6, by - 13, 2, 5, PAL.stoneD);
      P.px(cx + 6, by - 14, PAL.outline); P.px(cx + 7, by - 14, PAL.outline);
    },

    // --- catena del boscaiolo ---
    segheria(P, cx, by, n) {
      // tettoia aperta a falda unica
      P.col(cx - 9, by - 10, by, PAL.beam);
      P.col(cx + 8, by - 8, by, PAL.beam);
      for (let x = -10; x <= 9; x++) {
        const y = by - 10 + Math.round((x + 10) * 0.14);
        P.px(cx + x, y, PAL.woodD);
        P.px(cx + x, y + 1, PAL.wood);
      }
      // lama circolare
      P.r(cx - 2, by - 6, 5, 5, PAL.stoneL);
      P.px(cx - 2, by - 6, PAL.stoneD); P.px(cx + 2, by - 6, PAL.stoneD);
      P.px(cx - 2, by - 2, PAL.stoneD); P.px(cx + 2, by - 2, PAL.stoneD);
      P.px(cx, by - 4, PAL.outline);
      // tronchi e assi
      for (let i = 0; i < 2; i++) P.r(cx - 12, by - 2 - i * 2, 6, 2, i ? PAL.woodL : PAL.wood);
      for (let i = 0; i < 3; i++) P.r(cx + 5, by - 1 - i, 8 - i * 2, 1, PAL.woodL);
    },

    falegname(P, cx, by, n) {
      this._hut(P, {
        cx, by, w: 7, h: 8, roofH: 5,
        wallL: PAL.woodD, wallR: PAL.wood,
        roofL: PAL.woodD, roofR: PAL.woodL, edge: PAL.woodL,
      });
      this._door(P, cx, by, 3, 5);
      this._win(P, cx + 3, by - 8, n);
      // insegna: sedia
      P.px(cx - 6, by - 10, PAL.gold); P.px(cx - 6, by - 9, PAL.gold);
      P.px(cx - 5, by - 9, PAL.gold); P.px(cx - 6, by - 8, PAL.gold);
      // banco da lavoro con asse
      P.r(cx + 6, by - 3, 6, 1, PAL.woodL);
      P.col(cx + 7, by - 2, by, PAL.beam);
      P.col(cx + 10, by - 2, by, PAL.beam);
      P.r(cx + 7, by - 4, 4, 1, PAL.cream);
    },

    // --- catena del cavatore ---
    scalpellino(P, cx, by, n) {
      this._hut(P, {
        cx: cx + 3, by: by - 1, w: 6, h: 6, roofH: 4,
        wallL: PAL.stoneD, wallR: PAL.stone,
        roofL: PAL.woodD, roofR: PAL.wood, edge: PAL.woodL,
      });
      this._door(P, cx + 3, by - 1, 3, 4);
      // blocchi squadrati in mostra
      P.r(cx - 10, by - 4, 4, 4, PAL.stoneL); P.r(cx - 10, by - 4, 4, 1, PAL.cream);
      P.r(cx - 6, by - 3, 4, 3, PAL.stone); P.r(cx - 6, by - 3, 4, 1, PAL.stoneL);
      P.r(cx - 9, by - 7, 4, 3, PAL.cream); P.px(cx - 9, by - 7, PAL.stoneL);
      // scalpello e mazza
      P.px(cx - 1, by - 1, PAL.stoneD); P.col(cx - 1, by - 1, by, PAL.wood);
    },

    scultore(P, cx, by, n) {
      this._hut(P, {
        cx: cx + 4, by, w: 6, h: 7, roofH: 5,
        roofL: PAL.slateD, roofR: PAL.slate, edge: PAL.slateL,
      });
      this._door(P, cx + 4, by, 3, 4);
      this._win(P, cx + 7, by - 7, n);
      // statua in lavorazione davanti alla bottega
      P.r(cx - 9, by - 2, 6, 2, PAL.stone);
      P.r(cx - 8, by - 8, 3, 6, PAL.stoneL);
      P.px(cx - 7, by - 9, PAL.cream);
      P.px(cx - 5, by - 7, PAL.stoneD);
    },

    cappella(P, cx, by, n) {
      const { apexY } = this._hut(P, { cx, by, w: 6, h: 8, roofH: 5, roofL: PAL.slateD, roofR: PAL.slate, edge: PAL.slateL });
      this._door(P, cx, by, 3, 5);
      this._win(P, cx + 3, by - 8, n, 2, 3);
      this._win(P, cx - 5, by - 8, n, 2, 3);
      this._cross(P, cx, apexY);
    },

    mercato(P, cx, by, n) {
      // pali
      P.col(cx - 7, by - 8, by, PAL.beam);
      P.col(cx + 6, by - 8, by, PAL.beam);
      // tenda a strisce
      const W = 9, roofH = 5, apexY = by - 8 - roofH;
      for (let d = 1; d <= W; d++) {
        const bot = by - ((d - 1) >> 1) - 8;
        const top = Math.round(apexY + (d - 1) * (roofH - 1) / W);
        const stripe = ((d / 2) | 0) % 2;
        P.col(cx - d, top, bot + 1, stripe ? PAL.red : PAL.cream);
        P.col(cx + d - 1, top, bot + 1, stripe ? PAL.cream : PAL.red);
      }
      // banco e merci
      P.r(cx - 5, by - 4, 10, 3, PAL.wood);
      P.r(cx - 5, by - 5, 10, 1, PAL.woodL);
      P.px(cx - 3, by - 6, PAL.gold); P.px(cx - 1, by - 6, PAL.red); P.px(cx + 2, by - 6, PAL.leaf);
    },

    mulino(P, cx, by, n) {
      // torre in pietra
      for (let d = 1; d <= 5; d++) {
        const yb = by - ((d - 1) >> 1);
        P.col(cx - d, yb - 16, yb, PAL.stoneD);
        P.col(cx + d - 1, yb - 16, yb, PAL.stone);
      }
      // cappello
      const apexY = by - 16 - 5;
      for (let d = 1; d <= 6; d++) {
        const bot = by - ((d - 1) >> 1) - 16;
        const top = Math.round(apexY + (d - 1) * 4 / 6);
        P.col(cx - d, top, bot, PAL.woodD);
        P.col(cx + d - 1, top, bot, PAL.wood);
      }
      this._door(P, cx, by, 3, 4);
      this._win(P, cx + 1, by - 12, n);
      // pale a X
      const hub = { x: cx, y: apexY + 2 };
      for (const [sx, sy] of [[1, -1], [1, 1], [-1, -1], [-1, 1]]) {
        for (let i = 2; i <= 9; i++) {
          P.px(hub.x + sx * i, hub.y + sy * ((i / 2) | 0), PAL.beam);
          if (i > 3 && i % 2 === 0) {
            P.px(hub.x + sx * i, hub.y + sy * ((i / 2) | 0) - 1, PAL.cream);
          }
        }
      }
      P.px(hub.x, hub.y, PAL.outline);
    },

    giardino(P, cx, by, n) {
      // siepi
      P.r(cx - 10, by - 3, 5, 3, PAL.leafD);
      P.r(cx + 6, by - 4, 5, 3, PAL.leafD);
      P.r(cx - 10, by - 4, 5, 1, PAL.leaf);
      P.r(cx + 6, by - 5, 5, 1, PAL.leaf);
      // aiuola centrale
      P.r(cx - 4, by - 2, 9, 3, PAL.leaf);
      const flowers = ['#e05a6e', PAL.gold, PAL.cream, '#c77dd1'];
      for (let i = 0; i < 8; i++) {
        const x = cx - 4 + ((pr(i, 3, 4) * 9) | 0);
        const y = by - 2 + ((pr(i, 8, 4) * 3) | 0);
        P.px(x, y, flowers[i % 4]);
      }
      // alberello
      P.col(cx, by - 8, by - 5, PAL.woodD);
      P.r(cx - 2, by - 12, 5, 5, PAL.leaf);
      P.px(cx - 1, by - 12, PAL.leafL); P.px(cx + 1, by - 9, PAL.leafD);
    },

    torre(P, cx, by, n) {
      for (let d = 1; d <= 5; d++) {
        const yb = by - ((d - 1) >> 1);
        P.col(cx - d, yb - 20, yb, PAL.stoneD);
        P.col(cx + d - 1, yb - 20, yb, PAL.stone);
        P.px(cx - d, yb - 20, PAL.stoneL);
        P.px(cx + d - 1, yb - 20, PAL.stoneL);
      }
      // pietre in evidenza
      for (let i = 0; i < 10; i++) {
        const x = cx - 5 + ((pr(i, 2, 6) * 10) | 0);
        const y = by - 18 + ((pr(i, 7, 6) * 16) | 0);
        P.px(x, y, pr(i, 1, 6) > 0.5 ? PAL.stoneL : '#8b8578');
      }
      this._crenels(P, cx, by, 5, 20, PAL.stoneD);
      this._door(P, cx, by, 3, 4);
      this._win(P, cx - 1, by - 14, n, 2, 3);
      this._flag(P, cx, by - 21, PAL.red);
    },

    taverna(P, cx, by, n) {
      this._hut(P, { cx, by, w: 9, h: 8, roofH: 7 });
      this._beams(P, cx, by, 9, 8);
      this._door(P, cx, by, 4, 5);
      this._win(P, cx - 6, by - 8, n); this._win(P, cx + 4, by - 8, n);
      this._win(P, cx - 3, by - 9, n);
      // insegna appesa
      P.col(cx + 9, by - 12, by - 8, PAL.beam);
      P.r(cx + 8, by - 8, 3, 3, PAL.gold);
      // botte
      P.r(cx - 12, by - 4, 4, 4, PAL.wood);
      P.r(cx - 12, by - 3, 4, 1, PAL.woodD);
    },

    caserma(P, cx, by, n) {
      this._hut(P, { cx, by, w: 8, h: 8, roofH: 5, wallL: PAL.stoneD, wallR: PAL.stone, roofL: PAL.slateD, roofR: PAL.slate, edge: PAL.slateL });
      this._door(P, cx, by, 4, 5);
      this._win(P, cx - 6, by - 8, n);
      // scudo appeso: croce rossa su fondo chiaro
      P.r(cx + 3, by - 9, 4, 5, PAL.cream);
      P.r(cx + 4, by - 9, 2, 5, PAL.red);
      P.r(cx + 3, by - 7, 4, 1, PAL.red);
      this._flag(P, cx, by - 8 - 5 - 1, PAL.red);
    },

    chiesa(P, cx, by, n) {
      // navata
      const { apexY } = this._hut(P, { cx: cx + 3, by, w: 8, h: 9, roofH: 6, roofL: PAL.slateD, roofR: PAL.slate, edge: PAL.slateL });
      this._door(P, cx + 3, by, 4, 6);
      this._win(P, cx + 8, by - 10, n, 2, 3);
      // campanile
      for (let d = 1; d <= 4; d++) {
        const yb = by - 2 - ((d - 1) >> 1);
        P.col(cx - 10 - d, yb - 17, yb, PAL.plasterD);
        P.col(cx - 10 + d - 1, yb - 17, yb, PAL.plaster);
      }
      const tApex = by - 2 - 17 - 5;
      for (let d = 1; d <= 5; d++) {
        const bot = by - 2 - ((d - 1) >> 1) - 17;
        const top = Math.round(tApex + (d - 1) * 4 / 5);
        P.col(cx - 10 - d, top, bot, PAL.slateD);
        P.col(cx - 10 + d - 1, top, bot, PAL.slate);
      }
      this._win(P, cx - 11, by - 14, n, 2, 3);
      this._cross(P, cx - 10, tApex);
    },

    statua(P, cx, by, n) {
      // basamento
      P.r(cx - 5, by - 2, 10, 2, PAL.stone);
      P.r(cx - 5, by - 3, 10, 1, PAL.stoneL);
      P.r(cx - 3, by - 5, 6, 2, PAL.stoneD);
      // figura
      P.r(cx - 1, by - 11, 3, 6, PAL.stoneL);
      P.px(cx, by - 12, PAL.cream);                     // testa
      P.col(cx + 2, by - 15, by - 10, PAL.stoneL);      // braccio con spada
      P.px(cx + 2, by - 16, PAL.cream);
      P.px(cx - 2, by - 9, PAL.stone);                  // scudo
    },

    castello(P, cx, by, n) {
      // mastio centrale
      for (let d = 1; d <= 10; d++) {
        const yb = by - 2 - ((d - 1) >> 1);
        P.col(cx - d, yb - 13, yb, PAL.stoneD);
        P.col(cx + d - 1, yb - 13, yb, PAL.stone);
      }
      this._crenels(P, cx, by - 2, 10, 13, PAL.stoneD);
      // portone ad arco
      P.r(cx - 2, by - 7, 5, 6, PAL.door);
      P.px(cx - 2, by - 7, PAL.outline); P.px(cx + 2, by - 7, PAL.outline);
      P.r(cx - 1, by - 8, 3, 1, PAL.door);
      this._win(P, cx - 6, by - 12, n); this._win(P, cx + 4, by - 12, n);
      // torri laterali con tetto a cono
      for (const tx of [cx - 14, cx + 14]) {
        for (let d = 1; d <= 4; d++) {
          const yb = by - 4 - ((d - 1) >> 1);
          P.col(tx - d, yb - 17, yb, PAL.stoneD);
          P.col(tx + d - 1, yb - 17, yb, PAL.stone);
        }
        const tApex = by - 4 - 17 - 6;
        for (let d = 1; d <= 5; d++) {
          const bot = by - 4 - ((d - 1) >> 1) - 17;
          const top = Math.round(tApex + (d - 1) * 5 / 5);
          P.col(tx - d, top, bot, PAL.slateD);
          P.col(tx + d - 1, top, bot, PAL.slate);
        }
        this._win(P, tx - 1, by - 15, n, 2, 3);
        this._flag(P, tx, tApex, PAL.red);
      }
    },

    cattedrale(P, cx, by, n) {
      // navata maestosa
      const { apexY } = this._hut(P, { cx: cx + 4, by, w: 11, h: 13, roofH: 9, roofL: PAL.slateD, roofR: PAL.slate, edge: PAL.slateL });
      this._door(P, cx + 4, by, 4, 7);
      // rosone dorato
      P.r(cx + 3, by - 12, 3, 3, PAL.gold);
      P.px(cx + 4, by - 11, PAL.red);
      this._win(P, cx + 10, by - 12, n, 2, 4);
      this._win(P, cx - 2, by - 11, n, 2, 4);
      this._cross(P, cx + 4, apexY);
      // torre campanaria
      for (let d = 1; d <= 5; d++) {
        const yb = by - 2 - ((d - 1) >> 1);
        P.col(cx - 14 - d, yb - 22, yb, PAL.plasterD);
        P.col(cx - 14 + d - 1, yb - 22, yb, PAL.plaster);
      }
      const tApex = by - 2 - 22 - 6;
      for (let d = 1; d <= 6; d++) {
        const bot = by - 2 - ((d - 1) >> 1) - 22;
        const top = Math.round(tApex + (d - 1) * 5 / 6);
        P.col(cx - 14 - d, top, bot, PAL.slateD);
        P.col(cx - 14 + d - 1, top, bot, PAL.slate);
      }
      this._win(P, cx - 15, by - 18, n, 2, 3);
      this._win(P, cx - 15, by - 12, n, 2, 3);
      this._cross(P, cx - 14, tApex);
    },
  },

  // ---------- accampamento nemico ----------
  camp() {
    return this._mk('camp', 44, 30, 22, 27, (P) => {
      const tent = (tx, tby, w, h, c1, c2) => {
        for (let y = 0; y <= h; y++) {
          const hw = Math.max(1, Math.round(w * y / h));
          for (let x = tx - hw; x <= tx + hw; x++) {
            P.px(x, tby - h + y, x < tx ? c1 : c2);
          }
        }
        P.col(tx, tby - 2, tby, PAL.outline);  // apertura
      };
      tent(12, 26, 7, 9, PAL.redD, PAL.red);
      tent(30, 23, 5, 7, '#6b4a3a', '#87604c');
      // vessillo nero
      P.col(22, 8, 18, PAL.beam);
      P.r(23, 8, 5, 3, '#26221e');
      P.px(24, 9, PAL.red);
      // fuoco da campo
      P.px(21, 25, PAL.fire); P.px(22, 25, PAL.fireY); P.px(23, 25, PAL.fire);
      P.px(22, 24, PAL.fire); P.px(22, 26, PAL.woodD); P.px(20, 26, PAL.woodD);
      // casse
      P.r(35, 24, 4, 3, PAL.wood); P.r(35, 24, 4, 1, PAL.woodL);
    });
  },

  // ---------- soldatino in marcia ----------
  soldier() {
    return this._mk('soldier', 8, 11, 4, 10, (P) => {
      P.r(3, 0, 3, 2, PAL.stoneL);      // elmo
      P.px(4, 2, '#e8c39a');            // viso
      P.r(3, 3, 3, 4, PAL.red);         // tunica
      P.px(2, 4, '#e8c39a');            // braccio
      P.r(6, 3, 2, 4, PAL.cream);       // scudo
      P.px(6, 4, PAL.red);
      P.px(3, 7, PAL.beam); P.px(5, 7, PAL.beam);   // gambe
      P.px(3, 8, PAL.beam); P.px(5, 8, PAL.beam);
      P.col(1, 0, 5, PAL.stoneD);       // lancia
    });
  },

  // dataURL per le icone della UI (ritagliate al contenuto)
  iconURL(type) {
    const key = 'url:' + type;
    if (this._c[key]) return this._c[key];
    const src = this.building(type, false);
    const g = src.getContext('2d');
    const data = g.getImageData(0, 0, src.width, src.height).data;
    let minX = src.width, maxX = 0, minY = src.height, maxY = 0;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        if (data[(y * src.width + x) * 4 + 3] > 10) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    const w = Math.max(1, maxX - minX + 1), h = Math.max(1, maxY - minY + 1);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d').drawImage(src, minX, minY, w, h, 0, 0, w, h);
    this._c[key] = out.toDataURL();
    return this._c[key];
  },
};
