'use strict';

(function () {
  const ENDPOINT = 'api/admin.php';
  const RARITIES = ['commun', 'peu_commun', 'rare', 'epique', 'legendaire', 'mythique', 'ethere'];
  const byId = (id) => document.getElementById(id);
  let activeSub = 'overview';

  async function call(action, method, body) {
    const init = { method, credentials: 'same-origin', headers: {} };
    if (method === 'POST') {
      init.headers['Content-Type'] = 'application/json';
      init.headers['X-Requested-With'] = 'GameVault';
      init.body = JSON.stringify(body || {});
    }
    const response = await fetch(ENDPOINT + '?a=' + action, init);
    const data = await response.json().catch(() => null);
    if (!response.ok || data === null) {
      throw new Error((data && data.error) || 'Erreur serveur.');
    }
    return data;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setMsg(text) {
    byId('a-msg').textContent = text || '';
  }

  function syncTabVisibility() {
    const tab = byId('tab-admin');
    if (tab) {
      tab.hidden = !(state.user && state.user.is_admin === 1);
    }
  }

  async function loadOverview() {
    const box = byId('a-body');
    box.textContent = 'Chargement…';
    const data = await call('overview', 'GET');
    const kpis = el('div', 'a-kpis');
    [
      ['Joueurs', data.stats.players],
      ['Bannis / Timeout', data.stats.banned],
      ['Jeux au catalogue', data.stats.games],
      ['Cartes en jeu', data.stats.cards]
    ].forEach(([label, val]) => {
      const card = el('div', 'a-kpi');
      card.append(el('span', '', label), el('strong', '', Number(val).toLocaleString('fr-FR')));
      kpis.append(card);
    });

    const title = el('h3', '', 'Journal des actions admin');
    const logs = el('ul', 'a-logs');
    if (!data.logs.length) {
      logs.append(el('li', 'meta', 'Aucune action enregistrée.'));
    } else {
      data.logs.forEach((l) => {
        const li = el('li');
        li.append(
          el('span', '', `${l.admin_pseudo} · ${l.action} (${l.cible || '-'})${l.details ? ' — ' + l.details : ''}`),
          el('span', 'meta', l.cree_le)
        );
        logs.append(li);
      });
    }
    box.replaceChildren(kpis, title, logs);
  }

  async function loadPlayers(q = '') {
    const box = byId('a-body');
    const bar = el('div', 'a-bar');
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Rechercher un pseudo…';
    input.value = q;
    const btn = el('button', 'primary', 'Rechercher');
    btn.type = 'button';
    btn.addEventListener('click', () => loadPlayers(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadPlayers(input.value.trim()); });
    bar.append(input, btn);

    const list = el('div', 'a-list');
    box.replaceChildren(bar, list);
    const data = await call('players&q=' + encodeURIComponent(q), 'GET');

    data.items.forEach((p) => {
      const row = el('article', 'a-row');
      const top = el('div', 'a-row-top');
      top.append(el('strong', '', `#${p.id} ${p.pseudo}`));
      const tags = el('div', 'a-tags');
      tags.append(el('span', 'a-tag', `${p.uniques} jeux · ${p.total_cards} cartes · ${p.succes_count} succès`));
      if (p.is_admin) tags.append(el('span', 'a-tag adm', 'Admin'));
      if (p.banned) tags.append(el('span', 'a-tag ban', 'Banni' + (p.ban_reason ? ' : ' + p.ban_reason : '')));
      else if (p.in_timeout) tags.append(el('span', 'a-tag ban', `Timeout jusqu'à ${p.timeout_until}`));
      top.append(tags);

      const fields = el('div', 'a-fields');
      const credIn = document.createElement('input');
      credIn.type = 'number';
      credIn.min = '0';
      credIn.value = String(p.credits);
      const credLab = el('label', '', 'Crédits');
      credLab.append(credIn);

      const boostIn = document.createElement('input');
      boostIn.type = 'number';
      boostIn.min = '0';
      boostIn.max = '500';
      boostIn.value = String(p.boosters_gratuits);
      const boostLab = el('label', '', 'Boosters gratuits');
      boostLab.append(boostIn);

      const admChk = document.createElement('input');
      admChk.type = 'checkbox';
      admChk.checked = p.is_admin === 1;
      const admLab = el('label', '', 'Admin');
      admLab.append(admChk);

      const saveBtn = el('button', 'primary', 'Enregistrer');
      saveBtn.type = 'button';
      saveBtn.addEventListener('click', async () => {
        try {
          await call('player_update', 'POST', {
            id: p.id,
            credits: Number(credIn.value) || 0,
            boosters_gratuits: Number(boostIn.value) || 0,
            starter_claimed: p.starter_claimed,
            is_admin: admChk.checked ? 1 : 0
          });
          setMsg(`Compte ${p.pseudo} mis à jour.`);
          loadPlayers(q);
        } catch (err) { setMsg(err.message); }
      });
      fields.append(credLab, boostLab, admLab, saveBtn);

      const actions = el('div', 'a-actions');
      const timeoutBtn = el('button', '', 'Timeout');
      timeoutBtn.type = 'button';
      timeoutBtn.addEventListener('click', async () => {
        const mins = Number(window.prompt(`Durée du timeout en minutes pour ${p.pseudo} (ex: 60) :`, '60'));
        if (!mins || mins < 1) return;
        const reason = window.prompt('Motif (optionnel) :', '') || '';
        try {
          await call('player_moderate', 'POST', { id: p.id, mode: 'timeout', minutes: mins, reason });
          setMsg(`${p.pseudo} mis en timeout (${mins} min).`);
          loadPlayers(q);
        } catch (err) { setMsg(err.message); }
      });

      const banBtn = el('button', 'a-danger', p.banned || p.in_timeout ? 'Débannir' : 'Bannir');
      banBtn.type = 'button';
      banBtn.addEventListener('click', async () => {
        const unban = p.banned || p.in_timeout;
        const reason = unban ? '' : (window.prompt(`Motif du bannissement pour ${p.pseudo} :`, '') || '');
        if (!unban && !window.confirm(`Bannir définitivement ${p.pseudo} ?`)) return;
        try {
          await call('player_moderate', 'POST', { id: p.id, mode: unban ? 'unban' : 'ban', reason });
          setMsg(unban ? `${p.pseudo} débanni.` : `${p.pseudo} banni.`);
          loadPlayers(q);
        } catch (err) { setMsg(err.message); }
      });

      const clearCol = el('button', 'a-danger', 'Vider collection');
      clearCol.type = 'button';
      clearCol.addEventListener('click', async () => {
        if (!window.confirm(`Vider toute la collection de ${p.pseudo} ?`)) return;
        try {
          await call('player_clear_collection', 'POST', { id: p.id });
          setMsg(`Collection de ${p.pseudo} vidée.`);
          loadPlayers(q);
        } catch (err) { setMsg(err.message); }
      });

      const clearSuc = el('button', 'a-danger', 'Retirer succès');
      clearSuc.type = 'button';
      clearSuc.addEventListener('click', async () => {
        if (!window.confirm(`Retirer tous les succès de ${p.pseudo} ?`)) return;
        try {
          await call('player_clear_succes', 'POST', { id: p.id });
          setMsg(`Succès de ${p.pseudo} réinitialisés.`);
          loadPlayers(q);
        } catch (err) { setMsg(err.message); }
      });

      actions.append(timeoutBtn, banBtn, clearCol, clearSuc);
      row.append(top, fields, actions);
      list.append(row);
    });
  }

  async function loadGames(q = '') {
    const box = byId('a-body');
    const bar = el('div', 'a-bar');
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Rechercher un jeu du catalogue…';
    input.value = q;
    const btn = el('button', 'primary', 'Rechercher');
    btn.type = 'button';
    btn.addEventListener('click', () => loadGames(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadGames(input.value.trim()); });
    bar.append(input, btn);

    const list = el('div', 'a-list');
    box.replaceChildren(bar, list);
    const data = await call('games&q=' + encodeURIComponent(q), 'GET');

    data.items.forEach((g) => {
      const row = el('article', 'a-row');
      const top = el('div', 'a-row-top');
      top.append(el('strong', '', `#${g.id} ${g.titre}`), el('span', 'a-tag', g.date_sortie || 'Date inconnue'));
      const actions = el('div', 'a-actions');
      const sel = document.createElement('select');
      RARITIES.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        opt.selected = r === g.rarete;
        sel.append(opt);
      });
      const saveBtn = el('button', 'primary', 'Changer rareté');
      saveBtn.type = 'button';
      saveBtn.addEventListener('click', async () => {
        try {
          await call('game_rarity', 'POST', { id: g.id, rarete: sel.value });
          setMsg(`Rareté de « ${g.titre} » mise à jour (${sel.value}).`);
        } catch (err) { setMsg(err.message); }
      });
      const delBtn = el('button', 'a-danger', 'Supprimer');
      delBtn.type = 'button';
      delBtn.addEventListener('click', async () => {
        if (!window.confirm(`Supprimer définitivement « ${g.titre} » du catalogue et des collections ?`)) return;
        try {
          await call('game_delete', 'POST', { id: g.id });
          setMsg(`Jeu « ${g.titre} » supprimé.`);
          loadGames(q);
        } catch (err) { setMsg(err.message); }
      });
      actions.append(sel, saveBtn, delBtn);
      row.append(top, actions);
      list.append(row);
    });
  }

  async function loadSettings() {
    const box = byId('a-body');
    const data = await call('overview', 'GET');
    const s = data.settings || {};
    const form = el('div', 'a-form');

    const marketChk = document.createElement('input');
    marketChk.type = 'checkbox';
    marketChk.checked = s.market_enabled === '1';
    const l1 = el('label', '', 'Activer le marché (pour plus tard)');
    l1.append(marketChk);

    const feeIn = document.createElement('input');
    feeIn.type = 'number';
    feeIn.min = '0';
    feeIn.max = '50';
    feeIn.value = s.market_fee_pct || '5';
    const l2 = el('label', '', 'Taxe du marché (%)');
    l2.append(feeIn);

    const maintChk = document.createElement('input');
    maintChk.type = 'checkbox';
    maintChk.checked = s.maintenance_mode === '1';
    const l3 = el('label', '', 'Mode maintenance');
    l3.append(maintChk);

    const save = el('button', 'primary', 'Enregistrer les paramètres');
    save.type = 'button';
    save.addEventListener('click', async () => {
      try {
        await call('settings_save', 'POST', {
          market_enabled: marketChk.checked ? 1 : 0,
          market_fee_pct: Number(feeIn.value) || 0,
          maintenance_mode: maintChk.checked ? 1 : 0
        });
        setMsg('Paramètres enregistrés.');
      } catch (err) { setMsg(err.message); }
    });

    form.append(l1, l2, l3, save);
    box.replaceChildren(form);
  }

  async function renderSub(sub) {
    activeSub = sub;
    setMsg('');
    document.querySelectorAll('#admin .a-subtabs button').forEach((b) => {
      b.classList.toggle('active', b.dataset.sub === sub);
    });
    try {
      if (sub === 'overview') await loadOverview();
      else if (sub === 'players') await loadPlayers('');
      else if (sub === 'games') await loadGames('');
      else if (sub === 'settings') await loadSettings();
    } catch (err) {
      setMsg(err.message);
    }
  }

  function showAdmin() {
    byId('browse').hidden = true;
    byId('booster').hidden = true;
    byId('succes').hidden = true;
    byId('admin').hidden = false;
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    byId('tab-booster').classList.remove('active');
    byId('tab-succes').classList.remove('active');
    byId('tab-admin').classList.add('active');
    renderSub(activeSub);
  }

  function hideAdmin() {
    byId('admin').hidden = true;
    byId('tab-admin').classList.remove('active');
  }

  byId('tab-admin').addEventListener('click', showAdmin);
  byId('tab-booster').addEventListener('click', hideAdmin);
  byId('tab-succes').addEventListener('click', hideAdmin);
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', hideAdmin));
  document.querySelectorAll('#admin .a-subtabs button').forEach((b) => {
    b.addEventListener('click', () => renderSub(b.dataset.sub));
  });

  setInterval(syncTabVisibility, 1000);
  syncTabVisibility();
})();
