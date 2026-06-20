// ===== NAVIGATION SECTIONS =====
function afficherSection(id, lien) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  lien.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== FILTRE NOTES PAR SESSION =====
function filtrerSession(session, btn) {
  document.querySelectorAll('.filtre-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#notes-body tr').forEach(row => {
    row.style.display = row.dataset.session === session ? '' : 'none';
  });
}

// Afficher S1 par défaut
document.addEventListener('DOMContentLoaded', () => {
  filtrerSession('S1', document.querySelector('.filtre-btn'));
});

// ===== PROFIL EDITABLE =====
function toggleEdit(section) {
  const view = document.getElementById('view-' + section);
  const form = document.getElementById('edit-' + section);
  const btn  = document.getElementById('btn-edit-' + section);

  const isEditing = form.style.display === 'block';

  if (isEditing) {
    annulerEdit(section);
  } else {
    view.style.display = 'none';
    form.style.display = 'block';
    btn.textContent = '✕ Annuler';
    btn.classList.add('actif');
  }
}

function annulerEdit(section) {
  const view = document.getElementById('view-' + section);
  const form = document.getElementById('edit-' + section);
  const btn  = document.getElementById('btn-edit-' + section);

  view.style.display = 'flex';
  form.style.display = 'none';
  btn.textContent = '✏️ Modifier';
  btn.classList.remove('actif');
}

function sauvegarder(section) {
  if (section === 'perso') {
    document.getElementById('v-nom').textContent       = document.getElementById('e-nom').value;
    document.getElementById('v-nationalite').textContent = document.getElementById('e-nationalite').value;
    document.getElementById('v-tel').textContent       = document.getElementById('e-tel').value;
    document.getElementById('v-email').textContent     = document.getElementById('e-email').value;
    document.getElementById('v-adresse').textContent   = document.getElementById('e-adresse').value;

    const ddn = document.getElementById('e-ddn').value;
    if (ddn) {
      const [y, m, d] = ddn.split('-');
      document.getElementById('v-ddn').textContent = `${d}/${m}/${y}`;
    }
  }

  annulerEdit(section);
  afficherToast('✅ Informations mises à jour avec succès !');
}

// ===== MODIFIER MOT DE PASSE =====
function changerMotDePasse() {
  const actuel  = document.getElementById('mdp-actuel').value;
  const nouveau = document.getElementById('mdp-nouveau').value;
  const confirm = document.getElementById('mdp-confirm').value;

  if (!actuel || !nouveau || !confirm) {
    afficherToast('⚠️ Veuillez remplir tous les champs.', true);
    return;
  }

  if (nouveau !== confirm) {
    afficherToast('⚠️ Les mots de passe ne correspondent pas.', true);
    return;
  }

  if (nouveau.length < 6) {
    afficherToast('⚠️ Le mot de passe doit contenir au moins 6 caractères.', true);
    return;
  }

  document.getElementById('mdp-actuel').value  = '';
  document.getElementById('mdp-nouveau').value = '';
  document.getElementById('mdp-confirm').value = '';

  afficherToast('✅ Mot de passe modifié avec succès !');
}

// ===== TOAST NOTIFICATION =====
function afficherToast(message, erreur = false) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = 'toast' + (erreur ? ' erreur' : '');

  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => toast.classList.remove('visible'), 3500);
}
// =====================
// IA — ANALYSE DU SEMESTRE (basée sur les données réelles)
// =====================

// Mêmes données que celles affichées dans le tableau "Mes notes"
const notesEtudiant = [
  { matiere: "Algorithmique avancée",   note: 15, precedente: 11 },
  { matiere: "Base de données",          note: 12, precedente: 12 },
  { matiere: "Réseaux & Télécom",        note: 8,  precedente: 9  },
  { matiere: "Programmation Web",        note: 16, precedente: 12 },
  { matiere: "Système d'exploitation",   note: 11, precedente: 11 }
];

// Cours du jeudi (exemple basé sur vos horaires)
const chargeJeudi = [
  { matiere: "Base de données", heure: "10h00" },
  { matiere: "Intelligence artificielle", heure: "10h00" }
];

const SEUIL_REUSSITE = 10;
const SEUIL_PROGRES = 3; // points de progression jugés significatifs

function genererAnalyseIA() {
  const conteneur = document.getElementById('ia-alertes');
  const alertes = [];

  // 1. Détection des matières en échec
  const matieresFaibles = notesEtudiant.filter(n => n.note < SEUIL_REUSSITE);
  matieresFaibles.forEach(m => {
    alertes.push({
      type: 'danger',
      icone: '⚠️',
      texte: `<b>${m.matiere}</b> — ${m.note}/20, en dessous du seuil de réussite (10/20).`
    });
  });

  // 2. Détection de charge de travail élevée (2+ évaluations le même jour)
  if (chargeJeudi.length >= 2) {
    const liste = chargeJeudi.map(c => c.matiere).join(' et ');
    alertes.push({
      type: 'warn',
      icone: '⏰',
      texte: `Charge de travail élevée <b>jeudi</b> : ${chargeJeudi.length} évaluations le même jour (${liste}).`
    });
  }

  // 3. Détection de progression positive
  notesEtudiant.forEach(m => {
    const progres = m.note - m.precedente;
    if (progres >= SEUIL_PROGRES) {
      alertes.push({
        type: 'ok',
        icone: '📈',
        texte: `Progression constante en <b>${m.matiere}</b> : +${progres} points depuis le dernier contrôle.`
      });
    }
  });

  // Affichage
  if (alertes.length === 0) {
    conteneur.innerHTML = '<p class="ia-vide">Aucune alerte particulière — tout va bien ce semestre ! ✅</p>';
    return;
  }

  conteneur.innerHTML = alertes.map(a => `
    <div class="ia-alerte ${a.type === 'danger' ? '' : a.type}">
      <span class="ia-alerte-icon">${a.icone}</span>
      <span class="ia-alerte-texte">${a.texte}</span>
    </div>
  `).join('') + `
    <div class="ia-actions">
      <button class="ia-action-btn" onclick="afficherSection('horaires', document.querySelectorAll('.nav-item')[2])">
        📅 Voir mes horaires
      </button>
      <button class="ia-action-btn" onclick="afficherSection('mes-notes', document.querySelectorAll('.nav-item')[1])">
        📝 Voir mes notes
      </button>
    </div>
  `;
}

// Heure de mise à jour affichée
function afficherHeureIA() {
  const maintenant = new Date();
  const heures = String(maintenant.getHours()).padStart(2, '0');
  const minutes = String(maintenant.getMinutes()).padStart(2, '0');
  document.getElementById('ia-heure').textContent = `Mise à jour ${heures}h${minutes}`;
}

// Lancement au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  genererAnalyseIA();
  afficherHeureIA();
});