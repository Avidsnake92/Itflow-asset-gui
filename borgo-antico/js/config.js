// ============================================================
// Borgo Antico — dati di gioco
// ============================================================
'use strict';

const CONFIG = {
  MAP: 44,               // lato mappa (tiles)
  TILE_W: 64,            // larghezza tile isometrico a zoom 1
  TILE_H: 32,
  TICK: 1.0,             // secondi per tick economia
  DAY_LENGTH: 240,       // secondi reali per un ciclo giorno/notte
  SAVE_KEY: 'borgo-antico-save-v1',
  AUTOSAVE_EVERY: 10,
};

// Terreni
const T = { GRASS: 0, FERTILE: 1, FOREST: 2, ROCK: 3, WATER: 4 };

// ---- Ere (si resta nel medioevo!) ----
const ERAS = [
  { id: 0, name: 'Accampamento', emoji: '🏕️', req: null },
  { id: 1, name: 'Villaggio', emoji: '🛖', req: { pop: 10, legna: 60, pietra: 20 } },
  { id: 2, name: 'Borgo', emoji: '🏘️', req: { pop: 22, legna: 120, pietra: 80, oro: 40 } },
  { id: 3, name: 'Città Medievale', emoji: '🏰', req: { pop: 45, legna: 200, pietra: 180, oro: 120, fede: 50 } },
  { id: 4, name: 'Regno', emoji: '👑', req: { pop: 80, legna: 300, pietra: 300, oro: 300, fede: 150 } },
];

// ---- Edifici ----
// prod: risorse per secondo (a piena efficienza)
// workers: popolazione impiegata
const BUILDINGS = {
  municipio: {
    name: 'Municipio', emoji: '🏛️', era: 0, cost: {},
    desc: 'Il cuore del tuo insediamento.',
    popMax: 10, unique: true, unbuildable: true,
  },
  casa: {
    name: 'Casa', emoji: '🏠', era: 0, cost: { legna: 20 },
    desc: '+5 abitanti massimi.', popMax: 5,
  },
  fattoria: {
    name: 'Fattoria', emoji: '🌾', era: 0, cost: { legna: 25 },
    desc: 'Produce cibo. Meglio su terra fertile.',
    prod: { cibo: 0.8 }, workers: 2,
  },
  taglialegna: {
    name: 'Taglialegna', emoji: '🪓', era: 0, cost: { legna: 20 },
    desc: 'Produce legna. Piazzalo vicino ai boschi.',
    prod: { legna: 0.35 }, workers: 2, adjBonus: { terrain: T.FOREST, mult: 0.35 },
  },
  cava: {
    name: 'Cava', emoji: '⛏️', era: 0, cost: { legna: 30 },
    desc: 'Produce pietra. Piazzala vicino alle rocce.',
    prod: { pietra: 0.25 }, workers: 2, adjBonus: { terrain: T.ROCK, mult: 0.45 },
  },
  cappella: {
    name: 'Cappella', emoji: '⛪', era: 1, cost: { legna: 40, pietra: 15 },
    desc: 'Genera Fede per i miracoli.',
    prod: { fede: 0.15 }, workers: 1,
  },
  mercato: {
    name: 'Mercato', emoji: '🛒', era: 1, cost: { legna: 50, pietra: 25 },
    desc: 'Genera oro dai commerci.',
    prod: { oro: 0.3 }, workers: 2,
  },
  mulino: {
    name: 'Mulino', emoji: '🌬️', era: 1, cost: { legna: 45, pietra: 20 },
    desc: '+50% alle fattorie adiacenti.',
    workers: 1,
  },
  giardino: {
    name: 'Giardino', emoji: '🌸', era: 1, cost: { legna: 15, oro: 5 },
    desc: '+3 felicità. Bellezza pura.', happy: 3,
  },
  torre: {
    name: 'Torre di guardia', emoji: '🗼', era: 2, cost: { legna: 15, pietra: 35 },
    desc: '+5 difesa contro le razzie.', defense: 5,
  },
  taverna: {
    name: 'Taverna', emoji: '🍺', era: 2, cost: { legna: 60, pietra: 30, oro: 15 },
    desc: '+6 felicità. Idromele per tutti!', happy: 6, workers: 1,
  },
  caserma: {
    name: 'Caserma', emoji: '🛡️', era: 2, cost: { legna: 80, pietra: 50, oro: 20 },
    desc: 'Permette di reclutare 5 soldati.', soldierCap: 5,
  },
  chiesa: {
    name: 'Chiesa', emoji: '✝️', era: 3, cost: { legna: 40, pietra: 80, oro: 30 },
    desc: 'Molta Fede, +4 felicità.',
    prod: { fede: 0.4 }, workers: 2, happy: 4,
  },
  statua: {
    name: 'Statua', emoji: '🗿', era: 3, cost: { pietra: 40, oro: 25 },
    desc: '+5 felicità. Gloria eterna.', happy: 5,
  },
  castello: {
    name: 'Castello', emoji: '🏰', era: 3, cost: { legna: 100, pietra: 180, oro: 100 },
    desc: '+25 difesa, +10 soldati max, +10 abitanti.',
    defense: 25, soldierCap: 10, popMax: 10, unique: true,
  },
  cattedrale: {
    name: 'Cattedrale', emoji: '⛩️', era: 4, cost: { legna: 80, pietra: 250, oro: 150 },
    desc: 'Meraviglia del regno. Tanta Fede e felicità.',
    prod: { fede: 1.0 }, workers: 3, happy: 10, unique: true,
  },
};

// ---- Miracoli (tocco alla Black & White) ----
const MIRACLES = {
  raccolto: {
    name: 'Benedizione del Raccolto', emoji: '🌟', cost: 30,
    desc: '+60 cibo subito e fattorie ×2 per 90s.',
  },
  pioggia: {
    name: 'Pioggia Rigogliosa', emoji: '🌧️', cost: 25,
    desc: '+50 legna e nuovi alberi crescono ai margini dei boschi.',
  },
  scudo: {
    name: 'Scudo Divino', emoji: '🛡️', cost: 40,
    desc: 'Difesa ×2 per 3 minuti.',
  },
  fulmine: {
    name: 'Fulmine Divino', emoji: '⚡', cost: 60,
    desc: 'Colpisce un accampamento nemico: -25 forza.',
    targeted: true,
  },
};

// ---- Nemici ----
const ENEMY = {
  CAMPS: 3,
  START_STRENGTH: [10, 14, 18],
  GROW_EVERY: 30,      // +1 forza ogni N secondi
  MAX_STRENGTH: 60,
  FIRST_RAID_AFTER: 360,   // niente razzie nei primi 6 minuti
  RAID_COOLDOWN: 300,      // minimo tra le razzie di uno stesso campo
  RAID_WARNING: 25,        // secondi di preavviso
  RESPAWN_AFTER: 420,      // un campo distrutto rinasce (più debole) dopo 7 min
  ATTACK_TRAVEL: 15,       // secondi di marcia per attaccare
};

const SOLDIER_COST = { cibo: 20, oro: 10 };
