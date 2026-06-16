// ===== ONGLETS =====
function afficherOnglet(onglet) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('onglet-' + onglet).classList.add('active');
  const index = onglet === 'connexion' ? 0 : 1;
  document.querySelectorAll('.tab-btn')[index].classList.add('active');
}

// ===== ETAPES PRE-INSCRIPTION =====
let etapeActuelle = 1;

function allerEtape(numero) {
  // Marquer l'étape courante comme terminée
  document.getElementById('etape-' + etapeActuelle).classList.remove('active');
  document.getElementById('etape-' + etapeActuelle).classList.add('done');
  document.getElementById('form-etape-' + etapeActuelle).classList.remove('active');

  // Activer la nouvelle étape
  etapeActuelle = numero;
  document.getElementById('etape-' + etapeActuelle).classList.add('active');
  document.getElementById('etape-' + etapeActuelle).classList.remove('done');
  document.getElementById('form-etape-' + etapeActuelle).classList.add('active');

  // Remonter en haut du formulaire
  document.querySelector('.login-box').scrollIntoView({ behavior: 'smooth' });
}

// ===== AFFICHER/CACHER MOT DE PASSE =====
function togglePassword() {
  const input = document.getElementById('mot-de-passe');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ===== CONNEXION =====
function seConnecter() {
  const numero = document.getElementById('numero-etudiant').value.trim();
  const mdp = document.getElementById('mot-de-passe').value.trim();

  if (!numero || !mdp) {
    alert('⚠️ Veuillez remplir tous les champs.');
    return;
  }
  // Simulation — sera remplacé par une vraie requête API
  alert('✅ Connexion en cours... (Backend à connecter)');
}

// ===== SOUMETTRE DOSSIER =====
function soumettreDossier() {
  const nom = document.getElementById('nom').value.trim();
  const prenom = document.getElementById('prenom').value.trim();
  const specialite = document.getElementById('specialite').value;

  if (!nom || !prenom || !specialite) {
    alert('⚠️ Veuillez compléter tous les champs obligatoires.');
    return;
  }

  alert('🎉 Votre dossier a été soumis avec succès !\nVous serez contacté par l\'administration de l\'UML.');
}