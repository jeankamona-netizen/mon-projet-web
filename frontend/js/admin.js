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