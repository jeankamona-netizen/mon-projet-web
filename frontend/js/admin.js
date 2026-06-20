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