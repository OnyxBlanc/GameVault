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
  const ODDS = { ethere: 0.00001, mythique: 0.00075, legendaire: 0.0045, epique: 0.015, rare: 0.10, peu_commun: 0.25 };
  const SHOWN = ['peu_commun', 'rare', 'epique', 'legendaire', 'mythique', 'ethere'];
  const VAULT = "<svg width='64' height='64' viewBox='0 0 32 32' aria-hidden='true'><path d='M16 5l9 5v12l-9 5-9-5V10z' fill='none' stroke='#f5c518' stroke-width='2' stroke-linejoin='round'/><path d='M16 11l5 5-5 5-5-5z' fill='#f5c518'/></svg>";
  const byId = (id) => document.getElementById(id);
  let info = null;
  let busy = false;
  let visible = false;
  let timer = null;
  let revealTimers = [];
  let activeReveal = null;
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
    const c1 = n >= 20 ? '#c084fc' : (n >= 10 ? '#38bdf8' : '#f7cf6a');
    const c2 = n >= 20 ? '#6d28d9' : (n >= 10 ? '#1d4ed8' : '#b46914');
    const c3 = n >= 20 ? '#1e1038' : (n >= 10 ? '#0c1a38' : '#3a1f05');
    return `<svg width='260' height='368' viewBox='0 0 260 368' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>`
      + `<defs>`
      + `<linearGradient id='pk-bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='.48' stop-color='${c2}'/><stop offset='1' stop-color='${c3}'/></linearGradient>`
      + `<linearGradient id='pk-metal' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#11121a'/><stop offset='.25' stop-color='#303347'/><stop offset='.5' stop-color='#11121a'/><stop offset='.75' stop-color='#35394f'/><stop offset='1' stop-color='#11121a'/></linearGradient>`
      + `<radialGradient id='pk-glow' cx='50%' cy='44%' r='54%'><stop offset='0' stop-color='#fff6d6' stop-opacity='.55'/><stop offset='.6' stop-color='${c1}' stop-opacity='.18'/><stop offset='1' stop-color='#000' stop-opacity='0'/></radialGradient>`
      + `<pattern id='pk-crimp' width='8' height='22' patternUnits='userSpaceOnUse'><rect width='4' height='22' fill='#000' opacity='.35'/><rect x='4' width='1' height='22' fill='#fff' opacity='.18'/></pattern>`
      + `<pattern id='pk-diag' width='14' height='14' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><line x1='0' y1='0' x2='0' y2='14' stroke='#fff' stroke-opacity='.06' stroke-width='2'/></pattern>`
      + `</defs>`
      + `<rect x='10' y='4' width='240' height='360' rx='14' fill='url(#pk-bg)' stroke='#fff3c4' stroke-opacity='.65' stroke-width='1.5'/>`
      + `<rect x='10' y='4' width='240' height='360' rx='14' fill='url(#pk-diag)'/>`
      + `<rect x='10' y='4' width='240' height='360' rx='14' fill='url(#pk-glow)'/>`
      + `<rect x='10' y='4' width='240' height='22' rx='4' fill='url(#pk-metal)'/><rect x='10' y='4' width='240' height='22' fill='url(#pk-crimp)'/>`
      + `<rect x='10' y='342' width='240' height='22' rx='4' fill='url(#pk-metal)'/><rect x='10' y='342' width='240' height='22' fill='url(#pk-crimp)'/>`
      + `<rect x='20' y='34' width='220' height='300' rx='10' fill='none' stroke='#fff6d6' stroke-opacity='.28' stroke-width='1.2'/>`
      + `<path d='M10 58 L26 52 L42 58 L58 52 L74 58 L90 52 L106 58 L122 52 L138 58 L154 52 L170 58 L186 52 L202 58 L218 52 L234 58 L250 52' fill='none' stroke='#09090d' stroke-opacity='.55' stroke-width='2'/>`
      + `<text x='130' y='47' text-anchor='middle' font-size='11' font-weight='900' letter-spacing='5' fill='#fff7dc' fill-opacity='.92'>GAMEVAULT</text>`
      + `<g opacity='.25' stroke='#fff7dc' stroke-width='1.2'><line x1='130' y1='76' x2='130' y2='244'/><line x1='46' y1='160' x2='214' y2='160'/><line x1='70' y1='100' x2='190' y2='220'/><line x1='190' y1='100' x2='70' y2='220'/></g>`
      + `<circle cx='130' cy='160' r='68' fill='#0c0d16' stroke='#fde68a' stroke-width='3'/>`
      + `<circle cx='130' cy='160' r='59' fill='none' stroke='${c1}' stroke-opacity='.65' stroke-width='1.6' stroke-dasharray='6 4'/>`
      + `<path d='M130 118l34 19v38l-34 19-34-19v-38z' fill='rgba(245,197,24,.1)' stroke='#fde047' stroke-width='4' stroke-linejoin='round'/>`
      + `<path d='M130 140l18 18-18 18-18-18z' fill='#fde047'/>`
      + `<circle cx='54' cy='96' r='3' fill='#fff7dc' opacity='.8'/><circle cx='208' cy='106' r='2.5' fill='#fff7dc' opacity='.75'/><circle cx='200' cy='218' r='3' fill='#fff7dc' opacity='.8'/>`
      + `<text x='130' y='262' text-anchor='middle' font-size='22' font-weight='900' fill='#fff9e6'>${n > 1 ? '×' + n + ' BOOSTERS' : 'BOOSTER'}</text>`
      + `<text x='130' y='282' text-anchor='middle' font-size='11' font-weight='700' letter-spacing='1.5' fill='#fff5d6' fill-opacity='.82'>ÉDITION CATALOGUE</text>`
      + `<rect x='74' y='296' width='112' height='26' rx='13' fill='#0a0b12' fill-opacity='.86' stroke='#fde68a' stroke-opacity='.5'/>`
      + `<text x='130' y='313' text-anchor='middle' font-size='12' font-weight='800' fill='#fde68a'>${plural(cards, 'carte')}</text></svg>`;
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
      const formatted = pct < 0.1 ? pct.toFixed(3) : (pct < 10 ? pct.toFixed(2) : pct.toFixed(1));
      value.textContent = formatted.replace('.', ',') + ' %';
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
    stage.hidden = Boolean(activeReveal);
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

  function showSummary(data) {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
    const sorted = data.items.slice().sort((a, b) => {
      const diff = TIERS.indexOf(b.rarete) - TIERS.indexOf(a.rarete);
      return diff !== 0 ? diff : a.titre.localeCompare(b.titre);
    });
    const isFan = sorted.length > 0 && sorted.length <= 5;
    const ordered = sorted.slice();
    let bestIndex = 0;
    if (isFan && ordered.length >= 3) {
      const best = ordered.shift();
      bestIndex = Math.floor(ordered.length / 2);
      ordered.splice(bestIndex, 0, best);
    }
    const result = byId('b-result');
    result.className = isFan ? 'grid gv-fan' : 'grid';
    result.replaceChildren(...ordered.map((game, index) => {
      const wrap = makeCard(game, index, true);
      if (index === bestIndex && ordered.length > 0) {
        wrap.classList.add('best-card');
        const badge = document.createElement('span');
        badge.className = 'best-tag';
        badge.textContent = 'Meilleure carte';
        wrap.append(badge);
      }
      return wrap;
    }));
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

  function cancelCardReveal() {
    if (activeReveal) {
      activeReveal();
    }
  }

  function startCardReveal(data) {
    cancelCardReveal();
    const stage = byId('b-stage');
    const result = byId('b-result');
    const summary = byId('b-summary');
    const revealAllButton = byId('b-reveal');

    const cards = data.items
      .slice()
      .sort((a, b) => TIERS.indexOf(a.rarete) - TIERS.indexOf(b.rarete))
      .flatMap((game) => Array.from({ length: game.obtenu }, () => Object.assign({}, game, { obtenu: 1 })));

    if (!cards.length) {
      showSummary(data);
      summary.textContent = summaryText(data);
      return;
    }

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) {
        node.className = className;
      }
      if (text !== undefined) {
        node.textContent = text;
      }
      return node;
    };

    const scene = el('section', 'gv-reveal');
    scene.setAttribute('aria-label', 'Révélation des cartes');
    const pile = el('div', 'gv-reveal-pile');
    const tierLine = el('p', 'gv-reveal-tier');
    const caption = el('p', 'gv-reveal-caption');
    caption.setAttribute('aria-live', 'polite');

    const showThumbs = cards.length <= 10;
    const thumbs = showThumbs ? el('div', 'gv-reveal-thumbs') : null;
    const thumbNodes = showThumbs ? cards.map(() => {
      const slot = el('span', 'gv-thumb');
      thumbs.append(slot);
      return slot;
    }) : [];

    const progress = el('p', 'gv-reveal-progress');
    const controls = el('div', 'gv-reveal-controls');
    const next = el('button', 'primary');
    const skip = el('button', 'ghost', 'Tout révéler');
    next.type = 'button';
    skip.type = 'button';
    controls.append(next, skip);
    scene.append(pile, tierLine, caption);
    if (thumbs) {
      scene.append(thumbs);
    }
    scene.append(progress, controls);

    let index = 0;
    let faceUp = false;
    let card = null;

    function cleanup() {
      scene.remove();
      activeReveal = null;
      render();
    }

    function finish() {
      cleanup();
      showSummary(data);
      summary.textContent = summaryText(data);
      const actions = el('div', 'gv-reveal-controls');
      const again = el('button', 'primary', 'Ouvrir un autre');
      const collection = el('button', 'ghost', 'Voir ma collection');
      again.type = 'button';
      collection.type = 'button';
      again.addEventListener('click', () => {
        byId('b-open').scrollIntoView({ behavior: 'smooth', block: 'center' });
        byId('b-open').focus();
      });
      collection.addEventListener('click', () => {
        const tab = document.querySelector('[data-view="collection"]');
        if (tab) {
          tab.click();
        }
      });
      actions.append(again, collection);
      summary.append(actions);
      summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function updateThumbs(revealed) {
      if (!showThumbs) {
        return;
      }
      thumbNodes.forEach((slot, i) => {
        slot.classList.toggle('now', i === index);
        if (i === index && revealed && !slot.classList.contains('done')) {
          const game = cards[i];
          const tier = TIERS.includes(game.rarete) ? game.rarete : 'commun';
          slot.classList.add('done', 'r-' + tier);
          if (typeof game.image_url === 'string' && game.image_url.startsWith('https://')) {
            const img = document.createElement('img');
            img.src = game.image_url;
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            slot.replaceChildren(img);
          }
        }
      });
    }

    function showFaceDown() {
      const game = cards[index];
      faceUp = false;
      scene.dataset.tier = 'commun';
      const visual = makeCard(game, 0, true);
      card = visual.cloneNode(true);
      card.classList.remove('open', 'teaser');
      card.removeAttribute('tabindex');
      card.removeAttribute('role');
      card.removeAttribute('aria-pressed');
      card.removeAttribute('aria-label');
      card.setAttribute('aria-hidden', 'true');
      pile.replaceChildren(card);
      tierLine.textContent = '';
      caption.textContent = 'Touche la carte pour la retourner';
      progress.textContent = `${index + 1} / ${cards.length}`;
      next.textContent = 'Retourner la carte';
      updateThumbs(false);
    }

    function advance() {
      if (!faceUp) {
        const game = cards[index];
        const tier = TIERS.includes(game.rarete) ? game.rarete : 'commun';
        faceUp = true;
        card.classList.add('open');
        scene.dataset.tier = tier;
        tierLine.textContent = LABELS[tier];
        caption.textContent = game.titre;
        next.textContent = index + 1 === cards.length ? 'Voir le bilan' : 'Carte suivante';
        updateThumbs(true);
        return;
      }
      if (++index >= cards.length) {
        finish();
      } else {
        showFaceDown();
      }
    }

    revealTimers.forEach(clearTimeout);
    revealTimers = [];
    result.replaceChildren();
    result.className = 'grid';
    revealAllButton.hidden = true;
    summary.textContent = '';
    activeReveal = cleanup;
    stage.hidden = true;
    stage.after(scene);

    pile.addEventListener('click', advance);
    next.addEventListener('click', advance);
    skip.addEventListener('click', finish);
    next.addEventListener('keydown', (event) => {
      if (event.repeat && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
      }
    });

    showFaceDown();
    next.focus();
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
      applyState(data.state);
      if (visible && state.user) {
        startCardReveal(data);
      }
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
    cancelCardReveal();
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
