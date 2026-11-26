'use strict';

(function () {
  const ENDPOINT = 'api/booster.php';
  const MSG = {
    unauthenticated: 'Connecte-toi pour ouvrir des boosters.',
    insufficient_credits: 'Pas assez de crédits.',
    invalid_count: 'Nombre de boosters invalide.',
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
  let lastKey = '';

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

  function plural(n, word) {
    return n + ' ' + word + (n > 1 ? 's' : '');
  }

  function optionList() {
    const set = new Set([1]);
    for (let n = 5; n <= info.max_open; n += 5) {
      set.add(n);
    }
    if (info.free > 0) {
      set.add(Math.min(info.free, info.max_open));
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  function describe(n) {
    const freeUsed = Math.min(n, info.free);
    const paid = n - freeUsed;
    const cost = paid * info.price;
    let text;
    if (paid === 0) {
      text = 'Gratuit';
    } else if (freeUsed === 0) {
      text = cost + ' crédits';
    } else {
      text = `${plural(freeUsed, 'gratuit')} + ${plural(paid, 'payant')} (${cost} crédits)`;
    }
    return { text, cost, paid };
  }

  function renderOptions() {
    const box = byId('b-options');
    box.replaceChildren(...optionList().map((n) => {
      const detail = describe(n);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'opt' + (detail.paid === 0 ? ' free' : '') + (n === info.free ? ' best' : '');
      const title = document.createElement('strong');
      title.textContent = plural(n, 'booster');
      const sub = document.createElement('small');
      sub.textContent = detail.text;
      button.append(title, sub);
      button.disabled = busy || detail.cost > info.credits;
      button.addEventListener('click', () => {
        if (detail.cost > 0 && !window.confirm(`Dépenser ${detail.cost} crédits pour ${plural(detail.paid, 'booster')} payant${detail.paid > 1 ? 's' : ''} ?`)) {
          return;
        }
        open(n);
      });
      return button;
    }));
  }

  function render() {
    const box = byId('b-options');
    if (!state.user) {
      byId('b-info').textContent = 'Connecte-toi pour ouvrir des boosters.';
      byId('b-timer').textContent = '';
      box.replaceChildren();
      lastKey = '';
      return;
    }
    if (!info) {
      byId('b-info').textContent = 'Chargement…';
      box.replaceChildren();
      lastKey = '';
      return;
    }
    byId('b-info').textContent = `Boosters gratuits : ${info.free} / ${info.max_free} · Crédits : ${info.credits} · Un booster = ${info.count} jeux · ${info.price} crédits l'unité une fois les gratuits épuisés`;
    byId('b-timer').textContent = info.free >= info.max_free
      ? 'Stock plein : ouvre des boosters pour relancer la régénération.'
      : 'Prochain booster gratuit dans ' + formatTime(info.next_in);
    const key = `${info.free}|${info.credits}|${busy}`;
    if (key !== lastKey) {
      lastKey = key;
      renderOptions();
    }
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

  function makeCard(game, index, opened) {
    const tier = TIERS.includes(game.rarete) ? game.rarete : 'commun';
    const wrap = document.createElement('div');
    wrap.className = 'flip r-' + tier;
    if (opened) {
      wrap.classList.add('open');
      wrap.style.animationDelay = (Math.min(index, 12) * 40) + 'ms';
    } else {
      if (TIERS.indexOf(tier) >= 3) {
        wrap.classList.add('teaser');
      }
      wrap.style.animationDelay = (index * 120) + 'ms';
    }
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-pressed', opened ? 'true' : 'false');
    wrap.setAttribute('aria-label', opened ? game.titre : 'Carte face cachée, appuie pour la retourner');
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
    byId('b-result').replaceChildren(...sorted.map((game, index) => makeCard(game, index, false)));
    updateRevealButton();
  }

  function showSummary(data) {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
    const sorted = data.items.slice().sort((a, b) => {
      const diff = TIERS.indexOf(b.rarete) - TIERS.indexOf(a.rarete);
      return diff !== 0 ? diff : a.titre.localeCompare(b.titre);
    });
    byId('b-result').replaceChildren(...sorted.map((game, index) => makeCard(game, index, true)));
    updateRevealButton();
  }

  function summaryText(data) {
    const tally = {};
    let cards = 0;
    for (const game of data.items) {
      tally[game.rarete] = (tally[game.rarete] || 0) + game.obtenu;
      cards += game.obtenu;
    }
    const parts = TIERS.slice().reverse().filter((tier) => tally[tier]).map((tier) => `${tally[tier]} ${LABELS[tier]}`);
    const o = data.opened;
    return `${plural(o.boosters, 'booster')} ouvert${o.boosters > 1 ? 's' : ''} (${o.free} gratuit${o.free > 1 ? 's' : ''}, ${o.paid} payant${o.paid > 1 ? 's' : ''}, ${o.cost} crédits) · ${cards} cartes : ${parts.join(', ')}`;
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

  async function open(count) {
    if (busy) {
      return;
    }
    busy = true;
    render();
    byId('b-msg').textContent = '';
    byId('b-summary').textContent = '';
    try {
      const data = await call('open', 'POST', { count });
      if (count === 1) {
        showPack(data.items);
      } else {
        showSummary(data);
      }
      byId('b-summary').textContent = summaryText(data);
      applyState(data.state);
    } catch (error) {
      byId('b-msg').textContent = error.message;
    }
    busy = false;
    lastKey = '';
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
    lastKey = '';
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
})();
