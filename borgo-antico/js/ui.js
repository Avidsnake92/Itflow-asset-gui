// ============================================================
// Borgo Antico — interfaccia utente
// ============================================================
'use strict';

const UI = {
  buildMode: null,     // tipo edificio in piazzamento
  targeting: null,     // miracolo che richiede un bersaglio
  bannerTimer: null,

  $(id) { return document.getElementById(id); },

  init() {
    Game.notify = (msg) => this.toast(msg);
    Game.showBanner = (msg, kind) => this.banner(msg, kind);

    this.$('btn-build').onclick = () => this.togglePanel('panel-build', () => this.renderBuildList());
    this.$('btn-miracles').onclick = () => this.togglePanel('panel-miracles', () => this.renderMiracles());
    this.$('btn-kingdom').onclick = () => this.togglePanel('panel-kingdom', () => this.renderKingdom());
    this.$('btn-menu').onclick = () => this.togglePanel('panel-menu');

    document.querySelectorAll('[data-close]').forEach(b => {
      b.onclick = () => this.closePanels();
    });

    this.$('btn-save').onclick = () => { Game.save(); this.toast('💾 Partita salvata'); };
    this.$('btn-help').onclick = () => { this.closePanels(); this.$('panel-help').classList.remove('hidden'); };
    this.$('btn-new').onclick = () => {
      if (confirm('Vuoi davvero ricominciare da capo? Il borgo attuale andrà perduto.')) {
        Game.newGame();
        const c = CONFIG.MAP >> 1;
        const p = Renderer.tileToWorld(c, c);
        Renderer.cam.x = p.x; Renderer.cam.y = p.y;
        this.closePanels();
        this.toast('🏕️ Una nuova storia ha inizio...');
      }
    };

    this.$('place-ok').onclick = () => this.confirmPlace();
    this.$('place-no').onclick = () => this.cancelPlace();
  },

  // ---------- pannelli ----------
  panels: ['panel-build', 'panel-miracles', 'panel-kingdom', 'panel-menu', 'panel-select', 'panel-help'],

  closePanels() {
    for (const id of this.panels) this.$(id).classList.add('hidden');
  },

  togglePanel(id, render) {
    const wasOpen = !this.$(id).classList.contains('hidden');
    this.closePanels();
    this.cancelPlace();
    this.targeting = null;
    if (!wasOpen) {
      if (render) render();
      this.$(id).classList.remove('hidden');
    }
  },

  // ---------- toast e banner ----------
  toast(msg) {
    const box = this.$('toast-box');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3200);
    while (box.children.length > 3) box.firstChild.remove();
  },

  banner(msg, kind) {
    const b = this.$('banner');
    b.textContent = msg;
    b.className = kind === 'good' ? 'good' : '';
    b.classList.remove('hidden');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.add('hidden'), 4500);
  },

  // ---------- costruzione ----------
  renderBuildList() {
    const list = this.$('build-list');
    list.innerHTML = '';
    const s = Game.state;
    for (const [id, def] of Object.entries(BUILDINGS)) {
      if (def.unbuildable) continue;
      const eraLocked = def.era > s.era;
      const profLocked = def.needProf && Game.profLevel(def.needProf[0]) < def.needProf[1];
      const locked = eraLocked || profLocked;
      const afford = Game.canAfford(def.cost);
      const card = document.createElement('div');
      card.className = 'card' + (locked ? ' locked' : (!afford ? ' unaffordable' : ''));
      const costTxt = Object.entries(def.cost)
        .map(([k, v]) => Game.resEmoji(k) + v).join(' ') || '—';
      let lockTxt = costTxt;
      if (eraLocked) lockTxt = '🔒 ' + ERAS[def.era].name;
      else if (profLocked) lockTxt = '🔒 ' + PROFESSIONS[def.needProf[0]].name + ' liv.' + def.needProf[1];
      card.innerHTML =
        `<div class="emoji"><img class="spr" src="${Sprites.iconURL(id)}" alt="${def.name}"></div>` +
        `<div class="name">${def.name}</div>` +
        `<div class="cost">${lockTxt}</div>` +
        `<div class="desc">${def.desc}</div>`;
      card.onclick = () => {
        if (eraLocked) { this.toast('🔒 Si sblocca con: ' + ERAS[def.era].emoji + ' ' + ERAS[def.era].name); return; }
        if (profLocked) {
          const p = PROFESSIONS[def.needProf[0]];
          this.toast(`🔒 Serve ${p.emoji} ${p.name} livello ${def.needProf[1]}: fai lavorare la catena!`);
          return;
        }
        this.buildMode = id;
        this.closePanels();
        this.toast('👆 Tocca un punto della mappa per piazzare: ' + def.emoji);
      };
      list.appendChild(card);
    }
  },

  confirmPlace() {
    const g = Renderer.ghost;
    if (!g) return;
    if (Game.build(g.x, g.y, g.type)) {
      // resta in modalità costruzione per piazzarne altri
      Renderer.ghost = null;
      this.$('place-confirm').classList.add('hidden');
    }
  },

  cancelPlace() {
    Renderer.ghost = null;
    this.buildMode = null;
    this.$('place-confirm').classList.add('hidden');
  },

  // ---------- miracoli ----------
  renderMiracles() {
    const list = this.$('miracle-list');
    list.innerHTML = '';
    const s = Game.state;
    for (const [id, m] of Object.entries(MIRACLES)) {
      const afford = s.res.fede >= m.cost;
      const card = document.createElement('div');
      card.className = 'card' + (!afford ? ' unaffordable' : '');
      card.innerHTML =
        `<div class="emoji">${m.emoji}</div>` +
        `<div class="name">${m.name}</div>` +
        `<div class="cost">✨${m.cost}</div>` +
        `<div class="desc">${m.desc}</div>`;
      card.onclick = () => {
        if (!afford) { this.toast('🚫 Fede insufficiente'); return; }
        if (m.targeted) {
          this.targeting = id;
          this.closePanels();
          this.toast('⚡ Tocca un accampamento nemico!');
        } else {
          Game.castMiracle(id);
          this.closePanels();
        }
      };
      list.appendChild(card);
    }
  },

  // ---------- pannello regno ----------
  renderKingdom() {
    const s = Game.state;
    const el = this.$('kingdom-info');
    const era = ERAS[s.era];
    const next = ERAS[s.era + 1];
    let html = `<div class="kv"><span>Era attuale</span><b>${era.emoji} ${era.name}</b></div>`;

    if (next) {
      const miss = Game.eraReqMissing();
      const ok = miss.length === 0;
      const reqTxt = ['👥 ' + next.req.pop]
        .concat(['legna', 'pietra', 'oro', 'fede']
          .filter(k => next.req[k])
          .map(k => Game.resEmoji(k) + next.req[k]))
        .join('  ');
      html += `<p class="muted">Prossima era: <b>${next.emoji} ${next.name}</b><br>Requisiti: ${reqTxt}</p>`;
      html += `<button class="wide-btn" id="btn-era" ${ok ? '' : 'disabled'}>${next.emoji} Evolvi a ${next.name}</button>`;
      if (!ok) html += `<p class="muted">Mancano: ${miss.join('  ')}</p>`;
    } else {
      html += `<p class="muted">Hai raggiunto l'apice del medioevo. ${s.goldenAge ? "🌅 Età dell'Oro!" : 'Costruisci la Cattedrale e libera la mappa dai nemici per l\'Età dell\'Oro.'}</p>`;
    }

    // mestieri: esperienza, livelli e prossimi sblocchi
    html += `<p style="margin-top:10px"><b>⚒️ Mestieri</b></p>`;
    for (const [pid, p] of Object.entries(PROFESSIONS)) {
      const xp = s.prof[pid] || 0;
      const lvl = Game.profLevel(pid);
      const maxLvl = p.levels.length;
      let prog = 100, nextTxt = 'massimo';
      if (lvl < maxLvl) {
        const cur = p.levels[lvl - 1], next = p.levels[lvl];
        prog = Math.floor((xp - cur) / (next - cur) * 100);
        const unlock = p.unlocks[lvl + 1];
        nextTxt = unlock ? `prossimo: ${BUILDINGS[unlock].emoji} ${BUILDINGS[unlock].name}` : 'prossimo: +15% produzione';
      }
      html += `<div class="kv"><span>${p.emoji} ${p.name} <b>liv.${lvl}</b></span><span class="muted">${nextTxt}</span></div>`;
      html += `<div class="bar"><div style="width:${Math.min(100, prog)}%"></div></div>`;
    }

    const happy = Game.happiness();
    html += `<div class="kv"><span>😊 Felicità</span><b>${happy}%</b></div>`;
    html += `<div class="bar"><div style="width:${happy}%"></div></div>`;
    html += `<div class="kv"><span>👥 Popolazione</span><b>${Math.floor(s.pop)} / ${Game.popMax()}</b></div>`;
    html += `<div class="kv"><span>🛡️ Difesa</span><b>${Game.defense()}${s.time < s.effects.scudoUntil ? ' (scudo ✨)' : ''}</b></div>`;
    const armed = Game.armedSoldiers();
    html += `<div class="kv"><span>⚔️ Soldati</span><b>${s.soldati} / ${Game.soldierCap()}${armed ? ` (🏹${armed} armati)` : ''}</b></div>`;
    html += `<button class="wide-btn" id="btn-recruit">⚔️ Recluta soldato (🍎${SOLDIER_COST.cibo} 💰${SOLDIER_COST.oro})</button>`;
    html += `<button class="wide-btn" id="btn-scout" ${s.scout ? 'disabled' : ''}>🧭 ${s.scout ? 'Esploratore in viaggio...' : 'Invia esploratore (🍎' + SCOUT.COST.cibo + ')'}</button>`;

    const alive = s.camps.filter(c => c.alive);
    html += `<p class="muted" style="margin-top:8px">🏴 Accampamenti nemici attivi: ${alive.length}` +
      (alive.length ? ' — toccali sulla mappa per attaccarli.' : ' — la mappa è in pace! 🕊️') + `</p>`;

    el.innerHTML = html;
    const eraBtn = this.$('btn-era');
    if (eraBtn) eraBtn.onclick = () => { Game.upgradeEra(); this.renderKingdom(); };
    this.$('btn-recruit').onclick = () => { Game.recruit(); this.renderKingdom(); };
    const scoutBtn = this.$('btn-scout');
    if (scoutBtn && !Game.state.scout) scoutBtn.onclick = () => {
      this.targeting = 'scout';
      this.closePanels();
      this.toast('🧭 Tocca il punto della mappa da esplorare (anche nella nebbia)');
    };
  },

  // ---------- tap sulla mappa ----------
  onTapTile(x, y, sx, sy) {
    const s = Game.state;
    if (!s) return;
    const N = CONFIG.MAP;

    // destinazione dell'esploratore
    if (this.targeting === 'scout') {
      if (x < 0 || y < 0 || x >= N || y >= N) { this.toast('🧭 Tocca un punto dentro la mappa'); return; }
      if (Game.sendScout(x, y)) this.targeting = null;
      return;
    }

    // bersaglio miracolo
    if (this.targeting) {
      const camp = this.campNear(x, y);
      if (camp) {
        Game.castMiracle(this.targeting, camp);
        this.targeting = null;
      } else {
        this.toast('⚡ Tocca un accampamento nemico (o riapri i Miracoli per annullare)');
      }
      return;
    }

    // modalità costruzione: piazza il fantasma
    if (this.buildMode) {
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      const chk = Game.canBuildAt(x, y, this.buildMode);
      Renderer.ghost = { x, y, type: this.buildMode, ok: chk.ok };
      this.$('place-confirm').classList.remove('hidden');
      if (!chk.ok) this.toast('🚫 ' + chk.why);
      return;
    }

    // selezione campo nemico
    const camp = this.campNear(x, y);
    if (camp) { this.showCampPanel(camp); return; }

    if (x < 0 || y < 0 || x >= N || y >= N) { this.closePanels(); Renderer.selected = null; return; }
    const cell = s.grid[y * N + x];
    if (cell.b) { this.showBuildingPanel(x, y, cell.b); return; }

    // tile vuoto: deseleziona
    this.closePanels();
    Renderer.selected = null;
  },

  campNear(x, y) {
    return Game.state.camps.find(c =>
      c.alive && Game.isExplored(c.x, c.y) && Math.hypot(c.x - x, c.y - y) <= 2) || null;
  },

  showBuildingPanel(x, y, type) {
    const def = BUILDINGS[type];
    const b = Game.state.buildings.find(bb => bb.x === x && bb.y === y);
    Renderer.selected = { x, y };
    this.closePanels();
    this.$('select-title').innerHTML = `${def.emoji} ${def.name} <button class="close" data-close>✕</button>`;
    let html = `<p>${def.desc}</p>`;
    const convTxt = (conv) =>
      Object.entries(conv.in).map(([k, v]) => Game.resEmoji(k) + (v * 60).toFixed(0)).join(' ') +
      ' → ' +
      Object.entries(conv.out).map(([k, v]) => Game.resEmoji(k) + (v * 60).toFixed(0)).join(' ') + ' al minuto';
    if (def.prod) {
      html += '<p class="muted">Produce: ' + Object.entries(def.prod)
        .map(([k, v]) => Game.resEmoji(k) + (v * 60).toFixed(0) + '/min').join(' ') + '</p>';
    }
    if (def.conv) html += `<p class="muted">Lavora: ${convTxt(def.conv)}</p>`;
    if (def.modes && b) {
      html += `<p class="muted">Lavora: ${convTxt(def.modes[b.mode])}</p>`;
      html += `<p><b>Produzione:</b></p>`;
      for (const m of Object.keys(def.modes)) {
        const on = b.mode === m;
        const outKey = Object.keys(def.modes[m].out)[0];
        html += `<button class="wide-btn mode-btn" data-mode="${m}" ${on ? 'disabled' : ''}>` +
          `${Game.resEmoji(outKey)} ${m.charAt(0).toUpperCase() + m.slice(1)}${on ? ' ✓ (attiva)' : ''}</button>`;
      }
    }
    if (def.chain) {
      const p = PROFESSIONS[def.chain];
      html += `<p class="muted">Catena: ${p.emoji} ${p.name} liv.${Game.profLevel(def.chain)} (+${Math.round((Game.profBonus(def.chain) - 1) * 100)}% produzione)</p>`;
    }
    if (def.workers) html += `<p class="muted">Lavoratori richiesti: ${def.workers}</p>`;
    if (type !== 'municipio') {
      html += `<button class="wide-btn danger" id="btn-demolish">🧹 Demolisci (rimborso 50%)</button>`;
    } else {
      html += `<p class="muted">Il cuore del borgo. Da qui tutto ebbe inizio.</p>`;
    }
    this.$('select-body').innerHTML = html;
    this.$('panel-select').classList.remove('hidden');
    this.rebindClose();
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        b.mode = btn.dataset.mode;
        this.toast(`${def.emoji} Ora il falegname produce: ${btn.dataset.mode}`);
        this.showBuildingPanel(x, y, type);
      };
    });
    const dem = this.$('btn-demolish');
    if (dem) dem.onclick = () => {
      Game.demolish(x, y);
      Renderer.selected = null;
      this.closePanels();
    };
  },

  showCampPanel(camp) {
    Renderer.selected = { x: camp.x, y: camp.y };
    this.closePanels();
    this.$('select-title').innerHTML = `🏴 Accampamento nemico <button class="close" data-close>✕</button>`;
    const s = Game.state;
    const power = s.soldati * 2;
    let html = `<div class="kv"><span>💢 Forza nemica</span><b>${camp.strength}</b></div>`;
    html += `<div class="kv"><span>⚔️ Tua forza d'attacco</span><b>${power} (${s.soldati} soldati)</b></div>`;
    if (s.attack) {
      html += `<p class="muted">I tuoi soldati sono già in marcia...</p>`;
    } else if (s.soldati === 0) {
      html += `<p class="muted">Ti servono soldati: costruisci una caserma e reclutali dal pannello Regno.</p>`;
    } else {
      const good = power >= camp.strength;
      html += `<p class="muted">${good ? '✅ La vittoria è probabile.' : '⚠️ Rischioso: il nemico è più forte.'}</p>`;
      html += `<button class="wide-btn" id="btn-attack">⚔️ Attacca con ${s.soldati} soldati</button>`;
    }
    html += `<p class="muted">Oppure colpiscilo con ⚡ Fulmine Divino dal pannello Miracoli.</p>`;
    this.$('select-body').innerHTML = html;
    this.$('panel-select').classList.remove('hidden');
    this.rebindClose();
    const atk = this.$('btn-attack');
    if (atk) atk.onclick = () => {
      Game.attackCamp(camp);
      Renderer.selected = null;
      this.closePanels();
    };
  },

  rebindClose() {
    document.querySelectorAll('[data-close]').forEach(b => {
      b.onclick = () => { this.closePanels(); Renderer.selected = null; };
    });
  },

  // ---------- aggiornamento continuo ----------
  update() {
    const s = Game.state;
    if (!s) return;
    const set = (id, v) => {
      const el = this.$(id).querySelector('.val');
      const txt = String(v);
      if (el.textContent !== txt) el.textContent = txt;
    };
    set('res-legna', Math.floor(s.res.legna));
    set('res-pietra', Math.floor(s.res.pietra));
    set('res-cibo', Math.floor(s.res.cibo));
    set('res-oro', Math.floor(s.res.oro));
    set('res-fede', Math.floor(s.res.fede));
    set('res-pop', Math.floor(s.pop) + '/' + Game.popMax());
    set('res-soldati', s.soldati);

    // merci lavorate: chip visibili solo quando ne possiedi
    const goods = ['farina', 'pane', 'torta', 'assi', 'blocchi', 'mobili', 'armi',
      'acqua', 'miele', 'idromele', 'pelle', 'scarpe', 'ferro', 'attrezzi'];
    const bar2 = this.$('topbar2');
    for (const g of goods) {
      let chip = document.getElementById('res-' + g);
      const has = s.res[g] >= 1;
      if (!chip && has) {
        chip = document.createElement('div');
        chip.className = 'res';
        chip.id = 'res-' + g;
        chip.innerHTML = `<span class="ico">${RES_EMOJI[g]}</span><span class="val">0</span>`;
        bar2.appendChild(chip);
      }
      if (chip) {
        chip.style.display = has ? '' : 'none';
        if (has) {
          const el = chip.querySelector('.val');
          const txt = String(Math.floor(s.res[g]));
          if (el.textContent !== txt) el.textContent = txt;
        }
      }
    }

    const era = ERAS[s.era];
    const badge = this.$('era-badge');
    const badgeTxt = era.emoji + ' ' + era.name + (s.goldenAge ? ' 🌅' : '');
    if (badge.textContent !== badgeTxt) badge.textContent = badgeTxt;

    // riposiziona i bottoni di conferma sopra il fantasma
    const g = Renderer.ghost;
    const pc = this.$('place-confirm');
    if (g && !pc.classList.contains('hidden')) {
      const wp = Renderer.tileToWorld(g.x, g.y);
      const p = Renderer.worldToScreen(wp.x, wp.y);
      pc.style.left = p.x + 'px';
      pc.style.top = (p.y - 30 * Renderer.cam.zoom) + 'px';
    }
  },
};
