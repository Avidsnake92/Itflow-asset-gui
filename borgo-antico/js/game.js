// ============================================================
// Borgo Antico — logica di gioco
// ============================================================
'use strict';

const Game = {
  state: null,

  // agganciati dalla UI
  notify(msg, opts) {},
  showBanner(msg, kind) {},

  // ---------- partita ----------
  newGame() {
    const seed = (Math.random() * 1e9) | 0;
    const world = World.generate(seed);
    this.state = {
      version: 1,
      seed,
      grid: world.grid,
      camps: world.camps,
      buildings: [],
      res: {
        legna: 80, pietra: 30, cibo: 60, oro: 20, fede: 0,
        farina: 0, pane: 0, assi: 0, mobili: 0, armi: 0, blocchi: 0,
        acqua: 0, miele: 0, idromele: 0, pelle: 0, scarpe: 0, ferro: 0, attrezzi: 0,
        torta: 0,
      },
      prof: { contadino: 0, boscaiolo: 0, cavatore: 0 },
      pop: 5,
      soldati: 0,
      era: 0,
      time: 0,
      effects: { raccoltoUntil: 0, scudoUntil: 0 },
      raid: null,
      attack: null,
      goldenAge: false,
      explored: new Array(CONFIG.MAP * CONFIG.MAP).fill(0),
      scout: null,
    };
    // municipio al centro
    const c = CONFIG.MAP >> 1;
    this.reveal(c, c, SCOUT.START_REVEAL);
    this.placeBuilding(c, c, 'municipio', true);
    this.save();
  },

  save() {
    if (!this.state) return;
    const s = this.state;
    const data = {
      version: s.version, seed: s.seed,
      terrain: s.grid.map(c => c.t),
      buildings: s.buildings,
      camps: s.camps,
      res: s.res, prof: s.prof, pop: s.pop, soldati: s.soldati, era: s.era,
      time: s.time, effects: s.effects, raid: s.raid, attack: s.attack,
      goldenAge: s.goldenAge,
      explored: s.explored.join(''), scout: s.scout,
    };
    try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  },

  load() {
    let data;
    try { data = JSON.parse(localStorage.getItem(CONFIG.SAVE_KEY)); } catch (e) { return false; }
    if (!data || data.version !== 1) return false;
    const world = World.generate(data.seed);
    const grid = world.grid;
    data.terrain.forEach((t, i) => { grid[i].t = t; });
    this.state = {
      version: 1, seed: data.seed, grid,
      camps: data.camps, buildings: [],
      // i salvataggi vecchi non hanno le nuove risorse/mestieri: si integrano
      res: Object.assign({
        legna: 0, pietra: 0, cibo: 0, oro: 0, fede: 0,
        farina: 0, pane: 0, assi: 0, mobili: 0, armi: 0, blocchi: 0,
        acqua: 0, miele: 0, idromele: 0, pelle: 0, scarpe: 0, ferro: 0, attrezzi: 0,
        torta: 0,
      }, data.res),
      prof: Object.assign({ contadino: 0, boscaiolo: 0, cavatore: 0 }, data.prof),
      pop: data.pop, soldati: data.soldati, era: data.era,
      time: data.time, effects: data.effects, raid: data.raid, attack: data.attack,
      goldenAge: !!data.goldenAge,
      // i salvataggi precedenti alla nebbia di guerra hanno tutto esplorato
      explored: data.explored
        ? data.explored.split('').map(Number)
        : new Array(CONFIG.MAP * CONFIG.MAP).fill(1),
      scout: data.scout || null,
    };
    for (const b of data.buildings) {
      const placed = this.placeBuilding(b.x, b.y, b.type, true);
      if (b.mode) placed.mode = b.mode;
    }
    return true;
  },

  // ---------- risorse ----------
  canAfford(cost) {
    for (const k in cost) if ((this.state.res[k] || 0) < cost[k]) return false;
    return true;
  },
  pay(cost) {
    for (const k in cost) this.state.res[k] -= cost[k];
  },

  // ---------- valori derivati ----------
  popMax() {
    let m = 0;
    for (const b of this.state.buildings) m += BUILDINGS[b.type].popMax || 0;
    return m;
  },
  soldierCap() {
    let m = 0;
    for (const b of this.state.buildings) m += BUILDINGS[b.type].soldierCap || 0;
    return m;
  },
  // soldati con armi del falegname combattono meglio (+1 a testa)
  armedSoldiers() {
    return Math.min(this.state.soldati, Math.floor(this.state.res.armi));
  },
  defense() {
    let d = this.state.soldati * 2 + this.armedSoldiers();
    for (const b of this.state.buildings) d += BUILDINGS[b.type].defense || 0;
    if (this.state.time < this.state.effects.scudoUntil) d *= 2;
    return Math.round(d);
  },
  happiness() {
    let h = 50;
    for (const b of this.state.buildings) h += BUILDINGS[b.type].happy || 0;
    h += Math.min(12, Math.floor(this.state.res.mobili / 4)); // case arredate
    if (this.state.res.pane > 1) h += 5;                      // profumo di pane
    h += Math.min(10, Math.floor(this.state.res.idromele / 3)); // idromele in tavola
    if (this.state.res.torta > 1) h += 8;                       // dolci per tutti!
    const max = this.popMax();
    if (max > 0 && this.state.pop / max > 0.9) h -= 10; // sovraffollamento
    if (this.state.res.cibo <= 0 && this.state.res.pane <= 0) h -= 25;
    return Math.max(5, Math.min(100, h));
  },

  // ---------- esplorazione ----------
  reveal(cx, cy, r) {
    const s = this.state;
    const N = CONFIG.MAP;
    const r2 = r * r;
    for (let y = Math.max(0, cy - r | 0); y <= Math.min(N - 1, cy + r | 0); y++) {
      for (let x = Math.max(0, cx - r | 0); x <= Math.min(N - 1, cx + r | 0); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) s.explored[y * N + x] = 1;
      }
    }
  },

  isExplored(x, y) {
    if (x < 0 || y < 0 || x >= CONFIG.MAP || y >= CONFIG.MAP) return false;
    return !!this.state.explored[y * CONFIG.MAP + x];
  },

  sendScout(tx, ty) {
    const s = this.state;
    if (s.scout) { this.notify('🧭 L\'esploratore è già in viaggio'); return false; }
    if (!this.canAfford(SCOUT.COST)) { this.notify('🚫 Servono 🍎' + SCOUT.COST.cibo + ' di provviste'); return false; }
    this.pay(SCOUT.COST);
    const c = CONFIG.MAP >> 1;
    s.scout = { x: c, y: c, tx, ty, phase: 'andata' };
    this.notify('🧭 L\'esploratore parte verso le terre ignote...');
    return true;
  },

  tickScout() {
    const s = this.state;
    const sc = s.scout;
    if (!sc) return;
    const dest = sc.phase === 'andata'
      ? { x: sc.tx, y: sc.ty }
      : { x: CONFIG.MAP >> 1, y: CONFIG.MAP >> 1 };
    const dx = dest.x - sc.x, dy = dest.y - sc.y;
    const dist = Math.hypot(dx, dy);
    const step = SCOUT.SPEED * CONFIG.TICK;
    if (dist <= step) {
      sc.x = dest.x; sc.y = dest.y;
      this.reveal(sc.x, sc.y, SCOUT.REVEAL + 1);
      if (sc.phase === 'andata') {
        sc.phase = 'ritorno';
        this.notify('🧭 Meta raggiunta! L\'esploratore torna a casa.');
      } else {
        s.scout = null;
        this.notify('🧭 L\'esploratore è rientrato al borgo.');
      }
      return;
    }
    sc.x += dx / dist * step;
    sc.y += dy / dist * step;
    this.reveal(sc.x, sc.y, SCOUT.REVEAL);
  },

  // ---------- mestieri ----------
  profLevel(prof) {
    const xp = this.state.prof[prof] || 0;
    const lv = PROFESSIONS[prof].levels;
    let l = 1;
    for (let i = 1; i < lv.length; i++) if (xp >= lv[i]) l = i + 1;
    return l;
  },
  profBonus(prof) {
    return 1 + PROF_LEVEL_BONUS * (this.profLevel(prof) - 1);
  },
  addProfXp(prof, amount) {
    const before = this.profLevel(prof);
    this.state.prof[prof] += amount;
    const after = this.profLevel(prof);
    if (after > before) {
      const unlock = PROFESSIONS[prof].unlocks[after];
      const p = PROFESSIONS[prof];
      this.showBanner(
        `${p.emoji} ${p.name}: livello ${after}! ` +
        (unlock ? `Sbloccato: ${BUILDINGS[unlock].emoji} ${BUILDINGS[unlock].name}` : 'Produzione della catena +15%'),
        'good');
    }
  },
  jobsNeeded() {
    let j = 0;
    for (const b of this.state.buildings) j += BUILDINGS[b.type].workers || 0;
    return j;
  },
  countType(type) {
    let n = 0;
    for (const b of this.state.buildings) if (b.type === type) n++;
    return n;
  },

  // ---------- costruzione ----------
  canBuildAt(x, y, type) {
    const s = this.state;
    const def = BUILDINGS[type];
    if (!def) return { ok: false, why: 'Edificio sconosciuto' };
    if (def.era > s.era) return { ok: false, why: 'Era non raggiunta' };
    if (def.needProf && this.profLevel(def.needProf[0]) < def.needProf[1]) {
      const p = PROFESSIONS[def.needProf[0]];
      return { ok: false, why: `Serve ${p.name} liv.${def.needProf[1]}` };
    }
    if (def.unique && this.countType(type) > 0) return { ok: false, why: 'Già costruito' };
    const cell = s.grid[y * CONFIG.MAP + x];
    if (!cell) return { ok: false, why: 'Fuori mappa' };
    if (!this.isExplored(x, y)) return { ok: false, why: 'Terra inesplorata: manda l\'esploratore' };
    if (cell.b) return { ok: false, why: 'Occupato' };
    if (cell.t === T.WATER) return { ok: false, why: "Non si costruisce sull'acqua" };
    if (cell.t === T.FOREST || cell.t === T.ROCK) return { ok: false, why: 'Terreno impervio' };
    if (def.needAdj != null && !World.neighbors(x, y).some(i => s.grid[i].t === def.needAdj)) {
      const names = { [T.WATER]: "l'acqua", [T.ROCK]: 'la roccia' };
      return { ok: false, why: 'Serve ' + (names[def.needAdj] || 'il terreno giusto') + ' accanto' };
    }
    for (const c of s.camps) {
      if (c.alive && Math.hypot(c.x - x, c.y - y) < 4) return { ok: false, why: 'Troppo vicino ai nemici' };
    }
    if (!this.canAfford(def.cost)) return { ok: false, why: 'Risorse insufficienti' };
    return { ok: true };
  },

  build(x, y, type) {
    const chk = this.canBuildAt(x, y, type);
    if (!chk.ok) { this.notify('🚫 ' + chk.why); return false; }
    this.pay(BUILDINGS[type].cost);
    this.placeBuilding(x, y, type);
    this.notify(BUILDINGS[type].emoji + ' ' + BUILDINGS[type].name + ' costruito!');
    return true;
  },

  placeBuilding(x, y, type, silent) {
    const s = this.state;
    const b = { type, x, y };
    if (BUILDINGS[type].modes) b.mode = Object.keys(BUILDINGS[type].modes)[0];
    s.buildings.push(b);
    s.grid[y * CONFIG.MAP + x].b = type;
    this.reveal(x, y, type === 'torre' ? SCOUT.TOWER_REVEAL : SCOUT.BUILD_REVEAL);
    return b;
  },

  demolish(x, y) {
    const s = this.state;
    const i = s.buildings.findIndex(b => b.x === x && b.y === y);
    if (i < 0) return;
    const type = s.buildings[i].type;
    if (type === 'municipio') { this.notify('🚫 Non puoi demolire il Municipio'); return; }
    s.buildings.splice(i, 1);
    s.grid[y * CONFIG.MAP + x].b = null;
    // rimborso 50%
    const cost = BUILDINGS[type].cost;
    for (const k in cost) s.res[k] += Math.floor(cost[k] / 2);
    this.notify('🧹 ' + BUILDINGS[type].name + ' demolito (rimborso 50%)');
  },

  // ---------- era ----------
  eraReqMissing() {
    const s = this.state;
    if (s.era >= ERAS.length - 1) return null;
    const req = ERAS[s.era + 1].req;
    const miss = [];
    if (Math.floor(s.pop) < req.pop) miss.push('👥 ' + Math.floor(s.pop) + '/' + req.pop);
    for (const k of ['legna', 'pietra', 'oro', 'fede']) {
      if (req[k] && s.res[k] < req[k]) miss.push(this.resEmoji(k) + ' ' + Math.floor(s.res[k]) + '/' + req[k]);
    }
    return miss;
  },

  upgradeEra() {
    const s = this.state;
    const miss = this.eraReqMissing();
    if (miss === null) return;
    if (miss.length) { this.notify('🚫 Requisiti mancanti'); return; }
    const req = ERAS[s.era + 1].req;
    const cost = {};
    for (const k of ['legna', 'pietra', 'oro', 'fede']) if (req[k]) cost[k] = req[k];
    this.pay(cost);
    s.era++;
    const era = ERAS[s.era];
    this.showBanner(era.emoji + ' Il tuo insediamento è ora: ' + era.name + '!', 'good');
  },

  resEmoji(k) {
    return RES_EMOJI[k] || k;
  },

  // ---------- soldati ----------
  recruit() {
    const s = this.state;
    if (s.soldati >= this.soldierCap()) { this.notify('🚫 Serve un\'altra caserma'); return; }
    if (!this.canAfford(SOLDIER_COST)) { this.notify('🚫 Servono 🍎20 💰10'); return; }
    if (s.pop < 2) { this.notify('🚫 Popolazione insufficiente'); return; }
    this.pay(SOLDIER_COST);
    s.pop -= 1;
    s.soldati += 1;
    this.notify('⚔️ Nuovo soldato arruolato');
  },

  // ---------- miracoli ----------
  castMiracle(id, target) {
    const s = this.state;
    const m = MIRACLES[id];
    if (s.res.fede < m.cost) { this.notify('🚫 Fede insufficiente (✨' + m.cost + ')'); return false; }

    if (id === 'raccolto') {
      s.res.fede -= m.cost;
      s.res.cibo += 60;
      s.effects.raccoltoUntil = s.time + 90;
      this.showBanner('🌟 Il raccolto è benedetto!', 'good');
    } else if (id === 'pioggia') {
      s.res.fede -= m.cost;
      s.res.legna += 50;
      this.growForest();
      this.showBanner('🌧️ Una pioggia rigogliosa nutre la terra!', 'good');
    } else if (id === 'scudo') {
      s.res.fede -= m.cost;
      s.effects.scudoUntil = s.time + 180;
      this.showBanner('🛡️ Uno scudo divino protegge il borgo!', 'good');
    } else if (id === 'fulmine') {
      const camp = target;
      if (!camp || !camp.alive) { this.notify('⚡ Tocca un accampamento nemico'); return false; }
      s.res.fede -= m.cost;
      camp.strength -= 25;
      Renderer.addLightning(camp.x, camp.y);
      if (camp.strength <= 0) {
        this.destroyCamp(camp, false);
        this.showBanner('⚡ Il fulmine divino ha annientato il campo nemico!', 'good');
      } else {
        this.showBanner('⚡ Il fulmine colpisce i nemici! (-25 forza)', 'good');
      }
    }
    return true;
  },

  growForest() {
    // nuovi alberi spuntano su erba adiacente ai boschi
    const s = this.state;
    const N = CONFIG.MAP;
    let grown = 0;
    for (let i = 0; i < N * N && grown < 14; i++) {
      const idx = (Math.random() * N * N) | 0;
      const cell = s.grid[idx];
      if (cell.t !== T.GRASS || cell.b) continue;
      const x = idx % N, y = (idx / N) | 0;
      const nearForest = World.neighbors(x, y).some(n => s.grid[n].t === T.FOREST);
      if (nearForest) { cell.t = T.FOREST; grown++; }
    }
  },

  // ---------- nemici ----------
  destroyCamp(camp, looted) {
    camp.alive = false;
    camp.respawnAt = this.state.time + ENEMY.RESPAWN_AFTER;
    camp.generation++;
    if (looted) {
      const loot = { oro: camp.strength * 2, pietra: camp.strength, fede: 10 };
      for (const k in loot) this.state.res[k] += loot[k];
      this.notify('💰 Bottino: 💰' + loot.oro + ' 🪨' + loot.pietra + ' ✨10');
    }
    this.checkGoldenAge();
  },

  attackCamp(camp) {
    const s = this.state;
    if (s.soldati < 1) { this.notify('🚫 Non hai soldati'); return; }
    if (s.attack) { this.notify('🚫 I soldati sono già in marcia'); return; }
    const idx = s.camps.indexOf(camp);
    s.attack = { camp: idx, soldiers: s.soldati, at: s.time + ENEMY.ATTACK_TRAVEL };
    s.soldati = 0;
    this.notify('⚔️ ' + s.attack.soldiers + ' soldati in marcia...');
  },

  resolveAttack() {
    const s = this.state;
    const atk = s.attack;
    s.attack = null;
    const camp = s.camps[atk.camp];
    if (!camp.alive) { s.soldati += atk.soldiers; return; }
    const power = atk.soldiers * 2 + Math.min(atk.soldiers, Math.floor(s.res.armi));
    if (power >= camp.strength) {
      const losses = Math.min(atk.soldiers - 1, Math.floor(camp.strength / 5));
      s.soldati += atk.soldiers - losses;
      this.destroyCamp(camp, true);
      this.showBanner('🏆 Vittoria! Campo nemico saccheggiato' + (losses ? ' (' + losses + ' caduti)' : ''), 'good');
    } else {
      const survivors = Math.floor(atk.soldiers / 3);
      s.soldati += survivors;
      camp.strength = Math.max(3, camp.strength - Math.floor(power / 2));
      this.showBanner('💔 Sconfitta... i superstiti tornano a casa. Il nemico è indebolito.');
    }
  },

  scheduleRaids() {
    const s = this.state;
    if (s.raid || s.time < ENEMY.FIRST_RAID_AFTER) return;
    for (const camp of s.camps) {
      if (!camp.alive || camp.strength < 12) continue;
      if (s.time - camp.lastRaid < ENEMY.RAID_COOLDOWN) continue;
      // probabilità dolce: ~1 ogni 90s di media quando pronto
      if (Math.random() < CONFIG.TICK / 90) {
        s.raid = { camp: s.camps.indexOf(camp), at: s.time + ENEMY.RAID_WARNING };
        camp.lastRaid = s.time;
        this.showBanner('⚔️ Una razzia si avvicina! Preparati a difenderti!');
        return;
      }
    }
  },

  resolveRaid() {
    const s = this.state;
    const raid = s.raid;
    s.raid = null;
    const camp = s.camps[raid.camp];
    if (!camp.alive) return;
    const power = Math.round(camp.strength * (0.5 + Math.random() * 0.3));
    const def = this.defense();
    if (def >= power) {
      camp.strength = Math.max(3, camp.strength - Math.ceil(power / 2));
      const losses = Math.min(s.soldati, Math.floor(power / 12));
      s.soldati -= losses;
      s.res.fede += 5;
      this.showBanner('🛡️ Razzia respinta! Il popolo ti acclama (+✨5)', 'good');
    } else {
      const dmg = Math.min(0.25, (power - def) / power * 0.25);
      for (const k of ['legna', 'cibo', 'oro']) {
        s.res[k] = Math.max(0, Math.floor(s.res[k] * (1 - dmg)));
      }
      s.soldati = Math.max(0, s.soldati - Math.ceil(s.soldati / 3));
      this.showBanner('🔥 I razziatori hanno rubato parte delle scorte! Costruisci torri e recluta soldati.');
    }
  },

  checkGoldenAge() {
    const s = this.state;
    if (s.goldenAge) return;
    if (s.era === ERAS.length - 1 && this.countType('cattedrale') > 0 &&
        s.camps.every(c => !c.alive)) {
      s.goldenAge = true;
      this.showBanner("🌅 ETÀ DELL'ORO! Il tuo regno vive in pace e prosperità. Continua a costruire, con calma...", 'good');
    }
  },

  // ---------- tick economia (1/s) ----------
  tick() {
    const s = this.state;
    if (!s) return;
    s.time += CONFIG.TICK;

    const jobs = this.jobsNeeded();
    const eff = jobs > 0 ? Math.min(1, s.pop / jobs) : 1;
    const harvest = s.time < s.effects.raccoltoUntil ? 2 : 1;
    const xpGain = {};   // xp guadagnata dai mestieri in questo tick

    // le scarpe del calzolaio velocizzano tutti i lavoratori (fino a +10%)
    const shoeMult = 1 + 0.1 * Math.min(1, s.res.scarpe / Math.max(1, s.pop));
    // la scuola accelera l'apprendimento dei mestieri
    let xpMult = 1;
    for (const b of s.buildings) xpMult += BUILDINGS[b.type].xpBoost || 0;
    xpMult = Math.min(2, xpMult);

    for (const b of s.buildings) {
      const def = BUILDINGS[b.type];
      let mult = eff * shoeMult;
      if (def.chain) mult *= this.profBonus(def.chain);   // esperienza del mestiere
      if (def.adjBonus) {
        const n = World.neighbors(b.x, b.y)
          .filter(i => s.grid[i].t === def.adjBonus.terrain).length;
        mult *= 1 + def.adjBonus.mult * n;
      }
      // un magazzino adiacente snellisce la logistica
      if (World.neighbors(b.x, b.y).some(i => s.grid[i].b === 'magazzino')) mult *= 1.1;
      // gli attrezzi del fabbro potenziano chi lavora (e si consumano piano)
      if ((def.prod || def.conv || def.modes) && def.workers && s.res.attrezzi > 0.1) {
        mult *= 1.15;
        s.res.attrezzi = Math.max(0, s.res.attrezzi - 0.004 * CONFIG.TICK);
      }

      let worked = false;

      // produzione semplice
      if (def.prod) {
        for (const k in def.prod) {
          let amount = def.prod[k] * mult;
          if (k === 'cibo') {
            const cell = s.grid[b.y * CONFIG.MAP + b.x];
            if (cell.t === T.FERTILE) amount *= 1.5;
            amount *= harvest;
          }
          s.res[k] += amount * CONFIG.TICK;
        }
        worked = true;
      }

      // trasformazione, anche con più ingredienti (es. farina + acqua)
      const conv = def.conv || (def.modes && def.modes[b.mode]);
      if (conv) {
        let ratio = 1;   // limitata dall'ingrediente più scarso
        for (const k in conv.in) {
          const want = conv.in[k] * eff * CONFIG.TICK;
          ratio = Math.min(ratio, want > 0 ? Math.min(1, s.res[k] / want) : 1);
        }
        if (ratio > 0.003) {
          for (const k in conv.in) {
            s.res[k] = Math.max(0, s.res[k] - conv.in[k] * eff * ratio * CONFIG.TICK);
          }
          for (const k in conv.out) {
            s.res[k] += conv.out[k] * mult * ratio * CONFIG.TICK;
          }
          worked = true;
        }
      }

      // il lavoro insegna: xp per la catena del mestiere
      if (worked && def.chain) {
        xpGain[def.chain] = (xpGain[def.chain] || 0) + eff * xpMult * CONFIG.TICK;
      }
    }
    for (const p in xpGain) this.addProfXp(p, xpGain[p]);

    // esploratore in viaggio
    this.tickScout();

    // consumo: il cibo migliore prima, come in Cultures
    // (torta nutre x5, pane x3, poi il grano)
    let need = (s.pop * 0.1 + s.soldati * 0.15) * CONFIG.TICK;
    const tortaEaten = Math.min(s.res.torta, need / 5);
    s.res.torta -= tortaEaten;
    need -= tortaEaten * 5;
    const paneEaten = Math.min(s.res.pane, need / 3);
    s.res.pane -= paneEaten;
    need -= paneEaten * 3;
    if (need > 0) s.res.cibo = Math.max(0, s.res.cibo - need);

    // crescita popolazione
    const max = this.popMax();
    const fed = s.res.cibo > 5 || s.res.pane > 2 || s.res.torta > 1;
    if (fed && s.pop < max) {
      s.pop += 0.02 * (this.happiness() / 50) * CONFIG.TICK;
    } else if (s.res.cibo <= 0 && s.res.pane <= 0 && s.res.torta <= 0 && s.pop > 3) {
      s.pop -= 0.01 * CONFIG.TICK; // declino dolce, mai catastrofico
    }
    s.pop = Math.min(s.pop, max);

    // nemici
    for (const camp of s.camps) {
      if (camp.alive) {
        if (s.time % ENEMY.GROW_EVERY < CONFIG.TICK && camp.strength < ENEMY.MAX_STRENGTH) {
          camp.strength++;
        }
      } else if (camp.respawnAt && s.time >= camp.respawnAt) {
        camp.alive = true;
        camp.strength = Math.max(6, Math.floor(ENEMY.START_STRENGTH[0] * Math.pow(0.8, camp.generation)) + 4);
        camp.respawnAt = 0;
        if (!s.goldenAge) this.notify('🏴 Nuovi predoni si accampano ai confini...');
      }
    }
    this.scheduleRaids();
    if (s.raid && s.time >= s.raid.at) this.resolveRaid();
    if (s.attack && s.time >= s.attack.at) this.resolveAttack();
    this.checkGoldenAge();
  },
};
