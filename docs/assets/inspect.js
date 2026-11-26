'use strict';

(function () {
  const LABELS = {
    commun: 'Commun',
    peu_commun: 'Peu commun',
    rare: 'Rare',
    epique: 'Épique',
    legendaire: 'Légendaire',
    mythique: 'Mythique',
    ethere: 'Éthéré'
  };
  const cache = new Map();
  const baseRenderCard = window.renderCard;
  let list = [];
  let index = 0;

  window.renderCard = function (game) {
    const card = baseRenderCard(game);
    card._game = game;
    return card;
  };

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

  const dialog = el('dialog');
  dialog.id = 'inspect';
  const bar = el('div', 'in-bar');
  const prev = el('button', '', '←');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Carte précédente');
  const pos = el('span');
  pos.id = 'in-pos';
  const next = el('button', '', '→');
  next.type = 'button';
  next.setAttribute('aria-label', 'Carte suivante');
  const close = el('button', '', 'Fermer');
  close.type = 'button';
  bar.append(prev, pos, next, close);
  const stage = el('div');
  stage.id = 'in-stage';
  const hint = el('p', '', 'Clique sur la carte pour la retourner.');
  hint.id = 'in-hint';
  dialog.append(bar, stage, hint);
  document.body.append(dialog);

  async function loadStats(game) {
    if (cache.has(game.id)) {
      return cache.get(game.id);
    }
    const response = await fetch('api/carte.php?id=' + encodeURIComponent(game.id), { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('stats');
    }
    const data = await response.json();
    cache.set(game.id, data);
    return data;
  }

  async function fillBack(game, back) {
    back.replaceChildren(el('p', '', 'Chargement…'));
    let lines;
    try {
      const data = await loadStats(game);
      lines = [
        el('h3', '', game.titre),
        el('p', '', LABELS[data.rarete] || ''),
        el('p', 'big', String(data.total)),
        el('p', '', data.total > 1 ? 'exemplaires tirés par les joueurs' : 'exemplaire tiré par les joueurs'),
        el('p', '', `${data.proprietaires} joueur${data.proprietaires > 1 ? 's' : ''} la possède${data.proprietaires > 1 ? 'nt' : ''}`)
      ];
      if (data.mine !== null) {
        lines.push(el('p', '', `Tes exemplaires : ${data.mine}`));
      }
    } catch (error) {
      lines = [el('p', '', 'Statistiques indisponibles.')];
    }
    if (back.isConnected) {
      back.replaceChildren(...lines);
    }
  }

  function buildCard(game) {
    const tier = LABELS[game.rarete] ? game.rarete : 'commun';
    const wrap = el('div', 'flip inspect open r-' + tier);
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-label', game.titre + ', appuie pour retourner la carte');
    const inner = el('div', 'flip-inner');
    const back = el('div', 'face back stats');
    const front = el('div', 'face front');
    front.append(window.renderCard(game), el('span', 'rarity', LABELS[tier]), el('span', 'holo'));
    inner.append(back, front);
    wrap.append(inner);
    const toggle = () => {
      wrap.classList.toggle('open');
      if (!wrap.classList.contains('open')) {
        fillBack(game, back);
      }
    };
    wrap.addEventListener('click', toggle);
    wrap.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
    return wrap;
  }

  function show(i) {
    index = Math.max(0, Math.min(list.length - 1, i));
    stage.replaceChildren(buildCard(list[index]));
    pos.textContent = `${index + 1} / ${list.length}`;
    prev.disabled = index === 0;
    next.disabled = index === list.length - 1;
  }

  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      show(index - 1);
    } else if (event.key === 'ArrowRight') {
      show(index + 1);
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  dialog.addEventListener('pointermove', (event) => {
    const face = event.target.closest('.front');
    if (!face) {
      return;
    }
    const rect = face.getBoundingClientRect();
    face.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
    face.style.setProperty('--my', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
  });

  document.addEventListener('click', (event) => {
    if (dialog.contains(event.target)) {
      return;
    }
    const card = event.target.closest('.card');
    if (!card || !card._game) {
      return;
    }
    const scope = card.closest('.grid') || document;
    const cards = Array.from(scope.querySelectorAll('.card')).filter((c) => c._game && !c.closest('.flip:not(.open)'));
    list = cards.map((c) => c._game);
    const start = list.indexOf(card._game);
    if (start < 0) {
      return;
    }
    dialog.showModal();
    show(start);
  });
})();
