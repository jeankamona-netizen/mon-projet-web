// =====================
// CONNEXION ADMINISTRATEUR (vérification simple en attendant MySQL)
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

// Validation avec la touche Entrée
document.addEventListener('DOMContentLoaded', () => {
  const champPass = document.getElementById('admin-pass');
  if (champPass) {
    champPass.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') connexionAdmin();
    });
  }

  // Compteurs de la vue d'ensemble (dashboard admin)
  const cptEtudiants = document.getElementById('cpt-etudiants');
  if (cptEtudiants) {
    cptEtudiants.textContent = '1';
    document.getElementById('cpt-preinscriptions').textContent = '0';
    document.getElementById('cpt-cours').textContent = '8';
    document.getElementById('cpt-annonces').textContent = '5';
  }
});

// =====================
// GESTION DES NOTES (admin) — stockage en mémoire (en attendant MySQL)
// =====================

let notesAdmin = [
  { id: 1, etudiant: "UML-2024-0012", nomEtudiant: "Jean Kamona Netizen", matiere: "Algorithmique avancée", note: 15, session: "S1" },
  { id: 2, etudiant: "UML-2024-0012", nomEtudiant: "Jean Kamona Netizen", matiere: "Base de données", note: 12, session: "S1" },
  { id: 3, etudiant: "UML-2024-0012", nomEtudiant: "Jean Kamona Netizen", matiere: "Réseaux & Télécom", note: 8, session: "S1" },
  { id: 4, etudiant: "UML-2024-0012", nomEtudiant: "Jean Kamona Netizen", matiere: "Programmation Web", note: 16, session: "S1" },
];
let prochainIdNote = 5;

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
        <td>${n.nomEtudiant}<br><span style="font-size:11px;color:#999">${n.etudiant}</span></td>
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

// ===== OUVRIR LE MODAL (ajout) =====
function ouvrirModalNote() {
  document.getElementById('modal-note-titre').textContent = 'Ajouter une note';
  document.getElementById('note-id-edit').value = '';
  document.getElementById('note-etudiant').value = 'UML-2024-0012';
  document.getElementById('note-matiere').selectedIndex = 0;
  document.getElementById('note-valeur').value = '';
  document.getElementById('note-session').value = 'S1';
  document.getElementById('modal-note').classList.add('active');
}

// ===== OUVRIR LE MODAL (modification) =====
function modifierNote(id) {
  const note = notesAdmin.find(n => n.id === id);
  if (!note) return;

  document.getElementById('modal-note-titre').textContent = 'Modifier la note';
  document.getElementById('note-id-edit').value = note.id;
  document.getElementById('note-etudiant').value = note.etudiant;
  document.getElementById('note-matiere').value = note.matiere;
  document.getElementById('note-valeur').value = note.note;
  document.getElementById('note-session').value = note.session;
  document.getElementById('modal-note').classList.add('active');
}

// ===== FERMER LE MODAL =====
function fermerModalNote() {
  document.getElementById('modal-note').classList.remove('active');
}

// ===== ENREGISTRER (ajout ou modification) =====
function sauvegarderNote() {
  const idEdit = document.getElementById('note-id-edit').value;
  const etudiant = document.getElementById('note-etudiant').value;
  const matiere = document.getElementById('note-matiere').value;
  const valeur = parseFloat(document.getElementById('note-valeur').value);
  const session = document.getElementById('note-session').value;

  if (isNaN(valeur) || valeur < 0 || valeur > 20) {
    alert('⚠️ Veuillez saisir une note valide entre 0 et 20.');
    return;
  }

  const nomEtudiant = "Jean Kamona Netizen"; // en attendant une vraie liste d'étudiants (MySQL)

  if (idEdit) {
    // Modification
    const note = notesAdmin.find(n => n.id === parseInt(idEdit));
    note.etudiant = etudiant;
    note.matiere = matiere;
    note.note = valeur;
    note.session = session;
    afficherToast('✅ Note modifiée avec succès !');
  } else {
    // Ajout
    notesAdmin.push({
      id: prochainIdNote++,
      etudiant, nomEtudiant, matiere, note: valeur, session
    });
    afficherToast('✅ Note ajoutée avec succès !');
  }

  fermerModalNote();
  afficherTableauNotes();
}

// ===== SUPPRIMER =====
function supprimerNote(id) {
  if (!confirm('Voulez-vous vraiment supprimer cette note ?')) return;

  notesAdmin = notesAdmin.filter(n => n.id !== id);
  afficherTableauNotes();
  afficherToast('🗑️ Note supprimée.');
}

// ===== RECHERCHE =====
document.addEventListener('DOMContentLoaded', () => {
  afficherTableauNotes();

  const champRecherche = document.getElementById('recherche-notes');
  if (champRecherche) {
    champRecherche.addEventListener('input', (e) => {
      const terme = e.target.value.toLowerCase();
      const filtres = notesAdmin.filter(n =>
        n.nomEtudiant.toLowerCase().includes(terme) ||
        n.matiere.toLowerCase().includes(terme) ||
        n.etudiant.toLowerCase().includes(terme)
      );
      afficherTableauNotes(filtres);
    });
  }
});

// ===== TOAST (réutilise la fonction si déjà définie dans dashboard.js) =====
if (typeof afficherToast === 'undefined') {
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
}
// =====================
// GESTION DES HORAIRES (admin) — avec promotion + année académique
// =====================

const ORDRE_JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

let horairesAdmin = [
  { id: 1, promotion: "L2 Informatique", annee: "2025-2026", jour: "Lundi", debut: "07:30", fin: "09:30", cours: "Algorithmique avancée", prof: "Prof. Mutombo", salle: "Salle A12" },
  { id: 2, promotion: "L2 Informatique", annee: "2025-2026", jour: "Lundi", debut: "10:00", fin: "12:00", cours: "Base de données", prof: "Prof. Kabwe", salle: "Info 1" },
  { id: 3, promotion: "L2 Informatique", annee: "2025-2026", jour: "Mardi", debut: "07:30", fin: "09:30", cours: "Réseaux & Télécom", prof: "Prof. Ilunga", salle: "Salle B04" },
  { id: 4, promotion: "L2 Informatique", annee: "2025-2026", jour: "Mardi", debut: "14:00", fin: "16:00", cours: "Programmation Web", prof: "Prof. Kasongo", salle: "Info 2" },
  { id: 5, promotion: "L2 Informatique", annee: "2025-2026", jour: "Mercredi", debut: "07:30", fin: "09:30", cours: "Système d'exploitation", prof: "Prof. Mbuyi", salle: "Salle A08" },
  { id: 6, promotion: "L2 Informatique", annee: "2025-2026", jour: "Jeudi", debut: "10:00", fin: "12:00", cours: "Intelligence artificielle", prof: "Prof. Tshimanga", salle: "Info 1" },
  { id: 7, promotion: "L2 Informatique", annee: "2025-2026", jour: "Vendredi", debut: "07:30", fin: "09:30", cours: "Génie logiciel", prof: "Prof. Luboya", salle: "Salle A12" },
  { id: 8, promotion: "L2 Informatique", annee: "2025-2026", jour: "Vendredi", debut: "10:00", fin: "12:00", cours: "Sécurité informatique", prof: "Prof. Kabamba", salle: "Info 2" },
  { id: 9, promotion: "L1 Informatique", annee: "2024-2025", jour: "Lundi", debut: "07:30", fin: "09:30", cours: "Algorithmique avancée", prof: "Prof. Mutombo", salle: "Salle A12" },
];
let prochainIdHoraire = 10;

function trierHoraires(liste) {
  return [...liste].sort((a, b) => {
    if (a.annee !== b.annee) return b.annee.localeCompare(a.annee); // années récentes en premier
    if (a.promotion !== b.promotion) return a.promotion.localeCompare(b.promotion);
    const diffJour = ORDRE_JOURS.indexOf(a.jour) - ORDRE_JOURS.indexOf(b.jour);
    if (diffJour !== 0) return diffJour;
    return a.debut.localeCompare(b.debut);
  });
}

function afficherTableauHoraires(liste = horairesAdmin) {
  const tbody = document.getElementById('admin-horaires-body');
  if (!tbody) return;

  const triee = trierHoraires(liste);

  if (triee.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="admin-vide">Aucun cours programmé pour ces critères.</td></tr>`;
    return;
  }

  tbody.innerHTML = triee.map(h => `
    <tr>
      <td><strong>${h.promotion}</strong></td>
      <td><span class="annee-badge">${h.annee}</span></td>
      <td><span class="jour-badge">${h.jour}</span></td>
      <td>${h.debut} – ${h.fin}</td>
      <td>${h.cours}</td>
      <td>${h.prof}</td>
      <td>${h.salle}</td>
      <td class="admin-actions-cell">
        <button class="btn-icone" title="Modifier" onclick="modifierHoraire(${h.id})">✏️</button>
        <button class="btn-icone danger" title="Supprimer" onclick="supprimerHoraire(${h.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// ===== FILTRAGE COMBINÉ (année + promotion + jour) =====
function appliquerFiltresHoraires() {
  const annee = document.getElementById('filtre-annee').value;
  const promotion = document.getElementById('filtre-promotion').value;
  const jour = document.getElementById('filtre-jour').value;

  let resultat = horairesAdmin;
  if (annee) resultat = resultat.filter(h => h.annee === annee);
  if (promotion) resultat = resultat.filter(h => h.promotion === promotion);
  if (jour) resultat = resultat.filter(h => h.jour === jour);

  afficherTableauHoraires(resultat);
}

// ===== OUVRIR LE MODAL (ajout) =====
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

// ===== OUVRIR LE MODAL (modification) =====
function modifierHoraire(id) {
  const h = horairesAdmin.find(x => x.id === id);
  if (!h) return;

  document.getElementById('modal-horaire-titre').textContent = 'Modifier le cours';
  document.getElementById('horaire-id-edit').value = h.id;
  document.getElementById('horaire-promotion').value = h.promotion;
  document.getElementById('horaire-annee').value = h.annee;
  document.getElementById('horaire-jour').value = h.jour;
  document.getElementById('horaire-debut').value = h.debut;
  document.getElementById('horaire-fin').value = h.fin;
  document.getElementById('horaire-cours').value = h.cours;
  document.getElementById('horaire-prof').value = h.prof;
  document.getElementById('horaire-salle').value = h.salle;
  document.getElementById('modal-horaire').classList.add('active');
}

// ===== FERMER LE MODAL =====
function fermerModalHoraire() {
  document.getElementById('modal-horaire').classList.remove('active');
}

// ===== ENREGISTRER (ajout ou modification) =====
function sauvegarderHoraire() {
  const idEdit = document.getElementById('horaire-id-edit').value;
  const promotion = document.getElementById('horaire-promotion').value;
  const annee = document.getElementById('horaire-annee').value;
  const jour = document.getElementById('horaire-jour').value;
  const debut = document.getElementById('horaire-debut').value;
  const fin = document.getElementById('horaire-fin').value;
  const cours = document.getElementById('horaire-cours').value;
  const prof = document.getElementById('horaire-prof').value.trim();
  const salle = document.getElementById('horaire-salle').value.trim();

  if (!debut || !fin || !prof || !salle) {
    alert('⚠️ Veuillez remplir tous les champs.');
    return;
  }

  if (fin <= debut) {
    alert('⚠️ L\'heure de fin doit être après l\'heure de début.');
    return;
  }

  // Conflit de salle : même ANNÉE, même JOUR, même SALLE, créneaux qui se chevauchent
  // → deux promotions différentes la même année ne peuvent pas partager la salle au même moment
  // → mais la même salle/jour/heure sur une AUTRE année n'est pas un conflit (historique)
  const conflitSalle = horairesAdmin.find(h =>
    h.id !== parseInt(idEdit || -1) &&
    h.annee === annee &&
    h.jour === jour &&
    h.salle === salle &&
    debut < h.fin && fin > h.debut
  );

  if (conflitSalle) {
    alert(`⚠️ Conflit de salle : ${salle} est déjà occupée le ${jour} de ${conflitSalle.debut} à ${conflitSalle.fin} (${conflitSalle.promotion}, ${conflitSalle.annee}).`);
    return;
  }

  // Conflit de promotion : la même promotion ne peut pas avoir 2 cours en même temps la même année
  const conflitPromotion = horairesAdmin.find(h =>
    h.id !== parseInt(idEdit || -1) &&
    h.annee === annee &&
    h.promotion === promotion &&
    h.jour === jour &&
    debut < h.fin && fin > h.debut
  );

  if (conflitPromotion) {
    alert(`⚠️ Conflit d'horaire : ${promotion} a déjà cours de ${conflitPromotion.debut} à ${conflitPromotion.fin} le ${jour} (${conflitPromotion.cours}).`);
    return;
  }

  if (idEdit) {
    const h = horairesAdmin.find(x => x.id === parseInt(idEdit));
    Object.assign(h, { promotion, annee, jour, debut, fin, cours, prof, salle });
    afficherToast('✅ Cours modifié avec succès !');
  } else {
    horairesAdmin.push({
      id: prochainIdHoraire++,
      promotion, annee, jour, debut, fin, cours, prof, salle
    });
    afficherToast('✅ Cours ajouté à l\'horaire !');
  }

  fermerModalHoraire();
  appliquerFiltresHoraires();
}

// ===== SUPPRIMER =====
function supprimerHoraire(id) {
  if (!confirm('Voulez-vous vraiment supprimer ce cours de l\'horaire ?')) return;

  horairesAdmin = horairesAdmin.filter(h => h.id !== id);
  appliquerFiltresHoraires();
  afficherToast('🗑️ Cours supprimé de l\'horaire.');
}

// ===== INITIALISATION DES FILTRES =====
document.addEventListener('DOMContentLoaded', () => {
  afficherTableauHoraires();

  ['filtre-annee', 'filtre-promotion', 'filtre-jour'].forEach(idFiltre => {
    const el = document.getElementById(idFiltre);
    if (el) el.addEventListener('change', appliquerFiltresHoraires);
  });
});

// =====================
// GESTION DES ANNONCES & ÉVÉNEMENTS (admin)
// =====================

let annoncesAdmin = [
  { id: 1, type: "annonce", titre: "Début des inscriptions", description: "Du 01/08 au 09/09/2026", date: "2026-08-01", icone: "📅", image: "", actif: true },
  { id: 2, type: "annonce", titre: "Rentrée académique 2025-2026", description: "Début des cours en présentiel", date: "2026-09-10", icone: "🎓", image: "", actif: true },
  { id: 3, type: "evenement", titre: "Collation des grades", description: "Cérémonie de remise des diplômes — promotion 2025", date: "2025-12-15", icone: "🏆", image: "collation.jpg", actif: true },
  { id: 4, type: "evenement", titre: "Modernisation informatique", description: "Acquisition de nouvelles machines pour la salle informatique", date: "2026-06-18", icone: "📋", image: "acquisition.jpg", actif: true },
];
let prochainIdAnnonce = 5;

function formatDateAffichage(dateStr) {
  const [annee, mois, jour] = dateStr.split('-');
  const mois_noms = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
  return `${jour} ${mois_noms[parseInt(mois) - 1]} ${annee}`;
}

function afficherTableauAnnonces(liste = annoncesAdmin) {
  const tbody = document.getElementById('admin-annonces-body');
  if (!tbody) return;

  const triee = [...liste].sort((a, b) => b.date.localeCompare(a.date));

  if (triee.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-vide">Aucune annonce pour ces critères.</td></tr>`;
    return;
  }

  tbody.innerHTML = triee.map(a => `
    <tr>
      <td>${a.icone} ${a.titre}</td>
      <td><span class="type-badge ${a.type}">${a.type === 'annonce' ? 'Annonce' : 'Événement'}</span></td>
      <td>${formatDateAffichage(a.date)}</td>
      <td><span class="badge ${a.actif ? 'actif' : 'inactif'}">${a.actif ? 'Actif' : 'Masqué'}</span></td>
      <td class="admin-actions-cell">
        <button class="btn-icone" title="${a.actif ? 'Masquer' : 'Activer'}" onclick="toggleActifAnnonce(${a.id})">${a.actif ? '👁️' : '🚫'}</button>
        <button class="btn-icone" title="Modifier" onclick="modifierAnnonce(${a.id})">✏️</button>
        <button class="btn-icone danger" title="Supprimer" onclick="supprimerAnnonce(${a.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// ===== AFFICHER/CACHER LE CHAMP IMAGE SELON LE TYPE =====
function gererAffichageChampImage() {
  const type = document.getElementById('annonce-type').value;
  document.getElementById('champ-image-evenement').style.display = type === 'evenement' ? 'block' : 'none';
}

// ===== OUVRIR LE MODAL (ajout) =====
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

// ===== OUVRIR LE MODAL (modification) =====
function modifierAnnonce(id) {
  const a = annoncesAdmin.find(x => x.id === id);
  if (!a) return;

  document.getElementById('modal-annonce-titre').textContent = 'Modifier l\'annonce';
  document.getElementById('annonce-id-edit').value = a.id;
  document.getElementById('annonce-type').value = a.type;
  document.getElementById('annonce-titre-input').value = a.titre;
  document.getElementById('annonce-description').value = a.description;
  document.getElementById('annonce-date').value = a.date;
  document.getElementById('annonce-icone').value = a.icone;
  if (a.image) document.getElementById('annonce-image').value = a.image;
  document.getElementById('annonce-actif').checked = a.actif;
  gererAffichageChampImage();
  document.getElementById('modal-annonce').classList.add('active');
}

// ===== FERMER LE MODAL =====
function fermerModalAnnonce() {
  document.getElementById('modal-annonce').classList.remove('active');
}

// ===== ENREGISTRER (ajout ou modification) =====
function sauvegarderAnnonce() {
  const idEdit = document.getElementById('annonce-id-edit').value;
  const type = document.getElementById('annonce-type').value;
  const titre = document.getElementById('annonce-titre-input').value.trim();
  const description = document.getElementById('annonce-description').value.trim();
  const date = document.getElementById('annonce-date').value;
  const icone = document.getElementById('annonce-icone').value;
  const image = type === 'evenement' ? document.getElementById('annonce-image').value : '';
  const actif = document.getElementById('annonce-actif').checked;

  if (!titre || !description || !date) {
    alert('⚠️ Veuillez remplir tous les champs obligatoires.');
    return;
  }

  if (idEdit) {
    const a = annoncesAdmin.find(x => x.id === parseInt(idEdit));
    Object.assign(a, { type, titre, description, date, icone, image, actif });
    afficherToast('✅ Annonce modifiée avec succès !');
  } else {
    annoncesAdmin.push({
      id: prochainIdAnnonce++,
      type, titre, description, date, icone, image, actif
    });
    afficherToast('✅ Annonce publiée avec succès !');
  }

  fermerModalAnnonce();
  appliquerFiltreAnnonces();
}

// ===== ACTIVER/DESACTIVER =====
function toggleActifAnnonce(id) {
  const a = annoncesAdmin.find(x => x.id === id);
  if (!a) return;

  a.actif = !a.actif;
  appliquerFiltreAnnonces();
  afficherToast(a.actif ? '👁️ Annonce activée sur le site' : '🚫 Annonce masquée du site');
}

// ===== SUPPRIMER =====
function supprimerAnnonce(id) {
  if (!confirm('Voulez-vous vraiment supprimer cette annonce définitivement ?')) return;

  annoncesAdmin = annoncesAdmin.filter(a => a.id !== id);
  appliquerFiltreAnnonces();
  afficherToast('🗑️ Annonce supprimée.');
}

// ===== FILTRE PAR TYPE =====
function appliquerFiltreAnnonces() {
  const type = document.getElementById('filtre-type-annonce').value;
  const resultat = type ? annoncesAdmin.filter(a => a.type === type) : annoncesAdmin;
  afficherTableauAnnonces(resultat);
}

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', () => {
  afficherTableauAnnonces();

  const typeSelect = document.getElementById('annonce-type');
  if (typeSelect) typeSelect.addEventListener('change', gererAffichageChampImage);

  const filtreType = document.getElementById('filtre-type-annonce');
  if (filtreType) filtreType.addEventListener('change', appliquerFiltreAnnonces);
});

// =====================
// GESTION DU PROGRAMME ANNUEL (admin)
// =====================

let programmeAdmin = [
  { id: 1, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S1", code: "INF201", nom: "Algorithmique avancée", credits: 4 },
  { id: 2, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S1", code: "INF202", nom: "Base de données", credits: 4 },
  { id: 3, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S1", code: "INF203", nom: "Réseaux & Télécom", credits: 3 },
  { id: 4, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S1", code: "INF204", nom: "Programmation Web", credits: 4 },
  { id: 5, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S1", code: "INF205", nom: "Système d'exploitation", credits: 3 },
  { id: 6, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S2", code: "INF206", nom: "Intelligence artificielle", credits: 4 },
  { id: 7, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S2", code: "INF207", nom: "Génie logiciel", credits: 4 },
  { id: 8, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S2", code: "INF208", nom: "Sécurité informatique", credits: 3 },
  { id: 9, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S2", code: "INF209", nom: "Projet de fin d'année", credits: 6 },
  { id: 10, promotion: "L2 Informatique", annee: "2025-2026", semestre: "S2", code: "INF210", nom: "Stage professionnel", credits: 3 },
];
let prochainIdProgramme = 11;

function afficherProgramme() {
  const annee = document.getElementById('filtre-annee-prog').value || '2025-2026';
  const promotion = document.getElementById('filtre-promotion-prog').value || 'L2 Informatique';

  const filtres = programmeAdmin.filter(p =>
    (!document.getElementById('filtre-annee-prog').value || p.annee === annee) &&
    (!document.getElementById('filtre-promotion-prog').value || p.promotion === promotion)
  );

  remplirTableProgramme('S1', filtres.filter(p => p.semestre === 'S1'));
  remplirTableProgramme('S2', filtres.filter(p => p.semestre === 'S2'));
}

function remplirTableProgramme(semestre, liste) {
  const tbody = document.getElementById(`prog-${semestre.toLowerCase()}-body`);
  const totalEl = document.getElementById(`prog-${semestre.toLowerCase()}-total`);

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-vide">Aucun cours pour ces critères.</td></tr>`;
    totalEl.textContent = '0';
    return;
  }

  tbody.innerHTML = liste.map(p => `
    <tr>
      <td><span class="annee-badge">${p.code}</span></td>
      <td>${p.nom}</td>
      <td>${p.credits}</td>
      <td class="admin-actions-cell">
        <button class="btn-icone" title="Modifier" onclick="modifierProgramme(${p.id})">✏️</button>
        <button class="btn-icone danger" title="Supprimer" onclick="supprimerProgramme(${p.id})">🗑️</button>
      </td>
    </tr>
  `).join('');

  const total = liste.reduce((somme, p) => somme + p.credits, 0);
  totalEl.textContent = total;
}

// ===== OUVRIR LE MODAL (ajout) =====
function ouvrirModalProgramme() {
  document.getElementById('modal-programme-titre').textContent = 'Ajouter un cours au programme';
  document.getElementById('prog-id-edit').value = '';
  document.getElementById('prog-promotion').selectedIndex = 0;
  document.getElementById('prog-annee').value = '2025-2026';
  document.getElementById('prog-semestre').value = 'S1';
  document.getElementById('prog-code').value = '';
  document.getElementById('prog-credits').value = '';
  document.getElementById('prog-nom').value = '';
  document.getElementById('modal-programme').classList.add('active');
}

// ===== OUVRIR LE MODAL (modification) =====
function modifierProgramme(id) {
  const p = programmeAdmin.find(x => x.id === id);
  if (!p) return;

  document.getElementById('modal-programme-titre').textContent = 'Modifier le cours';
  document.getElementById('prog-id-edit').value = p.id;
  document.getElementById('prog-promotion').value = p.promotion;
  document.getElementById('prog-annee').value = p.annee;
  document.getElementById('prog-semestre').value = p.semestre;
  document.getElementById('prog-code').value = p.code;
  document.getElementById('prog-credits').value = p.credits;
  document.getElementById('prog-nom').value = p.nom;
  document.getElementById('modal-programme').classList.add('active');
}

// ===== FERMER LE MODAL =====
function fermerModalProgramme() {
  document.getElementById('modal-programme').classList.remove('active');
}

// ===== ENREGISTRER =====
function sauvegarderProgramme() {
  const idEdit = document.getElementById('prog-id-edit').value;
  const promotion = document.getElementById('prog-promotion').value;
  const annee = document.getElementById('prog-annee').value;
  const semestre = document.getElementById('prog-semestre').value;
  const code = document.getElementById('prog-code').value.trim();
  const credits = parseInt(document.getElementById('prog-credits').value);
  const nom = document.getElementById('prog-nom').value.trim();

  if (!code || !nom || !credits || credits < 1) {
    alert('⚠️ Veuillez remplir tous les champs avec des valeurs valides.');
    return;
  }

  // Empêche le doublon de code pour la même promotion/année
  const doublon = programmeAdmin.find(p =>
    p.id !== parseInt(idEdit || -1) &&
    p.code === code &&
    p.promotion === promotion &&
    p.annee === annee
  );

  if (doublon) {
    alert(`⚠️ Le code ${code} existe déjà dans le programme de ${promotion} (${annee}).`);
    return;
  }

  if (idEdit) {
    const p = programmeAdmin.find(x => x.id === parseInt(idEdit));
    Object.assign(p, { promotion, annee, semestre, code, nom, credits });
    afficherToast('✅ Cours du programme modifié !');
  } else {
    programmeAdmin.push({
      id: prochainIdProgramme++,
      promotion, annee, semestre, code, nom, credits
    });
    afficherToast('✅ Cours ajouté au programme !');
  }

  fermerModalProgramme();
  afficherProgramme();
}

// ===== SUPPRIMER =====
function supprimerProgramme(id) {
  if (!confirm('Voulez-vous vraiment retirer ce cours du programme ?')) return;

  programmeAdmin = programmeAdmin.filter(p => p.id !== id);
  afficherProgramme();
  afficherToast('🗑️ Cours retiré du programme.');
}

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', () => {
  afficherProgramme();

  ['filtre-annee-prog', 'filtre-promotion-prog'].forEach(idFiltre => {
    const el = document.getElementById(idFiltre);
    if (el) el.addEventListener('change', afficherProgramme);
  });
});