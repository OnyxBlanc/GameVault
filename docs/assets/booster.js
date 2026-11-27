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
  const ODDS = { ethere: 0.0001, mythique: 0.0009, legendaire: 0.01, epique: 0.04, rare: 0.10, peu_commun: 0.25 };
  const SHOWN = ['peu_commun', 'rare', 'epique', 'legendaire', 'mythique', 'ethere'];
  const VAULT = "<svg width='64' height='64' viewBox='0 0 32 32' aria-hidden='true'><path d='M16 5l9 5v12l-9 5-9-5V10z' fill='none' stroke='#f5c518' stroke-width='2' stroke-linejoin='round'/><path d='M16 11l5 5-5 5-5-5z' fill='#f5c518'/></svg>";
  const byId = (id) => document.getElementById(id);
  let info = null;
  let busy = false;
  let visible = false;
  let timer = null;
  let revealTimers = [];
  let lastKey = '';
  let selected = 1;
  let dragStart = null;

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
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function plural(n, word) {
    return n + ' ' + word + (n > 1 ? 's' : '');
  }

  function optionList() {
    const set = new Set([1, 5, 10, 20, 50].filter((n) => n <= info.max_open));
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
      text = `Gratuit · ${info.free} restant${info.free > 1 ? 's' : ''}`;
    } else if (freeUsed === 0) {
      text = cost.toLocaleString('fr-FR') + ' crédits';
    } else {
      text = `${freeUsed} gratuit${freeUsed > 1 ? 's' : ''} + ${cost.toLocaleString('fr-FR')} crédits`;
    }
    return { text, cost, paid };
  }

  function packSvg(n, cards) {
    return `<svg width='240' height='340' viewBox='0 0 240 340' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>`
      + "<defs><linearGradient id='pk-bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#e7a948'/><stop offset='.48' stop-color='#9a5d17'/><stop offset='1' stop-color='#4d2b07'/></linearGradient>"
      + "<radialGradient id='pk-glow' cx='50%' cy='46%' r='56%'><stop offset='0' stop-color='#ffd77a' stop-opacity='.55'/><stop offset='1' stop-color='#000' stop-opacity='0'/></radialGradient>"
      + "<pattern id='pk-crimp' width='6' height='14' patternUnits='userSpaceOnUse'><rect width='3' height='14' fill='#000' opacity='.28'/></pattern></defs>"
      + "<rect x='8' y='4' width='224' height='332' rx='10' fill='url(#pk-bg)' stroke='#f7cf77' stroke-opacity='.55' stroke-width='1.5'/>"
      + "<rect x='8' y='4' width='224' height='332' rx='10' fill='url(#pk-glow)'/>"
      + "<rect x='8' y='4' width='224' height='18' fill='url(#pk-crimp)'/><rect x='8' y='318' width='224' height='18' fill='url(#pk-crimp)'/>"
      + "<path d='M8 54 L24 48 L40 54 L56 48 L72 54 L88 48 L104 54 L120 48 L136 54 L152 48 L168 54 L184 48 L200 54 L216 48 L232 54' fill='none' stroke='#17130a' stroke-opacity='.55' stroke-width='2'/>"
      + "<text x='120' y='38' text-anchor='middle' font-size='12' font-weight='800' letter-spacing='4' fill='#17130a' fill-opacity='.82'>GAMEVAULT</text>"
      + "<circle cx='120' cy='154' r='60' fill='#0e0e14' stroke='#f7cf77' stroke-width='3'/>"
      + "<circle cx='120' cy='154' r='52' fill='none' stroke='#f59e0b' stroke-opacity='.55' stroke-width='1.5'/>"
      + "<path d='M120 116l30 17v34l-30 17-30-17v-34z' fill='none' stroke='#fbbf24' stroke-width='4' stroke-linejoin='round'/>"
      + "<path d='M120 138l16 16-16 16-16-16z' fill='#fbbf24'/>"
      + `<text x='120' y='246' text-anchor='middle' font-size='21' font-weight='800' fill='#17130a'>${n > 1 ? '×' + n + ' Boosters' : 'Booster'}</text>`
      + "<text x='120' y='266' text-anchor='middle' font-size='12' font-weight='600' fill='#17130a' fill-opacity='.78'>Catalogue complet</text>"
      + "<rect x='78' y='282' width='84' height='24' rx='12' fill='#17130a' fill-opacity='.78'/>"
      + `<text x='120' y='298' text-anchor='middle' font-size='11' font-weight='700' fill='#f4f4f8'>${plural(cards, 'carte')}</text></svg>`;
  }

  function renderOdds(cards) {
    byId('b-odds').replaceChildren(...SHOWN.map((tier) => {
      const pct = (1 - Math.pow(1 - ODDS[tier], cards)) * 100;
      const row = document.createElement('li');
      row.className = 'r-' + tier;
      const dot = document.createElement('i');
      const name = document.createElement('span');
      name.textContent = LABELS[tier];
      const bar = document.createElement('span');
      bar.className = 'bar';
      const fill = document.createElement('b');
      fill.style.width = pct.toFixed(2) + '%';
      bar.append(fill);
      const value = document.createElement('span');
      value.className = 'pct';
      value.textContent = (pct < 10 ? pct.toFixed(2) : pct.toFixed(1)).replace('.', ',') + ' %';
      row.append(dot, name, bar, value);
      return row;
    }));
  }

  function renderControls() {
    const list = optionList();
    if (!list.includes(selected)) {
      selected = 1;
    }
    const detail = describe(selected);
    const cards = selected * info.count;
    byId('b-pack-art').innerHTML = packSvg(selected, cards);
    byId('b-options').replaceChildren(...list.map((n) => {
      const d = describe(n);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'b-pill' + (n > 1 && n === info.free ? ' best' : '');
      button.setAttribute('aria-pressed', n === selected ? 'true' : 'false');
      button.textContent = '×' + n;
      button.disabled = busy || d.cost > info.credits;
      button.addEventListener('click', () => {
        selected = n;
        lastKey = '';
        render();
      });
      return button;
    }));
    const openBtn = byId('b-open');
    openBtn.disabled = busy || detail.cost > info.credits;
    byId('b-open-sub').textContent = detail.text;
    byId('b-info').textContent = `${info.free}/${info.max_free} gratuits · ${info.credits.toLocaleString('fr-FR')} crédits · ${info.price} crédits/booster payant`;
    renderOdds(cards);
  }

  function render() {
    const stage = byId('b-stage');
    if (!state.user || !info) {
      stage.hidden = true;
      byId('b-msg').textContent = !state.user ? 'Connecte-toi pour ouvrir des boosters.' : 'Chargement…';
      lastKey = '';
      return;
    }
    stage.hidden = false;
    byId('b-timer').textContent = info.free >= info.max_free
      ? 'Stock plein (50/50)'
      : 'Prochain booster gratuit dans ' + formatTime(info.next_in);
    const key = `${info.free}|${info.credits}|${busy}|${selected}`;
    if (key !== lastKey) {
      lastKey = key;
      renderControls();
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
    back.innerHTML = VAULT;
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

  function triggerOpen() {
    if (!info || busy) {
      return;
    }
    const detail = describe(selected);
    if (detail.cost > info.credits) {
      byId('b-msg').textContent = MSG.insufficient_credits;
      return;
    }
    if (detail.cost > 0 && !window.confirm(`Dépenser ${detail.cost} crédits pour ${plural(detail.paid, 'booster')} payant${detail.paid > 1 ? 's' : ''} ?`)) {
      return;
    }
    const pack = byId('b-pack');
    pack.classList.remove('rip');
    void pack.offsetWidth;
    pack.classList.add('rip');
    open(selected);
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
      byId('b-summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const packEl = byId('b-pack');
  const tearLine = byId('b-tear-line');
  packEl.addEventListener('pointerdown', (event) => {
    if (!info || busy) {
      return;
    }
    dragStart = event.clientX;
    packEl.classList.add('tearing');
    packEl.setPointerCapture(event.pointerId);
  });
  packEl.addEventListener('pointermove', (event) => {
    if (dragStart === null) {
      return;
    }
    const width = packEl.getBoundingClientRect().width || 240;
    const progress = Math.min(1, Math.abs(event.clientX - dragStart) / (width * 0.6));
    tearLine.style.width = (progress * 100).toFixed(0) + '%';
    if (progress >= 1) {
      dragStart = null;
      packEl.classList.remove('tearing');
      tearLine.style.width = '0';
      triggerOpen();
    }
  });
  const resetDrag = () => {
    dragStart = null;
    packEl.classList.remove('tearing');
    tearLine.style.width = '0';
  };
  packEl.addEventListener('pointerup', resetDrag);
  packEl.addEventListener('pointercancel', resetDrag);
  packEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      triggerOpen();
    }
  });

  const revealButton = document.createElement('button');
  revealButton.type = 'button';
  revealButton.id = 'b-reveal';
  revealButton.className = 'ghost';
  revealButton.textContent = 'Tout révéler';
  revealButton.hidden = true;
  byId('b-result').before(revealButton);
  revealButton.addEventListener('click', revealAll);

  byId('b-open').addEventListener('click', triggerOpen);

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
