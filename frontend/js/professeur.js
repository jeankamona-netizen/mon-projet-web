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
  if (!data) { window.location.href = 'professeur.html'; return null; }
  return JSON.parse(data);
}

function deconnecterProfesseur() {
  sessionStorage.removeItem('professeur');
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
  if (id === 'prof-horaire') chargerHoraireProf(professeur.id);
  if (id === 'prof-notes')   chargerCoursProf();
}

// =====================
// PROFIL
// =====================
function afficherProfilProf(p) {
  const initiales = `${p.prenom?.[0] || ''}${p.nom?.[0] || ''}`.toUpperCase() || 'P';
  document.querySelectorAll('#prof-avatar-header, #prof-avatar-sidebar').forEach(el => { if (el) el.textContent = initiales; });

  const nomComplet = `${p.prenom || ''} ${p.nom}`.trim();
  const champs = {
    'prof-nom-sidebar': nomComplet,
    'prof-grade-sidebar': p.grade || 'Professeur',
    'prof-nom': nomComplet,
    'prof-email-val': p.email || '—',
    'prof-telephone': p.telephone || '—',
    'prof-grade': p.grade || '—',
  };
  Object.entries(champs).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
}

// =====================
// MON HORAIRE
// =====================
async function chargerHoraireProf(id) {
  const tbody = document.getElementById('prof-horaire-body');
  if (!tbody) return;
  try {
    const r = await fetch(`${BASE_URL}/api/professeur/${id}/horaires`);
    if (!r.ok) throw new Error();
    const horaires = await r.json();
    tbody.innerHTML = horaires.length === 0
      ? '<tr><td colspan="5" class="admin-vide">Aucun cours programmé pour le moment.</td></tr>'
      : horaires.map(h => `
          <tr>
            <td><span class="jour-badge">${h.jour}</span></td>
            <td>${h.heure_debut} – ${h.heure_fin}</td>
            <td>${h.cours} <span style="color:#999;font-size:11px">(${h.code})</span></td>
            <td>${h.promotion}</td>
            <td>${h.salle}</td>
          </tr>`).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="admin-vide">⚠️ Impossible de charger votre horaire.</td></tr>';
  }
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

  if (document.getElementById('prof-horaire-body')) {
    const professeur = getProfesseurConnecte();
    if (professeur) {
      afficherProfilProf(professeur);
      chargerHoraireProf(professeur.id);
    }
  }
});
