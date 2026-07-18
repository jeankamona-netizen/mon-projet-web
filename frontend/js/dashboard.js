// =====================
// DASHBOARD ÉTUDIANT — connecté à MySQL via CONFIG.API_URL
// =====================


function getEtudiantConnecte() {
  const data = sessionStorage.getItem('etudiant');
  if (!data) { window.location.href = 'login.html'; return null; }
  return JSON.parse(data);
}

function deconnecter() {
  sessionStorage.removeItem('etudiant');
  window.location.href = 'login.html';
}

// =====================
// INITIALISATION
// =====================
document.addEventListener('DOMContentLoaded', async () => {
  const etudiant = getEtudiantConnecte();
  if (!etudiant) return;

  afficherProfilHeader(etudiant);
  afficherProfilSection(etudiant);

  await Promise.all([
    chargerNotesDashboard(etudiant.id),
    chargerHorairesDashboard(etudiant.id),
    chargerProgrammeDashboard(etudiant.id),
    chargerFraisDashboard(etudiant.id),
    chargerAnnoncesDashboard(etudiant.faculte),
    chargerCommuniquesEtudiant()
  ]);

  // Les deux jeux de données (notes + horaires) sont nécessaires à l'analyse IA :
  // on ne la lance qu'une fois les deux chargements terminés.
  genererAnalyseIA();

  mettreAJourNotifications();
  await chargerCursus();
  initialiserNavigation();
  demarrerSynchronisationEnArrierePlan(etudiant.id);

  // Fermer les panneaux déroulants (notifications, menu compte) au clic en dehors.
  document.addEventListener('click', e => {
    const notifWrap = document.querySelector('.dash-notif-wrap');
    const notifPanneau = document.getElementById('notif-panneau');
    if (notifPanneau && notifWrap && !notifWrap.contains(e.target)) notifPanneau.classList.remove('ouvert');

    const menuWrap = document.querySelector('.dash-menu-wrap');
    const menu = document.getElementById('menu-compte');
    if (menu && menuWrap && !menuWrap.contains(e.target)) menu.classList.remove('ouvert');
  });
});

// =====================
// SYNCHRONISATION EN ARRIÈRE-PLAN — pour qu'une note/un versement/un cours
// ajouté côté admin remonte sans que l'étudiant ait à recharger la page.
// Ne relance QUE le rechargement des données (notes, frais, annonces) et le
// nécessaire pour la section actuellement affichée ; ne touche jamais à la
// navigation en cours (ex. semaine choisie dans "Horaires", filtre actif).
// =====================
const INTERVALLE_SYNCHRO_MS = 45000;

async function synchroniserDonneesEnArrierePlan(etudiantId) {
  try {
    const [rNotes, rHoraires, rFrais] = await Promise.all([
      fetch(`${BASE_URL}/api/etudiant/${etudiantId}/notes`),
      fetch(`${BASE_URL}/api/etudiant/${etudiantId}/horaires`),
      fetch(`${BASE_URL}/api/etudiant/${etudiantId}/paiements`),
    ]);
    if (rNotes.ok) notesEtudiant = await rNotes.json();
    if (rHoraires.ok) horairesEtudiant = await rHoraires.json();
    if (rFrais.ok) {
      const d = await rFrais.json();
      paiementsEtudiant = d.paiements || [];
      soldeEtudiant = { montant_attendu: d.montant_attendu, solde: d.solde };
    }
  } catch { return; } // une synchro ratée est silencieuse, ne doit jamais interrompre la session

  // On ne redessine que ce qui est effectivement à l'écran, pour ne jamais
  // interrompre une saisie ou une navigation (semaine, filtre...) en cours.
  const sectionActive = document.querySelector('.dash-section.active')?.id;
  if (sectionActive === 'tableau-de-bord') {
    afficherDernieresNotes();
    afficherStatistiquesNotes();
    afficherCoursAujourdhui();
    genererAnalyseIA();
  } else if (sectionActive === 'mes-notes') {
    const sessionActive = document.querySelector('.filtre-session .filtre-btn.active')?.dataset.session || 'S1';
    afficherNotesTableau(sessionActive);
  } else if (sectionActive === 'frais') {
    afficherFrais();
  }

  mettreAJourNotifications();
}

function demarrerSynchronisationEnArrierePlan(etudiantId) {
  setInterval(() => synchroniserDonneesEnArrierePlan(etudiantId), INTERVALLE_SYNCHRO_MS);
  // Resynchronise immédiatement quand l'étudiant revient sur l'onglet/l'appli —
  // le cas le plus fréquent (il vérifie juste après avoir été prévenu autrement).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') synchroniserDonneesEnArrierePlan(etudiantId);
  });
}

// =====================
// PROFIL HEADER
// =====================
function afficherProfilHeader(e) {
  const nomComplet = `${e.prenom} ${e.nom}`;
  const initiales  = `${e.prenom?.[0]||''}${e.nom?.[0]||''}`.toUpperCase();

  const elNom = document.getElementById('etudiant-nom');
  if (elNom) elNom.textContent = nomComplet;

  const elId = document.getElementById('etudiant-id');
  if (elId) elId.textContent = e.id;

  const elPromo = document.getElementById('etudiant-promo');
  if (elPromo) elPromo.textContent = `${e.niveau||'L1'} — ${e.promotion||''}`;

  const elAnnee = document.getElementById('etudiant-annee');
  if (elAnnee) elAnnee.textContent = e.annee_academique || '—';

  const elAccueil = document.getElementById('etudiant-prenom-accueil');
  if (elAccueil) elAccueil.textContent = e.prenom || '';

  document.querySelectorAll('#avatar-header, #avatar-sidebar').forEach(el => {
    if (el) el.textContent = initiales;
  });
}

function formaterDateAffichage(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
}

const LIBELLES_STATUT = { actif: 'Inscrit', diplome: 'Diplômé', abandon: 'Abandon' };

function afficherProfilSection(e) {
  const champs = {
    'profil-id':          e.id,
    'profil-nom':         `${e.prenom} ${e.postnom||''} ${e.nom}`.trim(),
    'profil-ddn':         formaterDateAffichage(e.date_naissance),
    'profil-nationalite': e.nationalite || '—',
    'profil-email':       e.email     || '—',
    'profil-telephone':   e.telephone || '—',
    'profil-adresse':     e.adresse   || '—',
    'profil-faculte':     e.faculte   || '—',
    'profil-filiere':     e.promotion || '—',
    'profil-niveau':      e.niveau    || '—',
    'profil-annee':       e.annee_academique || '—',
    'profil-statut':      LIBELLES_STATUT[e.statut] || e.statut || '—',
  };
  Object.entries(champs).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

// =====================
// ÉDITION DU PROFIL (informations personnelles)
// =====================
function toggleEdit(section) {
  const etudiant = getEtudiantConnecte();
  if (!etudiant) return;

  document.getElementById(`e-nom`).value         = `${etudiant.prenom} ${etudiant.postnom||''} ${etudiant.nom}`.trim();
  document.getElementById(`e-ddn`).value         = etudiant.date_naissance ? etudiant.date_naissance.split('T')[0] : '';
  document.getElementById(`e-nationalite`).value = etudiant.nationalite || '';
  document.getElementById(`e-tel`).value         = etudiant.telephone   || '';
  document.getElementById(`e-email`).value       = etudiant.email       || '';
  document.getElementById(`e-adresse`).value     = etudiant.adresse     || '';

  document.getElementById(`view-${section}`).style.display = 'none';
  document.getElementById(`edit-${section}`).style.display = 'block';
}

function annulerEdit(section) {
  document.getElementById(`view-${section}`).style.display = 'block';
  document.getElementById(`edit-${section}`).style.display = 'none';
}

// « Nom complet » est un seul champ dans le formulaire : premier mot =
// prénom, dernier mot = nom, mots du milieu (s'il y en a) = postnom.
function decouperNomComplet(valeur) {
  const mots = valeur.trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return null;
  return {
    prenom: mots[0],
    nom: mots[mots.length - 1],
    postnom: mots.length > 2 ? mots.slice(1, -1).join(' ') : ''
  };
}

async function sauvegarder(section) {
  const etudiant = getEtudiantConnecte();
  if (!etudiant) return;

  const identite = decouperNomComplet(document.getElementById('e-nom')?.value || '');
  if (!identite) {
    afficherToast('⚠️ Entrez au moins un prénom et un nom.', 'erreur');
    return;
  }

  const corps = {
    ...identite,
    date_naissance: document.getElementById('e-ddn')?.value || null,
    nationalite: document.getElementById('e-nationalite')?.value.trim() || null,
    telephone: document.getElementById('e-tel')?.value.trim() || null,
    email: document.getElementById('e-email')?.value.trim() || null,
    adresse: document.getElementById('e-adresse')?.value.trim() || null,
  };

  try {
    const r = await fetch(`${BASE_URL}/api/auth/etudiant/${etudiant.id}/profil`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + d.erreur, 'erreur'); return; }

    sessionStorage.setItem('etudiant', JSON.stringify({ ...etudiant, ...d.etudiant }));
    afficherProfilHeader(d.etudiant);
    afficherProfilSection(d.etudiant);
    afficherToast('✅ Profil mis à jour avec succès !');
    annulerEdit(section);
  } catch {
    afficherToast('⚠️ Impossible de contacter le serveur.', 'erreur');
  }
}

// =====================
// NOTES
// =====================
let notesEtudiant = [];
// Cursus (niveau + année) actuellement consulté. null = tout afficher.
// Par défaut on scope au cursus courant de l'étudiant (voir chargerCursus).
let cursusActif = null;

function notesDuCursusActif() {
  if (!cursusActif) return notesEtudiant;
  return notesEtudiant.filter(n => n.niveau === cursusActif.niveau && n.annee_academique === cursusActif.annee_academique);
}

async function chargerNotesDashboard(id) {
  try {
    const r = await fetch(`${BASE_URL}/api/etudiant/${id}/notes`);
    if (!r.ok) throw new Error();
    notesEtudiant = await r.json();
    // On respecte le semestre déjà sélectionné (utile en cas de retour sur
    // cette page après avoir choisi Semestre 2, par exemple).
    const sessionActive = document.querySelector('.filtre-session .filtre-btn.active')?.dataset.session || 'S1';
    afficherNotesTableau(sessionActive);
    afficherDernieresNotes();
    afficherStatistiquesNotes();
    mettreAJourNotifications();
  } catch {
    const tbody = document.getElementById('notes-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#999;padding:20px">⚠️ Impossible de charger les notes. Vérifiez le backend.</td></tr>`;
  }
}

function badgeStatutNote(note) {
  return note === null
    ? '<span class="badge attente">En attente</span>'
    : note >= 10
      ? '<span class="badge reussi">Réussi</span>'
      : '<span class="badge echec">Échec</span>';
}

function afficherNotesTableau(session = '') {
  const tbody = document.getElementById('notes-body');
  if (!tbody) return;
  const base = notesDuCursusActif();
  const liste = session ? base.filter(n => n.session === session) : base;

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#999;padding:20px">Aucune note disponible${session?' pour ce semestre':''}.</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map(n => `<tr>
      <td>${n.code}</td>
      <td>${n.matiere}</td>
      <td>${n.credits}</td>
      <td>${n.note_cc ?? '—'}</td>
      <td>${n.note_examen ?? '—'}</td>
      <td>${n.note !== null ? n.note+'/20' : '—'}</td>
      <td>${n.session === 'S1' ? 'Semestre 1' : 'Semestre 2'}</td>
      <td>${badgeStatutNote(n.note)}</td>
    </tr>`).join('');
}

function afficherDernieresNotes() {
  const tbody = document.getElementById('dernieres-notes-body');
  if (!tbody) return;
  // "Dernières" = les notes réellement saisies (pas les cours suivis sans
  // note), triées par date de saisie/modification réelle (modifie_le) — pas
  // par code de cours, qui n'a aucun rapport avec la récence.
  const liste = notesDuCursusActif()
    .filter(n => n.note_cc !== null || n.note_examen !== null || n.note !== null)
    .sort((a, b) => new Date(b.modifie_le) - new Date(a.modifie_le))
    .slice(0, 4);

  tbody.innerHTML = liste.length === 0
    ? `<tr><td colspan="3" style="text-align:center;color:#999;padding:20px">Aucune note disponible.</td></tr>`
    : liste.map(n => `<tr>
        <td>${n.matiere}</td>
        <td>${n.note !== null ? n.note+'/20' : '—'}</td>
        <td>${badgeStatutNote(n.note)}</td>
      </tr>`).join('');
}

const LIBELLES_MENTION = [
  { min: 16, texte: 'Excellence' },
  { min: 14, texte: 'Bien' },
  { min: 12, texte: 'Assez bien' },
  { min: 10, texte: 'Passable' },
  { min: 0,  texte: 'Insuffisant' },
];

function afficherStatistiquesNotes() {
  // Les notes viennent de colonnes MySQL DECIMAL, renvoyées en chaînes de
  // caractères par l'API : Number() évite une concaténation de chaînes au
  // lieu d'une addition numérique dans les reduce ci-dessous.
  const notesCursus = notesDuCursusActif();
  const nvn = notesCursus.filter(n => n.note !== null);
  const moy = nvn.length ? nvn.reduce((s,n) => s+Number(n.note), 0) / nvn.length : 0;
  const ok  = nvn.filter(n => n.note >= 10).length;
  const enAttente = notesCursus.filter(n => n.note === null).length;

  const champs = {
    'stat-moyenne': nvn.length ? moy.toFixed(1) : '—',
    'stat-cours':   notesCursus.length,
    'stat-reussis': `${ok}/${nvn.length}`,
    'stat-attente': enAttente,
  };
  Object.entries(champs).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });

  // Résumé du semestre actuellement sélectionné (section "Mes notes") —
  // chaque semestre a sa propre moyenne, ses propres crédits validés et sa
  // propre mention, distincts l'un de l'autre.
  const sessionActive = document.querySelector('.filtre-session .filtre-btn.active')?.dataset.session || 'S1';
  const notesSession = notesCursus.filter(n => n.session === sessionActive);
  const notesSessionNotees = notesSession.filter(n => n.note !== null);
  const moySession = notesSessionNotees.length ? notesSessionNotees.reduce((s,n) => s+Number(n.note), 0) / notesSessionNotees.length : 0;
  const creditsValides = notesSession.filter(n => n.note !== null && n.note >= 10).reduce((s,n) => s+(n.credits||0), 0);
  const creditsTotal   = notesSession.reduce((s,n) => s+(n.credits||0), 0);
  const mention = notesSessionNotees.length ? LIBELLES_MENTION.find(m => moySession >= m.min).texte : '—';

  document.querySelectorAll('#resume-session-label, #resume-session-label-2').forEach(el => { el.textContent = sessionActive; });
  const resume = {
    'resume-moyenne': notesSessionNotees.length ? `${moySession.toFixed(1)} / 20` : '—',
    'resume-credits': `${creditsValides} / ${creditsTotal}`,
    'resume-mention': mention,
  };
  Object.entries(resume).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
}

function filtrerSession(session, btn) {
  document.querySelectorAll('.filtre-session .filtre-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  afficherNotesTableau(session);
  // La moyenne, les crédits validés et la mention sont propres à chaque semestre.
  afficherStatistiquesNotes();
}

// =====================
// HORAIRES
// =====================
let horairesEtudiant = [];
const ORDRE_JOURS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];

// Filtre les horaires sur l'année du cursus consulté (voir cursusActif).
function horairesDuCursus() {
  const annee = cursusActif?.annee_academique;
  return annee ? horairesEtudiant.filter(h => h.annee_academique === annee) : horairesEtudiant;
}

async function chargerHorairesDashboard(id) {
  semaineHorairesDecalage = 0; // cliquer sur « Horaires » ramène toujours à la semaine en cours
  try {
    const r = await fetch(`${BASE_URL}/api/etudiant/${id}/horaires`);
    if (!r.ok) throw new Error();
    horairesEtudiant = await r.json();
    afficherHoraires();
    afficherCoursAujourdhui();
    mettreAJourNotifications();
  } catch {
    const conteneur = document.getElementById('horaires-calendrier');
    if (conteneur) conteneur.innerHTML = '<p style="color:#999;font-size:13px;padding:12px">⚠️ Impossible de charger les horaires.</p>';
  }
}

// Toutes les dates sont ancrées en UTC-minuit pour rester cohérentes avec
// les colonnes DATE MySQL (sérialisées en UTC) et éviter tout décalage
// d'un jour selon le fuseau horaire du navigateur.
function aujourdhuiUTC() {
  const auj = new Date();
  return new Date(Date.UTC(auj.getFullYear(), auj.getMonth(), auj.getDate()));
}

function lundiSemaine(decalageSemaines = 0) {
  const d = aujourdhuiUTC();
  const jourISO = d.getUTCDay() || 7; // 1 = lundi ... 7 = dimanche
  d.setUTCDate(d.getUTCDate() - (jourISO - 1) + decalageSemaines * 7);
  return d;
}

function memeJourUTC(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

// Décalage (en semaines) par rapport à la semaine calendaire réelle en
// cours — indépendant des données : la semaine affichée par défaut est
// toujours celle d'aujourd'hui (date système), même sans aucun cours
// programmé cette semaine-là. Remis à 0 à chaque ouverture de la section
// (voir chargerHorairesDashboard) ; les flèches le font varier ensuite.
let semaineHorairesDecalage = 0;

function changerSemaineHoraires(delta) {
  semaineHorairesDecalage += delta;
  afficherHoraires();
}

// Calendrier hebdomadaire (Lundi → Vendredi) façon agenda, naviguable
// semaine par semaine : une colonne par jour avec sa date réelle affichée
// une seule fois en en-tête, l'heure de chaque créneau réaffichée dans sa
// propre bande bleue au-dessus de ses informations. Un cours est rattaché
// à une colonne par correspondance exacte de date (date_debut), pas par le
// simple libellé du jour.
function afficherHoraires() {
  const conteneur = document.getElementById('horaires-calendrier');
  const labelSemaine = document.getElementById('horaires-semaine-label');
  if (!conteneur) return;
  const liste = horairesDuCursus();

  // Reflète toujours le cursus propre à l'étudiant (niveau + promotion +
  // année consultés), jamais le libellé "promotion" d'un cours particulier
  // (ex. un cours d'ensemble affiche "L1: INFO, ECO, THEO, SCP", ce qui ne
  // décrit pas l'étudiant lui-même).
  const label = document.getElementById('horaires-promo-label');
  if (label) {
    const etu = getEtudiantConnecte();
    const niveau = cursusActif?.niveau || etu?.niveau || '';
    const annee = cursusActif?.annee_academique || etu?.annee_academique || '';
    label.textContent = `${niveau} ${etu?.promotion || ''}`.trim() + (annee ? ` — ${annee}` : '');
  }

  const lundi = lundiSemaine(semaineHorairesDecalage);
  const vendredi = new Date(lundi);
  vendredi.setUTCDate(lundi.getUTCDate() + 4);
  if (labelSemaine) {
    labelSemaine.textContent = `${formaterDateAffichage(lundi.toISOString())} – ${formaterDateAffichage(vendredi.toISOString())}`;
  }

  const auj = aujourdhuiUTC();

  conteneur.innerHTML = ORDRE_JOURS.map((jour, i) => {
    const dateColonne = new Date(lundi);
    dateColonne.setUTCDate(lundi.getUTCDate() + i);
    const coursDuJour = liste
      .filter(h => h.date_debut && memeJourUTC(new Date(h.date_debut), dateColonne))
      .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));

    return `
      <div class="cal-jour${memeJourUTC(dateColonne, auj) ? ' aujourdhui' : ''}">
        <div class="cal-jour-entete">
          <span class="cal-jour-nom">${jour}</span>
          <span class="cal-jour-date">${formaterDateAffichage(dateColonne.toISOString())}</span>
        </div>
        <div class="cal-jour-corps">
          ${coursDuJour.length === 0
            ? '<p class="cal-jour-vide">Pas de cours</p>'
            : coursDuJour.map(h => `
                <div class="cal-evenement">
                  <div class="cal-evenement-entete">
                    <span>${h.heure_debut.slice(0,5)}-${h.heure_fin.slice(0,5)}</span>
                  </div>
                  <div class="cal-evenement-corps">
                    <span class="cours-nom">${h.cours}</span>
                    <span class="cours-info">${h.professeur ? (h.grade ? h.grade + ' ' : '') + h.professeur : 'Professeur non attribué'}</span>
                    <span class="cours-info">${h.salle}</span>
                  </div>
                </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

function afficherCoursAujourdhui() {
  const c = document.getElementById('cours-aujourdhui');
  if (!c) return;
  // Cohérent avec le calendrier hebdomadaire : on rattache un cours à
  // aujourd'hui par correspondance exacte de date (date_debut), pas par le
  // simple libellé du jour. Sinon un cours programmé un autre vendredi
  // s'afficherait ici alors qu'il est absent de la grille de la semaine.
  const auj = aujourdhuiUTC();
  const cours = horairesDuCursus()
    .filter(h => h.date_debut && memeJourUTC(new Date(h.date_debut), auj))
    .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));

  c.innerHTML = cours.length === 0
    ? '<p style="color:#999;font-size:13px">Pas de cours aujourd\'hui.</p>'
    : cours.map(h => `
        <div class="cours-item">
          <div class="cours-heure"><span>${h.heure_debut.slice(0,5)}-${h.heure_fin.slice(0,5)}</span></div>
          <div class="cours-detail">
            <span class="cours-nom">${h.cours}</span>
            <span class="cours-info">${h.professeur ? (h.grade ? h.grade + ' ' : '') + h.professeur : 'Professeur non attribué'} · ${h.salle}</span>
          </div>
        </div>`).join('');
}

// =====================
// PROGRAMME ANNUEL
// =====================
let programmeEtudiant = [];

function programmeDuCursus() {
  const annee = cursusActif?.annee_academique;
  return annee ? programmeEtudiant.filter(c => c.annee_academique === annee) : programmeEtudiant;
}

async function chargerProgrammeDashboard(id) {
  try {
    const r = await fetch(`${BASE_URL}/api/etudiant/${id}/programme`);
    if (!r.ok) throw new Error();
    programmeEtudiant = await r.json();
    afficherProgramme();
  } catch {
    const c1 = document.getElementById('programme-s1-liste');
    const c2 = document.getElementById('programme-s2-liste');
    if (c1) c1.innerHTML = `<p style="color:#999;font-size:13px">⚠️ Erreur de chargement.</p>`;
    if (c2) c2.innerHTML = '';
  }
}

function afficherProgramme() {
  const c1 = document.getElementById('programme-s1-liste');
  const c2 = document.getElementById('programme-s2-liste');
  if (!c1||!c2) return;

  const cours = programmeDuCursus();
  // Reflète le cursus de l'étudiant lui-même, pas le libellé "promotion" du
  // premier cours de la liste (qui peut être un cours d'ensemble avec un
  // libellé du type "L1: INFO, ECO, THEO, SCP").
  const label = document.getElementById('programme-label');
  if (label) {
    const etu = getEtudiantConnecte();
    const niveau = cursusActif?.niveau || etu?.niveau || '';
    const annee = cursusActif?.annee_academique || etu?.annee_academique || '';
    label.textContent = `Cours de l'année — ${niveau} ${etu?.promotion || ''}`.trim() + (annee ? ` (${annee})` : '');
  }

  const s1 = cours.filter(c => c.semestre === 'S1');
  const s2 = cours.filter(c => c.semestre === 'S2');

  const heuresUE = (v) => v == null ? '—' : `${v}h`;
  const items = liste => liste.length === 0
    ? `<p style="color:#999;font-size:13px;padding:8px 0">Aucun cours.</p>`
    : liste.map(c => `
        <div class="prog-item">
          <span class="prog-code">${c.code}</span>
          <div class="prog-nom">
            <span class="prog-nom-titre">${c.nom}</span>
            <span class="prog-heures">CMI ${heuresUE(c.cmi)} · TD ${heuresUE(c.td)} · TP ${heuresUE(c.tp)}</span>
          </div>
          <span class="prog-credits">${c.credits} crédits</span>
        </div>`).join('') + `<div class="prog-total">Total : ${liste.reduce((s,c)=>s+c.credits,0)} crédits</div>`;

  c1.innerHTML = items(s1);
  c2.innerHTML = items(s2);
}

// =====================
// MES FRAIS
// =====================
let paiementsEtudiant = [];
let soldeEtudiant = { montant_attendu: null, solde: null };

async function chargerFraisDashboard(id) {
  const tbody = document.getElementById('frais-body');
  if (!tbody) return;
  try {
    const r = await fetch(`${BASE_URL}/api/etudiant/${id}/paiements`);
    if (!r.ok) throw new Error();
    const { paiements, montant_attendu, solde } = await r.json();
    paiementsEtudiant = paiements;
    soldeEtudiant = { montant_attendu, solde };
    afficherFrais();
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">⚠️ Impossible de charger vos frais.</td></tr>';
    const totalEl = document.getElementById('frais-total');
    if (totalEl) totalEl.textContent = '—';
    const soldeEl = document.getElementById('frais-solde');
    if (soldeEl) soldeEl.textContent = '—';
  }
}

function afficherFrais() {
  const tbody = document.getElementById('frais-body');
  const totalEl = document.getElementById('frais-total');
  const soldeEl = document.getElementById('frais-solde');
  if (!tbody) return;
  const annee = cursusActif?.annee_academique;
  const liste = annee ? paiementsEtudiant.filter(p => p.annee_academique === annee) : paiementsEtudiant;
  const total = liste.reduce((s, p) => s + Number(p.montant), 0);

  if (totalEl) totalEl.textContent = `${total.toFixed(2)} $`;
  if (soldeEl) {
    soldeEl.textContent = soldeEtudiant.solde === null ? 'Non défini' : `${Number(soldeEtudiant.solde).toFixed(2)} $`;
  }
  tbody.innerHTML = liste.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">Aucun versement pour ce cursus.</td></tr>'
    : liste.map(p => `<tr>
        <td>${formaterDateAffichage(p.date_paiement)}</td>
        <td>${Number(p.montant).toFixed(2)} $</td>
        <td>${p.rubrique || '—'}</td>
        <td>${p.reference || '—'}</td>
        <td>${p.mode_paiement || '—'}</td>
      </tr>`).join('');
}

// =====================
// PRÉSENCES
// =====================
const LIBELLES_STATUT_PRESENCE = { present: '✅ Présent', retard: '🕒 Retard', absent: '❌ Absent' };

async function chargerPresencesDashboard(id) {
  const resumeBody = document.getElementById('presences-resume-body');
  const histoBody = document.getElementById('presences-historique-body');
  if (!resumeBody || !histoBody) return;
  resumeBody.innerHTML = '<tr><td colspan="5" class="admin-vide">Chargement...</td></tr>';
  histoBody.innerHTML = '<tr><td colspan="4" class="admin-vide">Chargement...</td></tr>';
  try {
    // Scopé sur l'année du cursus consulté (voir cursusActif) : un étudiant
    // promu ne doit pas voir son taux d'assiduité mélanger plusieurs années.
    const annee = cursusActif?.annee_academique;
    const r = await fetch(`${BASE_URL}/api/etudiant/${id}/presences${annee ? '?annee=' + encodeURIComponent(annee) : ''}`);
    if (!r.ok) throw new Error();
    const parCours = await r.json();

    resumeBody.innerHTML = parCours.length === 0
      ? '<tr><td colspan="5" class="admin-vide">Aucune présence enregistrée pour l\'instant.</td></tr>'
      : parCours.map(c => `
        <tr>
          <td><strong>${c.cours}</strong> <span style="color:#999">(${c.code})</span></td>
          <td>${c.present}</td>
          <td>${c.retard}</td>
          <td>${c.absent}</td>
          <td><strong style="color:${c.taux_presence >= 75 ? 'var(--vert)' : 'var(--rouge,#c0392b)'}">${c.taux_presence}%</strong></td>
        </tr>`).join('');

    const seances = parCours.flatMap(c => c.seances.map(s => ({ ...s, cours: c.cours, code: c.code })))
      .sort((a, b) => new Date(b.date_seance) - new Date(a.date_seance));
    histoBody.innerHTML = seances.length === 0
      ? '<tr><td colspan="4" class="admin-vide">Aucune séance enregistrée pour l\'instant.</td></tr>'
      : seances.map(s => `
        <tr>
          <td>${formaterDateAffichage(s.date_seance)}</td>
          <td>${s.cours} <span style="color:#999">(${s.code})</span></td>
          <td>${s.heure_debut?.slice(0,5)}-${s.heure_fin?.slice(0,5)}</td>
          <td>${LIBELLES_STATUT_PRESENCE[s.statut] || s.statut}</td>
        </tr>`).join('');
  } catch {
    resumeBody.innerHTML = '<tr><td colspan="5" class="admin-vide">⚠️ Impossible de charger vos présences.</td></tr>';
    histoBody.innerHTML = '<tr><td colspan="4" class="admin-vide">⚠️ Erreur.</td></tr>';
  }
}

// =====================
// ANNONCES
// =====================
let annoncesEtudiant = [];

// Annonces de l'année du cursus consulté : on garde celles dont la date tombe
// dans l'année académique sélectionnée (ex. "2026-2027" → 2026 ou 2027).
function annoncesDuCursus() {
  const annee = cursusActif?.annee_academique;
  if (!annee) return annoncesEtudiant;
  const [y1, y2] = annee.split('-').map(Number);
  return annoncesEtudiant.filter(a => {
    const y = new Date(a.date_annonce).getFullYear();
    return y === y1 || y === y2;
  });
}

async function chargerAnnoncesDashboard(faculte) {
  try {
    const params = new URLSearchParams({ actif: 'true' });
    if (faculte) params.append('faculte', faculte);
    const r = await fetch(`${BASE_URL}/api/annonces?${params}`);
    if (!r.ok) throw new Error();
    // Les communiqués (type='communique') n'apparaissent PAS dans la liste
    // publique des annonces : ils sont réservés à la cloche « Infos ».
    annoncesEtudiant = (await r.json()).filter(a => a.type !== 'communique');
    afficherAnnonces();
    mettreAJourNotifications();
  } catch {
    const conteneur = document.getElementById('annonces-liste');
    if (conteneur) conteneur.innerHTML = '<p class="ia-vide">⚠️ Impossible de charger les annonces.</p>';
  }
}

// Communiqués de l'administration destinés aux étudiants → affichés dans la
// cloche sous la catégorie « Infos » (ne dépendent pas du cursus consulté).
let communiquesEtudiant = [];

async function chargerCommuniquesEtudiant() {
  try {
    const r = await fetch(`${BASE_URL}/api/annonces?type=communique&role=etudiant&actif=true`);
    if (!r.ok) throw new Error();
    communiquesEtudiant = await r.json();
    mettreAJourNotifications();
    afficherAnnonces();
  } catch { /* silencieux : la cloche reste fonctionnelle sans communiqués */ }
}

// Carte « communiqué » : mise en avant (accent jaune + libellé) et affichée en
// tête de la page Annonces tant que l'admin ne l'a pas désactivée (actif=0).
function carteCommunique(c) {
  return `
    <div class="ia-alerte" style="border-left:4px solid var(--jaune);background:rgba(245,181,32,0.08)">
      <span class="ia-alerte-icon">📣</span>
      <span class="ia-alerte-texte">
        <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--jaune);text-transform:uppercase">Communiqué de l'administration</span><br>
        <b>${c.titre}</b><br>${c.description || ''}
      </span>
    </div>`;
}

function afficherAnnonces() {
  const conteneur = document.getElementById('annonces-liste');
  if (!conteneur) return;
  // Les communiqués restent affichés (indépendamment du cursus) jusqu'à leur
  // désactivation par l'admin ; les actualités/événements suivent le cursus.
  const communiques = (communiquesEtudiant || []).map(carteCommunique).join('');
  const liste = annoncesDuCursus();
  const actualites = liste.map(a => `
        <div class="ia-alerte ok">
          <span class="ia-alerte-icon">${a.icone || '📢'}</span>
          <span class="ia-alerte-texte"><b>${a.titre}</b><br>${a.description}${a.cible_faculte ? ` <em style="color:#999">(${a.cible_faculte})</em>` : ''}</span>
        </div>`).join('');
  conteneur.innerHTML = (communiques + actualites) || '<p class="ia-vide">Aucune annonce pour le moment.</p>';
}

// =====================
// NOTIFICATIONS (cloche) — nouvelles infos non encore consultées
// L'état « vu » est mémorisé par étudiant dans localStorage : une info compte
// comme nouvelle tant que l'étudiant n'a pas ouvert la cloche depuis sa
// publication. Couvre : notes publiées, cours programmés, annonces, événements.
// =====================
function cleNotifications() {
  const e = getEtudiantConnecte();
  return e ? `notif_vus_${e.id}` : null;
}

function lireNotificationsVues() {
  const base = { note: [], horaire: [], annonce: [], evenement: [], info: [], paiement: [] };
  const cle = cleNotifications();
  if (!cle) return base;
  try { return { ...base, ...JSON.parse(localStorage.getItem(cle) || '{}') }; }
  catch { return base; }
}

// Section du dashboard vers laquelle mène chaque type de notification.
const NOTIF_SECTION = { note: 'mes-notes', horaire: 'horaires', annonce: 'annonces', evenement: 'annonces', info: 'annonces', paiement: 'frais' };

function construireNotifications() {
  const items = [];
  // Depuis que /api/etudiant/:id/notes renvoie une ligne par cours SUIVI (et
  // non plus seulement par note déjà saisie), un cours tout juste inscrit et
  // pas encore noté ne doit pas générer de fausse notification "note en
  // cours de saisie" — seules les notes où au moins une valeur existe comptent.
  (notesEtudiant || []).filter(n => n.note_cc !== null || n.note_examen !== null || n.note !== null).forEach(n => items.push({
    // L'id inclut les valeurs de la note (pas seulement n.id) : le prof/admin
    // modifie la note en place (même ligne en base), donc si on ne suivait que
    // n.id, une correction de note déjà « vue » ne redeviendrait jamais une
    // notification. En intégrant note_cc/note_examen/note dans la clé, toute
    // modification produit une nouvelle clé et redéclenche la notification.
    categorie: 'note', id: `${n.id}:${n.note_cc}:${n.note_examen}:${n.note}`, icone: '📝',
    titre: n.matiere,
    sousTitre: (n.note !== null && n.note !== undefined) ? `Note publiée : ${n.note}/20` : 'Note en cours de saisie'
  }));
  (horairesEtudiant || []).forEach(h => items.push({
    categorie: 'horaire', id: h.id, icone: '📅',
    titre: `Cours programmé : ${h.cours}`,
    sousTitre: `${h.jour} ${h.heure_debut}–${h.heure_fin} · ${h.salle}`
  }));
  (annoncesEtudiant || []).forEach(a => {
    const cat = a.type === 'evenement' ? 'evenement' : 'annonce';
    items.push({
      categorie: cat, id: a.id, icone: a.icone || (cat === 'evenement' ? '🎓' : '📢'),
      titre: a.titre, sousTitre: cat === 'evenement' ? 'Nouvel événement' : 'Nouvelle annonce'
    });
  });
  (communiquesEtudiant || []).forEach(c => items.push({
    categorie: 'info', id: c.id, icone: '📣',
    titre: c.titre, sousTitre: c.description || 'Communiqué de l\'administration'
  }));
  (paiementsEtudiant || []).forEach(p => items.push({
    categorie: 'paiement', id: p.id, icone: '💵',
    titre: 'Versement enregistré',
    sousTitre: `${Number(p.montant).toFixed(2)} $ le ${formaterDateAffichage(p.date_paiement)}`
  }));
  return items;
}

// Clic sur une notification → on ouvre directement la page correspondante.
function ouvrirNotification(section) {
  document.getElementById('notif-panneau')?.classList.remove('ouvert');
  const lien = document.querySelector(`.nav-item[data-section="${section}"]`);
  afficherSectionDashboard(section, lien);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function calculerNotificationsNouvelles() {
  const vus = lireNotificationsVues();
  return construireNotifications().filter(it => !vus[it.categorie].includes(it.id));
}

function mettreAJourNotifications() {
  const nouvelles = calculerNotificationsNouvelles();

  const badge = document.getElementById('notif-badge');
  if (badge) {
    if (nouvelles.length > 0) { badge.textContent = nouvelles.length > 99 ? '99+' : nouvelles.length; badge.style.display = ''; }
    else badge.style.display = 'none';
  }

  const liste = document.getElementById('notif-liste');
  if (liste) {
    liste.innerHTML = nouvelles.length === 0
      ? '<p class="notif-vide">Aucune nouvelle information.</p>'
      : nouvelles.map(it => `
          <div class="notif-item" role="button" tabindex="0" onclick="ouvrirNotification('${NOTIF_SECTION[it.categorie]}')">
            <span class="notif-item-icone">${it.icone}</span>
            <div>
              <span class="notif-item-titre">${it.titre}</span>
              <span class="notif-item-sous">${it.sousTitre}</span>
            </div>
          </div>`).join('');
  }
}

function marquerNotificationsLues() {
  const vus = { note: [], horaire: [], annonce: [], evenement: [], info: [], paiement: [] };
  construireNotifications().forEach(it => vus[it.categorie].push(it.id));
  const cle = cleNotifications();
  if (cle) localStorage.setItem(cle, JSON.stringify(vus));
  const badge = document.getElementById('notif-badge');
  if (badge) badge.style.display = 'none';
}

function basculerNotifications(event) {
  if (event) event.stopPropagation();
  const panneau = document.getElementById('notif-panneau');
  if (!panneau) return;
  const ouvert = panneau.classList.toggle('ouvert');
  // À l'ouverture, on marque tout comme lu (le badge disparaît) — la liste des
  // nouvelles infos reste affichée pour cette consultation.
  if (ouvert) marquerNotificationsLues();
}

// =====================
// MENU COMPTE (hamburger) — consultation du cursus (actuel + précédents)
// =====================
function libelleNiveau(niveau) {
  const map = { 'Pré-U':'Pré-Universitaire', L1:'Licence 1', L2:'Licence 2', L3:'Licence 3', M1:'Master 1', M2:'Master 2', D1:'Doctorat 1', D2:'Doctorat 2' };
  return map[niveau] || niveau || '—';
}

async function chargerCursus() {
  const etudiant = getEtudiantConnecte();
  if (!etudiant) return;
  const prenomEl = document.getElementById('menu-prenom');
  if (prenomEl) prenomEl.textContent = etudiant.prenom || '';

  try {
    const r = await fetch(`${BASE_URL}/api/etudiant/${etudiant.id}/cursus`);
    if (!r.ok) throw new Error();
    const { actuel, periodes } = await r.json();

    // Par défaut, on consulte le cursus courant de l'étudiant.
    cursusActif = { niveau: actuel.niveau, annee_academique: actuel.annee_academique };
    // La zone profil (bleue, à gauche) reflète le cursus courant authoritatif du serveur.
    majProfilCursus(actuel.niveau, actuel.annee_academique);

    const boutonCursus = (niveau, annee, promotion, estActuel) => `
      <button class="menu-cursus-item ${estActuel ? 'actif' : ''}"
              onclick="selectionnerCursus('${niveau}','${annee}')">
        ${libelleNiveau(niveau)} — ${promotion || ''}
        <small>${annee}${estActuel ? ' · en cours' : ''}</small>
      </button>`;

    const conteneurActuel = document.getElementById('menu-cursus-actuel');
    if (conteneurActuel) conteneurActuel.innerHTML = boutonCursus(actuel.niveau, actuel.annee_academique, actuel.promotion, true);

    // Autres cursus = toutes les périodes sauf celle en cours.
    const autres = periodes.filter(p => !(p.niveau === actuel.niveau && p.annee_academique === actuel.annee_academique));
    const conteneurAutres = document.getElementById('menu-cursus-autres');
    const titreAutres = document.getElementById('menu-autres-titre');
    if (autres.length === 0) {
      if (conteneurAutres) conteneurAutres.innerHTML = '';
      if (titreAutres) titreAutres.style.display = 'none';
    } else {
      if (titreAutres) titreAutres.style.display = '';
      if (conteneurAutres) conteneurAutres.innerHTML = autres.map(p =>
        boutonCursus(p.niveau, p.annee_academique, actuel.promotion, false)).join('');
    }

    // Toutes les sections reflètent le cursus courant.
    rafraichirSectionsCursus();
  } catch { /* si le cursus ne charge pas, on garde l'affichage complet */ }
}

// Adapte la zone profil (sidebar, en haut à gauche) au cursus consulté.
function majProfilCursus(niveau, annee_academique) {
  const etu = getEtudiantConnecte();
  const promoEl = document.getElementById('etudiant-promo');
  if (promoEl) promoEl.textContent = `${niveau} — ${etu?.promotion || ''}`;
  const anneeEl = document.getElementById('etudiant-annee');
  if (anneeEl) anneeEl.textContent = annee_academique || '—';
}

// Titre "Mes notes" indiquant l'année du cursus consulté.
function majTitreNotes() {
  const el = document.getElementById('mes-notes-sous-titre');
  if (el) el.textContent = `Résultats académiques — Année ${cursusActif?.annee_academique || '—'}`;
}

// Réaffiche toutes les sections filtrées sur le cursus courant.
function rafraichirSectionsCursus() {
  const sessionActive = document.querySelector('.filtre-session .filtre-btn.active')?.dataset.session || 'S1';
  afficherNotesTableau(sessionActive);
  afficherStatistiquesNotes();
  afficherDernieresNotes();
  afficherHoraires();
  afficherCoursAujourdhui();
  afficherProgramme();
  afficherFrais();
  afficherAnnonces();
  majTitreNotes();
  genererAnalyseIA();
  // Présences : contrairement aux autres sections (filtrées côté client sur
  // des données déjà en cache), l'assiduité est filtrée par année côté
  // serveur — il faut donc une nouvelle requête à chaque changement de cursus.
  const etu = getEtudiantConnecte();
  if (etu) chargerPresencesDashboard(etu.id);
}

function selectionnerCursus(niveau, annee_academique) {
  cursusActif = { niveau, annee_academique };
  semaineHorairesIndex = null; // le cursus change : reprendre la semaine la plus proche d'aujourd'hui
  document.getElementById('menu-compte')?.classList.remove('ouvert');
  // Met en évidence le cursus choisi dans le menu.
  document.querySelectorAll('.menu-cursus-item').forEach(b => b.classList.remove('actif'));
  document.querySelectorAll('.menu-cursus-item').forEach(b => {
    if (b.getAttribute('onclick') === `selectionnerCursus('${niveau}','${annee_academique}')`) b.classList.add('actif');
  });
  // La zone profil (bleue, en haut à gauche) reflète le cursus sélectionné.
  majProfilCursus(niveau, annee_academique);
  // Toutes les sections (notes, horaires, programme, frais, annonces) suivent.
  rafraichirSectionsCursus();
  // Bascule sur "Mes notes".
  const lien = document.querySelector('.nav-item[data-section="mes-notes"]');
  afficherSectionDashboard('mes-notes', lien);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function ouvrirDepuisMenuCompte(section) {
  document.getElementById('menu-compte')?.classList.remove('ouvert');
  const lien = document.querySelector(`.nav-item[data-section="${section}"]`);
  afficherSectionDashboard(section, lien);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function basculerMenuCompte(event) {
  if (event) event.stopPropagation();
  document.getElementById('menu-compte')?.classList.toggle('ouvert');
}

// =====================
// BLOC IA
// =====================
// Compare en UTC (les colonnes DATE MySQL sont sérialisées à minuit UTC)
// pour éviter un décalage d'un jour selon le fuseau horaire du navigateur.
function dateDebutPassee(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const maintenant = new Date();
  const aujourdhuiUTC = Date.UTC(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const dateDebutUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return dateDebutUTC < aujourdhuiUTC;
}

function genererAnalyseIA() {
  const c = document.getElementById('ia-alertes');
  if (!c) return;
  const alertes = [];

  // Scopées au cursus actuellement consulté (voir cursusActif) : un étudiant
  // réinscrit peut avoir plusieurs cursus (ex. L1 et L2), et l'analyse ne
  // doit porter que sur celui affiché, pas mélanger les deux.
  const notesCursus = notesDuCursusActif();
  const horairesCursus = horairesDuCursus();

  notesCursus.filter(n=>n.note!==null&&n.note<10).forEach(n => {
    alertes.push({ type:'danger', icone:'⚠️', texte:`<b>${n.matiere}</b> — ${n.note}/20, en dessous du seuil de réussite (10/20).` });
  });

  // La charge par jour ne doit porter que sur les créneaux à venir : un
  // cours dont la date de début est déjà passée ne doit plus être compté
  // (ex. le 12/07/2026, un créneau du 08/07/2026 est déjà derrière nous).
  const parJour = {};
  horairesCursus.filter(h => !dateDebutPassee(h.date_debut)).forEach(h => { parJour[h.jour]=(parJour[h.jour]||0)+1; });
  Object.entries(parJour).filter(([,nb])=>nb>=2).forEach(([jour,nb]) => {
    alertes.push({ type:'warn', icone:'⏰', texte:`Charge élevée le <b>${jour}</b> : ${nb} cours programmés.` });
  });

  notesCursus.filter(n=>n.note!==null&&n.note>=15).forEach(n => {
    alertes.push({ type:'ok', icone:'📈', texte:`Excellente performance en <b>${n.matiere}</b> : ${n.note}/20 !` });
  });

  if (!alertes.length) {
    c.innerHTML = '<p class="ia-vide">✅ Aucune alerte — tout va bien ce semestre !</p>';
  } else {
    c.innerHTML = alertes.map(a=>`
      <div class="ia-alerte ${a.type==='danger'?'':a.type}">
        <span class="ia-alerte-icon">${a.icone}</span>
        <span class="ia-alerte-texte">${a.texte}</span>
      </div>`).join('');
  }

  const el = document.getElementById('ia-heure');
  if (el) {
    const now = new Date();
    el.textContent = `Mise à jour ${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;
  }
}

// =====================
// NAVIGATION DASHBOARD
// =====================
function initialiserNavigation() {
  document.querySelectorAll('.nav-item').forEach(lien => {
    lien.addEventListener('click', e => {
      e.preventDefault();
      const cible = lien.getAttribute('data-section');
      if (!cible) return;
      afficherSectionDashboard(cible, lien);
    });
  });
}

// Utilisé par les cartes-statistiques cliquables du Tableau de bord pour
// rejoindre une autre section en marquant le bon lien du menu latéral actif.
function allerVersSection(id) {
  const lien = document.querySelector(`.nav-item[data-section="${id}"]`);
  afficherSectionDashboard(id, lien);
}

async function afficherSectionDashboard(id, lien) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const section = document.getElementById(id);
  if (section) section.classList.add('active');
  if (lien) lien.classList.add('active');

  // Les informations affichées sont réactualisées à chaque changement de page,
  // pas seulement au premier chargement du dashboard.
  const etudiant = getEtudiantConnecte();
  if (!etudiant) return;

  if (id === 'tableau-de-bord') {
    await Promise.all([chargerNotesDashboard(etudiant.id), chargerHorairesDashboard(etudiant.id)]);
    genererAnalyseIA();
  }
  if (id === 'mes-notes')  chargerNotesDashboard(etudiant.id);
  if (id === 'horaires')   chargerHorairesDashboard(etudiant.id);
  if (id === 'presences')  chargerPresencesDashboard(etudiant.id);
  if (id === 'programme')  chargerProgrammeDashboard(etudiant.id);
  if (id === 'frais')      chargerFraisDashboard(etudiant.id);
  if (id === 'annonces')   chargerAnnoncesDashboard(etudiant.faculte);
}

// =====================
// CHANGEMENT MOT DE PASSE
// =====================
async function changerMotDePasse() {
  const etudiant = getEtudiantConnecte();
  if (!etudiant) return;

  const actuel  = document.getElementById('mdp-actuel')?.value;
  const nouveau = document.getElementById('mdp-nouveau')?.value;
  const confirm = document.getElementById('mdp-confirm')?.value;
  const erreur  = document.getElementById('mdp-erreur');
  const succes  = document.getElementById('mdp-succes');

  if (erreur) erreur.style.display = 'none';
  if (succes) succes.style.display = 'none';

  if (!actuel || !nouveau || !confirm) {
    if (erreur) { erreur.textContent = '⚠️ Tous les champs sont requis.'; erreur.style.display = 'block'; }
    return;
  }

  if (nouveau !== confirm) {
    if (erreur) { erreur.textContent = '❌ Les deux nouveaux mots de passe ne correspondent pas.'; erreur.style.display = 'block'; }
    return;
  }

  if (nouveau.length < 6) {
    if (erreur) { erreur.textContent = '❌ Le mot de passe doit contenir au moins 6 caractères.'; erreur.style.display = 'block'; }
    return;
  }

  try {
    const r = await fetch(`${BASE_URL}/api/auth/etudiant/${etudiant.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mot_de_passe_actuel: actuel, nouveau_mot_de_passe: nouveau })
    });

    const d = await r.json();
    if (!r.ok) {
      if (erreur) { erreur.textContent = '❌ ' + d.erreur; erreur.style.display = 'block'; }
      return;
    }

    if (succes) { succes.textContent = '✅ Mot de passe changé avec succès !'; succes.style.display = 'block'; }
    ['mdp-actuel','mdp-nouveau','mdp-confirm'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });

  } catch {
    if (erreur) { erreur.textContent = '⚠️ Impossible de contacter le serveur.'; erreur.style.display = 'block'; }
  }
}
