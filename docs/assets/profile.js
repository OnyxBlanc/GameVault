'use strict';

(function () {
  const ENDPOINT = 'api/profile.php';
  const byId = (id) => document.getElementById(id);
  let currentData = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function call(action, method, body) {
    const init = { method, credentials: 'same-origin', headers: {} };
    if (method === 'POST') {
      init.headers['Content-Type'] = 'application/json';
      init.headers['X-Requested-With'] = 'GameVault';
      init.body = JSON.stringify(body || {});
    }
    const res = await fetch(ENDPOINT + '?a=' + action, init);
    const data = await res.json().catch(() => null);
    if (!res.ok || data === null) {
      throw new Error((data && data.error) || 'Erreur serveur.');
    }
    return data;
  }

  function showProfile(pseudo) {
    if (!pseudo && !state.user) {
      byId('auth').showModal();
      return;
    }
    byId('browse').hidden = true;
    byId('booster').hidden = true;
    byId('succes').hidden = true;
    byId('admin').hidden = true;
    byId('profile').hidden = false;
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    ['tab-booster', 'tab-succes', 'tab-admin'].forEach((id) => {
      const n = byId(id);
      if (n) n.classList.remove('active');
    });
    byId('tab-profile').classList.add('active');
    loadProfile(pseudo || '');
  }

  function hideProfile() {
    byId('profile').hidden = true;
    byId('tab-profile').classList.remove('active');
  }

  async function loadProfile(pseudo = '') {
    const box = byId('p-body');
    box.textContent = 'Chargement du profil…';
    try {
      const q = pseudo ? '&pseudo=' + encodeURIComponent(pseudo) : '';
      const data = await call('view' + q, 'GET');
      currentData = data;
      renderProfile(data);
    } catch (err) {
      box.textContent = err.message;
    }
  }

  function renderProfile(data) {
    const p = data.profile;
    const box = byId('p-body');
    const wrap = el('div', `p-wrap theme-${p.profile_theme || 'none'}`);

    const side = el('aside', 'p-side');
    const av = el('div', `p-avatar frame-${p.avatar_frame || 'auto'}`);
    if (p.avatar_url && p.avatar_url.startsWith('https://')) {
      const img = document.createElement('img');
      img.src = p.avatar_url;
      img.alt = p.pseudo;
      img.referrerPolicy = 'no-referrer';
      av.append(img);
    } else {
      av.textContent = p.pseudo.charAt(0).toUpperCase();
    }

    const pseudoEl = el('h2', `p-pseudo ps-${p.pseudo_style || 'default'}`, p.pseudo);
    side.append(av, pseudoEl);
    if (p.titre) side.append(el('p', 'p-titre', p.titre));
    if (p.bio) side.append(el('p', 'p-bio', p.bio));

    const since = el('div', 'p-since');
    const dateStr = p.cree_le ? new Date(p.cree_le.replace(' ', 'T')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    if (dateStr) since.append(el('span', '', `Membre depuis le ${dateStr}`));
    if (data.is_self) since.append(el('span', 'p-badge-self', "c'est toi"));
    side.append(since);

    const btns = el('div', 'p-btns');
    if (data.is_self) {
      const editBtn = el('button', 'primary', 'Personnaliser');
      editBtn.type = 'button';
      editBtn.addEventListener('click', openEditModal);
      btns.append(editBtn);
    }
    const copyBtn = el('button', 'ghost', 'Copier mon lien');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', async () => {
      const url = new URL(window.location.href);
      url.searchParams.set('profil', p.pseudo);
      await navigator.clipboard.writeText(url.toString()).catch(() => {});
      copyBtn.textContent = 'Lien copié !';
      setTimeout(() => { copyBtn.textContent = 'Copier mon lien'; }, 1800);
    });
    btns.append(copyBtn);
    side.append(btns);

    if (data.stats) {
      const st = data.stats;
      const pct = st.catalogue > 0 ? Math.min(100, (st.uniques / st.catalogue) * 100) : 0;
      const statsBox = el('div', 'p-stats');
      const ringRow = el('div', 'p-ring-row');
      const ring = el('div', 'p-ring', `${pct.toFixed(1)} %`);
      ring.style.setProperty('--pct', pct.toFixed(1));
      const countCol = el('div');
      countCol.append(
        el('strong', '', `${st.uniques.toLocaleString('fr-FR')} / ${st.catalogue.toLocaleString('fr-FR')}`),
        el('div', 'meta', 'Jeux uniques')
      );
      ringRow.append(ring, countCol);

      const grid = el('div', 'p-stat-grid');
      [
        [st.mythiques, 'Mythiques'],
        [st.etheres, 'Éthérées'],
        [st.succes, 'Succès']
      ].forEach(([val, lbl]) => {
        const d = el('div');
        d.append(el('strong', '', Number(val).toLocaleString('fr-FR')), el('span', '', lbl));
        grid.append(d);
      });
      statsBox.append(ringRow, grid);
      side.append(statsBox);
    }

    const main = el('div', 'p-main');
    const head = el('div', 'p-main-head');
    head.append(el('h2', '', data.is_self ? 'Ta vitrine' : `Vitrine de ${p.pseudo}`));
    if (data.is_self) {
      const pickBtn = el('button', 'ghost', 'Choisir ma vitrine');
      pickBtn.type = 'button';
      pickBtn.addEventListener('click', openShowcaseModal);
      head.append(pickBtn);
    }
    main.append(head);

    if (data.is_private) {
      main.append(el('p', 'meta', 'Ce profil est privé.'));
    } else if (!data.showcase.length) {
      main.append(el('p', 'meta', data.is_self ? 'Aucune carte en vitrine. Clique sur « Choisir ma vitrine » pour exposer jusqu’à 7 jeux.' : 'Aucune carte en vitrine.'));
    } else {
      const grid = el('div', `p-showcase style-${p.showcase_style || 'projecteur'}`);
      data.showcase.forEach((g) => grid.append(renderCard(g)));
      main.append(grid);
    }

    wrap.append(side, main);
    box.replaceChildren(wrap);
  }

  function openEditModal() {
    const dlg = byId('p-edit');
    const p = currentData.profile;
    byId('pe-bio').value = p.bio || '';
    byId('pe-avatar').value = p.avatar_url || '';
    byId('pe-titre').value = p.titre || '';
    byId('pe-frame').value = p.avatar_frame || 'auto';
    byId('pe-pstyle').value = p.pseudo_style || 'default';
    byId('pe-theme').value = p.profile_theme || 'none';
    byId('pe-sstyle').value = p.showcase_style || 'projecteur';
    byId('pe-priv-p').value = p.privacy_profile || 'public';
    byId('pe-priv-c').value = p.privacy_collection || 'public';
    byId('pe-err').textContent = '';
    dlg.showModal();
  }

  async function openShowcaseModal() {
    const dlg = byId('p-showcase-dlg');
    const grid = byId('ps-grid');
    grid.textContent = 'Chargement de ta collection…';
    const selected = new Set((currentData.showcase || []).map((c) => c.id));
    dlg.showModal();
    try {
      const res = await api('collection', { params: { page: 1, sort: 'rarete_desc' } });
      grid.replaceChildren();
      res.items.forEach((g) => {
        const b = el('button', 'p-pick' + (selected.has(g.id) ? ' selected' : ''));
        b.type = 'button';
        b.append(el('strong', '', g.titre), el('div', 'meta', RARETES[g.rarete] || g.rarete));
        b.addEventListener('click', () => {
          if (selected.has(g.id)) {
            selected.delete(g.id);
            b.classList.remove('selected');
          } else if (selected.size < 7) {
            selected.add(g.id);
            b.classList.add('selected');
          }
          byId('ps-count').textContent = `${selected.size} / 7 sélectionnées`;
        });
        grid.append(b);
      });
      byId('ps-count').textContent = `${selected.size} / 7 sélectionnées`;
      byId('ps-save').onclick = async () => {
        await call('showcase', 'POST', { ids: Array.from(selected) });
        dlg.close();
        loadProfile('');
      };
    } catch (err) {
      grid.textContent = err.message;
    }
  }

  byId('pe-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    byId('pe-err').textContent = '';
    try {
      await call('save', 'POST', {
        bio: byId('pe-bio').value,
        avatar_url: byId('pe-avatar').value,
        titre: byId('pe-titre').value,
        avatar_frame: byId('pe-frame').value,
        pseudo_style: byId('pe-pstyle').value,
        profile_theme: byId('pe-theme').value,
        showcase_style: byId('pe-sstyle').value,
        privacy_profile: byId('pe-priv-p').value,
        privacy_collection: byId('pe-priv-c').value
      });
      byId('p-edit').close();
      loadProfile('');
    } catch (err) {
      byId('pe-err').textContent = err.message;
    }
  });

  byId('pe-cancel').addEventListener('click', () => byId('p-edit').close());
  byId('ps-cancel').addEventListener('click', () => byId('p-showcase-dlg').close());
  byId('tab-profile').addEventListener('click', () => showProfile(''));
  ['tab-booster', 'tab-succes', 'tab-admin'].forEach((id) => {
    const n = byId(id);
    if (n) n.addEventListener('click', hideProfile);
  });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', hideProfile));

  const urlPseudo = new URLSearchParams(window.location.search).get('profil');
  if (urlPseudo) {
    setTimeout(() => showProfile(urlPseudo), 300);
  }
})();
