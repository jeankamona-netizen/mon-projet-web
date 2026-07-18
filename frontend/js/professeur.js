// =====================
// ESPACE PROFESSEUR — connexion, horaire, saisie de notes
// =====================

function toggleProfPassword() {
  const input = document.getElementById('prof-pass');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

async function connexionProfesseur() {
  const email       = document.getElementById('prof-email')?.value.trim();
  const mot_de_passe = document.getElementById('prof-pass')?.value.trim();
  const erreurBox   = document.getElementById('prof-erreur');
  if (erreurBox) erreurBox.style.display = 'none';

  if (!email || !mot_de_passe) {
    if (erreurBox) { erreurBox.textContent = '⚠️ Veuillez remplir tous les champs.'; erreurBox.style.display = 'block'; }
    return;
  }

  try {
    const reponse = await fetch(`${BASE_URL}/api/auth/professeur`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, mot_de_passe })
    });
    const donnees = await reponse.json();

    if (!reponse.ok) {
      if (erreurBox) { erreurBox.textContent = '❌ ' + donnees.erreur; erreurBox.style.display = 'block'; }
      return;
    }

    sessionStorage.setItem('professeur', JSON.stringify(donnees.professeur));
    window.location.href = 'professeur-dashboard.html';
  } catch {
    if (erreurBox) { erreurBox.textContent = '⚠️ Impossible de contacter le serveur.'; erreurBox.style.display = 'block'; }
  }
}

function getProfesseurConnecte() {
  const data = sessionStorage.getItem('professeur');
  if (!data) { window.location.href = 'login.html?role=professeur'; return null; }
  return JSON.parse(data);
}

function deconnecterProfesseur() {
  sessionStorage.removeItem('professeur');
  window.location.href = 'login.html?role=professeur';
}

function basculerMenuCompteProf(event) {
  if (event) event.stopPropagation();
  document.getElementById('prof-menu-compte')?.classList.toggle('ouvert');
}

// =====================
// NAVIGATION
// =====================
function afficherSectionProf(id, lien) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  lien?.classList.add('active');

  // Les informations affichées sont réactualisées à chaque changement de page.
  const professeur = getProfesseurConnecte();
  if (!professeur) return;
  if (id === 'prof-horaire')      chargerHoraireProf(professeur.id);
  if (id === 'prof-notes')        chargerCoursProf();
  if (id === 'prof-attributions') chargerAttributionsProf();
  if (id === 'prof-annonces')     chargerAnnoncesProf();
}

// =====================
// MES ATTRIBUTIONS — cours attribués pour l'année courante (lecture seule)
// =====================
async function chargerAttributionsProf() {
  const professeur = getProfesseurConnecte();
  const tbody = document.getElementById('prof-attributions-body');
  if (!professeur || !tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" class="admin-vide">Chargement...</td></tr>';
  try {
    // Année académique courante (définie par l'admin).
    let anneeCourante = '';
    try {
      const ra = await fetch(`${BASE_URL}/api/annees`);
      if (ra.ok) anneeCourante = (await ra.json()).find(a => a.est_courante)?.libelle || '';
    } catch { /* on affichera alors toutes les années */ }

    const r = await fetch(`${BASE_URL}/api/professeur/${professeur.id}/cours`);
    let cours = await r.json();
    if (anneeCourante) cours = cours.filter(c => c.annee_academique === anneeCourante);

    const sous = document.getElementById('prof-attributions-sous-titre');
    if (sous) sous.textContent = anneeCourante
      ? `Cours qui vous sont attribués pour l'année ${anneeCourante}`
      : 'Cours qui vous sont attribués';

    tbody.innerHTML = cours.length === 0
      ? `<tr><td colspan="9" class="admin-vide">Aucun cours ne vous est attribué${anneeCourante ? ' pour ' + anneeCourante : ''}.</td></tr>`
      : cours.map(c => `<tr>
          <td><strong>${c.code || '—'}</strong></td>
          <td>${c.nom || '—'}</td>
          <td>${c.faculte || '—'}</td>
          <td>${c.promotion || '—'}</td>
          <td>${c.semestre || '—'}</td>
          <td>${c.cmi ?? '—'}</td>
          <td>${c.tp ?? '—'}</td>
          <td>${c.td ?? '—'}</td>
          <td>${c.credits ?? '—'}</td>
        </tr>`).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="9" class="admin-vide">⚠️ Impossible de charger vos attributions.</td></tr>'; }
}

// =====================
// PROFIL
// =====================
function afficherProfilProf(p) {
  const initiales = `${p.prenom?.[0] || ''}${p.nom?.[0] || ''}`.toUpperCase() || 'P';
  document.querySelectorAll('#prof-avatar-header, #prof-avatar-sidebar').forEach(el => { if (el) el.textContent = initiales; });

  const nomComplet = `${p.prenom || ''} ${p.nom}`.trim();
  const texte = {
    'prof-nom-sidebar': nomComplet,
    'prof-grade-sidebar': p.grade || 'Professeur',
    'prof-grade': p.grade || '—',
    'prof-nom-complet': nomComplet,
    'prof-email-val': p.email || '—',
    'prof-telephone-val': p.telephone || '—',
    'prof-menu-nom': nomComplet,
    'prof-menu-grade': p.grade || 'Professeur',
  };
  Object.entries(texte).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
}

// =====================
// ÉDITION DU PROFIL (informations personnelles) — même bascule affichage/
// édition que l'espace étudiant.
// =====================
function toggleEditProf() {
  const professeur = getProfesseurConnecte();
  if (!professeur) return;

  document.getElementById('prof-prenom-edit').value = professeur.prenom || '';
  document.getElementById('prof-nom-edit').value = professeur.nom || '';
  document.getElementById('prof-email-edit').value = professeur.email || '';
  document.getElementById('prof-telephone-edit').value = professeur.telephone || '';

  document.getElementById('prof-view-perso').style.display = 'none';
  document.getElementById('prof-edit-perso').style.display = 'flex';
}

function annulerEditProf() {
  document.getElementById('prof-view-perso').style.display = 'block';
  document.getElementById('prof-edit-perso').style.display = 'none';
}

async function modifierProfilProf() {
  const professeur = getProfesseurConnecte();
  if (!professeur) return;

  const nom       = document.getElementById('prof-nom-edit')?.value.trim();
  const prenom    = document.getElementById('prof-prenom-edit')?.value.trim();
  const email     = document.getElementById('prof-email-edit')?.value.trim();
  const telephone = document.getElementById('prof-telephone-edit')?.value.trim();

  if (!nom || !email) {
    afficherToast('⚠️ Le nom et l\'email sont obligatoires.', 'erreur');
    return;
  }

  try {
    const r = await fetch(`${BASE_URL}/api/auth/professeur/${professeur.id}/profil`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, prenom, email, telephone })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + d.erreur, 'erreur'); return; }

    sessionStorage.setItem('professeur', JSON.stringify({ ...professeur, ...d.professeur }));
    afficherProfilProf(d.professeur);
    afficherToast('✅ Profil mis à jour avec succès !');
    annulerEditProf();
  } catch {
    afficherToast('⚠️ Impossible de contacter le serveur.', 'erreur');
  }
}

// =====================
// MON HORAIRE
// =====================
let horaireProfCache = [];

async function chargerHoraireProf(id) {
  semaineHoraireProfDecalage = 0; // cliquer sur « Mon horaire » ramène toujours à la semaine en cours
  const conteneur = document.getElementById('prof-horaire-calendrier');
  if (!conteneur) return;
  try {
    const r = await fetch(`${BASE_URL}/api/professeur/${id}/horaires`);
    if (!r.ok) throw new Error();
    horaireProfCache = await r.json();
    remplirFiltreAnneeHoraireProf();
    filtrerHoraireProf();
  } catch {
    conteneur.innerHTML = '<p style="color:#999;font-size:13px;padding:12px">⚠️ Impossible de charger votre horaire.</p>';
  }
}

function formaterDateHoraire(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
}

// Le sélecteur d'année n'est peuplé qu'avec les années où le professeur a
// effectivement des cours programmés (pas la liste globale des années académiques).
function remplirFiltreAnneeHoraireProf() {
  const sel = document.getElementById('horaire-filtre-annee');
  if (!sel) return;
  const anneeChoisie = sel.value;
  const annees = [...new Set(horaireProfCache.map(h => h.annee_academique))].sort();
  sel.innerHTML = '<option value="">Toutes les années</option>' +
    annees.map(a => `<option value="${a}">${a}</option>`).join('');
  if (annees.includes(anneeChoisie)) sel.value = anneeChoisie;
}

const ORDRE_JOURS_PROF = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];

// Toutes les dates sont ancrées en UTC-minuit pour rester cohérentes avec
// les colonnes DATE MySQL (sérialisées en UTC) et éviter tout décalage
// d'un jour selon le fuseau horaire du navigateur.
function aujourdhuiUTCProf() {
  const auj = new Date();
  return new Date(Date.UTC(auj.getFullYear(), auj.getMonth(), auj.getDate()));
}

function lundiSemaineProf(decalageSemaines = 0) {
  const d = aujourdhuiUTCProf();
  const jourISO = d.getUTCDay() || 7; // 1 = lundi ... 7 = dimanche
  d.setUTCDate(d.getUTCDate() - (jourISO - 1) + decalageSemaines * 7);
  return d;
}

function memeJourUTCProf(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

// Décalage (en semaines) par rapport à la semaine calendaire réelle en
// cours — indépendant des données : la semaine affichée par défaut est
// toujours celle d'aujourd'hui, même sans cours programmé. Remis à 0 à
// chaque ouverture de la section et à chaque changement de filtre.
let semaineHoraireProfDecalage = 0;

function changerSemaineHoraireProf(delta) {
  semaineHoraireProfDecalage += delta;
  filtrerHoraireProf();
}

function filtresHoraireProfChanges() {
  semaineHoraireProfDecalage = 0;
  filtrerHoraireProf();
}

// Même disposition en calendrier hebdomadaire que l'espace étudiant,
// naviguable semaine par semaine : le jour et sa date réelle en en-tête
// (une seule fois), l'heure de chaque créneau réaffichée dans sa propre
// bande bleue au-dessus de ses informations. Un cours est rattaché à une
// colonne par correspondance exacte de date (date_debut), pas par le
// simple libellé du jour ; le filtre "Jour" ne fait que choisir quelle(s)
// colonne(s) afficher.
function filtrerHoraireProf() {
  const conteneur = document.getElementById('prof-horaire-calendrier');
  const labelSemaine = document.getElementById('prof-horaire-semaine-label');
  if (!conteneur) return;

  const jour  = document.getElementById('horaire-filtre-jour')?.value || '';
  const mois  = document.getElementById('horaire-filtre-mois')?.value || '';
  const annee = document.getElementById('horaire-filtre-annee')?.value || '';

  let horaires = horaireProfCache;
  if (annee) horaires = horaires.filter(h => h.annee_academique === annee);
  // Le mois est déduit de la date de début du créneau (pas de colonne
  // "mois" dédiée).
  if (mois !== '') horaires = horaires.filter(h => h.date_debut && new Date(h.date_debut).getUTCMonth() === Number(mois));

  const lundi = lundiSemaineProf(semaineHoraireProfDecalage);
  const vendredi = new Date(lundi);
  vendredi.setUTCDate(lundi.getUTCDate() + 4);
  if (labelSemaine) {
    labelSemaine.textContent = `${formaterDateHoraire(lundi.toISOString())} – ${formaterDateHoraire(vendredi.toISOString())}`;
  }

  const auj = aujourdhuiUTCProf();
  const joursAffiches = jour ? [jour] : ORDRE_JOURS_PROF;

  // Une seule colonne (filtre "Jour" actif) doit rester compacte, pas
  // s'étirer sur toute la largeur comme si elle occupait 5 colonnes vides.
  conteneur.style.gridTemplateColumns = joursAffiches.length < ORDRE_JOURS_PROF.length
    ? `repeat(${joursAffiches.length}, minmax(200px, 260px))`
    : '';

  conteneur.innerHTML = joursAffiches.map(j => {
    const indexJour = ORDRE_JOURS_PROF.indexOf(j);
    const dateColonne = new Date(lundi);
    dateColonne.setUTCDate(lundi.getUTCDate() + indexJour);
    const coursDuJour = horaires
      .filter(h => h.date_debut && memeJourUTCProf(new Date(h.date_debut), dateColonne))
      .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));

    return `
      <div class="cal-jour${memeJourUTCProf(dateColonne, auj) ? ' aujourdhui' : ''}">
        <div class="cal-jour-entete">
          <span class="cal-jour-nom">${j}</span>
          <span class="cal-jour-date">${formaterDateHoraire(dateColonne.toISOString())}</span>
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
                    <span class="cours-nom">${h.cours} <span style="color:#999;font-weight:400">(${h.code})</span></span>
                    <span class="cours-info">${h.promotion}</span>
                    <span class="cours-info">${h.salle} · ${h.nb_etudiants ?? 0} étudiant(s)</span>
                    ${memeJourUTCProf(dateColonne, auj) ? `<button class="btn-icone" style="margin-top:6px;width:100%" onclick="ouvrirModalPresences(${h.id}, '${(h.cours + ' (' + h.code + ')').replace(/'/g, "\\'")}', '${dateColonne.toISOString().slice(0,10)}')">📋 Présences</button>` : ''}
                  </div>
                </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// =====================
// PRÉSENCES D'UNE SÉANCE
// =====================
let presencesModalCache = [];

function ouvrirModalPresences(horaireId, coursLibelle, dateSeance) {
  document.getElementById('presences-horaire-id').value = horaireId;
  document.getElementById('presences-cours-nom').textContent = coursLibelle;
  document.getElementById('presences-date').value = dateSeance;
  const affichage = document.getElementById('presences-date-affichage');
  if (affichage) affichage.value = formaterDateHoraire(dateSeance);
  document.getElementById('modal-presences')?.classList.add('active');
  chargerPresencesModal();
}

function fermerModalPresences() {
  document.getElementById('modal-presences')?.classList.remove('active');
}

async function chargerPresencesModal() {
  const professeur = getProfesseurConnecte();
  if (!professeur) return;
  const horaireId = document.getElementById('presences-horaire-id')?.value;
  const date = document.getElementById('presences-date')?.value;
  const tbody = document.getElementById('presences-body');
  if (!tbody || !horaireId || !date) return;
  tbody.innerHTML = '<tr><td colspan="4" class="admin-vide">Chargement...</td></tr>';
  try {
    const r = await fetch(`${BASE_URL}/api/professeur/${professeur.id}/horaires/${horaireId}/presences?date=${date}`);
    if (!r.ok) throw new Error();
    presencesModalCache = await r.json();
    if (presencesModalCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="admin-vide">Aucun étudiant inscrit à ce cours.</td></tr>';
      return;
    }
    tbody.innerHTML = presencesModalCache.map(e => {
      const statut = e.statut || 'present'; // par défaut : présent tant que rien n'est saisi
      return `<tr data-etudiant-id="${e.id}">
        <td>${e.nom} ${e.postnom || ''} ${e.prenom}</td>
        <td style="text-align:center"><input type="radio" name="presence-${e.id}" value="present" ${statut === 'present' ? 'checked' : ''}></td>
        <td style="text-align:center"><input type="radio" name="presence-${e.id}" value="retard" ${statut === 'retard' ? 'checked' : ''}></td>
        <td style="text-align:center"><input type="radio" name="presence-${e.id}" value="absent" ${statut === 'absent' ? 'checked' : ''}></td>
      </tr>`;
    }).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="4" class="admin-vide">⚠️ Erreur de chargement.</td></tr>';
  }
}

async function enregistrerPresences() {
  const professeur = getProfesseurConnecte();
  if (!professeur) return;
  const horaireId = document.getElementById('presences-horaire-id')?.value;
  const date_seance = document.getElementById('presences-date')?.value;
  if (!horaireId || !date_seance || presencesModalCache.length === 0) return;

  const presences = presencesModalCache.map(e => ({
    etudiant_id: e.id,
    statut: document.querySelector(`input[name="presence-${e.id}"]:checked`)?.value || 'present',
  }));

  try {
    const r = await fetch(`${BASE_URL}/api/professeur/${professeur.id}/horaires/${horaireId}/presences`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_seance, presences })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + d.erreur, 'erreur'); return; }
    afficherToast('✅ Présences enregistrées.');
    fermerModalPresences();
  } catch { afficherToast('⚠️ Serveur indisponible.', 'erreur'); }
}

// =====================
// SAISIE DES NOTES
// =====================
async function chargerCoursProf() {
  const professeur = getProfesseurConnecte();
  if (!professeur) return;
  const select = document.getElementById('prof-select-cours');
  if (!select) return;
  const valeurPrecedente = select.value;

  try {
    const r = await fetch(`${BASE_URL}/api/professeur/${professeur.id}/cours`);
    const cours = await r.json();
    select.innerHTML = '<option value="">— Choisir un cours —</option>' +
      cours.map(c => `<option value="${c.id}" data-annee="${c.annee_academique}">${c.code} — ${c.nom} (${c.promotion})</option>`).join('');
    // On garde le cours déjà sélectionné s'il existe toujours, et on
    // réactualise la liste des étudiants affichée pour ce cours.
    if (valeurPrecedente && cours.some(c => String(c.id) === valeurPrecedente)) {
      select.value = valeurPrecedente;
      chargerEtudiantsCours();
    }
  } catch (err) { console.error(err); }
}

async function chargerEtudiantsCours() {
  const professeur = getProfesseurConnecte();
  if (!professeur) return;
  const coursId  = document.getElementById('prof-select-cours')?.value;
  const tbody    = document.getElementById('prof-etudiants-body');
  if (!tbody) return;

  if (!coursId) {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-vide">Choisissez un cours pour afficher la liste des étudiants.</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="5" class="admin-vide">Chargement...</td></tr>';
  try {
    const r = await fetch(`${BASE_URL}/api/professeur/${professeur.id}/cours/${coursId}/etudiants`);
    if (!r.ok) throw new Error();
    const etudiants = await r.json();

    tbody.innerHTML = etudiants.length === 0
      ? '<tr><td colspan="5" class="admin-vide">Aucun étudiant dans cette promotion.</td></tr>'
      : etudiants.map(e => {
          // Un cours = un seul semestre → une seule note par étudiant pour ce
          // cours : on préremplit toujours la note existante (plus de filtre par session).
          const noteActuelle = e.note;
          return `<tr data-etudiant-id="${e.id}">
            <td>${e.nom} ${e.postnom || ''} ${e.prenom}</td>
            <td>${noteActuelle !== null && noteActuelle !== undefined ? noteActuelle + '/20' : '—'}</td>
            <td><input type="number" min="0" max="20" step="0.5" id="note-cc-${e.id}" value="${e.note_cc !== null && e.note_cc !== undefined ? e.note_cc : ''}" style="width:80px;padding:6px 8px;border:1.5px solid #ddd;border-radius:6px" placeholder="0-20"></td>
            <td><input type="number" min="0" max="20" step="0.5" id="note-examen-${e.id}" value="${e.note_examen !== null && e.note_examen !== undefined ? e.note_examen : ''}" style="width:80px;padding:6px 8px;border:1.5px solid #ddd;border-radius:6px" placeholder="0-20"></td>
            <td><button class="btn-icone" onclick="sauvegarderNoteProf('${e.id}', ${coursId})" aria-label="Enregistrer">${icone('coche')}</button></td>
          </tr>`;
        }).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-vide">⚠️ Erreur de chargement.</td></tr>';
  }
}

// Le contrôle continu et l'examen peuvent être saisis séparément (l'un
// arrive souvent avant l'autre) : on n'exige qu'au moins l'un des deux.
// options.silencieux évite les toasts/rechargements individuels lors d'une
// saisie groupée (voir sauvegarderToutesLesNotesProf).
async function sauvegarderNoteProf(etudiantId, coursId, options = {}) {
  const professeur = getProfesseurConnecte();
  if (!professeur) return { ok: false };
  const annee   = document.querySelector(`#prof-select-cours option[value="${coursId}"]`)?.dataset.annee || '';
  const ccValeur     = document.getElementById(`note-cc-${etudiantId}`)?.value ?? '';
  const examenValeur = document.getElementById(`note-examen-${etudiantId}`)?.value ?? '';
  const note_cc     = ccValeur     === '' ? undefined : parseFloat(ccValeur);
  const note_examen = examenValeur === '' ? undefined : parseFloat(examenValeur);

  if (note_cc === undefined && note_examen === undefined) {
    if (!options.silencieux) afficherToast('⚠️ Renseignez au moins le contrôle continu ou l\'examen.', 'erreur');
    return { ok: false, ignore: true };
  }
  if (note_cc !== undefined && (isNaN(note_cc) || note_cc < 0 || note_cc > 20)) {
    if (!options.silencieux) afficherToast('⚠️ Entrez un contrôle continu entre 0 et 20.', 'erreur');
    return { ok: false };
  }
  if (note_examen !== undefined && (isNaN(note_examen) || note_examen < 0 || note_examen > 20)) {
    if (!options.silencieux) afficherToast('⚠️ Entrez un examen entre 0 et 20.', 'erreur');
    return { ok: false };
  }

  const corps = { etudiant_id: etudiantId, cours_id: coursId, annee_academique: annee };
  if (note_cc !== undefined) corps.note_cc = note_cc;
  if (note_examen !== undefined) corps.note_examen = note_examen;

  try {
    const r = await fetch(`${BASE_URL}/api/professeur/${professeur.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    });
    const d = await r.json();
    if (!r.ok) { if (!options.silencieux) afficherToast('❌ ' + d.erreur, 'erreur'); return { ok: false }; }
    if (!options.silencieux) {
      const suffixe = d.note !== null && d.note !== undefined ? ` Moyenne : ${d.note}/20` : ' (en attente de l\'autre note pour calculer la moyenne)';
      afficherToast('✅ Note enregistrée.' + suffixe);
      chargerEtudiantsCours();
    }
    return { ok: true };
  } catch {
    if (!options.silencieux) afficherToast('⚠️ Impossible de contacter le serveur.', 'erreur');
    return { ok: false };
  }
}

// Enregistre en une fois toutes les lignes du tableau où au moins une des
// deux notes a été saisie — pratique pour noter plusieurs étudiants d'un coup.
async function sauvegarderToutesLesNotesProf() {
  const coursId = document.getElementById('prof-select-cours')?.value;
  if (!coursId) { afficherToast('⚠️ Choisissez un cours.', 'erreur'); return; }
  const lignes = document.querySelectorAll('#prof-etudiants-body tr[data-etudiant-id]');
  if (lignes.length === 0) { afficherToast('⚠️ Aucun étudiant à enregistrer.', 'erreur'); return; }

  let reussies = 0, echecs = 0;
  for (const ligne of lignes) {
    const etudiantId = ligne.dataset.etudiantId;
    const resultat = await sauvegarderNoteProf(etudiantId, coursId, { silencieux: true });
    if (resultat.ok) reussies++;
    else if (!resultat.ignore) echecs++;
  }

  if (reussies === 0 && echecs === 0) afficherToast('⚠️ Aucune note saisie à enregistrer.', 'erreur');
  else if (echecs > 0) afficherToast(`⚠️ ${reussies} note(s) enregistrée(s), ${echecs} erreur(s).`, 'erreur');
  else afficherToast(`✅ ${reussies} note(s) enregistrée(s) !`);

  chargerEtudiantsCours();
}

// =====================
// CHANGEMENT DE MOT DE PASSE
// =====================
async function changerMotDePasseProf() {
  const professeur = getProfesseurConnecte();
  if (!professeur) return;

  const actuel  = document.getElementById('prof-mdp-actuel')?.value;
  const nouveau = document.getElementById('prof-mdp-nouveau')?.value;
  const confirm = document.getElementById('prof-mdp-confirm')?.value;

  if (!actuel || !nouveau || !confirm) { afficherToast('⚠️ Tous les champs sont requis.', 'erreur'); return; }
  if (nouveau !== confirm) { afficherToast('❌ Les deux nouveaux mots de passe ne correspondent pas.', 'erreur'); return; }
  if (nouveau.length < 6) { afficherToast('❌ Le mot de passe doit contenir au moins 6 caractères.', 'erreur'); return; }

  try {
    const r = await fetch(`${BASE_URL}/api/auth/professeur/${professeur.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mot_de_passe_actuel: actuel, nouveau_mot_de_passe: nouveau })
    });
    const d = await r.json();
    if (!r.ok) { afficherToast('❌ ' + d.erreur, 'erreur'); return; }
    afficherToast('✅ Mot de passe changé avec succès !');
    ['prof-mdp-actuel','prof-mdp-nouveau','prof-mdp-confirm'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch {
    afficherToast('⚠️ Impossible de contacter le serveur.', 'erreur');
  }
}

// =====================
// INITIALISATION
// =====================
document.addEventListener('DOMContentLoaded', () => {
  const champPass = document.getElementById('prof-pass');
  if (champPass) champPass.addEventListener('keypress', e => { if (e.key === 'Enter') connexionProfesseur(); });

  if (document.getElementById('prof-horaire-calendrier')) {
    const professeur = getProfesseurConnecte();
    if (professeur) {
      afficherProfilProf(professeur);
      chargerHoraireProf(professeur.id);
      chargerCommuniquesProf();
    }
  }

  // Fermer le panneau de la cloche et le menu burger au clic en dehors.
  document.addEventListener('click', e => {
    const wrap = document.querySelector('.dash-notif-wrap');
    const panneau = document.getElementById('prof-notif-panneau');
    if (panneau && wrap && !wrap.contains(e.target)) panneau.classList.remove('ouvert');

    const menuWrap = document.querySelector('.dash-menu-wrap');
    const menu = document.getElementById('prof-menu-compte');
    if (menu && menuWrap && !menuWrap.contains(e.target)) menu.classList.remove('ouvert');
  });
});

// =====================
// CLOCHE — communiqués de l'administration destinés aux enseignants
// L'état « vu » est mémorisé par professeur dans localStorage : un communiqué
// compte comme nouveau tant que l'enseignant n'a pas ouvert la cloche.
// =====================
let communiquesProf = [];

async function chargerCommuniquesProf() {
  try {
    const r = await fetch(`${BASE_URL}/api/annonces?type=communique&role=professeur&actif=true`);
    if (!r.ok) throw new Error();
    communiquesProf = await r.json();
    majNotifsProf();
  } catch { /* silencieux */ }
}

// Page « Annonces » de l'enseignant : reprend les communiqués (destinés aux
// enseignants) ET les actualités générales de l'UML (annonces + événements).
let actualitesProf = [];

async function chargerAnnoncesProf() {
  try {
    const [ra, rc] = await Promise.all([
      fetch(`${BASE_URL}/api/annonces?actif=true`),
      fetch(`${BASE_URL}/api/annonces?type=communique&role=professeur&actif=true`)
    ]);
    actualitesProf = ra.ok ? (await ra.json()).filter(a => a.type !== 'communique') : [];
    communiquesProf = rc.ok ? await rc.json() : communiquesProf;
    majNotifsProf(); // garde la cloche synchronisée
  } catch { /* silencieux */ }
  afficherAnnoncesProf();
}

function afficherAnnoncesProf() {
  const zone = document.getElementById('prof-annonces-liste');
  if (!zone) return;
  const communiques = (communiquesProf || []).map(c => `
    <div class="ia-alerte" style="border-left:4px solid var(--jaune);background:rgba(245,181,32,0.08)">
      <span class="ia-alerte-icon">📣</span>
      <span class="ia-alerte-texte">
        <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--jaune);text-transform:uppercase">Communiqué de l'administration</span><br>
        <b>${c.titre}</b><br>${c.description || ''}
      </span>
    </div>`).join('');
  const actualites = (actualitesProf || []).map(a => `
    <div class="ia-alerte ok">
      <span class="ia-alerte-icon">${a.icone || '📢'}</span>
      <span class="ia-alerte-texte"><b>${a.titre}</b><br>${a.description || ''}${a.cible_faculte ? ` <em style="color:#999">(${a.cible_faculte})</em>` : ''}</span>
    </div>`).join('');
  zone.innerHTML = (communiques + actualites) || '<p class="ia-vide">Aucune annonce pour le moment.</p>';
}

function cleNotifsProf() {
  const p = getProfesseurConnecte();
  return p ? `notif_vus_prof_${p.id}` : null;
}

function lireNotifsProfVus() {
  const cle = cleNotifsProf();
  if (!cle) return [];
  try { return JSON.parse(localStorage.getItem(cle) || '[]'); } catch { return []; }
}

function majNotifsProf() {
  const vus = lireNotifsProfVus();
  const nouvelles = communiquesProf.filter(c => !vus.includes(c.id));

  const badge = document.getElementById('prof-notif-badge');
  if (badge) {
    if (nouvelles.length > 0) { badge.textContent = nouvelles.length > 99 ? '99+' : nouvelles.length; badge.style.display = ''; }
    else badge.style.display = 'none';
  }

  const liste = document.getElementById('prof-notif-liste');
  if (liste) {
    // La cloche n'affiche que les communiqués NON LUS : ils restent tant que le
    // professeur n'a pas cliqué dessus.
    liste.innerHTML = nouvelles.length === 0
      ? '<p class="notif-vide">Aucune information pour le moment.</p>'
      : nouvelles.map(c => `
          <div class="notif-item" role="button" tabindex="0" onclick="ouvrirAnnoncesProfDepuisCloche(${JSON.stringify(c.id)})">
            <span class="notif-item-icone">📣</span>
            <div>
              <span class="notif-item-titre">${c.titre}</span>
              <span class="notif-item-sous">${c.description || ''}</span>
            </div>
          </div>`).join('');
  }
}

function marquerCommuniqueLuProf(id) {
  const vus = lireNotifsProfVus();
  if (!vus.includes(id)) vus.push(id);
  const cle = cleNotifsProf();
  if (cle) localStorage.setItem(cle, JSON.stringify(vus));
}

// Clic sur une info dans la cloche → marquée lue PUIS ouverture des « Annonces ».
function ouvrirAnnoncesProfDepuisCloche(id) {
  if (id != null) marquerCommuniqueLuProf(id);
  document.getElementById('prof-notif-panneau')?.classList.remove('ouvert');
  const lien = document.querySelector('.nav-item[onclick*="prof-annonces"]');
  afficherSectionProf('prof-annonces', lien);
  majNotifsProf();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function basculerNotifsProf(event) {
  if (event) event.stopPropagation();
  const panneau = document.getElementById('prof-notif-panneau');
  if (!panneau) return;
  // On n'efface plus le badge à l'ouverture : un communiqué ne disparaît que
  // lorsque le professeur clique dessus (voir ouvrirAnnoncesProfDepuisCloche).
  panneau.classList.toggle('ouvert');
}
