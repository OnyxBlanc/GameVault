'use strict';

(function () {
  const ENDPOINT = 'api/succes.php';
  const MSG = {
    unauthenticated: 'Connecte-toi pour voir tes succès.',
    server_error: 'Erreur serveur. Vérifie que la migration SQL des succès est bien exécutée.',
    forbidden: 'Requête refusée.'
  };
  const byId = (id) => document.getElementById(id);
  let busy = false;

  async function call(action, method, body) {
    const init = { method, credentials: 'same-origin', headers: {} };
    if (method === 'POST') {
      init.headers['Content-Type'] = 'application/json';
      init.headers['X-Requested-With'] = 'GameVault';
      init.body = JSON.stringify(body || {});
    }
    let response;
    try {
      response = await fetch(ENDPOINT + '?a=' + action, init);
    } catch (error) {
      throw new Error('Serveur injoignable.');
    }
    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }
    if (!response.ok || data === null) {
      throw new Error(MSG[data && data.error] || 'Réponse invalide du serveur.');
    }
    return data;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function renderList(data) {
    byId('s-summary').textContent = `${data.unlocked} / ${data.total} succès débloqués`;
    const claimAll = byId('s-claim-all');
    claimAll.hidden = data.claimable < 1;
    claimAll.disabled = busy;
    claimAll.textContent = data.claimable > 1 ? `Tout réclamer (${data.claimable})` : 'Réclamer la récompense';

    const grid = byId('s-grid');
    grid.replaceChildren(...data.items.map((item) => {
      const ready = item.debloque && !item.reclame;
      const card = el('article', 's-card' + (item.debloque ? ' done' : '') + (ready ? ' ready' : ''));
      const top = el('div', 's-top');
      const left = el('div');
      left.append(el('span', 's-cat', item.categorie), el('h3', '', item.titre));
      const reward = el('span', 's-badge', `+${item.recompense} crédits`);
      top.append(left, reward);

      const desc = el('p', 's-desc', item.description);

      const pct = Math.min(100, Math.round((item.progression / Math.max(1, item.cible)) * 100));
      const barWrap = el('div', 's-bar-wrap');
      const bar = el('div', 's-bar');
      const fill = document.createElement('b');
      fill.style.width = pct + '%';
      bar.append(fill);
      const count = el('span', 's-count', `${item.progression} / ${item.cible}`);
      barWrap.append(bar, count);

      const foot = el('div', 's-foot');
      if (ready) {
        const btn = el('button', 'primary', `Réclamer +${item.recompense}`);
        btn.type = 'button';
        btn.disabled = busy;
        btn.addEventListener('click', () => claim({ code: item.code }));
        foot.append(el('span', 's-state', 'Débloqué'), btn);
      } else if (item.reclame) {
        foot.append(el('span', 's-state', 'Récompense réclamée'));
      } else {
        foot.append(el('span', 's-state', 'En cours'));
      }

      card.append(top, desc, barWrap, foot);
      return card;
    }));
  }

  async function loadSucces() {
    const msg = byId('s-msg');
    if (!state.user) {
      byId('s-summary').textContent = 'Connecte-toi pour suivre tes succès.';
      byId('s-claim-all').hidden = true;
      byId('s-grid').replaceChildren();
      msg.textContent = '';
      return;
    }
    msg.textContent = 'Chargement…';
    try {
      const data = await call('list', 'GET');
      msg.textContent = '';
      renderList(data);
    } catch (error) {
      byId('s-grid').replaceChildren();
      byId('s-claim-all').hidden = true;
      msg.textContent = error.message;
    }
  }

  async function claim(payload) {
    if (busy) {
      return;
    }
    busy = true;
    const msg = byId('s-msg');
    msg.textContent = '';
    try {
      const data = await call('claim', 'POST', payload);
      if (state.user && typeof data.credits === 'number') {
        state.user = Object.assign({}, state.user, { credits: data.credits });
        renderAccount();
      }
      renderList(data);
      if (data.reward > 0) {
        msg.textContent = `+${data.reward} crédits ajoutés à ton compte !`;
      }
    } catch (error) {
      msg.textContent = error.message;
    }
    busy = false;
  }

  function showSucces() {
    byId('browse').hidden = true;
    byId('booster').hidden = true;
    byId('succes').hidden = false;
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    byId('tab-booster').classList.remove('active');
    byId('tab-succes').classList.add('active');
    if (!state.user) {
      byId('auth').showModal();
    }
    loadSucces();
  }

  function hideSucces() {
    byId('succes').hidden = true;
    byId('tab-succes').classList.remove('active');
  }

  byId('tab-succes').addEventListener('click', showSucces);
  byId('tab-booster').addEventListener('click', hideSucces);
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', hideSucces));
  byId('s-claim-all').addEventListener('click', () => claim({ all: true }));
})();
