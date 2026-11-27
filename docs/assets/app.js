'use strict';

const API = 'api/index.php';
const MESSAGES = {
  invalid_credentials: 'Pseudo ou mot de passe incorrect.',
  pseudo_taken: 'Ce pseudo est déjà pris.',
  email_taken: 'Cet email est déjà utilisé.',
  invalid_email: 'Adresse email invalide.',
  invalid_pseudo: 'Pseudo : 3 à 32 caractères (lettres, chiffres, _ ou -).',
  invalid_password: 'Mot de passe : 8 caractères minimum.',
  unauthenticated: 'Connecte-toi pour continuer.',
  already_claimed: 'Tu as déjà ouvert ton pack de départ.',
  catalogue_empty: 'Le catalogue est vide pour le moment.',
  service_unavailable: 'Service indisponible. Réessaie plus tard.',
  server_error: 'Erreur serveur. Réessaie plus tard.',
  forbidden: 'Requête refusée.',
  invalid_json: 'Requête invalide.'
};
const RARETES = {
  commun: 'Commun',
  peu_commun: 'Peu commun',
  rare: 'Rare',
  epique: 'Épique',
  legendaire: 'Légendaire',
  mythique: 'Mythique',
  ethere: 'Éthéré'
};
const ICONS = {
  coin: "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='9'/><path d='M12 7v10M9.5 9.5h4a1.8 1.8 0 010 3.5h-3a1.8 1.8 0 000 3.5h4.5'/></svg>",
  pack: "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='5' y='3' width='14' height='18' rx='2'/><path d='M5 7h14M5 17h14M12 10v4'/></svg>",
  layers: "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 3l9 5-9 5-9-5z'/><path d='M3 13l9 5 9-5'/></svg>"
};

const state = { user: null, view: 'catalogue', page: 1, pages: 1, q: '', genre: '', sort: 'nom_asc' };
let requestId = 0;
let searchTimer;
const $ = (selector) => document.querySelector(selector);

function icon(name) {
  const holder = document.createElement('span');
  holder.className = 'ico';
  holder.innerHTML = ICONS[name] || '';
  return holder;
}

async function api(action, options = {}) {
  const { method = 'GET', params = {}, body } = options;
  const url = new URL(API, window.location.href);
  url.searchParams.set('a', action);
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== null && value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  const init = { method, credentials: 'same-origin', headers: {} };
  if (method === 'POST') {
    init.headers['Content-Type'] = 'application/json';
    init.headers['X-Requested-With'] = 'GameVault';
    init.body = JSON.stringify(body || {});
  }
  let response;
  try {
    response = await fetch(url, init);
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
    const code = data && data.error;
    const failure = new Error(MESSAGES[code] || 'Réponse invalide du serveur.');
    failure.code = code;
    throw failure;
  }
  return data;
}

function setStatus(message) {
  $('#status').textContent = message || '';
}

function makeButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function renderCard(game) {
  const card = document.createElement('article');
  card.className = 'card';
  const tier = RARETES[game.rarete] ? game.rarete : 'commun';
  if (tier !== 'commun') {
    card.classList.add('r-' + tier);
  }
  const media = document.createElement('div');
  media.className = 'media';
  if (typeof game.image_url === 'string' && game.image_url.startsWith('https://')) {
    const image = document.createElement('img');
    image.loading = 'lazy';
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.src = game.image_url;
    media.append(image);
  } else {
    media.textContent = game.titre.charAt(0).toUpperCase();
  }
  const title = document.createElement('h3');
  title.textContent = game.titre;
  const meta = document.createElement('p');
  meta.className = 'meta';
  const year = game.date_sortie ? game.date_sortie.slice(0, 4) : '';
  meta.textContent = [year, RARETES[tier], ...(game.genres || [])].filter(Boolean).join(' · ');
  card.append(media, title, meta);
  const count = game.quantite || game.obtenu || 0;
  if (count > 1) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = '×' + count;
    card.append(badge);
  }
  return card;
}

function renderAccount() {
  const box = $('#account');
  box.replaceChildren();
  if (!state.user) {
    const login = makeButton('Connexion', () => $('#auth').showModal());
    login.className = 'primary';
    box.append(login);
    return;
  }
  const credits = document.createElement('span');
  credits.className = 'chip';
  credits.title = 'Crédits';
  credits.append(icon('coin'), document.createTextNode(Number(state.user.credits).toLocaleString('fr-FR')));
  const name = document.createElement('span');
  name.className = 'pseudo';
  name.textContent = state.user.pseudo;
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = state.user.pseudo.charAt(0).toUpperCase();
  const out = makeButton('Déconnexion', logout);
  out.className = 'ghost';
  box.append(credits, name, avatar, out);
}

function renderStarter() {
  const eligible = Boolean(state.user) && !state.user.starter_claimed;
  $('#starter').hidden = !eligible;
  if (eligible) {
    $('#starter-text').textContent = 'Bienvenue ! Ouvre ton pack de départ pour recevoir 5 jeux.';
    $('#starter-btn').hidden = false;
    $('#starter-btn').disabled = false;
    $('#starter-result').replaceChildren();
  }
}

async function loadGenres() {
  const data = await api('genres');
  const select = $('#genre');
  for (const genre of data.items) {
    const option = document.createElement('option');
    option.value = String(genre.id);
    option.textContent = genre.nom;
    select.append(option);
  }
}

async function loadMe() {
  const data = await api('me');
  state.user = data.user;
}

async function loadGames() {
  const id = ++requestId;
  const owned = state.view === 'collection';
  setStatus('Chargement…');
  try {
    const data = await api(owned ? 'collection' : 'catalogue', {
      params: { page: state.page, q: state.q, genre: state.genre, sort: state.sort }
    });
    if (id !== requestId) {
      return;
    }
    state.pages = data.pages;
    $('#grid').replaceChildren(...data.items.map(renderCard));
    if (data.total === 0) {
      setStatus(owned ? 'Ta collection est vide.' : 'Aucun jeu trouvé.');
    } else {
      setStatus(`${data.total} jeu${data.total > 1 ? 'x' : ''}`);
    }
    $('#page-info').textContent = `Page ${data.page} / ${data.pages}`;
    $('#prev').disabled = data.page <= 1;
    $('#next').disabled = data.page >= data.pages;
  } catch (error) {
    if (id === requestId) {
      $('#grid').replaceChildren();
      setStatus(error.message);
    }
  }
}

function setView(view) {
  if (view === 'collection' && !state.user) {
    $('#auth').showModal();
    return;
  }
  state.view = view;
  state.page = 1;
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  loadGames();
}

async function logout() {
  try {
    await api('logout', { method: 'POST' });
  } catch (error) {
    setStatus(error.message);
  }
  state.user = null;
  renderAccount();
  renderStarter();
  setView('catalogue');
}

async function openStarter() {
  const button = $('#starter-btn');
  button.disabled = true;
  try {
    const data = await api('starter', { method: 'POST' });
    state.user = data.user;
    renderAccount();
    $('#starter-text').textContent = 'Pack ouvert ! Voici tes jeux :';
    button.hidden = true;
    $('#starter-result').replaceChildren(...data.items.map(renderCard));
    if (state.view === 'collection') {
      loadGames();
    }
  } catch (error) {
    button.disabled = false;
    setStatus(error.message);
  }
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => setView(tab.dataset.view));
});

$('#search').addEventListener('input', (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = event.target.value.trim();
    state.page = 1;
    loadGames();
  }, 500);
});

$('#genre').addEventListener('change', (event) => {
  state.genre = event.target.value;
  state.page = 1;
  loadGames();
});

$('#sort').addEventListener('change', (event) => {
  state.sort = event.target.value;
  state.page = 1;
  loadGames();
});

$('#prev').addEventListener('click', () => {
  if (state.page > 1) {
    state.page -= 1;
    loadGames();
  }
});

$('#next').addEventListener('click', () => {
  if (state.page < state.pages) {
    state.page += 1;
    loadGames();
  }
});

$('#starter-btn').addEventListener('click', openStarter);
$('#auth-cancel').addEventListener('click', () => $('#auth').close());

let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  $('#auth-title').textContent = mode === 'register' ? 'Créer un compte' : 'Connexion';
  $('#email-wrap').hidden = mode !== 'register';
  $('#email').required = mode === 'register';
  $('#auth-submit').textContent = mode === 'register' ? 'Créer un compte' : 'Se connecter';
  $('#auth-switch').textContent = mode === 'register' ? 'Déjà un compte ? Connexion' : 'Pas de compte ? Créer un compte';
  $('#auth-error').textContent = '';
}
$('#auth-switch').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
setAuthMode('login');

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = $('#auth-error');
  error.textContent = '';
  try {
    const payload = { pseudo: $('#pseudo').value.trim(), password: $('#password').value };
    if (authMode === 'register') {
      payload.email = $('#email').value.trim();
    }
    const data = await api(authMode, { method: 'POST', body: payload });
    state.user = data.user;
    $('#password').value = '';
    $('#auth').close();
    renderAccount();
    renderStarter();
    loadGames();
  } catch (failure) {
    error.textContent = failure.message;
  }
});

async function init() {
  renderAccount();
  try {
    await Promise.all([loadGenres(), loadMe()]);
  } catch (error) {
    setStatus(error.message);
  }
  renderAccount();
  renderStarter();
  loadGames();
}

init();
