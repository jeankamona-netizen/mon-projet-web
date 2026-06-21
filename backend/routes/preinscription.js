const express = require('express');
const router = express.Router();

// ===== STOCKAGE TEMPORAIRE (en attendant MySQL) =====
let preinscriptions = [];
let prochainId = 1;

// ===== POST /api/preinscription — soumettre un dossier complet =====
router.post('/', (req, res) => {
  const {
    // Identité
    nom, postnom, prenom, dateNaissance, lieuNaissance, nationalite, sexe, etatCivil,
    typeIdentite, numIdentite,

    // Contact
    adresse1, adresse2, telephone, email,

    // Responsables / tuteurs
    nomPere, telPere, nomMere, telMere, nomTuteur, telTuteur, adresseUrgence,

    // Études secondaires
    ecole, villeEcole, numDiplome, pourcentage, anneeDiplome, sectionSecondaire,

    // Choix du programme
    specialite, specialite2, niveau, redoublant, professionnel,

    // Personne de référence
    refNom, refPostnom, refPrenom, refTelephone, refEmail,

    // Complémentaire
    canalDecouverte
  } = req.body;

  // Validation des champs obligatoires
  if (!nom || !prenom || !specialite || !pourcentage || !sectionSecondaire) {
    return res.status(400).json({
      erreur: "Veuillez remplir les champs obligatoires (nom, prénom, spécialité, pourcentage, section)."
    });
  }

  const nouvelleDemande = {
    id: prochainId++,

    nom, postnom, prenom, dateNaissance, lieuNaissance, nationalite, sexe, etatCivil,
    typeIdentite, numIdentite,

    adresse1, adresse2, telephone, email,

    nomPere, telPere, nomMere, telMere, nomTuteur, telTuteur, adresseUrgence,

    ecole, villeEcole, numDiplome, pourcentage, anneeDiplome, sectionSecondaire,

    specialite, specialite2, niveau,
    redoublant: Boolean(redoublant),
    professionnel: Boolean(professionnel),

    refNom, refPostnom, refPrenom, refTelephone, refEmail,

    canalDecouverte,

    statut: "en_attente",
    dateSoumission: new Date().toISOString()
  };

  preinscriptions.push(nouvelleDemande);

  res.status(201).json({
    message: "Votre dossier a été soumis avec succès !",
    dossier: nouvelleDemande
  });
});

// ===== GET /api/preinscription — toutes les demandes (admin) =====
router.get('/', (req, res) => {
  res.json(preinscriptions);
});

// ===== GET /api/preinscription/:id — un dossier précis =====
router.get('/:id', (req, res) => {
  const dossier = preinscriptions.find(p => p.id === parseInt(req.params.id));

  if (!dossier) {
    return res.status(404).json({ erreur: "Dossier non trouvé." });
  }

  res.json(dossier);
});

// ===== PUT /api/preinscription/:id — changer le statut (accepter/rejeter) =====
router.put('/:id', (req, res) => {
  const dossier = preinscriptions.find(p => p.id === parseInt(req.params.id));

  if (!dossier) {
    return res.status(404).json({ erreur: "Dossier non trouvé." });
  }

  const { statut } = req.body;
  const statutsValides = ['en_attente', 'accepte', 'rejete'];

  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ erreur: "Statut invalide." });
  }

  dossier.statut = statut;

  res.json({
    message: `Statut mis à jour : ${statut}`,
    dossier
  });
});

module.exports = router;