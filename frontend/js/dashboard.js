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