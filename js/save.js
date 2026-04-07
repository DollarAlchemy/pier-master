/* ═══════════════════════════════════════════
   save.js — Pier Master
   All persistence goes through this module.
   Uses localStorage. GitHub Pages = static,
   so there is no server-side save.
════════════════════════════════════════════ */

'use strict';

const SAVE_KEY = 'pier_master_v1';

/* Default save structure */
function defaultSave() {
  return {
    gold:        0,
    totalCaught: 0,
    catches:     {},      /* fish.id → count */
    catchRodLog: {},      /* 'fish_rod' → count */
    speciesSeen: [],      /* [fish.id, ...] */
    rodsOwned:   ['starter'],
    rodEquipped: 'starter',
    questsClaimed: [],    /* [quest.id, ...] */
  };
}

/* Load save or return fresh default */
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return Object.assign(defaultSave(), JSON.parse(raw));
  } catch (e) {
    console.warn('[save] Failed to parse save, using defaults.', e);
    return defaultSave();
  }
}

/* Write current state to localStorage */
function writeSave(state) {
  try {
    const payload = {
      gold:          state.gold,
      totalCaught:   state.totalCaught,
      catches:       state.catches,
      catchRodLog:   state.catchRodLog,
      speciesSeen:   [...state.speciesSeen],
      rodsOwned:     state.rodsOwned,
      rodEquipped:   state.rodEquipped,
      questsClaimed: state.questsClaimed,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[save] Failed to write save.', e);
  }
}

/* Wipe save (used by a reset button if you add one later) */
function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

/* Export save as downloadable .json file */
function exportSave(state) {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'pier-master-save.json';
  a.click();
  URL.revokeObjectURL(url);
}
