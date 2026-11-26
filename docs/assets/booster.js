'use strict';

(function () {
  const ENDPOINT = 'api/booster.php';
  const MSG = {
    unauthenticated: 'Connecte-toi pour ouvrir des boosters.',
    no_free_booster: 'Aucun booster gratuit disponible pour le moment.',
    insufficient_credits: 'Pas assez de crédits.',
    catalogue_empty: 'Le catalogue est vide pour le moment.',
    server_error: 'Erreur serveur. Réessaie plus tard.',
    forbidden: 'Requête refusée.'
  };
  const TIERS = ['commun', 'peu_commun', 'rare', 'epique', 'legendaire', 'mythique', 'ethere'];
  const LABELS = {
    commun: 'Commun',
    peu_commun: 'Peu commun',
    rare: 'Rare',
    epique: 'Épique',
    legendaire: 'Légendaire',
    mythique: 'Mythique',
    ethere: 'Éthéré'
  };
  const byId = (id) => document.getElementById(id);
  let info = null;
  let busy = false;
  let visible = false;
  let timer = null;
  let revealTimers = [];

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

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ' min ' + String(s).padStart(2, '0') + ' s';
  }

  function render() {
    const free = byId('b-free');
    const paid = byId('b-paid');
    if (!state.user) {
      byId('b-info').textContent = 'Connecte-toi pour ouvrir des boosters.';
      byId('b-timer').textContent = '';
      free.disabled = true;
      paid.disabled = true;
      return;
    }
    if (!info) {
      byId('b-info').textContent = 'Chargement…';
      free.disabled = true;
      paid.disabled = true;
      return;
    }
    byId('b-info').textContent = `Boosters gratuits : ${info.free} / ${info.max_free} · Crédits : ${info.credits} · Un booster = ${info.count} jeux`;
    byId('b-timer').textContent = info.free >= info.max_free
      ? 'Stock plein : ouvre des boosters pour relancer la régénération.'
      : 'Prochain booster gratuit dans ' + formatTime(info.next_in);
    free.disabled = busy || info.free < 1;
    paid.disabled = busy || info.credits < info.price;
    paid.textContent = `Ouvrir un booster (${info.price} crédits)`;
  }

  function applyState(next) {
    info = next;
    if (state.user) {
      state.user = Object.assign({}, state.user, { credits: next.credits });
      renderAccount();
    }
    render();
  }

  function updateRevealButton() {
    const button = byId('b-reveal');
    const closed = document.querySelectorAll('#b-result .flip:not(.open)').length;
    button.hidden = closed === 0;
  }

  function reveal(wrap) {
    if (wrap.classList.contains('open')) {
      return;
    }
    wrap.classList.add('open');
    wrap.setAttribute('aria-pressed', 'true');
    updateRevealButton();
  }

  function makeCard(game, index) {
    const tier = TIERS.includes(game.rarete) ? game.rarete : 'commun';
    const wrap = document.createElement('div');
    wrap.className = 'flip r-' + tier;
    if (TIERS.indexOf(tier) >= 3) {
      wrap.classList.add('teaser');
    }
    wrap.style.animationDelay = (index * 120) + 'ms';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-pressed', 'false');
    wrap.setAttribute('aria-label', 'Carte face cachée, appuie pour la retourner');
    const inner = document.createElement('div');
    inner.className = 'flip-inner';
    const back = document.createElement('div');
    back.className = 'face back';
    back.textContent = 'GV';
    const front = document.createElement('div');
    front.className = 'face front';
    const tag = document.createElement('span');
    tag.className = 'rarity';
    tag.textContent = LABELS[tier];
    const holo = document.createElement('span');
    holo.className = 'holo';
    front.append(renderCard(game), tag, holo);
    inner.append(back, front);
    wrap.append(inner);
    wrap.addEventListener('click', () => reveal(wrap));
    wrap.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        reveal(wrap);
      }
    });
    return wrap;
  }

  function showPack(items) {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
    const sorted = items.slice().sort((a, b) => TIERS.indexOf(a.rarete) - TIERS.indexOf(b.rarete));
    byId('b-result').replaceChildren(...sorted.map(makeCard));
    updateRevealButton();
  }

  function revealAll() {
    const closed = Array.from(document.querySelectorAll('#b-result .flip:not(.open)'));
    closed.forEach((wrap, index) => {
      revealTimers.push(setTimeout(() => reveal(wrap), index * 450));
    });
  }

  async function refresh() {
    if (!state.user || busy) {
      render();
      return;
    }
    busy = true;
    try {
      applyState(await call('status', 'GET'));
      byId('b-msg').textContent = '';
    } catch (error) {
      byId('b-msg').textContent = error.message;
    }
    busy = false;
    render();
  }

  async function open(mode) {
    if (busy) {
      return;
    }
    busy = true;
    render();
    byId('b-msg').textContent = '';
    try {
      const data = await call('open', 'POST', { mode });
      showPack(data.items);
      applyState(data.state);
    } catch (error) {
      byId('b-msg').textContent = error.message;
    }
    busy = false;
    render();
    if (!info) {
      refresh();
    }
  }

  function tick() {
    if (!visible) {
      return;
    }
    if (!state.user) {
      info = null;
      render();
      return;
    }
    if (!info) {
      refresh();
      return;
    }
    if (info.free < info.max_free) {
      info.next_in -= 1;
      if (info.next_in <= 0) {
        refresh();
        return;
      }
    }
    render();
  }

  function showBooster() {
    visible = true;
    byId('browse').hidden = true;
    byId('booster').hidden = false;
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    byId('tab-booster').classList.add('active');
    info = null;
    render();
    if (state.user) {
      refresh();
    } else {
      byId('auth').showModal();
    }
    clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  function hideBooster() {
    visible = false;
    clearInterval(timer);
    byId('browse').hidden = false;
    byId('booster').hidden = true;
    byId('tab-booster').classList.remove('active');
  }

  const revealButton = document.createElement('button');
  revealButton.type = 'button';
  revealButton.id = 'b-reveal';
  revealButton.textContent = 'Tout révéler';
  revealButton.hidden = true;
  byId('b-result').before(revealButton);
  revealButton.addEventListener('click', revealAll);

  byId('b-result').addEventListener('pointermove', (event) => {
    const face = event.target.closest('.flip.open .front');
    if (!face) {
      return;
    }
    const rect = face.getBoundingClientRect();
    face.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
    face.style.setProperty('--my', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
  });

  byId('tab-booster').addEventListener('click', showBooster);
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', hideBooster));
  byId('b-free').addEventListener('click', () => open('free'));
  byId('b-paid').addEventListener('click', () => open('paid'));
})();
