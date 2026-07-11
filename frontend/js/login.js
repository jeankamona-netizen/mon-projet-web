// =====================
// LOGIN — connexion étudiant via backend MySQL
// =====================

// =====================
// ONGLETS CONNEXION / PRÉ-INSCRIPTION
// =====================
function afficherOnglet(nom) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`onglet-${nom}`)?.classList.add('active');
  document.querySelector(`.tab-btn[onclick="afficherOnglet('${nom}')"]`)?.classList.add('active');
}

function togglePassword() {
  const input = document.getElementById('mot-de-passe');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

// =====================
// NAVIGATION ENTRE ÉTAPES DE LA PRÉ-INSCRIPTION
// =====================
function allerEtape(numero) {
  document.querySelectorAll('.form-etape').forEach(e => e.classList.remove('active'));
  document.getElementById(`form-etape-${numero}`)?.classList.add('active');

  document.querySelectorAll('.etape').forEach(el => {
    const n = parseInt(el.id.replace('etape-', ''), 10);
    el.classList.remove('active', 'done');
    if (n < numero) el.classList.add('done');
    else if (n === numero) el.classList.add('active');
  });

  document.querySelector('.login-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function connecterEtudiant() {
  const numero     = document.getElementById('numero-etudiant')?.value.trim();
  const motDePasse = document.getElementById('mot-de-passe')?.value.trim();
  const erreurBox  = document.getElementById('erreur-connexion');

  if (erreurBox) erreurBox.style.display = 'none';

  if (!numero || !motDePasse) {
    if (erreurBox) { erreurBox.textContent = '⚠️ Veuillez remplir tous les champs.'; erreurBox.style.display = 'block'; }
    return;
  }

  const btnLogin = document.querySelector('#onglet-connexion .btn-submit');
  if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = '⏳ Connexion...'; }

  try {
    const reponse = await fetch(`${BASE_URL}/api/auth/etudiant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero, mot_de_passe: motDePasse })
    });

    const donnees = await reponse.json();

    if (!reponse.ok) {
      if (erreurBox) { erreurBox.textContent = '❌ ' + donnees.erreur; erreurBox.style.display = 'block'; }
      return;
    }

    sessionStorage.setItem('etudiant', JSON.stringify(donnees.etudiant));
    window.location.href = 'dashboard.html';

  } catch {
    if (erreurBox) { erreurBox.textContent = '⚠️ Impossible de contacter le serveur. Vérifiez que le backend est démarré.'; erreurBox.style.display = 'block'; }
  } finally {
    if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = 'Se connecter'; }
  }
}

// Validation avec Entrée
document.addEventListener('DOMContentLoaded', () => {
  const mdp = document.getElementById('mot-de-passe');
  if (mdp) mdp.addEventListener('keypress', e => { if (e.key === 'Enter') connecterEtudiant(); });

  // ===== PRÉ-INSCRIPTION =====
  const inputFichiers = document.getElementById('documents');
  if (inputFichiers) {
    inputFichiers.addEventListener('change', () => {
      const zone = document.getElementById('liste-fichiers-choisis');
      if (!zone) return;
      zone.textContent = inputFichiers.files.length > 0
        ? '📎 ' + Array.from(inputFichiers.files).map(f=>f.name).join(', ')
        : '';
    });
  }
});

async function soumettreDossier() {
  const champs = {
    nom:              document.getElementById('nom')?.value.trim(),
    postnom:          document.getElementById('postnom')?.value.trim(),
    prenom:           document.getElementById('prenom')?.value.trim(),
    dateNaissance:    document.getElementById('date-naissance')?.value,
    lieuNaissance:    document.getElementById('lieu-naissance')?.value.trim(),
    nationalite:      document.getElementById('nationalite')?.value.trim(),
    sexe:             document.getElementById('sexe')?.value,
    etatCivil:        document.getElementById('etat-civil')?.value,
    typeIdentite:     document.getElementById('type-identite')?.value,
    numIdentite:      document.getElementById('num-identite')?.value.trim(),
    adresse1:         document.getElementById('adresse1')?.value.trim(),
    adresse2:         document.getElementById('adresse2')?.value.trim(),
    telephone:        document.getElementById('telephone')?.value.trim(),
    email:            document.getElementById('email')?.value.trim(),
    nomPere:          document.getElementById('nom-pere')?.value.trim()       || '',
    telPere:          document.getElementById('tel-pere')?.value.trim()       || '',
    nomMere:          document.getElementById('nom-mere')?.value.trim()       || '',
    telMere:          document.getElementById('tel-mere')?.value.trim()       || '',
    nomTuteur:        document.getElementById('nom-tuteur')?.value.trim()     || '',
    telTuteur:        document.getElementById('tel-tuteur')?.value.trim()     || '',
    adresseUrgence:   document.getElementById('adresse-urgence')?.value.trim()|| '',
    ecole:            document.getElementById('ecole')?.value.trim(),
    villeEcole:       document.getElementById('ville-ecole')?.value.trim(),
    numDiplome:       document.getElementById('num-diplome')?.value.trim()    || '',
    pourcentage:      document.getElementById('pourcentage')?.value.trim(),
    anneeDiplome:     document.getElementById('annee-diplome')?.value         || '',
    sectionSecondaire:document.getElementById('section-secondaire')?.value.trim(),
    specialite:       document.getElementById('specialite')?.value,
    specialite2:      document.getElementById('specialite2')?.value           || '',
    niveau:           document.getElementById('niveau')?.value,
    redoublant:       document.getElementById('redoublant')?.checked          || false,
    professionnel:    document.getElementById('professionnel')?.checked        || false,
    refNom:           document.getElementById('ref-nom')?.value.trim()        || '',
    refPostnom:       document.getElementById('ref-postnom')?.value.trim()    || '',
    refPrenom:        document.getElementById('ref-prenom')?.value.trim()     || '',
    refTelephone:     document.getElementById('ref-telephone')?.value.trim()  || '',
    refEmail:         document.getElementById('ref-email')?.value.trim()      || '',
    canalDecouverte:  document.getElementById('canal-decouverte')?.value      || '',
  };

  if (!champs.nom || !champs.prenom || !champs.specialite || !champs.pourcentage || !champs.sectionSecondaire) {
    afficherToast('⚠️ Veuillez remplir tous les champs obligatoires.', 'erreur'); return;
  }

  const btnSoumettre = document.querySelector('#form-etape-4 .btn-submit');
  if (btnSoumettre) { btnSoumettre.disabled=true; btnSoumettre.textContent='⏳ Envoi en cours...'; }

  try {
    const reponse = await fetch(`${BASE_URL}/api/preinscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(champs)
    });

    const donnees = await reponse.json();
    if (!reponse.ok) { afficherToast('❌ ' + donnees.erreur, 'erreur'); return; }

    // Upload documents si présents
    const inputFichiers = document.getElementById('documents');
    if (inputFichiers?.files.length > 0) {
      const formData = new FormData();
      Array.from(inputFichiers.files).forEach(f => formData.append('documents', f));
      try {
        await fetch(`${BASE_URL}/api/preinscription/${donnees.id}/documents`, { method:'POST', body:formData });
      } catch (err) { console.warn('Documents non uploadés:', err.message); }
    }

    afficherToast('🎉 ' + donnees.message + ' Redirection vers l\'accueil...');
    setTimeout(() => { window.location.href = 'index.html'; }, 2200);

  } catch {
    afficherToast('⚠️ Impossible de contacter le serveur.', 'erreur');
  } finally {
    if (btnSoumettre) { btnSoumettre.disabled=false; btnSoumettre.textContent='✅ Soumettre ma candidature'; }
  }
}
