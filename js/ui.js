/* ═══════════════════════════════════════════
   ui.js — Pier Master
   Owns all DOM interactions.
   Called by game.js via the exposed ui* functions.
   Never directly mutates G — fires events back via callbacks.
════════════════════════════════════════════ */

'use strict';

/* ── QTE runtime state ── */
let _qteActive    = false;
let _qtePos       = 0;
let _qteDir       = 1;
let _qteRAF       = null;
let _qteCallback  = null;
let _qteRod       = null;

/* ── Notice timer ── */
let _noticeTimer  = null;

/* ════════════════════════════════════════════
   INIT — wire up all static UI events
════════════════════════════════════════════ */
function uiInit() {
  /* Title → game */
  document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('screen-title').classList.remove('active');
    document.getElementById('screen-game').classList.add('active');
    initGame();
  });

  /* HUD buttons */
  document.getElementById('btn-shop').addEventListener('click',   () => uiOpenModal('modal-shop'));
  document.getElementById('btn-quests').addEventListener('click', () => uiOpenModal('modal-quests'));

  /* Modal close buttons */
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.close;
      uiCloseModal(id);
    });
  });

  /* Close modal on overlay click */
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) uiCloseModal(overlay.id);
    });
  });

  /* Side panel toggle */
  document.getElementById('panel-toggle').addEventListener('click', _togglePanel);

  /* Cast button */
  document.getElementById('btn-cast').addEventListener('click', () => {
    if (typeof cast === 'function') cast();
  });

  /* QTE bar click */
  document.getElementById('qte-overlay').addEventListener('click', () => {
    if (_qteActive) uiQTEClick();
  });

  /* Initial UI state */
  uiUpdateGold(G.gold);
  uiUpdateCatchPanel();
  _renderShop();
  _renderQuests();
}

/* ════════════════════════════════════════════
   GOLD
════════════════════════════════════════════ */
function uiUpdateGold(amount) {
  document.getElementById('gold-val').textContent = amount;
}

/* ════════════════════════════════════════════
   CATCH PANEL
════════════════════════════════════════════ */
function uiUpdateCatchPanel() {
  const list    = document.getElementById('catch-list');
  const fill    = document.getElementById('bucket-fill');
  const count   = document.getElementById('bucket-count');

  count.textContent = G.totalCaught;
  fill.style.height = Math.min(100, (G.totalCaught / 20) * 100) + '%';

  const entries = FISH.filter(f => (G.catches[f.id] || 0) > 0);
  if (entries.length === 0) {
    list.innerHTML = '<p class="catch-empty">No catches yet</p>';
    return;
  }

  list.innerHTML = entries.map(f => `
    <div class="catch-item">
      <div class="catch-swatch" style="background:${f.color}"></div>
      <span class="catch-name">${f.name}</span>
      <span class="catch-count">x${G.catches[f.id]}</span>
    </div>
  `).join('');
}

/* ════════════════════════════════════════════
   NOTICE + SPLASH
════════════════════════════════════════════ */
function uiShowNotice(msg) {
  const el = document.getElementById('player-notice');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_noticeTimer);
  _noticeTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function uiShowCaughtSplash(fishName, gold) {
  const el = document.getElementById('caught-splash');
  el.textContent = `${fishName}  +${gold}g!`;
  el.classList.remove('pop');
  void el.offsetWidth;   /* force reflow to restart animation */
  el.classList.add('pop');
}

/* ════════════════════════════════════════════
   CAST BUTTON + MOVE HINT
════════════════════════════════════════════ */
function uiSetCastVisible(visible) {
  document.getElementById('btn-cast').classList.toggle('hidden', !visible);
}

function uiSetMoveHint(visible) {
  document.getElementById('move-hint').classList.toggle('hidden', !visible);
}

/* ════════════════════════════════════════════
   QTE
════════════════════════════════════════════ */
function uiStartQTE(fish, callback) {
  _qteCallback = callback;
  _qteRod      = RODS.find(r => r.equipped) || RODS[0];
  _qtePos      = 0;
  _qteDir      = 1;
  _qteActive   = false;  /* will be set true after 300ms delay */

  /* Set fish name */
  document.getElementById('qte-fish-name').textContent = `🎣 ${fish.name} is biting!`;

  /* Adjust zone widths based on rod */
  const wide = _qteRod.special === 'wide';
  const okPct   = wide ? '28%' : '22%';
  const goodPct = wide ? '24%' : '16%';
  document.querySelectorAll('.qte-ok').forEach(z => z.style.flex = `0 0 ${okPct}`);
  document.querySelectorAll('.qte-good').forEach(z => z.style.flex = `0 0 ${goodPct}`);

  /* Clear result */
  const result = document.getElementById('qte-result');
  result.textContent = '';
  result.style.color = '';

  /* Show */
  document.getElementById('qte-overlay').classList.add('active');

  /* Short delay so player can orient before it starts moving */
  setTimeout(() => {
    _qteActive = true;
    _qteAnimate();
  }, 350);
}

function _qteAnimate() {
  if (!_qteActive) return;
  const rod    = _qteRod;
  const speed  = (rod ? rod.speed : 1.0) * 0.55;

  _qtePos += _qteDir * speed;
  if (_qtePos >= 100) { _qtePos = 100; _qteDir = -1; }
  if (_qtePos <= 0)   { _qtePos = 0;   _qteDir =  1; }

  document.getElementById('qte-marker').style.left = _qtePos + '%';
  _qteRAF = requestAnimationFrame(_qteAnimate);
}

function uiQTEClick() {
  if (!_qteActive) return;
  _qteActive = false;
  cancelAnimationFrame(_qteRAF);

  const rod  = _qteRod;
  const wide = rod && rod.special === 'wide';
  const pos  = _qtePos;

  /* Zone boundaries (mirror the CSS flex widths) */
  const okLow   = wide ? 10  : 15;
  const goodLow = wide ? 38  : 37;
  const goodHi  = wide ? 62  : 53;
  const okHi    = wide ? 90  : 85;

  let result;
  if (pos >= goodLow && pos <= goodHi) {
    result = 'perfect';
  } else if (pos >= okLow && pos <= okHi) {
    result = 'good';
  } else {
    result = 'miss';
  }

  const el = document.getElementById('qte-result');
  const labels = { perfect: '✨ Perfect!', good: '👍 Hooked!', miss: '💨 Got away!' };
  const colors = { perfect: '#f5a623',     good: '#4caf50',    miss: '#e53935' };
  el.textContent = labels[result];
  el.style.color = colors[result];

  setTimeout(() => {
    document.getElementById('qte-overlay').classList.remove('active');
    if (_qteCallback) _qteCallback(result);
    _qteCallback = null;
  }, 700);
}

/* ════════════════════════════════════════════
   MODALS
════════════════════════════════════════════ */
function uiOpenModal(id) {
  if (id === 'modal-shop')   _renderShop();
  if (id === 'modal-quests') _renderQuests();
  const el = document.getElementById(id);
  el.classList.add('active');
  el.setAttribute('aria-hidden', 'false');
}

function uiCloseModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('active');
  el.setAttribute('aria-hidden', 'true');
}

/* ════════════════════════════════════════════
   SHOP
════════════════════════════════════════════ */
function _renderShop() {
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = RODS.map(rod => {
    const isEquipped = rod.equipped;
    const isOwned    = rod.owned;
    const canAfford  = G.gold >= rod.price;

    let cls = 'shop-item';
    if (isEquipped) cls += ' equipped';
    else if (isOwned) cls += ' owned';
    else if (!canAfford) cls += ' no-gold';

    let tag;
    if (isEquipped)       tag = `<span class="shop-tag shop-tag--equipped">Equipped</span>`;
    else if (isOwned)     tag = `<span class="shop-tag shop-tag--owned">Equip</span>`;
    else if (rod.price === 0) tag = `<span class="shop-tag shop-tag--free">Free</span>`;
    else if (!canAfford)  tag = `<span class="shop-tag shop-tag--broke">${rod.price}g</span>`;
    else                  tag = `<span class="shop-tag shop-tag--price">${rod.price}g</span>`;

    return `
      <div class="${cls}" data-rod="${rod.id}">
        <div class="shop-item-icon">${rod.emoji}</div>
        <div class="shop-item-name">${rod.name}</div>
        <div class="shop-item-desc">${rod.desc}</div>
        ${tag}
      </div>
    `;
  }).join('');

  /* Bind clicks */
  grid.querySelectorAll('.shop-item').forEach(el => {
    el.addEventListener('click', () => _buyOrEquipRod(el.dataset.rod));
  });
}

function _buyOrEquipRod(rodId) {
  const rod = RODS.find(r => r.id === rodId);
  if (!rod) return;

  if (rod.equipped) return;

  if (rod.owned) {
    RODS.forEach(r => r.equipped = false);
    rod.equipped = true;
    G.rodEquipped = rod.id;
    document.getElementById('active-rod-name').textContent = rod.name;
    document.getElementById('active-rod-desc').textContent = rod.desc;
    _renderShop();
    uiCheckQuestProgress();
    _saveRods();
    return;
  }

  if (G.gold < rod.price) {
    uiShowNotice('Not enough gold!');
    return;
  }

  G.gold -= rod.price;
  rod.owned = true;
  uiUpdateGold(G.gold);
  _renderShop();
  uiCheckQuestProgress();
  uiShowNotice(`${rod.name} purchased!`);
  _saveRods();
}

function _saveRods() {
  G.rodsOwned   = RODS.filter(r => r.owned).map(r => r.id);
  G.rodEquipped = RODS.find(r => r.equipped)?.id ?? 'starter';
  writeSave(G);
}

/* ════════════════════════════════════════════
   QUESTS
════════════════════════════════════════════ */
function _questProgress(q) {
  const c = q.condition;
  switch (c.type) {
    case 'total':      return Math.min(G.totalCaught, c.count);
    case 'fish':       return Math.min(G.catches[c.fish] || 0, c.count);
    case 'fish_rod': {
      const key = c.fish + '_' + c.rod;
      return Math.min(G.catchRodLog[key] || 0, c.count);
    }
    case 'rods_owned': return Math.min(RODS.filter(r => r.owned).length, c.count);
    case 'species':    return Math.min(G.speciesSeen.size, c.count);
    default:           return 0;
  }
}

function _renderQuests() {
  const body = document.getElementById('quest-body');
  body.innerHTML = QUESTS.map(q => {
    const cur     = _questProgress(q);
    const max     = q.condition.count;
    const pct     = Math.round((cur / max) * 100);
    const done    = cur >= max;
    const claimed = G.questsClaimed.includes(q.id);

    let cls = 'quest-item';
    if (done && !claimed) cls += ' complete';
    if (claimed)          cls += ' claimed';

    const claimBtn = done && !claimed
      ? `<button class="quest-claim-btn" data-quest="${q.id}">Claim Reward!</button>`
      : claimed
        ? `<div class="quest-claimed-tag">✓ Claimed</div>`
        : '';

    return `
      <div class="${cls}">
        <div class="quest-header">
          <div class="quest-name">${done && !claimed ? '✅ ' : ''}${q.name}</div>
          <div class="quest-reward">✨ ${q.reward}g</div>
        </div>
        <div class="quest-desc">${q.desc}</div>
        <div class="quest-track">
          <div class="quest-bar" style="width:${pct}%"></div>
        </div>
        <div class="quest-numbers">${cur} / ${max}</div>
        ${claimBtn}
      </div>
    `;
  }).join('');

  /* Bind claim buttons */
  body.querySelectorAll('.quest-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => _claimQuest(btn.dataset.quest));
  });
}

function _claimQuest(questId) {
  const q = QUESTS.find(q => q.id === questId);
  if (!q || G.questsClaimed.includes(q.id)) return;
  if (_questProgress(q) < q.condition.count) return;

  G.questsClaimed.push(q.id);
  G.gold += q.reward;
  uiUpdateGold(G.gold);
  writeSave(G);
  _renderQuests();
  uiShowNotice(`Quest complete! +${q.reward}g`);
  uiCloseModal('modal-quests');
  setTimeout(() => uiOpenModal('modal-quests'), 80);
}

function uiCheckQuestProgress() {
  _renderQuests();
}

/* ════════════════════════════════════════════
   SIDE PANEL
════════════════════════════════════════════ */
function _togglePanel() {
  const panel  = document.getElementById('side-panel');
  const toggle = document.getElementById('panel-toggle');
  const isOpen = panel.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
}

/* ════════════════════════════════════════════
   TITLE SCREEN
════════════════════════════════════════════ */
/* Wired in index.html script load order:
   uiInit is called by game.js initGame()
   Title "Cast Off" button is wired here. */
document.addEventListener('DOMContentLoaded', () => {
  startTitleScreen();

  document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('screen-title').classList.remove('active');
    document.getElementById('screen-game').classList.add('active');
    initGame();
  });
});
