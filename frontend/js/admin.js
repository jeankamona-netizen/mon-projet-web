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