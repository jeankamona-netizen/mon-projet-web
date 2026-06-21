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

// ===== CONNEXION (connectée au backend) =====
async function seConnecter() {
  const numeroEtudiant = document.getElementById('numero-etudiant').value.trim();
  const motDePasse = document.getElementById('mot-de-passe').value.trim();

  if (!numeroEtudiant || !motDePasse) {
    alert('⚠️ Veuillez remplir tous les champs.');
    return;
  }

  try {const reponse = await fetch('http://localhost:3000/api/preinscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom, postnom, prenom, dateNaissance, lieuNaissance, nationalite, sexe, etatCivil,
        adresse1, telephone, email, ecole, villeEcole, pourcentage, sectionSecondaire,
        specialite, specialite2, niveau, refNom, refPrenom, refTelephone, canalDecouverte,
        nomPere: document.getElementById('nom-pere')?.value.trim() || '',
        telPere: document.getElementById('tel-pere')?.value.trim() || '',
        nomMere: document.getElementById('nom-mere')?.value.trim() || '',
        telMere: document.getElementById('tel-mere')?.value.trim() || '',
        nomTuteur: document.getElementById('nom-tuteur')?.value.trim() || '',
        telTuteur: document.getElementById('tel-tuteur')?.value.trim() || '',
        adresseUrgence: document.getElementById('adresse-urgence')?.value.trim() || '',
        numDiplome: document.getElementById('num-diplome')?.value.trim() || '',
        anneeDiplome: document.getElementById('annee-diplome')?.value || '',
        redoublant: document.getElementById('redoublant')?.checked || false,
        professionnel: document.getElementById('professionnel')?.checked || false,
        refPostnom: document.getElementById('ref-postnom')?.value.trim() || '',
        refEmail: document.getElementById('ref-email')?.value.trim() || '',
        typeIdentite: document.getElementById('type-identite')?.value || '',
        numIdentite: document.getElementById('num-identite')?.value.trim() || '',
        adresse2: document.getElementById('adresse2')?.value.trim() || ''
      })
    });

    const donnees = await reponse.json();

    if (!reponse.ok) {
      alert('❌ ' + donnees.erreur);
      return;
    }

    alert('✅ ' + donnees.message);
    // Redirection vers le dashboard
    window.location.href = 'dashboard.html';

  } catch (erreur) {
    alert('⚠️ Impossible de contacter le serveur. Vérifiez que le backend est démarré.');
    console.error(erreur);
  }
}


async function soumettreDossier() {
  // Identité
  const nom = document.getElementById('nom').value.trim();
  const postnom = document.getElementById('postnom').value.trim();
  const prenom = document.getElementById('prenom').value.trim();
  const dateNaissance = document.getElementById('date-naissance').value;
  const lieuNaissance = document.getElementById('lieu-naissance').value.trim();
  const nationalite = document.getElementById('nationalite').value.trim();
  const sexe = document.getElementById('sexe').value;
  const etatCivil = document.getElementById('etat-civil').value;
  const typeIdentite = document.getElementById('type-identite').value;
  const numIdentite = document.getElementById('num-identite').value.trim();

  // Contact
  const adresse1 = document.getElementById('adresse1').value.trim();
  const adresse2 = document.getElementById('adresse2').value.trim();
  const telephone = document.getElementById('telephone').value.trim();
  const email = document.getElementById('email').value.trim();

  // Responsables / tuteurs
  const nomPere = document.getElementById('nom-pere').value.trim();
  const telPere = document.getElementById('tel-pere').value.trim();
  const nomMere = document.getElementById('nom-mere').value.trim();
  const telMere = document.getElementById('tel-mere').value.trim();
  const nomTuteur = document.getElementById('nom-tuteur').value.trim();
  const telTuteur = document.getElementById('tel-tuteur').value.trim();
  const adresseUrgence = document.getElementById('adresse-urgence').value.trim();

  // Études secondaires
  const ecole = document.getElementById('ecole').value.trim();
  const villeEcole = document.getElementById('ville-ecole').value.trim();
  const numDiplome = document.getElementById('num-diplome').value.trim();
  const pourcentage = document.getElementById('pourcentage').value.trim();
  const anneeDiplome = document.getElementById('annee-diplome').value;
  const sectionSecondaire = document.getElementById('section-secondaire').value.trim();

  // Choix du programme
  const specialite = document.getElementById('specialite').value;
  const specialite2 = document.getElementById('specialite2').value;
  const niveau = document.getElementById('niveau').value;
  const redoublant = document.getElementById('redoublant').checked;
  const professionnel = document.getElementById('professionnel').checked;

  // Personne de référence
  const refNom = document.getElementById('ref-nom').value.trim();
  const refPostnom = document.getElementById('ref-postnom').value.trim();
  const refPrenom = document.getElementById('ref-prenom').value.trim();
  const refTelephone = document.getElementById('ref-telephone').value.trim();
  const refEmail = document.getElementById('ref-email').value.trim();

  // Complémentaire
  const canalDecouverte = document.getElementById('canal-decouverte').value;

  // Validation
  if (!nom || !prenom || !specialite || !pourcentage || !sectionSecondaire) {
    alert('⚠️ Veuillez compléter tous les champs obligatoires.');
    return;
  }

  // Vérification de debug : affiche dans la console ce qui va être envoyé
  console.log('Données envoyées au serveur:', {
    redoublant, professionnel, nomPere, nomMere, nomTuteur, adresseUrgence, numDiplome, anneeDiplome, refEmail
  });

  const btnSoumettre = document.querySelector('#form-etape-4 .btn-submit');
  btnSoumettre.disabled = true;
  btnSoumettre.textContent = '⏳ Envoi en cours...';

  try {
    const reponse = await fetch('http://localhost:3000/api/preinscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom, postnom, prenom, dateNaissance, lieuNaissance, nationalite, sexe, etatCivil,
        typeIdentite, numIdentite,
        adresse1, adresse2, telephone, email,
        nomPere, telPere, nomMere, telMere, nomTuteur, telTuteur, adresseUrgence,
        ecole, villeEcole, numDiplome, pourcentage, anneeDiplome, sectionSecondaire,
        specialite, specialite2, niveau, redoublant, professionnel,
        refNom, refPostnom, refPrenom, refTelephone, refEmail,
        canalDecouverte
      })
    });

    const donnees = await reponse.json();

    if (!reponse.ok) {
      alert('❌ ' + donnees.erreur);
      btnSoumettre.disabled = false;
      btnSoumettre.textContent = '✅ Soumettre ma candidature';
      return;
    }

    console.log('Dossier enregistré côté serveur:', donnees.dossier);

    alert('🎉 ' + donnees.message + '\nVous allez être redirigé vers la page d\'accueil.');
    window.location.href = 'index.html';

  } catch (erreur) {
    alert('⚠️ Impossible de contacter le serveur. Vérifiez que le backend est démarré.');
    console.error(erreur);
    btnSoumettre.disabled = false;
    btnSoumettre.textContent = '✅ Soumettre ma candidature';
  }
}

function afficherNomsFichiers() {
  const input = document.getElementById('documents');
  const zone = document.getElementById('liste-fichiers-choisis');

  if (input.files.length === 0) {
    zone.textContent = '';
    return;
  }

  const noms = Array.from(input.files).map(f => f.name);
  zone.textContent = '📎 ' + noms.join(', ');
}