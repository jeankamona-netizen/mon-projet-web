// =====================
// CONFIG — BASE_URL définie globalement par config.js (chargé avant ce fichier)
// =====================
// CONNEXION ADMINISTRATEUR — via backend (plus d'identifiants dans le frontend)
// =====================
async function connexionAdmin() {
  const user     = document.getElementById('admin-user')?.value.trim();
  const password = document.getElementById('admin-pass')?.value.trim();
  const erreurBox = document.getElementById('admin-erreur');

  if (!user || !password) {
    erreurBox.textContent = '⚠️ Veuillez remplir tous les champs.';
    erreurBox.style.display = 'block';
    return;
  }

  try {
    const reponse = await fetch(`${BASE_URL}/api/auth/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, password })
    });

    const donnees = await reponse.json();

    if (!reponse.ok) {
      erreurBox.textContent = '❌ ' + donnees.erreur;
      erreurBox.style.display = 'block';
      return;
    }

    // Stocker le token de session
    sessionStorage.setItem('admin_token', donnees.token);
    window.location.href = 'admin-dashboard.html';

  } catch (erreur) {
    erreurBox.textContent = '⚠️ Impossible de contacter le serveur.';
    erreurBox.style.display = 'block';
    console.error(erreur);
  }
}

function toggleAdminPassword() {
  const input = document.getElementById('admin-pass');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

// =====================
// VÉRIFICATION SESSION ADMIN
// =====================
function verifierSessionAdmin() {
  const token = sessionStorage.getItem('admin_token');
  if (!token && document.getElementById('cpt-etudiants')) {
    window.location.href = 'admin.html';
  }
}

// =====================
// APPEL API AUTHENTIFIÉ — ajoute le token JWT admin, gère l'expiration de session
// =====================
async function fetchAdmin(url, options = {}) {
  const token = sessionStorage.getItem('admin_token');
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const reponse = await fetch(url, { ...options, headers });
  if (reponse.status === 401) {
    sessionStorage.removeItem('admin_token');
    afficherToast('⚠️ Session expirée, veuillez vous reconnecter.', 'erreur');
    window.location.href = 'admin.html';
    throw new Error('Session expirée.');
  }
  return reponse;
}

// =====================
// FILIÈRES PAR FACULTÉ
// =====================
const filiereParFaculte = {
  'Faculté de Théologie':                    ['Missiologie','Théologie Pratique','Théologie Systématique','Théologie Biblique AT & NT'],
  'Sciences Informatiques':                  ['Gestion Informatique','Réseau & Télécom','Génie Logicielle','Design'],
  'Sciences Économiques':                    ['Gestion des Ressources Humaines','Finances, Banque & Comptabilité','Gestion Marketing','Entrepreneuriat','Douane'],
  "Sciences de l'Éducation & Psychologie":  ["Sciences de l'Éducation",'Psychologie']
};

// =====================
// ANNÉES ACADÉMIQUES — alimentées depuis la base (table annee_academique)
// pour ne plus avoir à modifier le code chaque année.
// Chaque select : id + libellé de l'option « toutes » ('' = pas d'option toutes).
// =====================
const SELECTS_ANNEES = [
  { id: 'filtre-annee',        all: 'Toutes les années' },
  { id: 'filtre-annee-prog',   all: '— Année —' },
  { id: 'filtre-note-annee',   all: '' },
  { id: 'notes-filtre-annee',  all: 'Toutes les années' },
  { id: 'filtre-attr-annee',   all: 'Toutes les années' },
  { id: 'horaire-annee',       all: '' },
  { id: 'prog-annee',          all: '' },
  { id: 'inscrit-annee',       all: '' },
  { id: 'reins-annee-promo',   all: '' },
  { id: 'reins-annee-nouveau', all: '' },
  { id: 'filtre-inscrits-annee', all: 'Toutes les années' },
];

async function chargerAnnees() {
  try {
    const r = await fetch(`${BASE_URL}/api/annees`);
    if (!r.ok) return;
    const annees = await r.json();
    if (!Array.isArray(annees) || annees.length === 0) return;
    const courante = annees.find(a => a.est_courante)?.libelle;
    SELECTS_ANNEES.forEach(cfg => {
      const sel = document.getElementById(cfg.id);
      if (!sel) return;
      const ancienne = sel.value;
      sel.innerHTML = (cfg.all !== '' ? `<option value="">${cfg.all}</option>` : '') +
        annees.map(a => `<option value="${a.libelle}">${a.libelle}</option>`).join('');
      if (ancienne && annees.some(a => a.libelle === ancienne)) sel.value = ancienne;
      else if (cfg.all === '' && courante) sel.value = courante;
    });
  } catch { /* en cas d'échec, on garde les options statiques du HTML */ }
}

// =====================
// NAVIGATION ENTRE SECTIONS
// =====================
function afficherSection(id, lien) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item, .nav-sous-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item-groupe.open').forEach(g => g.classList.remove('open'));
  document.getElementById(id)?.classList.add('active');
  lien?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (id === 'admin-accueil')         chargerStats();
  if (id === 'admin-notes')           { chargerNotes(); chargerResumeBulletins(); }
  if (id === 'admin-horaires')        chargerHoraires();
  if (id === 'admin-programme')       chargerProgramme();
  if (id === 'admin-preinscriptions') chargerPreinscriptions();
  if (id === 'admin-inscrits')        chargerInscrits();
  if (id === 'admin-attributions')    chargerAttributions();
  if (id === 'admin-audit')           chargerAuditLog();
  if (id === 'admin-agents')          chargerAgents();
}

// Sous-menu déroulant « Gérer les Inscrits » : Inscriptions / Réinscriptions /
// Préinscriptions. On réutilise les 3 sections existantes ; l'item de menu
// latéral « Gérer les Inscrits » reste actif et ouvert quel que soit l'onglet.
// Utilisé par les cartes-statistiques cliquables de la Vue d'ensemble pour
// rejoindre une section dont le lien de menu latéral est un <a> simple.
function allerVersSection(id) {
  const lien = document.querySelector(`.nav-item[onclick*="'${id}'"]`);
  afficherSection(id, lien);
}

function toggleSousMenu(event, lien) {
  event.preventDefault();
  const groupe = lien.closest('.nav-item-groupe');
  const etaitOuvert = groupe?.classList.contains('open');
  document.querySelectorAll('.nav-item-groupe.open').forEach(g => g.classList.remove('open'));
  if (!etaitOuvert) groupe?.classList.add('open');
}

function afficherOngletInscrits(id) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item, .nav-sous-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.getElementById('nav-inscrits-groupe')?.classList.add('active');
  document.getElementById('nav-inscrits-groupe')?.closest('.nav-item-groupe')?.classList.add('open');
  document.querySelector(`.nav-sous-item[data-cible="${id}"]`)?.classList.add('active');
  if (id === 'admin-inscrits')        chargerInscrits();
  if (id === 'admin-preinscriptions') chargerPreinscriptions();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Sous-menu déroulant « Annonces & événements » : Annonces / Communiqués.
// Les deux onglets vivent dans la même section admin-annonces ; seul le
// contenu interne (.notes-onglet-contenu) bascule.
function afficherOngletAnnonces(id) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item, .nav-sous-item').forEach(n => n.classList.remove('active'));
  document.getElementById('admin-annonces')?.classList.add('active');
  document.getElementById('nav-annonces-groupe')?.classList.add('active');
  document.getElementById('nav-annonces-groupe')?.closest('.nav-item-groupe')?.classList.add('open');
  document.querySelector(`.nav-sous-item[data-cible="${id}"]`)?.classList.add('active');

  document.querySelectorAll('#admin-annonces .notes-onglet-contenu').forEach(el => el.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');

  if (id === 'annonces-onglet-public')      chargerAnnonces();
  if (id === 'annonces-onglet-communiques') chargerCommuniques();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================
// UTILITAIRES DATE
// =====================
function formaterDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
}

// =====================
// VUE D'ENSEMBLE — statistiques MySQL
// =====================
async function chargerStats() {
  try {
    const reponse = await fetchAdmin(`${BASE_URL}/api/stats`);
    if (!reponse.ok) throw new Error('Erreur serveur');
    const stats = await reponse.json();
    const ids = { 'cpt-etudiants': stats.etudiants, 'cpt-preinscriptions': stats.preinscriptions, 'cpt-cours': stats.cours, 'cpt-annonces': stats.annonces };
    Object.entries(ids).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
  } catch (erreur) {
    console.error('chargerStats:', erreur);
    ['cpt-etudiants','cpt-preinscriptions','cpt-cours','cpt-annonces'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
  }
  chargerGraphiqueFacultes();
  chargerStatistiquesAvancees();
}

// =====================
// GRAPHIQUE — répartition des étudiants par faculté ET filière
// =====================
let graphiqueFacultes = null;

async function chargerGraphiqueFacultes() {
  const canvas = document.getElementById('graphique-facultes');
  if (!canvas || typeof Chart === 'undefined') return;

  try {
    const r = await fetchAdmin(`${BASE_URL}/api/etudiants`);
    const etudiants = await r.json();

    // Regroupe par (faculté → filière) selon les inscriptions réelles.
    const parFacFil = {};
    etudiants.forEach(e => {
      const fac = e.faculte || 'Non renseignée';
      const fil = e.promotion || 'Sans filière';
      (parFacFil[fac] = parFacFil[fac] || {})[fil] = (parFacFil[fac][fil] || 0) + 1;
    });

    const facultes = Object.keys(parFacFil);
    // Seules les filières où des étudiants sont réellement inscrits apparaissent.
    const filieres = [...new Set(etudiants.map(e => e.promotion || 'Sans filière'))];

    const palette = ['#1a3a6b','#f0c020','#2d7a2d','#cc2200','#2D6FE0','#8a6d00','#7a2d7a',
                     '#00897b','#e07b00','#5c6bc0','#c2185b','#558b2f','#00838f','#6d4c41','#455a64'];

    // Un dataset par filière → segments empilés dans la colonne de sa faculté.
    const datasets = filieres.map((fil, i) => ({
      label: fil,
      data: facultes.map(fac => parFacFil[fac][fil] || 0),
      backgroundColor: palette[i % palette.length],
      borderRadius: 4,
      stack: 'etudiants',
    }));

    // Totaux par faculté (affichés en chiffres au-dessus de chaque colonne).
    const totauxFac = facultes.map(fac => Object.values(parFacFil[fac]).reduce((s, n) => s + n, 0));
    const totalGeneral = totauxFac.reduce((s, n) => s + n, 0);

    // Plugin inline : écrit le total de chaque faculté au sommet de sa barre,
    // et le nombre de chaque segment de filière (si assez de place).
    const pluginChiffres = {
      id: 'chiffresFacultes',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.textAlign = 'center';
        // Nombre par segment de filière.
        ctx.font = '600 10px Segoe UI, Arial';
        chart.data.datasets.forEach((ds, di) => {
          const meta = chart.getDatasetMeta(di);
          meta.data.forEach((bar, i) => {
            const v = ds.data[i];
            if (!v) return;
            const h = Math.abs(bar.base - bar.y);
            if (h < 14) return; // segment trop fin pour un chiffre lisible
            ctx.fillStyle = '#fff';
            ctx.fillText(v, bar.x, (bar.y + bar.base) / 2 + 3);
          });
        });
        // Total de la faculté au-dessus de la colonne.
        ctx.font = '800 12px Segoe UI, Arial';
        ctx.fillStyle = '#1a3a6b';
        const meta0 = chart.getDatasetMeta(0);
        meta0.data.forEach((bar, i) => {
          const yTop = chart.scales.y.getPixelForValue(totauxFac[i]);
          ctx.fillText(totauxFac[i], bar.x, yTop - 5);
        });
        ctx.restore();
      }
    };

    if (graphiqueFacultes) graphiqueFacultes.destroy();
    graphiqueFacultes = new Chart(canvas, {
      type: 'bar',
      data: { labels: facultes, datasets },
      options: {
        responsive: true,
        layout: { padding: { top: 18 } },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 }, padding: 8 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label} : ${ctx.parsed.y} étudiant(s)` } }
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
        }
      },
      plugins: [pluginChiffres]
    });

    // Tableau de statistiques (chiffres) sous le graphique.
    afficherStatsFacultes(parFacFil, facultes, totauxFac, totalGeneral, filieres.length);
  } catch (erreur) {
    console.error('chargerGraphiqueFacultes:', erreur);
  }
}

// Tableau récapitulatif : nombre d'étudiants par filière au sein de chaque
// faculté, sous-total par faculté, et total général.
function afficherStatsFacultes(parFacFil, facultes, totauxFac, totalGeneral, nbFilieres) {
  const zone = document.getElementById('stats-facultes');
  if (!zone) return;
  if (!totalGeneral) { zone.innerHTML = '<p class="admin-vide" style="margin-top:12px">Aucun étudiant inscrit.</p>'; return; }

  const blocs = facultes.map((fac, i) => {
    const filieres = Object.entries(parFacFil[fac]).sort((a, b) => b[1] - a[1]);
    const lignes = filieres.map(([fil, n]) => {
      const pct = Math.round((n / totalGeneral) * 100);
      return `<tr><td style="padding-left:22px">${fil}</td><td style="text-align:right">${n}</td><td style="text-align:right;color:#888">${pct}%</td></tr>`;
    }).join('');
    return `
      <tr style="background:var(--gris,#f2f4f7)">
        <td><strong>${fac}</strong></td>
        <td style="text-align:right"><strong>${totauxFac[i]}</strong></td>
        <td style="text-align:right;color:#888">${Math.round((totauxFac[i] / totalGeneral) * 100)}%</td>
      </tr>${lignes}`;
  }).join('');

  zone.innerHTML = `
    <p class="dash-sous-titre" style="margin:16px 0 8px">
      ${totalGeneral} étudiant(s) inscrits · ${facultes.length} faculté(s) · ${nbFilieres} filière(s)
    </p>
    <table class="dash-table">
      <thead><tr><th>Faculté / Filière</th><th style="text-align:right">Étudiants</th><th style="text-align:right">%</th></tr></thead>
      <tbody>
        ${blocs}
        <tr style="border-top:2px solid var(--bleu)"><td><strong>Total général</strong></td><td style="text-align:right"><strong>${totalGeneral}</strong></td><td style="text-align:right">100%</td></tr>
      </tbody>
    </table>`;
}

let graphiqueEvolution = null;
let graphiqueReussite = null;

async function chargerStatistiquesAvancees() {
  const canvasEvolution = document.getElementById('graphique-evolution');
  const canvasReussite  = document.getElementById('graphique-reussite');
  if ((!canvasEvolution && !canvasReussite) || typeof Chart === 'undefined') return;

  try {
    const r = await fetchAdmin(`${BASE_URL}/api/stats/avancees`);
    const { evolutionPreinscriptions, tauxReussiteParFaculte } = await r.json();

    if (canvasEvolution) {
      if (graphiqueEvolution) graphiqueEvolution.destroy();
      graphiqueEvolution = new Chart(canvasEvolution, {
        type: 'line',
        data: {
          labels: evolutionPreinscriptions.map(e => e.mois),
          datasets: [{
            label: 'Pré-inscriptions',
            data: evolutionPreinscriptions.map(e => e.total),
            borderColor: '#1a3a6b',
            backgroundColor: 'rgba(26,58,107,0.1)',
            tension: 0.3,
            fill: true,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    if (canvasReussite) {
      if (graphiqueReussite) graphiqueReussite.destroy();
      graphiqueReussite = new Chart(canvasReussite, {
        type: 'bar',
        data: {
          labels: tauxReussiteParFaculte.map(f => f.faculte),
          datasets: [{
            label: 'Taux de réussite (%)',
            data: tauxReussiteParFaculte.map(f => f.tauxReussite),
            backgroundColor: '#2d7a2d',
            borderRadius: 6,
            maxBarThickness: 56,
          }]
        },
        options: {
          responsive: true,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, max: 100 } }
        }
      });
    }
  } catch (erreur) {
    console.error('chargerStatistiquesAvancees:', erreur);
  }
}

// =====================
// GESTION DES NOTES
// =====================
let notesAdmin = [];

function basculerOngletNotes(idOnglet, btn) {
  document.querySelectorAll('.notes-onglet-contenu').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.notes-onglet-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(idOnglet)?.classList.add('active');
  btn?.classList.add('active');
}

function chargerFilieresPourFiltreNotes() {
  const faculte = document.getElementById('notes-filtre-faculte')?.value || '';
  const sel = document.getElementById('notes-filtre-filiere');
  if (!sel) return;
  const filieres = filiereParFaculte[faculte] || [];
  sel.innerHTML = '<option value="">Toutes les filières</option>' + filieres.map(f => `<option value="${f}">${f}</option>`).join('');
}

async function chargerNotes() {
  const tbody = document.getElementById('admin-notes-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">Chargement...</td></tr>`;
  try {
    const faculte = document.getElementById('notes-filtre-faculte')?.value || '';
    const filiere = document.getElementById('notes-filtre-filiere')?.value || '';
    const annee   = document.getElementById('notes-filtre-annee')?.value   || '';
    const params = new URLSearchParams();
    if (faculte) params.append('faculte', faculte);
    if (filiere) params.append('filiere', filiere);
    if (annee)   params.append('annee', annee);
    const reponse = await fetchAdmin(`${BASE_URL}/api/notes?${params}`);
    if (!reponse.ok) throw new Error('Erreur serveur');
    notesAdmin = await reponse.json();
    afficherTableauNotes();
  } catch (erreur) {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">⚠️ Impossible de charger les notes. Vérifiez le backend.</td></tr>`;
  }
}

function afficherTableauNotes(liste = notesAdmin) {
  const tbody = document.getElementById('admin-notes-body');
  if (!tbody) return;
  if (liste.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">Aucune note enregistrée.</td></tr>`; return; }
  tbody.innerHTML = liste.map(n => `
    <tr>
      <td>${n.nom_etudiant} ${n.prenom_etudiant}<br><span style="font-size:11px;color:#999">${n.etudiant_id}</span></td>
      <td>${n.matiere}</td>
      <td>${n.note_cc ?? '—'}</td>
      <td>${n.note_examen ?? '—'}</td>
      <td>${n.note !== null && n.note !== undefined ? n.note+'/20' : '—'}</td>
      <td>${n.session === 'S1' ? 'Semestre 1' : 'Semestre 2'}</td>
      <td>${n.note === null || n.note === undefined ? '<span class="badge attente">En attente</span>' : n.note >= 10 ? '<span class="badge reussi">Réussi</span>' : '<span class="badge echec">Échec</span>'}</td>
      <td class="admin-actions-cell">
        <button class="btn-icone" onclick="modifierNote(${n.id})" aria-label="Modifier">${icone('crayon')}</button>
        <button class="btn-icone danger" onclick="supprimerNote(${n.id})" aria-label="Supprimer">${icone('corbeille')}</button>
      </td>
    </tr>`).join('');
}

let resumeBulletinsAdmin = [];

async function chargerResumeBulletins() {
  const tbody = document.getElementById('bulletins-notes-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">Chargement...</td></tr>`;
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/notes/bulletins/resume`);
    if (!r.ok) throw new Error('Erreur serveur');
    resumeBulletinsAdmin = await r.json();
    afficherTableauBulletins();
  } catch {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">⚠️ Impossible de charger le résumé des bulletins.</td></tr>`;
  }
}

function afficherTableauBulletins(liste = resumeBulletinsAdmin) {
  const tbody = document.getElementById('bulletins-notes-body');
  if (!tbody) return;
  const selectTout = document.getElementById('notes-select-tout');
  if (selectTout) selectTout.checked = false;
  if (liste.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">Aucun étudiant noté.</td></tr>`; return; }
  tbody.innerHTML = liste.map(e => `
    <tr>
      <td><input type="checkbox" class="note-select" data-etudiant-id="${e.etudiant_id}"></td>
      <td>${e.nom} ${e.postnom||''} ${e.prenom}<br><span style="font-size:11px;color:#999">${e.etudiant_id}</span></td>
      <td>${e.filiere||'—'}</td>
      <td>${e.faculte||'—'}</td>
      <td>${e.promotion||'—'}</td>
      <td>${e.moyenne_generale !== null ? e.moyenne_generale.toFixed(2)+'/20' : '—'}</td>
      <td>${e.credits_valides} / ${e.credits_total}</td>
      <td>${e.mention}</td>
    </tr>`).join('');
}

function basculerSelectionToutesNotes(caseTout) {
  document.querySelectorAll('#bulletins-notes-body .note-select').forEach(c => { c.checked = caseTout.checked; });
}

// Imprime (télécharge en PDF) le bulletin de chaque étudiant coché — un seul
// bulletin par étudiant même si plusieurs de ses notes sont sélectionnées.
async function imprimerBulletinsSelectionnes() {
  const etudiantIds = [...new Set(
    Array.from(document.querySelectorAll('#bulletins-notes-body .note-select:checked')).map(c => c.dataset.etudiantId)
  )];
  if (etudiantIds.length === 0) { afficherToast('⚠️ Sélectionnez au moins un étudiant.', 'erreur'); return; }
  afficherToast(`⏳ Génération de ${etudiantIds.length} bulletin(s)...`);
  let reussis = 0;
  for (const etudiantId of etudiantIds) {
    const ok = await telechargerBulletin(etudiantId);
    if (ok) reussis++;
    // Petite pause entre chaque téléchargement pour éviter que le navigateur ne bloque les téléchargements multiples.
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  afficherToast(reussis === etudiantIds.length ? `✅ ${reussis} bulletin(s) téléchargé(s) !` : `⚠️ ${reussis}/${etudiantIds.length} bulletin(s) téléchargé(s).`);
}

function filtrerEtudiantsParFaculte() {
  const faculte = document.getElementById('filtre-note-faculte')?.value || '';
  const sel = document.getElementById('filtre-note-promotion');
  if (!sel) return;
  const filieres = filiereParFaculte[faculte] || [];
  sel.innerHTML = '<option value="">Toutes les filières</option>' + filieres.map(f => `<option value="${f}">${f}</option>`).join('');
  filtrerEtudiants();
}

let debounceTimer;
async function filtrerEtudiants() {
  const annee     = document.getElementById('filtre-note-annee')?.value.trim()     || '';
  const niveau    = document.getElementById('filtre-note-niveau')?.value.trim()    || '';
  const faculte   = document.getElementById('filtre-note-faculte')?.value.trim()   || '';
  const promotion = document.getElementById('filtre-note-promotion')?.value.trim() || '';
  const nom       = document.getElementById('filtre-note-nom')?.value.trim()       || '';
  const select    = document.getElementById('note-etudiant');
  if (!select) return;
  select.innerHTML = '<option value="">Chargement...</option>';

  const params = new URLSearchParams();
  if (annee) params.append('annee', annee);
  if (niveau) params.append('niveau', niveau);
  if (faculte) params.append('faculte', faculte);
  if (promotion) params.append('promotion', promotion);
  if (nom) params.append('nom', nom);

  try {
    const r = await fetchAdmin(`${BASE_URL}/api/etudiants?${params}`);
    const etudiants = await r.json();
    if (!Array.isArray(etudiants) || etudiants.length === 0) {
      select.innerHTML = '<option value="">Aucun étudiant trouvé</option>';
      const sm = document.getElementById('note-matiere');
      if (sm) sm.innerHTML = '<option value="">— Sélectionnez un étudiant —</option>';
      return;
    }
    select.innerHTML = '<option value="">— Choisir un étudiant —</option>' +
      etudiants.map(e => `<option value="${e.id}" data-faculte="${e.faculte||''}" data-niveau="${e.niveau||''}" data-filiere="${e.promotion||''}" data-annee="${e.annee_academique||''}">${e.nom} ${e.postnom||''} ${e.prenom} (${[e.niveau,e.promotion].filter(Boolean).join(' ')})</option>`).join('');
    // La liste des matières suit les mêmes filtres (faculté/année/niveau/filière).
    await chargerMatieresPourNote();
  } catch (err) {
    select.innerHTML = '<option value="">⚠️ Erreur</option>';
    console.error(err);
  }
}

// Charge les matières selon les filtres du modal : faculté + année + niveau
// (+ filière si choisie), pour éviter une liste de tous les cours.
async function chargerMatieresPourNote() {
  const sel = document.getElementById('note-matiere');
  if (!sel) return;
  const faculte = document.getElementById('filtre-note-faculte')?.value || '';
  const niveau  = document.getElementById('filtre-note-niveau')?.value  || '';
  const annee   = document.getElementById('filtre-note-annee')?.value   || '';
  const filiere = document.getElementById('filtre-note-promotion')?.value || '';
  const params = new URLSearchParams();
  if (faculte) params.append('faculte', faculte);
  if (niveau)  params.append('niveau', niveau);
  if (annee)   params.append('annee', annee);
  if (filiere) params.append('filiere', filiere);
  sel.innerHTML = '<option value="">Chargement...</option>';
  try {
    const r = await fetch(`${BASE_URL}/api/programme?${params}`);
    const cours = await r.json();
    sel.innerHTML = (!Array.isArray(cours) || cours.length === 0)
      ? '<option value="">Aucun cours pour ces critères</option>'
      : '<option value="">— Choisir une matière —</option>' + cours.map(c => `<option value="${c.nom}" data-semestre="${c.semestre}">${c.code} — ${c.nom} (${c.promotion})</option>`).join('');
    majSemestreNote();
  } catch { sel.innerHTML = '<option value="">⚠️ Erreur</option>'; }
}

// Quand un étudiant est choisi : matières exactement de sa faculté/niveau/filière
// pour l'année sélectionnée (le plus précis possible).
async function chargerCoursEtudiant() {
  const select = document.getElementById('note-etudiant');
  const sel = document.getElementById('note-matiere');
  if (!select || !sel) return;
  const option = select.options[select.selectedIndex];
  if (!option?.value) return;
  const faculte = option.dataset.faculte || '';
  const niveau  = option.dataset.niveau  || '';
  const filiere = option.dataset.filiere || '';
  const annee   = document.getElementById('filtre-note-annee')?.value || option.dataset.annee || '';
  const params = new URLSearchParams();
  if (faculte) params.append('faculte', faculte);
  if (niveau)  params.append('niveau', niveau);
  if (annee)   params.append('annee', annee);
  if (filiere) params.append('filiere', filiere);
  sel.innerHTML = '<option value="">Chargement...</option>';
  try {
    const r = await fetch(`${BASE_URL}/api/programme?${params}`);
    const cours = await r.json();
    sel.innerHTML = (!Array.isArray(cours) || cours.length === 0)
      ? '<option value="">Aucun cours pour cet étudiant</option>'
      : '<option value="">— Choisir une matière —</option>' + cours.map(c => `<option value="${c.nom}" data-semestre="${c.semestre}">${c.code} — ${c.nom}</option>`).join('');
    majSemestreNote();
  } catch { sel.innerHTML = '<option value="">⚠️ Erreur</option>'; }
}

// Affiche le semestre (S1/S2) du cours choisi : la note en hérite automatiquement.
function majSemestreNote() {
  const sel = document.getElementById('note-matiere');
  const info = document.getElementById('note-semestre-info');
  if (!sel || !info) return;
  const opt = sel.options[sel.selectedIndex];
  const sem = opt?.dataset?.semestre || '';
  info.value = sem === 'S1' ? 'Semestre 1' : sem === 'S2' ? 'Semestre 2' : '—';
}

function previsualiserMoyenneNote() {
  const cc = parseFloat(document.getElementById('note-cc')?.value);
  const examen = parseFloat(document.getElementById('note-examen')?.value);
  const apercu = document.getElementById('note-moyenne-apercu');
  if (!apercu) return;
  apercu.value = (isNaN(cc) || isNaN(examen)) ? '' : (Math.round(((cc + examen) / 2) * 100) / 100);
}

async function ouvrirModalNote() {
  document.getElementById('modal-note-titre').textContent = 'Ajouter une note';
  document.getElementById('note-id-edit').value = '';
  document.getElementById('note-edit-contexte').style.display = 'none';
  document.getElementById('note-add-selection').style.display = '';
  document.getElementById('note-cc').value      = '';
  document.getElementById('note-examen').value  = '';
  document.getElementById('note-moyenne-apercu').value = '';
  document.getElementById('note-semestre-info').value = '—';
  ['filtre-note-annee','filtre-note-niveau','filtre-note-faculte','filtre-note-nom'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const sf = document.getElementById('filtre-note-promotion');
  if (sf) sf.innerHTML = '<option value="">Toutes les filières</option>';
  const se = document.getElementById('note-etudiant');
  if (se) se.innerHTML = '<option value="">— Choisir un étudiant —</option>';
  await filtrerEtudiants();
  const champNom = document.getElementById('filtre-note-nom');
  if (champNom) champNom.oninput = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(filtrerEtudiants, 300); };
  document.getElementById('modal-note')?.classList.add('active');
}

function modifierNote(id) {
  const note = notesAdmin.find(n => n.id === id);
  if (!note) return;
  document.getElementById('modal-note-titre').textContent = 'Modifier la note';
  document.getElementById('note-id-edit').value  = note.id;

  // Mode modification : on masque les sélecteurs et on montre le contexte figé.
  document.getElementById('note-add-selection').style.display = 'none';
  document.getElementById('note-edit-contexte').style.display = 'block';
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('note-ctx-etudiant', `${note.nom_etudiant} ${note.postnom_etudiant||''} ${note.prenom_etudiant} (${note.etudiant_id})`.replace(/\s+/g,' '));
  set('note-ctx-matiere', `${note.code ? note.code+' — ' : ''}${note.matiere}`);
  set('note-ctx-faculte', note.faculte || '—');
  set('note-ctx-filiere', note.filiere || '—');
  set('note-ctx-niveau', note.niveau || '—');
  set('note-ctx-annee', note.annee_academique || '—');

  // Champs éditables : CC, examen, moyenne (auto), semestre (figé par le cours).
  document.getElementById('note-cc').value       = note.note_cc ?? '';
  document.getElementById('note-examen').value   = note.note_examen ?? '';
  document.getElementById('note-semestre-info').value = note.session === 'S1' ? 'Semestre 1' : note.session === 'S2' ? 'Semestre 2' : '—';
  previsualiserMoyenneNote();
  document.getElementById('modal-note')?.classList.add('active');
}

function fermerModalNote() { document.getElementById('modal-note')?.classList.remove('active'); }

async function trouverCoursIdParNom(nomCours) {
  const r = await fetch(`${BASE_URL}/api/programme`);
  const cours = await r.json();
  const t = cours.find(c => c.nom === nomCours);
  return t ? t.id : null;
}

async function sauvegarderNote() {
  const idEdit      = document.getElementById('note-id-edit').value;
  const etudiant_id = document.getElementById('note-etudiant')?.value;
  const matiereNom  = document.getElementById('note-matiere')?.value;
  const ccValeur     = document.getElementById('note-cc').value;
  const examenValeur = document.getElementById('note-examen').value;
  const note_cc     = ccValeur     === '' ? undefined : parseFloat(ccValeur);
  const note_examen = examenValeur === '' ? undefined : parseFloat(examenValeur);
  // Le semestre est déterminé côté serveur d'après le cours choisi.
  // En modification, l'année provient du contexte figé de la note.
  const annee_academique = idEdit
    ? (document.getElementById('note-ctx-annee')?.value || '')
    : (document.getElementById('filtre-note-annee')?.value || '2025-2026');

  if (note_cc === undefined && note_examen === undefined) { afficherToast('⚠️ Renseignez au moins le contrôle continu ou l\'examen.', 'erreur'); return; }
  if (note_cc     !== undefined && (isNaN(note_cc)     || note_cc     < 0 || note_cc     > 20)) { afficherToast('⚠️ Contrôle continu entre 0 et 20.', 'erreur'); return; }
  if (note_examen !== undefined && (isNaN(note_examen) || note_examen < 0 || note_examen > 20)) { afficherToast('⚠️ Examen entre 0 et 20.', 'erreur'); return; }
  if (!idEdit && !etudiant_id) { afficherToast('⚠️ Sélectionnez un étudiant.', 'erreur'); return; }
  if (!idEdit && !matiereNom) { afficherToast('⚠️ Sélectionnez une matière.', 'erreur'); return; }

  const corps = { annee_academique };
  if (note_cc     !== undefined) corps.note_cc     = note_cc;
  if (note_examen !== undefined) corps.note_examen = note_examen;

  try {
    let reponse;
    if (idEdit) {
      reponse = await fetchAdmin(`${BASE_URL}/api/notes/${idEdit}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(corps) });
    } else {
      const cours_id = await trouverCoursIdParNom(matiereNom);
      if (!cours_id) { afficherToast('⚠️ Cours introuvable dans le programme.', 'erreur'); return; }
      corps.etudiant_id = etudiant_id;
      corps.cours_id = cours_id;
      reponse = await fetchAdmin(`${BASE_URL}/api/notes`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(corps) });
    }
    const d = await reponse.json();
    if (!reponse.ok) { afficherToast('❌ ' + d.erreur, 'erreur'); return; }
    const suffixe = d.note !== null && d.note !== undefined ? ` Moyenne : ${d.note}/20` : ' (en attente de l\'autre note pour calculer la moyenne)';
    afficherToast((idEdit ? '✅ Note modifiée !' : '✅ Note ajoutée !') + suffixe);
    fermerModalNote(); chargerNotes(); chargerStats();
  } catch (err) { afficherToast('⚠️ Impossible de contacter le serveur.', 'erreur'); }
}

async function supprimerNote(id) {
  if (!await confirmerAction('Supprimer cette note ? Cette action est irréversible.', { titre: 'Supprimer la note', texteConfirmer: 'Supprimer' })) return;
  try { await fetchAdmin(`${BASE_URL}/api/notes/${id}`, {method:'DELETE'}); afficherToast('🗑️ Note supprimée.'); chargerNotes(); chargerStats(); }
  catch (err) { console.error(err); }
}

// =====================
// GESTION DES HORAIRES
// =====================
let horairesAdmin = [];

async function chargerHoraires() {
  const tbody = document.getElementById('admin-horaires-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="10" class="admin-vide">Chargement...</td></tr>`;
  try {
    const annee  = document.getElementById('filtre-annee')?.value  || '';
    const niveau = document.getElementById('filtre-niveau')?.value || '';
    const jour   = document.getElementById('filtre-jour')?.value   || '';
    const params = new URLSearchParams();
    if (annee) params.append('annee', annee);
    if (niveau) params.append('niveau', niveau);
    if (jour) params.append('jour', jour);
    const r = await fetchAdmin(`${BASE_URL}/api/horaires?${params}`);
    if (!r.ok) throw new Error();
    horairesAdmin = await r.json();
    afficherTableauHoraires();
  } catch { tbody.innerHTML = `<tr><td colspan="10" class="admin-vide">⚠️ Impossible de charger les horaires.</td></tr>`; }
}

function afficherTableauHoraires(liste = horairesAdmin) {
  const tbody = document.getElementById('admin-horaires-body');
  if (!tbody) return;
  if (liste.length === 0) { tbody.innerHTML = `<tr><td colspan="10" class="admin-vide">Aucun cours programmé.</td></tr>`; return; }
  tbody.innerHTML = liste.map(h => `
    <tr>
      <td><strong>${h.promotion}</strong></td>
      <td>${h.nb_etudiants ?? 0}</td>
      <td>${h.jour}</td>
      <td>${formaterDate(h.date_debut)}</td>
      <td>${h.heure_debut.slice(0,5)}<br>${h.heure_fin.slice(0,5)}</td>
      <td>${h.cours}</td>
      <td>${h.professeur ? (h.professeur_prenom ? h.professeur_prenom+' ' : '')+h.professeur : '—'}</td>
      <td>${h.salle}</td>
      <td>${h.annee_academique}</td>
      <td class="admin-actions-cell">
        <button class="btn-icone" onclick="modifierHoraire(${h.id})" aria-label="Modifier">${icone('crayon')}</button>
        <button class="btn-icone danger" onclick="supprimerHoraire(${h.id})" aria-label="Supprimer">${icone('corbeille')}</button>
      </td>
    </tr>`).join('');
}

async function remplirListeProfesseurs() {
  const sel = document.getElementById('horaire-prof');
  if (!sel) return;
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/professeurs`);
    const profs = await r.json();
    sel.innerHTML = '<option value="">-- Choisir un professeur --</option>' + profs.map(p => `<option value="${p.id}">${p.nom} ${p.prenom||''}${p.grade?' — '+p.grade:''}</option>`).join('');
  } catch (err) { console.error(err); }
}

let coursHoraireCache = [];

function chargerFilieresPourHoraire() {
  const faculte = document.getElementById('horaire-faculte')?.value || '';
  const sel = document.getElementById('horaire-filiere');
  if (!sel) return;
  const filieres = filiereParFaculte[faculte] || [];
  sel.innerHTML = '<option value="">— Toute la faculté (cours commun) —</option>' + filieres.map(f => `<option value="${f}">${f}</option>`).join('');
  rafraichirCoursHoraire();
}

async function rafraichirCoursHoraire() {
  const faculte  = document.getElementById('horaire-faculte')?.value  || '';
  const filiere  = document.getElementById('horaire-filiere')?.value  || '';
  const niveau   = document.getElementById('horaire-niveau')?.value   || '';
  const annee    = document.getElementById('horaire-annee')?.value    || '';
  const sel      = document.getElementById('horaire-cours');
  if (!sel) return;
  if (!faculte) { sel.innerHTML = '<option value="">— Choisir d\'abord une faculté —</option>'; return; }
  try {
    const params = new URLSearchParams({ faculte, niveau, annee });
    if (filiere) params.append('filiere', filiere);
    const r = await fetch(`${BASE_URL}/api/programme?${params}`);
    coursHoraireCache = await r.json();
    sel.innerHTML = coursHoraireCache.length === 0
      ? '<option value="">Aucun cours pour cette sélection</option>'
      : coursHoraireCache.map(c => `<option value="${c.id}">${c.code} — ${c.nom} (${c.promotion})</option>`).join('');
  } catch { sel.innerHTML = '<option value="">Erreur</option>'; }
}

const JOURS_SEMAINE = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

function synchroniserJourDepuisDate() {
  const dateVal = document.getElementById('horaire-date-debut').value;
  if (!dateVal) return;
  // new Date('YYYY-MM-DD') est interprété en UTC : on lit getUTCDay() pour éviter
  // un décalage de jour selon le fuseau horaire du navigateur.
  const jourSemaine = JOURS_SEMAINE[new Date(dateVal).getUTCDay()];
  const select = document.getElementById('horaire-jour');
  if (select && jourSemaine !== 'Dimanche' && jourSemaine !== 'Samedi') {
    select.value = jourSemaine;
  }
}

function autoSelectionnerProfesseurHoraire() {
  const coursId = document.getElementById('horaire-cours')?.value;
  const selectProf = document.getElementById('horaire-prof');
  if (!selectProf) return;
  const cours = coursHoraireCache.find(c => String(c.id) === String(coursId));
  selectProf.value = cours?.professeur_id || '';
}

async function ouvrirModalHoraire() {
  await remplirListeProfesseurs();
  document.getElementById('modal-horaire-titre').textContent = 'Ajouter un cours à l\'horaire';
  document.getElementById('horaire-id-edit').value = '';
  document.getElementById('horaire-faculte').selectedIndex = 0;
  document.getElementById('horaire-niveau').value = 'L1';
  document.getElementById('horaire-annee').value  = '2025-2026';
  document.getElementById('horaire-jour').value = '';
  document.getElementById('horaire-date-debut').value = '';
  document.getElementById('horaire-debut').value  = '07:30';
  document.getElementById('horaire-fin').value    = '09:30';
  document.getElementById('horaire-salle').value  = '';
  chargerFilieresPourHoraire();
  document.getElementById('modal-horaire')?.classList.add('active');
}

async function modifierHoraire(id) {
  const h = horairesAdmin.find(x => x.id === id);
  if (!h) return;
  await remplirListeProfesseurs();
  document.getElementById('modal-horaire-titre').textContent = 'Modifier le cours';
  document.getElementById('horaire-id-edit').value = h.id;
  document.getElementById('horaire-jour').value    = h.jour;
  document.getElementById('horaire-date-debut').value = h.date_debut ? h.date_debut.split('T')[0] : '';
  document.getElementById('horaire-debut').value   = h.heure_debut;
  document.getElementById('horaire-fin').value     = h.heure_fin;
  document.getElementById('horaire-prof').value    = '';
  document.getElementById('horaire-salle').value   = h.salle;
  document.getElementById('horaire-annee').value   = h.annee_academique;

  try {
    const r = await fetchAdmin(`${BASE_URL}/api/programme?annee=${h.annee_academique}`);
    const programme = await r.json();
    const coursActuel = programme.find(c => c.id === h.cours_id);
    if (coursActuel) {
      document.getElementById('horaire-faculte').value = coursActuel.faculte || '';
      document.getElementById('horaire-niveau').value  = coursActuel.niveau || 'L1';
      chargerFilieresPourHoraire();
      document.getElementById('horaire-filiere').value = coursActuel.filiere_nom || '';
      await rafraichirCoursHoraire();
      document.getElementById('horaire-cours').value = h.cours_id;
    }
  } catch (err) { console.error(err); }

  document.getElementById('modal-horaire')?.classList.add('active');
}

function fermerModalHoraire() { document.getElementById('modal-horaire')?.classList.remove('active'); }

async function sauvegarderHoraire() {
  const idEdit = document.getElementById('horaire-id-edit').value;
  const annee_academique = document.getElementById('horaire-annee').value;
  const jour             = document.getElementById('horaire-jour').value;
  const date_debut       = document.getElementById('horaire-date-debut').value;
  const heure_debut      = document.getElementById('horaire-debut').value;
  const heure_fin        = document.getElementById('horaire-fin').value;
  const cours_id         = document.getElementById('horaire-cours').value;
  const professeur_id    = document.getElementById('horaire-prof').value;
  const salle            = document.getElementById('horaire-salle').value.trim();

  if (!date_debut||!heure_debut||!heure_fin||!salle) { afficherToast('⚠️ Remplissez tous les champs, y compris la date de début.', 'erreur'); return; }
  if (!jour) { afficherToast('⚠️ La date choisie tombe un week-end : choisissez un jour de semaine (Lundi à Vendredi).', 'erreur'); return; }
  if (heure_fin <= heure_debut) { afficherToast('⚠️ Heure de fin incorrecte.', 'erreur'); return; }
  if (!cours_id) { afficherToast('⚠️ Choisissez un cours.', 'erreur'); return; }
  const coursSelectionne = coursHoraireCache.find(c => String(c.id) === String(cours_id));
  const promotion = coursSelectionne ? coursSelectionne.promotion : '';

  try {
    const corps = { promotion, annee_academique, jour, date_debut, heure_debut, heure_fin, cours_id, professeur_id, salle };
    const r = await fetchAdmin(
      idEdit ? `${BASE_URL}/api/horaires/${idEdit}` : `${BASE_URL}/api/horaires`,
      { method: idEdit?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(corps) }
    );
    const d = await r.json();
    if (!r.ok) { afficherToast('⚠️ '+d.erreur, 'erreur'); return; }
    afficherToast(idEdit?'✅ Cours modifié !':'✅ Cours ajouté !');
    fermerModalHoraire(); chargerHoraires(); chargerStats();
  } catch { afficherToast('⚠️ Impossible de contacter le serveur.', 'erreur'); }
}

async function supprimerHoraire(id) {
  if (!await confirmerAction('Supprimer ce cours de l\'horaire ? Cette action est irréversible.', { titre: 'Supprimer le cours', texteConfirmer: 'Supprimer' })) return;
  try { await fetchAdmin(`${BASE_URL}/api/horaires/${id}`,{method:'DELETE'}); afficherToast('🗑️ Supprimé.'); chargerHoraires(); chargerStats(); }
  catch (err) { console.error(err); }
}

// =====================
// GESTION DU PROGRAMME ANNUEL
// =====================
let programmeAdmin = [];
let vueGroupeeProgramme = false;

function chargerFilieresPourFiltreProg() {
  const faculte = document.getElementById('filtre-faculte-prog')?.value || '';
  const sel = document.getElementById('filtre-filiere-prog');
  if (!sel) return;
  const filieres = filiereParFaculte[faculte] || [];
  sel.innerHTML = '<option value="">Toutes les filières</option>' + filieres.map(f => `<option value="${f}">${f}</option>`).join('');
}

function basculerVueGroupeeProgramme() {
  vueGroupeeProgramme = !vueGroupeeProgramme;
  const btn = document.getElementById('btn-vue-groupee');
  if (btn) btn.style.opacity = vueGroupeeProgramme ? '0.7' : '1';
  chargerProgramme();
}

// Génère les lignes d'un tableau de cours (un semestre).
function lignesCoursProgramme(cours) {
  if (cours.length === 0) return `<tr><td colspan="4" class="admin-vide">Aucun cours.</td></tr>`;
  return cours.map(p => `<tr><td><span class="prog-code-admin">${p.code}</span></td><td>${p.nom}</td><td>${p.credits} cr.</td><td class="admin-actions-cell"><button class="btn-icone" onclick="ouvrirModalInscriptions(${p.id},'${p.nom.replace(/'/g,"\\'")}','${p.promotion}')" aria-label="Étudiants inscrits" title="Étudiants inscrits">${icone('utilisateurs')}</button><button class="btn-icone" onclick="modifierProgramme(${p.id})" aria-label="Modifier">${icone('crayon')}</button><button class="btn-icone danger" onclick="supprimerProgramme(${p.id})" aria-label="Supprimer">${icone('corbeille')}</button></td></tr>`).join('');
}

async function chargerProgramme() {
  const message = document.getElementById('programme-message');
  const normal  = document.getElementById('programme-normal');
  const groupe  = document.getElementById('programme-groupe');
  if (!message || !normal || !groupe) return;

  const faculte = document.getElementById('filtre-faculte-prog')?.value || '';
  const filiere = document.getElementById('filtre-filiere-prog')?.value || '';
  const annee   = document.getElementById('filtre-annee-prog')?.value   || '';
  const niveau  = document.getElementById('filtre-niveau-prog')?.value  || '';

  // Vue groupée : les deux semestres de chaque faculté, séparément.
  if (vueGroupeeProgramme) {
    message.style.display = 'none';
    normal.style.display = 'none';
    groupe.style.display = 'block';
    groupe.innerHTML = '<div class="dash-card" style="text-align:center;color:#888">Chargement...</div>';
    try {
      const params = new URLSearchParams();
      if (annee)  params.append('annee', annee);
      if (niveau) params.append('niveau', niveau);
      const r = await fetch(`${BASE_URL}/api/programme?${params}`);
      programmeAdmin = await r.json();
      afficherProgrammeGroupe();
    } catch { groupe.innerHTML = '<div class="dash-card" style="text-align:center;color:#888">⚠️ Erreur de chargement.</div>'; }
    return;
  }

  // Vue normale : nécessite une sélection précise (faculté + année + niveau).
  if (!faculte || !annee || !niveau) {
    message.style.display = 'block';
    normal.style.display = 'none';
    groupe.style.display = 'none';
    return;
  }

  message.style.display = 'none';
  groupe.style.display = 'none';
  normal.style.display = 'flex';
  const t1 = document.getElementById('prog-s1-body');
  const t2 = document.getElementById('prog-s2-body');
  t1.innerHTML = t2.innerHTML = `<tr><td colspan="4" class="admin-vide">Chargement...</td></tr>`;
  try {
    const params = new URLSearchParams({ faculte, annee, niveau });
    if (filiere) params.append('filiere', filiere);
    const r = await fetch(`${BASE_URL}/api/programme?${params}`);
    programmeAdmin = await r.json();
    afficherTableauProgramme();
  } catch { t1.innerHTML = `<tr><td colspan="4" class="admin-vide">⚠️ Erreur.</td></tr>`; t2.innerHTML=''; }
}

function afficherTableauProgramme(liste = programmeAdmin) {
  const t1 = document.getElementById('prog-s1-body');
  const t2 = document.getElementById('prog-s2-body');
  if (!t1||!t2) return;
  const s1 = liste.filter(p=>p.semestre==='S1');
  const s2 = liste.filter(p=>p.semestre==='S2');
  t1.innerHTML = lignesCoursProgramme(s1); t2.innerHTML = lignesCoursProgramme(s2);
  const e1 = document.getElementById('prog-s1-total'); const e2 = document.getElementById('prog-s2-total');
  if (e1) e1.textContent = s1.reduce((s,p)=>s+p.credits,0);
  if (e2) e2.textContent = s2.reduce((s,p)=>s+p.credits,0);
}

// Affiche chaque faculté dans son propre bloc, avec ses deux semestres.
function afficherProgrammeGroupe() {
  const groupe = document.getElementById('programme-groupe');
  if (!groupe) return;
  const FACULTES = ['Faculté de Théologie','Sciences Informatiques','Sciences Économiques',"Sciences de l'Éducation & Psychologie"];
  if (programmeAdmin.length === 0) {
    groupe.innerHTML = '<div class="dash-card" style="text-align:center;color:#888;padding:30px">Aucun cours pour cette sélection.</div>';
    return;
  }
  // Un tableau de semestre pour une filière donnée, avec total crédits.
  const tableauSemestre = (titre, liste) => `
    <div class="dash-card" style="flex:1;min-width:260px">
      <h4 style="margin:0 0 8px">${titre} <span style="font-weight:400;color:#999;font-size:12px">(${liste.reduce((s,p)=>s+p.credits,0)} cr.)</span></h4>
      <table class="dash-table">
        <thead><tr><th>Code</th><th>Cours</th><th>Crédits</th><th>Actions</th></tr></thead>
        <tbody>${lignesCoursProgramme(liste)}</tbody>
      </table>
    </div>`;

  groupe.innerHTML = FACULTES.map(fac => {
    const coursFac = programmeAdmin.filter(p => p.faculte === fac);
    if (coursFac.length === 0) {
      return `<div style="margin-bottom:28px"><h2 style="font-size:16px;color:var(--bleu);border-bottom:2px solid var(--jaune);padding-bottom:6px;margin-bottom:10px">${fac}</h2><p style="color:#999;font-size:13px">Aucun cours.</p></div>`;
    }
    // Dans chaque faculté, on groupe par filière (les cours communs à part).
    const COMMUN = 'Cours communs (toute la faculté)';
    const filieres = [...new Set(coursFac.map(p => p.filiere_nom || COMMUN))].sort((a,b) => a === COMMUN ? 1 : b === COMMUN ? -1 : a.localeCompare(b));
    const blocs = filieres.map(fil => {
      const coursFil = coursFac.filter(p => (p.filiere_nom || COMMUN) === fil);
      const s1 = coursFil.filter(p => p.semestre === 'S1');
      const s2 = coursFil.filter(p => p.semestre === 'S2');
      return `
        <div style="margin-bottom:16px">
          <h3 style="font-size:14px;color:#333;margin:0 0 8px;padding-left:8px;border-left:3px solid var(--jaune)">${fil}</h3>
          <div class="dash-row">${tableauSemestre('Semestre 1', s1)}${tableauSemestre('Semestre 2', s2)}</div>
        </div>`;
    }).join('');
    return `
      <div style="margin-bottom:30px">
        <h2 style="font-size:16px;color:var(--bleu);border-bottom:2px solid var(--jaune);padding-bottom:6px;margin-bottom:14px">${fac}</h2>
        ${blocs}
      </div>`;
  }).join('');
}

function chargerFilieresPourProgramme() {
  const faculte = document.getElementById('prog-faculte')?.value || '';
  const sel = document.getElementById('prog-filiere');
  if (!sel) return;
  const filieres = filiereParFaculte[faculte] || [];
  sel.innerHTML = '<option value="">— Toute la faculté (cours commun) —</option>' + filieres.map(f => `<option value="${f}">${f}</option>`).join('');
}

// Cibles supplémentaires (faculté + filière) pour programmer un même cours dans
// plusieurs facultés/filières d'un coup. Vidé à chaque ouverture du modal.
let ciblesProgramme = [];

function afficherCiblesProgramme() {
  const zone = document.getElementById('prog-cibles-liste');
  if (!zone) return;
  zone.innerHTML = ciblesProgramme.map((c, i) => `
    <span class="annee-badge" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px">
      🎯 ${c.faculte}${c.filiere ? ' · ' + c.filiere : ' · toute la faculté'}
      <button type="button" onclick="retirerCibleProgramme(${i})" aria-label="Retirer" style="border:none;background:none;cursor:pointer;color:var(--rouge);font-weight:bold">✕</button>
    </span>`).join('');
}

function ajouterCibleProgramme() {
  const faculte = document.getElementById('prog-faculte')?.value || '';
  const filiere = document.getElementById('prog-filiere')?.value || '';
  if (!faculte) { afficherToast('⚠️ Choisissez d\'abord une faculté.', 'erreur'); return; }
  if (ciblesProgramme.some(c => c.faculte === faculte && (c.filiere || '') === filiere)) {
    afficherToast('ℹ️ Cette faculté/filière est déjà dans la liste.', 'erreur'); return;
  }
  ciblesProgramme.push({ faculte, filiere: filiere || null });
  afficherCiblesProgramme();
}

function retirerCibleProgramme(i) {
  ciblesProgramme.splice(i, 1);
  afficherCiblesProgramme();
}

function ouvrirModalProgramme() {
  document.getElementById('modal-programme-titre').textContent = 'Ajouter un cours';
  ['prog-id-edit','prog-code','prog-credits','prog-nom'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('prog-faculte').selectedIndex=0;
  chargerFilieresPourProgramme();
  document.getElementById('prog-niveau').value='L1';
  document.getElementById('prog-annee').value='2025-2026';
  document.getElementById('prog-semestre').value='S1';
  ciblesProgramme = [];
  afficherCiblesProgramme();
  const bloc = document.getElementById('prog-cibles-bloc'); if (bloc) bloc.style.display = ''; // visible en création
  document.getElementById('modal-programme')?.classList.add('active');
}

function modifierProgramme(id) {
  const p = programmeAdmin.find(x=>x.id===id);
  if (!p) return;
  document.getElementById('modal-programme-titre').textContent='Modifier le cours';
  document.getElementById('prog-id-edit').value  = p.id;
  document.getElementById('prog-code').value     = p.code;
  document.getElementById('prog-credits').value  = p.credits;
  document.getElementById('prog-nom').value      = p.nom;
  document.getElementById('prog-faculte').value  = p.faculte || '';
  chargerFilieresPourProgramme();
  document.getElementById('prog-filiere').value  = p.filiere_nom || '';
  document.getElementById('prog-niveau').value   = p.niveau || 'L1';
  document.getElementById('prog-annee').value    = p.annee_academique;
  document.getElementById('prog-semestre').value = p.semestre;
  // En modification, on ne touche qu'à ce cours : le multi-cibles est masqué.
  ciblesProgramme = [];
  afficherCiblesProgramme();
  const bloc = document.getElementById('prog-cibles-bloc'); if (bloc) bloc.style.display = 'none';
  document.getElementById('modal-programme')?.classList.add('active');
}

function fermerModalProgramme() { document.getElementById('modal-programme')?.classList.remove('active'); }

async function sauvegarderProgramme() {
  const idEdit = document.getElementById('prog-id-edit').value;
  const code   = document.getElementById('prog-code').value.trim();
  const credits= parseInt(document.getElementById('prog-credits').value);
  const nom    = document.getElementById('prog-nom').value.trim();
  const faculte = document.getElementById('prog-faculte').value;
  const filiere = document.getElementById('prog-filiere').value;
  const niveau  = document.getElementById('prog-niveau').value;
  const annee_academique = document.getElementById('prog-annee').value;
  const semestre = document.getElementById('prog-semestre').value;
  if (!code||!nom||!faculte||isNaN(credits)||credits<1) { afficherToast('⚠️ Remplissez tous les champs, dont la faculté.', 'erreur'); return; }
  // En création, on programme le cours pour la sélection courante PLUS toutes les
  // cibles ajoutées à la liste (une ou plusieurs facultés/filières à la fois).
  const cibles = [{ faculte, filiere: filiere || null }, ...ciblesProgramme]
    .filter((c, i, arr) => arr.findIndex(x => x.faculte === c.faculte && (x.filiere||'') === (c.filiere||'')) === i);
  const corps = idEdit
    ? { code, nom, faculte, filiere, niveau, annee_academique, semestre, credits }
    : { code, nom, faculte, filiere, niveau, annee_academique, semestre, credits, cibles };
  try {
    const r = await fetchAdmin(idEdit?`${BASE_URL}/api/programme/${idEdit}`:`${BASE_URL}/api/programme`,
      { method:idEdit?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(corps) });
    const d = await r.json();
    if (!r.ok) { afficherToast('⚠️ '+d.erreur, 'erreur'); return; }
    const msgDup = d.doublons && d.doublons.length ? ` — déjà existant pour : ${d.doublons.join(', ')}` : '';
    afficherToast(idEdit
      ? '✅ Modifié !'
      : `✅ Programmé pour ${d.coursCrees||1} faculté(s)/filière(s) ! (${d.etudiantsInscrits||0} étudiant(s) inscrit(s))${msgDup}`);
    // On aligne les filtres sur le cours ajouté/modifié pour qu'il soit
    // immédiatement visible (sinon il resterait masqué derrière le message).
    vueGroupeeProgramme = false;
    const btnG = document.getElementById('btn-vue-groupee'); if (btnG) btnG.style.opacity = '1';
    if (document.getElementById('filtre-faculte-prog')) document.getElementById('filtre-faculte-prog').value = faculte;
    chargerFilieresPourFiltreProg();
    if (document.getElementById('filtre-filiere-prog')) document.getElementById('filtre-filiere-prog').value = filiere || '';
    if (document.getElementById('filtre-annee-prog'))   document.getElementById('filtre-annee-prog').value = annee_academique;
    if (document.getElementById('filtre-niveau-prog'))  document.getElementById('filtre-niveau-prog').value = niveau;
    fermerModalProgramme(); chargerProgramme(); chargerStats();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerProgramme(id) {
  if (!await confirmerAction('Retirer ce cours du programme ? Cette action est irréversible.', { titre: 'Retirer le cours', texteConfirmer: 'Retirer' })) return;
  try { await fetchAdmin(`${BASE_URL}/api/programme/${id}`,{method:'DELETE'}); afficherToast('🗑️ Supprimé.'); chargerProgramme(); chargerStats(); }
  catch (err) { console.error(err); }
}

// =====================
// INSCRIPTIONS AUX COURS
// =====================
async function ouvrirModalInscriptions(coursId, nomCours, promotion) {
  document.getElementById('inscriptions-cours-id').value = coursId;
  document.getElementById('inscriptions-nom-cours').textContent = nomCours;
  document.getElementById('inscriptions-promotion-label').textContent = promotion;
  document.getElementById('inscriptions-recherche').value = '';
  document.getElementById('inscriptions-resultats-recherche').innerHTML = '';

  const coursActuel = programmeAdmin.find(p => p.id === coursId);
  document.getElementById('inscriptions-niveau-masse').value = coursActuel?.niveau || 'L1';
  document.querySelectorAll('#inscriptions-facultes-checkboxes input').forEach(cb => { cb.checked = coursActuel?.faculte === cb.value; });

  document.getElementById('modal-inscriptions')?.classList.add('active');
  await chargerInscriptions();
}

function fermerModalInscriptions() { document.getElementById('modal-inscriptions')?.classList.remove('active'); }

async function chargerInscriptions() {
  const coursId = document.getElementById('inscriptions-cours-id').value;
  const tbody = document.getElementById('inscriptions-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td class="admin-vide">Chargement...</td></tr>`;
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/inscriptions/cours/${coursId}`);
    const etudiants = await r.json();
    document.getElementById('inscriptions-total').textContent = etudiants.length;
    tbody.innerHTML = etudiants.length === 0
      ? `<tr><td class="admin-vide">Aucun étudiant inscrit.</td></tr>`
      : etudiants.map(e => `<tr>
          <td>${e.nom} ${e.postnom||''} ${e.prenom} <span style="color:#999;font-size:11px">(${e.promotion||'—'})</span></td>
          <td class="admin-actions-cell" style="justify-content:flex-end"><button class="btn-icone danger" onclick="retirerInscription('${e.id}')" aria-label="Retirer">${icone('corbeille')}</button></td>
        </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

async function inscrirePlusieursFacultes() {
  const cours_id = document.getElementById('inscriptions-cours-id').value;
  const niveau = document.getElementById('inscriptions-niveau-masse').value;
  const facultes = Array.from(document.querySelectorAll('#inscriptions-facultes-checkboxes input:checked')).map(cb => cb.value);
  if (facultes.length === 0) { afficherToast('⚠️ Sélectionnez au moins une faculté.', 'erreur'); return; }
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/inscriptions/bulk-multi`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cours_id, groupes: facultes.map(faculte => ({ faculte, niveau })) })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ '+d.erreur, 'erreur'); return; }
    afficherToast(`✅ ${d.total} étudiant(s) inscrit(s).`);
    chargerInscriptions();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

let debounceInscriptions;
function rechercherEtudiantPourInscription() {
  clearTimeout(debounceInscriptions);
  debounceInscriptions = setTimeout(async () => {
    const nom = document.getElementById('inscriptions-recherche').value.trim();
    const zone = document.getElementById('inscriptions-resultats-recherche');
    if (!nom) { zone.innerHTML = ''; return; }
    try {
      const r = await fetchAdmin(`${BASE_URL}/api/etudiants?${new URLSearchParams({ nom })}`);
      const etudiants = await r.json();
      zone.innerHTML = etudiants.length === 0
        ? '<p style="color:#999;font-size:12px;padding:6px 0">Aucun étudiant trouvé.</p>'
        : etudiants.slice(0, 8).map(e => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
              <span>${e.nom} ${e.postnom||''} ${e.prenom} <span style="color:#999;font-size:11px">(${e.promotion||'—'})</span></span>
              <button class="btn-icone" onclick="ajouterInscriptionIndividuelle('${e.id}')" aria-label="Inscrire">${icone('plus')}</button>
            </div>`).join('');
    } catch { zone.innerHTML = ''; }
  }, 300);
}

async function ajouterInscriptionIndividuelle(etudiantId) {
  const cours_id = document.getElementById('inscriptions-cours-id').value;
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/inscriptions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etudiant_id: etudiantId, cours_id })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ '+d.erreur, 'erreur'); return; }
    afficherToast('✅ Étudiant inscrit.');
    document.getElementById('inscriptions-recherche').value = '';
    document.getElementById('inscriptions-resultats-recherche').innerHTML = '';
    chargerInscriptions();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function retirerInscription(etudiantId) {
  const coursId = document.getElementById('inscriptions-cours-id').value;
  if (!await confirmerAction('Retirer cet étudiant du cours ?', { titre: 'Retirer l\'inscription', texteConfirmer: 'Retirer' })) return;
  try {
    await fetchAdmin(`${BASE_URL}/api/inscriptions/${etudiantId}/${coursId}`, { method: 'DELETE' });
    afficherToast('🗑️ Étudiant retiré du cours.');
    chargerInscriptions();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

// =====================
// GESTION DES ANNONCES
// =====================
let annoncesAdmin = [];

function formatDateAffichage(dateStr) {
  const d = new Date(dateStr);
  const m = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
  return `${String(d.getUTCDate()).padStart(2,'0')} ${m[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

async function chargerAnnonces() {
  const tbody = document.getElementById('admin-annonces-body');
  if (!tbody) return;
  tbody.innerHTML=`<tr><td colspan="5" class="admin-vide">Chargement...</td></tr>`;
  try {
    const type = document.getElementById('filtre-type-annonce')?.value||'';
    const params = new URLSearchParams();
    if (type) params.append('type',type);
    const r = await fetch(`${BASE_URL}/api/annonces?${params}`);
    // Les communiqués (destinés aux comptes internes) ont leur propre onglet :
    // on ne les mélange pas au contenu public annonces/événements.
    annoncesAdmin = (await r.json()).filter(a => a.type !== 'communique');
    afficherTableauAnnonces();
  } catch { tbody.innerHTML=`<tr><td colspan="5" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

function afficherTableauAnnonces(liste=annoncesAdmin) {
  const tbody=document.getElementById('admin-annonces-body');
  if (!tbody) return;
  if (!liste.length) { tbody.innerHTML=`<tr><td colspan="6" class="admin-vide">Aucune annonce.</td></tr>`; return; }
  tbody.innerHTML=liste.map(a=>`
    <tr>
      <td>${a.icone} ${a.titre}</td>
      <td><span class="type-badge ${a.type}">${a.type==='annonce'?'Annonce':'Événement'}</span></td>
      <td>${formatDateAffichage(a.date_annonce)}</td>
      <td>${a.cible_faculte ? `<span class="annee-badge">${a.cible_faculte}</span>` : '<span style="color:#999;font-size:12px">Tout le monde</span>'}</td>
      <td><span class="badge ${a.actif?'actif':'inactif'}">${a.actif?'Actif':'Masqué'}</span></td>
      <td class="admin-actions-cell">
        <button class="btn-icone" onclick="toggleActifAnnonce(${a.id})" aria-label="${a.actif?'Masquer':'Afficher'}">${icone(a.actif?'oeil':'oeil-barre')}</button>
        <button class="btn-icone" onclick="modifierAnnonce(${a.id})" aria-label="Modifier">${icone('crayon')}</button>
        <button class="btn-icone danger" onclick="supprimerAnnonce(${a.id})" aria-label="Supprimer">${icone('corbeille')}</button>
      </td>
    </tr>`).join('');
}

function gererAffichageChampImage() {
  const t=document.getElementById('annonce-type')?.value;
  const c=document.getElementById('champ-image-evenement');
  if (c) c.style.display=t==='evenement'?'block':'none';
}

function ouvrirModalAnnonce() {
  document.getElementById('modal-annonce-titre').textContent='Nouvelle annonce';
  ['annonce-id-edit','annonce-titre-input','annonce-description','annonce-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('annonce-type').value='annonce';
  document.getElementById('annonce-icone').value='📅';
  document.getElementById('annonce-image').value='';
  const fchNew=document.getElementById('annonce-image-fichier'); if(fchNew) fchNew.value='';
  const apNew=document.getElementById('annonce-image-apercu'); if(apNew) apNew.innerHTML='';
  document.getElementById('annonce-cible').value='';
  document.getElementById('annonce-actif').checked=true;
  gererAffichageChampImage();
  document.getElementById('modal-annonce')?.classList.add('active');
}

function modifierAnnonce(id) {
  const a=annoncesAdmin.find(x=>x.id===id);
  if (!a) return;
  document.getElementById('modal-annonce-titre').textContent='Modifier l\'annonce';
  document.getElementById('annonce-id-edit').value=a.id;
  document.getElementById('annonce-type').value=a.type;
  document.getElementById('annonce-titre-input').value=a.titre;
  document.getElementById('annonce-description').value=a.description;
  document.getElementById('annonce-date').value=a.date_annonce.split('T')[0];
  document.getElementById('annonce-icone').value=a.icone;
  document.getElementById('annonce-image').value=a.image||'';
  const fchEdit=document.getElementById('annonce-image-fichier'); if(fchEdit) fchEdit.value='';
  const apEdit=document.getElementById('annonce-image-apercu');
  if(apEdit) apEdit.innerHTML=a.image?`<img src="${a.image.startsWith('uploads/')?a.image:'img/'+a.image}" alt="" style="max-width:120px;border-radius:6px">`:'';
  document.getElementById('annonce-cible').value=a.cible_faculte||'';
  document.getElementById('annonce-actif').checked=!!a.actif;
  gererAffichageChampImage();
  document.getElementById('modal-annonce')?.classList.add('active');
}

// Aperçu local (sans téléversement) de l'image choisie sur le disque.
function apercuImageAnnonce(input) {
  const zone=document.getElementById('annonce-image-apercu');
  if (!zone) return;
  const f=input.files?.[0];
  if (!f) { zone.innerHTML=''; return; }
  const url=URL.createObjectURL(f);
  zone.innerHTML=`<img src="${url}" alt="" style="max-width:120px;border-radius:6px">`;
}

function fermerModalAnnonce() { document.getElementById('modal-annonce')?.classList.remove('active'); }

async function sauvegarderAnnonce() {
  const idEdit=document.getElementById('annonce-id-edit').value;
  const type=document.getElementById('annonce-type').value;
  const titre=document.getElementById('annonce-titre-input').value.trim();
  const description=document.getElementById('annonce-description').value.trim();
  const date_annonce=document.getElementById('annonce-date').value;
  const icone=document.getElementById('annonce-icone').value;
  const cible_faculte=document.getElementById('annonce-cible').value||null;
  const actif=document.getElementById('annonce-actif').checked;
  if (!titre||!description||!date_annonce) { afficherToast('⚠️ Champs obligatoires manquants.', 'erreur'); return; }
  // Image : uniquement pour les événements. Si un fichier est choisi sur le disque,
  // on le téléverse d'abord et on récupère son chemin (uploads/xxx) ; sinon on
  // conserve l'image déjà enregistrée (champ caché annonce-image).
  let image = type==='evenement' ? (document.getElementById('annonce-image').value||'') : '';
  try {
    const fichierImg=document.getElementById('annonce-image-fichier')?.files?.[0];
    if (type==='evenement' && fichierImg) {
      const fd=new FormData(); fd.append('image', fichierImg);
      const ri=await fetchAdmin(`${BASE_URL}/api/annonces/image`, {method:'POST', body:fd});
      const di=await ri.json();
      if (!ri.ok) { afficherToast('⚠️ '+(di.erreur||"Échec de l'envoi de l'image."), 'erreur'); return; }
      image=di.chemin;
    }
  } catch { afficherToast("⚠️ Échec de l'envoi de l'image.", 'erreur'); return; }
  try {
    const r=await fetchAdmin(idEdit?`${BASE_URL}/api/annonces/${idEdit}`:`${BASE_URL}/api/annonces`,
      {method:idEdit?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,titre,description,date_annonce,icone,image,actif,cible_faculte})});
    const d=await r.json();
    if (!r.ok) { afficherToast('⚠️ '+d.erreur, 'erreur'); return; }
    afficherToast(idEdit?'✅ Modifiée !':'✅ Publiée !');
    fermerModalAnnonce(); chargerAnnonces(); chargerStats();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function toggleActifAnnonce(id) {
  try {
    const r=await fetchAdmin(`${BASE_URL}/api/annonces/${id}/toggle`,{method:'PATCH'});
    const d=await r.json();
    afficherToast(d.actif?'👁️ Activée':'🚫 Masquée');
    chargerAnnonces(); chargerStats();
  } catch (err) { console.error(err); }
}

async function supprimerAnnonce(id) {
  if (!await confirmerAction('Supprimer cette annonce ? Cette action est irréversible.', { titre: 'Supprimer l\'annonce', texteConfirmer: 'Supprimer' })) return;
  try { await fetchAdmin(`${BASE_URL}/api/annonces/${id}`,{method:'DELETE'}); afficherToast('🗑️ Supprimée.'); chargerAnnonces(); chargerStats(); }
  catch (err) { console.error(err); }
}

// =====================
// COMMUNIQUÉS (comptes étudiants / enseignants)
// Réutilisent la table annonce (type='communique', cible_role='etudiant'|'professeur'|'tous').
// =====================
let communiquesAdmin = [];
const LIBELLE_ROLE = { etudiant: 'Étudiants', professeur: 'Enseignants', tous: 'Tout le monde' };

async function chargerCommuniques() {
  const tbody = document.getElementById('admin-communiques-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="admin-vide">Chargement...</td></tr>`;
  try {
    const role = document.getElementById('filtre-role-communique')?.value || '';
    const params = new URLSearchParams({ type: 'communique' });
    if (role) params.append('role', role);
    const r = await fetch(`${BASE_URL}/api/annonces?${params}`);
    communiquesAdmin = await r.json();
    afficherTableauCommuniques();
  } catch { tbody.innerHTML = `<tr><td colspan="5" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

function afficherTableauCommuniques(liste = communiquesAdmin) {
  const tbody = document.getElementById('admin-communiques-body');
  if (!tbody) return;
  if (!liste.length) { tbody.innerHTML = `<tr><td colspan="5" class="admin-vide">Aucun communiqué.</td></tr>`; return; }
  tbody.innerHTML = liste.map(c => `
    <tr>
      <td>📣 ${c.titre}</td>
      <td><span class="annee-badge">${LIBELLE_ROLE[c.cible_role] || 'Étudiants'}</span></td>
      <td>${formatDateAffichage(c.date_annonce)}</td>
      <td><span class="badge ${c.actif?'actif':'inactif'}">${c.actif?'Actif':'Masqué'}</span></td>
      <td class="admin-actions-cell">
        <button class="btn-icone" onclick="toggleActifAnnonce(${c.id}); setTimeout(chargerCommuniques,150)" aria-label="${c.actif?'Masquer':'Afficher'}">${icone(c.actif?'oeil':'oeil-barre')}</button>
        <button class="btn-icone" onclick="modifierCommunique(${c.id})" aria-label="Modifier">${icone('crayon')}</button>
        <button class="btn-icone danger" onclick="supprimerCommunique(${c.id})" aria-label="Supprimer">${icone('corbeille')}</button>
      </td>
    </tr>`).join('');
}

function ouvrirModalCommunique() {
  document.getElementById('modal-communique-titre').textContent = 'Nouveau communiqué';
  document.getElementById('communique-id-edit').value = '';
  document.getElementById('communique-titre').value = '';
  document.getElementById('communique-message').value = '';
  document.getElementById('communique-role').value = 'etudiant';
  document.getElementById('communique-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('communique-actif').checked = true;
  document.getElementById('modal-communique')?.classList.add('active');
}

function modifierCommunique(id) {
  const c = communiquesAdmin.find(x => x.id === id);
  if (!c) return;
  document.getElementById('modal-communique-titre').textContent = 'Modifier le communiqué';
  document.getElementById('communique-id-edit').value = c.id;
  document.getElementById('communique-titre').value = c.titre;
  document.getElementById('communique-message').value = c.description;
  document.getElementById('communique-role').value = c.cible_role || 'etudiant';
  document.getElementById('communique-date').value = (c.date_annonce || '').split('T')[0];
  document.getElementById('communique-actif').checked = !!c.actif;
  document.getElementById('modal-communique')?.classList.add('active');
}

function fermerModalCommunique() { document.getElementById('modal-communique')?.classList.remove('active'); }

async function sauvegarderCommunique() {
  const idEdit = document.getElementById('communique-id-edit').value;
  const titre = document.getElementById('communique-titre').value.trim();
  const description = document.getElementById('communique-message').value.trim();
  const cible_role = document.getElementById('communique-role').value;
  const date_annonce = document.getElementById('communique-date').value;
  const actif = document.getElementById('communique-actif').checked;
  if (!titre || !description || !date_annonce) { afficherToast('⚠️ Champs obligatoires manquants.', 'erreur'); return; }
  const corps = { type: 'communique', titre, description, date_annonce, icone: '📣', image: '', actif, cible_faculte: null, cible_role };
  try {
    const r = await fetchAdmin(idEdit ? `${BASE_URL}/api/annonces/${idEdit}` : `${BASE_URL}/api/annonces`,
      { method: idEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const d = await r.json();
    if (!r.ok) { afficherToast('⚠️ ' + d.erreur, 'erreur'); return; }
    afficherToast(idEdit ? '✅ Communiqué modifié !' : '📣 Communiqué diffusé !');
    fermerModalCommunique(); chargerCommuniques();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerCommunique(id) {
  if (!await confirmerAction('Supprimer ce communiqué ?', { titre: 'Supprimer le communiqué', texteConfirmer: 'Supprimer' })) return;
  try { await fetchAdmin(`${BASE_URL}/api/annonces/${id}`, { method: 'DELETE' }); afficherToast('🗑️ Supprimé.'); chargerCommuniques(); }
  catch (err) { console.error(err); }
}

// =====================
// PRÉ-INSCRIPTIONS
// =====================
let preinscriptionsCache=[];

async function chargerPreinscriptions() {
  const tbody=document.getElementById('admin-preinscriptions-body');
  if (!tbody) return;
  tbody.innerHTML=`<tr><td colspan="6" class="admin-vide">Chargement...</td></tr>`;
  try {
    const r=await fetchAdmin(`${BASE_URL}/api/preinscription`);
    const d=await r.json();
    preinscriptionsCache=d.map(x=>({...x,statut:x.statut||'en_attente'}));
    appliquerFiltresPreinscriptions();
  } catch { tbody.innerHTML=`<tr><td colspan="6" class="admin-vide">⚠️ Serveur indisponible.</td></tr>`; }
}

function libelleStatut(s) {
  return {en_attente:'<span class="badge attente">En attente</span>',accepte:'<span class="badge actif">Accepté</span>',rejete:'<span class="badge inactif" style="background:#fde8e8;color:var(--rouge)">Rejeté</span>'}[s]||'';
}

function afficherTableauPreinscriptions(liste) {
  const tbody=document.getElementById('admin-preinscriptions-body');
  if (!tbody) return;
  if (!liste.length) { tbody.innerHTML=`<tr><td colspan="6" class="admin-vide">Aucune pré-inscription.</td></tr>`; return; }
  tbody.innerHTML=[...liste].sort((a,b)=>new Date(b.date_soumission||0)-new Date(a.date_soumission||0)).map(p=>`
    <tr>
      <td>${[p.nom,p.postnom,p.prenom].filter(Boolean).join(' ')||'—'}</td>
      <td>${p.specialite||'—'}</td>
      <td style="font-size:12px">${p.telephone||''}<br>${p.email||''}</td>
      <td>${p.date_soumission?new Date(p.date_soumission).toLocaleDateString('fr-FR'):'—'}</td>
      <td>${libelleStatut(p.statut)}</td>
      <td class="admin-actions-cell"><button class="btn-icone" onclick="voirDetailPreinscription(${p.id})" aria-label="Voir le dossier">${icone('oeil')}</button></td>
    </tr>`).join('');
}

function appliquerFiltresPreinscriptions() {
  const t=document.getElementById('recherche-preinscriptions')?.value.toLowerCase()||'';
  const s=document.getElementById('filtre-statut-preinscription')?.value||'';
  let r=preinscriptionsCache;
  if (t) r=r.filter(p=>[p.nom,p.postnom,p.prenom,p.specialite].join(' ').toLowerCase().includes(t));
  if (s) r=r.filter(p=>p.statut===s);
  afficherTableauPreinscriptions(r);
}

function voirDetailPreinscription(id) {
  const p=preinscriptionsCache.find(x=>x.id===id);
  if (!p) return;
  const v=(x)=>x||'—';
  const b=(x)=>x?'Oui':'Non';
  const c=document.getElementById('detail-preinscription-contenu');
  c.innerHTML=`<div id="zone-impression">
    <div class="fiche-entete"><img src="img/logo.png" alt="Logo UML" class="fiche-logo"><div><p class="fiche-titre-uni">Université Méthodiste de Lubumbashi</p><p class="fiche-sous-titre">Fiche de pré-inscription — Dossier n°${p.id}</p></div></div>
    <p class="fiche-section-titre">Identité</p>
    <div class="profil-ligne"><span class="profil-cle">Nom complet</span><span class="profil-val">${v(p.nom)} ${v(p.postnom)} ${v(p.prenom)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Date de naissance</span><span class="profil-val">${formaterDate(p.date_naissance)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Lieu de naissance</span><span class="profil-val">${v(p.lieu_naissance)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Nationalité</span><span class="profil-val">${v(p.nationalite)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Sexe</span><span class="profil-val">${p.sexe==='M'?'Masculin':p.sexe==='F'?'Féminin':'—'}</span></div>
    <div class="profil-ligne"><span class="profil-cle">État civil</span><span class="profil-val">${v(p.etat_civil)}</span></div>
    <p class="fiche-section-titre">Contact</p>
    <div class="profil-ligne"><span class="profil-cle">Adresse</span><span class="profil-val">${v(p.adresse1)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Téléphone</span><span class="profil-val">${v(p.telephone)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Email</span><span class="profil-val">${v(p.email)}</span></div>
    <p class="fiche-section-titre">Responsables / Tuteurs</p>
    <div class="profil-ligne"><span class="profil-cle">Père</span><span class="profil-val">${v(p.nom_pere)}${p.tel_pere?' — '+p.tel_pere:''}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Mère</span><span class="profil-val">${v(p.nom_mere)}${p.tel_mere?' — '+p.tel_mere:''}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Tuteur</span><span class="profil-val">${v(p.nom_tuteur)}${p.tel_tuteur?' — '+p.tel_tuteur:''}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Adresse d'urgence</span><span class="profil-val">${v(p.adresse_urgence)}</span></div>
    <p class="fiche-section-titre">Études secondaires</p>
    <div class="profil-ligne"><span class="profil-cle">École</span><span class="profil-val">${v(p.ecole)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Ville</span><span class="profil-val">${v(p.ville_ecole)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">N° diplôme</span><span class="profil-val">${v(p.num_diplome)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Pourcentage</span><span class="profil-val">${v(p.pourcentage)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Année d'obtention</span><span class="profil-val">${formaterDate(p.annee_diplome)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Section</span><span class="profil-val">${v(p.section_secondaire)}</span></div>
    <p class="fiche-section-titre">Choix du programme</p>
    <div class="profil-ligne"><span class="profil-cle">1er choix</span><span class="profil-val">${v(p.specialite)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">2e choix</span><span class="profil-val">${v(p.specialite2)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Niveau</span><span class="profil-val">${v(p.niveau)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Redoublant</span><span class="profil-val">${b(p.redoublant)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">En activité</span><span class="profil-val">${b(p.professionnel)}</span></div>
    <p class="fiche-section-titre">Personne de référence</p>
    <div class="profil-ligne"><span class="profil-cle">Nom complet</span><span class="profil-val">${v(p.ref_nom)} ${v(p.ref_postnom)} ${v(p.ref_prenom)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Téléphone</span><span class="profil-val">${v(p.ref_telephone)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Email</span><span class="profil-val">${v(p.ref_email)}</span></div>
    <p class="fiche-section-titre">Informations complémentaires</p>
    <div class="profil-ligne"><span class="profil-cle">Canal de découverte</span><span class="profil-val">${v(p.canal_decouverte)}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Date de soumission</span><span class="profil-val">${p.date_soumission?new Date(p.date_soumission).toLocaleString('fr-FR'):'—'}</span></div>
    <div class="profil-ligne"><span class="profil-cle">Statut</span><span class="profil-val">${libelleStatut(p.statut)}</span></div>
    <p class="fiche-section-titre">Documents joints</p>
    <div style="padding:8px 0">${p.document_path?p.document_path.split(',').map(f=>`<a href="${BASE_URL}/uploads/${f}" target="_blank" style="display:inline-block;margin:4px 2px;padding:4px 12px;background:#eef2ff;color:#1a3a6b;border-radius:5px;text-decoration:none;font-size:12px">📎 ${f.substring(f.indexOf('_')+1)}</a>`).join(''):'<span style="color:#888;font-size:13px">Aucun document joint</span>'}</div>
  </div>`;
  document.getElementById('actions-preinscription').innerHTML=`
    <button class="btn-annuler" onclick="imprimerDossier()">🖨️ Imprimer</button>
    <button class="btn-annuler" onclick="changerStatutPreinscription(${p.id},'rejete')">❌ Rejeter</button>
    <button class="btn-sauvegarder" onclick="changerStatutPreinscription(${p.id},'accepte')">✅ Accepter</button>`;
  document.getElementById('modal-preinscription')?.classList.add('active');
}

function fermerModalPreinscription() {
  document.getElementById('modal-preinscription')?.classList.remove('active');
  chargerInscrits(); chargerStats();
}

function imprimerDossier() {
  const contenu=document.getElementById('zone-impression').innerHTML;
  const fen=window.open('','_blank','width=800,height=900');
  fen.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Fiche UML</title><style>@page{size:A4;margin:18mm 16mm}*{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#222;font-size:11px;line-height:1.4}.fiche-entete{display:flex;align-items:center;gap:12px;border-bottom:2.5px solid #f0c020;padding-bottom:10px;margin-bottom:12px}.fiche-logo{height:42px}.fiche-titre-uni{font-size:14px;font-weight:700;color:#1a3a6b;margin:0}.fiche-sous-titre{font-size:11px;color:#666;margin:2px 0 0}.fiche-section-titre{font-size:11.5px;font-weight:700;color:#1a3a6b;margin:10px 0 4px;padding-top:6px;border-top:1px solid #ddd}.profil-ligne{display:flex;justify-content:space-between;padding:3px 0;border-bottom:.5px dotted #ccc}.profil-cle{color:#666;font-size:10.5px;flex:0 0 42%}.profil-val{color:#111;font-weight:600;text-align:right;font-size:10.5px}</style></head><body>${contenu}</body></html>`);
  fen.document.close(); fen.focus(); setTimeout(()=>fen.print(),400);
}

async function changerStatutPreinscription(id,nouveauStatut) {
  try {
    const r=await fetchAdmin(`${BASE_URL}/api/preinscription/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({statut:nouveauStatut})});
    let d=null; try{d=await r.json();}catch(e){}
    if (!r.ok) throw new Error(d?.erreur||`Erreur ${r.status}`);
    const p=preinscriptionsCache.find(x=>x.id===id);
    if (p) p.statut=d?.dossier?d.dossier.statut:nouveauStatut;
    fermerModalPreinscription(); appliquerFiltresPreinscriptions(); chargerStats();
    afficherToast(nouveauStatut==='accepte'?'✅ Accepté — étudiant créé !':'❌ Rejeté.');
  } catch (err) { afficherToast('⚠️ '+err.message, 'erreur'); }
}

// =====================
// GESTION DES INSCRITS
// =====================
let inscritsAdmin=[];

function chargerFilieresPourInscrit() {
  const f=document.getElementById('inscrit-faculte')?.value||'';
  const sel=document.getElementById('inscrit-filiere');
  if (!sel) return;
  const fl=filiereParFaculte[f]||[];
  sel.innerHTML=fl.length===0?'<option value="">— Choisir une faculté d\'abord —</option>':
    '<option value="">— Choisir une filière —</option>'+fl.map(x=>`<option value="${x}">${x}</option>`).join('');
}

async function chargerInscrits() {
  const tbody=document.getElementById('admin-inscrits-body');
  if (!tbody) return;
  tbody.innerHTML=`<tr><td colspan="8" class="admin-vide">Chargement...</td></tr>`;
  try {
    const nom=document.getElementById('recherche-inscrits')?.value||'';
    const annee=document.getElementById('filtre-inscrits-annee')?.value||'';
    const niveau=document.getElementById('filtre-inscrits-niveau')?.value||'';
    const faculte=document.getElementById('filtre-inscrits-faculte')?.value||'';
    const params=new URLSearchParams();
    if (nom) params.append('nom',nom);
    if (annee) params.append('annee',annee);
    if (niveau) params.append('niveau',niveau);
    if (faculte) params.append('faculte',faculte);
    const r=await fetchAdmin(`${BASE_URL}/api/etudiants?${params}`);
    inscritsAdmin=await r.json();
    if (!inscritsAdmin.length) { tbody.innerHTML=`<tr><td colspan="8" class="admin-vide">Aucun étudiant trouvé.</td></tr>`; return; }
    tbody.innerHTML=inscritsAdmin.map(e=>`
      <tr>
        <td><code style="font-size:11px">${e.id}</code></td>
        <td><strong>${e.nom}</strong> ${e.postnom||''} ${e.prenom}</td>
        <td>${e.faculte||'—'}</td>
        <td>${e.promotion||'—'}</td>
        <td>${e.niveau?`<span class="annee-badge">${e.niveau}</span>`:'—'}</td>
        <td>${e.annee_academique||'—'}</td>
        <td><span class="badge ${e.statut==='actif'?'reussi':e.statut==='diplome'?'attente':'echec'}">${e.statut||'actif'}</span></td>
        <td class="admin-actions-cell">
          <button class="btn-icone" onclick="telechargerBulletin('${e.id}')" aria-label="Télécharger le bulletin" title="Télécharger le bulletin">${icone('notes')}</button>
          <button class="btn-icone" onclick="imprimerCarteEtudiant('${e.id}')" aria-label="Imprimer la carte étudiant" title="Imprimer la carte étudiant">${icone('carte')}</button>
          <button class="btn-icone" onclick="modifierInscrit('${e.id}')" aria-label="Modifier">${icone('crayon')}</button>
          <button class="btn-icone danger" onclick="supprimerInscrit('${e.id}')" aria-label="Supprimer">${icone('corbeille')}</button>
        </td>
      </tr>`).join('');
  } catch { tbody.innerHTML=`<tr><td colspan="8" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

// Le bulletin est réservé à l'administrateur (l'étudiant n'a pas le droit de
// l'imprimer) : la route backend exige un token admin, donc le téléchargement
// doit passer par fetchAdmin() plutôt qu'un simple lien <a href>.
async function telechargerBulletin(etudiantId) {
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/etudiant/${etudiantId}/bulletin`);
    if (!r.ok) { afficherToast('❌ Impossible de générer le bulletin.', 'erreur'); return false; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulletin-${etudiantId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); return false; }
}

// =====================
// CARTE D'ÉTUDIANT — impression (identité + photo + QR code)
// Le QR encode un condensé vérifiable (matricule, nom, faculté, promotion, année).
// =====================
function imprimerCarteEtudiant(id) {
  const e = inscritsAdmin.find(x => x.id === id);
  if (!e) { afficherToast('⚠️ Étudiant non trouvé. Actualisez.', 'erreur'); return; }
  if (typeof qrcode === 'undefined') { afficherToast('⚠️ Générateur de QR indisponible (vérifiez la connexion).', 'erreur'); return; }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const nomComplet = `${e.nom || ''} ${e.postnom || ''} ${e.prenom || ''}`.replace(/\s+/g, ' ').trim();
  const ddn = e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '—';

  // QR : condensé texte lisible par n'importe quel lecteur.
  const payload = `UML | Matricule: ${e.id} | ${nomComplet} | ${e.faculte || ''} | ${e.promotion || ''} | ${e.annee_academique || ''}`;
  const qr = qrcode(0, 'M'); qr.addData(payload); qr.make();
  const qrSrc = qr.createDataURL(4, 6);

  const initiales = `${(e.prenom || '')[0] || ''}${(e.nom || '')[0] || ''}`.toUpperCase() || 'ET';
  const photoHTML = e.photo
    ? `<img class="r-photo" src="${BASE_URL}/${esc(e.photo)}" alt="Photo">`
    : `<div class="r-photo r-photo-vide">${esc(initiales)}</div>`;

  const naissance = `${ddn}${e.lieu_naissance ? ' à ' + esc(e.lieu_naissance) : ''}`;
  const prenomNom = `${e.prenom || ''} ${e.nom || ''}`.replace(/\s+/g, ' ').trim();

  // Verso : vignettes mensuelles de validation (comme les timbres de la carte modèle).
  const MOIS = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
  const cellulesMois = MOIS.map(m => `<div class="v-mois"><div class="v-case"></div><span>${m}</span></div>`).join('');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Carte étudiant ${esc(e.id)}</title>
<style>
  :root { --bleu:#1a3a6b; --bleu2:#24508f; --jaune:#f0c020; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #e9edf2; padding: 24px; color: #1a1a1a; }
  .barre { text-align: center; margin-bottom: 18px; }
  .barre button { font-size: 14px; padding: 9px 20px; border: none; border-radius: 6px; background: var(--bleu); color: #fff; cursor: pointer; }
  .carte { width: 340px; height: 214px; margin: 0 auto 22px; border-radius: 12px; overflow: hidden;
           box-shadow: 0 6px 18px rgba(0,0,0,.18); position: relative; }

  /* ---------- RECTO ---------- */
  .recto { background: linear-gradient(135deg, #14294b 0%, var(--bleu) 55%, var(--bleu2) 100%); color: #fff; }
  .r-annee { position: absolute; top: 0; right: 0; width: 112px; padding: 6px 10px 8px; text-align: center;
             background: var(--jaune); color: var(--bleu); border-bottom-left-radius: 16px; }
  .r-annee small { display: block; font-size: 7px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; }
  .r-annee b { font-size: 11px; }
  .r-top { display: flex; align-items: center; gap: 8px; padding: 9px 12px 4px; }
  .r-top .u { font-size: 11px; font-weight: 800; line-height: 1.12; letter-spacing: .3px; }
  .r-fac { padding: 2px 12px 6px; color: var(--jaune); font-size: 9.5px; font-weight: 700; }
  .r-body { display: flex; padding: 0 12px; gap: 10px; }
  .r-infos { flex: 1 1 auto; min-width: 0; }
  .r-nom { font-size: 12px; font-weight: 800; text-transform: uppercase; line-height: 1.15; }
  .r-nom span { display: block; font-size: 10px; font-weight: 600; text-transform: none; }
  .r-sub { font-size: 8px; color: #cdd8ea; margin: 3px 0 5px; }
  .r-infos p { font-size: 8.5px; line-height: 1.5; }
  .r-infos p b { color: var(--jaune); font-weight: 600; }
  .r-photo { width: 88px; height: 104px; object-fit: cover; border-radius: 4px; border: 2px solid var(--jaune); flex: 0 0 auto; }
  .r-photo-vide { display: flex; align-items: center; justify-content: center; background: #0e1f3a; color: var(--jaune); font-size: 32px; font-weight: 800; }
  .r-pied { position: absolute; left: 0; right: 0; bottom: 0; background: var(--jaune); color: var(--bleu);
            font-size: 7.5px; font-weight: 600; padding: 3px 12px; display: flex; justify-content: space-between; }

  /* ---------- VERSO ---------- */
  .verso { background: linear-gradient(135deg, #f4f6f9, #e3e8ef); color: var(--bleu); }
  .v-top { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px;
           border-bottom: 2px solid var(--jaune); }
  .v-top .n { font-size: 10px; font-weight: 800; }
  .v-top .a { font-size: 8.5px; font-weight: 700; }
  .v-top .a small { color: #6a768a; }
  .v-corps { display: flex; gap: 10px; padding: 9px 12px 4px; }
  .v-qr { text-align: center; flex: 0 0 auto; }
  .v-qr img { width: 78px; height: 78px; }
  .v-qr span { display: block; font-size: 6.5px; color: #6a768a; margin-top: 2px; }
  .v-grille { flex: 1 1 auto; display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px 6px; align-content: start; }
  .v-mois { text-align: center; }
  .v-case { height: 24px; border: 1px solid var(--bleu); border-radius: 4px; background: rgba(240,192,32,.10); }
  .v-mois span { font-size: 6.5px; color: var(--bleu); }
  .v-pied { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-size: 6.5px;
            color: #6a768a; padding: 2px; border-top: 1px solid #d4dae3; }

  @media print {
    body { background: #fff; padding: 0; }
    .barre { display: none; }
    .carte { box-shadow: none; margin: 0 auto; }
    .verso { page-break-before: always; }
    @page { size: auto; margin: 10mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
  <div class="barre"><button onclick="window.print()">🖨️ Imprimer la carte (recto / verso)</button></div>

  <!-- RECTO -->
  <div class="carte recto">
    <div class="r-annee"><small>Année académique</small><b>${esc(e.annee_academique || '—')}</b></div>
    <div class="r-top">
      <div class="u">UNIVERSITÉ MÉTHODISTE<br>DE LUBUMBASHI</div>
    </div>
    <div class="r-fac">${esc(e.faculte || 'Université Méthodiste de Lubumbashi')}</div>
    <div class="r-body">
      <div class="r-infos">
        <div class="r-nom">${esc(`${e.nom || ''} ${e.postnom || ''}`.trim())}<span>${esc(e.prenom || '')}</span></div>
        <div class="r-sub">Né(e) le ${naissance}</div>
        <p>Étudiant(e)</p>
        <p>Niveau : <b>${esc(e.niveau || '—')}</b></p>
        <p>Matricule : <b>${esc(e.id)}</b></p>
        <p>Classe : <b>${esc(e.promotion || '—')}</b></p>
      </div>
      ${photoHTML}
    </div>
    <div class="r-pied"><span>Lubumbashi — R.D. Congo</span><span>Carte strictement personnelle</span></div>
  </div>

  <!-- VERSO -->
  <div class="carte verso">
    <div class="v-top">
      <span class="n">${esc(prenomNom)}</span>
      <span class="a"><small>Année académique</small> ${esc(e.annee_academique || '—')}</span>
    </div>
    <div class="v-corps">
      <div class="v-qr"><img src="${qrSrc}" alt="QR"><span>Vérification</span></div>
      <div class="v-grille">${cellulesMois}</div>
    </div>
    <div class="v-pied">En cas de perte, prière de la remettre à l'Université Méthodiste de Lubumbashi</div>
  </div>

<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 500); });<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=760,height=560');
  if (!w) { afficherToast('⚠️ Autorisez les pop-ups pour imprimer la carte.', 'erreur'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function modifierInscrit(id) {
  const e=inscritsAdmin.find(x=>x.id===id);
  if (!e) { afficherToast('⚠️ Étudiant non trouvé. Actualisez.', 'erreur'); return; }
  document.getElementById('inscrit-id-edit').value   = e.id;
  document.getElementById('inscrit-nom').value       = e.nom||'';
  document.getElementById('inscrit-postnom').value   = e.postnom||'';
  document.getElementById('inscrit-prenom').value    = e.prenom||'';
  document.getElementById('inscrit-ddn').value       = e.date_naissance?e.date_naissance.split('T')[0]:'';
  document.getElementById('inscrit-sexe').value      = e.sexe||'M';
  document.getElementById('inscrit-email').value     = e.email||'';
  document.getElementById('inscrit-telephone').value = e.telephone||'';
  document.getElementById('inscrit-annee').value     = e.annee_academique||'2025-2026';
  document.getElementById('inscrit-statut').value    = e.statut||'actif';
  document.getElementById('inscrit-promotion').value = e.niveau||'L1';
  document.getElementById('inscrit-faculte').value   = e.faculte||'';
  chargerFilieresPourInscrit();
  const sel=document.getElementById('inscrit-filiere');
  if (e.promotion) {
    const ok=Array.from(sel.options).some(o=>o.value===e.promotion);
    if (!ok) { const opt=document.createElement('option'); opt.value=e.promotion; opt.textContent=e.promotion; sel.appendChild(opt); }
    sel.value=e.promotion;
  }
  // Photo : champ fichier remis à zéro, aperçu de la photo déjà enregistrée.
  document.getElementById('inscrit-photo').value = e.photo || '';
  const fch=document.getElementById('inscrit-photo-fichier'); if(fch) fch.value='';
  const ap=document.getElementById('inscrit-photo-apercu');
  if(ap) ap.innerHTML = e.photo ? `<img src="${BASE_URL}/${e.photo}" alt="" style="max-width:90px;border-radius:6px">` : '<span style="color:#999;font-size:12px">Aucune photo</span>';
  document.getElementById('modal-inscrit')?.classList.add('active');
}

function fermerModalInscrit() { document.getElementById('modal-inscrit')?.classList.remove('active'); }

// Aperçu local (sans téléversement) de la photo choisie sur le disque.
function apercuPhotoInscrit(input) {
  const zone=document.getElementById('inscrit-photo-apercu');
  if (!zone) return;
  const f=input.files?.[0];
  if (!f) { zone.innerHTML=''; return; }
  zone.innerHTML=`<img src="${URL.createObjectURL(f)}" alt="" style="max-width:90px;border-radius:6px">`;
}

async function sauvegarderInscrit() {
  const id=document.getElementById('inscrit-id-edit').value;
  const faculte=document.getElementById('inscrit-faculte').value;
  const filiere=document.getElementById('inscrit-filiere').value;
  const niveau=document.getElementById('inscrit-promotion').value;
  const corps={
    nom:document.getElementById('inscrit-nom').value.trim(),
    postnom:document.getElementById('inscrit-postnom').value.trim(),
    prenom:document.getElementById('inscrit-prenom').value.trim(),
    date_naissance:document.getElementById('inscrit-ddn').value,
    sexe:document.getElementById('inscrit-sexe').value,
    email:document.getElementById('inscrit-email').value.trim(),
    telephone:document.getElementById('inscrit-telephone').value.trim(),
    faculte,promotion:filiere,niveau,
    annee_academique:document.getElementById('inscrit-annee').value,
    statut:document.getElementById('inscrit-statut').value
  };
  try {
    const r=await fetchAdmin(`${BASE_URL}/api/etudiants/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(corps)});
    const d=await r.json();
    if (!r.ok) { afficherToast('❌ '+d.erreur, 'erreur'); return; }
    // Si une nouvelle photo a été choisie, on la téléverse après la mise à jour.
    const fichierPhoto=document.getElementById('inscrit-photo-fichier')?.files?.[0];
    if (fichierPhoto) {
      const fd=new FormData(); fd.append('photo', fichierPhoto);
      const rp=await fetchAdmin(`${BASE_URL}/api/etudiants/${id}/photo`, { method:'POST', body:fd });
      if (!rp.ok) { const dp=await rp.json(); afficherToast('⚠️ '+(dp.erreur||"Échec de l'envoi de la photo."), 'erreur'); }
    }
    afficherToast('✅ Mis à jour !'); fermerModalInscrit(); chargerInscrits(); chargerStats();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerInscrit(id) {
  if (!await confirmerAction(`Supprimer l'étudiant ${id} ? Cette action est irréversible.`, { titre: 'Supprimer l\'étudiant', texteConfirmer: 'Supprimer' })) return;
  try {
    const r=await fetchAdmin(`${BASE_URL}/api/etudiants/${id}`,{method:'DELETE'});
    const d=await r.json();
    if (!r.ok) { afficherToast('❌ '+d.erreur, 'erreur'); return; }
    afficherToast('🗑️ Supprimé.'); chargerInscrits(); chargerStats();
  } catch (err) { console.error(err); }
}

// =====================
// AGENTS (PERSONNEL) — la fonction détermine l'accès aux interfaces
// =====================
let agentsAdmin = [];
const LIBELLE_FONCTION = { caissier: 'Caissier', administrateur_budget: 'Administrateur du budget' };

async function chargerAgents() {
  const tbody = document.getElementById('admin-agents-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Chargement...</td></tr>`;
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/agents`);
    agentsAdmin = await r.json();
    if (!agentsAdmin.length) { tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Aucun agent.</td></tr>`; return; }
    tbody.innerHTML = agentsAdmin.map(a => `
      <tr>
        <td><code style="font-size:11px">${a.matricule}</code></td>
        <td><strong>${a.noms}</strong> ${a.prenom || ''}</td>
        <td><span class="annee-badge">${LIBELLE_FONCTION[a.fonction] || a.fonction}</span></td>
        <td>${a.email || '—'}</td>
        <td>${a.telephone || '—'}</td>
        <td class="admin-actions-cell">
          <button class="btn-icone" onclick="modifierAgent(${a.id})" aria-label="Modifier">${icone('crayon')}</button>
          <button class="btn-icone danger" onclick="supprimerAgent(${a.id})" aria-label="Supprimer">${icone('corbeille')}</button>
        </td>
      </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

function ouvrirModalAgent() {
  document.getElementById('modal-agent-titre').textContent = 'Nouvel agent';
  ['agent-id-edit','agent-matricule','agent-noms','agent-prenom','agent-email','agent-telephone','agent-mot-de-passe'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('agent-fonction').value = 'caissier';
  document.getElementById('agent-mdp-aide').style.display = 'none';
  document.getElementById('agent-mdp-label').innerHTML = 'Mot de passe <span style="color:var(--rouge)">*</span>';
  document.getElementById('modal-agent')?.classList.add('active');
}

function modifierAgent(id) {
  const a = agentsAdmin.find(x => x.id === id);
  if (!a) return;
  document.getElementById('modal-agent-titre').textContent = 'Modifier l\'agent';
  document.getElementById('agent-id-edit').value = a.id;
  document.getElementById('agent-matricule').value = a.matricule;
  document.getElementById('agent-noms').value = a.noms;
  document.getElementById('agent-prenom').value = a.prenom || '';
  document.getElementById('agent-email').value = a.email || '';
  document.getElementById('agent-telephone').value = a.telephone || '';
  document.getElementById('agent-fonction').value = a.fonction;
  document.getElementById('agent-mot-de-passe').value = '';
  document.getElementById('agent-mdp-aide').style.display = '';
  document.getElementById('agent-mdp-label').innerHTML = 'Nouveau mot de passe';
  document.getElementById('modal-agent')?.classList.add('active');
}

function fermerModalAgent() { document.getElementById('modal-agent')?.classList.remove('active'); }

async function sauvegarderAgent() {
  const idEdit = document.getElementById('agent-id-edit').value;
  const corps = {
    matricule: document.getElementById('agent-matricule').value.trim(),
    noms: document.getElementById('agent-noms').value.trim(),
    prenom: document.getElementById('agent-prenom').value.trim(),
    email: document.getElementById('agent-email').value.trim(),
    telephone: document.getElementById('agent-telephone').value.trim(),
    fonction: document.getElementById('agent-fonction').value,
    mot_de_passe: document.getElementById('agent-mot-de-passe').value,
  };
  if (!corps.matricule || !corps.noms) { afficherToast('⚠️ Matricule et noms obligatoires.', 'erreur'); return; }
  if (!idEdit && !corps.mot_de_passe) { afficherToast('⚠️ Le mot de passe est obligatoire.', 'erreur'); return; }
  try {
    const r = await fetchAdmin(idEdit ? `${BASE_URL}/api/agents/${idEdit}` : `${BASE_URL}/api/agents`,
      { method: idEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const d = await r.json();
    if (!r.ok) { afficherToast('⚠️ ' + d.erreur, 'erreur'); return; }
    afficherToast(idEdit ? '✅ Agent modifié !' : '✅ Agent créé !');
    fermerModalAgent(); chargerAgents();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerAgent(id) {
  if (!await confirmerAction('Supprimer cet agent ? Il ne pourra plus se connecter.', { titre: 'Supprimer l\'agent', texteConfirmer: 'Supprimer' })) return;
  try { await fetchAdmin(`${BASE_URL}/api/agents/${id}`, { method: 'DELETE' }); afficherToast('🗑️ Agent supprimé.'); chargerAgents(); }
  catch (err) { console.error(err); }
}

// =====================
// RÉINSCRIPTIONS (promotion montante + nouvel étudiant à un niveau supérieur)
// =====================
function basculerOngletReinscription(idOnglet, btn) {
  document.querySelectorAll('.reins-onglet-contenu').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.reins-onglet-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(idOnglet)?.classList.add('active');
  btn?.classList.add('active');
}

let debounceReins;
function rechercherEtudiantPourPromotion() {
  clearTimeout(debounceReins);
  debounceReins = setTimeout(async () => {
    const nom = document.getElementById('reins-recherche').value.trim();
    const zone = document.getElementById('reins-resultats');
    if (!nom) { zone.innerHTML = ''; return; }
    try {
      const r = await fetchAdmin(`${BASE_URL}/api/etudiants?${new URLSearchParams({ nom })}`);
      const etudiants = await r.json();
      zone.innerHTML = etudiants.length === 0
        ? '<p style="color:#999;font-size:12px;padding:6px 0">Aucun étudiant trouvé.</p>'
        : etudiants.slice(0, 8).map(e => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 4px;border-bottom:1px solid #f0f0f0;font-size:13px">
              <span>${e.nom} ${e.postnom||''} ${e.prenom} <span style="color:#999;font-size:11px">(${e.id} · ${e.niveau||'—'} ${e.promotion||''})</span></span>
              <button class="btn-icone" onclick="selectionnerEtudiantPromotion('${e.id}','${(e.nom+' '+(e.postnom||'')+' '+e.prenom).replace(/'/g,"\\'")}','${e.niveau||''}','${(e.promotion||'').replace(/'/g,"\\'")}','${e.faculte||''}','${e.annee_academique||''}')" aria-label="Sélectionner">${icone('coche')}</button>
            </div>`).join('');
    } catch { zone.innerHTML = ''; }
  }, 300);
}

function selectionnerEtudiantPromotion(id, nomComplet, niveau, promotion, faculte, annee) {
  document.getElementById('reins-etudiant-id').value = id;
  document.getElementById('reins-etudiant-info').innerHTML =
    `<b>${nomComplet}</b><br><span style="color:#666">${id} · ${faculte||'—'} · ${promotion||'—'} · Niveau actuel : <b>${niveau||'—'}</b> · ${annee||'—'}</span>`;
  document.getElementById('reins-resultats').innerHTML = '';
  document.getElementById('reins-recherche').value = '';
  document.getElementById('reins-selection').style.display = 'block';
  // Pré-suggérer le niveau suivant.
  const suite = { L1:'L2', L2:'L3', L3:'M1', M1:'M2', M2:'D1', D1:'D2' };
  if (suite[niveau]) document.getElementById('reins-nouveau-niveau').value = suite[niveau];
}

async function promouvoirEtudiant() {
  const etudiant_id = document.getElementById('reins-etudiant-id').value;
  const nouveau_niveau = document.getElementById('reins-nouveau-niveau').value;
  const annee_academique = document.getElementById('reins-annee-promo').value;
  if (!etudiant_id) { afficherToast('⚠️ Sélectionnez d\'abord un étudiant.', 'erreur'); return; }
  if (!await confirmerAction(`Promouvoir cet étudiant en ${nouveau_niveau} pour ${annee_academique} ?`, { titre: 'Promotion montante', texteConfirmer: 'Promouvoir' })) return;
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/reinscriptions/promouvoir`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etudiant_id, nouveau_niveau, annee_academique })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ '+d.erreur, 'erreur'); return; }
    afficherToast(`✅ ${d.message} (${d.coursInscrits} cours inscrit(s))`);
    document.getElementById('reins-selection').style.display = 'none';
    document.getElementById('reins-etudiant-id').value = '';
    chargerStats();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

function chargerFilieresPourReinscription() {
  const faculte = document.getElementById('reins-faculte')?.value || '';
  const sel = document.getElementById('reins-filiere');
  if (!sel) return;
  const filieres = filiereParFaculte[faculte] || [];
  sel.innerHTML = filieres.length === 0
    ? '<option value="">— Choisir une faculté d\'abord —</option>'
    : '<option value="">— Choisir une filière —</option>' + filieres.map(f => `<option value="${f}">${f}</option>`).join('');
}

async function reinscrireNouvelEtudiant() {
  const corps = {
    nom: document.getElementById('reins-nom').value.trim(),
    postnom: document.getElementById('reins-postnom').value.trim(),
    prenom: document.getElementById('reins-prenom').value.trim(),
    sexe: document.getElementById('reins-sexe').value,
    date_naissance: document.getElementById('reins-ddn').value,
    email: document.getElementById('reins-email').value.trim(),
    telephone: document.getElementById('reins-telephone').value.trim(),
    faculte: document.getElementById('reins-faculte').value,
    filiere: document.getElementById('reins-filiere').value,
    niveau: document.getElementById('reins-niveau').value,
    annee_academique: document.getElementById('reins-annee-nouveau').value
  };
  if (!corps.nom || !corps.prenom || !corps.faculte || !corps.niveau) {
    afficherToast('⚠️ Nom, prénom, faculté et niveau sont obligatoires.', 'erreur'); return;
  }
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/reinscriptions/nouveau`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ '+d.erreur, 'erreur'); return; }
    // Réinitialiser le formulaire
    ['reins-nom','reins-postnom','reins-prenom','reins-ddn','reins-email','reins-telephone'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('reins-faculte').selectedIndex = 0;
    chargerFilieresPourReinscription();
    chargerStats();
    await confirmerAction(
      `Étudiant réinscrit en ${corps.niveau} (${d.coursInscrits} cours). Matricule : ${d.matricule} — Mot de passe temporaire : ${d.motDePasseTemporaire}`,
      { titre: '✅ Réinscription réussie', texteConfirmer: 'Compris' }
    );
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

// =====================
// FRAIS DE SCOLARITÉ
// =====================
async function ouvrirModalPaiements(etudiantId, nomEtudiant) {
  document.getElementById('paiements-etudiant-id').value = etudiantId;
  document.getElementById('paiements-nom-etudiant').textContent = nomEtudiant;
  document.getElementById('paiement-montant').value = '';
  document.getElementById('paiement-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('paiement-reference').value = '';
  document.getElementById('modal-paiements')?.classList.add('active');
  await chargerPaiements();
}

function fermerModalPaiements() { document.getElementById('modal-paiements')?.classList.remove('active'); }

async function chargerPaiements() {
  const etudiantId = document.getElementById('paiements-etudiant-id').value;
  const tbody = document.getElementById('paiements-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="admin-vide">Chargement...</td></tr>`;
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/paiements/etudiant/${etudiantId}`);
    const paiements = await r.json();
    const total = paiements.reduce((s, p) => s + Number(p.montant), 0);
    document.getElementById('paiements-total').textContent = `${total.toFixed(2)} $`;
    tbody.innerHTML = paiements.length === 0
      ? `<tr><td colspan="4" class="admin-vide">Aucun versement enregistré.</td></tr>`
      : paiements.map(p => `<tr>
          <td>${formaterDate(p.date_paiement)}</td>
          <td>${Number(p.montant).toFixed(2)} $</td>
          <td>${p.mode_paiement || '—'}</td>
          <td class="admin-actions-cell"><button class="btn-icone danger" onclick="supprimerPaiement(${p.id})" aria-label="Supprimer">${icone('corbeille')}</button></td>
        </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="4" class="admin-vide">⚠️ Erreur.</td></tr>`; }
}

async function ajouterPaiement() {
  const etudiant_id = document.getElementById('paiements-etudiant-id').value;
  const montant = parseFloat(document.getElementById('paiement-montant').value);
  const date_paiement = document.getElementById('paiement-date').value;
  const mode_paiement = document.getElementById('paiement-mode').value;
  const reference = document.getElementById('paiement-reference').value.trim();

  if (isNaN(montant) || montant <= 0) { afficherToast('⚠️ Entrez un montant valide.', 'erreur'); return; }
  if (!date_paiement) { afficherToast('⚠️ La date est obligatoire.', 'erreur'); return; }

  try {
    const r = await fetchAdmin(`${BASE_URL}/api/paiements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etudiant_id, montant, date_paiement, mode_paiement, reference })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ '+d.erreur, 'erreur'); return; }
    afficherToast('✅ Versement enregistré.');
    document.getElementById('paiement-montant').value = '';
    document.getElementById('paiement-reference').value = '';
    chargerPaiements();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerPaiement(id) {
  if (!await confirmerAction('Supprimer ce versement ? Cette action est irréversible.', { titre: 'Supprimer le versement', texteConfirmer: 'Supprimer' })) return;
  try {
    await fetchAdmin(`${BASE_URL}/api/paiements/${id}`, { method: 'DELETE' });
    afficherToast('🗑️ Versement supprimé.');
    chargerPaiements();
  } catch (err) { console.error(err); }
}

// =====================
// ATTRIBUTIONS DES COURS
// =====================
async function chargerAttributions() { await chargerProfesseurs(); await chargerCoursSansProf(); }

function basculerOngletAttribution(idOnglet, btn) {
  document.querySelectorAll('.attr-onglet-contenu').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.attr-onglet-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(idOnglet)?.classList.add('active');
  btn?.classList.add('active');
}

async function chargerProfesseurs() {
  const tbody=document.getElementById('admin-professeurs-body');
  if (!tbody) return;
  const annee=document.getElementById('filtre-attr-annee')?.value||'';
  try {
    const [rProfs,rProgramme]=await Promise.all([
      fetchAdmin(`${BASE_URL}/api/professeurs`),
      fetchAdmin(`${BASE_URL}/api/programme?annee=${annee}`)
    ]);
    const profs=await rProfs.json();
    const programme=await rProgramme.json();

    const coursParProf={};
    programme.forEach(c=>{ if (!c.professeur_id) return; (coursParProf[c.professeur_id]||=[]).push(c); });

    tbody.innerHTML=profs.length===0?`<tr><td colspan="5" class="admin-vide">Aucun professeur.</td></tr>`:
      profs.map(p=>{
        const cours=coursParProf[p.id]||[];
        const listeCours=cours.length===0
          ? '<span class="admin-vide">Aucun cours</span>'
          : cours.map(c=>`${c.nom} <small>(${c.promotion})</small>`).join('<br>');
        return `<tr><td>${p.nom}</td><td>${p.prenom||'—'}</td><td>${p.grade||'—'}</td><td>${listeCours}</td><td class="admin-actions-cell"><button class="btn-icone" onclick="ouvrirModalAttribution(null,${p.id})" aria-label="Attribuer un cours" title="Attribuer un cours">${icone('plus')}</button><button class="btn-icone" onclick="modifierProfesseur(${p.id})" aria-label="Modifier">${icone('crayon')}</button><button class="btn-icone danger" onclick="supprimerProfesseur(${p.id})" aria-label="Supprimer">${icone('corbeille')}</button></td></tr>`;
      }).join('');
  } catch (err) { console.error(err); }
}

async function chargerCoursSansProf() {
  const tbody=document.getElementById('admin-sans-prof-body');
  if (!tbody) return;
  const annee=document.getElementById('filtre-attr-annee')?.value||'';
  try {
    const r=await fetchAdmin(`${BASE_URL}/api/programme?annee=${annee}`);
    const programme=await r.json();
    const sans=programme.filter(c=>!c.professeur_id);
    tbody.innerHTML=sans.length===0?`<tr><td colspan="4" class="admin-vide">✅ Tous les cours ont un professeur.</td></tr>`:
      sans.map(c=>`<tr><td>${c.nom}</td><td>${c.promotion}</td><td>${c.semestre==='S1'?'Semestre 1':'Semestre 2'}</td><td><button class="btn-ajouter" style="padding:4px 10px;font-size:12px" onclick="ouvrirModalAttribution(${c.id},null)">Attribuer</button></td></tr>`).join('');
  } catch (err) { console.error(err); }
}

function ouvrirModalProfesseur() {
  document.getElementById('modal-prof-titre').textContent='Ajouter un professeur';
  ['prof-id-edit','prof-nom','prof-prenom','prof-email','prof-telephone','prof-grade'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('modal-professeur')?.classList.add('active');
}

async function modifierProfesseur(id) {
  try {
    const r=await fetchAdmin(`${BASE_URL}/api/professeurs`);
    const profs=await r.json();
    const p=profs.find(x=>x.id===id);
    if (!p) return;
    document.getElementById('modal-prof-titre').textContent='Modifier le professeur';
    document.getElementById('prof-id-edit').value   = p.id;
    document.getElementById('prof-nom').value       = p.nom;
    document.getElementById('prof-prenom').value    = p.prenom||'';
    document.getElementById('prof-email').value     = p.email||'';
    document.getElementById('prof-telephone').value = p.telephone||'';
    document.getElementById('prof-grade').value     = p.grade||'';
    document.getElementById('modal-professeur')?.classList.add('active');
  } catch (err) { console.error(err); }
}

function fermerModalProfesseur() { document.getElementById('modal-professeur')?.classList.remove('active'); }

async function sauvegarderProfesseur() {
  const idEdit=document.getElementById('prof-id-edit').value;
  const nom=document.getElementById('prof-nom').value.trim();
  if (!nom) { afficherToast('⚠️ Le nom est obligatoire.', 'erreur'); return; }
  const corps={nom,prenom:document.getElementById('prof-prenom').value.trim(),email:document.getElementById('prof-email').value.trim(),telephone:document.getElementById('prof-telephone').value.trim(),grade:document.getElementById('prof-grade').value.trim()};
  try {
    const r=await fetchAdmin(idEdit?`${BASE_URL}/api/professeurs/${idEdit}`:`${BASE_URL}/api/professeurs`,
      {method:idEdit?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corps)});
    const d=await r.json();
    if (!r.ok) { afficherToast('❌ '+d.erreur, 'erreur'); return; }
    fermerModalProfesseur(); chargerAttributions();
    if (!idEdit && d.motDePasseTemporaire) {
      await confirmerAction(
        `Accès espace professeur créé. Communiquez ce mot de passe temporaire à ${corps.nom} : ${d.motDePasseTemporaire}`,
        { titre: 'Mot de passe temporaire', texteConfirmer: 'Compris' }
      );
    } else {
      afficherToast(idEdit?'✅ Modifié !':'✅ Ajouté !');
    }
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

async function supprimerProfesseur(id) {
  if (!await confirmerAction('Supprimer ce professeur ? Cette action est irréversible.', { titre: 'Supprimer le professeur', texteConfirmer: 'Supprimer' })) return;
  try { await fetchAdmin(`${BASE_URL}/api/professeurs/${id}`,{method:'DELETE'}); afficherToast('🗑️ Supprimé.'); chargerAttributions(); }
  catch (err) { console.error(err); }
}

let programmeAttribution=[];

function filtrerCoursAttribution(coursIdASelectionner) {
  const promotion=document.getElementById('attr-promotion-select')?.value||'';
  const liste=promotion?programmeAttribution.filter(c=>c.promotion===promotion):programmeAttribution;
  const sel=document.getElementById('attr-cours-select');
  if (!sel) return;
  sel.innerHTML='<option value="">— Choisir un cours —</option>'+
    liste.map(c=>`<option value="${c.id}">${c.nom} — ${c.promotion}${c.professeur_nom?' — actuellement : '+c.professeur_nom:''}</option>`).join('');
  if (coursIdASelectionner) sel.value=coursIdASelectionner;
}

async function ouvrirModalAttribution(coursId,professeurId) {
  const annee=document.getElementById('filtre-attr-annee')?.value||'';
  try {
    const [rProgramme,rProfs]=await Promise.all([
      fetchAdmin(`${BASE_URL}/api/programme?annee=${annee}`),
      fetchAdmin(`${BASE_URL}/api/professeurs`)
    ]);
    programmeAttribution=await rProgramme.json();
    const profs=await rProfs.json();

    const promotions=[...new Set(programmeAttribution.map(c=>c.promotion))].sort();
    document.getElementById('attr-promotion-select').innerHTML='<option value="">— Toutes les promotions —</option>'+
      promotions.map(p=>`<option value="${p}">${p}</option>`).join('');

    const coursActuel=coursId?programmeAttribution.find(c=>c.id===coursId):null;
    if (coursActuel) document.getElementById('attr-promotion-select').value=coursActuel.promotion;
    else document.getElementById('attr-promotion-select').value='';

    filtrerCoursAttribution(coursId);

    document.getElementById('attr-prof-select').innerHTML='<option value="">— Choisir un professeur —</option>'+
      profs.map(p=>`<option value="${p.id}">${p.nom} ${p.prenom||''}${p.grade?' — '+p.grade:''}</option>`).join('');

    if (professeurId) document.getElementById('attr-prof-select').value=professeurId;

    const prof=professeurId?profs.find(p=>p.id===professeurId):null;
    document.getElementById('modal-attribution-titre').textContent=prof?`Attribuer un cours à ${prof.nom}`:'Attribuer un professeur';

    document.getElementById('modal-attribution')?.classList.add('active');
  } catch (err) { console.error(err); afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

function fermerModalAttribution() { document.getElementById('modal-attribution')?.classList.remove('active'); }

async function sauvegarderAttribution() {
  const coursId=document.getElementById('attr-cours-select').value;
  const professeur_id=document.getElementById('attr-prof-select').value;
  if (!coursId) { afficherToast('⚠️ Choisissez un cours.', 'erreur'); return; }
  if (!professeur_id) { afficherToast('⚠️ Choisissez un professeur.', 'erreur'); return; }
  try {
    const r=await fetchAdmin(`${BASE_URL}/api/programme/${coursId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({professeur_id})});
    const d=await r.json();
    if (!r.ok) { afficherToast('❌ '+d.erreur, 'erreur'); return; }
    afficherToast('✅ Professeur attribué !'); fermerModalAttribution(); chargerAttributions();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

// =====================
// JOURNAL D'AUDIT
// =====================
function libelleActionAudit(methode, chemin) {
  const libelles = {
    'POST /api/etudiants': 'Création étudiant',
    'PUT /api/etudiants': 'Modification étudiant',
    'DELETE /api/etudiants': 'Suppression étudiant',
    'POST /api/notes': 'Ajout de note',
    'PUT /api/notes': 'Modification de note',
    'DELETE /api/notes': 'Suppression de note',
    'POST /api/horaires': 'Ajout d\'horaire',
    'PUT /api/horaires': 'Modification d\'horaire',
    'DELETE /api/horaires': 'Suppression d\'horaire',
    'PATCH /api/horaires': 'Attribution professeur',
    'POST /api/professeurs': 'Ajout professeur',
    'PUT /api/professeurs': 'Modification professeur',
    'DELETE /api/professeurs': 'Suppression professeur',
    'POST /api/annonces': 'Publication annonce',
    'PUT /api/annonces': 'Modification annonce',
    'DELETE /api/annonces': 'Suppression annonce',
    'PATCH /api/annonces': 'Bascule visibilité annonce',
    'POST /api/programme': 'Ajout cours',
    'PUT /api/programme': 'Modification cours',
    'DELETE /api/programme': 'Suppression cours',
    'PUT /api/preinscription': 'Décision pré-inscription',
    'POST /api/paiements': 'Enregistrement paiement',
    'DELETE /api/paiements': 'Suppression paiement',
  };
  const cle = Object.keys(libelles).find(k => `${methode} ${chemin}`.startsWith(k));
  return libelles[cle] || `${methode} ${chemin}`;
}

async function chargerAuditLog() {
  const tbody = document.getElementById('admin-audit-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="admin-vide">Chargement...</td></tr>`;
  try {
    const r = await fetchAdmin(`${BASE_URL}/api/audit-log`);
    const lignes = await r.json();
    tbody.innerHTML = lignes.length === 0
      ? `<tr><td colspan="4" class="admin-vide">Aucune action enregistrée pour le moment.</td></tr>`
      : lignes.map(l => `<tr>
          <td>${new Date(l.date_action).toLocaleString('fr-FR')}</td>
          <td>${l.admin_user}</td>
          <td>${libelleActionAudit(l.methode, l.chemin)}</td>
          <td><span class="badge reussi">${l.statut_http}</span></td>
        </tr>`).join('');
  } catch { tbody.innerHTML = `<tr><td colspan="4" class="admin-vide">⚠️ Impossible de charger le journal.</td></tr>`; }
}

// =====================
// INITIALISATION GLOBALE
// =====================
document.addEventListener('DOMContentLoaded', async () => {
  verifierSessionAdmin();

  const champPass=document.getElementById('admin-pass');
  if (champPass) champPass.addEventListener('keypress',(e)=>{ if(e.key==='Enter') connexionAdmin(); });

  // Alimente tous les menus d'années depuis la base avant les chargements.
  await chargerAnnees();

  if (document.getElementById('cpt-etudiants')) chargerStats();

  if (document.getElementById('admin-notes')) {
    chargerNotes();
    chargerResumeBulletins();

    const rch=document.getElementById('recherche-notes');
    if (rch) rch.addEventListener('input',e=>{
      const t=e.target.value.toLowerCase();
      afficherTableauNotes(notesAdmin.filter(n=>`${n.nom_etudiant} ${n.prenom_etudiant}`.toLowerCase().includes(t)||n.matiere.toLowerCase().includes(t)||n.etudiant_id.toLowerCase().includes(t)));
    });

    const rchBulletins=document.getElementById('recherche-bulletins');
    if (rchBulletins) rchBulletins.addEventListener('input',e=>{
      const t=e.target.value.toLowerCase();
      afficherTableauBulletins(resumeBulletinsAdmin.filter(e2=>`${e2.nom} ${e2.prenom}`.toLowerCase().includes(t)||e2.etudiant_id.toLowerCase().includes(t)||(e2.filiere||'').toLowerCase().includes(t)||(e2.faculte||'').toLowerCase().includes(t)||(e2.promotion||'').toLowerCase().includes(t)));
    });
  }

  if (document.getElementById('admin-horaires')) {
    chargerHoraires();
    ['filtre-annee','filtre-niveau','filtre-jour'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('change',chargerHoraires);});
  }

  if (document.getElementById('admin-programme')) {
    chargerProgramme(); // affiche le message de sélection par défaut ; les filtres sont câblés via onchange dans le HTML
  }

  if (document.getElementById('admin-annonces')) {
    chargerAnnonces();
    const ts=document.getElementById('annonce-type'); if(ts) ts.addEventListener('change',gererAffichageChampImage);
    const ft=document.getElementById('filtre-type-annonce'); if(ft) ft.addEventListener('change',chargerAnnonces);
  }

  if (document.getElementById('admin-preinscriptions')) {
    chargerPreinscriptions();
    const rp=document.getElementById('recherche-preinscriptions'); if(rp) rp.addEventListener('input',appliquerFiltresPreinscriptions);
    const sp=document.getElementById('filtre-statut-preinscription'); if(sp) sp.addEventListener('change',appliquerFiltresPreinscriptions);
  }

  if (document.getElementById('admin-inscrits')) {
    chargerInscrits();
    const ri=document.getElementById('recherche-inscrits'); if(ri) ri.addEventListener('input',chargerInscrits);
    ['filtre-inscrits-faculte','filtre-inscrits-niveau','filtre-inscrits-annee'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('change',chargerInscrits);});
  }

  if (document.getElementById('admin-attributions')) chargerAttributions();
  if (document.getElementById('admin-audit')) chargerAuditLog();
});
