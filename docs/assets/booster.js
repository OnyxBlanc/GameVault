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
  const VAULT = "<svg viewBox='0 0 32 32' aria-hidden='true'><circle cx='16' cy='16' r='9' fill='none' stroke='#f5c518' stroke-width='2'/><path d='M16 3v6M16 23v6M3 16h6M23 16h6' stroke='#f5c518' stroke-width='2' stroke-linecap='round'/><circle cx='16' cy='16' r='2.5' fill='#f5c518'/></svg>";
  const byId = (id) => document.getElementById(id);
  let info = null;
  let busy = false;
  let visible = false;
  let timer = null;
  let revealTimers = [];
  let lastKey = '';
  let selected = 1;

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

  function packSvg(n, gold, cards) {
    const hue = gold ? 46 : (n * 47 + 190) % 360;
    const light = `hsl(${hue} 78% 60%)`;
    const dark = `hsl(${hue} 55% 18%)`;
    const id = 'pk' + n;
    const label = n > 1 ? 'BOOSTERS' : 'BOOSTER';
    const ribbon = gold
      ? "<g transform='rotate(-6 80 157)'><rect x='-8' y='146' width='176' height='22' fill='#f5c518'/><text x='80' y='161' text-anchor='middle' font-size='11' font-weight='800' letter-spacing='3' fill='#17130a'>DORÉ</text></g>"
      : '';
    return `<svg viewBox='0 0 160 220' xmlns='http://www.w3.org/2000/svg' role='img' aria-label='${n} ${label.toLowerCase()}'>`
      + `<defs><linearGradient id='${id}a' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${light}'/><stop offset='1' stop-color='${dark}'/></linearGradient>`
      + `<pattern id='${id}b' width='5' height='8' patternUnits='userSpaceOnUse'><rect width='2' height='8' fill='#000' opacity='.28'/></pattern>`
      + `<linearGradient id='${id}c' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='.28'/><stop offset='.35' stop-color='#fff' stop-opacity='0'/></linearGradient></defs>`
      + `<rect x='8' y='4' width='144' height='212' rx='5' fill='url(#${id}a)' stroke='${light}' stroke-opacity='.6'/>`
      + `<rect x='8' y='4' width='144' height='212' rx='5' fill='url(#${id}c)'/>`
      + `<rect x='8' y='4' width='144' height='14' fill='url(#${id}b)'/><rect x='8' y='202' width='144' height='14' fill='url(#${id}b)'/>`
      + "<text x='80' y='40' text-anchor='middle' font-size='11' font-weight='800' letter-spacing='3' fill='#fff' fill-opacity='.9'>GAMEVAULT</text>"
      + "<circle cx='80' cy='98' r='42' fill='#0b0b10' stroke='#fff' stroke-opacity='.8' stroke-width='3'/>"
      + `<circle cx='80' cy='98' r='35' fill='none' stroke='${light}' stroke-width='1.5' stroke-dasharray='2 4'/>`
      + `<text x='80' y='${n >= 10 ? 111 : 113}' text-anchor='middle' font-size='${n >= 10 ? 34 : 40}' font-weight='800' fill='${light}'>${n}</text>`
      + ribbon
      + `<text x='80' y='184' text-anchor='middle' font-size='11' font-weight='800' letter-spacing='2' fill='#fff'>${label}</text>`
      + `<text x='80' y='196' text-anchor='middle' font-size='8' font-weight='600' letter-spacing='1' fill='#fff' fill-opacity='.75'>${cards} CARTES</text></svg>`;
  }

  function chip(name, text) {
    const node = document.createElement('span');
    node.className = 'chip';
    node.append(icon(name), document.createTextNode(text));
    return node;
  }

  function tile(value, label, gold) {
    const node = document.createElement('div');
    node.className = 'tile' + (gold ? ' gold' : '');
    const big = document.createElement('b');
    big.textContent = value;
    const small = document.createElement('span');
    small.textContent = label;
    node.append(big, small);
    return node;
  }

  function renderSide() {
    const n = selected;
    const detail = describe(n);
    const cards = n * info.count;
    byId('b-side-medal').textContent = '×' + n;
    byId('b-side-title').textContent = plural(n, 'booster');
    byId('b-side-sub').textContent = plural(cards, 'carte');
    byId('b-tiles').replaceChildren(
      tile(String(info.count), 'cartes par booster'),
      tile(`${info.free}/${info.max_free}`, 'boosters gratuits'),
      tile(info.credits.toLocaleString('fr-FR'), 'crédits'),
      tile(detail.cost === 0 ? 'Gratuit' : String(detail.cost), detail.cost === 0 ? 'rien à payer' : 'crédits à payer', true)
    );
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
    const button = byId('b-open');
    button.disabled = busy || detail.cost > info.credits;
    byId('b-open-sub').textContent = detail.text;
  }

  function renderOptions() {
    const list = optionList();
    if (!list.includes(selected)) {
      selected = 1;
    }
    byId('b-options').replaceChildren(...list.map((n) => {
      const detail = describe(n);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pack' + (detail.paid === 0 ? ' free' : '');
      button.setAttribute('aria-pressed', n === selected ? 'true' : 'false');
      button.disabled = busy || detail.cost > info.credits;
      const art = document.createElement('span');
      art.className = 'art';
      art.innerHTML = packSvg(n, n > 1 && n === info.free, n * info.count);
      const title = document.createElement('strong');
      title.textContent = plural(n, 'booster');
      const sub = document.createElement('small');
      sub.textContent = detail.text;
      button.append(art, title, sub);
      button.addEventListener('click', () => {
        selected = n;
        lastKey = '';
        render();
      });
      return button;
    }));
    renderSide();
  }

  function render() {
    const chips = byId('b-info');
    const side = byId('b-side');
    if (!state.user || !info) {
      chips.replaceChildren(document.createTextNode(!state.user ? 'Connecte-toi pour ouvrir des boosters.' : 'Chargement…'));
      byId('b-options').replaceChildren();
      side.hidden = true;
      lastKey = '';
      return;
    }
    side.hidden = false;
    byId('b-timer').textContent = info.free >= info.max_free
      ? 'Stock plein : ouvre des boosters pour relancer la régénération.'
      : 'Prochain gratuit dans ' + formatTime(info.next_in);
    const key = `${info.free}|${info.credits}|${busy}|${selected}`;
    if (key !== lastKey) {
      lastKey = key;
      chips.replaceChildren(
        chip('pack', `${info.free}/${info.max_free} boosters gratuits`),
        chip('coin', `${info.credits.toLocaleString('fr-FR')} crédits`),
        chip('layers', `${info.count} cartes par booster · ${info.price} crédits l'unité`)
      );
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

  const revealButton = document.createElement('button');
  revealButton.type = 'button';
  revealButton.id = 'b-reveal';
  revealButton.className = 'ghost';
  revealButton.textContent = 'Tout révéler';
  revealButton.hidden = true;
  byId('b-result').before(revealButton);
  revealButton.addEventListener('click', revealAll);

  byId('b-open').addEventListener('click', () => {
    if (!info || busy) {
      return;
    }
    const detail = describe(selected);
    if (detail.cost > 0 && !window.confirm(`Dépenser ${detail.cost} crédits pour ${plural(detail.paid, 'booster')} payant${detail.paid > 1 ? 's' : ''} ?`)) {
      return;
    }
    open(selected);
  });

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
