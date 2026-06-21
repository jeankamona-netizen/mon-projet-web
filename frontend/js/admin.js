// =====================
// CONNEXION ADMINISTRATEUR
// =====================

const ADMIN_USER = "admin.uml";
const ADMIN_PASS = "admin2026";

function connexionAdmin() {
  const user = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value.trim();
  const erreurBox = document.getElementById('admin-erreur');

  if (!user || !pass) {
    erreurBox.textContent = '⚠️ Veuillez remplir tous les champs.';
    erreurBox.style.display = 'block';
    return;
  }

  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    erreurBox.textContent = '❌ Identifiant ou mot de passe incorrect.';
    erreurBox.style.display = 'block';
    return;
  }

  erreurBox.style.display = 'none';
  window.location.href = 'admin-dashboard.html';
}

function toggleAdminPassword() {
  const input = document.getElementById('admin-pass');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// =====================
// NAVIGATION ENTRE SECTIONS (tableau de bord admin)
// =====================

function afficherSection(id, lien) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  lien.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================
// TOAST NOTIFICATION (partagée par tous les modules)
// =====================

function afficherToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast';
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

// =====================
// GESTION DES NOTES — connecté à MySQL
// =====================

let notesAdmin = [];

async function chargerNotes() {
  const tbody = document.getElementById('admin-notes-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Chargement...</td></tr>`;

  try {
    const reponse = await fetch('http://localhost:3000/api/notes');
    if (!reponse.ok) throw new Error('Erreur serveur');
    notesAdmin = await reponse.json();
    afficherTableauNotes();
  } catch (erreur) {
    console.error(erreur);
    tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">⚠️ Impossible de charger les notes. Vérifiez le backend.</td></tr>`;
  }
}

function afficherTableauNotes(liste = notesAdmin) {
  const tbody = document.getElementById('admin-notes-body');
  if (!tbody) return;

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Aucune note enregistrée pour le moment.</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map(n => {
    const statut = n.note >= 10
      ? '<span class="badge reussi">Réussi</span>'
      : '<span class="badge echec">Échec</span>';

    return `
      <tr>
        <td>${n.nom_etudiant} ${n.prenom_etudiant}<br><span style="font-size:11px;color:#999">${n.etudiant_id}</span></td>
        <td>${n.matiere}</td>
        <td>${n.note}/20</td>
        <td>${n.session === 'S1' ? 'Semestre 1' : 'Semestre 2'}</td>
        <td>${statut}</td>
        <td class="admin-actions-cell">
          <button class="btn-icone" title="Modifier" onclick="modifierNote(${n.id})">✏️</button>
          <button class="btn-icone danger" title="Supprimer" onclick="supprimerNote(${n.id})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function ouvrirModalNote() {
  document.getElementById('modal-note-titre').textContent = 'Ajouter une note';
  document.getElementById('note-id-edit').value = '';
  document.getElementById('note-etudiant').value = 'UML-2024-0012';
  document.getElementById('note-matiere').selectedIndex = 0;
  document.getElementById('note-valeur').value = '';
  document.getElementById('note-session').value = 'S1';
  document.getElementById('modal-note').classList.add('active');
}

function modifierNote(id) {
  const note = notesAdmin.find(n => n.id === id);
  if (!note) return;

  document.getElementById('modal-note-titre').textContent = 'Modifier la note';
  document.getElementById('note-id-edit').value = note.id;
  document.getElementById('note-etudiant').value = note.etudiant_id;
  document.getElementById('note-matiere').value = note.matiere;
  document.getElementById('note-valeur').value = note.note;
  document.getElementById('note-session').value = note.session;
  document.getElementById('modal-note').classList.add('active');
}

function fermerModalNote() {
  document.getElementById('modal-note').classList.remove('active');
}

async function trouverCoursIdParNom(nomCours) {
  const reponse = await fetch('http://localhost:3000/api/programme');
  const cours = await reponse.json();
  const trouve = cours.find(c => c.nom === nomCours);
  return trouve ? trouve.id : null;
}

async function sauvegarderNote() {
  const idEdit = document.getElementById('note-id-edit').value;
  const etudiant_id = document.getElementById('note-etudiant').value;
  const matiereNom = document.getElementById('note-matiere').value;
  const note = parseFloat(document.getElementById('note-valeur').value);
  const session = document.getElementById('note-session').value;

  if (isNaN(note) || note < 0 || note > 20) {
    alert('⚠️ Veuillez saisir une note valide entre 0 et 20.');
    return;
  }

  const cours_id = await trouverCoursIdParNom(matiereNom);
  if (!cours_id) {
    alert('⚠️ Ce cours n\'existe pas dans le programme. Ajoutez-le d\'abord dans "Programme annuel".');
    return;
  }

  const annee_academique = '2025-2026';

  try {
    let reponse;
    if (idEdit) {
      reponse = await fetch(`http://localhost:3000/api/notes/${idEdit}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, session, annee_academique })
      });
    } else {
      reponse = await fetch('http://localhost:3000/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etudiant_id, cours_id, note, session, annee_academique })
      });
    }

    const donnees = await reponse.json();
    if (!reponse.ok) {
      alert('❌ ' + donnees.erreur);
      return;
    }

    afficherToast(idEdit ? '✅ Note modifiée avec succès !' : '✅ Note ajoutée avec succès !');
    fermerModalNote();
    chargerNotes();

  } catch (erreur) {
    console.error(erreur);
    alert('⚠️ Impossible de contacter le serveur.');
  }
}

async function supprimerNote(id) {
  if (!confirm('Voulez-vous vraiment supprimer cette note ?')) return;

  try {
    await fetch(`http://localhost:3000/api/notes/${id}`, { method: 'DELETE' });
    afficherToast('🗑️ Note supprimée.');
    chargerNotes();
  } catch (erreur) {
    console.error(erreur);
    alert('⚠️ Impossible de supprimer la note.');
  }
}

// =====================
// GESTION DES HORAIRES — connecté à MySQL
// =====================

let horairesAdmin = [];

async function chargerHoraires() {
  const tbody = document.getElementById('admin-horaires-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">Chargement...</td></tr>`;

  try {
    const annee = document.getElementById('filtre-annee')?.value || '';
    const promotion = document.getElementById('filtre-promotion')?.value || '';
    const jour = document.getElementById('filtre-jour')?.value || '';

    const params = new URLSearchParams();
    if (annee) params.append('annee', annee);
    if (promotion) params.append('promotion', promotion);
    if (jour) params.append('jour', jour);

    const reponse = await fetch(`http://localhost:3000/api/horaires?${params}`);
    if (!reponse.ok) throw new Error('Erreur serveur');
    horairesAdmin = await reponse.json();
    afficherTableauHoraires();
  } catch (erreur) {
    console.error(erreur);
    tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">⚠️ Impossible de charger les horaires.</td></tr>`;
  }
}

function afficherTableauHoraires(liste = horairesAdmin) {
  const tbody = document.getElementById('admin-horaires-body');
  if (!tbody) return;

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">Aucun cours programmé pour ces critères.</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map(h => `
    <tr>
      <td><strong>${h.promotion}</strong></td>
      <td><span class="annee-badge">${h.annee_academique}</span></td>
      <td><span class="jour-badge">${h.jour}</span></td>
      <td>${h.heure_debut} – ${h.heure_fin}</td>
      <td>${h.cours}</td>
      <td>${h.professeur || '—'}</td>
      <td>${h.salle}</td>
      <td class="admin-actions-cell">
        <button class="btn-icone" title="Modifier" onclick="modifierHoraire(${h.id})">✏️</button>
        <button class="btn-icone danger" title="Supprimer" onclick="supprimerHoraire(${h.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function ouvrirModalHoraire() {
  document.getElementById('modal-horaire-titre').textContent = 'Ajouter un cours à l\'horaire';
  document.getElementById('horaire-id-edit').value = '';
  document.getElementById('horaire-promotion').selectedIndex = 0;
  document.getElementById('horaire-annee').value = '2025-2026';
  document.getElementById('horaire-jour').selectedIndex = 0;
  document.getElementById('horaire-debut').value = '07:30';
  document.getElementById('horaire-fin').value = '09:30';
  document.getElementById('horaire-cours').selectedIndex = 0;
  document.getElementById('horaire-prof').value = '';
  document.getElementById('horaire-salle').value = '';
  document.getElementById('modal-horaire').classList.add('active');
}

function modifierHoraire(id) {
  const h = horairesAdmin.find(x => x.id === id);
  if (!h) return;

  document.getElementById('modal-horaire-titre').textContent = 'Modifier le cours';
  document.getElementById('horaire-id-edit').value = h.id;
  document.getElementById('horaire-promotion').value = h.promotion;
  document.getElementById('horaire-annee').value = h.annee_academique;
  document.getElementById('horaire-jour').value = h.jour;
  document.getElementById('horaire-debut').value = h.heure_debut;
  document.getElementById('horaire-fin').value = h.heure_fin;
  document.getElementById('horaire-cours').value = h.cours;
  document.getElementById('horaire-prof').value = h.professeur || '';
  document.getElementById('horaire-salle').value = h.salle;
  document.getElementById('modal-horaire').classList.add('active');
}

function fermerModalHoraire() {
  document.getElementById('modal-horaire').classList.remove('active');
}

async function sauvegarderHoraire() {
  const idEdit = document.getElementById('horaire-id-edit').value;
  const promotion = document.getElementById('horaire-promotion').value;
  const annee_academique = document.getElementById('horaire-annee').value;
  const jour = document.getElementById('horaire-jour').value;
  const heure_debut = document.getElementById('horaire-debut').value;
  const heure_fin = document.getElementById('horaire-fin').value;
  const coursNom = document.getElementById('horaire-cours').value;
  const salle = document.getElementById('horaire-salle').value.trim();

  if (!heure_debut || !heure_fin || !salle) {
    alert('⚠️ Veuillez remplir tous les champs.');
    return;
  }

  if (heure_fin <= heure_debut) {
    alert('⚠️ L\'heure de fin doit être après l\'heure de début.');
    return;
  }

  const cours_id = await trouverCoursIdParNom(coursNom);
  if (!cours_id) {
    alert('⚠️ Ce cours n\'existe pas dans le programme annuel. Ajoutez-le d\'abord.');
    return;
  }

  const corps = { promotion, annee_academique, jour, heure_debut, heure_fin, cours_id, professeur_id: null, salle };

  try {
    let reponse;
    if (idEdit) {
      reponse = await fetch(`http://localhost:3000/api/horaires/${idEdit}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps)
      });
    } else {
      reponse = await fetch('http://localhost:3000/api/horaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps)
      });
    }

    const donnees = await reponse.json();
    if (!reponse.ok) {
      alert('⚠️ ' + donnees.erreur);
      return;
    }

    afficherToast(idEdit ? '✅ Cours modifié avec succès !' : '✅ Cours ajouté à l\'horaire !');
    fermerModalHoraire();
    chargerHoraires();

  } catch (erreur) {
    console.error(erreur);
    alert('⚠️ Impossible de contacter le serveur.');
  }
}

async function supprimerHoraire(id) {
  if (!confirm('Voulez-vous vraiment supprimer ce cours de l\'horaire ?')) return;

  try {
    await fetch(`http://localhost:3000/api/horaires/${id}`, { method: 'DELETE' });
    afficherToast('🗑️ Cours supprimé de l\'horaire.');
    chargerHoraires();
  } catch (erreur) {
    console.error(erreur);
    alert('⚠️ Impossible de supprimer.');
  }
}

// =====================
// GESTION DU PROGRAMME ANNUEL — connecté à MySQL
// =====================

let programmeAdmin = [];

async function chargerProgramme() {
  const tbody = document.getElementById('admin-programme-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="admin-vide">Chargement...</td></tr>`;

  try {
    const annee = document.getElementById('filtre-prog-annee')?.value || '';
    const promotion = document.getElementById('filtre-prog-promotion')?.value || '';
    const semestre = document.getElementById('filtre-prog-semestre')?.value || '';

    const params = new URLSearchParams();
    if (annee) params.append('annee', annee);
    if (promotion) params.append('promotion', promotion);
    if (semestre) params.append('semestre', semestre);

    const reponse = await fetch(`http://localhost:3000/api/programme?${params}`);
    if (!reponse.ok) throw new Error('Erreur serveur');
    programmeAdmin = await reponse.json();
    afficherTableauProgramme();
  } catch (erreur) {
    console.error(erreur);
    tbody.innerHTML = `<tr><td colspan="7" class="admin-vide">⚠️ Impossible de charger le programme.</td></tr>`;
  }
}

function afficherTableauProgramme(liste = programmeAdmin) {
  const tbody = document.getElementById('admin-programme-body');
  if (!tbody) return;

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-vide">Aucun cours pour ces critères.</td></tr>`;
    calculerResumeProgramme([]);
    return;
  }

  tbody.innerHTML = liste.map(p => `
    <tr>
      <td><span class="prog-code-admin">${p.code}</span></td>
      <td>${p.nom}</td>
      <td>${p.promotion}</td>
      <td><span class="annee-badge">${p.annee_academique}</span></td>
      <td>${p.semestre === 'S1' ? 'Semestre 1' : 'Semestre 2'}</td>
      <td>${p.credits} crédits</td>
      <td class="admin-actions-cell">
        <button class="btn-icone" title="Modifier" onclick="modifierProgramme(${p.id})">✏️</button>
        <button class="btn-icone danger" title="Supprimer" onclick="supprimerProgramme(${p.id})">🗑️</button>
      </td>
    </tr>
  `).join('');

  calculerResumeProgramme(liste);
}

function calculerResumeProgramme(liste) {
  const resumeBox = document.getElementById('programme-resume');
  if (!resumeBox) return;

  const totalS1 = liste.filter(p => p.semestre === 'S1').reduce((s, p) => s + p.credits, 0);
  const totalS2 = liste.filter(p => p.semestre === 'S2').reduce((s, p) => s + p.credits, 0);

  resumeBox.innerHTML = `
    <div class="resume-item">
      <span class="resume-label">Total cours affichés</span>
      <span class="resume-valeur">${liste.length}</span>
    </div>
    <div class="resume-item">
      <span class="resume-label">Crédits Semestre 1</span>
      <span class="resume-valeur">${totalS1}</span>
    </div>
    <div class="resume-item">
      <span class="resume-label">Crédits Semestre 2</span>
      <span class="resume-valeur">${totalS2}</span>
    </div>
  `;
}

function ouvrirModalProgramme() {
  document.getElementById('modal-programme-titre').textContent = 'Ajouter un cours au programme';
  document.getElementById('programme-id-edit').value = '';
  document.getElementById('programme-code').value = '';
  document.getElementById('programme-credits').value = '';
  document.getElementById('programme-nom').value = '';
  document.getElementById('programme-promotion').selectedIndex = 0;
  document.getElementById('programme-annee').value = '2025-2026';
  document.getElementById('programme-semestre').value = 'S1';
  document.getElementById('modal-programme').classList.add('active');
}

function modifierProgramme(id) {
  const p = programmeAdmin.find(x => x.id === id);
  if (!p) return;

  document.getElementById('modal-programme-titre').textContent = 'Modifier le cours';
  document.getElementById('programme-id-edit').value = p.id;
  document.getElementById('programme-code').value = p.code;
  document.getElementById('programme-credits').value = p.credits;
  document.getElementById('programme-nom').value = p.nom;
  document.getElementById('programme-promotion').value = p.promotion;
  document.getElementById('programme-annee').value = p.annee_academique;
  document.getElementById('programme-semestre').value = p.semestre;
  document.getElementById('modal-programme').classList.add('active');
}

function fermerModalProgramme() {
  document.getElementById('modal-programme').classList.remove('active');
}

async function sauvegarderProgramme() {
  const idEdit = document.getElementById('programme-id-edit').value;
  const code = document.getElementById('programme-code').value.trim();
  const credits = parseInt(document.getElementById('programme-credits').value);
  const nom = document.getElementById('programme-nom').value.trim();
  const promotion = document.getElementById('programme-promotion').value;
  const annee_academique = document.getElementById('programme-annee').value;
  const semestre = document.getElementById('programme-semestre').value;

  if (!code || !nom || isNaN(credits) || credits < 1) {
    alert('⚠️ Veuillez remplir tous les champs correctement (crédits ≥ 1).');
    return;
  }

  const corps = { code, nom, promotion, annee_academique, semestre, credits };

  try {
    let reponse;
    if (idEdit) {
      reponse = await fetch(`http://localhost:3000/api/programme/${idEdit}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps)
      });
    } else {
      reponse = await fetch('http://localhost:3000/api/programme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps)
      });
    }

    const donnees = await reponse.json();
    if (!reponse.ok) {
      alert('⚠️ ' + donnees.erreur);
      return;
    }

    afficherToast(idEdit ? '✅ Cours du programme modifié !' : '✅ Cours ajouté au programme !');
    fermerModalProgramme();
    chargerProgramme();

  } catch (erreur) {
    console.error(erreur);
    alert('⚠️ Impossible de contacter le serveur.');
  }
}

async function supprimerProgramme(id) {
  if (!confirm('Voulez-vous vraiment supprimer ce cours du programme ?')) return;

  try {
    await fetch(`http://localhost:3000/api/programme/${id}`, { method: 'DELETE' });
    afficherToast('🗑️ Cours retiré du programme.');
    chargerProgramme();
  } catch (erreur) {
    console.error(erreur);
    alert('⚠️ Impossible de supprimer.');
  }
}

// =====================
// GESTION DES ANNONCES & ÉVÉNEMENTS — connecté à MySQL
// =====================

let annoncesAdmin = [];

function formatDateAffichage(dateStr) {
  const d = new Date(dateStr);
  const mois_noms = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
  return `${String(d.getDate()).padStart(2,'0')} ${mois_noms[d.getMonth()]} ${d.getFullYear()}`;
}

async function chargerAnnonces() {
  const tbody = document.getElementById('admin-annonces-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="admin-vide">Chargement...</td></tr>`;

  try {
    const type = document.getElementById('filtre-type-annonce')?.value || '';
    const params = new URLSearchParams();
    if (type) params.append('type', type);

    const reponse = await fetch(`http://localhost:3000/api/annonces?${params}`);
    if (!reponse.ok) throw new Error('Erreur serveur');
    annoncesAdmin = await reponse.json();
    afficherTableauAnnonces();
  } catch (erreur) {
    console.error(erreur);
    tbody.innerHTML = `<tr><td colspan="5" class="admin-vide">⚠️ Impossible de charger les annonces.</td></tr>`;
  }
}

function afficherTableauAnnonces(liste = annoncesAdmin) {
  const tbody = document.getElementById('admin-annonces-body');
  if (!tbody) return;

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-vide">Aucune annonce pour ces critères.</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map(a => `
    <tr>
      <td>${a.icone} ${a.titre}</td>
      <td><span class="type-badge ${a.type}">${a.type === 'annonce' ? 'Annonce' : 'Événement'}</span></td>
      <td>${formatDateAffichage(a.date_annonce)}</td>
      <td><span class="badge ${a.actif ? 'actif' : 'inactif'}">${a.actif ? 'Actif' : 'Masqué'}</span></td>
      <td class="admin-actions-cell">
        <button class="btn-icone" title="${a.actif ? 'Masquer' : 'Activer'}" onclick="toggleActifAnnonce(${a.id})">${a.actif ? '👁️' : '🚫'}</button>
        <button class="btn-icone" title="Modifier" onclick="modifierAnnonce(${a.id})">✏️</button>
        <button class="btn-icone danger" title="Supprimer" onclick="supprimerAnnonce(${a.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function gererAffichageChampImage() {
  const type = document.getElementById('annonce-type').value;
  document.getElementById('champ-image-evenement').style.display = type === 'evenement' ? 'block' : 'none';
}

function ouvrirModalAnnonce() {
  document.getElementById('modal-annonce-titre').textContent = 'Nouvelle annonce';
  document.getElementById('annonce-id-edit').value = '';
  document.getElementById('annonce-type').value = 'annonce';
  document.getElementById('annonce-titre-input').value = '';
  document.getElementById('annonce-description').value = '';
  document.getElementById('annonce-date').value = '';
  document.getElementById('annonce-icone').value = '📅';
  document.getElementById('annonce-image').selectedIndex = 0;
  document.getElementById('annonce-actif').checked = true;
  gererAffichageChampImage();
  document.getElementById('modal-annonce').classList.add('active');
}

function modifierAnnonce(id) {
  const a = annoncesAdmin.find(x => x.id === id);
  if (!a) return;

  document.getElementById('modal-annonce-titre').textContent = 'Modifier l\'annonce';
  document.getElementById('annonce-id-edit').value = a.id;
  document.getElementById('annonce-type').value = a.type;
  document.getElementById('annonce-titre-input').value = a.titre;
  document.getElementById('annonce-description').value = a.description;
  document.getElementById('annonce-date').value = a.date_annonce.split('T')[0];
  document.getElementById('annonce-icone').value = a.icone;
  if (a.image) document.getElementById('annonce-image').value = a.image;
  document.getElementById('annonce-actif').checked = !!a.actif;
  gererAffichageChampImage();
  document.getElementById('modal-annonce').classList.add('active');
}

function fermerModalAnnonce() {
  document.getElementById('modal-annonce').classList.remove('active');
}

async function sauvegarderAnnonce() {
  const idEdit = document.getElementById('annonce-id-edit').value;
  const type = document.getElementById('annonce-type').value;
  const titre = document.getElementById('annonce-titre-input').value.trim();
  const description = document.getElementById('annonce-description').value.trim();
  const date_annonce = document.getElementById('annonce-date').value;
  const icone = document.getElementById('annonce-icone').value;
  const image = type === 'evenement' ? document.getElementById('annonce-image').value : '';
  const actif = document.getElementById('annonce-actif').checked;

  if (!titre || !description || !date_annonce) {
    alert('⚠️ Veuillez remplir tous les champs obligatoires.');
    return;
  }

  const corps = { type, titre, description, date_annonce, icone, image, actif };

  try {
    let reponse;
    if (idEdit) {
      reponse = await fetch(`http://localhost:3000/api/annonces/${idEdit}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps)
      });
    } else {
      reponse = await fetch('http://localhost:3000/api/annonces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps)
      });
    }

    const donnees = await reponse.json();
    if (!reponse.ok) {
      alert('⚠️ ' + donnees.erreur);
      return;
    }

    afficherToast(idEdit ? '✅ Annonce modifiée avec succès !' : '✅ Annonce publiée avec succès !');
    fermerModalAnnonce();
    chargerAnnonces();

  } catch (erreur) {
    console.error(erreur);
    alert('⚠️ Impossible de contacter le serveur.');
  }
}

async function toggleActifAnnonce(id) {
  try {
    const reponse = await fetch(`http://localhost:3000/api/annonces/${id}/toggle`, { method: 'PATCH' });
    const donnees = await reponse.json();

    afficherToast(donnees.actif ? '👁️ Annonce activée sur le site' : '🚫 Annonce masquée du site');
    chargerAnnonces();
  } catch (erreur) {
    console.error(erreur);
    alert('⚠️ Impossible de changer le statut.');
  }
}

async function supprimerAnnonce(id) {
  if (!confirm('Voulez-vous vraiment supprimer cette annonce définitivement ?')) return;

  try {
    await fetch(`http://localhost:3000/api/annonces/${id}`, { method: 'DELETE' });
    afficherToast('🗑️ Annonce supprimée.');
    chargerAnnonces();
  } catch (erreur) {
    console.error(erreur);
    alert('⚠️ Impossible de supprimer.');
  }
}

// =====================
// PRE-INSCRIPTIONS — connecté à MySQL via le backend Express
// =====================

let preinscriptionsCache = [];

async function chargerPreinscriptions() {
  const tbody = document.getElementById('admin-preinscriptions-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Chargement des données...</td></tr>`;

  try {
    const reponse = await fetch('http://localhost:3000/api/preinscription');
    if (!reponse.ok) throw new Error('Erreur serveur');

    const donnees = await reponse.json();
    preinscriptionsCache = donnees.map(d => ({ ...d, statut: d.statut || 'en_attente' }));
    appliquerFiltresPreinscriptions();

  } catch (erreur) {
    console.error(erreur);
    tbody.innerHTML = `
      <tr><td colspan="6" class="admin-vide">
        ⚠️ Impossible de contacter le serveur backend.<br>
        Vérifiez que <code>node server.js</code> est bien lancé.
      </td></tr>
    `;
  }
}

function libelleStatut(statut) {
  const libelles = {
    en_attente: '<span class="badge attente">En attente</span>',
    accepte: '<span class="badge actif">Accepté</span>',
    rejete: '<span class="badge inactif" style="background:#fde8e8;color:var(--rouge)">Rejeté</span>'
  };
  return libelles[statut] || libelles.en_attente;
}

function afficherTableauPreinscriptions(liste) {
  const tbody = document.getElementById('admin-preinscriptions-body');
  if (!tbody) return;

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-vide">Aucune pré-inscription pour ces critères.</td></tr>`;
    return;
  }

  const triee = [...liste].sort((a, b) =>
    new Date(b.dateSoumission || b.date_soumission || 0) - new Date(a.dateSoumission || a.date_soumission || 0)
  );

  tbody.innerHTML = triee.map(p => {
    const nomComplet = `${p.nom || ''} ${p.postnom || ''} ${p.prenom || ''}`.trim();
    const dateBrute = p.dateSoumission || p.date_soumission;
    const dateAffichee = dateBrute ? new Date(dateBrute).toLocaleDateString('fr-FR') : '—';

    return `
      <tr>
        <td>${nomComplet || '—'}</td>
        <td>${p.specialite || '—'}</td>
        <td style="font-size:12px">${p.telephone || ''}<br>${p.email || ''}</td>
        <td>${dateAffichee}</td>
        <td>${libelleStatut(p.statut)}</td>
        <td class="admin-actions-cell">
          <button class="btn-icone" title="Voir le dossier" onclick="voirDetailPreinscription(${p.id})">👁️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function voirDetailPreinscription(id) {
  const p = preinscriptionsCache.find(x => x.id === id);
  if (!p) return;

  const contenu = document.getElementById('detail-preinscription-contenu');

  contenu.innerHTML = `
    <div id="zone-impression">
      <div class="fiche-entete">
        <img src="img/logo.png" alt="Logo UML" class="fiche-logo">
        <div>
          <p class="fiche-titre-uni">Université Méthodiste de Lubumbashi</p>
          <p class="fiche-sous-titre">Fiche de pré-inscription — Dossier n°${p.id}</p>
        </div>
      </div>

      <p class="fiche-section-titre">Identité</p>
      <div class="profil-ligne"><span class="profil-cle">Nom complet</span><span class="profil-val">${p.nom || ''} ${p.postnom || ''} ${p.prenom || ''}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Date de naissance</span><span class="profil-val">${p.dateNaissance || p.date_naissance || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Lieu de naissance</span><span class="profil-val">${p.lieuNaissance || p.lieu_naissance || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Nationalité</span><span class="profil-val">${p.nationalite || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Sexe</span><span class="profil-val">${p.sexe === 'M' ? 'Masculin' : p.sexe === 'F' ? 'Féminin' : '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">État civil</span><span class="profil-val">${p.etatCivil || p.etat_civil || '—'}</span></div>

      <p class="fiche-section-titre">Contact</p>
      <div class="profil-ligne"><span class="profil-cle">Adresse</span><span class="profil-val">${p.adresse1 || '—'} ${p.adresse2 ? '— ' + p.adresse2 : ''}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Téléphone</span><span class="profil-val">${p.telephone || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Email</span><span class="profil-val">${p.email || '—'}</span></div>

      <p class="fiche-section-titre">Responsables / Tuteurs</p>
      <div class="profil-ligne"><span class="profil-cle">Père</span><span class="profil-val">${p.nomPere || p.nom_pere || '—'} ${p.telPere || p.tel_pere ? '— ' + (p.telPere || p.tel_pere) : ''}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Mère</span><span class="profil-val">${p.nomMere || p.nom_mere || '—'} ${p.telMere || p.tel_mere ? '— ' + (p.telMere || p.tel_mere) : ''}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Tuteur</span><span class="profil-val">${p.nomTuteur || p.nom_tuteur || '—'} ${p.telTuteur || p.tel_tuteur ? '— ' + (p.telTuteur || p.tel_tuteur) : ''}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Adresse d'urgence</span><span class="profil-val">${p.adresseUrgence || p.adresse_urgence || '—'}</span></div>

      <p class="fiche-section-titre">Études secondaires</p>
      <div class="profil-ligne"><span class="profil-cle">École fréquentée</span><span class="profil-val">${p.ecole || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Ville de l'école</span><span class="profil-val">${p.villeEcole || p.ville_ecole || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">N° du diplôme</span><span class="profil-val">${p.numDiplome || p.num_diplome || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Pourcentage obtenu</span><span class="profil-val">${p.pourcentage || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Année d'obtention</span><span class="profil-val">${p.anneeDiplome || p.annee_diplome || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Section suivie</span><span class="profil-val">${p.sectionSecondaire || p.section_secondaire || '—'}</span></div>

      <p class="fiche-section-titre">Choix du programme</p>
      <div class="profil-ligne"><span class="profil-cle">1er choix</span><span class="profil-val">${p.specialite || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">2e choix</span><span class="profil-val">${p.specialite2 || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Niveau souhaité</span><span class="profil-val">${p.niveau || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Redoublant</span><span class="profil-val">${p.redoublant ? 'Oui' : 'Non'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">En activité professionnelle</span><span class="profil-val">${p.professionnel ? 'Oui' : 'Non'}</span></div>

      <p class="fiche-section-titre">Personne de référence</p>
      <div class="profil-ligne"><span class="profil-cle">Nom complet</span><span class="profil-val">${p.refNom || p.ref_nom || ''} ${p.refPostnom || p.ref_postnom || ''} ${p.refPrenom || p.ref_prenom || ''}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Téléphone</span><span class="profil-val">${p.refTelephone || p.ref_telephone || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Email</span><span class="profil-val">${p.refEmail || p.ref_email || '—'}</span></div>

      <p class="fiche-section-titre">Informations complémentaires</p>
      <div class="profil-ligne"><span class="profil-cle">Canal de découverte</span><span class="profil-val">${p.canalDecouverte || p.canal_decouverte || '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Date de soumission</span><span class="profil-val">${(p.dateSoumission || p.date_soumission) ? new Date(p.dateSoumission || p.date_soumission).toLocaleString('fr-FR') : '—'}</span></div>
      <div class="profil-ligne"><span class="profil-cle">Statut actuel</span><span class="profil-val">${libelleStatut(p.statut)}</span></div>
    </div>
  `;

  const actions = document.getElementById('actions-preinscription');
  actions.innerHTML = `
    <button class="btn-annuler" onclick="imprimerDossier()">🖨️ Imprimer</button>
    <button class="btn-annuler" onclick="changerStatutPreinscription(${p.id}, 'rejete')">❌ Rejeter</button>
    <button class="btn-sauvegarder" onclick="changerStatutPreinscription(${p.id}, 'accepte')">✅ Accepter</button>
  `;

  document.getElementById('modal-preinscription').classList.add('active');
}

function fermerModalPreinscription() {
  document.getElementById('modal-preinscription').classList.remove('active');
}

function imprimerDossier() {
  const contenu = document.getElementById('zone-impression').innerHTML;
  const fenetreImpression = window.open('', '_blank', 'width=800,height=900');

  fenetreImpression.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Fiche de pré-inscription — UML</title>
      <style>
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; font-size: 11px; line-height: 1.4; }
        .fiche-entete { display: flex; align-items: center; gap: 12px; border-bottom: 2.5px solid #f0c020; padding-bottom: 10px; margin-bottom: 12px; }
        .fiche-logo { height: 42px; }
        .fiche-titre-uni { font-size: 14px; font-weight: 700; color: #1a3a6b; margin: 0; }
        .fiche-sous-titre { font-size: 11px; color: #666; margin: 2px 0 0; }
        .fiche-section-titre { font-size: 11.5px; font-weight: 700; color: #1a3a6b; margin: 10px 0 4px; padding-top: 6px; border-top: 1px solid #ddd; break-inside: avoid; }
        .fiche-section-titre:first-of-type { border-top: none; margin-top: 0; }
        .profil-ligne { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 0; border-bottom: 0.5px dotted #ccc; break-inside: avoid; }
        .profil-cle { color: #666; font-size: 10.5px; flex: 0 0 42%; }
        .profil-val { color: #111; font-weight: 600; text-align: right; flex: 1; font-size: 10.5px; }
      </style>
    </head>
    <body>${contenu}</body>
    </html>
  `);

  fenetreImpression.document.close();
  fenetreImpression.focus();
  setTimeout(() => fenetreImpression.print(), 400);
}

async function changerStatutPreinscription(id, nouveauStatut) {
  try {
    const reponse = await fetch(`http://localhost:3000/api/preinscription/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: nouveauStatut })
    });

    let donnees = null;
    try { donnees = await reponse.json(); } catch (e) { donnees = null; }

    if (!reponse.ok) {
      const messageErreur = donnees?.erreur || `Erreur ${reponse.status}`;
      throw new Error(messageErreur);
    }

    const p = preinscriptionsCache.find(x => x.id === id);
    if (p) p.statut = (donnees && donnees.dossier) ? donnees.dossier.statut : nouveauStatut;

    fermerModalPreinscription();
    appliquerFiltresPreinscriptions();

    const messages = {
      accepte: '✅ Candidature acceptée et enregistrée !',
      rejete: '❌ Candidature rejetée et enregistrée.'
    };
    afficherToast(messages[nouveauStatut]);

  } catch (erreur) {
    console.error('Erreur changerStatutPreinscription:', erreur);
    alert('⚠️ ' + erreur.message + '\n\nSi le statut a bien changé malgré ce message, actualisez la liste pour vérifier.');
  }
}

function appliquerFiltresPreinscriptions() {
  const termeEl = document.getElementById('recherche-preinscriptions');
  const statutEl = document.getElementById('filtre-statut-preinscription');
  const terme = termeEl ? termeEl.value.toLowerCase() : '';
  const statut = statutEl ? statutEl.value : '';

  let resultat = preinscriptionsCache;

  if (terme) {
    resultat = resultat.filter(p => {
      const nomComplet = `${p.nom || ''} ${p.postnom || ''} ${p.prenom || ''}`.toLowerCase();
      return nomComplet.includes(terme) || (p.specialite || '').toLowerCase().includes(terme);
    });
  }

  if (statut) {
    resultat = resultat.filter(p => p.statut === statut);
  }

  afficherTableauPreinscriptions(resultat);
}

// =====================
// INITIALISATION GLOBALE — un seul DOMContentLoaded pour tout
// =====================

document.addEventListener('DOMContentLoaded', () => {
  // Connexion (page admin.html)
  const champPass = document.getElementById('admin-pass');
  if (champPass) {
    champPass.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') connexionAdmin();
    });
  }

  // Compteurs vue d'ensemble
  const cptEtudiants = document.getElementById('cpt-etudiants');
  if (cptEtudiants) {
    cptEtudiants.textContent = '1';
    document.getElementById('cpt-preinscriptions').textContent = '0';
    document.getElementById('cpt-cours').textContent = '8';
    document.getElementById('cpt-annonces').textContent = '5';
  }

  // Notes
  if (document.getElementById('admin-notes')) {
    chargerNotes();
    const champRecherche = document.getElementById('recherche-notes');
    if (champRecherche) {
      champRecherche.addEventListener('input', (e) => {
        const terme = e.target.value.toLowerCase();
        const filtres = notesAdmin.filter(n =>
          `${n.nom_etudiant} ${n.prenom_etudiant}`.toLowerCase().includes(terme) ||
          n.matiere.toLowerCase().includes(terme) ||
          n.etudiant_id.toLowerCase().includes(terme)
        );
        afficherTableauNotes(filtres);
      });
    }
  }

  // Horaires
  if (document.getElementById('admin-horaires')) {
    chargerHoraires();
    ['filtre-annee', 'filtre-promotion', 'filtre-jour'].forEach(idFiltre => {
      const el = document.getElementById(idFiltre);
      if (el) el.addEventListener('change', chargerHoraires);
    });
  }

  // Programme
  if (document.getElementById('admin-programme')) {
    chargerProgramme();
    ['filtre-prog-annee', 'filtre-prog-promotion', 'filtre-prog-semestre'].forEach(idFiltre => {
      const el = document.getElementById(idFiltre);
      if (el) el.addEventListener('change', chargerProgramme);
    });
  }

  // Annonces
  if (document.getElementById('admin-annonces')) {
    chargerAnnonces();
    const typeSelect = document.getElementById('annonce-type');
    if (typeSelect) typeSelect.addEventListener('change', gererAffichageChampImage);
    const filtreType = document.getElementById('filtre-type-annonce');
    if (filtreType) filtreType.addEventListener('change', chargerAnnonces);
  }

  // Pré-inscriptions
  if (document.getElementById('admin-preinscriptions')) {
    chargerPreinscriptions();
    const rechPre = document.getElementById('recherche-preinscriptions');
    if (rechPre) rechPre.addEventListener('input', appliquerFiltresPreinscriptions);
    const statutPre = document.getElementById('filtre-statut-preinscription');
    if (statutPre) statutPre.addEventListener('change', appliquerFiltresPreinscriptions);
  }
});