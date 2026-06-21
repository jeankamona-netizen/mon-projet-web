const express = require('express');
const router = express.Router();

// ===== STOCKAGE TEMPORAIRE (en attendant MySQL) =====
let preinscriptions = [];
let prochainId = 1;

// ===== POST /api/preinscription — soumettre un dossier =====
router.post('/', (req, res) => {
  const { nom, postnom, prenom, dateNaissance, email, telephone, specialite } = req.body;

  // Validation simple
  if (!nom || !prenom || !specialite) {
    return res.status(400).json({
      erreur: "Veuillez remplir les champs obligatoires (nom, prénom, spécialité)."
    });
  }

  const nouvelleDemande = {
    id: prochainId++,
    nom,
    postnom,
    prenom,
    dateNaissance,
    email,
    telephone,
    specialite,
    statut: "en_attente",
    dateSoumission: new Date().toISOString()
  };

  preinscriptions.push(nouvelleDemande);

  res.status(201).json({
    message: "Votre dossier a été soumis avec succès !",
    dossier: nouvelleDemande
  });
});

// ===== GET /api/preinscription — voir toutes les demandes (admin) =====
router.get('/', (req, res) => {
  res.json(preinscriptions);
});

module.exports = router;